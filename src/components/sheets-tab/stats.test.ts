import {describe, expect, it} from 'vitest'
import type {CellInfo} from 'logisheets-engine'
import {
    CELL_STATS_LIMIT,
    cellRangeStats,
    formatStat,
    shouldSummarise,
} from './stats'

/** A cell carrying one value; the rest of `CellInfo` is irrelevant here. */
const cell = (value: CellInfo['value']): CellInfo =>
    ({value} as unknown as CellInfo)

const num = (n: number) => cell({type: 'number', value: n})
const str = (s: string) => cell({type: 'str', value: s})
const empty = () => cell('empty')

const range = (
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number
) => ({startRow, startCol, endRow, endCol})

describe('shouldSummarise', () => {
    it('says nothing about a single cell', () => {
        // Its value is already on screen, and Excel shows no total either.
        expect(shouldSummarise(range(2, 2, 2, 2))).toBe(false)
    })

    it('summarises anything from two cells up', () => {
        expect(shouldSummarise(range(0, 0, 0, 1))).toBe(true)
        expect(shouldSummarise(range(0, 0, 1, 0))).toBe(true)
        expect(shouldSummarise(range(1, 1, 3, 4))).toBe(true)
    })

    it('accepts a range given bottom-right to top-left', () => {
        expect(shouldSummarise(range(3, 4, 1, 1))).toBe(true)
    })

    it('refuses a selection too large to be a question about totals', () => {
        // A whole column: the user wants the column, not its sum.
        expect(shouldSummarise(range(0, 0, CELL_STATS_LIMIT, 0))).toBe(false)
    })

    it('takes the limit itself, and stops one past it', () => {
        expect(shouldSummarise(range(0, 0, CELL_STATS_LIMIT - 1, 0))).toBe(true)
        expect(shouldSummarise(range(0, 0, CELL_STATS_LIMIT, 0))).toBe(false)
    })

    it('has nothing to say without a selection', () => {
        expect(shouldSummarise(undefined)).toBe(false)
    })
})

describe('cellRangeStats', () => {
    it('sums and counts the numbers', () => {
        expect(cellRangeStats([num(11), num(3), num(23)])).toEqual({
            count: 3,
            sum: 37,
        })
    })

    it('skips text rather than coercing it', () => {
        // "12" as text is a label, not a quantity — counting it would invent
        // a total the sheet does not have.
        expect(cellRangeStats([num(10), str('12'), num(5)])).toEqual({
            count: 2,
            sum: 15,
        })
    })

    it('skips blanks instead of counting them as zero', () => {
        // Blanks must not drag the average down: 10 and 20 average 15, not 10.
        const stats = cellRangeStats([num(10), empty(), num(20), empty()])
        expect(stats).toEqual({count: 2, sum: 30})
        expect(stats!.sum / stats!.count).toBe(15)
    })

    it('skips booleans and errors', () => {
        const stats = cellRangeStats([
            num(4),
            cell({type: 'bool', value: true}),
            cell({type: 'error', value: '#DIV/0!'}),
            num(6),
        ])
        expect(stats).toEqual({count: 2, sum: 10})
    })

    it('shows nothing when the range holds no numbers', () => {
        expect(cellRangeStats([str('a'), str('b'), empty()])).toBeNull()
        expect(cellRangeStats([])).toBeNull()
    })

    it('keeps negatives and decimals', () => {
        expect(cellRangeStats([num(-5), num(2.5), num(0)])).toEqual({
            count: 3,
            sum: -2.5,
        })
    })

    it('counts a zero as a number', () => {
        // `0` is falsy; a truthiness test here would silently drop it.
        expect(cellRangeStats([num(0), num(0)])).toEqual({count: 2, sum: 0})
    })
})

describe('formatStat', () => {
    it('groups thousands', () => {
        expect(formatStat(1234567)).toBe('1,234,567')
    })

    it('stops at two decimals', () => {
        expect(formatStat(20.666666)).toBe('20.67')
        expect(formatStat(1 / 3)).toBe('0.33')
    })

    it('does not pad a whole number with decimals', () => {
        expect(formatStat(248)).toBe('248')
    })

    it('keeps a negative sign', () => {
        expect(formatStat(-1234.5)).toBe('-1,234.5')
    })

    it('never goes scientific, which would jump the strip around', () => {
        expect(formatStat(1e21)).not.toMatch(/e/i)
    })

    it('shows a dash for a non-finite average', () => {
        // `sum / count` with count 0 — guarded upstream, but cheap to survive.
        expect(formatStat(NaN)).toBe('—')
        expect(formatStat(Infinity)).toBe('—')
    })
})
