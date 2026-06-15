/**
 * Storage abstraction for conversations + events + blobs.
 *
 * The logician package never imports a concrete storage backend.
 * Hosts plug one in:
 *   - Watson (browser craft)        → IdbConversationStore via Dexie
 *   - Node CLI / MCP server          → FileConversationStore (json-on-disk)
 *   - Tests / smoke runs / REPLs     → MemoryConversationStore (this file)
 *
 * Same pattern as `WorkbookClient` in tool.ts — declare the surface
 * here, let the platform provide the implementation.
 */

import type {
    Conversation,
    ConversationEvent,
    ConversationExport,
    ConversationSummary,
} from './conversation'

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ConversationStoreOpts {
    /** Cap on listEvents() output for safety; 0 means no cap. */
    max_events_per_query?: number
}

/**
 * Persistence surface used by the agent loop. All methods are async so
 * IDB / fs / network backends fit without changing call sites.
 */
export interface ConversationStore {
    // ----- Conversation lifecycle -----

    createConversation(
        meta: Omit<Conversation, 'id' | 'created_at' | 'updated_at'> & {
            id?: string
        }
    ): Promise<Conversation>

    getConversation(id: string): Promise<Conversation | null>

    listConversations(filter?: {
        workbook_id?: string
        limit?: number
    }): Promise<ConversationSummary[]>

    updateConversation(
        id: string,
        patch: Partial<Pick<Conversation, 'title' | 'extra'>>
    ): Promise<void>

    deleteConversation(id: string): Promise<void>

    // ----- Events -----

    /**
     * Append a single event. Implementations should `updated_at` the
     * parent conversation atomically with the insert.
     */
    appendEvent(event: ConversationEvent): Promise<void>

    /**
     * Batched append. Useful when replaying a remote sync or restoring
     * a workbook-archived conversation. Atomic on backends that support
     * transactions; otherwise best-effort sequential.
     */
    appendEvents(events: ConversationEvent[]): Promise<void>

    /** Read events in ts-ascending order. */
    listEvents(
        conversation_id: string,
        opts?: {since_ts?: number; limit?: number}
    ): Promise<ConversationEvent[]>

    // ----- Blobs (large tool_result payloads, attachments) -----

    /** Returns a stable ref string the caller stores in the event. */
    putBlob(value: string | Uint8Array): Promise<string>

    getBlob(ref: string): Promise<string | Uint8Array | null>

    deleteBlob(ref: string): Promise<void>

    // ----- Optional: live subscription (UI only) -----

    /**
     * Reactive subscription. Browser stores (IDB/Dexie) implement this
     * to drive UI updates; headless backends may omit it.
     * Returns an unsubscribe function.
     */
    subscribeEvents?(
        conversation_id: string,
        cb: (events: ConversationEvent[]) => void
    ): () => void

    // ----- Optional: export / import -----

    exportConversation?(id: string): Promise<ConversationExport>
    importConversation?(bundle: ConversationExport): Promise<string>
}

// ---------------------------------------------------------------------------
// In-memory implementation
// ---------------------------------------------------------------------------

/**
 * Volatile store. Survives the lifetime of the process, nothing more.
 * Useful for:
 *   - tests
 *   - node CLI runs that don't care about persistence across invocations
 *   - Watson MVP before IdbConversationStore lands
 */
export class MemoryConversationStore implements ConversationStore {
    private conversations = new Map<string, Conversation>()
    /** Events grouped by conversation_id, kept sorted by ts. */
    private events = new Map<string, ConversationEvent[]>()
    private blobs = new Map<string, string | Uint8Array>()
    private subscribers = new Map<
        string,
        Set<(events: ConversationEvent[]) => void>
    >()
    private blobCounter = 0

    async createConversation(
        meta: Omit<Conversation, 'id' | 'created_at' | 'updated_at'> & {
            id?: string
        }
    ): Promise<Conversation> {
        const id = meta.id ?? randomId('conv')
        const now = nowMs()
        const conv: Conversation = {
            ...meta,
            id,
            created_at: now,
            updated_at: now,
        }
        this.conversations.set(id, conv)
        this.events.set(id, [])
        return conv
    }

    async getConversation(id: string): Promise<Conversation | null> {
        return this.conversations.get(id) ?? null
    }

    async listConversations(filter?: {
        workbook_id?: string
        limit?: number
    }): Promise<ConversationSummary[]> {
        let rows = [...this.conversations.values()]
        if (filter?.workbook_id !== undefined) {
            rows = rows.filter((c) => c.workbook_id === filter.workbook_id)
        }
        rows.sort((a, b) => b.updated_at - a.updated_at)
        if (filter?.limit) rows = rows.slice(0, filter.limit)
        return rows.map((c) => ({
            id: c.id,
            title: c.title,
            workbook_id: c.workbook_id,
            updated_at: c.updated_at,
            event_count: this.events.get(c.id)?.length ?? 0,
        }))
    }

    async updateConversation(
        id: string,
        patch: Partial<Pick<Conversation, 'title' | 'extra'>>
    ): Promise<void> {
        const c = this.conversations.get(id)
        if (!c) return
        if (patch.title !== undefined) c.title = patch.title
        if (patch.extra !== undefined) c.extra = patch.extra
        c.updated_at = nowMs()
    }

    async deleteConversation(id: string): Promise<void> {
        this.conversations.delete(id)
        this.events.delete(id)
        this.subscribers.delete(id)
    }

    async appendEvent(event: ConversationEvent): Promise<void> {
        const bucket = this.events.get(event.conversation_id)
        if (!bucket) {
            throw new Error(
                `appendEvent: conversation not found: ${event.conversation_id}`
            )
        }
        bucket.push(event)
        const conv = this.conversations.get(event.conversation_id)
        if (conv) conv.updated_at = event.ts
        this.notify(event.conversation_id, bucket)
    }

    async appendEvents(events: ConversationEvent[]): Promise<void> {
        if (events.length === 0) return
        // Group by conversation for one notify per affected conversation.
        const touched = new Set<string>()
        for (const e of events) {
            const bucket = this.events.get(e.conversation_id)
            if (!bucket) {
                throw new Error(
                    `appendEvents: conversation not found: ${e.conversation_id}`
                )
            }
            bucket.push(e)
            const conv = this.conversations.get(e.conversation_id)
            if (conv && e.ts > conv.updated_at) conv.updated_at = e.ts
            touched.add(e.conversation_id)
        }
        for (const cid of touched) {
            this.notify(cid, this.events.get(cid)!)
        }
    }

    async listEvents(
        conversation_id: string,
        opts?: {since_ts?: number; limit?: number}
    ): Promise<ConversationEvent[]> {
        const bucket = this.events.get(conversation_id) ?? []
        let rows = bucket
        if (opts?.since_ts !== undefined) {
            const since = opts.since_ts
            rows = rows.filter((e) => e.ts >= since)
        }
        if (opts?.limit) rows = rows.slice(0, opts.limit)
        // bucket is already in insertion order, which matches ts-ascending
        // because appendEvent never inserts out-of-order events.
        return rows.slice()
    }

    async putBlob(value: string | Uint8Array): Promise<string> {
        const ref = `blob_${++this.blobCounter}_${randomShort()}`
        this.blobs.set(ref, value)
        return ref
    }

    async getBlob(ref: string): Promise<string | Uint8Array | null> {
        return this.blobs.get(ref) ?? null
    }

    async deleteBlob(ref: string): Promise<void> {
        this.blobs.delete(ref)
    }

    subscribeEvents(
        conversation_id: string,
        cb: (events: ConversationEvent[]) => void
    ): () => void {
        let set = this.subscribers.get(conversation_id)
        if (!set) {
            set = new Set()
            this.subscribers.set(conversation_id, set)
        }
        set.add(cb)
        // Fire once with current snapshot.
        cb([...(this.events.get(conversation_id) ?? [])])
        return () => {
            set!.delete(cb)
        }
    }

    async exportConversation(id: string): Promise<ConversationExport> {
        const conversation = this.conversations.get(id)
        if (!conversation)
            throw new Error(`exportConversation: not found: ${id}`)
        const events = (this.events.get(id) ?? []).slice()
        // Inline every blob referenced by these events.
        const blobs: Record<string, string | Uint8Array> = {}
        for (const e of events) {
            if (e.kind !== 'tool_result') continue
            const ref = extractBlobRef(e.output)
            if (ref) {
                const v = this.blobs.get(ref)
                if (v !== undefined) blobs[ref] = v
            }
        }
        return {conversation, events, blobs}
    }

    async importConversation(bundle: ConversationExport): Promise<string> {
        const {conversation, events, blobs} = bundle
        this.conversations.set(conversation.id, {...conversation})
        this.events.set(conversation.id, [...events])
        for (const [ref, v] of Object.entries(blobs)) {
            this.blobs.set(ref, v)
        }
        return conversation.id
    }

    private notify(conversation_id: string, snapshot: ConversationEvent[]) {
        const set = this.subscribers.get(conversation_id)
        if (!set || set.size === 0) return
        const frozen = [...snapshot]
        for (const cb of set) {
            try {
                cb(frozen)
            } catch {
                // Subscribers shouldn't throw; swallow to protect the store.
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recognise `{kind: 'blob_ref', ref: '...'}` payloads in tool_result.output
 * so exportConversation can inline the referenced blob.
 */
function extractBlobRef(output: unknown): string | null {
    if (
        output &&
        typeof output === 'object' &&
        (output as {kind?: string}).kind === 'blob_ref' &&
        typeof (output as {ref?: unknown}).ref === 'string'
    ) {
        return (output as {ref: string}).ref
    }
    return null
}

function nowMs(): number {
    return Date.now()
}

function randomId(prefix: string): string {
    return `${prefix}_${nowMs().toString(36)}_${randomShort()}`
}

function randomShort(): string {
    return Math.random().toString(36).slice(2, 10)
}
