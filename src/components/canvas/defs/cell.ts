import {RenderCell} from '@/core/data'
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
