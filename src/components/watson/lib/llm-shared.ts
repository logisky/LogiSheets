/**
 * Pieces every Watson LLM client needs, regardless of wire format.
 *
 * There are two wire formats now — Anthropic's `/v1/messages` and OpenAI's
 * `/chat/completions` — and the parts that differ between them are smaller
 * than the parts that don't: both are a POST with a bearer-ish key, both
 * deserve one retry on a 5xx or a dropped connection, and both surface the
 * same handful of failures to the user (bad key, rate limit, offline). Those
 * live here so a third wire format is a translation layer and nothing else.
 */

export type LlmErrorCode =
    | 'missing_api_key'
    | 'unauthorized'
    | 'rate_limited'
    | 'bad_request'
    | 'server_error'
    | 'network'
    | 'aborted'
    | 'unknown'

export class LlmError extends Error {
    code: LlmErrorCode
    details?: unknown
    constructor(code: LlmErrorCode, message: string, details?: unknown) {
        super(message)
        this.name = 'LlmError'
        this.code = code
        this.details = details
    }
}

/** Raw HTTP timing + token usage, for telemetry. */
export interface RequestInfo {
    duration_ms: number
    http_status: number
    input_tokens?: number
    output_tokens?: number
    cache_read_tokens?: number
    cache_creation_tokens?: number
}

export function httpStatusToCode(status: number): LlmErrorCode {
    if (status === 401 || status === 403) return 'unauthorized'
    if (status === 429) return 'rate_limited'
    if (status >= 500) return 'server_error'
    if (status >= 400) return 'bad_request'
    return 'unknown'
}

export function stripTrailingSlash(s: string): string {
    return s.endsWith('/') ? s.slice(0, -1) : s
}

export async function jitterSleep(attempt: number): Promise<void> {
    const base = 500 * 2 ** attempt
    const jitter = Math.random() * base * 0.3
    await new Promise((r) => setTimeout(r, base + jitter))
}

/**
 * POST JSON, retrying network failures and 5xx, and turning everything else
 * into a typed {@link LlmError}. Returns the parsed body on success.
 *
 * `describeError` pulls a human message out of the provider's error body —
 * the one genuinely provider-shaped part of failure handling (Anthropic nests
 * it under `error.message`, OpenAI under `error.message` too, but neither
 * guarantees it).
 */
export async function postJson<T>(opts: {
    url: string
    headers: Record<string, string>
    body: unknown
    fetchImpl: typeof fetch
    signal?: AbortSignal
    maxRetries: number
    describeError: (body: unknown, status: number, statusText: string) => string
    onRequest?: (info: RequestInfo) => void
}): Promise<T> {
    const payload = JSON.stringify(opts.body)
    let attempt = 0
    for (;;) {
        const start = Date.now()
        try {
            const res = await opts.fetchImpl(opts.url, {
                method: 'POST',
                headers: opts.headers,
                body: payload,
                signal: opts.signal,
            })
            const duration_ms = Date.now() - start

            if (res.ok) return (await res.json()) as T

            const errBody = await safeJson(res)
            opts.onRequest?.({duration_ms, http_status: res.status})
            if (res.status >= 500 && attempt < opts.maxRetries) {
                await jitterSleep(attempt)
                attempt++
                continue
            }
            throw new LlmError(
                httpStatusToCode(res.status),
                opts.describeError(errBody, res.status, res.statusText),
                {status: res.status, body: errBody}
            )
        } catch (err) {
            if (err instanceof LlmError) throw err
            if ((err as {name?: string})?.name === 'AbortError') {
                throw new LlmError('aborted', 'Request was aborted.')
            }
            // Network failure / DNS / offline.
            if (attempt < opts.maxRetries) {
                await jitterSleep(attempt)
                attempt++
                continue
            }
            throw new LlmError(
                'network',
                `Network error contacting the model provider: ${
                    err instanceof Error ? err.message : String(err)
                }`,
                {cause: err}
            )
        }
    }
}

async function safeJson(res: Response): Promise<unknown> {
    try {
        return await res.json()
    } catch {
        return null
    }
}
