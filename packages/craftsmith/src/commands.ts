import fs from 'node:fs'
import path from 'node:path'
import {build as esbuild} from 'esbuild'
import {strToU8, zipSync} from 'fflate'
import {extract, resolveCraft} from './extract.js'
import type {Diagnostic} from './diagnostics.js'
import type {CraftManifest, ManifestRole} from './manifest.js'

function printDiagnostics(diags: Diagnostic[]): {
    errors: number
    warns: number
} {
    let errors = 0
    let warns = 0
    for (const d of diags) {
        const loc = d.file
            ? `${path.relative(process.cwd(), d.file)}${
                  d.line ? ':' + d.line : ''
              }`
            : ''
        const tag = d.level === 'error' ? 'error' : 'warn'
        console.error(`  ${tag}${loc ? ' ' + loc : ''}: ${d.message}`)
        if (d.level === 'error') errors++
        else warns++
    }
    return {errors, warns}
}

/**
 * `craftsmith check <dir>` — validate only, no writes. Returns 1 if any
 * diagnostic is an error, else 0 (warnings pass). Throws if `dir` is not a
 * craft directory.
 */
export function check(dir: string): number {
    const {manifest, diagnostics} = extract(dir)
    if (diagnostics.length) {
        console.error(`craft "${manifest.craftId}":`)
        const {errors, warns} = printDiagnostics(diagnostics)
        console.error(
            `\n${errors} error(s), ${warns} warning(s).` +
                (errors ? '' : ' OK.')
        )
        return errors ? 1 : 0
    }
    const nRoles = manifest.roles?.length ?? 0
    console.error(
        `craft "${manifest.craftId}" OK — ${
            manifest.tools?.length ?? 0
        } tool(s)` +
            `${nRoles ? `, ${nRoles} AI role(s)` : ''}` +
            `${manifest.skill ? ', skill declared' : ''}` +
            `${manifest.url ? ', has UI' : ''}.`
    )
    return 0
}

/**
 * `craftsmith build <dir>` — validate, compile, write dist/. On any error
 * diagnostic returns 1 before touching the filesystem. Otherwise writes
 * dist/tools.js, dist/runtime.js, dist/index.html (each only if its source
 * exists), dist/manifest.json, and — when the craft declares roles —
 * craft-roles.d.ts in the craft ROOT (not dist/). Existing dist/ files are
 * overwritten, never cleaned, and a stale craft-roles.d.ts is not removed
 * when the last role goes. An esbuild failure rejects (CLI exit 1).
 */
export async function buildCraft(dir: string): Promise<number> {
    const paths = resolveCraft(dir)
    const {manifest, diagnostics} = extract(dir)
    const errors = diagnostics.filter((d) => d.level === 'error')
    if (diagnostics.length) {
        console.error(`craft "${manifest.craftId}":`)
        printDiagnostics(diagnostics)
    }
    if (errors.length) {
        console.error(`\n${errors.length} error(s) — build aborted.`)
        return 1
    }

    const dist = path.join(paths.root, 'dist')
    fs.mkdirSync(dist, {recursive: true})

    // Bundle SELF-CONTAINED ESM: the published tools.js is loaded by Watson via
    // a browser `import('/<craftId>/tools.js')`, which can't resolve bare
    // specifiers (there is no bundler/import-map at that point). So deps are
    // bundled in, exactly like the craft's own UMD page bundle. Tree-shaking
    // keeps it small — a tool that only uses pure helpers won't pull the engine.
    const bundleEsm = (entry: string, outfile: string) =>
        esbuild({
            entryPoints: [entry],
            outfile: path.join(dist, outfile),
            bundle: true,
            format: 'esm',
            platform: 'browser',
            target: 'es2020',
            logLevel: 'silent',
        })

    if (paths.toolsTs) await bundleEsm(paths.toolsTs, 'tools.js')
    if (paths.runtimeTs) await bundleEsm(paths.runtimeTs, 'runtime.js')

    if (paths.indexHtml)
        fs.copyFileSync(paths.indexHtml, path.join(dist, 'index.html'))

    fs.writeFileSync(
        path.join(dist, 'manifest.json'),
        JSON.stringify(manifest, null, 2) + '\n'
    )

    if (manifest.roles?.length) writeRoleTypes(dir, manifest.roles)

    const counts = [
        `${manifest.tools?.length ?? 0} tool(s)`,
        ...(manifest.roles?.length ? [`${manifest.roles.length} role(s)`] : []),
    ]
    console.error(
        `built craft "${manifest.craftId}" → ${path.relative(
            process.cwd(),
            dist
        )}/ ` + `(manifest.json, ${counts.join(', ')})`
    )
    return 0
}

/**
 * Emit `craft-roles.d.ts` beside `tools.ts`, mapping each role name to its
 * reply type and typing `window.craftAi` with it.
 *
 * Without this a craft would restate the reply type at every call site
 * (`ask<OpponentMove>('opponent', …)`) and could get it wrong — the drift the
 * generated manifest exists to prevent.
 */
function writeRoleTypes(dir: string, roles: readonly ManifestRole[]): void {
    const names = [...new Set(roles.map((r) => r.replyType))].sort()
    const body = roles
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        // Quote only what has to be quoted, so the emitted file is what
        // prettier would have written and does not fail the repo's lint.
        .map((r) => {
            const key = /^[A-Za-z_$][\w$]*$/.test(r.name)
                ? r.name
                : JSON.stringify(r.name)
            return `    ${key}: ${r.replyType}`
        })
        .join('\n')
    fs.writeFileSync(
        path.join(dir, 'craft-roles.d.ts'),
        `// GENERATED by \`craftsmith build\`. Do not edit.\n` +
            `import type {CraftAi} from 'logisheets-craftsmith/authoring'\n` +
            `import type {${names.join(', ')}} from './tools'\n\n` +
            `export interface CraftRoles {\n${body}\n}\n\n` +
            `declare global {\n` +
            `    interface Window {\n` +
            `        craftAi: CraftAi<CraftRoles>\n` +
            `    }\n` +
            `}\n`
    )
}

/**
 * Files in dist/ that never ship in a `.craft`: type declarations and source
 * maps are for the author, and the manifest is rewritten (with `files`) rather
 * than copied.
 */
function packExcluded(rel: string): boolean {
    return (
        rel === 'manifest.json' || rel.endsWith('.d.ts') || rel.endsWith('.map')
    )
}

/*
 * The rules a host applies when it installs a package (LogiSheets:
 * src/core/craft-packages/validate.ts). Checked here too, so a package that
 * packs is a package that installs — keep the two in step.
 */
const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_PACKAGE_BYTES = 20 * 1024 * 1024
const MAX_CRAFT_ID_LENGTH = 32
const PATH_SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/

function isSafePackagePath(p: string): boolean {
    return (
        !!p &&
        p.length <= 200 &&
        p.split('/').every((s) => PATH_SEGMENT.test(s))
    )
}

/**
 * Every entry's timestamp. A zip records one per file, so packing the same
 * bytes twice would otherwise give two different packages (and sha256s) — and
 * a registry that refuses to republish a version with a new hash would then
 * refuse an unchanged craft. Built from LOCAL components because the zip
 * format stores local time: 1980-01-01 00:00 encodes the same in any timezone.
 */
const FIXED_MTIME = new Date(1980, 0, 1)

function listFiles(root: string, rel = ''): string[] {
    const out: string[] = []
    for (const e of fs.readdirSync(path.join(root, rel), {
        withFileTypes: true,
    })) {
        const r = rel ? `${rel}/${e.name}` : e.name
        if (e.isDirectory()) out.push(...listFiles(root, r))
        else if (e.isFile()) out.push(r)
    }
    return out.sort()
}

/**
 * `craftsmith pack <dir>` — zip a built craft into `<craftId>-<version>.craft`
 * in the craft root: the installable package a user picks in the app's
 * "Install craft…" dialog.
 *
 * Re-runs the checks (returns 1 on any error) and needs a prior build (returns
 * 1 without dist/manifest.json). Every file under dist/ ships, except
 * `packExcluded` ones; the packed manifest.json is dist's plus `files`, the
 * list of what was packed — the host serves exactly that list. Returns 1 if an
 * entry the manifest names (`url`, a tool's `entry`) is not in dist/, or if
 * the package would be refused at install (id, file names, sizes).
 *
 * Deterministic: the same dist/ always packs to the same bytes, so a package's
 * sha256 identifies its content (see FIXED_MTIME).
 */
export function pack(dir: string): number {
    const paths = resolveCraft(dir)
    const {diagnostics} = extract(dir)
    if (diagnostics.some((d) => d.level === 'error')) {
        printDiagnostics(diagnostics)
        console.error('\ncheck failed — not packed.')
        return 1
    }
    const dist = path.join(paths.root, 'dist')
    const manifestPath = path.join(dist, 'manifest.json')
    if (!fs.existsSync(manifestPath)) {
        console.error('no dist/manifest.json — run `craftsmith build` first')
        return 1
    }
    const manifest = JSON.parse(
        fs.readFileSync(manifestPath, 'utf8')
    ) as CraftManifest
    const files = listFiles(dist).filter((f) => !packExcluded(f))
    const needed = [
        ...(manifest.url ? [manifest.url] : []),
        ...(manifest.tools ?? []).map((t) => t.entry),
    ]
    const missing = [...new Set(needed)].filter((f) => !files.includes(f))
    if (missing.length) {
        console.error(
            `dist/ is missing ${missing.join(', ')} — run the full build first`
        )
        return 1
    }
    const problems: string[] = []
    if (
        manifest.craftId.length > MAX_CRAFT_ID_LENGTH ||
        !/^[a-z0-9][a-z0-9-]*$/.test(manifest.craftId)
    )
        problems.push(
            `craftId "${manifest.craftId}" must be kebab-case, at most ${MAX_CRAFT_ID_LENGTH} characters`
        )
    for (const f of files)
        if (!isSafePackagePath(f))
            problems.push(
                `file name "${f}" is not installable (ASCII letters, digits, ".", "_", "-")`
            )
    const entries: Record<string, [Uint8Array, {mtime: Date}]> = {}
    const put = (name: string, data: Uint8Array) => {
        entries[name] = [data, {mtime: FIXED_MTIME}]
    }
    put(
        'manifest.json',
        strToU8(JSON.stringify({...manifest, files}, null, 2) + '\n')
    )
    let total = 0
    for (const f of files) {
        const data = new Uint8Array(fs.readFileSync(path.join(dist, f)))
        if (data.byteLength > MAX_FILE_BYTES)
            problems.push(`${f} is over ${MAX_FILE_BYTES / 1024 / 1024} MB`)
        total += data.byteLength
        put(f, data)
    }
    if (total > MAX_PACKAGE_BYTES)
        problems.push(`package is over ${MAX_PACKAGE_BYTES / 1024 / 1024} MB`)
    if (problems.length) {
        for (const p of problems) console.error(`  error: ${p}`)
        console.error('\nnot packed.')
        return 1
    }
    const out = path.join(
        paths.root,
        `${manifest.craftId}-${manifest.version}.craft`
    )
    fs.writeFileSync(out, zipSync(entries, {level: 9}))
    console.error(
        `packed ${files.length + 1} file(s) → ${path.relative(
            process.cwd(),
            out
        )}`
    )
    return 0
}

/**
 * `craftsmith new <name>` — scaffold a craft directory (package.json,
 * tsconfig.json, tools.ts, index.html, .gitignore, README.md). `name` may be
 * a path; its basename becomes the package name and craftId, unvalidated.
 * Returns 1 if the directory already exists.
 */
export function scaffold(nameArg: string): number {
    const dir = path.resolve(nameArg)
    const name = path.basename(dir)
    if (fs.existsSync(dir)) {
        console.error(`${dir} already exists`)
        return 1
    }
    fs.mkdirSync(dir, {recursive: true})
    const w = (f: string, c: string) => fs.writeFileSync(path.join(dir, f), c)

    w(
        'package.json',
        JSON.stringify(
            {
                name,
                // craftId: stable id the host installs under (kebab-case).
                craftId: name,
                version: '0.1.0',
                // label: human name shown in the craft picker.
                label: name,
                description: 'A LogiSheets craft.',
                license: 'MIT',
                scripts: {
                    // Validate the craft (tool contract + purity). No writes.
                    check: 'craftsmith check .',
                    // Compile tools.ts/runtime.ts, emit dist/ (+ manifest.json).
                    build: 'craftsmith build .',
                },
                dependencies: {},
                devDependencies: {
                    'logisheets-craftsmith': 'workspace:*',
                    typescript: '^6.0.0',
                },
            },
            null,
            4
        ) + '\n'
    )
    w(
        'tsconfig.json',
        JSON.stringify(
            {
                compilerOptions: {
                    target: 'ES2020',
                    module: 'ESNext',
                    moduleResolution: 'Bundler',
                    strict: true,
                    skipLibCheck: true,
                    noEmit: true,
                    lib: ['ES2020', 'DOM'],
                },
                include: ['.'],
            },
            null,
            4
        ) + '\n'
    )
    w(
        'tools.ts',
        `import type {SkillCtx} from 'logisheets-craftsmith/authoring'

/*
 * ───────────────────────────────────────────────────────────────────────────
 *  tools.ts — the functions this craft exposes to the Watson AI assistant.
 *
 *  Every function here is PURE / ambient-free: it takes what it needs through
 *  parameters and returns a value. No window, no DOM, no globals. That is what
 *  lets the SAME function be called by your page (index.html), by Watson, and by
 *  a unit test — you write the logic once.
 *
 *  \`craftsmith build\` reads this file with the TypeScript type checker and
 *  generates dist/manifest.json — the capability manifest Watson reads to
 *  discover your craft and call these functions. You never hand-write that
 *  manifest; it always matches your code. Run \`craftsmith check\` anytime.
 *
 *  Annotations that drive the manifest (plain JSDoc — no runtime decorators):
 *    @logicianSkill  once, at the top — what this craft is for and WHEN Watson
 *                    should use it (this is what Watson sees when browsing crafts)
 *    @guidance       optional — extra how-to injected when Watson picks this craft
 *    @tool <desc>    on each exported fn — makes it a callable tool
 *      @param name <desc>   describe each argument
 *      @mutates none|temp|true                does it change the sheet? (default none)
 *      @confirm never|once|always|destructive  ask the user first? (default never)
 * ───────────────────────────────────────────────────────────────────────────
 */

/**
 * @logicianSkill Describe what this craft does and WHEN Watson should reach for
 *   it — e.g. "Budget helper: fills and balances a monthly budget. Use when the
 *   user asks to set up or rebalance a budget."
 * @guidance Optional, e.g. "Call count_sheets first if you need the sheet count."
 */

/**
 * A tool is a normal exported function. Its FIRST parameter is always \`ctx\`
 * (injected by the host — never shown to the model); every parameter AFTER it
 * becomes the tool's input, inferred from the TypeScript types. Prefer simple
 * types (string, number, boolean, string-literal unions → enums, arrays, plain
 * object shapes) so they map cleanly to JSON Schema.
 *
 * @tool Write text into a cell on the first sheet.
 * @param row  Zero-based row index.
 * @param col  Zero-based column index.
 * @param text The text to write.
 * @mutates true
 * @confirm always
 */
export async function writeCell(
    ctx: SkillCtx,
    row: number,
    col: number,
    text: string
): Promise<{written: string}> {
    // ctx.workbook is the live client (read + write). One transaction = one undo
    // step. Note: handleTransaction does NOT throw on rejection — inspect the
    // returned effect's status if you need to handle failure.
    await ctx.workbook.handleTransaction({
        transaction: {
            payloads: [
                {type: 'cellInput', value: {sheetIdx: 0, row, col, content: text}},
            ],
            undoable: true,
            temp: false,
        },
    })
    // Whatever you return is handed back to the model as the tool's result.
    return {written: text}
}

/**
 * A read-only tool: keep the defaults (@mutates none, @confirm never).
 * @tool Report how many sheets the workbook has.
 */
export async function countSheets(ctx: SkillCtx): Promise<{sheets: number}> {
    const infos = (await ctx.workbook.getAllSheetInfo()) as unknown[]
    return {sheets: Array.isArray(infos) ? infos.length : 0}
}

/*
 * ── ctx cheat-sheet ─────────────────────────────────────────────────────────
 *  ctx.workbook              the live client: getCell / getCells /
 *                            getAllSheetInfo / getCellInfos / …, and
 *                            handleTransaction({transaction:{payloads,undoable,temp}}).
 *  ctx.workbook.getVersion() a number that bumps on every committed write.
 *                            Read-then-write? snapshot it, re-check before you
 *                            write, and retry if it changed — so you never
 *                            clobber a user's concurrent edit.
 *  ctx.craftState            OPTIONAL get()/set() for THIS craft's own saved
 *                            JSON. Use it ONLY for state that is NOT already in
 *                            the sheet (a preference, a hidden config). If your
 *                            state is in cells, read it from ctx.workbook.
 *  ctx.confirm(msg)          ask the user to approve; ctx.log(msg) writes a line
 *                            into the chat transcript.
 *  ctx.signal                an AbortSignal — fires if the user cancels the turn.
 * ────────────────────────────────────────────────────────────────────────────
 */
`
    )
    w(
        'index.html',
        `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>${name}</title></head>
<body>
  <!--
    The craft's UI. LogiSheets loads this inside the craft panel and, AFTER the
    page has loaded, injects window.workbook (and other host APIs) onto it — so
    don't touch window.workbook at the top level; wait until it exists.

    Your page and Watson call the SAME functions from tools.ts. Here a button
    calls writeCell; Watson calls it too, via the generated manifest. index.html
    is optional — a headless (tools-only) craft can omit it.
  -->
  <button id="go" type="button" disabled>Write into A1</button>
  <script type="module">
    import {writeCell} from './tools.js'

    // Host APIs arrive asynchronously — poll for window.workbook before use.
    function whenReady(cb) {
      let n = 0
      ;(function loop() {
        if (window.workbook) return cb()
        if (n++ > 600) return console.warn('host APIs never arrived')
        setTimeout(loop, 50)
      })()
    }

    // Build the same ctx shape Watson passes to your tools.
    function ctx() {
      return {
        workbook: window.workbook,
        signal: new AbortController().signal,
        confirm: async () => true,
        log: (m) => console.log('[${name}]', m),
      }
    }

    const btn = document.getElementById('go')
    btn.addEventListener('click', () => {
      writeCell(ctx(), 0, 0, 'Hello from a craft 👋')
        .then(() => window.notifyCraft && window.notifyCraft('success', 'Done'))
        .catch((e) => window.notifyCraft && window.notifyCraft('error', String(e)))
    })
    whenReady(() => { btn.disabled = false })
  </script>
</body>
</html>
`
    )
    w('.gitignore', 'node_modules/\ndist/\n')
    w(
        'README.md',
        [
            `# ${name}`,
            '',
            'A [LogiSheets](https://github.com/logisky/LogiSheets) craft — a plugin that',
            'drives the spreadsheet and can expose tools to the Watson AI assistant.',
            '',
            '## Layout',
            '',
            '- `tools.ts` — the functions this craft exposes (pure; shared by the page,',
            '  Watson, and tests). Annotated with `@logicianSkill` / `@tool`.',
            '- `index.html` — the craft UI (optional; omit for a tools-only craft).',
            '- `package.json` — identity (`craftId`, `label`, `version`) + scripts.',
            '',
            '## Develop',
            '',
            '```bash',
            'npm install',
            'npx craftsmith check .   # validate the tool contract (no writes)',
            'npx craftsmith build .   # compile → dist/ (tools.js, manifest.json, index.html)',
            '```',
            '',
            '`dist/manifest.json` is generated from `tools.ts` — never hand-edit it.',
            '',
            '## Publish',
            '',
            'The built `dist/` is the shippable package. Full guide:',
            'https://docs.logisheets.com/craft/writing-a-craft.html',
            '',
        ].join('\n')
    )
    console.error(
        `scaffolded craft "${name}" → ${path.relative(process.cwd(), dir)}/`
    )
    console.error('next: cd in, `npm install`, then `craftsmith check .`')
    return 0
}
