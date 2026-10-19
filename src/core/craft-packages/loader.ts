import type {CraftManifest} from 'logisheets-logician'
import type {CraftPackageStore} from './types'

const MIME: Record<string, string> = {
    html: 'text/html',
    htm: 'text/html',
    js: 'text/javascript',
    mjs: 'text/javascript',
    css: 'text/css',
    json: 'application/json',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    ico: 'image/x-icon',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    otf: 'font/otf',
    wasm: 'application/wasm',
    txt: 'text/plain',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    mp4: 'video/mp4',
}

function mimeOf(path: string): string {
    const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
    return MIME[ext] ?? 'application/octet-stream'
}

/**
 * A made-up origin package paths resolve against, so `./x.js`, `x.js` and
 * `sub/../x.js` all land on one package path. The page's `<base>` points here
 * too (see below); nothing is ever fetched from it.
 */
const PKG_ORIGIN = 'https://craft.invalid'

function packagePathOf(ref: string, fromDir: string): string | undefined {
    let u: URL
    try {
        u = new URL(ref, `${PKG_ORIGIN}/${fromDir}`)
    } catch {
        return undefined
    }
    if (u.origin !== PKG_ORIGIN) return undefined
    return decodeURIComponent(u.pathname.replace(/^\/+/, ''))
}

// Attributes that load a package file. `href` on <a> is navigation, not a
// load, and is left alone.
const URL_ATTRS: readonly [selector: string, attr: string][] = [
    ['script[src]', 'src'],
    ['link[href]', 'href'],
    ['img[src]', 'src'],
    ['source[src]', 'src'],
    ['audio[src]', 'src'],
    ['video[src]', 'src'],
    ['video[poster]', 'poster'],
    ['image[href]', 'href'],
    ['use[href]', 'href'],
]

export interface LoadedCraftPage {
    /** Give this to the iframe's `src`. */
    url: string
    /** Revoke every blob URL the page was built from. */
    dispose(): void
}

/**
 * Build an installed craft's page as a blob URL.
 *
 * The host hands a craft its API by writing to the iframe's window, which only
 * works same-origin. A blob URL's document has the origin of the page that
 * created it, so this works the same in a browser and in the desktop webview —
 * unlike a service worker (no custom schemes on macOS) or a Tauri protocol
 * (a different origin).
 *
 * What the page gets:
 * - every package file as its own blob URL, and the HTML's `src`/`href`
 *   references to them rewritten;
 * - an import map plus `<base href="https://craft.invalid/…">`, so an inline
 *   `<script type="module">` can still `import … from './tools.js'`;
 * - `window.locale` set before any craft script runs. A blob URL cannot carry
 *   the `?lang=` a built-in craft gets, so this is the installed craft's
 *   first-paint language.
 *
 * What it cannot do: a runtime `fetch('./data.json')` resolves against the
 * made-up base and fails. A craft bundles its data instead.
 */
export async function loadInstalledCraftPage(
    store: CraftPackageStore,
    manifest: CraftManifest,
    locale: string
): Promise<LoadedCraftPage> {
    const entry = manifest.url
    if (!entry) throw new Error(`craft ${manifest.craftId} has no UI`)
    const craftId = manifest.craftId
    const urls: string[] = []
    const dispose = () => urls.forEach((u) => URL.revokeObjectURL(u))

    try {
        const byPath = new Map<string, string>()
        for (const path of manifest.files ?? []) {
            if (path === entry || path === 'manifest.json') continue
            const data = await store.readFile(craftId, path)
            if (!data) continue
            const url = URL.createObjectURL(
                new Blob([data as BlobPart], {type: mimeOf(path)})
            )
            urls.push(url)
            byPath.set(path, url)
        }

        const html = await store.readFile(craftId, entry)
        if (!html) throw new Error(`craft ${craftId}: ${entry} is missing`)
        const doc = new DOMParser().parseFromString(
            new TextDecoder().decode(html),
            'text/html'
        )
        const dir = entry.includes('/')
            ? entry.slice(0, entry.lastIndexOf('/') + 1)
            : ''

        for (const [selector, attr] of URL_ATTRS) {
            doc.querySelectorAll(selector).forEach((el) => {
                const path = packagePathOf(el.getAttribute(attr) ?? '', dir)
                const url = path && byPath.get(path)
                if (url) el.setAttribute(attr, url)
            })
        }

        // Prepended in reverse, so the final order is base, import map,
        // locale — all ahead of the craft's own <head>.
        const head = doc.head
        const locScript = doc.createElement('script')
        locScript.textContent = `window.locale = ${JSON.stringify(locale)}`
        head.prepend(locScript)

        const importMap = doc.createElement('script')
        importMap.type = 'importmap'
        importMap.textContent = JSON.stringify({
            imports: Object.fromEntries(
                [...byPath].map(([p, u]) => [`${PKG_ORIGIN}/${p}`, u])
            ),
        })
        head.prepend(importMap)

        const base = doc.createElement('base')
        base.href = `${PKG_ORIGIN}/${dir}`
        head.prepend(base)

        const page = URL.createObjectURL(
            new Blob(['<!DOCTYPE html>\n' + doc.documentElement.outerHTML], {
                type: 'text/html',
            })
        )
        urls.push(page)
        return {url: page, dispose}
    } catch (e) {
        dispose()
        throw e
    }
}
