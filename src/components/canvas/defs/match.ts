import { DATA_SERVICE } from '@/core/data'
import { SETTINGS } from '@/common/settings'
import { Range } from '@/core/standable'
import { Cell } from './cell'

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
) {
    const { x, y } = getOffset(clientX, clientY, canvas)
    const { rows, cols, cells } = DATA_SERVICE.cachedViewRange
    const clickPosition = new Range()
        .setStartCol(x)
        .setStartRow(y)
        .setEndCol(x)
        .setEndRow(y)
    const { width: leftTopWidth, height: leftTopHeight } = SETTINGS.leftTop
    const col = cols.find(c => c.position.cover(clickPosition))
    const row = rows.find(r => r.position.cover(clickPosition))
    const renderCell = cells.find(c => c.position.cover(clickPosition))
    if (x <= leftTopWidth && y <= leftTopHeight)
        return new Cell('LeftTop')
    else if (row)
        return new Cell('FixedLeftHeader').copyByRenderCell(row)
    else if (col)
        return new Cell('FixedTopHeader').copyByRenderCell(col)
    else if (renderCell)
        return new Cell('Cell').copyByRenderCell(renderCell)
    return new Cell('unknown')
}

export function getCell(offsetX: number, offsetY: number) {
    const leftTop = SETTINGS.leftTop
    if (offsetX <= leftTop.width && offsetY <= leftTop.height)
        return new Cell('LeftTop')
    const { rows, cols, cells } = DATA_SERVICE.cachedViewRange
    const position = new Range()
        .setStartCol(offsetX)
        .setEndCol(offsetX)
        .setStartRow(offsetY)
        .setEndRow(offsetY)
    const row = rows.find(r => r.position.cover(position))
    if (offsetX <= leftTop.width && row)
        return new Cell('FixedLeftHeader').copyByRenderCell(row)
    const col = cols.find(c => c.position.cover(position))
    if (offsetY <= leftTop.height && col)
        return new Cell('FixedTopHeader').copyByRenderCell(col)
    const matchCell = cells.find(c => c.position.cover(position))
    if (matchCell)
        return new Cell('Cell').copyByRenderCell(matchCell)
    return new Cell('unknown')
}
