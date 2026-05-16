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

export interface CellResolver {
    rect: (blockId: number, row: number, col: number) => CellRect | null
}

export function makeCellResolver(grid: Grid): CellResolver {
    const blockPositions = new Map<
        number,
        {rowStart: number; colStart: number}
    >()
    if (grid.blockInfos) {
        for (const bi of grid.blockInfos) {
            blockPositions.set(bi.info.blockId, {
                rowStart: bi.info.rowStart,
                colStart: bi.info.colStart,
            })
        }
    }
    const visibleRows = new Set(grid.rows.map((r: {idx: number}) => r.idx))
    const visibleCols = new Set(grid.columns.map((c: {idx: number}) => c.idx))

    return {
        rect: (blockId, row, col) => {
            const pos = blockPositions.get(blockId)
            if (!pos) return null
            const globalRow = pos.rowStart + row
            const globalCol = pos.colStart + col
            if (!visibleRows.has(globalRow) || !visibleCols.has(globalCol)) {
                return null
            }
            const x = xForColStart(globalCol, grid) + LeftTop.width
            const y = yForRowStart(globalRow, grid) + LeftTop.height
            const width =
                xForColEnd(globalCol, grid) - xForColStart(globalCol, grid)
            const height =
                yForRowEnd(globalRow, grid) - yForRowStart(globalRow, grid)
            return {x, y, width, height}
        },
    }
}
