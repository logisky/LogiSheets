import {useCallback, useEffect, useState} from 'react'
import {observer} from 'mobx-react-lite'
import {Box, Tooltip} from '@mui/material'
import type {Grid} from 'logisheets-engine'
import {xForColStart, yForRowStart} from 'logisheets-engine'
import type {CellInfo} from 'logisheets-web'
import {isErrorMessage} from 'logisheets-web'
import {interpretValidation} from 'logisheets-core'
import {useEngine, useWorkbook} from '@/core/engine/provider'
import {LeftTop} from '@/core/settings'

interface InvalidCell {
    row: number
    col: number
    message: string
}

export interface DataValidationOverlayProps {
    grid: Grid
    /** This view's active sheet index. */
    activeSheet: number
}

/**
 * Flags cells whose value violates an Excel data-validation rule. It reuses the
 * per-cell validation shadow (`CellInfo.validationShadow`, the rule's boolean
 * result) surfaced by the engine and the shared `interpretValidation` logic —
 * the same mechanism the block interface uses for its cells, generalized to
 * normal grid cells.
 *
 * No input-time enforcement: we only mark. The set of invalid cells is fetched
 * for the visible window (one `getCells` call) and refreshed when the window
 * changes or the workbook signals a cell change; badge positions recompute from
 * the current `grid` on every render, so they track scrolling.
 */
export const DataValidationOverlay = observer(function DataValidationOverlay({
    grid,
    activeSheet,
}: DataValidationOverlayProps) {
    const engine = useEngine()
    const workbook = useWorkbook()
    const [invalid, setInvalid] = useState<readonly InvalidCell[]>([])

    const rows = grid.rows
    const cols = grid.columns
    const hasWindow = rows.length > 0 && cols.length > 0
    const r0 = hasWindow ? rows[0].idx : 0
    const r1 = hasWindow ? rows[rows.length - 1].idx : 0
    const c0 = hasWindow ? cols[0].idx : 0
    const c1 = hasWindow ? cols[cols.length - 1].idx : 0
    // Re-fetch only when the visible window (not every scroll pixel) changes.
    const boundsKey = `${r0},${c0},${r1},${c1},${hasWindow ? 1 : 0}`

    const refresh = useCallback(async () => {
        if (!hasWindow) {
            setInvalid([])
            return
        }
        const cells = await workbook.getCells({
            sheetIdx: activeSheet,
            startRow: r0,
            startCol: c0,
            endRow: r1,
            endCol: c1,
        })
        if (isErrorMessage(cells)) {
            setInvalid([])
            return
        }
        const width = c1 - c0 + 1
        const out: InvalidCell[] = []
        cells.forEach((ci: CellInfo, idx: number) => {
            const shadow = ci.validationShadow
            if (shadow === undefined) return
            const violation = interpretValidation(
                {sheetIdx: activeSheet, row: 0, col: 0, formula: ''},
                shadow as never
            )
            if (!violation) return
            out.push({
                row: r0 + Math.floor(idx / width),
                col: c0 + (idx % width),
                message: violation.message,
            })
        })
        setInvalid(out)
        // boundsKey captures r0/c0/r1/c1/hasWindow.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workbook, activeSheet, boundsKey])

    useEffect(() => {
        refresh()
        const cb = () => refresh()
        engine.on('cellChange', cb)
        return () => engine.off('cellChange', cb)
    }, [engine, refresh])

    return (
        <>
            {invalid.map(({row, col, message}) => {
                const colInfo = cols.find(
                    (c: {idx: number; width: number}) => c.idx === col
                )
                const rowInfo = rows.find(
                    (r: {idx: number; height: number}) => r.idx === row
                )
                if (!colInfo || !rowInfo) return null // scrolled out of view
                // Offset by the frozen row/column headers so positions are
                // relative to the overlay root (which covers the headers too).
                const x = xForColStart(col, grid) + LeftTop.width
                const y = yForRowStart(row, grid) + LeftTop.height
                return (
                    <Box
                        key={`${row}-${col}`}
                        sx={{
                            position: 'absolute',
                            left: `${x}px`,
                            top: `${y}px`,
                            width: `${colInfo.width}px`,
                            height: `${rowInfo.height}px`,
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'flex-end',
                            pointerEvents: 'none',
                        }}
                    >
                        <Tooltip title={message}>
                            <Box
                                sx={{
                                    pointerEvents: 'auto',
                                    fontSize: '0.5rem',
                                    lineHeight: 1,
                                    px: '2px',
                                    backgroundColor: 'rgba(211, 47, 47, 0.9)',
                                    color: '#fff',
                                    borderBottomLeftRadius: '3px',
                                    cursor: 'default',
                                }}
                            >
                                ❗
                            </Box>
                        </Tooltip>
                    </Box>
                )
            })}
        </>
    )
})
