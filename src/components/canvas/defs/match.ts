import {Range} from '@/core/standable'
import {Cell} from './cell'
import {Grid} from '@/core/worker/types'

export function getOffset(
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement
) {
    const rect = canvas.getBoundingClientRect()
    return {
        x: clientX - rect.x,
        y: clientY - rect.y,
    }
}

export function match(
    canvasX: number,
    canvasY: number,
    anchorX: number,
    anchorY: number,
    data: Grid
): Cell {
    const clickX = canvasX + anchorX
    const clickY = canvasY + anchorY

    let h = data.anchorY
    let rowIdx = 0
    let rowHeight = 0
    for (const row of data.rows) {
        h += row.height
        if (h > clickY) {
            rowIdx = row.idx
            rowHeight = row.height
            break
        }
    }

    let w = data.anchorX
    let colIdx = 0
    let colWidth = 0
    for (const col of data.columns) {
        w += col.width
        if (w > clickX) {
            colIdx = col.idx
            colWidth = col.width
            break
        }
    }

    let pStartRow = h - rowHeight
    let pEndRow = h
    let pStartCol = w - colWidth
    let pEndCol = w
    let startRow = rowIdx
    let endRow = rowIdx
    let startCol = colIdx
    let endCol = colIdx

    if (data.mergeCells && data.mergeCells.length > 0) {
        const mergedCell = data.mergeCells.find(
            (c) =>
                c.startRow >= rowIdx &&
                c.endRow <= rowIdx &&
                c.startCol >= colIdx &&
                c.endCol <= colIdx
        )
        if (mergedCell) {
            startRow = mergedCell.startRow
            endRow = mergedCell.endRow
            startCol = mergedCell.startCol
            endCol = mergedCell.endCol
            let sRow = 0
            let eRow = 0
            for (const row of data.rows) {
                if (row.idx > endRow) break
                sRow += row.height
                if (row.idx > startRow) {
                    eRow += row.height
                }
            }
            pStartRow = sRow
            pEndRow = eRow

            let sCol = 0
            let eCol = 0
            for (const col of data.columns) {
                if (col.idx > endCol) break
                sCol += col.width
                if (col.idx > startCol) {
                    eCol += col.width
                }
            }
            pStartCol = sCol
            pEndCol = eCol
        }
    }

    return new Cell('Cell')
        .setPosition(
            new Range()
                .setStartRow(pStartRow)
                .setEndRow(pEndRow)
                .setStartCol(pStartCol)
                .setEndCol(pEndCol)
        )
        .setCoordinate(
            new Range()
                .setStartRow(startRow)
                .setEndRow(endRow)
                .setStartCol(startCol)
                .setEndCol(endCol)
        )
}
