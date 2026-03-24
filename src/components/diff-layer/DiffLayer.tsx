/**
 * DiffLayer - Visual overlay for uncommitted temp transaction changes
 *
 * Renders colored overlays on top of the spreadsheet canvas to highlight
 * cells, rows, and columns that have been modified by a temp transaction
 * but not yet committed.
 *
 * Color coding:
 *   - Yellow: cell value/formula changed
 *   - Green:  cell/row/column inserted
 *   - Red:    cell/row/column removed
 */

import {FC, useMemo} from 'react'
import type {Grid} from 'logisheets-engine'
import {
    xForColStart,
    xForColEnd,
    yForRowStart,
    yForRowEnd,
} from 'logisheets-engine'
import {DiffState, DIFF_COLORS, CellDiff, RowDiff, ColDiff} from './types'
import styles from './diff-layer.module.scss'

/** Matches LeftTop in EngineCanvas */
const LeftTop = {width: 32, height: 24}

export interface DiffLayerProps {
    /** The diff state describing all changes */
    diffState: DiffState
    /** Current visible grid for positioning overlays */
    grid: Grid | null
}

interface OverlayRect {
    x: number
    y: number
    width: number
    height: number
    bgColor: string
    borderColor: string
    label?: string
    key: string
}

/**
 * Compute overlay rectangles for cell diffs.
 */
function computeCellOverlays(
    cells: readonly CellDiff[],
    grid: Grid
): OverlayRect[] {
    const rects: OverlayRect[] = []
    const firstRow = grid.rows[0]?.idx ?? 0
    const lastRow = grid.rows[grid.rows.length - 1]?.idx ?? firstRow
    const firstCol = grid.columns[0]?.idx ?? 0
    const lastCol = grid.columns[grid.columns.length - 1]?.idx ?? firstCol

    for (const cell of cells) {
        // Only show cells within the visible range
        if (
            cell.row < firstRow ||
            cell.row > lastRow ||
            cell.col < firstCol ||
            cell.col > lastCol
        ) {
            continue
        }

        const x = LeftTop.width + xForColStart(cell.col, grid)
        const y = LeftTop.height + yForRowStart(cell.row, grid)
        const x2 = LeftTop.width + xForColEnd(cell.col, grid)
        const y2 = LeftTop.height + yForRowEnd(cell.row, grid)

        let bgColor: string
        let borderColor: string
        let label: string | undefined

        switch (cell.type) {
            case 'valueChanged':
            case 'styleChanged':
                bgColor = DIFF_COLORS.changed
                borderColor = DIFF_COLORS.changedBorder
                if (
                    cell.oldValue !== undefined &&
                    cell.newValue !== undefined
                ) {
                    label = `${cell.oldValue} → ${cell.newValue}`
                }
                break
            case 'added':
                bgColor = DIFF_COLORS.inserted
                borderColor = DIFF_COLORS.insertedBorder
                label = cell.newValue
                break
            case 'removed':
                bgColor = DIFF_COLORS.removed
                borderColor = DIFF_COLORS.removedBorder
                label = cell.oldValue
                break
            default:
                bgColor = DIFF_COLORS.changed
                borderColor = DIFF_COLORS.changedBorder
        }

        rects.push({
            x,
            y,
            width: Math.max(0, x2 - x),
            height: Math.max(0, y2 - y),
            bgColor,
            borderColor,
            label,
            key: `cell-${cell.row}-${cell.col}`,
        })
    }

    return rects
}

/**
 * Compute overlay rectangles for row diffs (full-width bands).
 */
function computeRowOverlays(
    rows: readonly RowDiff[],
    grid: Grid
): OverlayRect[] {
    const rects: OverlayRect[] = []
    const firstRow = grid.rows[0]?.idx ?? 0
    const lastRow = grid.rows[grid.rows.length - 1]?.idx ?? firstRow
    const firstCol = grid.columns[0]?.idx ?? 0
    const lastCol = grid.columns[grid.columns.length - 1]?.idx ?? firstCol

    const totalWidth =
        LeftTop.width + xForColEnd(lastCol, grid) - xForColStart(firstCol, grid)

    for (const row of rows) {
        if (row.idx < firstRow || row.idx > lastRow) continue

        const y = LeftTop.height + yForRowStart(row.idx, grid)
        const y2 = LeftTop.height + yForRowEnd(row.idx, grid)

        const isInserted = row.type === 'inserted'
        rects.push({
            x: 0,
            y,
            width: totalWidth,
            height: Math.max(0, y2 - y),
            bgColor: isInserted ? DIFF_COLORS.inserted : DIFF_COLORS.removed,
            borderColor: isInserted
                ? DIFF_COLORS.insertedBorder
                : DIFF_COLORS.removedBorder,
            key: `row-${row.idx}-${row.type}`,
        })
    }

    return rects
}

/**
 * Compute overlay rectangles for column diffs (full-height bands).
 */
function computeColOverlays(
    cols: readonly ColDiff[],
    grid: Grid
): OverlayRect[] {
    const rects: OverlayRect[] = []
    const firstRow = grid.rows[0]?.idx ?? 0
    const lastRow = grid.rows[grid.rows.length - 1]?.idx ?? firstRow
    const firstCol = grid.columns[0]?.idx ?? 0
    const lastCol = grid.columns[grid.columns.length - 1]?.idx ?? firstCol

    const totalHeight =
        LeftTop.height +
        yForRowEnd(lastRow, grid) -
        yForRowStart(firstRow, grid)

    for (const col of cols) {
        if (col.idx < firstCol || col.idx > lastCol) continue

        const x = LeftTop.width + xForColStart(col.idx, grid)
        const x2 = LeftTop.width + xForColEnd(col.idx, grid)

        const isInserted = col.type === 'inserted'
        rects.push({
            x,
            y: 0,
            width: Math.max(0, x2 - x),
            height: totalHeight,
            bgColor: isInserted ? DIFF_COLORS.inserted : DIFF_COLORS.removed,
            borderColor: isInserted
                ? DIFF_COLORS.insertedBorder
                : DIFF_COLORS.removedBorder,
            key: `col-${col.idx}-${col.type}`,
        })
    }

    return rects
}

export const DiffLayer: FC<DiffLayerProps> = ({diffState, grid}) => {
    const overlays = useMemo(() => {
        if (!diffState.active || !grid) return []

        const cellOverlays = computeCellOverlays(diffState.cells, grid)
        const rowOverlays = computeRowOverlays(diffState.rows, grid)
        const colOverlays = computeColOverlays(diffState.cols, grid)

        // Render order: columns (back), rows, cells (front)
        return [...colOverlays, ...rowOverlays, ...cellOverlays]
    }, [diffState, grid])

    if (!diffState.active || overlays.length === 0) return null

    return (
        <>
            {overlays.map((overlay) => (
                <div
                    key={overlay.key}
                    className={styles['diff-overlay']}
                    style={{
                        left: overlay.x,
                        top: overlay.y,
                        width: overlay.width,
                        height: overlay.height,
                        backgroundColor: overlay.bgColor,
                        borderColor: overlay.borderColor,
                    }}
                    title={overlay.label}
                >
                    {overlay.label && (
                        <span className={styles['diff-label']}>
                            {overlay.label}
                        </span>
                    )}
                </div>
            ))}
        </>
    )
}

export default DiffLayer
