import {describe, it, expect, beforeEach} from 'vitest'
import {handle} from '../wasm/logisheets_wasm_server'
import {
    Game,
    type GameClient,
} from '../../../crafts/four-elements-core/src/game'
import {ELEMENTS} from '../../../crafts/four-elements-core/src/sheet'
import {PLACEMENT, cellOf} from '../../../crafts/four-elements-core/src/setup'
import {fieldLabel} from '../../../crafts/four-elements-core/src/i18n'

// Step 2: the driver. It reads `turn`, writes one cell, and knows no rules —
// these assert that it stays that way and that the engine backs it up.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (m: string, v?: Record<string, unknown>, b?: number): any =>
    handle(v === undefined ? m : {method: m, value: v}, b ?? null)

/** The real engine behind the narrow surface `Game` asks for. */
function clientFor(bookId: number): GameClient {
    return {
        async handleTransaction(req) {
            return rpc('handleTransaction', req as never, bookId)
        },
        async getCell(req) {
            return rpc('getCell', req as never, bookId)
        },
    }
}

/** Deterministic, so a failure is reproducible. */
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

describe('Game', () => {
    let game: Game

    beforeEach(async () => {
        const bookId = rpc('newWorkbook') as number
        game = new Game(clientFor(bookId), 0)
        await game.newGame(mulberry(11))
    })

    it('builds a sheet that is ready to play', async () => {
        expect(await game.isBuilt()).toBe(true)
        const t = await game.turn()
        expect(t).toEqual({
            phase: 'draft',
            toMove: 'you',
            round: 1,
            nextSlot: 1,
        })
    })

    it('offers three cards and refuses one that is not offered', async () => {
        const offer = (await game.state()).offer
        expect(offer).toHaveLength(3)
        const notOffered = ELEMENTS.find((e) => !offer.includes(e))
        if (notOffered)
            await expect(game.commit(notOffered)).rejects.toThrow(
                /not left on offer/
            )
    })

    it('passes the move to the AI after the player drafts', async () => {
        const offer = (await game.state()).offer
        await game.commit(offer[0] as never)
        expect((await game.turn()).toMove).toBe('ai')
    })

    it('refuses to commit a card that is not in hand', async () => {
        // Draft five of whatever is offered, then try to play something else.
        for (let r = 0; r < 5; r++)
            for (let s = 0; s < 2; s++) {
                const {offer} = await game.state()
                await game.commit(offer[s] as never)
            }
        expect((await game.turn()).phase).toBe('play')
        const held = await game.legal()
        const notHeld = ELEMENTS.find((e) => !held.includes(e))
        if (notHeld)
            await expect(game.commit(notHeld)).rejects.toThrow(/no .* in hand/)
    })

    it('refuses a move once the game is over', async () => {
        await playOut(game)
        expect((await game.turn()).phase).toBe('done')
        await expect(game.commit('fire')).rejects.toThrow(/game is over/)
    })

    it('reports a settled score with both lines full', async () => {
        await playOut(game)
        const s = await game.state()
        expect(s.board.you.filter(Boolean)).toHaveLength(5)
        expect(s.board.ai.filter(Boolean)).toHaveLength(5)
        expect(s.score.you.total).toBe(s.score.you.cards + s.score.you.forms)
        expect(s.windows).toHaveLength(3)
    })

    it('empties both hands by the end', async () => {
        await playOut(game)
        const s = await game.state()
        expect(Object.keys(s.hand.you)).toHaveLength(0)
        expect(Object.keys(s.hand.ai)).toHaveLength(0)
    })

    // The offer is a multiset — [wind, water, wind] is a real round — so the
    // leader taking the single water must leave the follower only wind.
    it('shrinks the offer by the copy taken, not by the element', async () => {
        const offer = (await game.state()).offer
        const once = offer.find(
            (c) => offer.filter((o) => o === c).length === 1
        )
        // Only meaningful on a round that actually has a duplicate.
        if (!once) return
        await game.commit(once as never)
        expect(await game.legal()).not.toContain(once)
        await expect(game.commit(once as never)).rejects.toThrow(
            /not left on offer/
        )
    })

    it('never lets a round be drafted more times than it has cards', async () => {
        // Five rounds x two picks must exactly exhaust the draft.
        for (let i = 0; i < 10; i++) {
            const legal = await game.legal()
            expect(legal.length).toBeGreaterThan(0)
            await game.commit(legal[0])
        }
        expect((await game.turn()).phase).toBe('play')
    })
})

describe('re-dealing', () => {
    let game: Game
    let client: GameClient

    beforeEach(async () => {
        const bookId = rpc('newWorkbook') as number
        client = clientFor(bookId)
        game = new Game(client, 0)
        await game.newGame(mulberry(7))
    })

    it('deals again onto a sheet that already holds a game', async () => {
        await playOut(game)
        await game.newGame(mulberry(8))
        const s = await game.state()
        expect(s.turn.phase).toBe('draft')
        expect(s.board.you.join('')).toBe('')
        expect(s.board.ai.join('')).toBe('')
        expect(s.score.you.total).toBe(0)
        expect(s.score.ai.total).toBe(0)
    })

    // The point of the craft is that the rules are the player's to change; a
    // re-deal rebuilding the blocks would quietly undo every edit they made.
    it('keeps an edited rule across a deal', async () => {
        const {row, col} = cellOf('counter', 'fire>wind', 'pts')
        await client.handleTransaction({
            transaction: {
                payloads: [
                    {
                        type: 'cellInput',
                        value: {sheetIdx: 0, row, col, content: '9'},
                    },
                ],
                undoable: true,
                temp: false,
            },
        })
        await game.newGame(mulberry(9))
        const rules = await game.rules()
        expect(rules.counter.find((c) => c.pair === 'fire>wind')?.pts).toBe(9)
    })
})

describe("the sheet's language", () => {
    let game: Game
    let client: GameClient
    let bookId: number

    beforeEach(async () => {
        bookId = rpc('newWorkbook') as number
        client = clientFor(bookId)
        game = new Game(client, 0)
        await game.newGame(mulberry(4))
    })

    const at = (ref: string, key: string | number, field: string) => {
        const {row, col} = cellOf(ref, key, field)
        return rpc('getCell', {sheetIdx: 0, row, col}, bookId)?.value?.value
    }

    // The whole reason the sheet is localised through header text and enum
    // LABELS rather than by translating the data: a language switch must be
    // safe with a game in progress.
    it('changes language without moving a single game value', async () => {
        for (let i = 0; i < 12; i++) {
            const legal = await game.legal()
            if (!legal.length) break
            await game.commit(legal[0])
        }
        const before = await game.state()
        const keysBefore = [
            at('counter', 'fire>wind', 'pair'),
            at('formation', 'triple', 'shape'),
            at('knob', 'cancelKeep', 'name'),
            at('play', 1, 'you'),
            at('turn', 't', 'phase'),
        ]

        await game.relabel('zh-CN')

        // Every key, value and derived number is untouched...
        expect(await game.state()).toEqual(before)
        expect([
            at('counter', 'fire>wind', 'pair'),
            at('formation', 'triple', 'shape'),
            at('knob', 'cancelKeep', 'name'),
            at('play', 1, 'you'),
            at('turn', 't', 'phase'),
        ]).toEqual(keysBefore)
        // ...and the game is still playable, which a broken key would stop.
        expect((await game.legal()).length).toBeGreaterThan(0)
    })

    it('rewrites the header line into the new language', async () => {
        const headerOf = (ref: string, col: number) => {
            const row = PLACEMENT.get(ref)!.row
            return rpc('getCell', {sheetIdx: 0, row, col}, bookId)?.value?.value
        }
        expect(headerOf('counter', 0)).toBe(fieldLabel('pair', 'en'))
        await game.relabel('zh-CN')
        expect(headerOf('counter', 0)).toBe(fieldLabel('pair', 'zh-CN'))
        expect(headerOf('counter', 0)).not.toBe('pair')
    })
})

/** Play a whole game by always taking the first legal card. */
async function playOut(game: Game): Promise<void> {
    for (let i = 0; i < 40; i++) {
        if ((await game.turn()).phase === 'done') return
        const legal = await game.legal()
        expect(legal.length).toBeGreaterThan(0)
        await game.commit(legal[0])
    }
    throw new Error('game did not terminate')
}
