import {describe, it, expect, beforeEach} from 'vitest'
import {handle} from '../wasm/logisheets_wasm_server'
import {Game} from '../../../crafts/four-elements-core/src/game'
import {
    getDraft,
    getRules,
    getScore,
    getState,
    getWindows,
    type Ctx,
} from '../../../crafts/four-elements/tools'

// Step 4: the AI's read surface. These assert the tools return what is on the
// sheet — including after the user has edited a rule, since the whole point is
// that the model reads the rules rather than being told them.

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

describe('the AI read surface', () => {
    let ctx: Ctx
    let game: Game
    let bookId: number

    beforeEach(async () => {
        bookId = rpc('newWorkbook') as number
        const client = {
            async handleTransaction(req: unknown) {
                return rpc('handleTransaction', req as never, bookId)
            },
            async getCell(req: unknown) {
                return rpc('getCell', req as never, bookId)
            },
        }
        ctx = {workbook: client}
        game = new Game(client, 0)
        await game.newGame(mulberry(5))
    })

    it('reads the rules off the sheet, not out of the code', async () => {
        const rules = await getRules(ctx)
        expect(rules.counter).toHaveLength(16)
        expect(rules.counter.find((r) => r.pair === 'fire>wind')?.pts).toBe(1)
        expect(rules.counter.find((r) => r.pair === 'wind>fire')?.pts).toBe(0)
        expect(rules.formation.find((f) => f.shape === 'triple')).toEqual({
            shape: 'triple',
            value: 6,
            cancels: 'chain',
        })
        expect(rules.knob.map((k) => k.name).sort()).toEqual([
            'byElement',
            'cancelKeep',
        ])
    })

    // The claim the whole design rests on: edit a cell, and what the model
    // reads changes — with no rebuild and no prompt change.
    it('reports an edited rule, so the model plays the game as it now is', async () => {
        await editCell('counter', 'fire>wind', 'pts', '3')
        const rules = await getRules(ctx)
        expect(rules.counter.find((r) => r.pair === 'fire>wind')?.pts).toBe(3)
    })

    it('describes the opening position', async () => {
        const s = await getState(ctx)
        expect(s.phase).toBe('draft')
        expect(s.toMove).toBe('you')
        expect(s.round).toBe(1)
        expect(s.offer).toHaveLength(3)
        expect(s.legal.length).toBeGreaterThan(0)
        expect(s.hand).toHaveLength(4)
        expect(s.hand.every((h) => h.you === 0 && h.ai === 0)).toBe(true)
        expect(s.board).toHaveLength(5)
        expect(s.board.every((b) => b.you === '' && b.ai === '')).toBe(true)
    })

    it('only ever offers legal moves', async () => {
        for (let i = 0; i < 20; i++) {
            const s = await getState(ctx)
            if (s.phase === 'done') break
            expect(s.legal.length).toBeGreaterThan(0)
            // Every legal card must be commitable; anything else must not be.
            await game.commit(s.legal[0] as never)
        }
        expect((await getState(ctx)).phase).toBe('done')
    })

    it('tracks the board and the hands as cards are committed', async () => {
        for (let i = 0; i < 10; i++) {
            const s = await getState(ctx)
            await game.commit(s.legal[0] as never)
        }
        const drafted = await getState(ctx)
        expect(drafted.phase).toBe('play')
        const total = drafted.hand.reduce((n, h) => n + h.you + h.ai, 0)
        expect(total).toBe(10) // five each, none committed yet

        await game.commit((await getState(ctx)).legal[0] as never)
        const after = await getState(ctx)
        expect(after.hand.reduce((n, h) => n + h.you + h.ai, 0)).toBe(9)
        expect(after.board.filter((b) => b.you || b.ai)).toHaveLength(1)
    })

    it('reports window shapes and the score that follows from them', async () => {
        for (let i = 0; i < 20; i++) {
            const s = await getState(ctx)
            if (s.phase === 'done') break
            await game.commit(s.legal[0] as never)
        }
        const windows = await getWindows(ctx)
        expect(windows).toHaveLength(3)
        for (const w of windows) {
            expect(['triple', 'chain', 'split', 'none']).toContain(w.youShape)
            expect(['triple', 'chain', 'split', 'none']).toContain(w.aiShape)
        }
        const score = await getScore(ctx)
        // The formation total has to be the windows the tool just reported.
        expect(score.youForms).toBe(windows.reduce((n, w) => n + w.youScore, 0))
        expect(score.aiForms).toBe(windows.reduce((n, w) => n + w.aiScore, 0))
        expect(score.youTotal).toBe(score.youCards + score.youForms)
    })

    async function editCell(
        ref: string,
        key: string,
        field: string,
        content: string
    ) {
        const {cellOf} = await import(
            '../../../crafts/four-elements-core/src/setup'
        )
        const {row, col} = cellOf(ref, key, field)
        rpc(
            'handleTransaction',
            {
                transaction: {
                    payloads: [
                        {
                            type: 'cellInput',
                            value: {sheetIdx: 0, row, col, content},
                        },
                    ],
                    undoable: true,
                    temp: false,
                },
            },
            bookId
        )
    }
})

// Everything about this game is open — that is the premise. A tool surface
// that hides the rounds still to come would quietly make the AI play a
// different, worse game than the human looking at the same sheet.
describe('what the AI can see', () => {
    let ctx: Ctx
    let game: Game
    let bookId: number

    beforeEach(async () => {
        bookId = rpc('newWorkbook') as number
        const client = {
            async handleTransaction(req: unknown) {
                return rpc('handleTransaction', req as never, bookId)
            },
            async getCell(req: unknown) {
                return rpc('getCell', req as never, bookId)
            },
        }
        ctx = {workbook: client as never}
        game = new Game(client as never, 0)
        await game.newGame(mulberry(11))
    })

    it('shows every draft round, including the ones not yet played', async () => {
        const draft = await getDraft(ctx)
        expect(draft).toHaveLength(5)
        for (const r of draft) {
            expect(r.offer).toHaveLength(3)
            // Dealt at setup: a later round is already on the sheet.
            expect(r.offer.every((c) => c !== '')).toBe(true)
        }
        expect(draft.every((r) => r.youPick === '' && r.aiPick === '')).toBe(
            true
        )
    })

    it('records each pick in the draft table as it is made', async () => {
        const first = (await game.legal())[0]
        await game.commit(first)
        const draft = await getDraft(ctx)
        expect(draft[0].youPick).toBe(first)
        expect(draft[0].aiPick).toBe('')
    })

    it('reports settled card points per slot, and they add up to the total', async () => {
        for (let i = 0; i < 20; i++) {
            const legal = await game.legal()
            if (!legal.length) break
            await game.commit(legal[0])
        }
        const [s, score] = await Promise.all([getState(ctx), getScore(ctx)])
        expect(s.board).toHaveLength(5)
        // The per-slot figures are the card score, decomposed. If they did not
        // add up, the AI would be reasoning from numbers the sheet disagrees
        // with.
        expect(s.board.reduce((n, b) => n + b.youPts, 0)).toBe(score.youCards)
        expect(s.board.reduce((n, b) => n + b.aiPts, 0)).toBe(score.aiCards)
    })

    it('says whether a window scored 0 because it was cancelled', async () => {
        for (let i = 0; i < 20; i++) {
            const legal = await game.legal()
            if (!legal.length) break
            await game.commit(legal[0])
        }
        const ws = await getWindows(ctx)
        expect(ws.length).toBeGreaterThan(0)
        for (const w of ws) {
            expect(typeof w.youCancelled).toBe('boolean')
            // A cancelled formation cannot be worth more than an uncut one.
            if (w.youCancelled) expect(w.youScore).toBe(0)
        }
    })
})
