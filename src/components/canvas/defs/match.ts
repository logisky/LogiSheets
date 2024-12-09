import {SETTINGS} from '@/core/settings'
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
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
    data: readonly CellViewData[]
) {
    const {x, y} = getOffset(clientX, clientY, canvas)
    const clickPosition = new Range()
        .setStartCol(x)
        .setStartRow(y)
        .setEndCol(x)
        .setEndRow(y)
    const {width: leftTopWidth, height: leftTopHeight} = SETTINGS.leftTop
    const col = data
        .flatMap((d) => d.cols)
        .find((c) => c.position.cover(clickPosition))
    const row = data
        .flatMap((d) => d.rows)
        .find((r) => r.position.cover(clickPosition))
    const renderCell = data
        .flatMap((d) => d.cols)
        .flat()
        .find((c) => c.position.cover(clickPosition))
    if (x <= leftTopWidth && y <= leftTopHeight) return new Cell('LeftTop')
    else if (row) return new Cell('FixedLeftHeader').copyByRenderCell(row)
    else if (col) return new Cell('FixedTopHeader').copyByRenderCell(col)
    else if (renderCell) return new Cell('Cell').copyByRenderCell(renderCell)
    return new Cell('unknown')
}
