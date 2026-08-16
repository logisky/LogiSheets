// lights-out craft — pure, host-agnostic helpers.
//
// Classic Lights Out: click a cell to toggle it AND its 4 orthogonal
// neighbors; turn every light off to win. The DOM/UI lives in index.html;
// this module owns the board math, the render/border transactions and the
// craft-state (progress) serialization. It talks only to the injected
// `window.workbook` proxy (getAllSheetInfo + handleTransaction).

import type {CellInfo, EditPayload, SheetInfo} from 'logisheets-web'

export const BOARD_NAME = '关灯'
export const SIZE = 5
export const CELL_PX = 52

// Cell fills. On/off are pattern fills → a {red,green,blue} OBJECT.
const ON_HEX = '#FFCA28' // lit
const OFF_HEX = '#26323C' // dark

// Border colors are STRINGS in the engine's "standard ARGB" format: 8 hex
// digits, NO '#'. A '#RRGGBB' value parses to no color and won't render.
const GRID_ARGB = 'FFCFD8DC' // thin inner grid
const BOUND_ARGB = 'FF0B0F19' // thick outer boundary

// Scramble-move counts per difficulty. More random toggles ≈ harder.
export const DIFFICULTY: Record<string, number> = {easy: 4, medium: 8, hard: 14}

export interface Workbook {
    getAllSheetInfo(): Promise<readonly SheetInfo[] | unknown>
    getCells(params: {
        sheetIdx: number
        startRow: number
        startCol: number
        endRow: number
        endCol: number
    }): Promise<readonly CellInfo[] | unknown>
    handleTransaction(params: {
        transaction: {
            payloads: readonly EditPayload[]
            undoable: boolean
            temp: boolean
        }
    }): Promise<unknown>
}

/** Board is a flat 0/1 array, index = row * SIZE + col (1 = light on). */
export type Board = number[]

// ---- color / transactions ---------------------------------------------
function hexToRgb(hex: string): {red: number; green: number; blue: number} {
    const h = hex.replace('#', '')
    return {
        red: parseInt(h.substring(0, 2), 16),
        green: parseInt(h.substring(2, 4), 16),
        blue: parseInt(h.substring(4, 6), 16),
    }
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

function fillPayload(
    sheetIdx: number,
    row: number,
    col: number,
    hex: string
): EditPayload {
    return {
        type: 'cellStyleUpdate',
        value: {
            sheetIdx,
            row,
            col,
            ty: {setPatternFill: {patternType: 'solid', fgColor: hexToRgb(hex)}},
        },
    } as EditPayload
}

function borderPayload(sheetIdx: number, r: number, c: number): EditPayload {
    const top = r === 0
    const bottom = r === SIZE - 1
    const left = c === 0
    const right = c === SIZE - 1
    return {
        type: 'cellStyleUpdate',
        value: {
            sheetIdx,
            row: r,
            col: c,
            ty: {
                setTopBorderStyle: top ? 'thick' : 'thin',
                setTopBorderColor: top ? BOUND_ARGB : GRID_ARGB,
                setBottomBorderStyle: bottom ? 'thick' : 'thin',
                setBottomBorderColor: bottom ? BOUND_ARGB : GRID_ARGB,
                setLeftBorderStyle: left ? 'thick' : 'thin',
                setLeftBorderColor: left ? BOUND_ARGB : GRID_ARGB,
                setRightBorderStyle: right ? 'thick' : 'thin',
                setRightBorderColor: right ? BOUND_ARGB : GRID_ARGB,
            },
        },
    } as EditPayload
}

function squareDims(px: number): {width: number; height: number} {
    return {width: px / 7, height: (px * 72) / 96}
}

/**
 * Ensure the board sheet exists (create + size to squares + frame with a
 * border on first use) and return its index. Never deletes — the game reuses
 * and repaints it. Borders are (re)applied each call (idempotent, cheap).
 */
export async function ensureBoard(workbook: Workbook): Promise<number> {
    let idx = await findSheetIdx(workbook, BOARD_NAME)
    if (idx < 0) {
        const infos = asSheetInfos(await workbook.getAllSheetInfo())
        idx = infos.length
        await commit(workbook, [
            {type: 'createSheet', value: {idx, newName: BOARD_NAME}},
        ])
        const {width, height} = squareDims(CELL_PX)
        const sizing: EditPayload[] = []
        for (let c = 0; c < SIZE; c++)
            sizing.push({
                type: 'setColWidth',
                value: {sheetIdx: idx, col: c, width},
            } as EditPayload)
        for (let r = 0; r < SIZE; r++)
            sizing.push({
                type: 'setRowHeight',
                value: {sheetIdx: idx, row: r, height},
            } as EditPayload)
        await commit(workbook, sizing)
    }
    const borders: EditPayload[] = []
    for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++) borders.push(borderPayload(idx, r, c))
    await commit(workbook, borders)
    return idx
}

const ON_RGB = hexToRgb(ON_HEX)

/**
 * Reconstruct the board from the sheet's cell fills — the visible, document-
 * persisted source of truth (a cell is "on" iff its fill is the lit color).
 * No craftState needed: the board lives in the workbook. Reads the SIZE×SIZE
 * region row-major.
 */
export async function readBoard(
    workbook: Workbook,
    sheetIdx: number
): Promise<Board> {
    const res = await workbook.getCells({
        sheetIdx,
        startRow: 0,
        startCol: 0,
        endRow: SIZE - 1,
        endCol: SIZE - 1,
    })
    const infos = Array.isArray(res) ? (res as CellInfo[]) : []
    const board = emptyBoard()
    for (let i = 0; i < infos.length && i < SIZE * SIZE; i++) {
        const fill = infos[i]?.style?.fill
        const fg =
            fill && fill.type === 'patternFill' ? fill.value?.fgColor : undefined
        board[i] =
            fg &&
            fg.red === ON_RGB.red &&
            fg.green === ON_RGB.green &&
            fg.blue === ON_RGB.blue
                ? 1
                : 0
    }
    return board
}

/** Paint the whole board's on/off fills in one transaction. */
export async function renderBoard(
    workbook: Workbook,
    sheetIdx: number,
    board: Board
): Promise<void> {
    const payloads: EditPayload[] = []
    for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++)
            payloads.push(
                fillPayload(sheetIdx, r, c, board[r * SIZE + c] ? ON_HEX : OFF_HEX)
            )
    await commit(workbook, payloads)
}

// ---- game logic --------------------------------------------------------
export function emptyBoard(): Board {
    return new Array(SIZE * SIZE).fill(0)
}

/** Indices toggled by a click at (r,c): itself + orthogonal neighbors. */
function affected(r: number, c: number): number[] {
    const out = [r * SIZE + c]
    if (r > 0) out.push((r - 1) * SIZE + c)
    if (r < SIZE - 1) out.push((r + 1) * SIZE + c)
    if (c > 0) out.push(r * SIZE + (c - 1))
    if (c < SIZE - 1) out.push(r * SIZE + (c + 1))
    return out
}

/** Apply a click in place: toggle the cell and its neighbors. */
export function applyMove(board: Board, r: number, c: number): void {
    for (const i of affected(r, c)) board[i] = board[i] ? 0 : 1
}

export function isSolved(board: Board): boolean {
    return board.every((v) => v === 0)
}

/**
 * Build a solvable puzzle: start from all-off and apply `moves` random clicks.
 * Any board reachable this way is guaranteed solvable. Retries if it lands back
 * on all-off (a trivial, already-solved board).
 */
export function generatePuzzle(moves: number): Board {
    for (let attempt = 0; attempt < 12; attempt++) {
        const board = emptyBoard()
        for (let m = 0; m < moves; m++) {
            const r = Math.floor(Math.random() * SIZE)
            const c = Math.floor(Math.random() * SIZE)
            applyMove(board, r, c)
        }
        if (!isSolved(board)) return board
    }
    // Extremely unlikely fallback: light a single cell's cross.
    const board = emptyBoard()
    applyMove(board, 0, 0)
    return board
}

/**
 * Solve a solvable board via Gaussian elimination over GF(2). Returns the set of
 * cell indices to click (each toggles itself + orthogonal neighbors) that turns
 * every light off, or null if the board is unsolvable (shouldn't happen for
 * puzzles from `generatePuzzle`). Pure.
 */
export function solve(board: Board): number[] | null {
    const n = SIZE * SIZE
    // Augmented rows: A[i][j] = 1 iff clicking j toggles i ⇔ j ∈ affected(i);
    // last column is the target (current light state of cell i).
    const rows: number[][] = []
    for (let i = 0; i < n; i++) {
        const row = new Array(n + 1).fill(0)
        for (const j of affected(Math.floor(i / SIZE), i % SIZE)) row[j] = 1
        row[n] = board[i] ? 1 : 0
        rows.push(row)
    }
    const where = new Array(n).fill(-1)
    let pivot = 0
    for (let c = 0; c < n && pivot < n; c++) {
        let sel = -1
        for (let r = pivot; r < n; r++)
            if (rows[r][c]) {
                sel = r
                break
            }
        if (sel < 0) continue
        ;[rows[pivot], rows[sel]] = [rows[sel], rows[pivot]]
        where[c] = pivot
        for (let r = 0; r < n; r++)
            if (r !== pivot && rows[r][c])
                for (let k = c; k <= n; k++) rows[r][k] ^= rows[pivot][k]
        pivot++
    }
    const x = new Array(n).fill(0)
    for (let c = 0; c < n; c++) if (where[c] !== -1) x[c] = rows[where[c]][n]
    // Apply the candidate solution and verify (also rejects inconsistent boards).
    const test = board.slice()
    const moves: number[] = []
    for (let i = 0; i < n; i++)
        if (x[i]) {
            moves.push(i)
            applyMove(test, Math.floor(i / SIZE), i % SIZE)
        }
    return isSolved(test) ? moves : null
}

// ---- progress (craft-state) --------------------------------------------
export interface Progress {
    solved: number // puzzles completed
    best: number | null // fewest moves to solve a puzzle (lower is better)
    difficulty: string // 'easy' | 'medium' | 'hard'
    moves: number // moves made on the current puzzle
    // NOTE: the board is NOT stored here — it lives in the workbook (cell fills),
    // which is the document-persisted source of truth. Read it with readBoard().
}

export function parseProgress(json: string | undefined): Progress {
    const dflt: Progress = {
        solved: 0,
        best: null,
        difficulty: 'medium',
        moves: 0,
    }
    if (!json) return dflt
    try {
        const p = JSON.parse(json)
        const solved = intOr(p.solved, 0)
        const best =
            typeof p.best === 'number' && Number.isFinite(p.best)
                ? Math.floor(p.best)
                : null
        const difficulty = DIFFICULTY[p.difficulty] ? p.difficulty : 'medium'
        const moves = intOr(p.moves, 0)
        return {solved, best, difficulty, moves}
    } catch {
        return dflt
    }
}

export function serializeProgress(p: Progress): string {
    return JSON.stringify(p)
}

function intOr(v: unknown, dflt: number): number {
    return typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : dflt
}
