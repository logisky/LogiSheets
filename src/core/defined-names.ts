/**
 * Defined names, app side: reading them, committing the three payloads, and
 * the two conversions the UI needs — a selection to the text a name refers to,
 * and a name's definition back to a range to select.
 *
 * The engine owns the rules (what a valid name is, cycles, case-insensitivity);
 * this module only shuttles text and reports the engine's reason when it says no.
 */

import type {
    DataService,
    DefinedNameInfo,
    Payload,
    SelectedData,
} from 'logisheets-engine'
import {
    buildSelectedDataFromCellRange,
    isErrorMessage,
    qualifyReference,
    toA1notation,
} from 'logisheets-engine'
import {tx} from '@/core/transaction'

export interface NameRange {
    sheetName: string
    startRow: number
    startCol: number
    endRow: number
    endCol: number
}

/** `Sheet1!$A$1:$B$3` (or `Sheet1!$A$1` for one cell), sheet-quoted as needed. */
export function rangeRefersTo(r: NameRange): string {
    const cell = (row: number, col: number) =>
        `$${toA1notation(col)}$${row + 1}`
    const single = r.startRow === r.endRow && r.startCol === r.endCol
    const body = single
        ? cell(r.startRow, r.startCol)
        : `${cell(r.startRow, r.startCol)}:${cell(r.endRow, r.endCol)}`
    return qualifyReference(body, r.sheetName)
}

const RANGE_RE =
    /^(?:'((?:[^']|'')+)'|([^!':]+))!\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/i

function colIndex(letters: string): number {
    let n = 0
    for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
    return n - 1
}

/**
 * The range a definition names, when it is a plain sheet-qualified cell or
 * rectangle — what the engine hands back for a named range. `undefined` for
 * constants and expressions, which have nothing to select.
 */
export function parseNameRange(formula: string): NameRange | undefined {
    const m = formula.trim().replace(/^=/, '').match(RANGE_RE)
    if (!m) return undefined
    const sheetName = m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2]
    const r1 = parseInt(m[4], 10) - 1
    const c1 = colIndex(m[3])
    const r2 = m[6] !== undefined ? parseInt(m[6], 10) - 1 : r1
    const c2 = m[5] !== undefined ? colIndex(m[5]) : c1
    return {
        sheetName,
        startRow: Math.min(r1, r2),
        startCol: Math.min(c1, c2),
        endRow: Math.max(r1, r2),
        endCol: Math.max(c1, c2),
    }
}

export async function loadDefinedNames(
    dataSvc: DataService
): Promise<readonly DefinedNameInfo[]> {
    const r = await dataSvc.getWorkbook().getDefinedNames()
    return isErrorMessage(r) ? [] : r
}

export function findDefinedName(
    names: readonly DefinedNameInfo[],
    name: string
): DefinedNameInfo | undefined {
    const upper = name.trim().toUpperCase()
    return names.find((n) => n.name.toUpperCase() === upper)
}

/**
 * Commit one name payload as an undoable transaction. Resolves to the engine's
 * reason on rejection (an invalid name, a formula that does not parse), else
 * `undefined`.
 */
export async function commitNamePayload(
    dataSvc: DataService,
    payload: Payload
): Promise<string | undefined> {
    const transaction = tx([payload], true)
    const r = await dataSvc
        .getWorkbook()
        .handleTransaction({transaction, temp: transaction.temp})
    if (isErrorMessage(r)) return r.msg
    if (r.status.type === 'err') return r.errorMessage || 'rejected'
    return undefined
}

/**
 * Select a named range: switch to its sheet if it is not the current one, then
 * select the rectangle. The selection waits a frame so it lands on the newly
 * shown sheet rather than being reset by the switch.
 */
export async function goToNameRange(
    dataSvc: DataService,
    range: NameRange,
    currentSheetIdx: number,
    setActiveSheet: ((idx: number) => void) | undefined,
    setSelection: (d: SelectedData) => void
): Promise<boolean> {
    const sheets = await dataSvc.getWorkbook().getAllSheetInfo()
    if (isErrorMessage(sheets)) return false
    const idx = sheets.findIndex((s) => s.name === range.sheetName)
    if (idx < 0) return false
    if (idx !== currentSheetIdx) {
        if (!setActiveSheet) return false
        setActiveSheet(idx)
    }
    requestAnimationFrame(() =>
        setSelection(
            buildSelectedDataFromCellRange(
                range.startRow,
                range.startCol,
                range.endRow,
                range.endCol,
                'editbar'
            )
        )
    )
    return true
}
