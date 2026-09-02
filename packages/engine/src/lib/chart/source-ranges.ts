/**
 * Where a chart's numbers come from, as cell ranges the grid can outline.
 *
 * Selecting a chart in Excel draws a coloured border around each range that
 * feeds it — categories in one colour, every series in its own — which is how
 * you see at a glance what a chart is plotting and can tell two similar charts
 * apart. This module turns a `ChartInfo`'s references into those rectangles;
 * painting them is the grid's job.
 */
import type {ChartInfo} from 'logisheets-web'
import {toCssColor} from './to-option'

export interface CellRange {
    startRow: number
    startCol: number
    endRow: number
    endCol: number
}

/** What a highlighted range feeds. */
export type SourceKind = 'categories' | 'values' | 'sizes'

export interface ChartSourceRange {
    kind: SourceKind
    /** The series this belongs to; undefined for the shared categories. */
    seriesName?: string
    /**
     * The sheet the reference names, or undefined when it carries none — in
     * which case it means the sheet the chart sits on.
     */
    sheet?: string
    range: CellRange
    /** Outline colour: the series' own where it has one. */
    color: string
}

/**
 * Fallback outline colours, used when a series has no colour of its own. These
 * are ECharts' default palette, so an outline matches the bar it belongs to.
 */
const PALETTE = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de']

/** Categories are not a series, so they get a colour no series will take. */
const CATEGORY_COLOR = '#9254de'

/** `$B$2` / `B2` → zero-based (row, col). */
function parseA1Cell(s: string): {row: number; col: number} | undefined {
    const m = /^\$?([A-Za-z]{1,3})\$?([0-9]+)$/.exec(s.trim())
    if (!m) return undefined
    let col = 0
    for (const ch of m[1].toUpperCase()) {
        col = col * 26 + (ch.charCodeAt(0) - 64)
    }
    const row = Number(m[2])
    if (col === 0 || row === 0) return undefined
    return {row: row - 1, col: col - 1}
}

/**
 * Parse `[Sheet!]$C$R[:$C$R]`, the shape chart references take. The sheet name
 * may be quoted, in which case doubled apostrophes are literal ones. Corners
 * are normalized, so a reference written bottom-up still reads top-down.
 */
export function parseA1Range(
    ref: string
): {sheet?: string; range: CellRange} | undefined {
    const bang = ref.lastIndexOf('!')
    let sheet: string | undefined
    let body = ref
    if (bang >= 0) {
        let name = ref.slice(0, bang)
        if (name.length >= 2 && name.startsWith("'") && name.endsWith("'")) {
            name = name.slice(1, -1).replace(/''/g, "'")
        }
        sheet = name
        body = ref.slice(bang + 1)
    }
    const [a, b] = body.includes(':') ? body.split(':') : [body, body]
    const start = parseA1Cell(a)
    const end = parseA1Cell(b)
    if (!start || !end) return undefined
    return {
        sheet,
        range: {
            startRow: Math.min(start.row, end.row),
            startCol: Math.min(start.col, end.col),
            endRow: Math.max(start.row, end.row),
            endCol: Math.max(start.col, end.col),
        },
    }
}

/** The block of cells the grid currently has laid out, inclusive. */
export interface GridWindow {
    firstRow: number
    lastRow: number
    firstCol: number
    lastCol: number
}

/**
 * Whether any part of `range` falls inside the laid-out window.
 *
 * This has to be checked before drawing: the grid only knows the size of the
 * rows and columns it has rendered, so asking it where an off-screen range
 * sits gives the window's own edge — which would pin a bogus outline to the
 * top-left corner instead of letting the range scroll away. A partly visible
 * range is fine, and clamps to the edge on its own.
 */
export function isRangeVisible(range: CellRange, window: GridWindow): boolean {
    return (
        range.endRow >= window.firstRow &&
        range.startRow <= window.lastRow &&
        range.endCol >= window.firstCol &&
        range.startCol <= window.lastCol
    )
}

/**
 * Every range that feeds `info`, in the order they should be drawn: categories
 * first, then each series' values and (for a bubble chart) its sizes.
 * References that do not parse are skipped rather than guessed at.
 */
export function chartSourceRanges(info: ChartInfo): ChartSourceRange[] {
    const out: ChartSourceRange[] = []
    const push = (
        ref: string | undefined,
        kind: SourceKind,
        color: string,
        seriesName?: string
    ) => {
        if (!ref) return
        const parsed = parseA1Range(ref)
        if (!parsed) return
        out.push({kind, seriesName, sheet: parsed.sheet, range: parsed.range, color})
    }

    push(info.catRef, 'categories', CATEGORY_COLOR)
    info.series.forEach((s, i) => {
        const color = toCssColor(s.color) ?? PALETTE[i % PALETTE.length]
        push(s.valRef, 'values', color, s.name)
        push(s.sizeRef, 'sizes', color, s.name)
    })
    return out
}
