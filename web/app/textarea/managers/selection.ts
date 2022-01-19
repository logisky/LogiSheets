import {Builder} from '@logi-base/src/ts/common/builder'
export interface Selection {
    readonly startX: number
    readonly startY: number
    readonly startLineNumber: number
    readonly startColumn: number
    readonly endX: number
    readonly endY: number
    readonly endLineNumber: number
    readonly endColumn: number
}

class SelectionImpl implements Selection {
    public startX = 0
    public startY = 0
    public startLineNumber = 0
    public startColumn = 0
    public endX = 0
    public endY = 0
    public endLineNumber = 0
    public endColumn = 0
}

export class SelectionBuilder extends Builder<Selection, SelectionImpl> {
    public constructor(obj?: Readonly<Selection>) {
        const impl = new SelectionImpl()
        if (obj)
            SelectionBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public startX(startX: number): this {
        this.getImpl().startX = startX
        return this
    }

    public startY(startY: number): this {
        this.getImpl().startY = startY
        return this
    }

    public startLineNumber(startLineNumber: number): this {
        this.getImpl().startLineNumber = startLineNumber
        return this
    }

    public startColumn(startColumn: number): this {
        this.getImpl().startColumn = startColumn
        return this
    }

    public endX(endX: number): this {
        this.getImpl().endX = endX
        return this
    }

    public endY(endY: number): this {
        this.getImpl().endY = endY
        return this
    }

    public endLineNumber(endLineNumber: number): this {
        this.getImpl().endLineNumber = endLineNumber
        return this
    }

    public endColumn(endColumn: number): this {
        this.getImpl().endColumn = endColumn
        return this
    }

    protected get daa(): readonly string[] {
        return SelectionBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'startX',
        'startY',
        'startLineNumber',
        'startColumn',
        'endX',
        'endY',
        'endLineNumber',
        'endColumn',
    ]
}

export function isSelection(value: unknown): value is Selection {
    return value instanceof SelectionImpl
}

export function assertIsSelection(value: unknown): asserts value is Selection {
    if (!(value instanceof SelectionImpl))
        throw Error('Not a Selection!')
}
