import {Range} from 'core/standable'
export class RenderCell {
    get width() {
        return this.position.endCol - this.position.startCol
    }

    get height() {
        return this.position.endRow - this.position.startRow
    }
    /**
     * start/end row/col index
     */
    public coodinate = new Range()
    /**
     * start/end row/col pixel distance
     */
    public position = new Range()
    cover(cell: RenderCell) {
        return this.coodinate.cover(cell.coodinate)
    }

    equals(cell: RenderCell) {
        return cell.position.equals(this.position)
    }
}


export class ViewRange {
    /**
     * visible rows.
     */
    public rows: readonly RenderCell[] = []
    /**
     * visible cols.
     */
    public cols: readonly RenderCell[] = []
    public cells: readonly RenderCell[] = []
}
