import {describe, it, expect, vi} from 'vitest'
import {askAi, AskAiError, type AiRole} from './craft-ai.js'
import type {LlmClient, LlmResponse} from './agent/loop.js'
import type {AgentContentBlock} from './projection.js'
import type {Tool, ToolContext} from './tool.js'

const ROLE: AiRole = {
    name: 'opponent',
    system: 'You play chess as Black.',
    replySchema: {
        type: 'object',
        properties: {uci: {type: 'string'}, plies: {type: 'number'}},
        required: ['uci'],
    },
}

interface SentTurn {
    system: unknown
    tools: {name: string}[]
    messages: unknown
}

/**
 * Replays a canned script of model turns, snapshotting each request. The loop
 * appends to one `messages` array as it goes, so recording the reference would
 * make every turn look like the last one.
 */
function fakeLlm(turns: AgentContentBlock[][]): LlmClient & {sent: SentTurn[]} {
    const sent: SentTurn[] = []
    let i = 0
    return {
        sent,
        async createMessage(params): Promise<LlmResponse> {
            sent.push({
                system: structuredClone(params.system),
                tools: params.tools.map((t) => ({name: t.name})),
                messages: structuredClone(params.messages),
            })
            const content = turns[i++]
            if (!content) throw new Error('fake llm ran out of turns')
            return {
                content,
                stop_reason: content.some((b) => b.type === 'tool_use')
                    ? 'tool_use'
                    : 'end_turn',
            }
        },
    }
}

const use = (
    name: string,
    input: unknown = {},
    id = name
): AgentContentBlock => ({
    type: 'tool_use',
    id,
    name,
    input,
})
const say = (text: string): AgentContentBlock => ({type: 'text', text})

function readTool(name: string, data: unknown, mutates = false): Tool {
    return {
        namespace: 'chess',
        name,
        description: name,
        inputSchema: {type: 'object', properties: {}},
        mutates,
        handler: vi.fn(async () => ({data})),
    }
}

function ctx(signal = new AbortController().signal): ToolContext {
    return {
        workbook: {} as ToolContext['workbook'],
        signal,
        confirm: async () => true,
        log: () => {},
    }
}

const run = (
    llm: LlmClient,
    tools: Tool[] = [],
    over?: Partial<Parameters<typeof askAi>[0]>
) =>
    askAi({
        llm,
        model: 'test',
        role: ROLE,
        input: 'Your move.',
        tools,
        ctx: ctx(),
        ...over,
    })

describe('askAi', () => {
    it('returns the reply the model gives', async () => {
        const llm = fakeLlm([[use('reply', {uci: 'g8f6'})]])
        await expect(run(llm)).resolves.toEqual({uci: 'g8f6'})
    })

    it('lets the model read through the craft tools before answering', async () => {
        const position = readTool('get_position', {fen: 'startpos'})
        const legal = readTool('get_legal_moves', {moves: ['g8f6']})
        const llm = fakeLlm([
            [use('chess__get_position')],
            [use('chess__get_legal_moves')],
            [use('reply', {uci: 'g8f6'})],
        ])

        await expect(run(llm, [position, legal])).resolves.toEqual({
            uci: 'g8f6',
        })
        expect(position.handler).toHaveBeenCalledOnce()
        expect(legal.handler).toHaveBeenCalledOnce()
        // The tool result has to come back as the model's next input.
        expect(JSON.stringify(llm.sent[1].messages)).toContain('startpos')
    })

    it('offers the craft tools plus a reply tool, and nothing else', async () => {
        const llm = fakeLlm([[use('reply', {uci: 'g8f6'})]])
        await run(llm, [readTool('get_position', {})])
        expect(llm.sent[0].tools.map((t) => t.name)).toEqual([
            'chess__get_position',
            'reply',
        ])
    })

    it('refuses a mutating tool rather than letting the model write', async () => {
        const llm = fakeLlm([[use('reply', {uci: 'g8f6'})]])
        await expect(
            run(llm, [readTool('apply_move', {}, true)])
        ).rejects.toThrow(/reads only/)
    })

    it('re-asks once when the reply has the wrong shape', async () => {
        const llm = fakeLlm([
            [use('reply', {plies: 3})], // missing the required uci
            [use('reply', {uci: 'g8f6'})],
        ])
        await expect(run(llm)).resolves.toEqual({uci: 'g8f6'})
        expect(JSON.stringify(llm.sent[1].messages)).toContain(
            'is required but missing'
        )
    })

    it('gives up after a second wrong shape, saying what was wrong', async () => {
        const llm = fakeLlm([
            [use('reply', {uci: 1})],
            [use('reply', {uci: 2})],
        ])
        await expect(run(llm)).rejects.toThrow(
            /"uci" must be a string, got number/
        )
    })

    it('nudges a model that answers in prose, then gives up', async () => {
        const llm = fakeLlm([[say("I'd play Nf6")], [say('Nf6, definitely')]])
        await expect(run(llm)).rejects.toThrow(/never called reply/)
        expect(JSON.stringify(llm.sent[1].messages)).toContain(
            'Answer by calling the reply tool'
        )
    })

    it('hands a failing tool back to the model instead of ending the call', async () => {
        const boom: Tool = {
            ...readTool('get_position', null),
            handler: async () => {
                throw new Error('board not initialized')
            },
        }
        const llm = fakeLlm([
            [use('chess__get_position')],
            [use('reply', {uci: 'g8f6'})],
        ])
        await expect(run(llm, [boom])).resolves.toEqual({uci: 'g8f6'})
        expect(JSON.stringify(llm.sent[1].messages)).toContain(
            'board not initialized'
        )
    })

    it('tells the model when it invents a tool', async () => {
        const llm = fakeLlm([
            [use('chess__get_evaluation')],
            [use('reply', {uci: 'g8f6'})],
        ])
        await expect(run(llm, [readTool('get_position', {})])).resolves.toEqual(
            {
                uci: 'g8f6',
            }
        )
        expect(JSON.stringify(llm.sent[1].messages)).toContain(
            'No tool named chess__get_evaluation'
        )
    })

    it('stops at max_iterations rather than looping on reads', async () => {
        const llm = fakeLlm(
            Array.from({length: 10}, () => [use('chess__get_position')])
        )
        await expect(
            run(llm, [readTool('get_position', {})], {max_iterations: 3})
        ).rejects.toThrow(/did not answer within 3 steps/)
        expect(llm.sent).toHaveLength(3)
    })

    it('aborts when the craft cancels', async () => {
        const ac = new AbortController()
        ac.abort()
        const llm = fakeLlm([[use('reply', {uci: 'g8f6'})]])
        await expect(
            askAi({
                llm,
                model: 'test',
                role: ROLE,
                input: 'Your move.',
                tools: [],
                ctx: ctx(ac.signal),
            })
        ).rejects.toThrow()
        expect(llm.sent).toHaveLength(0)
    })

    it('sends the role system prompt as a cacheable block', async () => {
        const llm = fakeLlm([[use('reply', {uci: 'g8f6'})]])
        await run(llm)
        expect(llm.sent[0].system).toEqual([
            {
                type: 'text',
                text: 'You play chess as Black.',
                cache_control: {type: 'ephemeral'},
            },
        ])
    })

    it('carries no state between calls', async () => {
        const first = fakeLlm([[use('reply', {uci: 'g8f6'})]])
        const second = fakeLlm([[use('reply', {uci: 'b8c6'})]])
        await run(first)
        await run(second)
        // The second call starts from the question alone.
        expect(second.sent[0].messages).toEqual([
            {role: 'user', content: 'Your move.'},
        ])
    })
})

describe('AskAiError', () => {
    it('carries the turn it gave up on', async () => {
        const llm = fakeLlm([[say('nope')], [say('still nope')]])
        await run(llm).catch((e: AskAiError) => {
            expect(e).toBeInstanceOf(AskAiError)
            expect(e.detail).toBe('still nope')
        })
        expect.assertions(2)
    })
})
