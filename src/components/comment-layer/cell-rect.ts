import type {Grid} from 'logisheets-engine'
import {
    xForColStart,
    xForColEnd,
    yForRowStart,
    yForRowEnd,
} from 'logisheets-engine'
import {LeftTop} from '@/core/settings'

export interface CellRect {
    x: number
    y: number
    width: number
    height: number
}

/**
 * Pixel rect (in this view's canvas space, including the frozen header offset)
 * for an absolute sheet cell, or `null` when the cell is scrolled out of the
 * visible window. Mirrors `craft-interaction/cell-rect.ts` but keys on absolute
 * (row, col) rather than block-relative coordinates.
 */
export function rectForCell(
    row: number,
    col: number,
    grid: Grid
): CellRect | null {
    const rowVisible = grid.rows.some((r: {idx: number}) => r.idx === row)
    const colVisible = grid.columns.some((c: {idx: number}) => c.idx === col)
    if (!rowVisible || !colVisible) return null
    const x = xForColStart(col, grid) + LeftTop.width
    const y = yForRowStart(row, grid) + LeftTop.height
    const width = xForColEnd(col, grid) - xForColStart(col, grid)
    const height = yForRowEnd(row, grid) - yForRowStart(row, grid)
    return {x, y, width, height}
}
