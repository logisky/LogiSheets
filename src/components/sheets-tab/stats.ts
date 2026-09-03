/**
 * The status bar's selection summary.
 *
 * Kept out of the component because the interesting parts are decisions, not
 * rendering: which selections are worth summarising at all, what counts as a
 * number, and how to show a total without the strip reflowing as it changes.
 */
import type {CellInfo} from 'logisheets-engine'

export interface SelectionStats {
    /** How many cells in the range hold a number. */
    count: number
    sum: number
}

/**
 * Past this many cells a selection is a range, not a question about totals.
 * Someone who selected a whole column wants the column; fetching a million
 * cells to add them up would stall the strip for an answer nobody asked for.
 */
export const CELL_STATS_LIMIT = 20000

export interface StatsRange {
    startRow: number
    startCol: number
    endRow: number
    endCol: number
}

/**
 * Whether a range is worth fetching. A single cell is excluded on purpose:
 * summing one number tells you what you can already read, and Excel says
 * nothing there either.
 */
export function shouldSummarise(range: StatsRange | undefined): boolean {
    if (!range) return false
    const rows = Math.abs(range.endRow - range.startRow) + 1
    const cols = Math.abs(range.endCol - range.startCol) + 1
    const cells = rows * cols
    return cells >= 2 && cells <= CELL_STATS_LIMIT
}

/**
 * Sum and count the numeric cells of a range. Text, booleans, errors and
 * blanks are skipped rather than coerced — a column of "12 apples" has no
 * total, and counting blanks as zero would drag every average down.
 *
 * Returns `null` when nothing in the range is numeric, which is the signal to
 * show no summary at all.
 */
export function cellRangeStats(
    cells: readonly CellInfo[]
): SelectionStats | null {
    let count = 0
    let sum = 0
    for (const cell of cells) {
        const v = cell.value
        if (v !== 'empty' && v.type === 'number') {
            count += 1
            sum += v.value
        }
    }
    return count > 0 ? {count, sum} : null
}

/**
 * A total sized for a status bar: grouped, at most two decimals, and never
 * scientific — the strip is a glance, not a readout, and a number that changes
 * width as you drag makes the whole row jitter.
 */
export function formatStat(n: number): string {
    if (!Number.isFinite(n)) return '—'
    const rounded = Math.round(n * 100) / 100
    return rounded.toLocaleString('en-US', {maximumFractionDigits: 2})
}
