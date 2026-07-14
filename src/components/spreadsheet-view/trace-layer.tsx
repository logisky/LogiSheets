import {useEffect} from 'react'
import {observer} from 'mobx-react-lite'
import type {Grid} from 'logisheets-engine'
import {xForColStart, yForRowStart} from 'logisheets-engine'
import {isErrorMessage} from 'logisheets-web'
import {useWorkbook} from '@/core/engine/provider'
import {LeftTop} from '@/core/settings'
import {globalStore, type TraceRect} from '@/store'

export interface TraceLayerProps {
    grid: Grid
    activeSheet: number
}

/**
 * Formula auditing overlay — Excel-style "trace precedents / dependents".
 *
 * Two jobs:
 *  1. Fulfill a pending trace request (raised by the right-click menu). It has
 *     workbook access, so it calls the engine's get_precedents / get_dependents
 *     and publishes the result to the store.
 *  2. Highlight the origin cell (amber) and every traced cell/range (blue) that
 *     falls on THIS view's active sheet, using the same cell→pixel mapping the
 *     other overlays use. Off-screen cells simply aren't drawn.
 *
 * Esc clears the trace.
 */
export const TraceLayer = observer(({grid, activeSheet}: TraceLayerProps) => {
    const workbook = useWorkbook()
    const req = globalStore.traceRequest

    // Resolve a pending request → store result.
    useEffect(() => {
        if (!req) return
        let cancelled = false
        ;(async () => {
            const rects: TraceRect[] = []
            if (req.kind === 'precedents') {
                const res = await workbook.getPrecedents({
                    sheetIdx: req.sheetIdx,
                    row: req.row,
                    col: req.col,
                })
                if (isErrorMessage(res)) return
                res.forEach((r) => {
                    if (r.allRows || r.allCols) return // unbounded — skip
                    rects.push({
                        sheetIdx: r.sheetIdx,
                        startRow: r.startRow,
                        startCol: r.startCol,
                        endRow: r.endRow,
                        endCol: r.endCol,
                    })
                })
            } else {
                const res = await workbook.getDependents({
                    sheetIdx: req.sheetIdx,
                    startRow: req.row,
                    startCol: req.col,
                    endRow: req.row,
                    endCol: req.col,
                })
                if (isErrorMessage(res)) return
                res.forEach((d) => {
                    rects.push({
                        sheetIdx: d.sheetIdx,
                        startRow: d.row,
                        startCol: d.col,
                        endRow: d.row,
                        endCol: d.col,
                    })
                })
            }
            if (cancelled) return
            globalStore.setTraceResult({
                origin: {
                    sheetIdx: req.sheetIdx,
                    row: req.row,
                    col: req.col,
                },
                kind: req.kind,
                rects,
            })
        })()
        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [req?.nonce])

    // Esc clears the active trace.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && globalStore.traceResult)
                globalStore.clearTrace()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

    const result = globalStore.traceResult
    if (!result) return null

    // Pixel box for a cell range on this sheet, or null if its top-left is
    // outside the visible window.
    const boxOf = (rect: {
        startRow: number
        startCol: number
        endRow: number
        endCol: number
    }) => {
        const colW = (c: number) =>
            grid.columns.find((x: {idx: number; width: number}) => x.idx === c)
                ?.width
        const rowH = (r: number) =>
            grid.rows.find((x: {idx: number; height: number}) => x.idx === r)
                ?.height
        if (colW(rect.startCol) === undefined) return null
        if (rowH(rect.startRow) === undefined) return null
        let width = 0
        for (let c = rect.startCol; c <= rect.endCol; c++) width += colW(c) ?? 0
        let height = 0
        for (let r = rect.startRow; r <= rect.endRow; r++)
            height += rowH(r) ?? 0
        return {
            left: xForColStart(rect.startCol, grid) + LeftTop.width,
            top: yForRowStart(rect.startRow, grid) + LeftTop.height,
            width,
            height,
        }
    }

    const boxes: React.ReactNode[] = []
    result.rects.forEach((rect, i) => {
        if (rect.sheetIdx !== activeSheet) return
        const b = boxOf(rect)
        if (!b) return
        boxes.push(
            <div
                key={`t${i}`}
                data-testid="trace-highlight"
                style={{
                    position: 'absolute',
                    left: b.left,
                    top: b.top,
                    width: b.width,
                    height: b.height,
                    boxSizing: 'border-box',
                    border: '2px solid #2563eb',
                    background: 'rgba(37, 99, 235, 0.10)',
                    pointerEvents: 'none',
                }}
            />
        )
    })
    if (result.origin.sheetIdx === activeSheet) {
        const b = boxOf({
            startRow: result.origin.row,
            startCol: result.origin.col,
            endRow: result.origin.row,
            endCol: result.origin.col,
        })
        if (b)
            boxes.push(
                <div
                    key="origin"
                    data-testid="trace-origin"
                    style={{
                        position: 'absolute',
                        left: b.left,
                        top: b.top,
                        width: b.width,
                        height: b.height,
                        boxSizing: 'border-box',
                        border: '2px solid #d97706',
                        background: 'rgba(217, 119, 6, 0.12)',
                        pointerEvents: 'none',
                    }}
                />
            )
    }

    return <>{boxes}</>
})
