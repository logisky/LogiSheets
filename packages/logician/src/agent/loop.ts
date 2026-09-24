/**
 * Agent loop — drive a multi-turn conversation:
 *   user_message → LLM → (text + tool_use*) → execute tools → repeat
 *   until stop_reason === 'end_turn'.
 *
 * The loop is platform-agnostic. It depends on:
 *   - ConversationStore  (events + blobs)
 *   - ToolRegistry        (handler dispatch)
 *   - LlmClient            (Anthropic, or any drop-in)
 *   - WorkbookClient      (passed through to tool handlers)
 *   - host-provided confirm / log callbacks
 *
 * No LLM SDK is imported here. Hosts wire up a concrete LlmClient, and the
 * agent IR this loop speaks (Anthropic-shaped content blocks — see
 * projection.ts) is the canonical form: an Anthropic-wire client passes it
 * through, an OpenAI-wire client translates it. Keeping the boundary this thin
 * is what lets the same loop drive Claude, GPT, DeepSeek or a local Ollama,
 * and lets us test it without a network.
 */

import type {
    AssistantTextEvent,
    ConversationEvent,
    SystemNoteEvent,
    ToolCallEvent,
    ToolResultEvent,
    UserConfirmEvent,
    UserMessageEvent,
} from '../conversation.js'
import {
    toLlmMessages,
    type AgentContentBlock,
    type AgentMessage,
    type BlobResolver,
} from '../projection.js'
import type {ConversationStore} from '../storage.js'
import {toLlmTool, ToolRegistry} from '../tool.js'
import type {Tool, ToolContext, WorkbookClient} from '../tool.js'
import type {CraftInteractionsApi} from '../craft-interactions-api.js'

// ---------------------------------------------------------------------------
// LlmClient — minimal surface the loop needs
// ---------------------------------------------------------------------------

export interface LlmCreateMessageParams {
    model: string
    system: AgentSystemBlock[]
    tools: ReturnType<typeof toLlmTool>[]
    messages: AgentMessage[]
    max_tokens: number
    signal?: AbortSignal
}

export interface AgentSystemBlock {
    type: 'text'
    text: string
    /** Cache breakpoint marker. */
    cache_control?: {type: 'ephemeral'}
}

export interface LlmResponse {
    /** Anthropic-style response content. */
    content: AgentContentBlock[]
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

/**
 * The one call the loop makes. Implementations translate to their wire format
 * and back; a rejected promise (network, HTTP error, abort) propagates out of
 * `Agent.runTurn` / `askAi` unchanged — neither retries.
 */
export interface LlmClient {
    createMessage(params: LlmCreateMessageParams): Promise<LlmResponse>
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export interface AgentOptions {
    /** Must already hold the conversation `runTurn` is called with. */
    store: ConversationStore
    registry: ToolRegistry
    llm: LlmClient
    workbook: WorkbookClient
    /** Model id, in the provider's own spelling. Default 'claude-opus-5'. */
    model?: string
    /** Cap on tokens per response. Default 4096. */
    max_tokens?: number
    /**
     * System prompt, sent verbatim as the only system block. Tools travel in
     * the request's `tools` field, not in this text.
     */
    systemPrompt: string
    /**
     * Defensive cap on LLM round-trips per user turn (not individual tool
     * calls — one response may hold several). Default 16. The check runs
     * before each request as `iter++ > cap`, so up to cap + 1 requests go out.
     */
    max_tool_iterations?: number
    /**
     * Confirmation prompt for tools whose policy demands it. Omitted means
     * auto-approve everything, which suits tests and trusted headless hosts
     * only. `'once'` is passed through as-is; remembering it is on the host.
     */
    confirm?: (
        toolName: string,
        input: unknown,
        policy: 'once' | 'always' | 'destructive'
    ) => Promise<{approved: boolean; reason?: string}>
    /** Hook for surfacing in-flight notes to the host UI (toast / log line). */
    log?: (msg: string) => void
    /** Optional craft-interaction capability surface; passed to every
     *  ToolContext so craft-interaction tools can reach the host's
     *  overlay-widget state. Omit on headless hosts. */
    craftInteractions?: CraftInteractionsApi
}

/**
 * One agent bound to one workbook, store and registry. Reusable across
 * conversations and turns; holds no per-conversation state of its own —
 * everything is re-read from the store before each LLM request.
 */
export class Agent {
    private store: ConversationStore
    private registry: ToolRegistry
    private llm: LlmClient
    private workbook: WorkbookClient
    private model: string
    private maxTokens: number
    private systemPrompt: string
    private maxToolIters: number
    private confirm: NonNullable<AgentOptions['confirm']>
    private log: NonNullable<AgentOptions['log']>
    private craftInteractions?: CraftInteractionsApi

    constructor(opts: AgentOptions) {
        this.store = opts.store
        this.registry = opts.registry
        this.llm = opts.llm
        this.workbook = opts.workbook
        this.model = opts.model ?? 'claude-opus-5'
        this.maxTokens = opts.max_tokens ?? 4096
        this.systemPrompt = opts.systemPrompt
        this.maxToolIters = opts.max_tool_iterations ?? 16
        // Default confirm: auto-approve. Browser host overrides with a
        // real modal. CLI host can override with stdin prompt.
        this.confirm = opts.confirm ?? (async () => ({approved: true}))
        this.log = opts.log ?? (() => {})
        this.craftInteractions = opts.craftInteractions
    }

    /**
     * Run one user turn end-to-end: append the user_message, then loop
     * LLM ↔ tools until the model emits end_turn or we hit a safety cap.
     *
     * Requires `conversation_id` to exist in the store (create it first;
     * `MemoryConversationStore.appendEvent` throws otherwise). Results arrive
     * as appended events, not as a return value — subscribe to the store or
     * re-list its events to render them.
     *
     * Failure: tool errors and declined confirmations become `tool_result`
     * events and the loop continues; an `LlmClient` or store rejection
     * propagates and ends the turn. Hitting the cap, max_tokens, or an abort
     * seen at the top of the loop ends it with a `ui_only` system_note.
     */
    async runTurn(
        conversation_id: string,
        userText: string,
        signal?: AbortSignal
    ): Promise<void> {
        const userEvent: UserMessageEvent = {
            kind: 'user_message',
            id: newEventId(),
            conversation_id,
            ts: nowMs(),
            text: userText,
        }
        await this.store.appendEvent(userEvent)

        const blobResolver: BlobResolver = (ref) => {
            // Blob refs are NOT resolved yet: `getBlob` is async and nothing
            // pre-hydrates a sync cache, so a `blob_ref` tool output reaches
            // the model as the "(blob … not resolved)" placeholder. The loop
            // itself never writes blob refs; only a host-written event would.
            return null
        }

        let iter = 0
        for (;;) {
            if (signal?.aborted) {
                await this.appendNote(
                    conversation_id,
                    'Turn aborted by user.',
                    'ui_only'
                )
                return
            }
            if (iter++ > this.maxToolIters) {
                await this.appendNote(
                    conversation_id,
                    `Tool-iteration cap (${this.maxToolIters}) reached. Stopping.`,
                    'ui_only'
                )
                return
            }

            const events = await this.store.listEvents(conversation_id)
            const messages = toLlmMessages(events, {resolveBlob: blobResolver})

            const response = await this.llm.createMessage({
                model: this.model,
                system: this.buildSystem(),
                tools: this.registry.toLlmTools(),
                messages,
                max_tokens: this.maxTokens,
                signal,
            })

            const turn_id = newTurnId()
            const toolCalls: Array<{
                id: string
                name: string
                input: unknown
            }> = []

            // First pass: persist every assistant content block as an event
            // *before* executing any tool. This way a crash mid-tool-run
            // leaves the assistant's intent on record and we can recover.
            for (const block of response.content) {
                if (block.type === 'text') {
                    const e: AssistantTextEvent = {
                        kind: 'assistant_text',
                        id: newEventId(),
                        conversation_id,
                        ts: nowMs(),
                        text: block.text,
                        turn_id,
                    }
                    await this.store.appendEvent(e)
                } else if (block.type === 'tool_use') {
                    const e: ToolCallEvent = {
                        kind: 'tool_call',
                        id: newEventId(),
                        conversation_id,
                        ts: nowMs(),
                        tool_use_id: block.id,
                        name: block.name,
                        input: block.input,
                        turn_id,
                    }
                    await this.store.appendEvent(e)
                    toolCalls.push({
                        id: block.id,
                        name: block.name,
                        input: block.input,
                    })
                }
                // tool_result blocks in the response don't happen — the
                // model never produces them, only consumes them.
            }

            // Second pass: execute every tool the model asked for. Anthropic
            // requires *all* tool_results for the previous turn before the
            // next request, so we walk them sequentially here.
            for (const call of toolCalls) {
                // Returning here leaves the remaining tool_use blocks with no
                // tool_result on record.
                if (signal?.aborted) return
                await this.executeToolCall(conversation_id, call, signal)
            }

            if (response.stop_reason === 'end_turn') break
            if (response.stop_reason === 'max_tokens') {
                await this.appendNote(
                    conversation_id,
                    'Response truncated at max_tokens.',
                    'ui_only'
                )
                break
            }
            // Any other stop_reason (incl. 'tool_use') — loop to next request.
        }
    }

    // -----------------------------------------------------------------------

    private async executeToolCall(
        conversation_id: string,
        call: {id: string; name: string; input: unknown},
        signal?: AbortSignal
    ): Promise<void> {
        const tool: Tool | undefined = this.registry.get(call.name)
        const start = nowMs()

        if (!tool) {
            const e: ToolResultEvent = {
                kind: 'tool_result',
                id: newEventId(),
                conversation_id,
                ts: nowMs(),
                tool_use_id: call.id,
                output: null,
                error: `Unknown tool: ${call.name}`,
                duration_ms: 0,
            }
            await this.store.appendEvent(e)
            return
        }

        // Confirmation gate.
        const policy = tool.confirmation ?? (tool.mutates ? 'always' : 'never')
        if (policy !== 'never') {
            const decision = await this.confirm(
                call.name,
                call.input,
                policy as 'once' | 'always' | 'destructive'
            )
            const ev: UserConfirmEvent = {
                kind: 'user_confirm',
                id: newEventId(),
                conversation_id,
                ts: nowMs(),
                tool_use_id: call.id,
                approved: decision.approved,
                reason: decision.reason,
            }
            await this.store.appendEvent(ev)
            if (!decision.approved) {
                const e: ToolResultEvent = {
                    kind: 'tool_result',
                    id: newEventId(),
                    conversation_id,
                    ts: nowMs(),
                    tool_use_id: call.id,
                    output: null,
                    error: `User declined${
                        decision.reason ? `: ${decision.reason}` : '.'
                    }`,
                    duration_ms: nowMs() - start,
                }
                await this.store.appendEvent(e)
                return
            }
        }

        // Run handler.
        const ctx: ToolContext = {
            workbook: this.workbook,
            signal: signal ?? new AbortController().signal,
            confirm: async (msg, detail) => {
                const d = await this.confirm(
                    call.name,
                    {message: msg, detail},
                    'always'
                )
                return d.approved
            },
            log: (msg) => this.log(`[${call.name}] ${msg}`),
            craftInteractions: this.craftInteractions,
        }
        try {
            const result = await tool.handler(call.input, ctx)
            const e: ToolResultEvent = {
                kind: 'tool_result',
                id: newEventId(),
                conversation_id,
                ts: nowMs(),
                tool_use_id: call.id,
                output: result.canceled
                    ? {canceled: true}
                    : result.data ?? null,
                duration_ms: nowMs() - start,
            }
            await this.store.appendEvent(e)
        } catch (err) {
            const e: ToolResultEvent = {
                kind: 'tool_result',
                id: newEventId(),
                conversation_id,
                ts: nowMs(),
                tool_use_id: call.id,
                output: null,
                error: err instanceof Error ? err.message : String(err),
                duration_ms: nowMs() - start,
            }
            await this.store.appendEvent(e)
        }
    }

    private buildSystem(): AgentSystemBlock[] {
        // A single cached block holding the host's system prompt. Tools are
        // not repeated here: they go in the request's `tools` field, which
        // precedes `system` in Anthropic's cache prefix, so this breakpoint
        // covers them too.
        return [
            {
                type: 'text',
                text: this.systemPrompt,
                cache_control: {type: 'ephemeral'},
            },
        ]
    }

    private async appendNote(
        conversation_id: string,
        text: string,
        visibility: SystemNoteEvent['visibility']
    ): Promise<void> {
        const e: SystemNoteEvent = {
            kind: 'system_note',
            id: newEventId(),
            conversation_id,
            ts: nowMs(),
            text,
            visibility,
        }
        await this.store.appendEvent(e)
    }
}

// ---------------------------------------------------------------------------
// id / time helpers — kept local so the loop has no implicit globals
// ---------------------------------------------------------------------------

function newEventId(): string {
    return `evt_${nowMs().toString(36)}_${shortRand()}`
}

function newTurnId(): string {
    return `turn_${nowMs().toString(36)}_${shortRand()}`
}

function nowMs(): number {
    return Date.now()
}

function shortRand(): string {
    return Math.random().toString(36).slice(2, 10)
}

// Suppress "unused" diagnostic for the type re-imports above; kept for
// downstream consumers that import them via the loop module path.
export type {ConversationEvent}
