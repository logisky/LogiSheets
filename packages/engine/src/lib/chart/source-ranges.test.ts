import {describe, expect, it} from 'vitest'
import type {ChartInfo} from 'logisheets-web'
import {chartSourceRanges, isRangeVisible, parseA1Range} from './source-ranges'

describe('parseA1Range', () => {
    it('reads an absolute range with a sheet', () => {
        expect(parseA1Range('Sheet1!$B$2:$E$2')).toEqual({
            sheet: 'Sheet1',
            range: {startRow: 1, startCol: 1, endRow: 1, endCol: 4},
        })
    })

    it('reads a range with no sheet as belonging to the chart’s own', () => {
        const parsed = parseA1Range('$A$1:$A$3')
        expect(parsed?.sheet).toBeUndefined()
        expect(parsed?.range).toEqual({
            startRow: 0,
            startCol: 0,
            endRow: 2,
            endCol: 0,
        })
    })

    it('reads a single cell as a one-cell range', () => {
        expect(parseA1Range('Sheet1!$C$5')?.range).toEqual({
            startRow: 4,
            startCol: 2,
            endRow: 4,
            endCol: 2,
        })
    })

    it('accepts relative references too', () => {
        expect(parseA1Range('Sheet1!B2:C3')?.range).toEqual({
            startRow: 1,
            startCol: 1,
            endRow: 2,
            endCol: 2,
        })
    })

    it('unquotes a sheet name, including doubled apostrophes', () => {
        expect(parseA1Range("'Bob''s Data'!$A$1")?.sheet).toBe("Bob's Data")
        expect(parseA1Range("'My Sheet'!$A$1")?.sheet).toBe('My Sheet')
    })

    it('keeps a sheet name that contains an exclamation mark', () => {
        // The split is on the *last* `!`, so the name survives.
        expect(parseA1Range("'Wow!'!$A$1")?.sheet).toBe('Wow!')
    })

    it('normalizes a range written bottom-right to top-left', () => {
        expect(parseA1Range('$E$4:$B$2')?.range).toEqual({
            startRow: 1,
            startCol: 1,
            endRow: 3,
            endCol: 4,
        })
    })

    it('handles columns past Z', () => {
        expect(parseA1Range('$AA$1')?.range.startCol).toBe(26)
        expect(parseA1Range('$AB$1')?.range.startCol).toBe(27)
    })

    it('returns undefined for anything it cannot read', () => {
        for (const bad of ['', 'Sheet1!', 'not a ref', '$A$0', 'A', '1', '#REF!']) {
            expect(parseA1Range(bad), bad).toBeUndefined()
        }
    })
})

describe('isRangeVisible', () => {
    // Rows 10..20, columns 2..8 are laid out.
    const window = {firstRow: 10, lastRow: 20, firstCol: 2, lastCol: 8}
    const range = (
        startRow: number,
        startCol: number,
        endRow: number,
        endCol: number
    ) => ({startRow, startCol, endRow, endCol})

    it('accepts a range inside the window', () => {
        expect(isRangeVisible(range(12, 3, 15, 5), window)).toBe(true)
    })

    it('accepts a range that only overlaps it', () => {
        // Scrolled partly off the top, and partly off the right.
        expect(isRangeVisible(range(5, 3, 12, 5), window)).toBe(true)
        expect(isRangeVisible(range(12, 6, 15, 40), window)).toBe(true)
    })

    it('accepts a range that spans the whole window', () => {
        expect(isRangeVisible(range(0, 0, 100, 100), window)).toBe(true)
    })

    it('rejects a range scrolled past on either side', () => {
        expect(isRangeVisible(range(0, 3, 9, 5), window)).toBe(false)
        expect(isRangeVisible(range(21, 3, 30, 5), window)).toBe(false)
        expect(isRangeVisible(range(12, 0, 15, 1), window)).toBe(false)
        expect(isRangeVisible(range(12, 9, 15, 12), window)).toBe(false)
    })

    it('counts a range touching the very edge as visible', () => {
        expect(isRangeVisible(range(0, 3, 10, 5), window)).toBe(true)
        expect(isRangeVisible(range(20, 8, 40, 40), window)).toBe(true)
    })
})

function info(over: Partial<ChartInfo> = {}): ChartInfo {
    return {
        chartId: 'c1',
        fromRow: 0,
        fromCol: 0,
        fromColOff: 0,
        fromRowOff: 0,
        toRow: 10,
        toCol: 5,
        toColOff: 0,
        toRowOff: 0,
        chartType: 'col',
        stacked: false,
        categories: [],
        series: [],
        dataLabels: {
            showValue: false,
            showCategory: false,
            showSeries: false,
            showPercent: false,
            showLegendKey: false,
        },
        ofPieSplit: {},
        valAxisScale: {reversed: false},
        catAxisScale: {reversed: false},
        ...over,
    } as ChartInfo
}

const series = (over: Record<string, unknown>) =>
    ({
        name: 'S',
        values: [1],
        formattedValues: ['1'],
        sizes: [],
        ...over,
    }) as ChartInfo['series'][number]

describe('chartSourceRanges', () => {
    it('lists the categories first, then each series', () => {
        const ranges = chartSourceRanges(
            info({
                catRef: 'Sheet1!$A$2:$A$4',
                series: [
                    series({name: 'One', valRef: 'Sheet1!$B$2:$B$4'}),
                    series({name: 'Two', valRef: 'Sheet1!$C$2:$C$4'}),
                ],
            })
        )
        expect(ranges.map((r) => [r.kind, r.seriesName])).toEqual([
            ['categories', undefined],
            ['values', 'One'],
            ['values', 'Two'],
        ])
        expect(ranges[1].range).toEqual({
            startRow: 1,
            startCol: 1,
            endRow: 3,
            endCol: 1,
        })
    })

    it('outlines a series in its own colour', () => {
        const ranges = chartSourceRanges(
            info({
                series: [series({valRef: 'Sheet1!$B$2:$B$4', color: 'FF0000'})],
            })
        )
        expect(ranges[0].color).toBe('#FF0000')
    })

    it('drops the alpha from an ARGB colour', () => {
        const ranges = chartSourceRanges(
            info({
                series: [series({valRef: 'Sheet1!$B$2:$B$4', color: 'FF4472C4'})],
            })
        )
        expect(ranges[0].color).toBe('#4472C4')
    })

    it('falls back to a distinct colour per series when none is set', () => {
        const ranges = chartSourceRanges(
            info({
                series: [
                    series({valRef: 'Sheet1!$B$2:$B$4'}),
                    series({valRef: 'Sheet1!$C$2:$C$4'}),
                ],
            })
        )
        expect(ranges[0].color).not.toBe(ranges[1].color)
    })

    it('gives the categories a colour no series will take', () => {
        const ranges = chartSourceRanges(
            info({
                catRef: 'Sheet1!$A$2:$A$4',
                series: [series({valRef: 'Sheet1!$B$2:$B$4'})],
            })
        )
        expect(ranges[0].kind).toBe('categories')
        expect(ranges[0].color).not.toBe(ranges[1].color)
    })

    it('includes a bubble series’ size range, in the series colour', () => {
        const ranges = chartSourceRanges(
            info({
                chartType: 'bubble',
                series: [
                    series({
                        name: 'B',
                        valRef: 'Sheet1!$C$2:$C$4',
                        sizeRef: 'Sheet1!$D$2:$D$4',
                        color: '00FF00',
                    }),
                ],
            })
        )
        expect(ranges.map((r) => r.kind)).toEqual(['values', 'sizes'])
        expect(ranges[1].seriesName).toBe('B')
        expect(ranges[1].color).toBe(ranges[0].color)
    })

    it('keeps the sheet a cross-sheet reference names', () => {
        const ranges = chartSourceRanges(
            info({series: [series({valRef: "'Other Sheet'!$B$2:$B$4"})]})
        )
        expect(ranges[0].sheet).toBe('Other Sheet')
    })

    it('skips a reference it cannot parse rather than guessing', () => {
        const ranges = chartSourceRanges(
            info({
                catRef: 'nonsense',
                series: [
                    series({valRef: 'Sheet1!$B$2:$B$4'}),
                    series({valRef: ''}),
                ],
            })
        )
        expect(ranges).toHaveLength(1)
        expect(ranges[0].kind).toBe('values')
    })

    it('returns nothing for a chart with no references at all', () => {
        expect(chartSourceRanges(info())).toEqual([])
    })
})
