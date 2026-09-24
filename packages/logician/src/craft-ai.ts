/**
 * `askAi` — the craft→AI direction.
 *
 * The three craft faces all run inward: something else calls the craft. This is
 * the one that runs outward, so a craft can put a question to a model and get a
 * schema-valid answer: a chess board asking for the opponent's move, a
 * simulator asking what to look at next.
 *
 * Two properties make it different from `Agent`:
 *
 *   - **Stateless.** Nothing survives the call. A craft's state is queryable
 *     from the workbook, so the model re-reads the live position every time
 *     rather than replaying a history that can go stale.
 *   - **Read-only.** The loop is offered the craft's own `@mutates none` tools
 *     and nothing else — no `EDIT_TOOLS`, no workbook surface. The model
 *     gathers; the craft decides what to do with the answer. That is what keeps
 *     an `askAi` retryable and cancellable: abandoning one mid-loop cannot have
 *     half-changed the workbook.
 */

import type {AgentSystemBlock, LlmClient} from './agent/loop.js'
import type {AgentContentBlock, AgentMessage} from './projection.js'
import {
    toLlmTool,
    type JSONSchema,
    type Tool,
    type ToolContext,
} from './tool.js'

/** The reply tool's id. Not namespaced — it is synthetic, not a craft tool. */
const REPLY = 'reply'

/** Safety and cost ceiling: how many times the model may go back for state. */
const DEFAULT_MAX_ITERATIONS = 8

/**
 * Room for one turn's output.
 *
 * Generous because a reasoning model spends nearly all of it on a `thinking`
 * block before it emits anything. Measured against claude-opus-5 deciding a
 * single 四象 draft pick: 1024 was cut off mid-thought every time, and 4096
 * still was. The role's own prompt is what drives this — it says to work the
 * position out rather than be handed a score — so the budget has to cover
 * reasoning, not the answer, which is a few dozen tokens.
 *
 * A role that wants a tighter leash passes its own `max_tokens`.
 */
const DEFAULT_MAX_TOKENS = 16384

/** One question a craft can ask, as `craftsmith` extracted it from `@aiRole`. */
export interface AiRole {
    /** Used only in error messages here; the host selects roles by it. */
    name: string
    /** Sent verbatim as the (cached) system prompt. */
    system: string
    /**
     * Becomes the `reply` tool's input schema. Only checked shallowly: an
     * object, `required` keys present, top-level primitive `type`s and
     * `enum`s — nested shapes are the craft's to validate.
     */
    replySchema: JSONSchema
}

export interface AskAiParams {
    llm: LlmClient
    model: string
    role: AiRole
    /** The question. Not the state — that is what the tools are for. */
    input: string
    /** The craft's read-only tools. A mutating tool here is a caller bug. */
    tools: readonly Tool[]
    /** Context handed to a dispatched craft tool; its `signal` also aborts us. */
    ctx: ToolContext
    /** Per-response output cap. Default 16384 — see DEFAULT_MAX_TOKENS. */
    max_tokens?: number
    /** LLM round-trips allowed, the answering one included. Default 8. */
    max_iterations?: number
}

export class AskAiError extends Error {
    constructor(
        message: string,
        /** The turn the loop gave up on, for a host that wants to log it. */
        readonly detail?: unknown
    ) {
        super(message)
        this.name = 'AskAiError'
    }
}

/**
 * The reply schema as one more tool in the set. It cannot be forced with
 * `tool_choice` — the model has to be free to read first — so termination is
 * this loop's job: it ends when the model calls `reply`.
 */
function replyTool(role: AiRole): ReturnType<typeof toLlmTool> {
    return {
        name: REPLY,
        description:
            'Give your final answer. Call this exactly once, when you have ' +
            'read everything you need.',
        input_schema: {type: 'object', ...role.replySchema},
    }
}

/**
 * Shallow structural check against the reply schema — enough to catch a model
 * that answered with the wrong shape, which is the failure this guards. Deep
 * validation is the craft's business; it knows what a legal move is.
 */
function schemaViolations(schema: JSONSchema, value: unknown): string[] {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return ['the answer must be an object']
    const obj = value as Record<string, unknown>
    const out: string[] = []
    for (const key of schema.required ?? [])
        if (obj[key] === undefined) out.push(`"${key}" is required but missing`)
    for (const [key, spec] of Object.entries(schema.properties ?? {})) {
        const v = obj[key]
        if (v === undefined) continue
        const want = (spec as JSONSchema).type
        const got = Array.isArray(v) ? 'array' : typeof v
        if (want === 'number' && got !== 'number')
            out.push(`"${key}" must be a number, got ${got}`)
        else if (want === 'string' && got !== 'string')
            out.push(`"${key}" must be a string, got ${got}`)
        else if (want === 'boolean' && got !== 'boolean')
            out.push(`"${key}" must be a boolean, got ${got}`)
        else if (want === 'array' && got !== 'array')
            out.push(`"${key}" must be an array, got ${got}`)
        const allowed = (spec as JSONSchema).enum
        if (allowed && !allowed.includes(v as string | number))
            out.push(`"${key}" must be one of ${allowed.join(', ')}`)
    }
    return out
}

function textOf(content: AgentContentBlock[]): string {
    return content
        .filter((b): b is {type: 'text'; text: string} => b.type === 'text')
        .map((b) => b.text)
        .join(' ')
        .trim()
}

/**
 * Run one question to completion and return the model's parsed answer.
 *
 * Throws {@link AskAiError} if `tools` contains a mutating tool (before any
 * request), a response stops at max_tokens, the model answers in prose twice,
 * answers in the wrong shape twice, or runs past `max_iterations`. Anything
 * else is not wrapped: an abort of `ctx.signal` throws the signal's reason
 * and an `LlmClient` rejection propagates. A craft tool that throws does not
 * end the call; the model gets the message as an `is_error` result.
 */
export async function askAi<T = unknown>(params: AskAiParams): Promise<T> {
    const {llm, model, role, input, tools, ctx} = params
    const maxIterations = params.max_iterations ?? DEFAULT_MAX_ITERATIONS

    const mutating = tools.filter((t) => t.mutates)
    if (mutating.length)
        throw new AskAiError(
            `role "${role.name}" was given mutating tool(s) ` +
                `${mutating
                    .map((t) => t.name)
                    .join(', ')}; an askAi loop reads only`
        )

    const byId = new Map(tools.map((t) => [`${t.namespace}__${t.name}`, t]))
    const llmTools = [...tools.map(toLlmTool), replyTool(role)]
    const system: AgentSystemBlock[] = [
        {type: 'text', text: role.system, cache_control: {type: 'ephemeral'}},
    ]
    const messages: AgentMessage[] = [{role: 'user', content: input}]

    let retriedShape = false
    let noAnswerNudges = 0

    for (let i = 0; i < maxIterations; i++) {
        ctx.signal.throwIfAborted()
        const res = await llm.createMessage({
            model,
            system,
            tools: llmTools,
            messages,
            max_tokens: params.max_tokens ?? DEFAULT_MAX_TOKENS,
            signal: ctx.signal,
        })
        messages.push({role: 'assistant', content: res.content})

        // A truncated turn can carry no usable tool call, so left alone it
        // silently spends an iteration and the loop ends up reporting that the
        // model never answered — which is not what went wrong.
        if (res.stop_reason === 'max_tokens')
            throw new AskAiError(
                `role "${role.name}" was cut off at max_tokens ` +
                    `(${params.max_tokens ?? DEFAULT_MAX_TOKENS}) before it ` +
                    `could answer; raise max_tokens for this role`,
                textOf(res.content)
            )

        const calls = res.content.filter(
            (b): b is Extract<AgentContentBlock, {type: 'tool_use'}> =>
                b.type === 'tool_use'
        )

        const answer = calls.find((c) => c.name === REPLY)
        if (answer) {
            const bad = schemaViolations(role.replySchema, answer.input)
            if (!bad.length) return answer.input as T
            if (retriedShape)
                throw new AskAiError(
                    `role "${
                        role.name
                    }" answered in the wrong shape: ${bad.join('; ')}`,
                    answer.input
                )
            retriedShape = true
            messages.push({
                role: 'user',
                content: [
                    {
                        type: 'tool_result',
                        tool_use_id: answer.id,
                        content: `That answer does not fit: ${bad.join(
                            '; '
                        )}. Call ${REPLY} again, corrected.`,
                        is_error: true,
                    },
                ],
            })
            continue
        }

        if (!calls.length) {
            // A turn of prose instead of an answer. Nudge once; a model that
            // still will not use the tool is not going to.
            if (noAnswerNudges++ > 0)
                throw new AskAiError(
                    `role "${role.name}" never called ${REPLY}`,
                    textOf(res.content)
                )
            messages.push({
                role: 'user',
                content: `Answer by calling the ${REPLY} tool.`,
            })
            continue
        }

        const results: AgentContentBlock[] = []
        for (const call of calls) {
            const tool = byId.get(call.name)
            if (!tool) {
                results.push({
                    type: 'tool_result',
                    tool_use_id: call.id,
                    content: `No tool named ${call.name}.`,
                    is_error: true,
                })
                continue
            }
            try {
                const out = await tool.handler(call.input, ctx)
                results.push({
                    type: 'tool_result',
                    tool_use_id: call.id,
                    content: JSON.stringify(out.data ?? null),
                })
            } catch (e) {
                // The model gets the reason and can try a different read; only
                // the loop's own limits end the call.
                results.push({
                    type: 'tool_result',
                    tool_use_id: call.id,
                    content: e instanceof Error ? e.message : String(e),
                    is_error: true,
                })
            }
        }
        messages.push({role: 'user', content: results})
    }

    throw new AskAiError(
        `role "${role.name}" did not answer within ${maxIterations} steps`
    )
}
