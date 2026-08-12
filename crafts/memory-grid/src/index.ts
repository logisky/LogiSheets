// memory-grid craft — pure, host-agnostic helpers.
//
// The DOM/UI and the timing loop live in index.html. This module owns the
// board math, the round generator, the show/clear/mark transactions, and the
// craft-state (progress) serialization. It talks only to the injected
// `window.workbook` proxy (getAllSheetInfo + handleTransaction).

import type {EditPayload, SheetInfo} from 'logisheets-web'
import {COLORS, getLevel, TOTAL_LEVELS, type LevelSpec} from './levels'

export {COLORS, LEVELS, TOTAL_LEVELS, getLevel} from './levels'
export type {LevelSpec, Mode, Question, GameColor} from './levels'

export const BOARD_NAME = '记忆挑战'
export const BOARD_SIZE = 8
export const CELL_PX = 44

// Marker colors used during the answer / reveal phases.
export const MARK_HEX = '#90CAF9' // player's current pick
export const RIGHT_HEX = '#66BB6A' // correct cell (reveal)
export const WRONG_HEX = '#EF5350' // wrong pick (reveal)

// Board framing: a light grid on every cell + a darker, thicker box around the
// whole 8x8 play area so the region is unmistakable.
// NOTE: border/font colors are STRINGS in the "standard ARGB" format the engine
// expects — 8 hex digits, NO leading '#' (AARRGGBB). A '#'-prefixed or 6-digit
// value parses to "no color" and the border silently doesn't render.
const GRID_HEX = 'FF90A4AE' // inner gridlines
const BOUND_HEX = 'FF0B0F19' // outer region boundary (near-black, thick)

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

/** One flashed cell and its assigned attributes. */
export interface RoundCell {
    row: number
    col: number
    color?: number // index into COLORS
    number?: number
}

export interface Round {
    cells: RoundCell[]
    /** Display order (indices into `cells`); grouped by `simultaneous` upstream. */
    order: number[]
    /** The cells that answer the question (subset of `cells`). */
    answerCells: RoundCell[]
    question: {
        type: 'color' | 'number' | 'both'
        colorIdx?: number
        number?: number
        count: number
        /** Human-readable prompt (without the color swatch, which the UI draws). */
        text: string
    }
}

// ---- geometry ----------------------------------------------------------
/** Square cell dims (engine: colWidth px = w*7, rowHeight px = pt*96/72). */
export function squareDims(px: number): {width: number; height: number} {
    return {width: px / 7, height: (px * 72) / 96}
}

export function cellKey(c: {row: number; col: number}): string {
    return c.row + ':' + c.col
}

// ---- color helpers -----------------------------------------------------
function hexToRgb(hex: string): {red: number; green: number; blue: number} {
    let h = hex.startsWith('#') ? hex.slice(1) : hex
    if (h.length === 8) h = h.substring(2)
    return {
        red: parseInt(h.substring(0, 2), 16),
        green: parseInt(h.substring(2, 4), 16),
        blue: parseInt(h.substring(4, 6), 16),
    }
}

/**
 * Pick a legible text color (near-black / white) for a given background hex.
 * Returns the engine's "standard ARGB" string (8 hex digits, no '#') so it can
 * be handed straight to `setFontColor`.
 */
export function contrastText(hex: string): string {
    const {red, green, blue} = hexToRgb(hex)
    // WCAG relative luminance (gamma-corrected sRGB). A raw 0.299/0.587/0.114
    // average misjudges saturated mid-tones — it picks WHITE on cyan/green/blue,
    // where black actually has far higher contrast (white-on-#00ACC1 is only
    // 2.7:1). Compare both text colors and take the more legible; the
    // black/white crossover is at L ≈ 0.179 (= sqrt(1.05·0.05) − 0.05).
    const lin = (c: number): number => {
        const s = c / 255
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    const L = 0.2126 * lin(red) + 0.7152 * lin(green) + 0.0722 * lin(blue)
    return L > 0.179 ? 'FF111111' : 'FFFFFFFF'
}

// ---- transactions ------------------------------------------------------
async function commit(
    workbook: Workbook,
    payloads: readonly EditPayload[]
): Promise<void> {
    if (payloads.length === 0) return
    const r = (await workbook.handleTransaction({
        // Game display is throwaway — never undoable, never persisted intent.
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
    hex: string | null
): EditPayload {
    const ty = hex
        ? {setPatternFill: {patternType: 'solid', fgColor: hexToRgb(hex)}}
        : {setPatternFill: {patternType: 'none'}}
    return {type: 'cellStyleUpdate', value: {sheetIdx, row, col, ty}} as EditPayload
}

function numberStylePayload(
    sheetIdx: number,
    row: number,
    col: number,
    fontHex: string
): EditPayload {
    return {
        type: 'cellStyleUpdate',
        value: {
            sheetIdx,
            row,
            col,
            ty: {
                setFontColor: fontHex,
                setFontBold: true,
                setFontSize: 16,
                setAlignment: {horizontal: 'center', vertical: 'center'},
            },
        },
    } as EditPayload
}

function inputPayload(
    sheetIdx: number,
    row: number,
    col: number,
    content: string
): EditPayload {
    return {type: 'cellInput', value: {sheetIdx, row, col, content}} as EditPayload
}

/** Payloads to light one cell up with its color/number. */
export function showCellPayloads(
    sheetIdx: number,
    cell: RoundCell
): EditPayload[] {
    const out: EditPayload[] = []
    const bgHex =
        cell.color !== undefined ? COLORS[cell.color].hex : '#ECEFF1' // pale for number-only
    out.push(fillPayload(sheetIdx, cell.row, cell.col, bgHex))
    if (cell.number !== undefined) {
        out.push(numberStylePayload(sheetIdx, cell.row, cell.col, contrastText(bgHex)))
        out.push(inputPayload(sheetIdx, cell.row, cell.col, String(cell.number)))
    }
    return out
}

/** Payloads to clear one cell (fill + content). */
export function clearCellPayloads(
    sheetIdx: number,
    row: number,
    col: number
): EditPayload[] {
    return [fillPayload(sheetIdx, row, col, null), inputPayload(sheetIdx, row, col, '')]
}

/** Show a group of cells at once. */
export async function showCells(
    workbook: Workbook,
    sheetIdx: number,
    cells: RoundCell[]
): Promise<void> {
    await commit(workbook, cells.flatMap((c) => showCellPayloads(sheetIdx, c)))
}

/** Clear a group of cells. */
export async function clearCells(
    workbook: Workbook,
    sheetIdx: number,
    cells: {row: number; col: number}[]
): Promise<void> {
    await commit(
        workbook,
        cells.flatMap((c) => clearCellPayloads(sheetIdx, c.row, c.col))
    )
}

/** Wipe the whole 8x8 board (fill + content). */
export async function clearBoard(
    workbook: Workbook,
    sheetIdx: number
): Promise<void> {
    const payloads: EditPayload[] = []
    for (let r = 0; r < BOARD_SIZE; r++)
        for (let c = 0; c < BOARD_SIZE; c++)
            payloads.push(...clearCellPayloads(sheetIdx, r, c))
    await commit(workbook, payloads)
}

/** Fill a single cell a flat color (used for the player's pick markers). */
export async function paintMark(
    workbook: Workbook,
    sheetIdx: number,
    row: number,
    col: number,
    hex: string | null
): Promise<void> {
    await commit(workbook, [fillPayload(sheetIdx, row, col, hex)])
}

// Border styling for the whole 8x8 region: every cell gets a light grid on all
// four sides, and cells on the outer edge get a darker, thicker boundary. Fill
// / number / marker updates only touch pattern-fill/font/content, so these
// borders persist through the whole game and always frame the play area.
function boardBorderPayloads(sheetIdx: number): EditPayload[] {
    const out: EditPayload[] = []
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const top = r === 0
            const bottom = r === BOARD_SIZE - 1
            const left = c === 0
            const right = c === BOARD_SIZE - 1
            out.push({
                type: 'cellStyleUpdate',
                value: {
                    sheetIdx,
                    row: r,
                    col: c,
                    ty: {
                        setTopBorderStyle: top ? 'thick' : 'thin',
                        setTopBorderColor: top ? BOUND_HEX : GRID_HEX,
                        setBottomBorderStyle: bottom ? 'thick' : 'thin',
                        setBottomBorderColor: bottom ? BOUND_HEX : GRID_HEX,
                        setLeftBorderStyle: left ? 'thick' : 'thin',
                        setLeftBorderColor: left ? BOUND_HEX : GRID_HEX,
                        setRightBorderStyle: right ? 'thick' : 'thin',
                        setRightBorderColor: right ? BOUND_HEX : GRID_HEX,
                    },
                },
            } as EditPayload)
        }
    }
    return out
}

/**
 * Ensure the board sheet exists (create + size to squares on first use), frame
 * the 8x8 play area with a visible border, and return its index. Never deletes
 * — levels reuse the same sheet and clear it. Borders are (re)applied each call;
 * that's idempotent and cheap.
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
        const payloads: EditPayload[] = []
        for (let c = 0; c < BOARD_SIZE; c++)
            payloads.push({
                type: 'setColWidth',
                value: {sheetIdx: idx, col: c, width},
            } as EditPayload)
        for (let r = 0; r < BOARD_SIZE; r++)
            payloads.push({
                type: 'setRowHeight',
                value: {sheetIdx: idx, row: r, height},
            } as EditPayload)
        await commit(workbook, payloads)
    }
    await commit(workbook, boardBorderPayloads(idx))
    return idx
}

// ---- round generation --------------------------------------------------
function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
}
function randInt(n: number): number {
    return Math.floor(Math.random() * n)
}
function otherColor(target: number, palette: number): number {
    let c = randInt(palette)
    while (c === target) c = randInt(palette)
    return c
}
function otherNumber(target: number, max: number): number {
    let n = 1 + randInt(max)
    while (n === target) n = 1 + randInt(max)
    return n
}

/**
 * Build a round for the given level. The QUESTIONED attribute is generated to
 * match exactly `answerCount` cells; every other cell is a distractor that does
 * NOT match, so the answer set is unambiguous.
 */
export function generateRound(spec: LevelSpec): Round {
    const all: {row: number; col: number}[] = []
    for (let r = 0; r < BOARD_SIZE; r++)
        for (let c = 0; c < BOARD_SIZE; c++) all.push({row: r, col: c})
    const cells: RoundCell[] = shuffle(all).slice(0, spec.n)

    const answerIdx = shuffle([...cells.keys()]).slice(0, spec.answerCount)
    const answerSet = new Set(answerIdx)

    const P = spec.paletteSize
    const R = spec.numberMax
    const targetColor = P > 0 ? randInt(P) : 0
    const targetNumber = R > 0 ? 1 + randInt(R) : 0

    cells.forEach((cell, i) => {
        const isAns = answerSet.has(i)
        if (spec.mode === 'color') {
            cell.color = isAns ? targetColor : otherColor(targetColor, P)
        } else if (spec.mode === 'number') {
            cell.number = isAns ? targetNumber : otherNumber(targetNumber, R)
        } else {
            // both are shown; the question decides which is constrained
            if (spec.question === 'color') {
                cell.color = isAns ? targetColor : otherColor(targetColor, P)
                cell.number = 1 + randInt(R)
            } else if (spec.question === 'number') {
                cell.number = isAns ? targetNumber : otherNumber(targetNumber, R)
                cell.color = randInt(P)
            } else {
                if (isAns) {
                    cell.color = targetColor
                    cell.number = targetNumber
                } else {
                    let cc = randInt(P)
                    let nn = 1 + randInt(R)
                    while (cc === targetColor && nn === targetNumber) {
                        cc = randInt(P)
                        nn = 1 + randInt(R)
                    }
                    cell.color = cc
                    cell.number = nn
                }
            }
        }
    })

    return {
        cells,
        order: shuffle([...cells.keys()]),
        answerCells: answerIdx.map((i) => cells[i]),
        question: buildQuestion(spec, targetColor, targetNumber),
    }
}

function buildQuestion(
    spec: LevelSpec,
    colorIdx: number,
    number: number
): Round['question'] {
    const count = spec.answerCount
    const suffix = count > 1 ? `（共 ${count} 个）` : ''
    if (spec.question === 'color') {
        return {
            type: 'color',
            colorIdx,
            count,
            text: `选出出现过 ${COLORS[colorIdx].name} 色的格子${suffix}`,
        }
    }
    if (spec.question === 'number') {
        return {
            type: 'number',
            number,
            count,
            text: `选出出现过数字 ${number} 的格子${suffix}`,
        }
    }
    return {
        type: 'both',
        colorIdx,
        number,
        count,
        text: `选出 ${COLORS[colorIdx].name} 色、且数字为 ${number} 的格子${suffix}`,
    }
}

// ---- progress (craft-state) --------------------------------------------
export interface Progress {
    /** Next level to play, 1..TOTAL_LEVELS (or TOTAL_LEVELS+1 when all cleared). */
    level: number
    /** Highest level cleared, 0..TOTAL_LEVELS. */
    best: number
}

export function parseProgress(json: string | undefined): Progress {
    if (json) {
        try {
            const p = JSON.parse(json)
            const level = clampInt(p.level, 1, TOTAL_LEVELS + 1, 1)
            const best = clampInt(p.best, 0, TOTAL_LEVELS, 0)
            return {level, best}
        } catch {
            /* fall through to default */
        }
    }
    return {level: 1, best: 0}
}

export function serializeProgress(p: Progress): string {
    return JSON.stringify(p)
}

function clampInt(v: unknown, min: number, max: number, dflt: number): number {
    const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : dflt
    return Math.max(min, Math.min(max, n))
}
