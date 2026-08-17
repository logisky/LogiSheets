import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {build as esbuild} from 'esbuild'
import {extract, resolveCraft} from './extract.js'
import type {Diagnostic} from './diagnostics.js'

function printDiagnostics(diags: Diagnostic[]): {errors: number; warns: number} {
    let errors = 0
    let warns = 0
    for (const d of diags) {
        const loc = d.file
            ? `${path.relative(process.cwd(), d.file)}${d.line ? ':' + d.line : ''}`
            : ''
        const tag = d.level === 'error' ? 'error' : 'warn'
        console.error(`  ${tag}${loc ? ' ' + loc : ''}: ${d.message}`)
        if (d.level === 'error') errors++
        else warns++
    }
    return {errors, warns}
}

/** `craftsmith check <dir>` — validate only, no writes. Non-zero on error. */
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
    const nTools = manifest.tools?.length ?? 0
    console.error(
        `craft "${manifest.craftId}" OK — ${nTools} tool(s)` +
            `${manifest.skill ? ', skill declared' : ''}` +
            `${manifest.url ? ', has UI' : ''}.`
    )
    return 0
}

/** `craftsmith build <dir>` — validate, compile, write dist/. */
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

    console.error(
        `built craft "${manifest.craftId}" → ${path.relative(process.cwd(), dist)}/ ` +
            `(manifest.json, ${manifest.tools?.length ?? 0} tool(s))`
    )
    return 0
}

/** `craftsmith pack <dir>` — tarball dist/ into <craftId>-<version>.tgz. */
export function pack(dir: string): number {
    const paths = resolveCraft(dir)
    const dist = path.join(paths.root, 'dist')
    if (!fs.existsSync(path.join(dist, 'manifest.json'))) {
        console.error('no dist/manifest.json — run `craftsmith build` first')
        return 1
    }
    const pkg = JSON.parse(fs.readFileSync(paths.packageJson, 'utf8'))
    const id = pkg.craftId ?? pkg.name
    const out = path.join(paths.root, `${id}-${pkg.version ?? '0.0.0'}.tgz`)
    execFileSync('tar', ['-czf', out, '-C', dist, '.'])
    console.error(`packed → ${path.relative(process.cwd(), out)}`)
    return 0
}

/** `craftsmith new <name>` — scaffold a craft directory. */
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
    console.error(`scaffolded craft "${name}" → ${path.relative(process.cwd(), dir)}/`)
    console.error('next: cd in, `npm install`, then `craftsmith check .`')
    return 0
}
