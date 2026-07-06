/**
 * Find engine — scans a worksheet's used range for cells whose displayed
 * value matches a query, mirroring Excel's Ctrl+F "Find All" semantics.
 *
 * It does NOT touch the Rust engine: it drives the existing worker RPCs
 * `getSheetDimension` (used-range bounds) and `getReproducibleCells`
 * (batch value read that, unlike `getDisplayWindow`, returns each cell's
 * coordinate). Matches come back in row-major order so navigation and the
 * "x of y" counter can share one scan.
 *
 * Known limitation: we search the raw cell value (numbers via `String(n)`,
 * bools as TRUE/FALSE, errors verbatim), NOT the number-formatted display
 * string. A cell formatted as `1,200` or a date still matches on its
 * underlying value (`1200`). Formula text is also not searched — the batch
 * reader doesn't return it.
 */

import type {Engine} from 'logisheets-engine'
import type {Value, SheetCoordinate} from 'logisheets-web'
import {isErrorMessage} from 'logisheets-web'

export interface FindOptions {
    matchCase: boolean
    /** Match only when the whole cell value equals the query. */
    wholeCell: boolean
    /** Interpret the query as a JavaScript regular expression. */
    useRegex: boolean
}

export interface FindMatch {
    row: number
    col: number
}

/** A cancellation flag the caller can flip to abort an in-flight scan. */
export interface FindSignal {
    cancelled: boolean
}

// Coordinates enumerated per worker round-trip. Bounds the postMessage
// payload while keeping the number of round-trips low on typical sheets.
const TARGET_COORDS_PER_REQUEST = 20000

/**
 * Convert a cell value to the string we search against. Empty cells become
 * '' and are never matched (Excel's Find skips blank cells).
 */
export function valueToSearchString(v: Value): string {
    if (v === 'empty') return ''
    switch (v.type) {
        case 'str':
            return v.value
        case 'number':
            return String(v.value)
        case 'bool':
            return v.value ? 'TRUE' : 'FALSE'
        case 'error':
            return v.value
        default:
            return ''
    }
}

/**
 * Build a predicate for the query + options. Throws if `useRegex` is set and
 * the query is not a valid regular expression — callers should surface that
 * to the user.
 */
export function buildMatcher(
    query: string,
    opts: FindOptions
): (text: string) => boolean {
    if (opts.useRegex) {
        const flags = opts.matchCase ? '' : 'i'
        const pattern = opts.wholeCell ? `^(?:${query})$` : query
        const re = new RegExp(pattern, flags)
        return (text) => re.test(text)
    }
    const needle = opts.matchCase ? query : query.toLowerCase()
    return (text) => {
        const hay = opts.matchCase ? text : text.toLowerCase()
        return opts.wholeCell ? hay === needle : hay.includes(needle)
    }
}

/**
 * Scan the sheet's used range and return every matching cell in row-major
 * order. Yields between row bands so the caller can cancel via `signal`.
 */
export async function findAllMatches(
    engine: Engine,
    sheetIdx: number,
    matcher: (text: string) => boolean,
    signal?: FindSignal
): Promise<FindMatch[]> {
    const wb = engine.getWorkbook()
    const dim = await wb.getSheetDimension(sheetIdx)
    if (isErrorMessage(dim)) return []

    const {maxRow, maxCol} = dim
    const cols = maxCol + 1
    const bandRows = Math.max(1, Math.floor(TARGET_COORDS_PER_REQUEST / cols))
    const matches: FindMatch[] = []

    for (let startRow = 0; startRow <= maxRow; startRow += bandRows) {
        if (signal?.cancelled) return matches
        const endRow = Math.min(startRow + bandRows - 1, maxRow)

        const coordinates: SheetCoordinate[] = []
        for (let r = startRow; r <= endRow; r++) {
            for (let c = 0; c <= maxCol; c++) {
                coordinates.push({row: r, col: c})
            }
        }

        const cells = await wb.getReproducibleCells({sheetIdx, coordinates})
        if (isErrorMessage(cells)) continue

        for (const cell of cells) {
            const text = valueToSearchString(cell.value)
            if (text !== '' && matcher(text)) {
                matches.push({
                    row: cell.coordinate.row,
                    col: cell.coordinate.col,
                })
            }
        }
    }

    // getReproducibleCells doesn't guarantee input order — sort so navigation
    // and the counter see a stable row-major sequence.
    matches.sort((a, b) => a.row - b.row || a.col - b.col)
    return matches
}

/**
 * Index of the first match at or after `from`, scanning in the given
 * direction and wrapping around the ends. Returns -1 only for an empty list.
 */
export function findAdjacentIndex(
    matches: readonly FindMatch[],
    from: FindMatch,
    direction: 'next' | 'prev'
): number {
    if (matches.length === 0) return -1
    const cmp = (m: FindMatch) =>
        m.row === from.row ? m.col - from.col : m.row - from.row

    if (direction === 'next') {
        for (let i = 0; i < matches.length; i++) {
            if (cmp(matches[i]) >= 0) return i
        }
        return 0 // wrap to the top
    }
    for (let i = matches.length - 1; i >= 0; i--) {
        if (cmp(matches[i]) <= 0) return i
    }
    return matches.length - 1 // wrap to the bottom
}
