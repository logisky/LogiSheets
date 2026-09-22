/**
 * Driving a game — the whole of it.
 *
 * Read `turn` to learn whose move it is and where it goes, write one cell,
 * let the engine recompute. Nothing here knows what a Triple is worth, who
 * leads a phase, or when the game ends: those are formulas (see `sheet.ts`).
 *
 * The only rule-shaped thing in this file is the shuffle, and a shuffle is a
 * seed.
 */

import {BLOCKS, ELEMENTS, DRAFT_ROUNDS, OFFER, type Element} from './sheet'
import {
    cellOf,
    relabelPayloads,
    resetPayloads,
    setupPayloads,
    shufflePayloads,
    writePayload,
} from './setup'
import type {SheetLocale} from './i18n'

/** All a reader needs — and all the AI tools are ever handed. */
export interface CellReader {
    getCell(req: {sheetIdx: number; row: number; col: number}): Promise<unknown>
}

/** A reader, plus the one write the craft makes. */
export interface GameClient extends CellReader {
    handleTransaction(req: {
        transaction: {
            payloads: readonly unknown[]
            undoable: boolean
            temp: boolean
        }
    }): Promise<unknown>
}

export type Phase = 'draft' | 'play' | 'done'
export type Side = 'you' | 'ai'

export interface Turn {
    phase: Phase
    toMove: Side | ''
    /** Draft round, 1-based. Meaningless outside the draft phase. */
    round: number
    /** Play slot, 1-based. Meaningless outside the play phase. */
    nextSlot: number
}

export interface Rules {
    counter: {pair: string; pts: number}[]
    formation: {shape: string; value: number; cancels: string}[]
    knob: {name: string; value: number}[]
}

export interface DraftRound {
    round: number
    /** The three cards revealed that round; a card may appear twice. */
    offer: string[]
    /** `''` until that side has taken its card. */
    youPick: string
    aiPick: string
}

export interface GameState {
    turn: Turn
    /** This round's three revealed cards. Empty outside the draft. */
    offer: string[]
    /** Cards drafted and not yet committed, per side. */
    hand: Record<Side, Partial<Record<Element, number>>>
    /** The two lines, slot 1..5. `''` where nothing is committed. */
    board: Record<Side, string[]>
    /** What each slot has already settled for, head to head, per `counter`. */
    slotPts: Record<Side, number[]>
    windows: {
        w: number
        you: string
        ai: string
        /** True when the opposite shape cancelled this one. */
        youCancelled: boolean
        aiCancelled: boolean
        youScore: number
        aiScore: number
    }[]
    score: Record<Side, {cards: number; forms: number; total: number}>
}

const num = (v: unknown): number => (typeof v === 'number' ? v : 0)
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/**
 * Everything the sheet can be asked. Separate from {@link Game} so the AI
 * tools can hold a surface that structurally cannot write: the model gathers,
 * the craft acts.
 */
export class GameReader {
    constructor(
        protected readonly client: CellReader,
        protected readonly sheetIdx: number
    ) {}

    protected async read(
        ref: string,
        key: string | number,
        field: string
    ): Promise<unknown> {
        const {row, col} = cellOf(ref, key, field)
        const cell = (await this.client.getCell({
            sheetIdx: this.sheetIdx,
            row,
            col,
        })) as {value?: {value?: unknown}} | undefined
        return cell?.value?.value
    }

    /** MARKER:READS */

    /** Whether this sheet already holds a game. */
    async isBuilt(): Promise<boolean> {
        try {
            return (await this.read('formation', 'triple', 'value')) === 6
        } catch {
            return false
        }
    }

    async turn(): Promise<Turn> {
        const [phase, toMove, round, nextSlot] = await Promise.all([
            this.read('turn', 't', 'phase'),
            this.read('turn', 't', 'toMove'),
            this.read('turn', 't', 'round'),
            this.read('turn', 't', 'nextSlot'),
        ])
        return {
            phase: str(phase) as Phase,
            toMove: str(toMove) as Side | '',
            round: num(round),
            nextSlot: num(nextSlot),
        }
    }

    /**
     * The rules as the sheet currently states them. Read back rather than
     * returned from the definitions in `sheet.ts`: the player may have edited
     * any of it, and the definitions are only the opening position.
     */
    async rules(): Promise<Rules> {
        const rows = (ref: string) =>
            BLOCKS.find((b) => b.ref === ref)!.rows.map((r) => String(r[0]))
        const [counter, formation, knob] = await Promise.all([
            Promise.all(
                rows('counter').map(async (pair) => ({
                    pair,
                    pts: num(await this.read('counter', pair, 'pts')),
                }))
            ),
            Promise.all(
                rows('formation').map(async (shape) => ({
                    shape,
                    value: num(await this.read('formation', shape, 'value')),
                    cancels: str(
                        await this.read('formation', shape, 'cancels')
                    ),
                }))
            ),
            Promise.all(
                rows('knob').map(async (name) => ({
                    name,
                    value: num(await this.read('knob', name, 'value')),
                }))
            ),
        ])
        return {counter, formation, knob}
    }

    /** What the side to move may legally commit right now. */
    async legal(): Promise<Element[]> {
        const turn = await this.turn()
        if (turn.phase === 'draft') {
            const left = await this.remainingOffer(turn)
            return ELEMENTS.filter((e) => left.includes(e))
        }
        if (turn.phase !== 'play' || !turn.toMove) return []
        const side = turn.toMove
        const counts = await Promise.all(
            ELEMENTS.map((e) => this.read('hand', e, side).then(num))
        )
        return ELEMENTS.filter((_, i) => counts[i] > 0)
    }

    /**
     * The whole draft, every round: what was offered and what each side took.
     *
     * All five rounds are cut from `deck`, which is dealt in full at setup —
     * so the rounds still to come are already on the sheet and a player can
     * see them. Nothing here is hidden from the AI either; the game is
     * transparent by design, and drafting well means reading ahead.
     */
    async draft(): Promise<DraftRound[]> {
        const rounds = BLOCKS.find((b) => b.ref === 'draft')!.rows.length
        return Promise.all(
            Array.from({length: rounds}, async (_, i) => {
                const round = i + 1
                const [offer, you, ai] = await Promise.all([
                    Promise.all(
                        Array.from({length: OFFER}, (_, k) =>
                            this.read('draft', round, `offer${k + 1}`).then(str)
                        )
                    ),
                    this.read('draft', round, 'youPick').then(str),
                    this.read('draft', round, 'aiPick').then(str),
                ])
                return {round, offer, youPick: you, aiPick: ai}
            })
        )
    }

    /** Everything on the sheet, as one read. */
    async state(): Promise<GameState> {
        const turn = await this.turn()
        const [offer, hand, board, slotPts, windows, score] = await Promise.all(
            [
                this.readOffer(turn),
                this.readHands(),
                this.readBoard(),
                this.readSlotPts(),
                this.readWindows(),
                this.readScore(),
            ]
        )
        return {turn, offer, hand, board, slotPts, windows, score}
    }

    protected async readOffer(turn: Turn): Promise<string[]> {
        if (turn.phase !== 'draft') return []
        const cards = await Promise.all(
            Array.from({length: OFFER}, (_, i) =>
                this.read('draft', turn.round, `offer${i + 1}`)
            )
        )
        return cards.map(str)
    }

    /**
     * What is still on the table this round.
     *
     * The offer is a MULTISET — `[wind, water, wind]` is a real round — so the
     * leader's pick removes one copy, not the element. Treating it as a set
     * let the follower take a card that had already gone.
     */
    protected async remainingOffer(turn: Turn): Promise<string[]> {
        const left = await this.readOffer(turn)
        for (const side of ['you', 'ai'] as const) {
            const picked = str(
                await this.read('draft', turn.round, `${side}Pick`)
            )
            if (!picked) continue
            const at = left.indexOf(picked)
            if (at >= 0) left.splice(at, 1)
        }
        return left
    }

    private async readHands(): Promise<GameState['hand']> {
        const out: GameState['hand'] = {you: {}, ai: {}}
        await Promise.all(
            ELEMENTS.flatMap((e) =>
                (['you', 'ai'] as const).map(async (side) => {
                    const n = num(await this.read('hand', e, side))
                    if (n > 0) out[side][e] = n
                })
            )
        )
        return out
    }

    private async readBoard(): Promise<GameState['board']> {
        const slots = BLOCKS.find((b) => b.ref === 'play')!.rows.length
        const side = async (s: Side) =>
            Promise.all(
                Array.from({length: slots}, (_, i) =>
                    this.read('play', i + 1, s).then(str)
                )
            )
        const [you, ai] = await Promise.all([side('you'), side('ai')])
        return {you, ai}
    }

    private async readSlotPts(): Promise<GameState['slotPts']> {
        const slots = BLOCKS.find((b) => b.ref === 'play')!.rows.length
        const side = async (s: Side) =>
            Promise.all(
                Array.from({length: slots}, (_, i) =>
                    this.read('play', i + 1, `${s}Pts`).then(num)
                )
            )
        const [you, ai] = await Promise.all([side('you'), side('ai')])
        return {you, ai}
    }

    private async readWindows(): Promise<GameState['windows']> {
        const rows = BLOCKS.find((b) => b.ref === 'window')!.rows.length
        return Promise.all(
            Array.from({length: rows}, async (_, i) => {
                const w = i + 1
                const [you, ai, youCut, aiCut, youScore, aiScore] =
                    await Promise.all([
                        this.read('window', w, 'youShape'),
                        this.read('window', w, 'aiShape'),
                        this.read('window', w, 'youCancelled'),
                        this.read('window', w, 'aiCancelled'),
                        this.read('window', w, 'youScore'),
                        this.read('window', w, 'aiScore'),
                    ])
                return {
                    w,
                    you: str(you),
                    ai: str(ai),
                    youCancelled: num(youCut) === 1,
                    aiCancelled: num(aiCut) === 1,
                    youScore: num(youScore),
                    aiScore: num(aiScore),
                }
            })
        )
    }

    private async readScore(): Promise<GameState['score']> {
        const side = async (s: Side) => {
            const [cards, forms, total] = await Promise.all([
                this.read('score', 's', `${s}Cards`),
                this.read('score', 's', `${s}Forms`),
                this.read('score', 's', `${s}Total`),
            ])
            return {cards: num(cards), forms: num(forms), total: num(total)}
        }
        const [you, ai] = await Promise.all([side('you'), side('ai')])
        return {you, ai}
    }
}

/** The reader, plus the two writes the craft makes. */
export class Game extends GameReader {
    constructor(protected readonly client: GameClient, sheetIdx: number) {
        super(client, sheetIdx)
    }

    private async apply(payloads: readonly unknown[]): Promise<void> {
        const effect = (await this.client.handleTransaction({
            transaction: {payloads, undoable: true, temp: false},
        })) as {status?: {type?: string}; errorMessage?: string; msg?: string}
        // A rejection names the payload it stopped at; pass that on rather
        // than "the move failed".
        if (effect?.msg) throw new Error(effect.msg)
        if (effect?.status?.type !== 'ok')
            throw new Error(
                effect?.errorMessage ?? 'the engine rejected the move'
            )
    }

    /** MARKER:ENDREADS */
    /**
     * Put the sheet into another language. Labels only — no key, no value and
     * no formula moves, so a game in progress is unaffected.
     */
    async relabel(locale: SheetLocale): Promise<void> {
        if (!(await this.isBuilt())) return
        await this.apply(relabelPayloads(this.sheetIdx, locale))
    }

    /**
     * Deal. On a sheet that already holds a game the blocks stay and only the
     * played cells are cleared, so a rule the player has edited survives a
     * re-deal — and so does the engine, which refuses to build a block twice.
     */
    async newGame(
        rand: () => number = Math.random,
        locale: SheetLocale = 'en'
    ): Promise<void> {
        const built = await this.isBuilt()
        await this.apply([
            ...(built
                ? [
                      ...resetPayloads(this.sheetIdx),
                      // A re-deal keeps the blocks, so it also has to carry
                      // the language the panel is in now.
                      ...relabelPayloads(this.sheetIdx, locale),
                  ]
                : setupPayloads(this.sheetIdx, undefined, locale)),
            ...shufflePayloads(
                this.sheetIdx,
                ELEMENTS,
                DRAFT_ROUNDS * OFFER,
                rand
            ),
        ])
    }

    /**
     * Commit one card for whoever is to move. The sheet says where it goes;
     * this only asks whether the card is in hand, because putting a card
     * nobody holds on the board would be silently wrong rather than rejected.
     */
    async commit(card: Element): Promise<void> {
        const turn = await this.turn()
        if (turn.phase === 'done') throw new Error('the game is over')
        const side = turn.toMove
        if (side !== 'you' && side !== 'ai')
            throw new Error('nobody is to move')

        if (turn.phase === 'draft') {
            const left = await this.remainingOffer(turn)
            if (!left.includes(card))
                throw new Error(
                    `${card} is not left on offer this round (${
                        left.join(', ') || 'nothing'
                    })`
                )
            await this.apply([
                writePayload(
                    this.sheetIdx,
                    'draft',
                    turn.round,
                    `${side}Pick`,
                    card
                ),
            ])
            return
        }

        const held = num(await this.read('hand', card, side))
        if (held <= 0) throw new Error(`no ${card} left in hand`)
        await this.apply([
            writePayload(this.sheetIdx, 'play', turn.nextSlot, side, card),
        ])
    }
}
