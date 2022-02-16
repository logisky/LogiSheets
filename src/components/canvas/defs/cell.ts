import { RenderCell } from 'core/data'
import { shallowCopy } from 'common'
export type CellType = 'Cell' | 'LeftTop' | 'FixedLeftHeader' | 'FixedTopHeader' | 'unknown'
export class Cell extends RenderCell {
    type: CellType = 'unknown'
    override equals(cell: Cell): boolean {
        return cell.type === this.type
            && super.equals(cell)
    }
    copyByRenderCell(cell: RenderCell) {
        shallowCopy(cell, this)
    }
}
