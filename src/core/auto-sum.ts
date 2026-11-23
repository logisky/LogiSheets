import {isErrorMessage, toA1notation, type DataService} from 'logisheets-engine'
import type {Payload} from 'logisheets-web'

/**
 * Excel's AutoSum, which guesses the range instead of asking: the
 * `=SUM(...)` for the cell at (`row`, `col`) over the run of numbers directly
 * above it, or failing that the run to its left. Null when neither neighbour
 * is a number. Shared by the toolbar button and the Alt+= shortcut.
 */
export async function autoSumPayload(
    dataSvc: DataService,
    sheetIdx: number,
    row: number,
    col: number
): Promise<Payload | null> {
    const numericAt = async (r: number, c: number) => {
        if (r < 0 || c < 0) return false
        const info = await dataSvc.getCellInfo(sheetIdx, r, c)
        if (isErrorMessage(info)) return false
        const v = info.toCellInfo().value
        return v !== 'empty' && v.type === 'number'
    }
    const input = (content: string) =>
        ({
            type: 'cellInput',
            value: {sheetIdx, row, col, content},
        }) as Payload
    // Walk up first; a single row of numbers to the left is the other shape
    // people expect.
    let top = row
    while (top > 0 && (await numericAt(top - 1, col))) top--
    if (top < row) {
        const c = toA1notation(col)
        return input(`=SUM($${c}$${top + 1}:$${c}$${row})`)
    }
    let left = col
    while (left > 0 && (await numericAt(row, left - 1))) left--
    if (left < col) {
        const r = row + 1
        return input(
            `=SUM($${toA1notation(left)}$${r}:$${toA1notation(col - 1)}$${r})`
        )
    }
    return null
}
