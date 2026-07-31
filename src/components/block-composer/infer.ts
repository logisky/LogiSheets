import type {Value} from 'logisheets-engine'
import type {FieldSetting, FieldTypeEnum} from 'logisheets-core'

/**
 * Schema inference for the Ctrl+T "convert selection to block" flow.
 *
 * Given the typed values of a rectangular selection, guess field names and
 * types so the composer opens pre-filled instead of blank. The result is only
 * a starting point — the user confirms/edits everything in the composer before
 * the block is actually created.
 */

/** One cell's typed value plus its number-format string (for date detection). */
export interface InferCell {
    value: Value
    /** The cell's number format (`Style.formatter`); '' when none. */
    numFmt?: string
}

/** The primitive field types we can infer from raw cell data. */
type Primitive = 'number' | 'datetime' | 'boolean' | 'string'

// A number whose format carries date/time tokens is a date, not a plain number.
// Heuristic only — quoted literals and [color]/[condition] sections are stripped
// first so their letters don't trip the token check. 'm' alone is ambiguous
// (month vs minute vs the "0.00" literal), so we key off y/d and time patterns.
export function looksLikeDateFormat(fmt: string): boolean {
    if (!fmt) return false
    const f = fmt.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '')
    return /[yd]/i.test(f) || /h.*:/i.test(f) || /:mm/i.test(f)
}

function isNonEmptyText(cell: InferCell): boolean {
    return (
        cell.value !== 'empty' &&
        cell.value.type === 'str' &&
        cell.value.value.trim() !== ''
    )
}

// Classify a single cell, or null when it carries no type signal (empty/error).
function classify(cell: InferCell): Primitive | null {
    const v = cell.value
    if (v === 'empty') return null
    switch (v.type) {
        case 'bool':
            return 'boolean'
        case 'number':
            return looksLikeDateFormat(cell.numFmt ?? '') ? 'datetime' : 'number'
        case 'str':
            return 'string'
        default:
            return null // error → no signal
    }
}

// Reduce a column's per-cell primitives to one field type. Numbers and dates
// may coexist in a "numeric" column; any other mix falls back to string.
function columnType(cells: InferCell[]): Primitive {
    const seen = new Set<Primitive>()
    for (const c of cells) {
        const t = classify(c)
        if (t) seen.add(t)
    }
    if (seen.size === 0) return 'string'
    if (seen.size === 1) return [...seen][0]
    if ([...seen].every((t) => t === 'number' || t === 'datetime')) {
        return seen.has('number') ? 'number' : 'datetime'
    }
    return 'string'
}

export interface InferResult {
    fields: FieldSetting[]
    /**
     * True when row 0 was treated as field-name headers (and so is excluded
     * from the block's records). The caller must convert only rows 1..n.
     */
    hasHeader: boolean
}

/**
 * Infer a block schema from a rectangular region's cells (row-major:
 * `grid[row][col]`).
 *
 * Row 0 is used as field names when it *looks like a header*: every cell is
 * non-empty text AND at least one column's body (rows 1..n) is a non-string
 * type — i.e. the row-0 strings are labels sitting over typed data. This
 * conservative rule avoids silently dropping a real data row from an all-text
 * table. Otherwise fields are named "Field N" and every row is a record.
 *
 * Column types are inferred from the data rows. Only string/number/datetime/
 * boolean are produced; richer types (enum, refs, image) are left for the user.
 */
export function inferFields(grid: InferCell[][]): InferResult {
    const rowCnt = grid.length
    const colCnt = rowCnt > 0 ? grid[0].length : 0
    if (colCnt === 0) return {fields: [], hasHeader: false}

    const column = (c: number, fromRow: number): InferCell[] => {
        const out: InferCell[] = []
        for (let r = fromRow; r < rowCnt; r++) out.push(grid[r][c])
        return out
    }

    const headerCandidate = rowCnt >= 2 && grid[0].every(isNonEmptyText)
    const bodyHasTyped =
        headerCandidate &&
        Array.from({length: colCnt}, (_, c) =>
            columnType(column(c, 1))
        ).some((t) => t !== 'string')
    const hasHeader = headerCandidate && bodyHasTyped

    const dataFrom = hasHeader ? 1 : 0
    const fields: FieldSetting[] = []
    for (let c = 0; c < colCnt; c++) {
        const headerCell = grid[0][c].value
        const name =
            hasHeader && headerCell !== 'empty' && headerCell.type === 'str'
                ? headerCell.value.trim() || `Field ${c + 1}`
                : `Field ${c + 1}`
        fields.push({
            id: String(c + 1),
            name,
            type: columnType(column(c, dataFrom)) as FieldTypeEnum,
            required: false,
            primary: c === 0,
        })
    }
    return {fields, hasHeader}
}
