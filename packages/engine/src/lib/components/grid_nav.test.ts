import {describe, it, expect} from 'vitest'
import {
    alignFor,
    expandRangeToMerges,
    fillRanges,
    mergeAt,
    rangeFromCorners,
    linePayloadType,
    stepFocus,
    targetLines,
    wheelPx,
    wheelScroll,
    wheelZoomFactor,
    type MergeRect,
} from './grid_nav'

// deltaMode constants, spelled out for readability.
const PIXEL = 0
const LINE = 1
const PAGE = 2

const wheel = (o: Partial<Parameters<typeof wheelScroll>[0]>) => ({
    deltaX: 0,
    deltaY: 0,
    deltaMode: PIXEL,
    shiftKey: false,
    ...o,
})

describe('wheelPx', () => {
    it('passes pixel deltas through', () => {
        expect(wheelPx(120, PIXEL)).toBe(120)
    })

    it('scales line and page deltas so a notch means the same everywhere', () => {
        // Firefox reports lines; without this a notch would barely move.
        expect(wheelPx(3, LINE)).toBe(48)
        expect(wheelPx(1, PAGE)).toBe(400)
    })
})

describe('wheelScroll', () => {
    it('scrolls vertically for a plain wheel', () => {
        expect(wheelScroll(wheel({deltaY: 100}))).toEqual({dx: 0, dy: 100})
    })

    it('scrolls horizontally for a trackpad swipe', () => {
        expect(wheelScroll(wheel({deltaX: 80}))).toEqual({dx: 80, dy: 0})
    })

    it('maps Shift+wheel onto the horizontal axis', () => {
        expect(wheelScroll(wheel({deltaY: 100, shiftKey: true}))).toEqual({
            dx: 100,
            dy: 0,
        })
    })

    it('leaves the axes alone when the browser already swapped them', () => {
        // Some browsers report Shift+wheel as deltaX themselves; swapping again
        // would cancel the scroll out.
        expect(
            wheelScroll(wheel({deltaX: 100, deltaY: 0, shiftKey: true}))
        ).toEqual({dx: 100, dy: 0})
    })

    it('carries both axes of a diagonal trackpad swipe', () => {
        expect(wheelScroll(wheel({deltaX: 20, deltaY: 30}))).toEqual({
            dx: 20,
            dy: 30,
        })
    })

    it('normalizes units on both axes', () => {
        expect(wheelScroll(wheel({deltaX: 2, deltaY: 3, deltaMode: LINE}))).toEqual(
            {dx: 32, dy: 48}
        )
    })
})

describe('wheelZoomFactor', () => {
    it('zooms in when the wheel scrolls up, out when it scrolls down', () => {
        expect(wheelZoomFactor(1, -100, PIXEL)).toBeGreaterThan(1)
        expect(wheelZoomFactor(1, 100, PIXEL)).toBeLessThan(1)
    })

    it('is multiplicative — the same notch is the same percentage step', () => {
        const oneNotch = wheelZoomFactor(1, -100, PIXEL)
        expect(wheelZoomFactor(2, -100, PIXEL)).toBeCloseTo(2 * oneNotch, 10)
    })

    it('is symmetric: a notch out undoes a notch in', () => {
        expect(wheelZoomFactor(wheelZoomFactor(1, -100, PIXEL), 100, PIXEL)).toBeCloseTo(
            1,
            10
        )
    })

    it('clamps a huge inertial delta so one flick cannot jump the whole range', () => {
        // Anything past the clamp is the same step as the clamp itself.
        expect(wheelZoomFactor(1, -5000, PIXEL)).toBeCloseTo(
            wheelZoomFactor(1, -40, PIXEL),
            10
        )
    })

    it('treats a pinch (small deltas) as a small smooth step', () => {
        const f = wheelZoomFactor(1, -3, PIXEL)
        expect(f).toBeGreaterThan(1)
        expect(f).toBeLessThan(1.02)
    })
})

describe('fillRanges', () => {
    it('fills a multi-row selection from its own first row', () => {
        // A1:B4 → source A1:B1, target A2:B4.
        expect(
            fillRanges('down', {startRow: 0, startCol: 0, endRow: 3, endCol: 1})
        ).toEqual({
            src: {startRow: 0, startCol: 0, endRow: 0, endCol: 1},
            dst: {startRow: 1, startCol: 0, endRow: 3, endCol: 1},
        })
    })

    it('pulls from the row above for a single-row selection (Excel Ctrl+D)', () => {
        // B5 alone → source B4, target B5.
        expect(
            fillRanges('down', {startRow: 4, startCol: 1, endRow: 4, endCol: 1})
        ).toEqual({
            src: {startRow: 3, startCol: 1, endRow: 3, endCol: 1},
            dst: {startRow: 4, startCol: 1, endRow: 4, endCol: 1},
        })
    })

    it('has nothing to pull from on row 0', () => {
        expect(
            fillRanges('down', {startRow: 0, startCol: 2, endRow: 0, endCol: 2})
        ).toBeNull()
    })

    it('fills a multi-column selection from its own first column', () => {
        expect(
            fillRanges('right', {startRow: 1, startCol: 0, endRow: 2, endCol: 3})
        ).toEqual({
            src: {startRow: 1, startCol: 0, endRow: 2, endCol: 0},
            dst: {startRow: 1, startCol: 1, endRow: 2, endCol: 3},
        })
    })

    it('pulls from the column to the left for a single column', () => {
        expect(
            fillRanges('right', {startRow: 0, startCol: 3, endRow: 2, endCol: 3})
        ).toEqual({
            src: {startRow: 0, startCol: 2, endRow: 2, endCol: 2},
            dst: {startRow: 0, startCol: 3, endRow: 2, endCol: 3},
        })
    })

    it('has nothing to pull from in column 0', () => {
        expect(
            fillRanges('right', {startRow: 3, startCol: 0, endRow: 5, endCol: 0})
        ).toBeNull()
    })

    it('normalizes a selection dragged bottom-right to top-left', () => {
        // Dragging upward gives start > end; the fill must not invert.
        expect(
            fillRanges('down', {startRow: 3, startCol: 2, endRow: 0, endCol: 0})
        ).toEqual({
            src: {startRow: 0, startCol: 0, endRow: 0, endCol: 2},
            dst: {startRow: 1, startCol: 0, endRow: 3, endCol: 2},
        })
    })
})

describe('mergeAt', () => {
    const merges: MergeRect[] = [{startRow: 2, startCol: 1, endRow: 4, endCol: 3}]

    it('finds the merge a cell sits in, including its edges', () => {
        expect(mergeAt(merges, 3, 2)).toBe(merges[0])
        expect(mergeAt(merges, 2, 1)).toBe(merges[0])
        expect(mergeAt(merges, 4, 3)).toBe(merges[0])
    })

    it('returns null outside any merge, and with no merges at all', () => {
        expect(mergeAt(merges, 5, 2)).toBeNull()
        expect(mergeAt(undefined, 3, 2)).toBeNull()
    })
})

describe('expandRangeToMerges', () => {
    it('leaves a range that touches nothing alone', () => {
        const rect = {startRow: 0, startCol: 0, endRow: 1, endCol: 1}
        expect(expandRangeToMerges(rect, [])).toEqual(rect)
        expect(expandRangeToMerges(rect, undefined)).toEqual(rect)
    })

    it('grows to cover a merge the range only clips', () => {
        // The range clips the top-left corner of the merge B3:D5.
        expect(
            expandRangeToMerges({startRow: 0, startCol: 0, endRow: 2, endCol: 1}, [
                {startRow: 2, startCol: 1, endRow: 4, endCol: 3},
            ])
        ).toEqual({startRow: 0, startCol: 0, endRow: 4, endCol: 3})
    })

    it('follows a chain of merges pulled in by each other', () => {
        // Growing over the first merge reaches the second, which reaches further.
        expect(
            expandRangeToMerges({startRow: 0, startCol: 0, endRow: 0, endCol: 0}, [
                {startRow: 0, startCol: 0, endRow: 1, endCol: 1},
                {startRow: 1, startCol: 1, endRow: 3, endCol: 2},
                {startRow: 3, startCol: 2, endRow: 5, endCol: 5},
            ])
        ).toEqual({startRow: 0, startCol: 0, endRow: 5, endCol: 5})
    })
})

describe('rangeFromCorners', () => {
    it('orders the corners whichever way the selection was built', () => {
        const downRight = rangeFromCorners({row: 1, col: 1}, {row: 4, col: 3})
        const upLeft = rangeFromCorners({row: 4, col: 3}, {row: 1, col: 1})
        expect(downRight).toEqual({startRow: 1, startCol: 1, endRow: 4, endCol: 3})
        expect(upLeft).toEqual(downRight)
    })
})

describe('stepFocus', () => {
    it('moves one cell in each direction', () => {
        const focus = {row: 5, col: 5}
        expect(stepFocus('up', focus, [])).toEqual({row: 4, col: 5})
        expect(stepFocus('down', focus, [])).toEqual({row: 6, col: 5})
        expect(stepFocus('left', focus, [])).toEqual({row: 5, col: 4})
        expect(stepFocus('right', focus, [])).toEqual({row: 5, col: 5 + 1})
    })

    it('steps past the merge the focus sits in instead of stalling inside it', () => {
        const merges: MergeRect[] = [
            {startRow: 2, startCol: 1, endRow: 4, endCol: 3},
        ]
        const inside = {row: 3, col: 2}
        expect(stepFocus('down', inside, merges)).toEqual({row: 5, col: 2})
        expect(stepFocus('up', inside, merges)).toEqual({row: 1, col: 2})
        expect(stepFocus('right', inside, merges)).toEqual({row: 3, col: 4})
        expect(stepFocus('left', inside, merges)).toEqual({row: 3, col: 0})
    })

    it('stops at the sheet edges', () => {
        expect(stepFocus('up', {row: 0, col: 3}, [])).toBeNull()
        expect(stepFocus('left', {row: 3, col: 0}, [])).toBeNull()
    })
})

describe('targetLines', () => {
    it('acts on exactly the selected rows', () => {
        expect(
            targetLines({start: 3, end: 6, type: 'row'}, undefined)
        ).toEqual({axis: 'row', start: 3, count: 4})
    })

    it('acts on exactly the selected columns', () => {
        expect(targetLines({start: 2, end: 2, type: 'col'}, undefined)).toEqual({
            axis: 'col',
            start: 2,
            count: 1,
        })
    })

    it('normalizes a line selection dragged upward', () => {
        expect(targetLines({start: 9, end: 5, type: 'row'}, undefined)).toEqual({
            axis: 'row',
            start: 5,
            count: 5,
        })
    })

    it('falls back to the entire rows a cell selection spans', () => {
        // Excel would open a dialog here; the grid picks rows.
        expect(
            targetLines(undefined, {
                startRow: 4,
                startCol: 1,
                endRow: 6,
                endCol: 3,
            })
        ).toEqual({axis: 'row', start: 4, count: 3})
    })

    it('prefers the line selection when both are somehow present', () => {
        expect(
            targetLines({start: 0, end: 0, type: 'col'}, {
                startRow: 4,
                startCol: 1,
                endRow: 6,
                endCol: 3,
            })
        ).toEqual({axis: 'col', start: 0, count: 1})
    })

    it('has nothing to act on with no selection', () => {
        expect(targetLines(undefined, undefined)).toBeNull()
    })
})

describe('linePayloadType', () => {
    it('maps each kind and axis to its payload', () => {
        expect(linePayloadType('insert', 'row')).toBe('insertRows')
        expect(linePayloadType('insert', 'col')).toBe('insertCols')
        expect(linePayloadType('delete', 'row')).toBe('deleteRows')
        expect(linePayloadType('delete', 'col')).toBe('deleteCols')
    })
})

describe('alignFor', () => {
    it('parks the cell against the edge it is heading for', () => {
        expect(alignFor('up')).toEqual({v: 'top', h: 'left'})
        expect(alignFor('left')).toEqual({v: 'top', h: 'left'})
        expect(alignFor('down')).toEqual({v: 'bottom', h: 'right'})
        expect(alignFor('right')).toEqual({v: 'bottom', h: 'right'})
    })
})
