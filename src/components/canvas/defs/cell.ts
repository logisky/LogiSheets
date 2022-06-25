import { DATA_SERVICE, RenderCell } from '@/core/data'
import { shallowCopy } from '@/common'
export type CellType = 'Cell' | 'LeftTop' | 'FixedLeftHeader' | 'FixedTopHeader' | 'unknown'
export class Cell extends RenderCell {
    constructor(public type: CellType) {
        super()
    }
    override equals(cell: Cell): boolean {
        return cell.type === this.type
            && super.equals(cell)
    }
    visibleCells(end = this) {
        const cells: { readonly row: number, readonly col: number }[] = []
        const { startCol, startRow } = this.coodinate
        const { endCol, endRow } = end.coodinate
        const sheet = DATA_SERVICE.sheetSvc
        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col < endCol; col++) {
                if (sheet.getColInfo(col).hidden)
                    continue
                if (sheet.getRowInfo(row).hidden)
                    continue
                cells.push({ row, col })
            }
        }
        return cells
    }
    copyByRenderCell(cell: RenderCell) {
        shallowCopy(cell, this)
        return this
    }
}
