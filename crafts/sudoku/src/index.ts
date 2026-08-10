// sudoku craft — pure, host-agnostic helpers.
//
// The craft's whole job is one-time layout: generate a puzzle, write the clues,
// draw the 3x3 box borders, and drop a small block of HUMAN-READABLE checker
// formulas next to the board. After that it's an ordinary spreadsheet — the
// user types digits into empty cells and the COUNTIF-based conflict checks
// recompute live. No canvas interception, no selection suppression, no
// craft-state. Talks only to the injected `window.workbook` proxy.
//
// Note: puzzles are dug from a complete valid grid, so a solution ALWAYS exists;
// uniqueness is intentionally NOT guaranteed (kept simple, per design).

import type {EditPayload, SheetInfo} from 'logisheets-web'

export const BOARD_NAME = '数独'
export const N = 9
export const CELL_PX = 42

// Clues remaining per difficulty (fewer clues = harder; may be non-unique).
export const DIFFICULTY: Record<string, number> = {easy: 40, medium: 32, hard: 26}

// Colors. Fills use a {red,green,blue} OBJECT; font/border colors are the
// engine's "standard ARGB" STRING (8 hex digits, no '#').
const CLUE_FONT = 'FF111827' // given clues: near-black, bold
const USER_FONT = 'FF1565C0' // user entries: blue
const SOLVE_FONT = 'FF2E7D32' // shown-answer: green
const CLUE_FILL = '#ECEFF1' // clue cell background (light gray)
const GRID_ARGB = 'FFB0BEC5' // thin inner gridlines
const BOX_ARGB = 'FF0B0F19' // thick 3x3 box / outer boundary

export interface Workbook {
    getAllSheetInfo(): Promise<readonly SheetInfo[] | unknown>
    handleTransaction(params: {
        transaction: {
            payloads: readonly EditPayload[]
            undoable: boolean
            temp: boolean
        }
    }): Promise<unknown>
}

/** 81-length arrays, index = row*9 + col. 0 = empty. */
export type Grid = number[]

export interface Puzzle {
    puzzle: Grid // 0 for blanks the player fills
    solution: Grid // a full valid completion
}

// ---- generation --------------------------------------------------------
function shuffle<T>(a: T[]): T[] {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
}

function canPlace(g: Grid, pos: number, v: number): boolean {
    const r = Math.floor(pos / N)
    const c = pos % N
    for (let i = 0; i < N; i++) {
        if (g[r * N + i] === v) return false
        if (g[i * N + c] === v) return false
    }
    const br = Math.floor(r / 3) * 3
    const bc = Math.floor(c / 3) * 3
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) if (g[(br + i) * N + (bc + j)] === v) return false
    return true
}

/** A complete valid grid via randomized backtracking (always succeeds). */
export function generateSolved(): Grid {
    const g: Grid = new Array(N * N).fill(0)
    const fill = (pos: number): boolean => {
        if (pos === N * N) return true
        for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
            if (canPlace(g, pos, v)) {
                g[pos] = v
                if (fill(pos + 1)) return true
                g[pos] = 0
            }
        }
        return false
    }
    fill(0)
    return g
}

/** Dig `81 - cluesRemain` cells out of a full solution. Solution always exists. */
export function makePuzzle(cluesRemain: number): Puzzle {
    const solution = generateSolved()
    const puzzle = solution.slice()
    const holes = N * N - cluesRemain
    const order = shuffle([...Array(N * N).keys()])
    for (let i = 0; i < holes; i++) puzzle[order[i]] = 0
    return {puzzle, solution}
}

// ---- transactions / A1 helpers -----------------------------------------
function hexToRgb(hex: string): {red: number; green: number; blue: number} {
    const h = hex.replace('#', '')
    return {
        red: parseInt(h.substring(0, 2), 16),
        green: parseInt(h.substring(2, 4), 16),
        blue: parseInt(h.substring(4, 6), 16),
    }
}
/** 0->A, 8->I, 10->K … (single letter, enough for our layout). */
function col(n: number): string {
    return String.fromCharCode(65 + n)
}
function a1(r: number, c: number): string {
    return col(c) + (r + 1)
}
function rangeA1(r0: number, c0: number, r1: number, c1: number): string {
    return a1(r0, c0) + ':' + a1(r1, c1)
}

async function commit(
    workbook: Workbook,
    payloads: readonly EditPayload[]
): Promise<void> {
    if (payloads.length === 0) return
    const r = (await workbook.handleTransaction({
        transaction: {payloads, undoable: false, temp: false},
    })) as {status?: {type?: string}} | null
    if (r && r.status && r.status.type === 'err') {
        throw new Error('transaction rejected')
    }
}

function asSheetInfos(v: unknown): SheetInfo[] {
    return Array.isArray(v) ? (v as SheetInfo[]) : []
}
export async function findSheetIdx(
    workbook: Workbook,
    name: string
): Promise<number> {
    return asSheetInfos(await workbook.getAllSheetInfo()).findIndex(
        (s) => s.name === name
    )
}

function input(sheetIdx: number, r: number, c: number, content: string): EditPayload {
    return {type: 'cellInput', value: {sheetIdx, row: r, col: c, content}} as EditPayload
}
function styleUpdate(
    sheetIdx: number,
    r: number,
    c: number,
    ty: object
): EditPayload {
    return {type: 'cellStyleUpdate', value: {sheetIdx, row: r, col: c, ty}} as EditPayload
}
function squareDims(px: number): {width: number; height: number} {
    return {width: px / 7, height: (px * 72) / 96}
}

// ---- sheet setup -------------------------------------------------------
function boxBorderTy(r: number, c: number): object {
    // Thin gridlines everywhere; thick line on every 3x3 boundary (which also
    // covers the outer frame).
    return {
        setTopBorderStyle: r % 3 === 0 ? 'thick' : 'thin',
        setTopBorderColor: r % 3 === 0 ? BOX_ARGB : GRID_ARGB,
        setBottomBorderStyle: r % 3 === 2 ? 'thick' : 'thin',
        setBottomBorderColor: r % 3 === 2 ? BOX_ARGB : GRID_ARGB,
        setLeftBorderStyle: c % 3 === 0 ? 'thick' : 'thin',
        setLeftBorderColor: c % 3 === 0 ? BOX_ARGB : GRID_ARGB,
        setRightBorderStyle: c % 3 === 2 ? 'thick' : 'thin',
        setRightBorderColor: c % 3 === 2 ? BOX_ARGB : GRID_ARGB,
    }
}

async function ensureSheet(workbook: Workbook): Promise<number> {
    let idx = await findSheetIdx(workbook, BOARD_NAME)
    if (idx < 0) {
        const infos = asSheetInfos(await workbook.getAllSheetInfo())
        idx = infos.length
        await commit(workbook, [
            {type: 'createSheet', value: {idx, newName: BOARD_NAME}},
        ])
        const {width, height} = squareDims(CELL_PX)
        const sizing: EditPayload[] = []
        for (let c = 0; c < N; c++)
            sizing.push({type: 'setColWidth', value: {sheetIdx: idx, col: c, width}} as EditPayload)
        for (let r = 0; r < N; r++)
            sizing.push({type: 'setRowHeight', value: {sheetIdx: idx, row: r, height}} as EditPayload)
        await commit(workbook, sizing)
    }
    return idx
}

// The nine 1..9 COUNTIF terms — the readable "does any digit repeat here?" test.
function conflictFormula(rng: string): string {
    const terms: string[] = []
    for (let d = 1; d <= 9; d++) terms.push(`(COUNTIF(${rng},${d})>1)`)
    return `=IF(${terms.join('+')}>0,"❌","✅")`
}

// Layout of the checker block (outside the 9x9 board):
//   K1:K9   row checks       (col index 10)
//   A11:I11 column checks    (row index 10)
//   K11:M13 box checks       (rows 10..12, cols 10..12)
//   K15     overall status   (row index 14, col 10)
const ROWCHK_COL = 10
const COLCHK_ROW = 10
const BOXCHK_R0 = 10
const BOXCHK_C0 = 10
const STATUS_R = 14
const STATUS_C = 10

function checkerPayloads(idx: number): EditPayload[] {
    const out: EditPayload[] = []
    // per-row checks (right of each row)
    for (let r = 0; r < N; r++)
        out.push(input(idx, r, ROWCHK_COL, conflictFormula(rangeA1(r, 0, r, N - 1))))
    // per-column checks (below each column)
    for (let c = 0; c < N; c++)
        out.push(input(idx, COLCHK_ROW, c, conflictFormula(rangeA1(0, c, N - 1, c))))
    // per-box checks (a 3x3 mini-grid)
    for (let b = 0; b < 9; b++) {
        const br = Math.floor(b / 3) * 3
        const bc = (b % 3) * 3
        const rng = rangeA1(br, bc, br + 2, bc + 2)
        out.push(
            input(idx, BOXCHK_R0 + Math.floor(b / 3), BOXCHK_C0 + (b % 3), conflictFormula(rng))
        )
    }
    // overall status
    const rowChk = rangeA1(0, ROWCHK_COL, N - 1, ROWCHK_COL)
    const colChk = rangeA1(COLCHK_ROW, 0, COLCHK_ROW, N - 1)
    const boxChk = rangeA1(BOXCHK_R0, BOXCHK_C0, BOXCHK_R0 + 2, BOXCHK_C0 + 2)
    const board = rangeA1(0, 0, N - 1, N - 1)
    out.push(
        input(
            idx,
            STATUS_R,
            STATUS_C,
            `=IF(COUNTIF(${rowChk},"❌")+COUNTIF(${colChk},"❌")+COUNTIF(${boxChk},"❌")>0,"❌ 有冲突",IF(COUNTBLANK(${board})=0,"🎉 完成！","填写中…"))`
        )
    )
    // label next to the status cell (in a free cell — must NOT overlap the
    // box-check block at K11:M13, which is why there's no label at K11).
    out.push(input(idx, STATUS_R, STATUS_C + 1, '← 总状态'))
    return out
}

async function ensureBoardChrome(workbook: Workbook, idx: number): Promise<void> {
    // borders + checker formulas — static, safe to (re)apply each new game
    const payloads: EditPayload[] = []
    for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++) payloads.push(styleUpdate(idx, r, c, boxBorderTy(r, c)))
    payloads.push(...checkerPayloads(idx))
    await commit(workbook, payloads)
}

/** Write clues (bold/black on gray) and blank the rest (blue/centered). */
async function writeCells(
    workbook: Workbook,
    idx: number,
    puzzle: Grid
): Promise<void> {
    const payloads: EditPayload[] = []
    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            const v = puzzle[r * N + c]
            const clue = v !== 0
            payloads.push(input(idx, r, c, clue ? String(v) : ''))
            payloads.push(
                styleUpdate(idx, r, c, {
                    setFontColor: clue ? CLUE_FONT : USER_FONT,
                    setFontBold: clue,
                    setFontSize: 16,
                    setAlignment: {horizontal: 'center', vertical: 'center'},
                    setPatternFill: clue
                        ? {patternType: 'solid', fgColor: hexToRgb(CLUE_FILL)}
                        : {patternType: 'none'},
                })
            )
        }
    }
    await commit(workbook, payloads)
}

/** Create/prepare the board and lay out a fresh puzzle. Returns the puzzle. */
export async function setupNewGame(
    workbook: Workbook,
    difficulty: string
): Promise<{sheetIdx: number; puzzle: Puzzle}> {
    const idx = await ensureSheet(workbook)
    const clues = DIFFICULTY[difficulty] ?? DIFFICULTY.medium
    const puzzle = makePuzzle(clues)
    await writeCells(workbook, idx, puzzle.puzzle)
    await ensureBoardChrome(workbook, idx)
    return {sheetIdx: idx, puzzle}
}

/** Clear only the player's entries (non-clue cells) back to blank. */
export async function clearEntries(
    workbook: Workbook,
    idx: number,
    puzzle: Grid
): Promise<void> {
    const payloads: EditPayload[] = []
    for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++)
            if (puzzle[r * N + c] === 0) {
                payloads.push(input(idx, r, c, ''))
                payloads.push(
                    styleUpdate(idx, r, c, {
                        setFontColor: USER_FONT,
                        setFontBold: false,
                        setFontSize: 16,
                        setAlignment: {horizontal: 'center', vertical: 'center'},
                    })
                )
            }
    await commit(workbook, payloads)
}

/** Fill every blank with the solution (green), for "show answer". */
export async function fillSolution(
    workbook: Workbook,
    idx: number,
    p: Puzzle
): Promise<void> {
    const payloads: EditPayload[] = []
    for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++)
            if (p.puzzle[r * N + c] === 0) {
                payloads.push(input(idx, r, c, String(p.solution[r * N + c])))
                payloads.push(
                    styleUpdate(idx, r, c, {
                        setFontColor: SOLVE_FONT,
                        setFontBold: false,
                        setFontSize: 16,
                        setAlignment: {horizontal: 'center', vertical: 'center'},
                    })
                )
            }
    await commit(workbook, payloads)
}
