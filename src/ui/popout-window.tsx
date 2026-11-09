import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react'
import {createPortal} from 'react-dom'
import createCache from '@emotion/cache'
import {CacheProvider} from '@emotion/react'
import {ThemeProvider, createTheme} from '@mui/material/styles'
import {isTauri, tauriInvoke} from '@/core/tauri'

/**
 * A view rendered into a separate OS window (a browser popup, or a second
 * Tauri webview window) from THIS page's JS realm.
 *
 * The child window is an empty same-origin document we portal into, so the
 * whole app — the one Engine and its worker, the MobX stores, craft state —
 * is shared with no syncing: a pop-out is just another Session, like the
 * split view, whose DOM happens to live in another window. The price is that
 * the pop-out lives and dies with this page.
 *
 * Anything that reaches for the global `window` / `document` from inside a
 * pop-out binds to the MAIN window instead: drag listeners never fire,
 * ResizeObservers never report, MUI portals open on the wrong screen. Use
 * {@link useHostWindow} / {@link useHostDocument} for those; the shared
 * `@/ui/dialog` and `@/ui/context-menu` wrappers already do.
 */

const PopoutWindowContext = createContext<Window | null>(null)

/** The window this component renders in — a pop-out's, else the main one. */
export function useHostWindow(): Window {
    return useContext(PopoutWindowContext) ?? window
}

/** The document this component renders in — see {@link useHostWindow}. */
export function useHostDocument(): Document {
    return useHostWindow().document
}

/**
 * Open the empty window a {@link PopoutWindow} renders into. Call it
 * synchronously from the click handler: macOS's WKWebView (the desktop app)
 * and Safari only allow `window.open` during a user gesture, and a React
 * effect after the click is already too late — the call returns null.
 * Opening the same `name` again returns the existing window.
 *
 * The URL is an explicit `about:blank`, not `''`: WebKit hands the desktop
 * shell an empty URL for `''`, which Tauri can't parse and denies. Either
 * way the child inherits this page's origin, so we can write into it.
 */
export function openPopoutWindow(
    name: string,
    width = 1100,
    height = 760
): Window | null {
    return window.open(
        'about:blank',
        name,
        `popup,width=${width},height=${height}`
    )
}

/**
 * Close a window from {@link openPopoutWindow}. Not done by
 * {@link PopoutWindow} on unmount: StrictMode unmounts and remounts it in dev,
 * which would close a window the user just opened.
 *
 * In the desktop app the JS `close()` is a no-op (wry's macOS delegate has no
 * `webViewDidClose`), so the shell closes it instead.
 */
export function closePopoutWindow(w: Window | null) {
    w?.close()
    if (isTauri()) tauriInvoke('close_popouts').catch(() => {})
}

export interface PopoutWindowProps {
    /** The window to render into, from {@link openPopoutWindow}. */
    win: Window
    title: string
    /** The user closed the window. */
    onClose: () => void
    children: ReactNode
}

export function PopoutWindow({
    win: w,
    title,
    onClose,
    children,
}: PopoutWindowProps) {
    // The child's current document, and how many it has had. WebKit (Safari,
    // the macOS desktop app) loads about:blank into the new window AFTER
    // window.open returns, replacing the document we first rendered into —
    // the view flashes up, then goes blank. So we re-attach whenever the
    // document changes, keyed by `gen` so the portal remounts from scratch.
    const [attached, setAttached] = useState<{
        doc: Document
        gen: number
    } | null>(null)

    useEffect(() => {
        let current: Document | null = null
        let gen = 0
        let stopMirror = () => {}
        const attach = () => {
            if (w.closed || w.document === current) return
            const doc = w.document
            if (!doc.body) return
            stopMirror()
            current = doc
            doc.title = title
            doc.documentElement.style.height = '100%'
            doc.body.style.cssText = 'margin:0;height:100%;overflow:hidden'
            stopMirror = mirrorStyles(document, doc)
            setAttached({doc, gen: ++gen})
        }
        attach()
        w.addEventListener('load', attach)

        // Closing the main window takes its pop-outs with it: they run on
        // its realm and would be dead UI otherwise.
        const closeChild = () => closePopoutWindow(w)
        window.addEventListener('pagehide', closeChild)
        // Polled rather than the child's `pagehide`, which also fires when
        // WebKit swaps its document (above) — that is not the user closing
        // it. The poll also catches a swap the `load` listener missed.
        const poll = window.setInterval(() => {
            if (w.closed) onClose()
            else attach()
        }, 250)

        return () => {
            window.clearInterval(poll)
            window.removeEventListener('pagehide', closeChild)
            w.removeEventListener('load', attach)
            stopMirror()
            setAttached(null)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [w])

    const doc = attached?.doc ?? null

    // MUI styles go through emotion, which inserts rules into a <style> of
    // the document it was created for (and, in production, via insertRule,
    // which no DOM mirror can see). Give the pop-out its own cache.
    const cache = useMemo(
        () => (doc ? createCache({key: 'popout', container: doc.head}) : null),
        [doc]
    )

    // MUI portals into the anchor's document when it has one, but an
    // unanchored Modal or Popper (a Dialog, a Popover at a point) falls back
    // to the global body — the main window. Point those defaults here. The
    // rest is MUI's default theme, which is what the app runs without one.
    const theme = useMemo(
        () =>
            doc
                ? createTheme({
                      components: {
                          MuiModal: {
                              defaultProps: {container: doc.body},
                          },
                          MuiPopper: {
                              defaultProps: {container: doc.body},
                          },
                      },
                  })
                : null,
        [doc]
    )

    if (!attached || !cache || !theme) return null
    return createPortal(
        <PopoutWindowContext.Provider value={w}>
            <CacheProvider value={cache}>
                <ThemeProvider theme={theme}>{children}</ThemeProvider>
            </CacheProvider>
        </PopoutWindowContext.Provider>,
        attached.doc.body,
        String(attached.gen)
    )
}

/**
 * Copy `from`'s stylesheets into `to` and keep copying ones added later —
 * Vite injects a <style> per module in dev and a <link> per lazy chunk in
 * production. Emotion's own tags are skipped: the pop-out has its own cache.
 */
function mirrorStyles(from: Document, to: Document): () => void {
    const isSheet = (n: Node): n is HTMLStyleElement | HTMLLinkElement =>
        (n instanceof HTMLStyleElement && !n.hasAttribute('data-emotion')) ||
        (n instanceof HTMLLinkElement && n.rel === 'stylesheet')
    const copies = new Map<Node, Node>()
    const copy = (n: Node) => {
        if (!isSheet(n) || copies.has(n)) return
        const c = to.importNode(n, true)
        copies.set(n, c)
        to.head.appendChild(c)
    }
    from.head.childNodes.forEach(copy)
    const observer = new MutationObserver((records) => {
        for (const r of records) {
            r.addedNodes.forEach(copy)
            r.removedNodes.forEach((n) => {
                const c = copies.get(n)
                if (c) {
                    c.parentNode?.removeChild(c)
                    copies.delete(n)
                }
            })
            // An HMR update rewrites a <style>'s text in place.
            if (r.type === 'characterData' || r.type === 'childList') {
                const style = (
                    r.target instanceof HTMLStyleElement
                        ? r.target
                        : r.target.parentNode
                ) as Node | null
                const c = style && copies.get(style)
                if (c && style) c.textContent = style.textContent
            }
        }
    })
    observer.observe(from.head, {
        childList: true,
        subtree: true,
        characterData: true,
    })
    return () => observer.disconnect()
}
