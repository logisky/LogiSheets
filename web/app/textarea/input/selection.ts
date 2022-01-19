import {Builder} from '@logi-base/src/ts/common/builder'
export function selectionEquals(a: Selection, b: Selection): boolean {
    return a.positionColumn === b.positionColumn
        && a.positionLineNumber === b.positionLineNumber
        && a.startColumn === b.startColumn
        && a.startLineNumber === b.startLineNumber
}
export const enum SelectionDirection {
    LTR,
    RTL,
}
export interface Selection {
    readonly startLineNumber: number
    readonly startColumn: number
    readonly endLineNumber: number
    readonly endColumn: number
    readonly selectionStartLineNumber: number
    readonly selectionStartColumn: number
    readonly positionLineNumber: number
    readonly positionColumn: number
    equals(other: Selection): boolean
    getDirection(): SelectionDirection
    setEndPosition(endLineNumber: number, endColumn: number): Selection
    setStartPosition(startLineNumber: number, startColumn: number): Selection
}

class SelectionImpl implements Selection {
    public startLineNumber!: number
    public startColumn!: number
    public endLineNumber!: number
    public endColumn!: number
    public selectionStartLineNumber!: number
    public selectionStartColumn!: number
    public positionLineNumber!: number
    public positionColumn!: number
    public equals(other: Selection): boolean {
        return selectionEquals(this, other)
    }

    public getDirection(): SelectionDirection {
        return this.selectionStartLineNumber === this.startLineNumber
            && this.selectionStartColumn === this.startColumn
            ? SelectionDirection.LTR
            : SelectionDirection.RTL
    }

    public setEndPosition(endLineNumber: number, endColumn: number): Selection {
        if (this.getDirection() === SelectionDirection.LTR)
            return new SelectionBuilder()
                .selectionStartLineNumber(this.startLineNumber)
                .selectionStartColumn(this.startColumn)
                .positionLineNumber(endLineNumber)
                .positionColumn(endColumn)
                .build()
        return new SelectionBuilder()
            .selectionStartLineNumber(endLineNumber)
            .selectionStartColumn(endColumn)
            .positionLineNumber(this.startLineNumber)
            .positionColumn(this.startColumn)
            .build()
    }

    public setStartPosition(
        startLineNumber: number,
        startColumn: number
    ): Selection {
        if (this.getDirection() === SelectionDirection.LTR)
            return new SelectionBuilder()
                .selectionStartLineNumber(startLineNumber)
                .selectionStartColumn(startColumn)
                .positionLineNumber(this.endLineNumber)
                .positionColumn(this.endColumn)
                .build()
        return new SelectionBuilder()
            .selectionStartLineNumber(this.endLineNumber)
            .selectionStartColumn(this.endColumn)
            .positionLineNumber(startLineNumber)
            .positionColumn(startColumn)
            .build()
    }
}

export class SelectionBuilder extends Builder<Selection, SelectionImpl> {
    public constructor(obj?: Readonly<Selection>) {
        const impl = new SelectionImpl()
        if (obj)
            SelectionBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public selectionStartLineNumber(selectionStartLineNumber: number): this {
        this.getImpl().selectionStartLineNumber = selectionStartLineNumber
        this.getImpl().startLineNumber = selectionStartLineNumber
        return this
    }

    public selectionStartColumn(selectionStartColumn: number): this {
        this.getImpl().selectionStartColumn = selectionStartColumn
        this.getImpl().startColumn = selectionStartColumn
        return this
    }

    public positionLineNumber(positionLineNumber: number): this {
        this.getImpl().positionLineNumber = positionLineNumber
        this.getImpl().endLineNumber = positionLineNumber
        return this
    }

    public positionColumn(positionColumn: number): this {
        this.getImpl().positionColumn = positionColumn
        this.getImpl().endColumn = positionColumn
        return this
    }

    protected get daa(): readonly string[] {
        return SelectionBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'selectionStartLineNumber',
        'selectionStartColumn',
        'positionLineNumber',
        'positionColumn',
    ]
}

export function isSelection(value: unknown): value is Selection {
    return value instanceof SelectionImpl
}

export function assertIsSelection(value: unknown): asserts value is Selection {
    if (!(value instanceof SelectionImpl))
        throw Error('Not a Selection!')
}
