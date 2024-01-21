import {RenderCell, RenderDataProvider, WorkbookService} from '@/core/data2'
import {shallowCopy} from '@/core'
export type CellType =
    | 'Cell'
    | 'LeftTop'
    | 'FixedLeftHeader'
    | 'FixedTopHeader'
    | 'unknown'
export class Cell extends RenderCell {
    constructor(public type: CellType) {
        super()
    }
    override equals(cell: Cell): boolean {
        return cell.type === this.type && super.equals(cell)
    }
    copyByRenderCell(cell: RenderCell) {
        shallowCopy(cell, this)
        return this
    }
}

export function visibleCells(
    cell: Cell,
    end: Cell,
    wb: WorkbookService,
    render: RenderDataProvider
) {
    const cells: {readonly row: number; readonly col: number}[] = []
    const {startCol, startRow} = cell.coordinate
    const {endCol, endRow} = end.coordinate
    const currentSheet = render.currentSheet
    for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col < endCol; col++) {
            if (wb.getColInfo(currentSheet, col).hidden) continue
            if (wb.getRowInfo(currentSheet, row).hidden) continue
            cells.push({row, col})
        }
    }
    return cells
}
