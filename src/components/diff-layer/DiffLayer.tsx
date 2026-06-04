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

import {FC, useMemo, useRef, useState, useEffect} from 'react'
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
        // Tooltip-only: the canvas already paints the *new* value. The
        // overlay shows trend via color and surfaces the *old* value on
        // hover via the host element's `title` attribute.
        let label: string | undefined

        switch (cell.type) {
            case 'valueChanged':
            case 'styleChanged':
                bgColor = DIFF_COLORS.changed
                borderColor = DIFF_COLORS.changedBorder
                label = cell.oldValue
                break
            case 'added':
                bgColor = DIFF_COLORS.inserted
                borderColor = DIFF_COLORS.insertedBorder
                // No prior value to surface on hover.
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

interface TooltipState {
    value: string
    x: number
    y: number
}

export const DiffLayer: FC<DiffLayerProps> = ({diffState, grid}) => {
    const rootRef = useRef<HTMLDivElement>(null)
    const [tooltip, setTooltip] = useState<TooltipState | null>(null)

    const overlays = useMemo(() => {
        if (!diffState.active || !grid) return []

        const cellOverlays = computeCellOverlays(diffState.cells, grid)
        const rowOverlays = computeRowOverlays(diffState.rows, grid)
        const colOverlays = computeColOverlays(diffState.cols, grid)

        // Render order: columns (back), rows, cells (front)
        return [...colOverlays, ...rowOverlays, ...cellOverlays]
    }, [diffState, grid])

    // Hit-test the cursor against overlay rects in pure JS so the layer
    // itself can stay `pointer-events: none` — every event (click, drag,
    // wheel) reaches the canvas untouched. Only rects with a `label`
    // (prior value worth surfacing) produce a tooltip.
    useEffect(() => {
        if (!diffState.active || overlays.length === 0) {
            setTooltip(null)
            return
        }
        const onMove = (e: MouseEvent) => {
            const root = rootRef.current
            if (!root) return
            const r = root.getBoundingClientRect()
            const cx = e.clientX - r.left
            const cy = e.clientY - r.top
            // Iterate front-to-back: cells were appended last, so a later
            // entry hit-tests over an earlier (row/col) band correctly.
            let hit: OverlayRect | undefined
            for (let i = overlays.length - 1; i >= 0; i -= 1) {
                const o = overlays[i]
                if (!o.label) continue
                if (
                    cx >= o.x &&
                    cx < o.x + o.width &&
                    cy >= o.y &&
                    cy < o.y + o.height
                ) {
                    hit = o
                    break
                }
            }
            if (hit) {
                setTooltip({value: hit.label!, x: cx, y: cy})
            } else {
                setTooltip(null)
            }
        }
        document.addEventListener('mousemove', onMove)
        return () => document.removeEventListener('mousemove', onMove)
    }, [overlays, diffState.active])

    if (!diffState.active || overlays.length === 0) return null

    return (
        <div ref={rootRef} className={styles['diff-root']}>
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
                />
            ))}
            {tooltip && (
                <div
                    className={styles['diff-tooltip']}
                    style={{left: tooltip.x + 12, top: tooltip.y + 16}}
                >
                    {tooltip.value}
                </div>
            )}
        </div>
    )
}

export default DiffLayer
