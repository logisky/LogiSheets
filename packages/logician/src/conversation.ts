/**
 * Conversation event stream — the single source of truth for an
 * agent session. UI transcripts and LLM `messages` arrays are both
 * pure projections of this stream.
 *
 * Events are append-only. The agent loop never rewrites or deletes.
 * Old events may be elided via summarization (a `system_note` replacing
 * a prefix) but the original events remain for replay and debugging.
 */

/** Discriminated union of everything that can happen in a conversation. */
export type ConversationEvent =
    | UserMessageEvent
    | AssistantTextEvent
    | ToolCallEvent
    | ToolResultEvent
    | UserConfirmEvent
    | SystemNoteEvent

export interface BaseEvent {
    /** Unique id, monotonically sortable (UUIDv7 or `${ts}-${rand}`). */
    id: string
    /** Conversation foreign key. */
    conversation_id: string
    /** Epoch ms when the event was recorded. */
    ts: number
}

export interface UserMessageEvent extends BaseEvent {
    kind: 'user_message'
    text: string
}

export interface AssistantTextEvent extends BaseEvent {
    kind: 'assistant_text'
    text: string
    /**
     * The model can emit multiple text blocks interleaved with tool calls
     * in a single turn. `turn_id` groups events that belong to the same
     * LLM response.
     */
    turn_id: string
}

export interface ToolCallEvent extends BaseEvent {
    kind: 'tool_call'
    /** Anthropic's tool_use_id — used to correlate with tool_result. */
    tool_use_id: string
    /** Fully-qualified tool name, e.g. "build__create_block". */
    name: string
    /** Validated input object. */
    input: unknown
    turn_id: string
}

export interface ToolResultEvent extends BaseEvent {
    kind: 'tool_result'
    tool_use_id: string
    /**
     * Output payload, or a blob ref when the value is large. Large outputs
     * (e.g. describe_block with include_rows=true) should be stored via
     * `ConversationStore.putBlob` and referenced here as
     * `{kind: 'blob_ref', ref: '...'}` to keep events table compact.
     */
    output: unknown
    /** Set when the handler threw. `output` then holds an error summary. */
    error?: string
    /** Total time the handler spent, ms. */
    duration_ms: number
}

export interface UserConfirmEvent extends BaseEvent {
    kind: 'user_confirm'
    tool_use_id: string
    approved: boolean
    /** Optional reason the user typed when rejecting. */
    reason?: string
}

export interface SystemNoteEvent extends BaseEvent {
    kind: 'system_note'
    text: string
    /**
     * Tag used by projection logic to decide visibility. e.g.:
     *   'summary'     — replaces an elided prefix, must enter LLM context
     *   'ui_only'     — surface to user but skip in LLM messages
     *   'debug'       — internal trace, neither projected to UI nor LLM
     */
    visibility: 'summary' | 'ui_only' | 'debug'
}

// ---------------------------------------------------------------------------
// Conversation envelope
// ---------------------------------------------------------------------------

export interface Conversation {
    id: string
    /** Auto-generated or user-renamed, shown in the sidebar. */
    title: string
    /** Workbook this conversation is bound to. Optional for cross-workbook chats. */
    workbook_id?: string
    /** Anthropic model id, e.g. "claude-opus-4-7". */
    model: string
    created_at: number
    updated_at: number
    /** Optional free-form metadata for forward-compat (skill name, locale, …). */
    extra?: Record<string, unknown>
}

/** Lightweight shape for sidebars / pickers — no events. */
export interface ConversationSummary {
    id: string
    title: string
    workbook_id?: string
    updated_at: number
    /** Cached event count for the badge; null means "unknown, query if needed". */
    event_count?: number
}

/** Bundle returned by an export. */
export interface ConversationExport {
    conversation: Conversation
    events: ConversationEvent[]
    /** Inlined blob payloads keyed by ref. */
    blobs: Record<string, string | Uint8Array>
}
