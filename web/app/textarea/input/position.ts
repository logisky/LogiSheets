import {Builder} from '@logi-base/src/ts/common/builder'
export function positionEquals(a?: Position, b?: Position): boolean {
    if (!a && !b)
        return true
    return !!a
        && !!b
        && a.lineNumber === b.lineNumber
        && a.column === b.column
}
export interface Position {
    readonly lineNumber: number
    readonly column: number
    with(newLineNumber?: number, newColumn?: number): Position
    delta(deltaLineNumber?: number, deltaColumn?: number): Position
    equals(other: Position): boolean
}

class PositionImpl implements Position {
    public lineNumber = 0
    public column = 0
    public with(
        newLineNumber = this.lineNumber,
        newColumn = this.column
    ): Position {
        if (newLineNumber === this.lineNumber && newColumn === this.column)
            return this
        return new PositionBuilder()
            .lineNumber(newLineNumber)
            .column(newColumn)
            .build()
    }

    public delta(deltaLineNumber = 0, deltaColumn = 0): Position {
        return this
            .with(this.lineNumber + deltaLineNumber, this.column + deltaColumn)
    }

    public equals(other: Position): boolean {
        return positionEquals(this, other)
    }
}

export class PositionBuilder extends Builder<Position, PositionImpl> {
    public constructor(obj?: Readonly<Position>) {
        const impl = new PositionImpl()
        if (obj)
            PositionBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public lineNumber(lineNumber: number): this {
        this.getImpl().lineNumber = lineNumber
        return this
    }

    public column(column: number): this {
        this.getImpl().column = column
        return this
    }
}

export function isPosition(value: unknown): value is Position {
    return value instanceof PositionImpl
}

export function assertIsPosition(value: unknown): asserts value is Position {
    if (!(value instanceof PositionImpl))
        throw Error('Not a Position!')
}
