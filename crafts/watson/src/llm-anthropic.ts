/**
 * AnthropicBrowserClient — `LlmClient` implementation using the
 * Anthropic Messages REST API directly from the browser via `fetch`.
 *
 * Anthropic requires the `anthropic-dangerous-direct-browser-access`
 * header for browser-origin calls; without it the API rejects the
 * request to prevent CSRF-style leakage. This is acceptable for
 * Watson because the API key is *user-provided* (BYO key) — Anthropic
 * is acknowledging "yes, I know this exposes my key to the page" and
 * letting it through. The key is read at call-time from the caller
 * (never persisted by this module).
 *
 * Network errors and 5xx responses get one retry with jittered
 * backoff; 4xx responses (bad key, schema error, rate limit at user
 * level) surface immediately so the host can show a useful message.
 */

import type {
    AgentMessage,
    AgentSystemBlock,
    LlmClient,
    LlmCreateMessageParams,
    LlmResponse,
} from 'logician'

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface AnthropicBrowserClientOptions {
    /**
     * Function that returns the current API key. Read fresh on every
     * request so the user can rotate keys mid-session without rebuilding
     * the agent.
     */
    apiKey: () => string | null

    /** Override the Anthropic API base URL (proxy / self-host). */
    baseUrl?: string

    /** Anthropic API version. Pinned so SDK upgrades don't break us. */
    apiVersion?: string

    /** Retries on network failure / 5xx. Default 1. */
    max_retries?: number

    /**
     * Hook fired with raw HTTP timing + token-usage info, mostly for
     * telemetry. Optional.
     */
    onRequest?: (info: RequestInfo) => void
}

export interface RequestInfo {
    duration_ms: number
    http_status: number
    input_tokens?: number
    output_tokens?: number
    cache_read_tokens?: number
    cache_creation_tokens?: number
}

// ---------------------------------------------------------------------------
// Wire shapes (Anthropic's, kept narrow to what we need)
// ---------------------------------------------------------------------------

interface WireRequest {
    model: string
    max_tokens: number
    system?: AgentSystemBlock[]
    tools?: ReturnType<typeof import('logician').toLlmTool>[]
    messages: AgentMessage[]
}

interface WireResponse {
    id: string
    type: 'message'
    role: 'assistant'
    content: Array<
        | {type: 'text'; text: string}
        | {type: 'tool_use'; id: string; name: string; input: unknown}
    >
    stop_reason:
        | 'end_turn'
        | 'tool_use'
        | 'max_tokens'
        | 'stop_sequence'
        | string
    usage?: {
        input_tokens: number
        output_tokens: number
        cache_creation_input_tokens?: number
        cache_read_input_tokens?: number
    }
}

interface WireError {
    type: 'error'
    error: {type: string; message: string}
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const DEFAULT_BASE = 'https://api.anthropic.com'
const DEFAULT_VERSION = '2023-06-01'

export class AnthropicBrowserClient implements LlmClient {
    private getApiKey: () => string | null
    private baseUrl: string
    private apiVersion: string
    private maxRetries: number
    private onRequest?: (info: RequestInfo) => void

    constructor(opts: AnthropicBrowserClientOptions) {
        this.getApiKey = opts.apiKey
        this.baseUrl = stripTrailingSlash(opts.baseUrl ?? DEFAULT_BASE)
        this.apiVersion = opts.apiVersion ?? DEFAULT_VERSION
        this.maxRetries = opts.max_retries ?? 1
        this.onRequest = opts.onRequest
    }

    async createMessage(params: LlmCreateMessageParams): Promise<LlmResponse> {
        const key = this.getApiKey()
        if (!key) {
            throw new LlmError(
                'missing_api_key',
                'Anthropic API key is not set. Open Watson settings and paste your key.'
            )
        }

        const body: WireRequest = {
            model: params.model,
            max_tokens: params.max_tokens,
            messages: params.messages,
            system: params.system,
            tools: params.tools.length > 0 ? params.tools : undefined,
        }

        const url = `${this.baseUrl}/v1/messages`
        let attempt = 0
        let lastErr: unknown = null
        for (;;) {
            const start = Date.now()
            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'x-api-key': key,
                        'anthropic-version': this.apiVersion,
                        // Required for direct browser → Anthropic calls.
                        // See the comment at the top of this file.
                        'anthropic-dangerous-direct-browser-access': 'true',
                    },
                    body: JSON.stringify(body),
                    signal: params.signal,
                })

                const duration_ms = Date.now() - start

                if (res.ok) {
                    const data = (await res.json()) as WireResponse
                    this.onRequest?.({
                        duration_ms,
                        http_status: res.status,
                        input_tokens: data.usage?.input_tokens,
                        output_tokens: data.usage?.output_tokens,
                        cache_read_tokens:
                            data.usage?.cache_read_input_tokens,
                        cache_creation_tokens:
                            data.usage?.cache_creation_input_tokens,
                    })
                    return toLlmResponse(data)
                }

                // Map non-2xx into typed errors.
                const errBody = await safeReadError(res)
                this.onRequest?.({duration_ms, http_status: res.status})
                if (res.status >= 500 && attempt < this.maxRetries) {
                    await jitterSleep(attempt)
                    attempt++
                    continue
                }
                throw new LlmError(
                    httpStatusToCode(res.status, errBody),
                    errBody?.error?.message ??
                        `Anthropic API ${res.status} ${res.statusText}`,
                    {status: res.status, body: errBody}
                )
            } catch (err) {
                lastErr = err
                if (err instanceof LlmError) throw err
                if ((err as {name?: string})?.name === 'AbortError') {
                    throw new LlmError('aborted', 'Request was aborted.')
                }
                // Network failure / DNS / offline.
                if (attempt < this.maxRetries) {
                    await jitterSleep(attempt)
                    attempt++
                    continue
                }
                throw new LlmError(
                    'network',
                    `Network error contacting Anthropic: ${
                        err instanceof Error ? err.message : String(err)
                    }`,
                    {cause: lastErr}
                )
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Typed error
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toLlmResponse(data: WireResponse): LlmResponse {
    return {
        content: data.content as LlmResponse['content'],
        stop_reason: data.stop_reason,
        usage: data.usage
            ? {
                  input_tokens: data.usage.input_tokens,
                  output_tokens: data.usage.output_tokens,
                  cache_creation_input_tokens:
                      data.usage.cache_creation_input_tokens,
                  cache_read_input_tokens: data.usage.cache_read_input_tokens,
              }
            : undefined,
    }
}

async function safeReadError(res: Response): Promise<WireError | null> {
    try {
        return (await res.json()) as WireError
    } catch {
        return null
    }
}

function httpStatusToCode(
    status: number,
    body: WireError | null
): LlmErrorCode {
    if (status === 401 || status === 403) return 'unauthorized'
    if (status === 429) return 'rate_limited'
    if (status >= 500) return 'server_error'
    if (status >= 400) return 'bad_request'
    // Should not happen for non-2xx, but stay defensive.
    void body
    return 'unknown'
}

function stripTrailingSlash(s: string): string {
    return s.endsWith('/') ? s.slice(0, -1) : s
}

async function jitterSleep(attempt: number): Promise<void> {
    const base = 500 * 2 ** attempt
    const jitter = Math.random() * base * 0.3
    await new Promise((r) => setTimeout(r, base + jitter))
}
