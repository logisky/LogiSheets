/**
 * Pure geometry/decision helpers behind the grid's mouse-wheel and
 * keyboard navigation.
 *
 * These live outside Spreadsheet.svelte so they can be unit-tested without a
 * worker, a canvas or a mounted component: everything here is a plain function
 * of its arguments. The component keeps the side effects (rendering, selecting)
 * and calls into these for the arithmetic that's easy to get subtly wrong —
 * wheel axis/units, fill source ranges, merge-aware selection growth.
 */

/** Minimal shape of the merged-cell records the grid hands us. */
export interface MergeRect {
    startRow: number
    startCol: number
    endRow: number
    endCol: number
}

export interface CellRect {
    startRow: number
    startCol: number
    endRow: number
    endCol: number
}

export interface CellPoint {
    row: number
    col: number
}

/** The wheel fields we care about — a WheelEvent satisfies this. */
export interface WheelLike {
    deltaX: number
    deltaY: number
    deltaMode: number
    shiftKey: boolean
}

/**
 * A wheel delta in px. Firefox reports deltaMode LINE (or, rarely, PAGE);
 * normalize so a notch means the same everywhere.
 */
export function wheelPx(delta: number, mode: number): number {
    if (mode === 1) return delta * 16 // lines
    if (mode === 2) return delta * 400 // pages
    return delta
}

/**
 * Scroll distance for a wheel event, in px, per axis.
 *
 * Shift+wheel scrolls horizontally — the convention everywhere else on the
 * web. Some browsers already swap the axes themselves while Shift is held, so
 * only do it when they haven't (deltaX still 0).
 */
export function wheelScroll(e: WheelLike): {dx: number; dy: number} {
    const dx = wheelPx(e.deltaX, e.deltaMode)
    const dy = wheelPx(e.deltaY, e.deltaMode)
    if (e.shiftKey && dx === 0) return {dx: dy, dy: 0}
    return {dx, dy}
}

/**
 * Zoom factor for one Ctrl/⌘+wheel (or pinch) step.
 *
 * Exponential so each notch is a constant PERCENTAGE step (zoom is
 * multiplicative) and so a pinch, which arrives as a stream of small deltas,
 * accumulates smoothly. The delta is clamped because a fast wheel or an
 * inertial scroll can report one huge value.
 */
export function wheelZoomFactor(
    current: number,
    deltaY: number,
    deltaMode: number
): number {
    const d = Math.max(-40, Math.min(40, wheelPx(deltaY, deltaMode)))
    return current * Math.exp(-d / 300)
}

/**
 * Source and target ranges for Ctrl/⌘+D (down) and Ctrl/⌘+R (right).
 *
 * A multi-row (or multi-column) selection fills from its own first line; a
 * single line pulls from the line just before it, matching Excel. Returns null
 * when there's nothing to pull from (a single line already at row/column 0).
 */
export function fillRanges(
    direction: 'down' | 'right',
    sel: CellRect
): {src: CellRect; dst: CellRect} | null {
    const startRow = Math.min(sel.startRow, sel.endRow)
    const endRow = Math.max(sel.startRow, sel.endRow)
    const startCol = Math.min(sel.startCol, sel.endCol)
    const endCol = Math.max(sel.startCol, sel.endCol)

    if (direction === 'down') {
        if (endRow > startRow)
            return {
                src: {startRow, startCol, endRow: startRow, endCol},
                dst: {startRow: startRow + 1, startCol, endRow, endCol},
            }
        if (startRow === 0) return null
        return {
            src: {startRow: startRow - 1, startCol, endRow: startRow - 1, endCol},
            dst: {startRow, startCol, endRow, endCol},
        }
    }

    if (endCol > startCol)
        return {
            src: {startRow, startCol, endRow, endCol: startCol},
            dst: {startRow, startCol: startCol + 1, endRow, endCol},
        }
    if (startCol === 0) return null
    return {
        src: {startRow, startCol: startCol - 1, endRow, endCol: startCol - 1},
        dst: {startRow, startCol, endRow, endCol},
    }
}

/** The merged cell containing (row, col), or null. */
export function mergeAt(
    merges: readonly MergeRect[] | undefined,
    row: number,
    col: number
): MergeRect | null {
    if (!merges) return null
    for (const m of merges) {
        if (
            m.startRow <= row &&
            row <= m.endRow &&
            m.startCol <= col &&
            col <= m.endCol
        )
            return m
    }
    return null
}

/**
 * Grow a rect until it fully covers every merged cell it touches — a selection
 * must never cut a merge in half. Loops because a merge pulled in at one edge
 * can itself touch another; it converges quickly, and the bound just stops a
 * pathological layout from spinning.
 */
export function expandRangeToMerges(
    rect: CellRect,
    merges: readonly MergeRect[] | undefined
): CellRect {
    if (!merges?.length) return rect
    let {startRow, startCol, endRow, endCol} = rect
    for (let i = 0; i < 8; i++) {
        let changed = false
        for (const m of merges) {
            const touches =
                m.startRow <= endRow &&
                m.endRow >= startRow &&
                m.startCol <= endCol &&
                m.endCol >= startCol
            if (!touches) continue
            if (m.startRow < startRow) (startRow = m.startRow), (changed = true)
            if (m.endRow > endRow) (endRow = m.endRow), (changed = true)
            if (m.startCol < startCol) (startCol = m.startCol), (changed = true)
            if (m.endCol > endCol) (endCol = m.endCol), (changed = true)
        }
        if (!changed) break
    }
    return {startRow, startCol, endRow, endCol}
}

/** The rect spanned by an extension anchor and focus. */
export function rangeFromCorners(anchor: CellPoint, focus: CellPoint): CellRect {
    return {
        startRow: Math.min(anchor.row, focus.row),
        startCol: Math.min(anchor.col, focus.col),
        endRow: Math.max(anchor.row, focus.row),
        endCol: Math.max(anchor.col, focus.col),
    }
}

/**
 * Where Shift+Arrow moves the focus corner. Steps past the merge the focus
 * sits in, or the selection would stall inside it. Returns null when the step
 * would leave the sheet.
 */
export function stepFocus(
    direction: 'up' | 'down' | 'left' | 'right',
    focus: CellPoint,
    merges: readonly MergeRect[] | undefined
): CellPoint | null {
    const m = mergeAt(merges, focus.row, focus.col)
    let {row, col} = focus
    switch (direction) {
        case 'up':
            row = (m ? m.startRow : row) - 1
            break
        case 'down':
            row = (m ? m.endRow : row) + 1
            break
        case 'left':
            col = (m ? m.startCol : col) - 1
            break
        case 'right':
            col = (m ? m.endCol : col) + 1
            break
    }
    if (row < 0 || col < 0) return null
    return {row, col}
}

/** A whole-row / whole-column selection, as the grid models it. */
export interface LineSelection {
    start: number
    end: number
    type: 'row' | 'col'
}

/**
 * Which lines Ctrl/⌘+Shift+= and Ctrl/⌘+- act on.
 *
 * A row/column selection acts on exactly those lines. A cell selection acts on
 * the entire ROWS it spans: Excel opens a dialog to resolve that ambiguity,
 * which the grid has no way to show, and rows are what "insert/delete" means
 * to most people. Returns null when nothing is selected.
 */
export function targetLines(
    lines: LineSelection | undefined,
    range: CellRect | undefined
): {axis: 'row' | 'col'; start: number; count: number} | null {
    if (lines) {
        const start = Math.min(lines.start, lines.end)
        const end = Math.max(lines.start, lines.end)
        return {axis: lines.type, start, count: end - start + 1}
    }
    if (range) {
        const start = Math.min(range.startRow, range.endRow)
        const end = Math.max(range.startRow, range.endRow)
        return {axis: 'row', start, count: end - start + 1}
    }
    return null
}

/** The payload type that inserts or deletes lines along `axis`. */
export function linePayloadType(
    kind: 'insert' | 'delete',
    axis: 'row' | 'col'
): 'insertRows' | 'insertCols' | 'deleteRows' | 'deleteCols' {
    if (kind === 'insert') return axis === 'row' ? 'insertRows' : 'insertCols'
    return axis === 'row' ? 'deleteRows' : 'deleteCols'
}

/** Which edge each axis aligns to when a move in `direction` scrolls. */
export function alignFor(direction: 'up' | 'down' | 'left' | 'right'): {
    v: 'top' | 'bottom'
    h: 'left' | 'right'
} {
    return direction === 'up' || direction === 'left'
        ? {v: 'top', h: 'left'}
        : {v: 'bottom', h: 'right'}
}
