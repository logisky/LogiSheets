/**
 * Draws the cell overlays crafts ask for through `window.setCellLayouts`: a
 * tint on each listed cell, and the active cell's tooltip under it.
 *
 * The tint is multiplied over the cell rather than painted on top, so any
 * colour — the opaque ones a craft passes included — reads as a tint and the
 * cell's text stays legible. Nothing here takes the pointer: the canvas keeps
 * every click, and the tooltip shows for the selected cell, like a
 * data-validation input message.
 *
 * Lives in the view overlay, so every view (main, split, pop-out) draws the
 * layouts for its own sheet and scroll position.
 */

import {observer} from 'mobx-react-lite'
import Box from '@mui/material/Box'
import {
    getSelectedCellRange,
    xForColStart,
    yForRowStart,
} from 'logisheets-engine'
import type {Grid, SelectedData} from 'logisheets-engine'
import {LeftTop} from '@/core/settings'
import {globalStore} from '@/store'

export interface CellLayoutLayerProps {
    grid: Grid
    activeSheet: number
    selectedData?: SelectedData
}

export const CellLayoutLayer = observer(function CellLayoutLayer({
    grid,
    activeSheet,
    selectedData,
}: CellLayoutLayerProps) {
    const layouts = globalStore.cellLayouts.filter(
        (l) => l.sheetIdx === activeSheet
    )
    if (layouts.length === 0) return null

    // Only the laid-out window: the grid knows nothing about the rest.
    const cols = new Map<number, number>(
        grid.columns.map((c: {idx: number; width: number}) => [c.idx, c.width])
    )
    const rows = new Map<number, number>(
        grid.rows.map((r: {idx: number; height: number}) => [r.idx, r.height])
    )
    const box = (row: number, col: number) => {
        const width = cols.get(col)
        const height = rows.get(row)
        if (width === undefined || height === undefined) return null
        return {
            left: xForColStart(col, grid) + LeftTop.width,
            top: yForRowStart(row, grid) + LeftTop.height,
            width,
            height,
        }
    }

    const active = selectedData ? getSelectedCellRange(selectedData) : undefined
    const tip =
        active &&
        layouts.find(
            (l) =>
                l.tooltip &&
                l.row === active.startRow &&
                l.col === active.startCol
        )
    const tipBox = tip ? box(tip.row, tip.col) : null

    return (
        <>
            {layouts.map((l) => {
                const b = l.background ? box(l.row, l.col) : null
                if (!b) return null
                return (
                    <Box
                        key={`${l.row},${l.col}`}
                        sx={{
                            position: 'absolute',
                            ...b,
                            bgcolor: l.background,
                            mixBlendMode: 'multiply',
                            pointerEvents: 'none',
                        }}
                    />
                )
            })}
            {tip && tipBox && (
                <Box
                    sx={{
                        position: 'absolute',
                        left: tipBox.left + 8,
                        top: tipBox.top + tipBox.height + 6,
                        maxWidth: 260,
                        px: 1.25,
                        py: 0.75,
                        bgcolor: '#fff',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        fontSize: 12,
                        lineHeight: 1.45,
                        color: '#374151',
                        pointerEvents: 'none',
                        whiteSpace: 'pre-wrap',
                        zIndex: 5,
                    }}
                >
                    {tip.tooltip}
                </Box>
            )}
        </>
    )
})
