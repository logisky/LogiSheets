import {
    RenderCell,
    RenderCellImpl,
    BaseRenderCellBuilder,
} from '@logi-sheets/web/core/data'
import {shallowCopy} from '@logi-sheets/web/global'
export type CellType = 'Cell' | 'LeftTop' | 'FixedLeftHeader' | 'FixedTopHeader' | 'unknown'
export interface Cell extends RenderCell {
    readonly type: CellType
    equals(cell: Cell): boolean
}

class CellImpl extends RenderCellImpl {
    public type: CellType = 'unknown'
    override equals(cell: Cell): boolean {
        return cell.type === this.type
            && super.equals(cell)
    }
}

export class CellBuilder extends BaseRenderCellBuilder<Cell, CellImpl> {
    public constructor(obj?: Readonly<Cell>) {
        const impl = new CellImpl()
        if (obj)
            CellBuilder.shallowCopy(impl, obj)
        super(impl)
    }
    public copyByRenderCell(cell: RenderCell): this {
        shallowCopy(cell, this.getImpl())
        return this
    }

    public type(type: CellType): this {
        this.getImpl().type = type
        return this
    }
}

export function isCell(value: unknown): value is Cell {
    return value instanceof CellImpl
}

export function assertIsCell(value: unknown): asserts value is Cell {
    if (!(value instanceof CellImpl))
        throw Error('Not a Cell!')
}
