// fuse-beads craft — pure, host-agnostic helpers.
//
// The DOM/UI and the canvas-input wiring live in index.html (same pattern as
// the other crafts). This module owns the palette data and the small amount of
// spreadsheet math/transactions: turning a hex color into a fill payload,
// computing square cell dimensions, and (re)building the bead board sheet.
//
// Everything here talks to the injected `window.workbook` (a logisheets-web
// Client proxy). We keep its type loose (`Workbook`) because the craft only
// ever needs `getAllSheetInfo` + `handleTransaction`.

import type {EditPayload, SheetInfo} from 'logisheets-web'
import {PALETTE, BEAD_BY_CODE} from './palette'

export {PALETTE, BEAD_BY_CODE}
export type {Bead, BeadCategory} from './palette'

// The subset of the injected workbook proxy we rely on.
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

export interface BoardOptions {
    /** Worksheet name for the board. */
    name: string
    /** Number of rows to shape into squares. */
    rows: number
    /** Number of columns to shape into squares. */
    cols: number
    /** Square side length in px (at zoom = 1). */
    sidePx: number
}

export const DEFAULT_BOARD: BoardOptions = {
    name: '拼豆板',
    rows: 120,
    cols: 120,
    sidePx: 22,
}

/** #RRGGBB (or #AARRGGBB) → {red,green,blue} in 0–255, matching the core. */
export function hexToColor(hex: string): {
    red: number
    green: number
    blue: number
} {
    let h = hex.startsWith('#') ? hex.slice(1) : hex
    if (h.length === 8) h = h.substring(2) // drop leading alpha
    return {
        red: parseInt(h.substring(0, 2), 16),
        green: parseInt(h.substring(2, 4), 16),
        blue: parseInt(h.substring(4, 6), 16),
    }
}

// The engine converts workbook units to px as: colWidth px = width * 7, and
// rowHeight px = pt * 96 / 72 (see packages/engine .../utils.ts). Invert both so
// a cell renders as a `sidePx`-by-`sidePx` square at 100% zoom.
export function squareDims(sidePx: number): {width: number; height: number} {
    return {width: sidePx / 7, height: (sidePx * 72) / 96}
}

/** A single-cell fill payload. Pass hex = null to clear the fill (eraser). */
export function fillPayload(
    sheetIdx: number,
    row: number,
    col: number,
    hex: string | null
): EditPayload {
    const ty = hex
        ? {setPatternFill: {patternType: 'solid', fgColor: hexToColor(hex)}}
        : {setPatternFill: {patternType: 'none'}}
    return {
        type: 'cellStyleUpdate',
        value: {sheetIdx, row, col, ty},
    } as EditPayload
}

/** Paint one bead (or erase). Its own undoable step so Ctrl+Z lifts one bead. */
export async function paintCell(
    workbook: Workbook,
    sheetIdx: number,
    row: number,
    col: number,
    hex: string | null
): Promise<void> {
    await workbook.handleTransaction({
        transaction: {
            payloads: [fillPayload(sheetIdx, row, col, hex)],
            undoable: true,
            temp: false,
        },
    })
}

function asSheetInfos(v: unknown): SheetInfo[] {
    return Array.isArray(v) ? (v as SheetInfo[]) : []
}

// handleTransaction resolves with an ActionEffect even when the engine rejects
// the payload (status.type === 'err') — it does NOT throw. Surface that as an
// error so callers don't silently proceed on a no-op (this is exactly how the
// old "createSheet on a reused name" failure stayed invisible).
async function commit(
    workbook: Workbook,
    payloads: readonly EditPayload[]
): Promise<void> {
    const r = (await workbook.handleTransaction({
        transaction: {payloads, undoable: true, temp: false},
    })) as {status?: {type?: string; value?: unknown}} | null
    const status = r && r.status
    if (status && status.type === 'err') {
        throw new Error(`transaction rejected (status err ${status.value ?? ''})`)
    }
}

/** Index of a sheet by name, or -1. */
export async function findSheetIdx(
    workbook: Workbook,
    name: string
): Promise<number> {
    const infos = asSheetInfos(await workbook.getAllSheetInfo())
    return infos.findIndex((s) => s.name === name)
}

/**
 * (Re)create the bead board: if a sheet with this name exists it is deleted and
 * rebuilt, then its first `rows`×`cols` cells are shaped into squares. Returns
 * the new sheet's index. Done in a few sequential transactions so we never have
 * to reason about index shifts inside a single transaction.
 */
export async function setupBoard(
    workbook: Workbook,
    opts: BoardOptions = DEFAULT_BOARD
): Promise<number> {
    const {name, rows, cols, sidePx} = opts

    const existing = await findSheetIdx(workbook, name)
    if (existing >= 0) {
        await commit(workbook, [{type: 'deleteSheet', value: {idx: existing}}])
    }

    const infos = asSheetInfos(await workbook.getAllSheetInfo())
    const newIdx = infos.length
    await commit(workbook, [
        {type: 'createSheet', value: {idx: newIdx, newName: name}},
    ])

    const {width, height} = squareDims(sidePx)
    const payloads: EditPayload[] = []
    for (let c = 0; c < cols; c++)
        payloads.push({
            type: 'setColWidth',
            value: {sheetIdx: newIdx, col: c, width},
        } as EditPayload)
    for (let r = 0; r < rows; r++)
        payloads.push({
            type: 'setRowHeight',
            value: {sheetIdx: newIdx, row: r, height},
        } as EditPayload)
    await commit(workbook, payloads)

    return newIdx
}
