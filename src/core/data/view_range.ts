import {Range} from '@/core/standable'
export class RenderCell {
    get width() {
        return this.position.width
    }

    get height() {
        return this.position.height
    }
    setCoordinate(coordinate: Range) {
        this.coordinate = coordinate
        return this
    }
    setPosition(position: Range) {
        this.position = position
        return this
    }
    /**
     * start/end row/col index
     */
    public coordinate = new Range()
    /**
     * start/end row/col pixel distance
     */
    public position = new Range()
    cover(cell: RenderCell) {
        return this.coordinate.cover(cell.coordinate)
    }

    equals(cell: RenderCell) {
        return cell.position.equals(this.position)
    }
}

export class RenderCellSegment {
    public constructor(
        public readonly from: number,
        public readonly to: number,
        public cells: readonly RenderCell[]
    ) {}
}

export class ViewRange {
    public fromRow = 0
    public toRow = 0
    public fromCol = 0
    public toCol = 0
    /**
     * visible rows.
     */
    public rows: readonly RenderCell[] = []
    /**
     * visible cols.
     */
    public cols: readonly RenderCell[] = []
    /**
     * visible cells
     */
    public cells: readonly RenderCell[] = []
}
