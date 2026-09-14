// Deep-link support for opening a craft directly from the URL.
//
// Supported query/hash param (works without server-side SPA rewrites):
//   ?craft=factory-simulator
//   #craft=factory-simulator-zh
//
// `craft` accepts either a craft's directory name, a short alias (below), or a
// raw iframe path (e.g. /what-if-calculator/index.html).
//
// What it will open is bounded by what this build actually ships. The aliases
// used to be a hand-written table, which is a second copy of the craft
// registry and drifted from it the way second copies do — it never learned
// about `minesweeper`. Worse, once distributions differ by language, a table
// that lists every craft happily deep-links a Chinese-only game inside the
// English build, where those files were never published: an iframe pointed at
// a 404. So the list comes from `__CRAFT_TOOLS__`, which vite already filtered
// down to this distribution.

export interface CraftDeepLink {
    iframeSrc: string
}

/** `/fuse-beads/index.html` → `fuse-beads` */
function dirOf(src: string): string {
    return src.replace(/^\//, '').replace(/\/index\.html$/, '')
}

function shippedCrafts(): Map<string, string> {
    const tools = typeof __CRAFT_TOOLS__ !== 'undefined' ? __CRAFT_TOOLS__ : []
    const map = new Map<string, string>()
    for (const t of tools) map.set(dirOf(t.value), t.value)
    return map
}

/**
 * Names that aren't a craft directory but should still resolve, when this
 * build ships something they can point at. `factory-simulator` is the one that
 * matters: links to it predate the zh/en split, and each build should answer
 * with the variant it actually carries.
 */
function aliasTargets(shipped: Map<string, string>): Record<string, string> {
    const out: Record<string, string> = {}
    const factory =
        shipped.get('factory-simulator-en') ??
        shipped.get('factory-simulator-zh')
    if (factory) out['factory-simulator'] = factory
    return out
}

function resolveCraftSrc(value: string): string | null {
    const v = value.trim()
    if (!v) return null

    const shipped = shippedCrafts()

    const direct = shipped.get(v)
    if (direct) return direct

    const alias = aliasTargets(shipped)[v]
    if (alias) return alias

    // A raw path still works, but only same-origin AND only for a craft this
    // build published — otherwise the panel opens on nothing.
    if (v.startsWith('/')) {
        const byPath = shipped.get(dirOf(v))
        if (byPath) return byPath
    }
    return null
}

export function parseCraftDeepLink(): CraftDeepLink | null {
    if (typeof window === 'undefined') return null

    // Merge query string and hash (hash takes precedence if both set craft).
    const search = new URLSearchParams(window.location.search)
    const hash = window.location.hash.startsWith('#')
        ? new URLSearchParams(window.location.hash.slice(1))
        : new URLSearchParams()

    const craft = hash.get('craft') ?? search.get('craft')
    if (!craft) return null

    const src = resolveCraftSrc(craft)
    if (!src) return null

    return {iframeSrc: src}
}
