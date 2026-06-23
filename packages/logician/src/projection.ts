/**
 * Pure projections from the event stream to:
 *   - Agent IR messages (Anthropic-compatible shape, used as canonical IR
 *     by all LlmClient implementations — Anthropic adapters consume it
 *     directly, other providers translate into their wire format)
 *                                     → toLlmMessages
 *   - UI-friendly chat bubbles        → toUiBubbles
 *
 * Both are referentially transparent: same events → same output, no I/O.
 * The agent loop calls toLlmMessages before each request; the UI calls
 * toUiBubbles whenever events change. Cache-control breakpoints for
 * prompt caching are NOT placed here — they're a property of the
 * request, not the message content.
 */

import type {
    ConversationEvent,
    SystemNoteEvent,
    ToolCallEvent,
    ToolResultEvent,
} from './conversation.js'

// ---------------------------------------------------------------------------
// Agent IR (Anthropic-compatible shape, used by all LlmClient adapters)
// ---------------------------------------------------------------------------

export type AgentRole = 'user' | 'assistant'

export type AgentContentBlock =
    | {type: 'text'; text: string}
    | {
          type: 'tool_use'
          id: string
          name: string
          input: unknown
      }
    | {
          type: 'tool_result'
          tool_use_id: string
          content: string | AgentContentBlock[]
          is_error?: boolean
      }

export interface AgentMessage {
    role: AgentRole
    content: string | AgentContentBlock[]
}

/**
 * Hook for materializing blob refs into real payloads. The store-aware
 * caller (agent loop) passes a resolver; pure callers can omit it and
 * blob refs render as a short placeholder.
 */
export type BlobResolver = (ref: string) => string | null

// ---------------------------------------------------------------------------
// toLlmMessages — events → agent IR messages
// ---------------------------------------------------------------------------

export interface ToLlmMessagesOpts {
    /** Resolve `{kind:'blob_ref', ref}` payloads into strings. */
    resolveBlob?: BlobResolver
    /**
     * Cap on a single tool_result's serialized size, in chars. Larger
     * payloads are truncated with a trailing "(... truncated, N more
     * chars)" marker. Default 8000.
     */
    max_tool_result_chars?: number
    /**
     * Drop tool_results older than this index (0-based, counting only
     * tool_result events). Use to keep ancient results out of context
     * once they're no longer load-bearing. -1 disables (default).
     */
    truncate_tool_results_before?: number
}

/**
 * Project events into the agent IR (Anthropic-compatible).
 *
 * Rules:
 *   - user_message       → {role: 'user', content: text}
 *   - assistant_text +
 *     tool_call          → merged into one {role: 'assistant', content: [...]}
 *                          per turn_id
 *   - tool_result        → {role: 'user', content: [{type:'tool_result', ...}]}
 *   - user_confirm       → dropped (internal signal)
 *   - system_note:debug  → dropped
 *   - system_note:ui_only→ dropped
 *   - system_note:summary→ {role: 'user', content: text} with a
 *                          "[summary]" prefix so the model recognizes it
 */
export function toLlmMessages(
    events: readonly ConversationEvent[],
    opts: ToLlmMessagesOpts = {}
): AgentMessage[] {
    const max = opts.max_tool_result_chars ?? 8000
    const dropBefore = opts.truncate_tool_results_before ?? -1
    const messages: AgentMessage[] = []
    let toolResultIdx = -1

    // Buffer for in-progress assistant turn. Same turn_id collapses
    // multiple assistant_text + tool_call events into one message.
    let pendingTurnId: string | null = null
    let pendingBlocks: AgentContentBlock[] = []

    const flushAssistant = () => {
        if (pendingTurnId === null) return
        if (pendingBlocks.length > 0) {
            messages.push({role: 'assistant', content: pendingBlocks})
        }
        pendingTurnId = null
        pendingBlocks = []
    }

    for (const e of events) {
        switch (e.kind) {
            case 'user_confirm':
                // internal — never crosses to LLM
                continue

            case 'system_note':
                if (e.visibility !== 'summary') continue
                flushAssistant()
                messages.push({
                    role: 'user',
                    content: `[summary] ${e.text}`,
                })
                continue

            case 'user_message':
                flushAssistant()
                messages.push({role: 'user', content: e.text})
                continue

            case 'assistant_text':
                if (pendingTurnId !== e.turn_id) {
                    flushAssistant()
                    pendingTurnId = e.turn_id
                }
                pendingBlocks.push({type: 'text', text: e.text})
                continue

            case 'tool_call':
                if (pendingTurnId !== e.turn_id) {
                    flushAssistant()
                    pendingTurnId = e.turn_id
                }
                pendingBlocks.push({
                    type: 'tool_use',
                    id: e.tool_use_id,
                    name: e.name,
                    input: e.input ?? {},
                })
                continue

            case 'tool_result': {
                flushAssistant()
                toolResultIdx++
                if (toolResultIdx < dropBefore) continue

                const serialized = serializeToolOutput(e, opts.resolveBlob, max)
                messages.push({
                    role: 'user',
                    content: [
                        {
                            type: 'tool_result',
                            tool_use_id: e.tool_use_id,
                            content: serialized.content,
                            is_error: serialized.is_error,
                        },
                    ],
                })
                continue
            }
        }
    }
    flushAssistant()
    return messages
}

function serializeToolOutput(
    e: ToolResultEvent,
    resolveBlob: BlobResolver | undefined,
    max: number
): {content: string; is_error?: boolean} {
    if (e.error) {
        return {content: e.error.slice(0, max), is_error: true}
    }
    let raw = stringifyOutput(e.output, resolveBlob)
    if (raw.length > max) {
        const dropped = raw.length - max
        raw = raw.slice(0, max) + `\n(… truncated, ${dropped} more chars)`
    }
    return {content: raw}
}

function stringifyOutput(
    output: unknown,
    resolveBlob: BlobResolver | undefined
): string {
    if (typeof output === 'string') return output
    if (output && typeof output === 'object') {
        const ref =
            (output as {kind?: string; ref?: unknown}).kind === 'blob_ref' &&
            typeof (output as {ref?: unknown}).ref === 'string'
                ? (output as {ref: string}).ref
                : null
        if (ref) {
            const resolved = resolveBlob ? resolveBlob(ref) : null
            return resolved ?? `(blob ${ref} — not resolved)`
        }
    }
    try {
        return JSON.stringify(output)
    } catch {
        return String(output)
    }
}

// ---------------------------------------------------------------------------
// toUiBubbles — events → render-friendly chat bubbles
// ---------------------------------------------------------------------------

/**
 * Each bubble is one row in the chat UI. tool_call + tool_result are
 * fused into a single ToolBubble so the UI renders one collapsible card
 * per tool invocation rather than two stacked rows.
 */
export type ChatBubble =
    | UserBubble
    | AssistantTextBubble
    | ToolBubble
    | NoteBubble

export interface UserBubble {
    kind: 'user'
    id: string
    ts: number
    text: string
}

export interface AssistantTextBubble {
    kind: 'assistant_text'
    id: string
    ts: number
    text: string
    turn_id: string
    /** Set on the last assistant_text of a turn for tail spacing. */
    last_in_turn: boolean
}

export interface ToolBubble {
    kind: 'tool'
    id: string
    ts: number
    turn_id: string
    tool_use_id: string
    name: string
    input: unknown
    /** Populated once the matching tool_result arrives. */
    output?: unknown
    error?: string
    duration_ms?: number
    /** True from request → response window. */
    pending: boolean
    /** Captures the user's decision on a confirmation prompt. */
    user_confirm?: {approved: boolean; reason?: string}
}

export interface NoteBubble {
    kind: 'note'
    id: string
    ts: number
    text: string
    /** 'summary' notes are also worth showing; 'debug' is filtered out. */
    severity: 'info' | 'summary'
}

export interface ToUiBubblesOpts {
    /** Include debug-level system_notes (for a "show internals" toggle). */
    include_debug?: boolean
}

export function toUiBubbles(
    events: readonly ConversationEvent[],
    opts: ToUiBubblesOpts = {}
): ChatBubble[] {
    const bubbles: ChatBubble[] = []
    /** tool_use_id → index in bubbles array, for back-patching results. */
    const toolBubbleByUseId = new Map<string, number>()

    for (const e of events) {
        switch (e.kind) {
            case 'user_message':
                bubbles.push({
                    kind: 'user',
                    id: e.id,
                    ts: e.ts,
                    text: e.text,
                })
                continue

            case 'assistant_text':
                bubbles.push({
                    kind: 'assistant_text',
                    id: e.id,
                    ts: e.ts,
                    text: e.text,
                    turn_id: e.turn_id,
                    last_in_turn: false,
                })
                continue

            case 'tool_call': {
                const idx =
                    bubbles.push({
                        kind: 'tool',
                        id: e.id,
                        ts: e.ts,
                        turn_id: e.turn_id,
                        tool_use_id: e.tool_use_id,
                        name: e.name,
                        input: e.input,
                        pending: true,
                    }) - 1
                toolBubbleByUseId.set(e.tool_use_id, idx)
                continue
            }

            case 'tool_result': {
                const idx = toolBubbleByUseId.get(e.tool_use_id)
                if (idx === undefined) {
                    // Orphan tool_result — surface as a note for debugging.
                    bubbles.push({
                        kind: 'note',
                        id: e.id,
                        ts: e.ts,
                        text: `orphan tool_result for ${e.tool_use_id}`,
                        severity: 'info',
                    })
                    continue
                }
                const tb = bubbles[idx] as ToolBubble
                tb.output = e.output
                tb.error = e.error
                tb.duration_ms = e.duration_ms
                tb.pending = false
                continue
            }

            case 'user_confirm': {
                const idx = toolBubbleByUseId.get(e.tool_use_id)
                if (idx !== undefined) {
                    const tb = bubbles[idx] as ToolBubble
                    tb.user_confirm = {
                        approved: e.approved,
                        reason: e.reason,
                    }
                }
                continue
            }

            case 'system_note': {
                if (e.visibility === 'debug' && !opts.include_debug) continue
                if (e.visibility === 'ui_only' || e.visibility === 'summary') {
                    bubbles.push({
                        kind: 'note',
                        id: e.id,
                        ts: e.ts,
                        text: e.text,
                        severity:
                            e.visibility === 'summary' ? 'summary' : 'info',
                    })
                }
                continue
            }
        }
    }

    // Tag the last assistant_text of each turn so the UI can add trailing
    // spacing / show a "done" marker without inspecting siblings at render.
    const lastAssistantIdxByTurn = new Map<string, number>()
    for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i]
        if (b.kind === 'assistant_text')
            lastAssistantIdxByTurn.set(b.turn_id, i)
    }
    for (const i of lastAssistantIdxByTurn.values()) {
        ;(bubbles[i] as AssistantTextBubble).last_in_turn = true
    }

    return bubbles
}

// ---------------------------------------------------------------------------
// Helpers re-exported for tests / external composition
// ---------------------------------------------------------------------------

/** Type guard, exposed for downstream tooling. */
export function isToolCall(e: ConversationEvent): e is ToolCallEvent {
    return e.kind === 'tool_call'
}

export function isSystemNote(e: ConversationEvent): e is SystemNoteEvent {
    return e.kind === 'system_note'
}
