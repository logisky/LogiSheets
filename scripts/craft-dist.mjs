// Resolve a craft "distribution" from crafts.config.json + the CRAFT_DIST env
// var (default: "default"), for the non-webpack consumers. Dependency-free ESM
// so it runs on any CI runner with plain Node.
//
// Usage:
//   node scripts/craft-dist.mjs crafts   # selected craft dirs, one per line (publish-crafts.sh)
//   node scripts/craft-dist.mjs tauri    # tauri config override JSON (desktop CI: tauri build -c)
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
    const dirs = dist.crafts === 'all' ? Object.keys(registry) : dist.crafts
    for (const d of dirs) {
        if (!registry[d]) throw new Error(`Craft "${d}" (in distribution "${name}") is not in the registry`)
    }
    return {name, dist, dirs, registry}
}

function tauriOverride(dist) {
    return {
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
} else if (cmd === 'info') {
    process.stdout.write(
        `distribution: ${name}\nproductName: ${dist.productName}\nidentifier: ${dist.identifier}\ncrafts (${dirs.length}): ${dirs.join(', ')}\n`
    )
} else {
    process.stderr.write('usage: node scripts/craft-dist.mjs <crafts|tauri|info>\n')
    process.exit(2)
}
