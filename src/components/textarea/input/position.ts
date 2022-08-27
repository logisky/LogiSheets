export function positionEquals(a?: Position, b?: Position): boolean {
    if (!a && !b) return true
    return !!a && !!b && a.lineNumber === b.lineNumber && a.column === b.column
}
export class Position {
    public lineNumber = 0
    public column = 0
    public with(
        newLineNumber = this.lineNumber,
        newColumn = this.column
    ): Position {
        if (newLineNumber === this.lineNumber && newColumn === this.column)
            return this
        const newPosition = new Position()
        newPosition.lineNumber = newLineNumber
        newPosition.column = newColumn
        return newPosition
    }

    public delta(deltaLineNumber = 0, deltaColumn = 0): Position {
        return this.with(
            this.lineNumber + deltaLineNumber,
            this.column + deltaColumn
        )
    }

    public equals(other: Position): boolean {
        return positionEquals(this, other)
    }
}
