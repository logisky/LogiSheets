import {MergeCell} from 'logisheets-web'
export class Range {
    static fromMergeCell(mergeCell: MergeCell) {
        return new Range()
            .setEndCol(mergeCell.endCol)
            .setStartCol(mergeCell.startCol)
            .setEndRow(mergeCell.endRow)
            .setStartRow(mergeCell.startRow)
    }
    get width() {
        return this.#endCol - this.#startCol
    }
    get height() {
        return this.#endRow - this.#startRow
    }
    get startRow() {
        return this.#startRow
    }
    get startCol() {
        return this.#startCol
    }
    get endRow() {
        return this.#endRow
    }
    get endCol() {
        return this.#endCol
    }
    setStartRow(startRow: number) {
        this.#startRow = startRow
        return this
    }
    setStartCol(startCol: number) {
        this.#startCol = startCol
        return this
    }
    setEndRow(endRow: number) {
        this.#endRow = endRow
        return this
    }
    setEndCol(endCol: number) {
        this.#endCol = endCol
        return this
    }
    setStartEndRow(row: number) {
        this.#startRow = row
        this.#endRow = row
        return this
    }
    setStartEndCol(col: number) {
        this.#startCol = col
        this.#endCol = col
        return this
    }
    reset() {
        this.setEndCol(0).setEndRow(0).setStartCol(0).setStartRow(0)
    }
    #startRow = 0
    #startCol = 0
    #endRow = 0
    #endCol = 0
    cover(range: Range) {
        return (
            this.#startRow <= range.#startRow &&
            this.#startCol <= range.#startCol &&
            this.#endRow >= range.#endRow &&
            this.#endCol >= range.#endCol
        )
    }

    equals(other: Range): boolean {
        return (
            other.#startRow === this.#startRow &&
            other.#startCol === this.#startCol &&
            other.#endCol === this.#endCol &&
            other.#endRow === this.#endRow
        )
    }
}
