export function selectionEquals(a: Selection, b: Selection) {
    return (
        a.positionColumn === b.positionColumn &&
        a.positionLineNumber === b.positionLineNumber &&
        a.startColumn === b.startColumn &&
        a.startLineNumber === b.startLineNumber
    )
}
export const enum SelectionDirection {
    LTR,
    RTL,
}
export class Selection {
    set selectionStartLineNumber(selectionStartLineNumber: number) {
        this.#selectionStartLineNumber = selectionStartLineNumber
        this.startLineNumber = selectionStartLineNumber
    }
    get selectionStartLineNumber() {
        return this.#selectionStartLineNumber
    }

    set selectionStartColumn(selectionStartColumn: number) {
        this.#selectionStartColumn = selectionStartColumn
        this.startColumn = selectionStartColumn
    }
    get selectionStartColumn() {
        return this.#selectionStartColumn
    }

    set positionLineNumber(positionLineNumber: number) {
        this.#positionLineNumber = positionLineNumber
        this.endLineNumber = positionLineNumber
    }
    get positionLineNumber() {
        return this.#positionLineNumber
    }

    set positionColumn(positionColumn: number) {
        this.#positionColumn = positionColumn
        this.endColumn = positionColumn
    }
    get positionColumn() {
        return this.#positionColumn
    }

    startLineNumber = 0
    startColumn = 0
    endLineNumber = 0
    endColumn = 0
    #selectionStartLineNumber = 0
    #selectionStartColumn = 0
    #positionLineNumber = 0
    #positionColumn = 0
    public equals(other: Selection) {
        return selectionEquals(this, other)
    }

    public getDirection() {
        return this.#selectionStartLineNumber === this.startLineNumber &&
            this.#selectionStartColumn === this.startColumn
            ? SelectionDirection.LTR
            : SelectionDirection.RTL
    }

    public setEndPosition(endLineNumber: number, endColumn: number) {
        const selection = new Selection()
        if (this.getDirection() === SelectionDirection.LTR) {
            selection.selectionStartLineNumber = this.startLineNumber
            selection.selectionStartColumn = this.startColumn
            selection.positionLineNumber = endLineNumber
            selection.positionColumn = endColumn
        } else {
            selection.selectionStartLineNumber = endLineNumber
            selection.selectionStartColumn = endColumn
            selection.positionLineNumber = this.startLineNumber
            selection.positionColumn = this.startColumn
        }
        return selection
    }

    public setStartPosition(startLineNumber: number, startColumn: number) {
        const selection = new Selection()
        if (this.getDirection() === SelectionDirection.LTR) {
            selection.selectionStartLineNumber = startLineNumber
            selection.selectionStartColumn = startColumn
            selection.positionLineNumber = this.endLineNumber
            selection.positionColumn = this.endColumn
        } else {
            selection.selectionStartLineNumber = this.endLineNumber
            selection.selectionStartColumn = this.endColumn
            selection.positionLineNumber = startLineNumber
            selection.positionColumn = startColumn
        }
        return selection
    }
}
