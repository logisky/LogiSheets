import {MergeCell} from 'proto/message'
import {shallowCopy} from 'global'
export class Range {
    static fromMergeCell(mergeCell: MergeCell) {
        const range = new Range()
        shallowCopy(mergeCell, range)
        return range
    }
    startRow = 0
    startCol = 0
    endRow = 0
    endCol = 0
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
