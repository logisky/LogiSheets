// minesweeper craft — pure, host-agnostic helpers.
//
// Board layout + rendering + game logic live here; the UI, timer and input
// wiring live in index.html. Reuses the fuse-beads / lights-out patterns:
// own sheet, square cells, `onCanvasInput` (left = reveal, right = flag),
// borders as standard-ARGB strings, fills as {red,green,blue} objects. Talks
// only to the injected `window.workbook` proxy.

import type {EditPayload, SheetInfo} from 'logisheets-web'

export const BOARD_NAME = '扫雷'
export const CELL_PX = 30
// Largest board (hard) — used to clear the previous game's region on restart.
const MAX_ROWS = 16
const MAX_COLS = 30

export interface Level {
    rows: number
    cols: number
    mines: number
}
export const DIFFICULTY: Record<string, Level> = {
    easy: {rows: 9, cols: 9, mines: 10},
    medium: {rows: 16, cols: 16, mines: 40},
    hard: {rows: 16, cols: 30, mines: 99},
}

// Fills (objects). Covered vs revealed must read as clearly different.
const COVERED_HEX = '#90A4AE'
const REVEALED_HEX = '#ECEFF1'
const MINE_HIT_HEX = '#EF5350'
// Font colors are the engine's standard-ARGB strings (8 hex, no '#').
const FLAG_FONT = 'FFD32F2F'
const MINE_FONT = 'FF111111'
// Classic 1..8 number colors.
const NUM_FONT = [
    '',
    'FF1976D2', // 1 blue
    'FF388E3C', // 2 green
    'FFD32F2F', // 3 red
    'FF7B1FA2', // 4 purple
    'FFC2185B', // 5 maroon/pink
    'FF0097A7', // 6 teal
    'FF212121', // 7 black
    'FF757575', // 8 gray
]
const GRID_ARGB = 'FFB0BEC5'
const BOUND_ARGB = 'FF0B0F19'

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

export interface Game {
    rows: number
    cols: number
    mines: number
    mineSet: Set<number> // placed after first reveal
    adjacent: number[]
    revealed: boolean[]
    flagged: boolean[]
    started: boolean
    over: boolean
    won: boolean
    hitIndex: number // the mine that ended the game, or -1
}

// ---- game logic --------------------------------------------------------
export function newGame(level: Level): Game {
    const n = level.rows * level.cols
    return {
        rows: level.rows,
        cols: level.cols,
        mines: level.mines,
        mineSet: new Set(),
        adjacent: new Array(n).fill(0),
        revealed: new Array(n).fill(false),
        flagged: new Array(n).fill(false),
        started: false,
        over: false,
        won: false,
        hitIndex: -1,
    }
}

function neighbors(g: Game, i: number): number[] {
    const r = Math.floor(i / g.cols)
    const c = i % g.cols
    const out: number[] = []
    for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue
            const nr = r + dr
            const nc = c + dc
            if (nr >= 0 && nr < g.rows && nc >= 0 && nc < g.cols)
                out.push(nr * g.cols + nc)
        }
    return out
}

function shuffle<T>(a: T[]): T[] {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
}

// Place mines avoiding the first-clicked cell and its neighbors, so the first
// reveal always opens an area (classic first-click-safe).
function placeMines(g: Game, safe: number): void {
    const forbidden = new Set<number>([safe, ...neighbors(g, safe)])
    let candidates = [...Array(g.rows * g.cols).keys()].filter((i) => !forbidden.has(i))
    if (candidates.length < g.mines) {
        // Board too dense to spare the neighbor ring; only spare the click.
        candidates = [...Array(g.rows * g.cols).keys()].filter((i) => i !== safe)
    }
    shuffle(candidates)
    g.mineSet = new Set(candidates.slice(0, g.mines))
    for (let i = 0; i < g.rows * g.cols; i++)
        g.adjacent[i] = neighbors(g, i).filter((n) => g.mineSet.has(n)).length
    g.started = true
}

/**
 * Reveal a cell. Returns the indices whose display changed. On hitting a mine,
 * sets `over` and reveals all mines (those indices are included in `changed`).
 */
export function reveal(g: Game, r: number, c: number): number[] {
    if (g.over || g.won) return []
    const start = r * g.cols + c
    if (g.revealed[start] || g.flagged[start]) return []
    if (!g.started) placeMines(g, start)

    if (g.mineSet.has(start)) {
        g.over = true
        g.hitIndex = start
        const changed: number[] = []
        for (const m of g.mineSet) {
            if (!g.revealed[m]) {
                g.revealed[m] = true
                changed.push(m)
            }
        }
        if (!changed.includes(start)) changed.push(start)
        return changed
    }

    const changed: number[] = []
    const stack = [start]
    while (stack.length) {
        const i = stack.pop() as number
        if (g.revealed[i] || g.flagged[i]) continue
        g.revealed[i] = true
        changed.push(i)
        if (g.adjacent[i] === 0) for (const nb of neighbors(g, i)) stack.push(nb)
    }
    if (isWin(g)) g.won = true
    return changed
}

/** Toggle a flag on a covered cell. Returns the changed index, or -1. */
export function toggleFlag(g: Game, r: number, c: number): number {
    if (g.over || g.won) return -1
    const i = r * g.cols + c
    if (g.revealed[i]) return -1
    g.flagged[i] = !g.flagged[i]
    return i
}

function isWin(g: Game): boolean {
    let revealedCount = 0
    for (let i = 0; i < g.revealed.length; i++) if (g.revealed[i]) revealedCount++
    return revealedCount === g.rows * g.cols - g.mines
}

export function flagsUsed(g: Game): number {
    let n = 0
    for (const f of g.flagged) if (f) n++
    return n
}

// ---- rendering ---------------------------------------------------------
function hexToRgb(hex: string): {red: number; green: number; blue: number} {
    const h = hex.replace('#', '')
    return {
        red: parseInt(h.substring(0, 2), 16),
        green: parseInt(h.substring(2, 4), 16),
        blue: parseInt(h.substring(4, 6), 16),
    }
}

function cellPayloads(g: Game, i: number, sheetIdx: number): EditPayload[] {
    const r = Math.floor(i / g.cols)
    const c = i % g.cols
    let fill = COVERED_HEX
    let content = ''
    let font = FLAG_FONT
    if (!g.revealed[i]) {
        content = g.flagged[i] ? '🚩' : ''
    } else if (g.mineSet.has(i)) {
        fill = i === g.hitIndex ? MINE_HIT_HEX : REVEALED_HEX
        content = '💣'
        font = MINE_FONT
    } else {
        fill = REVEALED_HEX
        const n = g.adjacent[i]
        content = n > 0 ? String(n) : ''
        font = n > 0 ? NUM_FONT[n] : MINE_FONT
    }
    return [
        {
            type: 'cellStyleUpdate',
            value: {
                sheetIdx,
                row: r,
                col: c,
                ty: {
                    setPatternFill: {patternType: 'solid', fgColor: hexToRgb(fill)},
                    setFontColor: font,
                    setFontBold: true,
                    setFontSize: 14,
                    setAlignment: {horizontal: 'center', vertical: 'center'},
                },
            },
        } as EditPayload,
        {type: 'cellInput', value: {sheetIdx, row: r, col: c, content}} as EditPayload,
    ]
}

// ---- workbook / sheet --------------------------------------------------
async function commit(
    workbook: Workbook,
    payloads: readonly EditPayload[]
): Promise<void> {
    if (payloads.length === 0) return
    const res = (await workbook.handleTransaction({
        transaction: {payloads, undoable: false, temp: false},
    })) as {status?: {type?: string}} | null
    if (res && res.status && res.status.type === 'err')
        throw new Error('transaction rejected')
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

function squareDims(px: number): {width: number; height: number} {
    return {width: px / 7, height: (px * 72) / 96}
}

async function ensureSheet(workbook: Workbook): Promise<number> {
    let idx = await findSheetIdx(workbook, BOARD_NAME)
    if (idx < 0) {
        const infos = asSheetInfos(await workbook.getAllSheetInfo())
        idx = infos.length
        await commit(workbook, [
            {type: 'createSheet', value: {idx, newName: BOARD_NAME}},
        ])
    }
    // size the whole max area to squares so any difficulty fits crisply
    const {width, height} = squareDims(CELL_PX)
    const sizing: EditPayload[] = []
    for (let c = 0; c < MAX_COLS; c++)
        sizing.push({type: 'setColWidth', value: {sheetIdx: idx, col: c, width}} as EditPayload)
    for (let r = 0; r < MAX_ROWS; r++)
        sizing.push({type: 'setRowHeight', value: {sheetIdx: idx, row: r, height}} as EditPayload)
    await commit(workbook, sizing)
    return idx
}

// Clear the whole max region (fills, content, borders) so a smaller new board
// doesn't leave the previous game's cells lingering around it.
function clearRegionPayloads(sheetIdx: number): EditPayload[] {
    const out: EditPayload[] = []
    for (let r = 0; r < MAX_ROWS; r++)
        for (let c = 0; c < MAX_COLS; c++) {
            out.push({
                type: 'cellStyleUpdate',
                value: {
                    sheetIdx,
                    row: r,
                    col: c,
                    ty: {
                        setPatternFill: {patternType: 'none'},
                        setTopBorderStyle: 'none',
                        setBottomBorderStyle: 'none',
                        setLeftBorderStyle: 'none',
                        setRightBorderStyle: 'none',
                    },
                },
            } as EditPayload)
            out.push({type: 'cellInput', value: {sheetIdx, row: r, col: c, content: ''}} as EditPayload)
        }
    return out
}

function borderPayloads(g: Game, sheetIdx: number): EditPayload[] {
    const out: EditPayload[] = []
    for (let r = 0; r < g.rows; r++)
        for (let c = 0; c < g.cols; c++) {
            const top = r === 0
            const bottom = r === g.rows - 1
            const left = c === 0
            const right = c === g.cols - 1
            out.push({
                type: 'cellStyleUpdate',
                value: {
                    sheetIdx,
                    row: r,
                    col: c,
                    ty: {
                        setTopBorderStyle: top ? 'medium' : 'thin',
                        setTopBorderColor: top ? BOUND_ARGB : GRID_ARGB,
                        setBottomBorderStyle: bottom ? 'medium' : 'thin',
                        setBottomBorderColor: bottom ? BOUND_ARGB : GRID_ARGB,
                        setLeftBorderStyle: left ? 'medium' : 'thin',
                        setLeftBorderColor: left ? BOUND_ARGB : GRID_ARGB,
                        setRightBorderStyle: right ? 'medium' : 'thin',
                        setRightBorderColor: right ? BOUND_ARGB : GRID_ARGB,
                    },
                },
            } as EditPayload)
        }
    return out
}

/** Create/prepare the sheet and render a fresh (all-covered) board. */
export async function setupBoard(workbook: Workbook, g: Game): Promise<number> {
    const idx = await ensureSheet(workbook)
    const payloads: EditPayload[] = clearRegionPayloads(idx)
    payloads.push(...borderPayloads(g, idx))
    for (let i = 0; i < g.rows * g.cols; i++) payloads.push(...cellPayloads(g, i, idx))
    await commit(workbook, payloads)
    return idx
}

/** Repaint just the given cell indices. */
export async function renderCells(
    workbook: Workbook,
    sheetIdx: number,
    g: Game,
    indices: number[]
): Promise<void> {
    const payloads: EditPayload[] = []
    for (const i of indices) payloads.push(...cellPayloads(g, i, sheetIdx))
    await commit(workbook, payloads)
}

// ---- progress (craft-state) --------------------------------------------
export interface Progress {
    difficulty: string
    best: Record<string, number | null> // best time (seconds) per difficulty
}
export function parseProgress(json: string | undefined): Progress {
    const dflt: Progress = {difficulty: 'easy', best: {easy: null, medium: null, hard: null}}
    if (!json) return dflt
    try {
        const p = JSON.parse(json)
        const difficulty = DIFFICULTY[p.difficulty] ? p.difficulty : 'easy'
        const best = {
            easy: numOrNull(p.best?.easy),
            medium: numOrNull(p.best?.medium),
            hard: numOrNull(p.best?.hard),
        }
        return {difficulty, best}
    } catch {
        return dflt
    }
}
export function serializeProgress(p: Progress): string {
    return JSON.stringify(p)
}
function numOrNull(v: unknown): number | null {
    return typeof v === 'number' && Number.isFinite(v) ? v : null
}
