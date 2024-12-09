import {RenderCell} from './render'
import {Comment} from '@logisheets_bg'

export class CellViewData {
    public fromRow = 0
    public toRow = 0
    public fromCol = 0
    public toCol = 0

    constructor(
        public rows: readonly RenderCell[],
        public cols: readonly RenderCell[],
        public cells: readonly RenderCell[],
        public comments: readonly Comment[]
    ) {
        this.fromRow = rows[0].coordinate.startRow
        this.toRow = rows[-1].coordinate.endRow
        this.fromCol = cols[0].coordinate.startCol
        this.toCol = cols[-1].coordinate.endCol
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

export function merge(targets: Rect[]): Rect {
    if (targets.length === 0) {
        throw new Error('No rectangles to merge')
    }

    // Initialize bounds with the first rectangle
    let minX = targets[0].startX
    let minY = targets[0].startY
    let maxX = targets[0].endX
    let maxY = targets[0].endY

    // Iterate over remaining rectangles to determine bounds
    for (const rect of targets) {
        minX = Math.min(minX, rect.startX)
        minY = Math.min(minY, rect.startY)
        maxX = Math.max(maxX, rect.endX)
        maxY = Math.max(maxY, rect.endY)
    }

    // Calculate the width and height of the merged rectangle
    const width = maxX - minX
    const height = maxY - minY

    return new Rect(minX, minY, width, height)
}

export function overlap(targets: Rect[], cache: Rect): OverlapResult {
    const uncoveredRects: Rect[] = []
    let fullyCovered = true
    let hasOverlap = false

    for (const target of targets) {
        // Calculate the intersection area
        const overlapStartX = Math.max(target.startX, cache.startX)
        const overlapEndX = Math.min(target.endX, cache.endX)
        const overlapStartY = Math.max(target.startY, cache.startY)
        const overlapEndY = Math.min(target.endY, cache.endY)

        // Check if there's any overlap
        if (overlapStartX >= overlapEndX || overlapStartY >= overlapEndY) {
            // No overlap
            uncoveredRects.push(target)
            fullyCovered = false
            continue
        }

        // If overlap exists
        hasOverlap = true

        // Check if cache fully contains the target
        if (cache.contains(target)) {
            continue // Fully covered, don't add to uncoveredRects
        }

        // Partially covered: Calculate the remaining uncovered parts of the target
        fullyCovered = false

        // Top segment
        if (overlapStartY > target.startY) {
            uncoveredRects.push(
                new Rect(
                    target.startX,
                    target.startY,
                    target.width,
                    overlapStartY - target.startY
                )
            )
        }

        // Bottom segment
        if (overlapEndY < target.endY) {
            uncoveredRects.push(
                new Rect(
                    target.startX,
                    overlapEndY,
                    target.width,
                    target.endY - overlapEndY
                )
            )
        }

        // Left segment
        if (overlapStartX > target.startX) {
            uncoveredRects.push(
                new Rect(
                    target.startX,
                    overlapStartY,
                    overlapStartX - target.startX,
                    overlapEndY - overlapStartY
                )
            )
        }

        // Right segment
        if (overlapEndX < target.endX) {
            uncoveredRects.push(
                new Rect(
                    overlapEndX,
                    overlapStartY,
                    target.endX - overlapEndX,
                    overlapEndY - overlapStartY
                )
            )
        }
    }

    // Determine the overall overlap type
    const overlapType = fullyCovered
        ? OverlapType.FullyCovered
        : !hasOverlap
        ? OverlapType.Uncovered
        : OverlapType.PartiallyCovered

    return new OverlapResult(uncoveredRects, overlapType)
}
