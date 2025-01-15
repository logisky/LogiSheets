export interface Rect {
    x: number
    y: number
    width: number
    height: number
}

interface Segment {
    start: number
    end: number
}

interface RectDiff {
    differentA?: Rect
    differentB?: Rect
    overlap?: Rect
}

interface SegmentDiff {
    differentA?: Segment
    differentB?: Segment
    overlap?: Segment
}

export function isFullyCovered(target: Rect, existed: Rect): boolean {
    return (
        target.x >= existed.x &&
        target.y >= existed.y &&
        target.width <= existed.width &&
        target.height <= existed.height
    )
}

export function intersectRect(
    a: Rect,
    b: Rect,
    direction: 'x' | 'y'
): RectDiff {
    const result: RectDiff = {}
    if (direction == 'y') {
        const diff = intersectSeg(
            {start: a.y, end: a.y + a.height},
            {start: b.y, end: b.y + b.height}
        )
        const width = Math.max(a.width, b.width)
        if (diff.differentA) {
            result.differentA = {
                x: a.x,
                width,
                y: diff.differentA.start,
                height: diff.differentA.end - diff.differentA.start,
            }
        }
        if (diff.differentB) {
            result.differentB = {
                x: b.x,
                width,
                y: diff.differentB.start,
                height: diff.differentB.end - diff.differentB.start,
            }
        }
        if (diff.overlap) {
            result.overlap = {
                x: Math.min(a.x, b.x),
                y: diff.overlap.start,
                width: Math.min(a.width, b.width),
                height: diff.overlap.end - diff.overlap.start,
            }
        }
    } else {
        const diff = intersectSeg(
            {start: a.x, end: a.x + a.width},
            {start: b.x, end: b.x + b.width}
        )
        const height = Math.max(a.height, b.height)
        if (diff.differentA) {
            result.differentA = {
                x: diff.differentA.start,
                y: a.y,
                height,
                width: diff.differentA.end - diff.differentA.start,
            }
        }
        if (diff.differentB) {
            result.differentB = {
                x: diff.differentB.start,
                y: b.y,
                height,
                width: diff.differentB.end - diff.differentB.start,
            }
        }
        if (diff.overlap) {
            result.overlap = {
                x: diff.overlap.start,
                y: Math.min(a.y, b.y),
                width: diff.overlap.end - diff.overlap.start,
                height: Math.min(a.height, b.height),
            }
        }
    }
    return result
}

function intersectSeg(a: Segment, b: Segment): SegmentDiff {
    const result: SegmentDiff = {}
    const {start: startA, end: endA} = a
    const {start: startB, end: endB} = b
    if (startA < startB) {
        result.differentA = {start: startA, end: startB}
    } else if (startB < startA) {
        result.differentB = {start: startB, end: startA}
    }
    if (endB > endA) {
        result.differentB = {start: endA, end: endB}
    } else if (endA > endB) {
        result.differentA = {start: endB, end: endA}
    }
    const s = Math.max(startA, startB)
    const e = Math.min(endA, endB)
    if (e > s) {
        result.overlap = {start: s, end: e}
    }
    return result
}
