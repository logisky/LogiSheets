import { RenderCell, SheetService } from '@/core/data'
import { shallowCopy } from '@/core'
export type CellType =
  | 'Cell'
  | 'LeftTop'
  | 'FixedLeftHeader'
  | 'FixedTopHeader'
  | 'unknown';
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

export function visibleCells(cell: Cell, end: Cell, sheetSvc: SheetService) {
    const cells: { readonly row: number; readonly col: number }[] = []
    const { startCol, startRow } = cell.coodinate
    const { endCol, endRow } = end.coodinate
    for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col < endCol; col++) {
            if (sheetSvc.getColInfo(col).hidden) continue
            if (sheetSvc.getRowInfo(row).hidden) continue
            cells.push({ row, col })
        }
    }
    return cells
}
