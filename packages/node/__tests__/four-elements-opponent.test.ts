import {describe, it, expect, beforeEach, vi} from 'vitest'
import {handle} from '../wasm/logisheets_wasm_server'
import {Game} from '../../../crafts/four-elements-core/src/game'
import {
    AiRefused,
    takeAiTurn,
    type AskFn,
} from '../../../crafts/four-elements-core/src/opponent'

// Step 5: the model proposes, the craft decides. The model is a stub here —
// what is under test is the craft's half: validating an answer against the
// sheet, re-asking with a reason, and refusing to write a bad move.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (m: string, v?: Record<string, unknown>, b?: number): any =>
    handle(v === undefined ? m : {method: m, value: v}, b ?? null)

function mulberry(seed: number): () => number {
    let a = seed
    return () => {
        a |= 0
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

/** Replays canned answers, and records the questions it was asked. */
function stubAsk(answers: unknown[]): AskFn & {asked: string[]} {
    const asked: string[] = []
    let i = 0
    const fn = (async (_role: string, input: string) => {
        asked.push(input)
        if (i >= answers.length) throw new Error('stub ran out of answers')
        return answers[i++]
    }) as AskFn & {asked: string[]}
    fn.asked = asked
    return fn
}

describe('takeAiTurn', () => {
    let game: Game

    beforeEach(async () => {
        const bookId = rpc('newWorkbook') as number
        game = new Game(
            {
                async handleTransaction(req) {
                    return rpc('handleTransaction', req as never, bookId)
                },
                async getCell(req) {
                    return rpc('getCell', req as never, bookId)
                },
            },
            0
        )
        await game.newGame(mulberry(5))
        // The player leads the draft; hand the move to the AI.
        await game.commit((await game.legal())[0])
    })

    it('commits a legal answer and reports the taunt', async () => {
        const legal = await game.legal()
        const ask = stubAsk([{card: legal[0], taunt: 'Read and answered.'}])
        const out = await takeAiTurn(game, ask)
        expect(out).toEqual({
            card: legal[0],
            taunt: 'Read and answered.',
            tries: 1,
        })
        // It really went to the sheet.
        expect((await game.turn()).toMove).toBe('you')
    })

    it('tells the model what is legal after an illegal answer', async () => {
        const legal = await game.legal()
        const bad = ['fire', 'wind', 'earth', 'water'].find(
            (e) => !legal.includes(e as never)
        )!
        const ask = stubAsk([{card: bad}, {card: legal[0]}])
        const out = await takeAiTurn(game, ask)
        expect(out.tries).toBe(2)
        expect(ask.asked[1]).toContain(`${bad} is not legal here`)
        expect(ask.asked[1]).toContain(legal.join(', '))
    })

    it('re-asks when the answer is not a card at all', async () => {
        const legal = await game.legal()
        const ask = stubAsk([{card: 'lightning'}, {card: legal[0]}])
        const out = await takeAiTurn(game, ask)
        expect(out.tries).toBe(2)
        expect(ask.asked[1]).toContain('is not a card')
    })

    it('gives up rather than writing a bad move', async () => {
        const ask = stubAsk([{}, {}, {}])
        await expect(takeAiTurn(game, ask)).rejects.toThrow(AiRefused)
        // Nothing was written: it is still the AI's move.
        expect((await game.turn()).toMove).toBe('ai')
    })

    it('refuses when it is not the AI to move', async () => {
        const legal = await game.legal()
        await takeAiTurn(game, stubAsk([{card: legal[0]}]))
        expect((await game.turn()).toMove).toBe('you')
        await expect(
            takeAiTurn(game, stubAsk([{card: 'fire'}]))
        ).rejects.toThrow(/not the AI to move/)
    })

    it('carries the caller note into the question, and spends less on a draft', async () => {
        const legal = await game.legal()
        const ask = vi.fn(async () => ({card: legal[0]})) as unknown as AskFn
        await takeAiTurn(game, ask, {note: 'Play at club level.'})
        const call = (ask as unknown as {mock: {calls: unknown[][]}}).mock
            .calls[0]
        expect(call[0]).toBe('opponent')
        expect(call[1]).toContain('Draft round 1.')
        expect(call[1]).toContain('Play at club level.')
        expect(call[2]).toMatchObject({tier: 'fast'})
    })

    it('plays a whole game against a stub that always takes the first legal card', async () => {
        for (let i = 0; i < 40; i++) {
            const t = await game.turn()
            if (t.phase === 'done') break
            const legal = await game.legal()
            if (t.toMove === 'ai')
                await takeAiTurn(game, stubAsk([{card: legal[0]}]))
            else await game.commit(legal[0])
        }
        expect((await game.turn()).phase).toBe('done')
    })
})
