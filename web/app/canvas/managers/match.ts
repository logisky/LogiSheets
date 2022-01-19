import {DataService} from '@logi-sheets/web/core/data'
import {RangeBuilder} from '@logi-sheets/web/core/standable'
import {CellBuilder} from './cell'

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
    // tslint:disable-next-line: max-params
    clientX: number,
    clientY: number,
    dataSvc: DataService,
    canvas: HTMLCanvasElement,
) {
    const {x, y} = getOffset(clientX, clientY, canvas)
    const {rows, cols, cells} = dataSvc.cachedViewRange
    const clickPosition = new RangeBuilder()
        .startCol(x)
        .startRow(y)
        .endCol(x)
        .endRow(y)
        .build()
    const cell = new CellBuilder()
    const {width: leftTopWidth, height: leftTopHeight} = dataSvc.settings.leftTop
    const col = cols.find(c => c.position.cover(clickPosition))
    const row = rows.find(r => r.position.cover(clickPosition))
    const renderCell = cells.find(c => c.position.cover(clickPosition))
    if (x <= leftTopWidth && y <= leftTopHeight)
        cell.type('LeftTop')
    else if (row)
        cell.type('FixedLeftHeader').copyByRenderCell(row)
    else if (col)
        cell.type('FixedTopHeader').copyByRenderCell(col)
    else if (renderCell)
        cell.type('Cell').copyByRenderCell(renderCell)
    else
    // tslint:disable-next-line: no-throw-unless-asserts
        throw Error(`Not match anything (${x}, ${y})`)
    return cell.build()
}

export function getCell(
    offsetX: number,
    offsetY: number,
    dataSvc: DataService,
) {
    const cell = new CellBuilder()
    const leftTop = dataSvc.settings.leftTop
    if (offsetX <= leftTop.width && offsetY <= leftTop.height)
        return cell.type('LeftTop').build()
    const {rows, cols, cells} = dataSvc.cachedViewRange
    const position = new RangeBuilder()
        .startCol(offsetX)
        .endCol(offsetX)
        .startRow(offsetY)
        .endRow(offsetY)
        .build()
    const row = rows.find(r => r.position.cover(position))
    if (offsetX <= leftTop.width && row)
        return cell.type('FixedLeftHeader').copyByRenderCell(row).build()
    const col = cols.find(c => c.position.cover(position))
    if (offsetY <= leftTop.height && col)
        return cell.type('FixedTopHeader').copyByRenderCell(col).build()
    const matchCell = cells.find(c => c.position.cover(position))
    if (matchCell)
        return cell.type('Cell').copyByRenderCell(matchCell).build()
    return cell.build()
}
