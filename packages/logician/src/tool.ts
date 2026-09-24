/**
 * Tool — a single capability that the LLM can invoke.
 *
 * Design notes:
 *   - `name` / `description` / `inputSchema` are what get serialized into the
 *     LLM request's `tools` array (Anthropic / OpenAI compatible shape).
 *   - `handler` is the local executor. It receives the validated input plus a
 *     `ToolContext` that carries the workbook handle and any UI hooks.
 *   - `confirmation` lets a tool opt into a user-confirmation step before the
 *     handler runs — important for any write that touches the workbook.
 *   - Tools are grouped under a `namespace` (e.g. "build", "cell", or a
 *     sanitized craft id) so the final tool name exposed to the LLM is
 *     `${namespace}__${name}`. This keeps capabilities from different crafts
 *     from colliding. Providers only accept [A-Za-z0-9_-] in tool names, so
 *     neither part may contain a dot (craft ids are sanitized in
 *     crafts/skill-tools.ts).
 */

import type {Client} from 'logisheets-web/pure'
import type {CraftInteractionsApi} from './craft-interactions-api.js'

/**
 * Workbook client surface used by tool handlers. We re-export the `Client`
 * type from `logisheets-web` so hosts can import it from a single place,
 * and so a future headless adapter (logisheets-node) — which implements the
 * same interface — can be plugged in without changes to tool code.
 */
export type WorkbookClient = Client

/** JSON Schema draft-07 subset; kept loose on purpose. */
export type JSONSchemaType =
    | 'object'
    | 'array'
    | 'string'
    | 'number'
    | 'integer'
    | 'boolean'
    | 'null'

export type JSONSchema = {
    /** A single type or a union (e.g. ['string', 'null'] for nullable). */
    type?: JSONSchemaType | readonly JSONSchemaType[]
    description?: string
    properties?: Record<string, JSONSchema>
    required?: readonly string[]
    items?: JSONSchema
    enum?: readonly (string | number)[]
    default?: unknown
    minItems?: number
    maxItems?: number
    minimum?: number
    maximum?: number
    [k: string]: unknown
}

/**
 * Confirmation policy for a tool invocation. The `Agent` loop only forwards
 * the policy to the host's `confirm` callback; it keeps no memory, so
 * honouring 'once' ("ask once per session") is the host's job.
 */
export type ConfirmationPolicy =
    | 'never' // pure read, no prompt
    | 'once' // ask once per session, then remember
    | 'always' // ask every call
    | 'destructive' // ask every call, with a "destructive" UI affordance

/** Hint to the model (and to the scheduler) about cost. */
export type ToolCost = 'cheap' | 'normal' | 'expensive'

/**
 * Scoped read/write access to a craft's persisted state (the opaque per-document
 * JSON a craft owns via the host's AppData). Present on the ToolContext only for
 * craft-skill tools, scoped to that craft — so a tool can operate the craft's
 * stateful feature (a game board, a saved config) and stay consistent with the
 * craft's own persistence. The schema is the craft's business (it JSON-encodes
 * it itself), exactly like `window.getCraftState()`/`setCraftState()` in a craft.
 */
export interface CraftStateAccess {
    get(): string | undefined
    set(json: string): void
}

/** Context passed to every tool handler. */
export interface ToolContext {
    /** The active LogiSheets workbook client. */
    workbook: WorkbookClient
    /** Abort signal — fires if the user cancels the in-flight turn. */
    signal: AbortSignal
    /**
     * Ask the user to confirm an action; returns true if approved. Under the
     * `Agent` loop this reaches the host's confirm callback with policy
     * 'always', independent of the tool's own `confirmation` gate, which has
     * already passed by the time the handler runs.
     */
    confirm: (message: string, detail?: unknown) => Promise<boolean>
    /** Emit a progress / log line into the chat transcript. */
    log: (msg: string) => void
    /**
     * Persisted state of the craft this tool belongs to, scoped to that craft.
     * Present only for craft-skill tools whose host wired a craftState provider;
     * undefined for the built-in tools and headless hosts. A craft tool that
     * needs it should degrade gracefully when it is absent.
     */
    craftState?: CraftStateAccess
    /**
     * Craft-defined cell-overlay widgets (radio / multi-select / point /
     * percent / slider). Optional: present only when the host has craft
     * interactions (browser app). Absent in headless hosts — craft-
     * interaction tools detect this and return a "not available" result
     * rather than throwing.
     */
    craftInteractions?: CraftInteractionsApi
}

/** Structured result returned by a handler. */
export interface ToolResult<T = unknown> {
    /** Payload shown back to the LLM as `tool_result.content`. */
    data: T
    /** Optional human-readable summary rendered into the chat UI. */
    display?: string
    /**
     * Set when the user declined a confirmation inside the handler. The
     * `Agent` then records `{canceled: true}` as the output and drops `data`.
     */
    canceled?: boolean
}

/**
 * A capability the model can call. `Input` is whatever the model sent — the
 * loop does NOT validate it against `inputSchema`, so a handler must tolerate
 * missing or mistyped fields.
 */
export interface Tool<Input = unknown, Output = unknown> {
    /** First half of the LLM-facing id. [A-Za-z0-9_-] only, no "__". */
    namespace: string
    /** Tool name within the namespace. snake_case. No "__". */
    name: string
    /** One-line description; the model uses this to decide when to call. */
    description: string
    /** JSON Schema for the `input` argument. */
    inputSchema: JSONSchema
    /** Whether this tool mutates workbook state. */
    mutates: boolean
    /** Confirmation policy; defaults to 'never' for reads, 'always' for writes. */
    confirmation?: ConfirmationPolicy
    /** Cost hint; defaults to 'normal'. */
    cost?: ToolCost
    /**
     * Multi-level category path for organizing tools into a tree (e.g.
     * ['Data', 'Write'] or ['Structure', 'Sheets']). Purely organizational —
     * NOT part of the LLM-facing id (`namespace__name`). Optional: when absent,
     * a built-in default taxonomy is used (see tools/taxonomy.ts). A craft tool
     * may set it to slot itself into the tree.
     */
    category?: readonly string[]
    /**
     * Execute the tool. Throw to signal an error to the LLM: the `Agent`
     * catches it and sends `err.message` back as an `is_error` tool_result,
     * so write messages the model can act on.
     */
    handler: (input: Input, ctx: ToolContext) => Promise<ToolResult<Output>>
}

/** Fully-qualified tool id as exposed to the LLM. */
export function toolId(t: Pick<Tool, 'namespace' | 'name'>): string {
    return `${t.namespace}__${t.name}`
}

/**
 * Serialize a tool into the Anthropic `tools` array shape. This is the
 * canonical form the `Agent` hands its `LlmClient`; an OpenAI-wire client
 * translates it itself. `type: 'object'` is forced so a tool may omit it.
 */
export function toLlmTool(t: Tool): {
    name: string
    description: string
    input_schema: JSONSchema
} {
    return {
        name: toolId(t),
        description: t.description,
        input_schema: {type: 'object', ...t.inputSchema},
    }
}

/**
 * In-memory tool registry. Hosts populate this at startup (or lazily) and
 * pass it to the Agent loop, which dispatches by fully-qualified id.
 *
 * The loop re-reads `toLlmTools()` on every request, so tools registered
 * mid-turn (e.g. by `skills__use`) are offered on the very next step.
 */
export class ToolRegistry {
    private tools = new Map<string, Tool>()

    /** Throws if a tool with the same `namespace__name` id is registered. */
    register(tool: Tool): void {
        const id = toolId(tool)
        if (this.tools.has(id))
            throw new Error(`Tool already registered: ${id}`)
        this.tools.set(id, tool)
    }

    registerMany(tools: ReadonlyArray<Tool>): void {
        for (const t of tools) this.register(t)
    }

    unregister(id: string): void {
        this.tools.delete(id)
    }

    /** Look up by fully-qualified id (`namespace__name`), not bare name. */
    get(id: string): Tool | undefined {
        return this.tools.get(id)
    }

    list(): Tool[] {
        return [...this.tools.values()]
    }

    toLlmTools(): ReturnType<typeof toLlmTool>[] {
        return this.list().map(toLlmTool)
    }
}
