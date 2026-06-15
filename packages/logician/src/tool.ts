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
 *   - Tools are grouped under a `namespace` (e.g. "block", "craft.what_if")
 *     so the final tool name exposed to the LLM is `${namespace}__${name}`.
 *     This keeps capabilities from different crafts from colliding.
 */

import type {Client} from 'logisheets-web'

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

/** Confirmation policy for a tool invocation. */
export type ConfirmationPolicy =
    | 'never' // pure read, no prompt
    | 'once' // ask once per session, then remember
    | 'always' // ask every call
    | 'destructive' // ask every call, with a "destructive" UI affordance

/** Hint to the model (and to the scheduler) about cost. */
export type ToolCost = 'cheap' | 'normal' | 'expensive'

/** Context passed to every tool handler. */
export interface ToolContext {
    /** The active LogiSheets workbook client. */
    workbook: WorkbookClient
    /** Abort signal — fires if the user cancels the in-flight turn. */
    signal: AbortSignal
    /** Ask the user to confirm an action; returns true if approved. */
    confirm: (message: string, detail?: unknown) => Promise<boolean>
    /** Emit a progress / log line into the chat transcript. */
    log: (msg: string) => void
}

/** Structured result returned by a handler. */
export interface ToolResult<T = unknown> {
    /** Payload shown back to the LLM as `tool_result.content`. */
    data: T
    /** Optional human-readable summary rendered into the chat UI. */
    display?: string
    /** Set when the user declined a confirmation. */
    canceled?: boolean
}

export interface Tool<Input = unknown, Output = unknown> {
    // reserved
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
    /** Execute the tool. Throw to signal an error to the LLM. */
    handler: (input: Input, ctx: ToolContext) => Promise<ToolResult<Output>>
}

/** Fully-qualified tool id as exposed to the LLM. */
export function toolId(t: Pick<Tool, 'namespace' | 'name'>): string {
    return `${t.namespace}__${t.name}`
}

/** Serialize a tool into the Anthropic `tools` array shape. */
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
 */
export class ToolRegistry {
    private tools = new Map<string, Tool>()

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
