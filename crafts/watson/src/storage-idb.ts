/**
 * IdbConversationStore — Dexie-backed implementation of the
 * `ConversationStore` interface from the `logician` package.
 *
 * Schema:
 *   conversations  id(pk), workbook_id, updated_at
 *   events         id(pk), conversation_id, [conversation_id+ts]
 *   blobs          ref(pk)
 *
 * All cross-conversation queries hit a single indexed scan; events for
 * a given conversation read via the composite [conversation_id+ts]
 * index, which keeps the bytes streamed off disk minimal.
 *
 * Subscriptions piggyback on Dexie's `liveQuery` — same machinery
 * powers cross-tab updates automatically, so opening the workbook in
 * two browser tabs Just Works.
 */

import Dexie, {liveQuery, type Table} from 'dexie'
import type {
    Conversation,
    ConversationEvent,
    ConversationExport,
    ConversationStore,
    ConversationSummary,
} from 'logician'

// ---------------------------------------------------------------------------
// Dexie schema
// ---------------------------------------------------------------------------

interface BlobRow {
    ref: string
    /** Stored verbatim — Dexie supports Blob/Uint8Array/string transparently. */
    value: string | Uint8Array
}

class WatsonDB extends Dexie {
    conversations!: Table<Conversation, string>
    events!: Table<ConversationEvent, string>
    blobs!: Table<BlobRow, string>

    constructor(dbName = 'watson') {
        super(dbName)
        this.version(1).stores({
            // Primary key first, then indexed fields.
            // The composite [conversation_id+ts] gives ordered range scans.
            conversations: 'id, workbook_id, updated_at',
            events: 'id, conversation_id, [conversation_id+ts]',
            blobs: 'ref',
        })
    }
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export interface IdbConversationStoreOptions {
    /**
     * Dexie database name. Each origin has its own IDB namespace, so the
     * default `watson` is fine — only change if you need parallel stores
     * (e.g. tests, or a "scratch" mode that doesn't pollute the real one).
     */
    dbName?: string
}

export class IdbConversationStore implements ConversationStore {
    private db: WatsonDB
    private blobCounter = 0

    constructor(opts: IdbConversationStoreOptions = {}) {
        this.db = new WatsonDB(opts.dbName ?? 'watson')
    }

    /** Force-close the underlying Dexie connection. Useful for tests. */
    close(): void {
        this.db.close()
    }

    // ----- Conversations -----

    async createConversation(
        meta: Omit<Conversation, 'id' | 'created_at' | 'updated_at'> & {
            id?: string
        }
    ): Promise<Conversation> {
        const id = meta.id ?? newConversationId()
        const now = Date.now()
        const conv: Conversation = {
            ...meta,
            id,
            created_at: now,
            updated_at: now,
        }
        await this.db.conversations.add(conv)
        return conv
    }

    async getConversation(id: string): Promise<Conversation | null> {
        return (await this.db.conversations.get(id)) ?? null
    }

    async listConversations(filter?: {
        workbook_id?: string
        limit?: number
    }): Promise<ConversationSummary[]> {
        let query = filter?.workbook_id !== undefined
            ? this.db.conversations
                  .where('workbook_id')
                  .equals(filter.workbook_id)
            : this.db.conversations.toCollection()

        const rows = await query.reverse().sortBy('updated_at')
        const sliced = filter?.limit ? rows.slice(0, filter.limit) : rows

        // event_count is left undefined; UI can query if it needs the badge.
        // (Counting all events per conversation here would be O(N) per call.)
        return sliced.map((c) => ({
            id: c.id,
            title: c.title,
            workbook_id: c.workbook_id,
            updated_at: c.updated_at,
        }))
    }

    async updateConversation(
        id: string,
        patch: Partial<Pick<Conversation, 'title' | 'extra'>>
    ): Promise<void> {
        const next: Partial<Conversation> = {...patch, updated_at: Date.now()}
        await this.db.conversations.update(id, next)
    }

    async deleteConversation(id: string): Promise<void> {
        await this.db.transaction(
            'rw',
            this.db.conversations,
            this.db.events,
            async () => {
                await this.db.conversations.delete(id)
                await this.db.events
                    .where('conversation_id')
                    .equals(id)
                    .delete()
            }
        )
    }

    // ----- Events -----

    async appendEvent(event: ConversationEvent): Promise<void> {
        await this.db.transaction(
            'rw',
            this.db.events,
            this.db.conversations,
            async () => {
                await this.db.events.add(event)
                await this.db.conversations.update(event.conversation_id, {
                    updated_at: event.ts,
                })
            }
        )
    }

    async appendEvents(events: ConversationEvent[]): Promise<void> {
        if (events.length === 0) return
        // Resolve the latest ts per conversation for a single update each.
        const latestByConv = new Map<string, number>()
        for (const e of events) {
            const prev = latestByConv.get(e.conversation_id) ?? 0
            if (e.ts > prev) latestByConv.set(e.conversation_id, e.ts)
        }
        await this.db.transaction(
            'rw',
            this.db.events,
            this.db.conversations,
            async () => {
                await this.db.events.bulkAdd(events)
                for (const [cid, ts] of latestByConv) {
                    await this.db.conversations.update(cid, {updated_at: ts})
                }
            }
        )
    }

    async listEvents(
        conversation_id: string,
        opts?: {since_ts?: number; limit?: number}
    ): Promise<ConversationEvent[]> {
        const lower: [string, number] = [
            conversation_id,
            opts?.since_ts ?? Number.NEGATIVE_INFINITY,
        ]
        const upper: [string, number] = [conversation_id, Number.POSITIVE_INFINITY]
        let coll = this.db.events
            .where('[conversation_id+ts]')
            .between(lower, upper, true, true)
        if (opts?.limit) coll = coll.limit(opts.limit)
        return await coll.toArray()
    }

    // ----- Blobs -----

    async putBlob(value: string | Uint8Array): Promise<string> {
        const ref = `blob_${Date.now().toString(36)}_${(this.blobCounter++)
            .toString(36)}_${shortRand()}`
        await this.db.blobs.add({ref, value})
        return ref
    }

    async getBlob(ref: string): Promise<string | Uint8Array | null> {
        const row = await this.db.blobs.get(ref)
        return row?.value ?? null
    }

    async deleteBlob(ref: string): Promise<void> {
        await this.db.blobs.delete(ref)
    }

    // ----- Live subscription -----

    subscribeEvents(
        conversation_id: string,
        cb: (events: ConversationEvent[]) => void
    ): () => void {
        // Dexie's liveQuery re-runs the query whenever any write touches a
        // table it read from. Cross-tab observation comes for free via the
        // BroadcastChannel-backed `db.on.changes` plumbing inside Dexie 4.
        const observable = liveQuery(() => this.listEvents(conversation_id))
        const sub = observable.subscribe({
            next: cb,
            error: (err) => {
                // Don't crash the host — surface to the console and let the
                // caller decide what to do.
                console.error('[watson.idb] liveQuery error', err)
            },
        })
        return () => sub.unsubscribe()
    }

    // ----- Export / import -----

    async exportConversation(id: string): Promise<ConversationExport> {
        const conversation = await this.getConversation(id)
        if (!conversation) {
            throw new Error(`exportConversation: not found: ${id}`)
        }
        const events = await this.listEvents(id)
        const blobs: Record<string, string | Uint8Array> = {}
        for (const e of events) {
            if (e.kind !== 'tool_result') continue
            const ref = extractBlobRef(e.output)
            if (!ref) continue
            const blob = await this.getBlob(ref)
            if (blob !== null) blobs[ref] = blob
        }
        return {conversation, events, blobs}
    }

    async importConversation(bundle: ConversationExport): Promise<string> {
        const {conversation, events, blobs} = bundle
        await this.db.transaction(
            'rw',
            this.db.conversations,
            this.db.events,
            this.db.blobs,
            async () => {
                await this.db.conversations.put(conversation)
                if (events.length > 0) await this.db.events.bulkPut(events)
                const blobRows = Object.entries(blobs).map(([ref, value]) => ({
                    ref,
                    value,
                }))
                if (blobRows.length > 0) await this.db.blobs.bulkPut(blobRows)
            }
        )
        return conversation.id
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractBlobRef(output: unknown): string | null {
    if (
        output &&
        typeof output === 'object' &&
        (output as {kind?: unknown}).kind === 'blob_ref' &&
        typeof (output as {ref?: unknown}).ref === 'string'
    ) {
        return (output as {ref: string}).ref
    }
    return null
}

function newConversationId(): string {
    return `conv_${Date.now().toString(36)}_${shortRand()}`
}

function shortRand(): string {
    return Math.random().toString(36).slice(2, 10)
}
