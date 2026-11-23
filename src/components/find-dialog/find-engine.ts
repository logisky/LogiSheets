/**
 * Find engine — scans a worksheet's used range for cells whose displayed
 * value matches a query, mirroring Excel's Ctrl+F "Find All" semantics.
 *
 * It does NOT touch the Rust engine: it drives the existing worker RPCs
 * `getSheetDimension` (used-range bounds) and `getCells` (a dense, row-major
 * read of a rectangle). Matches come back in row-major order so navigation
 * and the "x of y" counter can share one scan.
 *
 * Known limitation: we search the raw cell value (numbers via `String(n)`,
 * bools as TRUE/FALSE, errors verbatim), NOT the number-formatted display
 * string. A cell formatted as `1,200` or a date still matches on its
 * underlying value (`1200`). Formula text is not searched; a match whose
 * VALUE comes from a formula is flagged so Replace can leave it alone.
 */

import type {Engine} from 'logisheets-engine'
import type {Value} from 'logisheets-web'
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

/** A match as the scan saw it: what was searched, and where it came from. */
export interface FoundCell extends FindMatch {
    /** The searched text (see {@link valueToSearchString}). */
    text: string
    /** The value is a formula's result — replacing it would destroy the
     *  formula, so Replace skips these. */
    isFormula: boolean
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

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Build the rewrite Replace applies to one matched cell's text, honoring the
 * same options as {@link buildMatcher}: every occurrence is replaced (Excel's
 * Replace works within the cell, not on the first hit), "whole cell" swaps the
 * entire text, and a regex replacement may use `$1`-style groups. A literal
 * replacement is inserted verbatim — `$` in it means nothing. Throws on an
 * invalid regex, like buildMatcher.
 */
export function buildReplacer(
    query: string,
    replacement: string,
    opts: FindOptions
): (text: string) => string {
    const flags = opts.matchCase ? 'g' : 'gi'
    if (opts.useRegex) {
        const pattern = opts.wholeCell ? `^(?:${query})$` : query
        const re = new RegExp(pattern, flags)
        return (text) => text.replace(re, replacement)
    }
    if (opts.wholeCell) return () => replacement
    const re = new RegExp(escapeRegExp(query), flags)
    return (text) => text.replace(re, () => replacement)
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
): Promise<FoundCell[]> {
    const wb = engine.getWorkbook()
    const dim = await wb.getSheetDimension(sheetIdx)
    if (isErrorMessage(dim)) return []

    const {maxRow, maxCol} = dim
    const cols = maxCol + 1
    const bandRows = Math.max(1, Math.floor(TARGET_COORDS_PER_REQUEST / cols))
    const matches: FoundCell[] = []

    for (let startRow = 0; startRow <= maxRow; startRow += bandRows) {
        if (signal?.cancelled) return matches
        const endRow = Math.min(startRow + bandRows - 1, maxRow)

        // Dense and row-major, so the position in the list is the address.
        const cells = await wb.getCells({
            sheetIdx,
            startRow,
            startCol: 0,
            endRow,
            endCol: maxCol,
        })
        if (isErrorMessage(cells)) continue

        cells.forEach((cell, i) => {
            const text = valueToSearchString(cell.value)
            if (text !== '' && matcher(text)) {
                matches.push({
                    row: startRow + Math.floor(i / cols),
                    col: i % cols,
                    text,
                    isFormula: cell.formula !== '',
                })
            }
        })
    }
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
