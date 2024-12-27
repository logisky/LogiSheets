import {LeftTop} from '@/core/settings'
import {Range} from '@/core/standable'
import {Cell} from './cell'
import {CellViewData} from '@/core/data2'

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
    data: readonly CellViewData[]
) {
    if (canvasX <= LeftTop.width && canvasY <= LeftTop.height)
        return new Cell('LeftTop')
    if (canvasX <= LeftTop.width) {
        // clicking a row
        const clickPosition = new Range()
            .setStartCol(0)
            .setStartRow(canvasY + anchorY - LeftTop.height)
            .setEndCol(0)
            .setEndRow(canvasY + anchorY - LeftTop.height)
        const row = data
            .flatMap((d) => d.rows)
            .find((r) => r.position.cover(clickPosition))
        if (row) return new Cell('FixedLeftHeader').copyByRenderCell(row)
        return new Cell('unknown')
    }

    if (canvasY <= LeftTop.height) {
        // clicking a col
        const clickPosition = new Range()
            .setStartCol(canvasX + anchorX - LeftTop.width)
            .setStartRow(0)
            .setEndCol(canvasX + anchorX - LeftTop.width)
            .setEndRow(0)
        const col = data
            .flatMap((d) => d.cols)
            .find((c) => c.position.cover(clickPosition))
        if (col) return new Cell('FixedTopHeader').copyByRenderCell(col)
        return new Cell('unknown')
    }
    const clickPosition = new Range()
        .setStartCol(canvasX + anchorX - LeftTop.width)
        .setStartRow(canvasY + anchorY - LeftTop.height)
        .setEndCol(canvasX + anchorX - LeftTop.width)
        .setEndRow(canvasY + anchorY - LeftTop.height)
    const renderCell = data
        .flatMap((d) => d.cells)
        .find((c) => c.position.cover(clickPosition))
    if (renderCell) return new Cell('Cell').copyByRenderCell(renderCell)
    return new Cell('unknown')
}
