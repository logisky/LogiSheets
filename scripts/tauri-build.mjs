// Build the desktop bundle for a distribution, in one command, on any shell.
//
// `cargo tauri build` on its own bundles whatever `dist/` happens to be lying
// around — `beforeBuildCommand` is empty because CI builds the frontend once
// on Linux and hands the same `dist/` to each OS bundler. Locally that is a
// trap: a stale or missing `dist/` produces a bundle that looks fine and isn't.
// So this script builds the frontend first, unless told not to.
//
// It also sidesteps the quoting problem. CI can get away with
// `tauri build -c "$(node scripts/craft-dist.mjs tauri)"` because it pins
// `shell: bash`; a developer on PowerShell cannot. Here the override goes to a
// temp file and Tauri is handed the path, which every shell spells the same.
//
// Usage (from the repo root, or anywhere — paths are resolved from this file):
//   node scripts/tauri-build.mjs                  # default distribution
//   CRAFT_DIST=zh node scripts/tauri-build.mjs    # a named distribution
//   node scripts/tauri-build.mjs --skip-frontend  # reuse the existing dist/
//   node scripts/tauri-build.mjs -- --debug       # extra args for `tauri build`
import {spawnSync} from 'node:child_process'
import {mkdtempSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const desktop = join(root, 'packages', 'desktop')

const argv = process.argv.slice(2)
const skipFrontend = argv.includes('--skip-frontend')
const passThrough = argv.includes('--') ? argv.slice(argv.indexOf('--') + 1) : []

/** Run a command, inheriting stdio, and stop the build if it fails. */
function run(cmd, args, cwd) {
    console.log(`\n> ${cmd} ${args.join(' ')}`)
    const r = spawnSync(cmd, args, {cwd, stdio: 'inherit', shell: true})
    if (r.status !== 0) {
        console.error(`\n${cmd} failed (exit ${r.status})`)
        process.exit(r.status ?? 1)
    }
}

/** Ask craft-dist for one of its outputs. */
function craftDist(cmd) {
    const r = spawnSync(
        process.execPath,
        [join(root, 'scripts', 'craft-dist.mjs'), cmd],
        {encoding: 'utf8'}
    )
    if (r.status !== 0) {
        console.error(r.stderr.trim())
        process.exit(r.status ?? 1)
    }
    return r.stdout.trim()
}

const distribution = process.env.CRAFT_DIST || 'default'
console.log(craftDist('info'))
console.log(`signing: ${craftDist('signing')}`)

if (!skipFrontend) {
    // The same command CI runs, so a local bundle and a CI bundle contain the
    // same `dist/`.
    run('yarn', ['build'], root)
} else {
    console.log('\n(skipping the frontend build — bundling the existing dist/)')
}

const configPath = join(
    mkdtempSync(join(tmpdir(), 'logisheets-tauri-')),
    `${distribution}.json`
)
writeFileSync(configPath, craftDist('tauri'))

run('cargo', ['tauri', 'build', '-c', configPath, ...passThrough], desktop)

console.log(
    `\nBundles: packages/desktop/src-tauri/target/release/bundle/` +
        `\n(Windows: nsis/*-setup.exe and msi/*.msi)`
)
