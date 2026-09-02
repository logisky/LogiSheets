import {describe, expect, it} from 'vitest'
import type {Grid} from '$types/index'
import {
    xForColStart,
    xForColStartUnclamped,
    yForRowStart,
    yForRowStartUnclamped,
} from './utils'

/**
 * A laid-out window of rows 10..14 and columns 5..8, all 20px × 100px, scrolled
 * so the first of each is partly off the top/left. Only these rows and columns
 * have sizes; anything else is what the unclamped helpers have to estimate.
 */
function grid(over: Partial<Grid> = {}): Grid {
    return {
        rows: Array.from({length: 5}, (_, i) => ({idx: 10 + i, height: 20})),
        columns: Array.from({length: 4}, (_, i) => ({idx: 5 + i, width: 100})),
        subOffsetX: 30,
        subOffsetY: 5,
        ...over,
    } as unknown as Grid
}

describe('yForRowStartUnclamped', () => {
    it('agrees with the clamped helper inside the window', () => {
        const g = grid()
        for (const row of [10, 11, 14]) {
            expect(yForRowStartUnclamped(row, g)).toBe(yForRowStart(row, g))
        }
    })

    it('extrapolates above the window instead of pinning to the edge', () => {
        const g = grid()
        // Row 10's top edge is -5 (it is scrolled 5px off). Row 9 is one row
        // higher, row 5 is five rows higher.
        expect(yForRowStartUnclamped(10, g)).toBe(-5)
        expect(yForRowStartUnclamped(9, g)).toBe(-25)
        expect(yForRowStartUnclamped(5, g)).toBe(-105)
    })

    it('extrapolates below the window', () => {
        const g = grid()
        // Rows 10..14 occupy -5..95, so row 15 starts at 95.
        expect(yForRowStartUnclamped(15, g)).toBe(95)
        expect(yForRowStartUnclamped(18, g)).toBe(155)
    })

    it('keeps a distance that the clamped helper would collapse', () => {
        const g = grid()
        // The anchors of something spanning rows 2..6, entirely above the
        // window: clamped, both edges land on the window edge and it has no
        // height at all.
        expect(yForRowStart(6, g) - yForRowStart(2, g)).toBe(0)
        expect(
            yForRowStartUnclamped(6, g) - yForRowStartUnclamped(2, g)
        ).toBe(80)
    })

    it('uses the size of the row nearest the edge it passes', () => {
        // A tall first row and a short last one: each side extrapolates with
        // its own neighbour rather than one global guess.
        const g = grid({
            rows: [
                {idx: 10, height: 50},
                {idx: 11, height: 20},
                {idx: 12, height: 8},
            ],
        } as Partial<Grid>)
        expect(yForRowStartUnclamped(9, g)).toBe(-5 - 50)
        // Rows 10..12 occupy -5..73, so row 13 starts at 73 and 14 is 8 later.
        expect(yForRowStartUnclamped(13, g)).toBe(73)
        expect(yForRowStartUnclamped(14, g)).toBe(81)
    })

    it('returns 0 when the grid has no rows laid out yet', () => {
        expect(yForRowStartUnclamped(3, grid({rows: []} as Partial<Grid>))).toBe(0)
    })
})

describe('xForColStartUnclamped', () => {
    it('agrees with the clamped helper inside the window', () => {
        const g = grid()
        for (const col of [5, 6, 8]) {
            expect(xForColStartUnclamped(col, g)).toBe(xForColStart(col, g))
        }
    })

    it('extrapolates on both sides', () => {
        const g = grid()
        expect(xForColStartUnclamped(5, g)).toBe(-30)
        expect(xForColStartUnclamped(4, g)).toBe(-130)
        expect(xForColStartUnclamped(2, g)).toBe(-330)
        // Columns 5..8 occupy -30..370, so column 9 starts at 370.
        expect(xForColStartUnclamped(9, g)).toBe(370)
        expect(xForColStartUnclamped(11, g)).toBe(570)
    })

    it('returns 0 when the grid has no columns laid out yet', () => {
        expect(xForColStartUnclamped(3, grid({columns: []} as Partial<Grid>))).toBe(
            0
        )
    })
})
