// Does the PUBLISHED artifact load under plain Node ESM?
//
// Everything else in this repo resolves `logisheets*` through the yarn
// workspace, which papers over two whole classes of packaging bug: a runtime
// import of a package that is not a declared dependency, and a module path
// only a bundler can resolve. Both ship green and fail on `npm i`.
//
// v1.16.0 shipped exactly that: logisheets-runtime value-imported
// `isErrorMessage` from `logisheets-web` — a package it does not depend on,
// and which cannot be loaded outside a bundler anyway — so
// `import('logisheets-runtime')` threw ERR_MODULE_NOT_FOUND and nothing
// downstream could boot.
//
// So this test refuses the workspace: it packs each package with `npm pack`
// (the same packlist `npm publish` uses), unpacks the tarballs into a
// throwaway node_modules OUTSIDE the repo, and imports them from a real
// `node` process. Only the DECLARED dependency graph is present — in
// particular `logisheets-web` is deliberately absent, because nothing on the
// Node path may need it at runtime.
//
// Requires the packages to be built (`packages/*/dist`). ci-build.sh does that
// before any test step; locally, run each package's `build` first.

import {describe, it, expect, beforeAll, afterAll} from 'vitest'
import {execFileSync} from 'node:child_process'
import {
    mkdtempSync,
    rmSync,
    mkdirSync,
    writeFileSync,
    existsSync,
} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {tmpdir} from 'node:os'
import {join, resolve, dirname} from 'node:path'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

/** Where each package is packed from. */
const DIRS: Readonly<Record<string, string>> = {
    logisheets: 'packages/node',
    'logisheets-core': 'packages/core',
    'logisheets-runtime': 'packages/runtime',
    'logisheets-web': 'packages/web',
}

/**
 * The Node dependency graph, installed on its own. `logisheets-web` is
 * deliberately NOT here: the whole point is that these three work without it,
 * and installing it alongside would let a reintroduced import resolve and turn
 * this suite green for the wrong reason.
 */
const NODE_PACKAGES = [
    'logisheets',
    'logisheets-core',
    'logisheets-runtime',
] as const

// Node walks UP the tree looking for node_modules, so a consumer must live
// outside the repo or it would silently resolve the workspace copies.
let nodeConsumer: string
let webConsumer: string

function run(cmd: string, args: string[], cwd: string): string {
    return execFileSync(cmd, args, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    })
}

/** Pack `names` and unpack them into a throwaway consumer outside the repo. */
function makeConsumer(names: readonly string[]): string {
    const dir = mkdtempSync(join(tmpdir(), 'logisheets-packaging-'))
    expect(dir.startsWith(REPO)).toBe(false)

    for (const name of names) {
        const from = join(REPO, DIRS[name])
        expect(
            existsSync(join(from, 'dist')),
            `${name}: ${DIRS[name]}/dist is missing — build the packages first`
        ).toBe(true)

        // `--ignore-scripts`: pack the tree as it stands (already built by
        // ci-build.sh) rather than re-running each package's prepack.
        const out = run(
            'npm',
            ['pack', '--ignore-scripts', '--silent', '--pack-destination', dir],
            from
        )
        const tarball = join(dir, out.trim().split('\n').pop()!.trim())

        const into = join(dir, 'node_modules', name)
        mkdirSync(into, {recursive: true})
        run('tar', ['-xzf', tarball, '-C', into, '--strip-components=1'], REPO)
    }

    writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({name: 'consumer', private: true, type: 'module'})
    )
    return dir
}

/** Run `source` as an ESM script inside `consumer`, via a real `node`. */
function probe(consumer: string, label: string, source: string): void {
    const file = join(consumer, `probe-${label.replace(/\W/g, '-')}.mjs`)
    writeFileSync(file, source)
    expect(() => run(process.execPath, [file], consumer)).not.toThrow()
}

beforeAll(() => {
    nodeConsumer = makeConsumer(NODE_PACKAGES)
    webConsumer = makeConsumer(['logisheets-web'])
}, 300_000)

afterAll(() => {
    for (const dir of [nodeConsumer, webConsumer]) {
        if (dir) rmSync(dir, {recursive: true, force: true})
    }
})

describe('published packages load under plain Node ESM', () => {
    it.each(NODE_PACKAGES)('imports %s', (name) => {
        // A separate `node` process, so this exercises Node's own ESM
        // resolver against the unpacked tarballs — not vitest's.
        probe(
            nodeConsumer,
            name,
            `const m = await import(${JSON.stringify(name)})\n` +
                `if (Object.keys(m).length === 0) throw new Error('no exports')\n`
        )
    })

    it('imports logisheets-web/pure', () => {
        // The engine-free subset, which logisheets-logician imports. Its
        // `node` condition resolves to a bundle, because the generated
        // `src/bindings` (290 gents-emitted files) import each other without
        // file extensions and Node ESM will not resolve those.
        probe(
            webConsumer,
            'web-pure',
            [
                `import {isErrorMessage} from 'logisheets-web/pure'`,
                `if (!isErrorMessage({msg: 'x', ty: 'y'})) throw new Error('guard says no')`,
                `if (isErrorMessage({})) throw new Error('guard says yes')`,
            ].join('\n')
        )
    })

    it('runs a workbook end to end through logisheets-runtime', () => {
        // Importing proves the module graph resolves; this proves the WASM
        // engine still loads from the packed layout, which is a separate path
        // (a lazy `createRequire` of the logisheets tarball's glue).
        probe(
            nodeConsumer,
            'smoke',
            [
                `import {SpreadsheetRuntime, isErrorMessage} from 'logisheets-runtime'`,
                `const wb = new SpreadsheetRuntime().createWorkbook()`,
                `await wb.ops.inputCell(0, 0, 0, '=1+1')`,
                `const v = wb.getValue(0, 0, 0)`,
                `if (isErrorMessage(v)) throw new Error('getValue failed: ' + v.msg)`,
                `if (v.value !== 2) throw new Error('expected 2, got ' + JSON.stringify(v))`,
            ].join('\n')
        )
    })

    it('ships the wasm glue where the built entry points at it', () => {
        // `dist/index.js` imports `./wasm/logisheets_wasm_server.js`, and the
        // `./*` export condition sends `logisheets-web/wasm/*` to `dist/wasm/*`
        // too. wasm-pack leaves a `.gitignore` of `*` in its out-dir; if that
        // is ever copied into `dist/wasm`, npm drops the whole directory from
        // the tarball and both paths break.
        const wasm = join(
            webConsumer,
            'node_modules/logisheets-web/dist/wasm/logisheets_wasm_server.js'
        )
        expect(existsSync(wasm), `missing from the tarball: ${wasm}`).toBe(true)
    })

    it('does not need logisheets-web at runtime', () => {
        // logisheets-web's main entry statically imports the web-target WASM
        // glue, so it cannot be loaded outside a bundler. Nothing on the Node
        // path may reach for it — it is not even installed here. Guard the
        // artifacts directly: a `.d.ts` reference is fine (types are erased),
        // an `import`/`export ... from` in emitted JS is the bug.
        const offenders: string[] = []
        for (const name of NODE_PACKAGES) {
            const dist = join(nodeConsumer, 'node_modules', name, 'dist')
            if (!existsSync(dist)) continue
            let hits = ''
            try {
                hits = execFileSync(
                    'grep',
                    [
                        '-rlE',
                        // Anchored, so the doc comments that *mention*
                        // `import ... from 'logisheets-web/wasm/...'` (a
                        // documented browser subpath) do not match.
                        `^[[:space:]]*(import|export)([^'"]*from)?[[:space:]]*['"]logisheets-web`,
                        '--include=*.js',
                        dist,
                    ],
                    {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}
                ).trim()
            } catch {
                // grep exits 1 when nothing matches — the good case.
                hits = ''
            }
            if (hits) offenders.push(...hits.split('\n'))
        }
        expect(offenders).toEqual([])
    })
})
