import {SETTINGS} from '@/core/settings'
import {Range} from '@/core/standable'
import {Cell} from './cell'
import {ViewRange} from '@/core/data2'

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
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
    {rows, cols, cells}: ViewRange
) {
    const {x, y} = getOffset(clientX, clientY, canvas)
    const clickPosition = new Range()
        .setStartCol(x)
        .setStartRow(y)
        .setEndCol(x)
        .setEndRow(y)
    const {width: leftTopWidth, height: leftTopHeight} = SETTINGS.leftTop
    const col = cols.find((c) => c.position.cover(clickPosition))
    const row = rows.find((r) => r.position.cover(clickPosition))
    const renderCell = cells.find((c) => c.position.cover(clickPosition))
    if (x <= leftTopWidth && y <= leftTopHeight) return new Cell('LeftTop')
    else if (row) return new Cell('FixedLeftHeader').copyByRenderCell(row)
    else if (col) return new Cell('FixedTopHeader').copyByRenderCell(col)
    else if (renderCell) return new Cell('Cell').copyByRenderCell(renderCell)
    return new Cell('unknown')
}
