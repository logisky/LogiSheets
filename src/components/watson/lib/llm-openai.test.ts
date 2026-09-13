import {describe, expect, it} from 'vitest'
import type {AgentMessage} from 'logisheets-logician'
import {toLlmResponse, toWireMessages} from './llm-openai'

/**
 * The translation between logician's Anthropic-shaped agent IR and OpenAI's
 * `/chat/completions`. Everything here is a place the two formats disagree,
 * and every disagreement silently breaks a turn rather than raising.
 */

describe('toWireMessages', () => {
    it('keeps a plain user message', () => {
        const m: AgentMessage = {role: 'user', content: 'total the column'}
        expect(toWireMessages(m)).toEqual([
            {role: 'user', content: 'total the column'},
        ])
    })

    it('turns an assistant turn into text plus tool_calls', () => {
        const m: AgentMessage = {
            role: 'assistant',
            content: [
                {type: 'text', text: 'Reading the block first.'},
                {
                    type: 'tool_use',
                    id: 'call_1',
                    name: 'build__describe_block',
                    input: {name: 'orders'},
                },
            ],
        }
        expect(toWireMessages(m)).toEqual([
            {
                role: 'assistant',
                content: 'Reading the block first.',
                tool_calls: [
                    {
                        id: 'call_1',
                        type: 'function',
                        function: {
                            name: 'build__describe_block',
                            // A JSON *string*, not an object — the single most
                            // common way this translation is got wrong.
                            arguments: '{"name":"orders"}',
                        },
                    },
                ],
            },
        ])
    })

    it('sends null content for a tool-only assistant turn', () => {
        const m: AgentMessage = {
            role: 'assistant',
            content: [
                {type: 'tool_use', id: 'c', name: 'history__undo', input: {}},
            ],
        }
        const [msg] = toWireMessages(m) as Array<{content: string | null}>
        expect(msg.content).toBeNull()
    })

    it('splits a turn of tool results into one message each', () => {
        // Anthropic packs every result into one user message; OpenAI wants one
        // `role: "tool"` message per call, tagged with its id. A turn with two
        // parallel calls and one message would leave a call unanswered.
        const m: AgentMessage = {
            role: 'user',
            content: [
                {type: 'tool_result', tool_use_id: 'a', content: '{"ok":1}'},
                {type: 'tool_result', tool_use_id: 'b', content: '{"ok":2}'},
            ],
        }
        expect(toWireMessages(m)).toEqual([
            {role: 'tool', tool_call_id: 'a', content: '{"ok":1}'},
            {role: 'tool', tool_call_id: 'b', content: '{"ok":2}'},
        ])
    })

    it('puts text alongside tool results after them', () => {
        const m: AgentMessage = {
            role: 'user',
            content: [
                {type: 'tool_result', tool_use_id: 'a', content: 'done'},
                {type: 'text', text: 'now chart it'},
            ],
        }
        expect(toWireMessages(m)).toEqual([
            {role: 'tool', tool_call_id: 'a', content: 'done'},
            {role: 'user', content: 'now chart it'},
        ])
    })

    it('drops an empty turn rather than sending a blank message', () => {
        expect(toWireMessages({role: 'assistant', content: []})).toEqual([])
        expect(toWireMessages({role: 'user', content: ''})).toEqual([])
    })
})

describe('toLlmResponse', () => {
    it('reads text and finishes the turn', () => {
        const r = toLlmResponse({
            choices: [{message: {content: 'All set.'}, finish_reason: 'stop'}],
        })
        expect(r.content).toEqual([{type: 'text', text: 'All set.'}])
        expect(r.stop_reason).toBe('end_turn')
    })

    it('parses tool arguments back into an object', () => {
        const r = toLlmResponse({
            choices: [
                {
                    message: {
                        content: null,
                        tool_calls: [
                            {
                                id: 'call_9',
                                type: 'function',
                                function: {
                                    name: 'cell__set_cells',
                                    arguments: '{"sheetIdx":0}',
                                },
                            },
                        ],
                    },
                    finish_reason: 'tool_calls',
                },
            ],
        })
        expect(r.content).toEqual([
            {
                type: 'tool_use',
                id: 'call_9',
                name: 'cell__set_cells',
                input: {sheetIdx: 0},
            },
        ])
        expect(r.stop_reason).toBe('tool_use')
    })

    it('reports tool_use even when the provider said "stop"', () => {
        // Several providers do exactly this. Believing them ends the turn
        // with the tool results never sent, and the user sees the agent
        // announce work it never did.
        const r = toLlmResponse({
            choices: [
                {
                    message: {
                        content: 'Setting that now.',
                        tool_calls: [
                            {
                                id: 'c',
                                type: 'function',
                                function: {
                                    name: 'cell__set_cells',
                                    arguments: '{}',
                                },
                            },
                        ],
                    },
                    finish_reason: 'stop',
                },
            ],
        })
        expect(r.stop_reason).toBe('tool_use')
    })

    it('maps a truncated response to max_tokens', () => {
        const r = toLlmResponse({
            choices: [
                {message: {content: 'half a sen'}, finish_reason: 'length'},
            ],
        })
        expect(r.stop_reason).toBe('max_tokens')
    })

    it('survives malformed tool arguments', () => {
        // The tool's own validation rejects this with a message the model can
        // act on; throwing here would take the whole turn down instead.
        const r = toLlmResponse({
            choices: [
                {
                    message: {
                        tool_calls: [
                            {
                                id: 'c',
                                type: 'function',
                                function: {
                                    name: 'cell__set_cells',
                                    arguments: '{oops',
                                },
                            },
                        ],
                    },
                    finish_reason: 'tool_calls',
                },
            ],
        })
        expect(r.content[0]).toMatchObject({
            type: 'tool_use',
            input: {_malformed_arguments: '{oops'},
        })
    })

    it('reads usage, including the cache hit', () => {
        const r = toLlmResponse({
            choices: [{message: {content: 'hi'}, finish_reason: 'stop'}],
            usage: {
                prompt_tokens: 120,
                completion_tokens: 8,
                prompt_tokens_details: {cached_tokens: 100},
            },
        })
        expect(r.usage).toEqual({
            input_tokens: 120,
            output_tokens: 8,
            cache_read_input_tokens: 100,
        })
    })

    it('does not crash on an empty choices array', () => {
        const r = toLlmResponse({choices: []})
        expect(r.content).toEqual([])
        expect(r.stop_reason).toBe('end_turn')
    })
})
