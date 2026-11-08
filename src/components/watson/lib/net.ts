/**
 * Picks the right `fetch` for Watson's LLM client.
 *
 * On the web this is just the browser `fetch`. In the desktop app (Tauri) the
 * webview's `fetch` is still a browser fetch and enforces CORS, so providers
 * that don't return CORS headers (Kimi / Moonshot) are unreachable directly.
 * There we route through the native `llm_fetch` command (Rust `reqwest`, see
 * packages/desktop/src-tauri/src/net.rs), which is not a browser and has no CORS
 * notion — so the desktop app reaches those providers directly, no proxy needed.
 *
 * Following the desktop package's convention, we call Tauri's runtime-injected
 * IPC directly (`window.__TAURI_INTERNALS__.invoke`) rather than depending on any
 * `@tauri-apps/*` npm package (see src/core/craft-storage/tauri.ts).
 */

type TauriInvoke = <T>(
    cmd: string,
    args?: Record<string, unknown>
) => Promise<T>

interface TauriInternals {
    invoke: TauriInvoke
}

/** True when running inside the Tauri desktop shell. */
export function isTauri(): boolean {
    return (
        typeof window !== 'undefined' &&
        '__TAURI_INTERNALS__' in window &&
        typeof (window as unknown as {__TAURI_INTERNALS__?: TauriInternals})
            .__TAURI_INTERNALS__?.invoke === 'function'
    )
}

function getInvoke(): TauriInvoke {
    const internals = (
        window as unknown as {__TAURI_INTERNALS__?: TauriInternals}
    ).__TAURI_INTERNALS__
    if (!internals || typeof internals.invoke !== 'function')
        throw new Error('Tauri IPC is unavailable')
    return internals.invoke
}

interface NativeHttpResponse {
    status: number
    headers: Record<string, string>
    body: string
}

function abortError(): DOMException {
    return new DOMException('The operation was aborted.', 'AbortError')
}

function headerRecord(init?: HeadersInit): Record<string, string> {
    if (!init) return {}
    if (init instanceof Headers) {
        const out: Record<string, string> = {}
        init.forEach((v, k) => (out[k] = v))
        return out
    }
    if (Array.isArray(init)) return Object.fromEntries(init)
    return {...(init as Record<string, string>)}
}

/**
 * A `fetch`-shaped wrapper over the native `llm_fetch` command. Supports the
 * subset the LLM client uses: string URL, method, plain-object/Headers headers,
 * string body, and best-effort `signal` abort.
 */
async function tauriFetch(
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<Response> {
    const signal = init?.signal ?? undefined
    if (signal?.aborted) throw abortError()

    const url =
        typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url

    const body =
        typeof init?.body === 'string'
            ? init.body
            : init?.body == null
              ? null
              : String(init.body)

    const req = {
        url,
        method: (init?.method ?? 'GET').toUpperCase(),
        headers: headerRecord(init?.headers),
        body,
    }

    const invoke = getInvoke()
    const call = invoke<NativeHttpResponse>('llm_fetch', {req})

    // The native call can't be truly cancelled, but we can reject early so the
    // caller's abort path runs (the LLM client maps AbortError → 'aborted').
    const result = await (signal
        ? Promise.race([
              call,
              new Promise<never>((_, reject) => {
                  signal.addEventListener('abort', () => reject(abortError()), {
                      once: true,
                  })
              }),
          ])
        : call)

    // 204/304 must have a null body per the Response constructor.
    const noBody = result.status === 204 || result.status === 304
    return new Response(noBody ? null : result.body, {
        status: result.status,
        headers: result.headers,
    })
}

/**
 * The `fetch` implementation Watson should use: native on desktop, the browser
 * `fetch` everywhere else.
 */
export function getFetch(): typeof fetch {
    if (isTauri()) return tauriFetch as typeof fetch
    return window.fetch.bind(window)
}
