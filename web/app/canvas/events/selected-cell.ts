import {Builder} from '@logi-base/src/ts/common/builder'
export interface SelectedCell {
    readonly row: number
    readonly col: number
}

class SelectedCellImpl implements SelectedCell {
    public row!: number
    public col!: number
}

export class SelectedCellBuilder extends Builder<SelectedCell, SelectedCellImpl> {
    public constructor(obj?: Readonly<SelectedCell>) {
        const impl = new SelectedCellImpl()
        if (obj)
            SelectedCellBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public row(row: number): this {
        this.getImpl().row = row
        return this
    }

    public col(col: number): this {
        this.getImpl().col = col
        return this
    }

    protected get daa(): readonly string[] {
        return SelectedCellBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'row',
        'col',
    ]
}

export function isSelectedCell(value: unknown): value is SelectedCell {
    return value instanceof SelectedCellImpl
}

export function assertIsSelectedCell(value: unknown): asserts value is SelectedCell {
    if (!(value instanceof SelectedCellImpl))
        throw Error('Not a SelectedCell!')
}
