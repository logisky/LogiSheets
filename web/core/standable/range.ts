import {MergeCell} from '@logi-pb/network/src/proto/message_pb'
import {Builder} from '@logi-base/src/ts/common/builder'
import {shallowCopy} from '@logi-sheets/web/global'
export interface Range {
    readonly startRow: number
    readonly startCol: number
    readonly endRow: number
    readonly endCol: number
    cover(range: Range): boolean
    equals(other: Range): boolean
}

class RangeImpl implements Range {
    public startRow = 0
    public startCol = 0
    public endRow = 0
    public endCol = 0
    cover(range: Range) {
        return this.startRow <= range.startRow
            && this.startCol <= range.startCol
            && this.endRow >= range.endRow
            && this.endCol >= range.endCol
    }

    equals(other: Range): boolean {
        return other.startRow === this.startRow
            && other.startCol === this.startCol
            && other.endCol === this.endCol
            && other.endRow === this.endRow
    }
}

export class RangeBuilder extends Builder<Range, RangeImpl> {
    public constructor(obj?: Readonly<Range>) {
        const impl = new RangeImpl()
        if (obj)
            RangeBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    static fromMergeCell(mergeCell: MergeCell) {
        const range = new RangeImpl()
        shallowCopy(mergeCell, range)
        return range
    }

    public startRow(startRow: number): this {
        this.getImpl().startRow = startRow
        return this
    }

    public startCol(startCol: number): this {
        this.getImpl().startCol = startCol
        return this
    }

    public endRow(endRow: number): this {
        this.getImpl().endRow = endRow
        return this
    }

    public endCol(endCol: number): this {
        this.getImpl().endCol = endCol
        return this
    }

    protected get daa(): readonly string[] {
        return RangeBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'startRow',
        'startCol',
        'endRow',
        'endCol',
    ]
}

export function isRange(value: unknown): value is Range {
    return value instanceof RangeImpl
}

export function assertIsRange(value: unknown): asserts value is Range {
    if (!(value instanceof RangeImpl))
        throw Error('Not a Range!')
}
