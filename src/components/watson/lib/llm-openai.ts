/**
 * OpenAiBrowserClient — an `LlmClient` speaking OpenAI's
 * `/chat/completions` instead of Anthropic's `/v1/messages`.
 *
 * logician's agent IR is Anthropic-shaped (see `projection.ts`: content blocks,
 * `tool_use` / `tool_result`, `stop_reason`), and this file is the translation
 * layer to the other format the industry settled on. One adapter covers a lot
 * of ground — OpenAI itself, DeepSeek, Qwen, OpenRouter, Groq, xAI, Gemini's
 * compatibility endpoint, and the local servers (Ollama, LM Studio, vLLM) that
 * all chose this shape.
 *
 * Three translation decisions carry the weight:
 *
 *   - **Tool results are their own messages.** Anthropic puts every
 *     `tool_result` for a turn inside one user message; OpenAI wants one
 *     `role: "tool"` message per call, each tagged with its `tool_call_id`.
 *     A turn with four tool calls therefore becomes four messages.
 *   - **Tool arguments are a JSON string, not an object.** Both directions
 *     have to (de)serialize, and a model that emits malformed JSON must
 *     surface as a tool-level error rather than crash the turn.
 *   - **`finish_reason` is not `stop_reason`.** Several providers report
 *     `"stop"` on a turn that also carries `tool_calls`; taking that at face
 *     value would end the turn with the tool results never sent. Tool calls
 *     present always means `tool_use`, whatever the provider said.
 */

import type {
    AgentContentBlock,
    AgentMessage,
    LlmClient,
    LlmCreateMessageParams,
    LlmResponse,
} from 'logisheets-logician'
import {
    LlmError,
    postJson,
    stripTrailingSlash,
    type RequestInfo,
} from './llm-shared'

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface OpenAiBrowserClientOptions {
    /** Read fresh per request, so a key can be rotated mid-session. Local
     *  servers (Ollama, LM Studio) need none — see `requiresKey`. */
    apiKey: () => string | null

    /** API base URL, WITHOUT the trailing `/chat/completions`. */
    baseUrl: string

    /**
     * Whether a missing key is an error. False for local servers, which
     * ignore the header entirely; a placeholder is sent so proxies that
     * insist on the header still see one.
     */
    requiresKey?: boolean

    /**
     * Which parameter caps the response. OpenAI's reasoning models reject
     * `max_tokens` outright and want `max_completion_tokens`; nearly every
     * compatible provider still takes the older name, which is the default.
     */
    maxTokensParam?: 'max_tokens' | 'max_completion_tokens'

    /** Retries on network failure / 5xx. Default 1. */
    max_retries?: number

    /** `fetch` to use — the desktop app injects a native one (see ./net.ts). */
    fetchImpl?: typeof fetch

    /** Extra headers, for providers that want attribution or routing hints. */
    headers?: Record<string, string>

    onRequest?: (info: RequestInfo) => void
}

// ---------------------------------------------------------------------------
// Wire shapes (OpenAI's, narrowed to what we send and read)
// ---------------------------------------------------------------------------

interface WireToolCall {
    id: string
    type: 'function'
    function: {name: string; arguments: string}
}

type WireMessage =
    | {role: 'system'; content: string}
    | {role: 'user'; content: string}
    | {role: 'assistant'; content: string | null; tool_calls?: WireToolCall[]}
    | {role: 'tool'; tool_call_id: string; content: string}

interface WireTool {
    type: 'function'
    function: {
        name: string
        description: string
        parameters: Record<string, unknown>
    }
}

interface WireResponse {
    choices?: Array<{
        message?: {
            content?: string | null
            tool_calls?: WireToolCall[]
        }
        finish_reason?: string
    }>
    usage?: {
        prompt_tokens?: number
        completion_tokens?: number
        prompt_tokens_details?: {cached_tokens?: number}
    }
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class OpenAiBrowserClient implements LlmClient {
    private getApiKey: () => string | null
    private baseUrl: string
    private requiresKey: boolean
    private maxTokensParam: 'max_tokens' | 'max_completion_tokens'
    private maxRetries: number
    private fetchImpl: typeof fetch
    private extraHeaders: Record<string, string>
    private onRequest?: (info: RequestInfo) => void

    constructor(opts: OpenAiBrowserClientOptions) {
        this.getApiKey = opts.apiKey
        this.baseUrl = stripTrailingSlash(opts.baseUrl)
        this.requiresKey = opts.requiresKey ?? true
        this.maxTokensParam = opts.maxTokensParam ?? 'max_tokens'
        this.maxRetries = opts.max_retries ?? 1
        this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis)
        this.extraHeaders = opts.headers ?? {}
        this.onRequest = opts.onRequest
    }

    async createMessage(params: LlmCreateMessageParams): Promise<LlmResponse> {
        const key = this.getApiKey()
        if (!key && this.requiresKey) {
            throw new LlmError(
                'missing_api_key',
                'API key is not set. Open Watson settings and paste your key.'
            )
        }

        const messages: WireMessage[] = []
        const system = params.system
            .map((b) => b.text)
            .filter((t) => t.length > 0)
            .join('\n\n')
        if (system) messages.push({role: 'system', content: system})
        for (const m of params.messages) messages.push(...toWireMessages(m))

        const tools: WireTool[] = params.tools.map((t) => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: t.input_schema as Record<string, unknown>,
            },
        }))

        const body: Record<string, unknown> = {
            model: params.model,
            messages,
            [this.maxTokensParam]: params.max_tokens,
        }
        if (tools.length > 0) {
            body.tools = tools
            body.tool_choice = 'auto'
        }

        const data = await postJson<WireResponse>({
            url: `${this.baseUrl}/chat/completions`,
            headers: {
                'content-type': 'application/json',
                // Local servers ignore this; proxies in front of them often
                // still require the header to be present and non-empty.
                authorization: `Bearer ${key || 'no-key'}`,
                ...this.extraHeaders,
            },
            body,
            fetchImpl: this.fetchImpl,
            signal: params.signal,
            maxRetries: this.maxRetries,
            describeError: describeOpenAiError,
            onRequest: this.onRequest,
        })

        const response = toLlmResponse(data)
        this.onRequest?.({
            duration_ms: 0,
            http_status: 200,
            input_tokens: response.usage?.input_tokens,
            output_tokens: response.usage?.output_tokens,
            cache_read_tokens: response.usage?.cache_read_input_tokens,
        })
        return response
    }
}

// ---------------------------------------------------------------------------
// Agent IR → OpenAI messages
// ---------------------------------------------------------------------------

/** One agent-IR message becomes one or more OpenAI messages. */
export function toWireMessages(m: AgentMessage): WireMessage[] {
    if (typeof m.content === 'string') {
        return m.content.length > 0
            ? [
                  {
                      role: m.role === 'user' ? 'user' : 'assistant',
                      content: m.content,
                  },
              ]
            : []
    }

    if (m.role === 'assistant') {
        const text = joinText(m.content)
        const tool_calls: WireToolCall[] = m.content
            .filter(
                (b): b is Extract<AgentContentBlock, {type: 'tool_use'}> =>
                    b.type === 'tool_use'
            )
            .map((b) => ({
                id: b.id,
                type: 'function' as const,
                function: {
                    name: b.name,
                    arguments: JSON.stringify(b.input ?? {}),
                },
            }))
        // An assistant turn with neither text nor calls has nothing to replay.
        if (!text && tool_calls.length === 0) return []
        return [
            {
                role: 'assistant',
                content: text || null,
                ...(tool_calls.length > 0 ? {tool_calls} : {}),
            },
        ]
    }

    // User turn: tool results each become their own `role: "tool"` message,
    // and any plain text alongside them stays a user message. Order matters —
    // the tool messages must answer the assistant turn that requested them
    // before anything else is said.
    const out: WireMessage[] = []
    const text: string[] = []
    for (const b of m.content) {
        if (b.type === 'tool_result') {
            out.push({
                role: 'tool',
                tool_call_id: b.tool_use_id,
                content: flattenResult(b.content),
            })
        } else if (b.type === 'text' && b.text.length > 0) {
            text.push(b.text)
        }
    }
    if (text.length > 0) out.push({role: 'user', content: text.join('\n\n')})
    return out
}

function joinText(blocks: readonly AgentContentBlock[]): string {
    return blocks
        .filter(
            (b): b is Extract<AgentContentBlock, {type: 'text'}> =>
                b.type === 'text'
        )
        .map((b) => b.text)
        .join('\n')
        .trim()
}

/** A tool result is text on this wire, however it was structured. */
function flattenResult(content: string | AgentContentBlock[]): string {
    if (typeof content === 'string') return content
    return joinText(content) || JSON.stringify(content)
}

// ---------------------------------------------------------------------------
// OpenAI response → agent IR
// ---------------------------------------------------------------------------

export function toLlmResponse(data: WireResponse): LlmResponse {
    const choice = data.choices?.[0]
    const msg = choice?.message
    const content: AgentContentBlock[] = []

    if (msg?.content) content.push({type: 'text', text: msg.content})

    const calls = msg?.tool_calls ?? []
    for (const c of calls) {
        content.push({
            type: 'tool_use',
            id: c.id,
            name: c.function.name,
            // A model that emits malformed arguments should fail at the tool,
            // where the error reaches it as a tool_result it can correct, not
            // here, where it would take the whole turn down.
            input: parseArguments(c.function.arguments),
        })
    }

    return {
        content,
        // Tool calls outrank the reported reason: several providers say "stop"
        // on a turn that also asked for tools, and believing them would end
        // the turn with the results never delivered.
        stop_reason:
            calls.length > 0
                ? 'tool_use'
                : finishReasonToStopReason(choice?.finish_reason),
        usage: data.usage
            ? {
                  input_tokens: data.usage.prompt_tokens ?? 0,
                  output_tokens: data.usage.completion_tokens ?? 0,
                  cache_read_input_tokens:
                      data.usage.prompt_tokens_details?.cached_tokens,
              }
            : undefined,
    }
}

function parseArguments(raw: string): unknown {
    if (!raw) return {}
    try {
        return JSON.parse(raw)
    } catch {
        // Hand the raw string through; the tool's own validation will reject
        // it with a message the model can act on.
        return {_malformed_arguments: raw}
    }
}

function finishReasonToStopReason(reason: string | undefined): string {
    switch (reason) {
        case 'tool_calls':
        case 'function_call':
            return 'tool_use'
        case 'length':
            return 'max_tokens'
        case 'stop':
        case undefined:
            return 'end_turn'
        default:
            // content_filter and provider-specific reasons: end the turn
            // rather than loop on something we don't understand.
            return 'end_turn'
    }
}

function describeOpenAiError(
    body: unknown,
    status: number,
    statusText: string
): string {
    const msg = (body as {error?: {message?: string}} | null)?.error?.message
    return msg ?? `Model provider API ${status} ${statusText}`
}
