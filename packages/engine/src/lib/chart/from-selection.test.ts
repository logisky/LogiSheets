import {describe, expect, it} from 'vitest'
import {chartDataRefsFromSelection} from './from-selection'
import type {SelectionCells, SelectionRange} from './from-selection'

/**
 * A sheet built from a literal grid, indexed [row][col]. Strings are text
 * cells, numbers are numeric, `null` is empty — which is what the header/label
 * probe has to tell apart.
 */
function sheet(grid: Array<Array<string | number | null>>): SelectionCells {
    const at = (r: number, c: number) => grid[r]?.[c] ?? null
    return {
        isText: async (r, c) => typeof at(r, c) === 'string' && at(r, c) !== '',
        textAt: async (r, c) => {
            const v = at(r, c)
            return v === null || v === '' ? undefined : String(v)
        },
    }
}

const range = (
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number
): SelectionRange => ({startRow, startCol, endRow, endCol})

/** Labels down the left, series names across the top, numbers in between. */
const TABLE = [
    ['', 'Q1', 'Q2'],
    ['North', 1, 2],
    ['South', 3, 4],
]

describe('chartDataRefsFromSelection', () => {
    it('reads a leading text column as categories and a text row as names', async () => {
        const refs = await chartDataRefsFromSelection(
            'col',
            range(0, 0, 2, 2),
            'Sheet1',
            sheet(TABLE)
        )
        // Categories skip the header row, so they start at row 2.
        expect(refs.categoriesRef).toBe('Sheet1!$A$2:$A$3')
        expect(refs.series).toEqual([
            {name: 'Q1', valueRef: 'Sheet1!$B$2:$B$3'},
            {name: 'Q2', valueRef: 'Sheet1!$C$2:$C$3'},
        ])
    })

    it('keeps the first row as data when only the labels make it text', async () => {
        // Row labels but no header row. The corner cell is text, but it is the
        // label column's own cell — it must not make the row look like names,
        // or the first data row is silently eaten.
        const refs = await chartDataRefsFromSelection(
            'col',
            range(0, 0, 2, 2),
            'Sheet1',
            sheet([
                ['North', 9, 9],
                ['South', 1, 2],
                ['East', 3, 4],
            ])
        )
        expect(refs.series.map((s) => s.name)).toEqual([undefined, undefined])
        // No header row, so the data starts at row 1 and keeps all three rows.
        expect(refs.categoriesRef).toBe('Sheet1!$A$1:$A$3')
        expect(refs.series[0].valueRef).toBe('Sheet1!$B$1:$B$3')
    })

    it('leaves categories undefined when nothing labels the rows', async () => {
        const refs = await chartDataRefsFromSelection(
            'col',
            range(0, 0, 2, 1),
            'Sheet1',
            sheet([
                [1, 2],
                [3, 4],
                [5, 6],
            ])
        )
        expect(refs.categoriesRef).toBeUndefined()
        expect(refs.series).toHaveLength(2)
        expect(refs.series[0].valueRef).toBe('Sheet1!$A$1:$A$3')
    })

    it('has no label column to spare in a single-column selection', async () => {
        const refs = await chartDataRefsFromSelection(
            'col',
            range(0, 0, 2, 0),
            'Sheet1',
            sheet([['North'], [1], [2]])
        )
        // The one column is the data, and its text first cell is the series
        // name — there is no second column for it to label.
        expect(refs.categoriesRef).toBeUndefined()
        expect(refs.series).toEqual([
            {name: 'North', valueRef: 'Sheet1!$A$2:$A$3'},
        ])
    })

    it('has no header row to spare in a single-row selection', async () => {
        const refs = await chartDataRefsFromSelection(
            'col',
            range(0, 0, 0, 2),
            'Sheet1',
            sheet([['North', 1, 2]])
        )
        // One row cannot also be a header row, so nothing is named; the text
        // cell still labels the single category.
        expect(refs.series.map((s) => s.name)).toEqual([undefined, undefined])
        expect(refs.categoriesRef).toBe('Sheet1!$A$1:$A$1')
    })

    it('accepts a selection given bottom-right to top-left', async () => {
        const normal = await chartDataRefsFromSelection(
            'col',
            range(0, 0, 2, 2),
            'Sheet1',
            sheet(TABLE)
        )
        const reversed = await chartDataRefsFromSelection(
            'col',
            range(2, 2, 0, 0),
            'Sheet1',
            sheet(TABLE)
        )
        expect(reversed).toEqual(normal)
    })

    it('quotes a sheet name that needs it', async () => {
        const refs = await chartDataRefsFromSelection(
            'col',
            range(0, 0, 2, 2),
            "Bob's Data",
            sheet(TABLE)
        )
        expect(refs.categoriesRef).toBe("'Bob''s Data'!$A$2:$A$3")
        expect(refs.series[0].valueRef).toBe("'Bob''s Data'!$B$2:$B$3")
    })

    it('addresses columns past Z correctly', async () => {
        const refs = await chartDataRefsFromSelection(
            'col',
            range(0, 25, 1, 27),
            'Sheet1',
            sheet([])
        )
        expect(refs.series.map((s) => s.valueRef)).toEqual([
            'Sheet1!$Z$1:$Z$2',
            'Sheet1!$AA$1:$AA$2',
            'Sheet1!$AB$1:$AB$2',
        ])
    })

    describe('bubble', () => {
        // X, then (Y, size) pairs — all numeric, so the generic label-column
        // rule must not claim the first column.
        const BUBBLE = [
            ['X', 'Sales', 'Size', 'Cost', 'Weight'],
            [1, 10, 100, 20, 200],
            [2, 11, 110, 21, 210],
        ]

        it('takes the first data column as the shared X', async () => {
            const refs = await chartDataRefsFromSelection(
                'bubble',
                range(0, 0, 2, 4),
                'Sheet1',
                sheet(BUBBLE)
            )
            expect(refs.categoriesRef).toBe('Sheet1!$A$2:$A$3')
            expect(refs.series).toEqual([
                {
                    name: 'Sales',
                    valueRef: 'Sheet1!$B$2:$B$3',
                    sizeRef: 'Sheet1!$C$2:$C$3',
                },
                {
                    name: 'Cost',
                    valueRef: 'Sheet1!$D$2:$D$3',
                    sizeRef: 'Sheet1!$E$2:$E$3',
                },
            ])
        })

        it('plots a trailing Y that has no size column', async () => {
            const refs = await chartDataRefsFromSelection(
                'bubble',
                range(0, 0, 2, 3),
                'Sheet1',
                sheet(BUBBLE)
            )
            expect(refs.series).toHaveLength(2)
            expect(refs.series[1]).toEqual({
                name: 'Cost',
                valueRef: 'Sheet1!$D$2:$D$3',
                sizeRef: undefined,
            })
        })

        it('keeps a text first column as X rather than as labels', async () => {
            // The same shape as a normal chart's label column — a bubble reads
            // it as X regardless, because it needs numeric X values.
            const refs = await chartDataRefsFromSelection(
                'bubble',
                range(0, 0, 2, 2),
                'Sheet1',
                sheet(TABLE)
            )
            expect(refs.categoriesRef).toBe('Sheet1!$A$2:$A$3')
            expect(refs.series).toEqual([
                {
                    name: 'Q1',
                    valueRef: 'Sheet1!$B$2:$B$3',
                    sizeRef: 'Sheet1!$C$2:$C$3',
                },
            ])
        })

        it('falls back to one series when there is only one column', async () => {
            const refs = await chartDataRefsFromSelection(
                'bubble',
                range(0, 0, 2, 0),
                'Sheet1',
                sheet([[1], [2], [3]])
            )
            // Nothing to pair with, so no series rather than a broken one.
            expect(refs.series).toHaveLength(0)
            expect(refs.categoriesRef).toBeUndefined()
        })
    })

    it('gives every other kind one series per column', async () => {
        for (const kind of ['line', 'pie', 'radar', 'stock', 'surface']) {
            const refs = await chartDataRefsFromSelection(
                kind,
                range(0, 0, 2, 2),
                'Sheet1',
                sheet(TABLE)
            )
            expect(refs.series.map((s) => s.valueRef)).toEqual([
                'Sheet1!$B$2:$B$3',
                'Sheet1!$C$2:$C$3',
            ])
            expect(refs.series.every((s) => s.sizeRef === undefined)).toBe(true)
        }
    })
})
