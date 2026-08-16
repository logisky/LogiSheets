/**
 * @logicianSkill What-if analysis: preview how changing one cell's value ripples
 * through every dependent cell, without committing. Use when the user asks
 * "what happens if this cell were X?" or wants to see the downstream impact of a
 * value/formula change before making it.
 * @guidance Call preview_what_if with a temporary value to see the deltas; it
 * does not modify the sheet. Only use apply_what_if once the user confirms they
 * want the change committed.
 */

import type {Client, Value, Selection} from 'logisheets-web'
import {
    generateTransaction,
    generateValueChange,
    getTrendsThroughTempTransaction,
    getDisplayName,
    getDisplayValue,
    compareValues,
    cleanupTempStatus,
} from './src/index'

/**
 * The host-injected tool context. `workbook` is the live, permission-scoped
 * LogiSheets client — the same object the craft UI and Watson both operate. The
 * craft declares its own ctx so tools get the full `Client` type.
 */
export interface Ctx {
    workbook: Client
    signal: AbortSignal
    confirm: (message: string, detail?: unknown) => Promise<boolean>
    log: (msg: string) => void
}

/** One dependent cell's change, in a form the model can read directly. */
export interface CellDelta {
    /** Human-readable location, e.g. "Sheet1:B3". */
    cell: string
    /** The value before the change. */
    from: string
    /** The value after the change. */
    to: string
    /** Direction of the numeric change. */
    direction: 'up' | 'down' | 'same' | 'different'
}

async function summarizeTrends(
    wb: Client,
    trends: readonly {
        sheetIdx: number
        row: number
        col: number
        oldValue: Value
        newValue: Value
    }[]
): Promise<CellDelta[]> {
    const out: CellDelta[] = []
    for (const t of trends) {
        const cell = await getDisplayName(t.sheetIdx, t.row, t.col, wb)
        out.push({
            cell,
            from: getDisplayValue(t.oldValue),
            to: getDisplayValue(t.newValue),
            direction: compareValues(t.oldValue, t.newValue),
        })
    }
    return out
}

/**
 * @tool Preview how changing one cell's value would ripple through the sheet.
 * Applies the change in a temporary transaction and reports every dependent cell
 * that would change — the sheet is NOT modified.
 * @param sheetIdx Zero-based index of the sheet holding the cell to change.
 * @param row Zero-based row of the cell to change.
 * @param col Zero-based column of the cell to change.
 * @param newValue The value or formula to try in that cell (e.g. "42" or "=A1*2").
 * @mutates temp
 * @confirm never
 */
export async function previewWhatIf(
    ctx: Ctx,
    sheetIdx: number,
    row: number,
    col: number,
    newValue: string
): Promise<{changed: CellDelta[]}> {
    const wb = ctx.workbook
    const tx = generateTransaction([{sheetIdx, row, col, value: newValue}])
    const trends = await getTrendsThroughTempTransaction(wb, tx)
    const changed = await summarizeTrends(wb, trends)
    cleanupTempStatus(wb)
    return {changed}
}

/**
 * @tool Commit a value change to a cell (the non-preview version of the what-if:
 * actually writes the value). Use only after the user confirms.
 * @param sheetIdx Zero-based index of the sheet holding the cell.
 * @param row Zero-based row of the cell.
 * @param col Zero-based column of the cell.
 * @param newValue The value or formula to write.
 * @mutates true
 * @confirm always
 */
export async function applyWhatIf(
    ctx: Ctx,
    sheetIdx: number,
    row: number,
    col: number,
    newValue: string
): Promise<{applied: boolean}> {
    const tx = generateTransaction([{sheetIdx, row, col, value: newValue}])
    await ctx.workbook.handleTransaction({transaction: tx})
    return {applied: true}
}

// `generateValueChange` and `Selection` are re-exported so the craft UI can keep
// building changes from the current selection; the tools above take explicit
// coordinates so the model never depends on UI selection state.
export {generateValueChange}
export type {Selection}
