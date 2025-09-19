import {RenderCell} from './render'
import {BlockDisplayInfo, Comment} from 'logisheets-web'

export class CellView {
    public constructor(public readonly data: CellViewData[]) {}

    public get fromRow(): number {
        let min = Infinity
        for (const d of this.data) {
            if (d.rows.length) {
                min = Math.min(min, d.rows[0].coordinate.startRow)
            }
        }
        return min
    }

    public get toRow(): number {
        let max = -Infinity
        for (const d of this.data) {
            if (d.rows.length) {
                max = Math.max(max, d.rows[d.rows.length - 1].coordinate.endRow)
            }
        }
        return max
    }

    public get fromCol(): number {
        let min = Infinity
        for (const d of this.data) {
            if (d.cols.length) {
                min = Math.min(min, d.cols[0].coordinate.startCol)
            }
        }
        return min
    }

    public get toCol(): number {
        let max = -Infinity
        for (const d of this.data) {
            if (d.cols.length) {
                max = Math.max(max, d.cols[d.cols.length - 1].coordinate.endCol)
            }
        }
        return max
    }

    public get rows(): readonly RenderCell[] {
        let curr = -1
        return this.data
            .flatMap((d) => d.rows)
            .sort((a, b) => a.coordinate.startRow - b.coordinate.startRow)
            .filter((r) => {
                if (r.position.startRow > curr) {
                    curr = r.position.startRow
                    return true
                }
                return false
            })
    }

    public get cols(): readonly RenderCell[] {
        let curr = -1
        return this.data
            .flatMap((d) => d.cols)
            .sort((a, b) => a.coordinate.startCol - b.coordinate.startCol)
            .filter((r) => {
                if (r.position.startCol > curr) {
                    curr = r.position.startCol
                    return true
                }
                return false
            })
    }

    public get cells(): readonly RenderCell[] {
        let currRow = -1
        let currCol = -1
        return this.data
            .flatMap((d) => d.cells)
            .filter((c) => {
                const col = c.position.startCol
                const row = c.position.startRow
                if (col <= currCol && row <= currRow) {
                    return false
                }
                currCol = col
                currRow = row
                return true
            })
    }

    public get mergeCells(): readonly RenderCell[] {
        let currRow = -1
        let currCol = -1
        return this.data
            .flatMap((d) => d.mergeCells)
            .filter((c) => {
                const col = c.position.startCol
                const row = c.position.startRow
                if (col <= currCol && row <= currRow) {
                    return false
                }
                currCol = col
                currRow = row
                return true
            })
    }

    public get blocks(): readonly BlockDisplayInfo[] {
        const set = new Set()
        const result: BlockDisplayInfo[] = []
        this.data.forEach((d) => {
            if (!d.blocks.length) {
                return
            }
            for (const block of d.blocks) {
                if (!set.has(block.info.blockId)) {
                    set.add(block.info.blockId)
                    result.push(block)
                }
            }
        })
        return result
    }
}

export class CellViewData {
    public fromRow = 0
    public toRow = 0
    public fromCol = 0
    public toCol = 0

    constructor(
        public rows: readonly RenderCell[],
        public cols: readonly RenderCell[],
        public cells: readonly RenderCell[],
        public mergeCells: readonly RenderCell[],
        public comments: readonly Comment[],
        public blocks: readonly BlockDisplayInfo[]
    ) {
        if (rows.length == 0) {
            throw Error('rows should not be empty')
        }
        if (cols.length == 0) {
            throw Error('cols should not be empty')
        }
        if (cells.length == 0) {
            throw Error('cells should not be empty')
        }
        this.fromRow = rows[0].coordinate.startRow
        this.toRow = rows[rows.length - 1].coordinate.endRow
        this.fromCol = cols[0].coordinate.startCol
        this.toCol = cols[cols.length - 1].coordinate.endCol
    }
}

export class Rect {
    constructor(
        public readonly startX: number,
        public readonly startY: number,
        public readonly width: number,
        public readonly height: number
    ) {}

    get endX(): number {
        return this.startX + this.width
    }

    get endY(): number {
        return this.startY + this.height
    }

    /**
     * Checks if this rectangle fully contains another rectangle.
     */
    contains(other: Rect): boolean {
        return (
            this.startX <= other.startX &&
            this.endX >= other.endX &&
            this.startY <= other.startY &&
            this.endY >= other.endY
        )
    }

    public static fromCellViewData(data: CellViewData): Rect {
        const rowLen = data.rows.length
        const colLen = data.cols.length
        if (rowLen == 0 || colLen == 0)
            throw Error('cell view data should not have empty row or col')

        const startRow = data.rows[0].position.startRow
        const startCol = data.cols[0].position.startCol
        const endRow = data.rows[rowLen - 1].position.endRow
        const endCol = data.cols[colLen - 1].position.endCol
        return new Rect(
            startRow,
            startCol,
            endRow - startRow,
            endCol - startCol
        )
    }
}
export class OverlapResult {
    constructor(
        public readonly targets: Rect[],
        public readonly ty: OverlapType
    ) {}
}

export enum OverlapType {
    FullyCovered,
    PartiallyCovered,
    Uncovered,
}
