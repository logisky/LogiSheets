// Deep-link support for opening a craft directly from the URL.
//
// Supported query/hash param (works without server-side SPA rewrites):
//   ?craft=factory-simulator
//   #craft=factory-simulator-zh
//
// `craft` accepts either a short alias (see CRAFT_ALIASES) or a raw iframe
// path (e.g. /watson/index.html). When present, the host opens the craft
// panel on that craft automatically.

export interface CraftDeepLink {
    iframeSrc: string
}

// Short, URL-friendly aliases → iframe src under the public root.
const CRAFT_ALIASES: Record<string, string> = {
    'factory-simulator': '/factory-simulator-en/index.html',
    'factory-simulator-en': '/factory-simulator-en/index.html',
    'factory-simulator-zh': '/factory-simulator-zh/index.html',
    'what-if-calculator': '/what-if-calculator/index.html',
    'markdown-table-extractor': '/markdown-table-extractor/index.html',
    watson: '/watson/index.html',
}

function resolveCraftSrc(value: string): string | null {
    const v = value.trim()
    if (!v) return null
    if (CRAFT_ALIASES[v]) return CRAFT_ALIASES[v]
    // Allow passing a raw path directly, but keep it same-origin only.
    if (v.startsWith('/')) return v
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
