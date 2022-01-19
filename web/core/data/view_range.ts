import {Builder} from '@logi-base/src/ts/common/builder'
import {Impl} from '@logi-base/src/ts/common/mapped_types'
import {Range, RangeBuilder} from '@logi-sheets/web/core/standable'
export interface RenderCell {
    readonly width: number
    readonly height: number
    /**
     * start/end row/col index
     */
    readonly coodinate: Range
    /**
     * start/end row/col pixel distance
     */
    readonly position: Range
    cover(cell: RenderCell): boolean
    equals(cell: RenderCell): boolean
}

export class RenderCellImpl implements RenderCell {
    get width() {
        return this.position.endCol - this.position.startCol
    }

    get height() {
        return this.position.endRow - this.position.startRow
    }
    public coodinate = new RangeBuilder().build()
    public position = new RangeBuilder().build()
    cover(cell: RenderCell) {
        return this.coodinate.cover(cell.coodinate)
    }

    equals(cell: RenderCell) {
        return cell.position.equals(this.position)
    }
}

export class BaseRenderCellBuilder<T extends RenderCellImpl, S extends Impl<T>> extends Builder<T, S> {
    public coordinate(coordinate: Range): this {
        this.getImpl().coodinate = coordinate
        return this
    }

    public position(position: Range): this {
        this.getImpl().position = position
        return this
    }
}
export class RenderCellBuilder extends BaseRenderCellBuilder<RenderCell, RenderCellImpl> {
    public constructor(obj?: Readonly<RenderCell>) {
        const impl = new RenderCellImpl()
        if (obj)
            BaseRenderCellBuilder.shallowCopy(impl, obj)
        super(impl)
    }
}

export function isRenderCell(value: unknown): value is RenderCell {
    return value instanceof RenderCellImpl
}

export function assertIsRenderCell(
    value: unknown
): asserts value is RenderCell {
    if (!(value instanceof RenderCellImpl))
        throw Error('Not a RenderCell!')
}

export interface ViewRange {
    /**
     * visible rows.
     */
    readonly rows: readonly RenderCell[]
    /**
     * visible cols.
     */
    readonly cols: readonly RenderCell[]
    readonly cells: readonly RenderCell[]
}

class ViewRangeImpl implements ViewRange {
    public rows: readonly RenderCell[] = []
    public cols: readonly RenderCell[] = []
    public cells: readonly RenderCell[] = []
}

export class ViewRangeBuilder extends Builder<ViewRange, ViewRangeImpl> {
    public constructor(obj?: Readonly<ViewRange>) {
        const impl = new ViewRangeImpl()
        if (obj)
            ViewRangeBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public rows(rows: readonly RenderCell[]): this {
        this.getImpl().rows = rows
        return this
    }

    public cols(cols: readonly RenderCell[]): this {
        this.getImpl().cols = cols
        return this
    }

    public renderCells(renderCells: readonly RenderCell[]): this {
        this.getImpl().cells = renderCells
        return this
    }
}

export function isViewRange(value: unknown): value is ViewRange {
    return value instanceof ViewRangeImpl
}

export function assertIsViewRange(value: unknown): asserts value is ViewRange {
    if (!(value instanceof ViewRangeImpl))
        throw Error('Not a ViewRange!')
}
