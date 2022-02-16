import { DATA_SERVICE } from 'core/data'
import { SETTINGS } from 'common/settings'
import { Range } from 'core/standable'
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
    clickPosition.startCol = x
    clickPosition.startRow = y
    clickPosition.endCol = x
    clickPosition.endRow = y
    let cell = new Cell()
    const { width: leftTopWidth, height: leftTopHeight } = SETTINGS.leftTop
    const col = cols.find(c => c.position.cover(clickPosition))
    const row = rows.find(r => r.position.cover(clickPosition))
    const renderCell = cells.find(c => c.position.cover(clickPosition))
    if (x <= leftTopWidth && y <= leftTopHeight)
        cell.type = 'LeftTop'
    else if (row) {
        cell.type = 'FixedLeftHeader'
        cell.copyByRenderCell(row)
    } else if (col) {
        cell.type = 'FixedTopHeader'
        cell.copyByRenderCell(col)
    } else if (renderCell) {
        cell.type = 'Cell'
        cell.copyByRenderCell(renderCell)
    }
    return cell
}

export function getCell(offsetX: number, offsetY: number) {
    const cell = new Cell()
    const leftTop = SETTINGS.leftTop
    if (offsetX <= leftTop.width && offsetY <= leftTop.height) {
        cell.type = 'LeftTop'
        return cell
    }
    const { rows, cols, cells } = DATA_SERVICE.cachedViewRange
    const position = new Range()
    position.startCol = offsetX
    position.endCol = offsetX
    position.startRow = offsetY
    position.endRow = offsetY
    const row = rows.find(r => r.position.cover(position))
    if (offsetX <= leftTop.width && row) {
        cell.type = 'FixedLeftHeader'
        cell.copyByRenderCell(row)
        return cell
    }
    const col = cols.find(c => c.position.cover(position))
    if (offsetY <= leftTop.height && col) {
        cell.type = 'FixedTopHeader'
        cell.copyByRenderCell(col)
        return cell
    }
    const matchCell = cells.find(c => c.position.cover(position))
    if (matchCell) {
        cell.type = 'Cell'
        cell.copyByRenderCell(matchCell)
        return cell
    }
    return cell
}
