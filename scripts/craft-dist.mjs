// Resolve a craft "distribution" from crafts.config.json + the CRAFT_DIST env
// var (default: "default"), for the non-webpack consumers. Dependency-free ESM
// so it runs on any CI runner with plain Node.
//
// Usage:
//   node scripts/craft-dist.mjs crafts   # selected craft dirs, one per line (publish-crafts.sh)
//   node scripts/craft-dist.mjs tauri    # tauri config override JSON (desktop CI: tauri build -c)
//   node scripts/craft-dist.mjs locale   # the distribution's default UI language
//   node scripts/craft-dist.mjs info     # human-readable summary
//
// webpack reads crafts.config.json directly (see webpack.config.ts) to inject
// the panel's craft list; it does not go through this script.
import {readFileSync} from 'node:fs'

const CONFIG = JSON.parse(
    readFileSync(new URL('../crafts.config.json', import.meta.url), 'utf8')
)

function resolve() {
    const name = process.env.CRAFT_DIST || 'default'
    const dist = CONFIG.distributions[name]
    if (!dist) {
        const known = Object.keys(CONFIG.distributions).join(', ')
        throw new Error(`Unknown CRAFT_DIST "${name}". Known: ${known}`)
    }
    const registry = CONFIG.registry
    const selected = dist.crafts === 'all' ? Object.keys(registry) : dist.crafts
    for (const d of selected) {
        if (!registry[d]) throw new Error(`Craft "${d}" (in distribution "${name}") is not in the registry`)
    }
    // `devOnly` crafts (the debugger) are offered by the dev server only —
    // vite.config.ts applies the same filter to the panel's list. Dropping
    // them here is what keeps them out of dist/ and the desktop bundle: they
    // stay in `registry`, so the prune step in publish-crafts.sh still deletes
    // any dist/<craft> a previous build left behind, and the copy step never
    // puts one back. Filtering after the check above so a typo in an explicit
    // distribution list is still an error.
    const dirs = selected.filter((d) => !registry[d].devOnly)
    return {name, dist, dirs, registry}
}

function tauriOverride(dist) {
    const o = {
        productName: dist.productName,
        identifier: dist.identifier,
        app: {
            windows: [
                {
                    label: 'main',
                    title: dist.windowTitle || dist.productName,
                    width: 1280,
                    height: 800,
                    resizable: true,
                },
            ],
        },
    }
    // Let a distribution restrict bundle targets. Needed for non-ASCII product
    // names: the Windows WiX/MSI bundler (light.exe) fails on CJK names, so a
    // Chinese-named distribution ships NSIS (Unicode-safe) instead of MSI.
    if (Array.isArray(dist.bundleTargets)) {
        o.bundle = {targets: dist.bundleTargets}
    }

    // The Windows installer should speak the language the app was built for.
    // NSIS picks the OS language when it is in this list and falls back to the
    // FIRST entry otherwise — so listing both, distribution's language first,
    // means a Chinese Windows gets a Chinese installer either way and anything
    // else gets the build's own language rather than an accident.
    const nsisLanguages =
        (dist.locale || 'en') === 'zh-CN'
            ? ['SimpChinese', 'English']
            : ['English', 'SimpChinese']
    o.bundle = {...o.bundle, windows: {nsis: {languages: nsisLanguages}}}

    // Windows code signing, when the environment carries a certificate.
    //
    // The checked-in tauri.conf.json deliberately has none of these fields: a
    // config with an empty thumbprint looks configured and is not, and the
    // build then fails late and cryptically instead of simply producing an
    // unsigned bundle. The rule here is explicit — no thumbprint, no signing —
    // and `craft-dist.mjs signing` reports which you are about to get.
    //
    // The certificate must already be in the runner's certificate store
    // (CurrentUser\My or LocalMachine\My); `certificateThumbprint` is the
    // SHA-1 that selects it. Tauri shells out to signtool, which does the rest.
    const thumbprint = process.env.WINDOWS_CERT_THUMBPRINT
    if (thumbprint) {
        o.bundle.windows = {
            ...o.bundle.windows,
            certificateThumbprint: thumbprint,
            digestAlgorithm: process.env.WINDOWS_DIGEST_ALGORITHM || 'sha256',
            timestampUrl:
                process.env.WINDOWS_TIMESTAMP_URL ||
                'http://timestamp.digicert.com',
        }
    }
    return o
}

const cmd = process.argv[2]
const {name, dist, dirs} = resolve()
if (cmd === 'crafts') {
    process.stdout.write(dirs.join('\n') + '\n')
} else if (cmd === 'registry') {
    // Every craft dir the registry knows about (any distribution) — used to
    // prune stale craft dirs from dist/ before copying the selected set.
    process.stdout.write(Object.keys(CONFIG.registry).join('\n') + '\n')
} else if (cmd === 'tauri') {
    // Compact (single line) so it can be passed as one `tauri build -c "<json>"` arg.
    process.stdout.write(JSON.stringify(tauriOverride(dist)))
} else if (cmd === 'signing') {
    // For the workflow's own log line: says whether this build will be signed
    // without printing the thumbprint itself.
    process.stdout.write(
        (process.env.WINDOWS_CERT_THUMBPRINT ? 'signed' : 'unsigned') + '\n'
    )
} else if (cmd === 'locale') {
    // The default language the bundle is built for. Vite injects it as
    // __APP_LOCALE__; exposed here too so a release script can name artifacts
    // by language without re-parsing the config.
    process.stdout.write((dist.locale || 'en') + '\n')
} else if (cmd === 'info') {
    process.stdout.write(
        `distribution: ${name}\nproductName: ${dist.productName}\nidentifier: ${dist.identifier}\nlocale: ${dist.locale || 'en'}\ncrafts (${dirs.length}): ${dirs.join(', ')}\n`
    )
} else {
    process.stderr.write(
        'usage: node scripts/craft-dist.mjs <crafts|registry|tauri|locale|signing|info>\n'
    )
    process.exit(2)
}
