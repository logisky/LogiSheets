/**
 * @logicianSkill 四象 — a card duel played on the sheet. Use when the user
 * wants to play, wants to know how the game is going, or asks what the rules
 * currently are. The rules are not fixed: they are blocks the user can edit,
 * so read them rather than assuming.
 * @guidance Read get_rules before reasoning about a position — the counter
 * table and the formation values are editable and may not be the defaults.
 * The game is fully open: get_draft shows the rounds still to come as well as
 * the ones played, and get_state gives both hands, so nothing is hidden from
 * either side. There is deliberately no tool that scores candidate moves for
 * you; work out what a line is worth from the rules and the board.
 */

import {GameReader, type CellReader} from '../four-elements-core/src/game'
import {ELEMENTS} from '../four-elements-core/src/sheet'

/** Host-injected context; `workbook` is the live LogiSheets client. */
export interface Ctx {
    workbook: CellReader
}

/** The game always lives on the first sheet. */
const SHEET = 0

const reader = (ctx: Ctx) => new GameReader(ctx.workbook, SHEET)

// ---------------------------------------------------------------------------
// Returned shapes. Flat arrays of plain objects: what the model reads, and
// what `craftsmith` can turn into a schema.
// ---------------------------------------------------------------------------

export interface CounterRow {
    /** An ordered pair, `"attacker>defender"`. */
    pair: string
    /** Points the attacker scores against the defender. 0 means no counter. */
    pts: number
}

export interface FormationRow {
    /** `triple` (AAA), `chain` (a run down the counter cycle), `split` (ABA). */
    shape: string
    /** What the formation is worth on its own. */
    value: number
    /** The shape this one cancels, reducing it by the cancel factor. */
    cancels: string
}

export interface KnobRow {
    /** `cancelKeep` (what a cancelled formation keeps, 0 = nothing) or
     *  `byElement` (1 = same-shape windows resolve by element). */
    name: string
    value: number
}

export interface Rules {
    counter: CounterRow[]
    formation: FormationRow[]
    knob: KnobRow[]
}

export interface HandRow {
    element: string
    /** Drafted and not yet committed, for the human player. */
    you: number
    ai: number
}

export interface SlotRow {
    /** 1-based, left to right. */
    slot: number
    /** The element committed here, or `""`. */
    you: string
    ai: string
    /** What this slot has already settled for, head to head, per the counter
     *  table. 0 while either side is still empty. */
    youPts: number
    aiPts: number
}

export interface State {
    /** `draft`, `play` or `done`. */
    phase: string
    /** `you` or `ai` — whose move it is. */
    toMove: string
    /** Draft round, 1-based. Only meaningful while drafting. */
    round: number
    /** Slot the next card goes into. Only meaningful while playing. */
    nextSlot: number
    /** The three cards revealed this round; a card may appear twice. */
    offer: string[]
    /** What the side to move may commit right now. */
    legal: string[]
    hand: HandRow[]
    board: SlotRow[]
}

export interface WindowRow {
    /** 1-based; window `w` covers slots `w`, `w+1`, `w+2`. */
    w: number
    youShape: string
    aiShape: string
    /** Whether the opposite shape cancelled this one. A window worth 0 is
     *  either a cancelled formation or no formation; this says which. */
    youCancelled: boolean
    aiCancelled: boolean
    /** After cancellation. */
    youScore: number
    aiScore: number
}

export interface DraftRow {
    /** 1-based. */
    round: number
    /** The three cards revealed that round; a card may appear twice. */
    offer: string[]
    /** `""` until that side has taken its card. */
    youPick: string
    aiPick: string
}

export interface Score {
    youCards: number
    youForms: number
    youTotal: number
    aiCards: number
    aiForms: number
    aiTotal: number
}

// ---------------------------------------------------------------------------
// Tools. Every one is a read; none of them computes anything.
// ---------------------------------------------------------------------------

/**
 * @tool The rules as they currently stand: which element beats which and for
 * how much, what each formation is worth and what it cancels, and the knobs.
 * Read this before judging a position — the user can edit any of it.
 */
export async function getRules(ctx: Ctx): Promise<Rules> {
    return reader(ctx).rules()
}

/**
 * @tool The position: phase, whose move it is, what is on offer, what is legal,
 * both hands and both lines.
 */
export async function getState(ctx: Ctx): Promise<State> {
    const r = reader(ctx)
    const s = await r.state()
    return {
        phase: s.turn.phase,
        toMove: s.turn.toMove,
        round: s.turn.round,
        nextSlot: s.turn.nextSlot,
        offer: s.offer,
        legal: await r.legal(),
        hand: ELEMENTS.map((element) => ({
            element,
            you: s.hand.you[element] ?? 0,
            ai: s.hand.ai[element] ?? 0,
        })),
        board: s.board.you.map((you, i) => ({
            slot: i + 1,
            you,
            ai: s.board.ai[i] ?? '',
            youPts: s.slotPts.you[i] ?? 0,
            aiPts: s.slotPts.ai[i] ?? 0,
        })),
    }
}

/**
 * @tool The three-slot windows: what shape each side has formed and what it is
 * worth after cancellation. Windows overlap.
 */
export async function getWindows(ctx: Ctx): Promise<WindowRow[]> {
    const s = await reader(ctx).state()
    return s.windows.map((w) => ({
        w: w.w,
        youShape: w.you,
        aiShape: w.ai,
        youCancelled: w.youCancelled,
        aiCancelled: w.aiCancelled,
        youScore: w.youScore,
        aiScore: w.aiScore,
    }))
}

/**
 * @tool The score as it stands, split into the slot-by-slot card points and
 * the formation points.
 */
export async function getScore(ctx: Ctx): Promise<Score> {
    const s = await reader(ctx).state()
    return {
        youCards: s.score.you.cards,
        youForms: s.score.you.forms,
        youTotal: s.score.you.total,
        aiCards: s.score.ai.cards,
        aiForms: s.score.ai.forms,
        aiTotal: s.score.ai.total,
    }
}

/**
 * @tool The whole draft, every round: the three cards offered and what each
 * side took. The rounds still to come are already dealt and visible here —
 * nothing about this game is hidden — so use it to see what is coming and to
 * work out what the opponent is collecting.
 */
export async function getDraft(ctx: Ctx): Promise<DraftRow[]> {
    return reader(ctx).draft()
}

// ---------------------------------------------------------------------------
// What the craft asks the model. The prompts carry behaviour, never rules —
// every `ask` is stateless, so the model has no rules to have gone stale.
// ---------------------------------------------------------------------------

/**
 * @aiRole opponent
 * @system You are playing 四象 against the user, inside a spreadsheet. You do
 *   not know this game: the rules, the board, the legal moves and the score
 *   all live in the workbook, so read them with the tools and assume nothing.
 *   Start with get_rules — the user can edit the counter table and the
 *   formation values, and they may not be the defaults. Nothing is hidden:
 *   get_draft shows the rounds still to come and get_state gives both hands,
 *   so draft with the later rounds in mind and play knowing what the opponent
 *   holds. Nothing will score your candidate moves for you; work out what a
 *   line is worth yourself.
 *   Play the side named by `toMove`, pick one card from `legal`, and answer by
 *   calling reply.
 */
export interface OpponentMove {
    /** The card to commit. Must be one of `legal` from get_state. */
    card: 'fire' | 'wind' | 'earth' | 'water'
    /** One short sentence to the player. Say what you read off the board. */
    taunt?: string
}

/**
 * @aiRole coach
 * @system You are coaching the human player of 四象, inside a spreadsheet. The
 *   rules are in the workbook, not in this prompt — read them with the tools.
 *   Say what the opponent's line is threatening and what answering it would
 *   cost. Never simply name the best move: the player is meant to find it.
 */
export interface CoachNote {
    /** Two or three sentences, addressed to the player. */
    reading: string
    /** The strongest shape the opponent is currently building toward. */
    threat?: 'triple' | 'chain' | 'split' | 'none'
}
