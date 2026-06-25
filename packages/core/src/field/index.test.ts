import {describe, it, expect} from 'vitest'
import {checkFieldConstraints} from './index.js'

function getterFrom(grid: Record<string, unknown>) {
    return (s: number, r: number, c: number) =>
        (grid[`${s}:${r}:${c}`] ?? 'empty') as never
}

describe('checkFieldConstraints', () => {
    it('flags required empties and duplicate uniques', () => {
        const getValue = getterFrom({
            '0:0:0': {type: 'str', value: 'Alice'},
            '0:1:0': {type: 'str', value: 'Bob'},
            '0:2:0': {type: 'str', value: 'Alice'}, // dup
            '0:3:0': 'empty', // required miss
        })
        const cells = [0, 1, 2, 3].map((r) => ({sheetIdx: 0, row: r, col: 0}))
        const out = checkFieldConstraints(
            [{field: {name: 'Name', required: true, unique: true}, cells}],
            getValue
        )
        const kinds = out.map((v) => `${v.row}:${v.kind}`).sort()
        expect(kinds).toEqual(['2:duplicate', '3:required'])
    })

    it('flags values outside the allowed set (enum membership)', () => {
        const getValue = getterFrom({
            '0:0:0': {type: 'str', value: 'Red'},
            '0:1:0': {type: 'str', value: 'Purple'}, // not allowed
        })
        const cells = [0, 1].map((r) => ({sheetIdx: 0, row: r, col: 0}))
        const out = checkFieldConstraints(
            [
                {
                    field: {name: 'Color', required: false, unique: false},
                    cells,
                    allowed: ['Red', 'Green', 'Blue'],
                },
            ],
            getValue
        )
        expect(out).toHaveLength(1)
        expect(out[0].kind).toBe('membership')
        expect(out[0].row).toBe(1)
    })

    it('treats empty string as empty for required', () => {
        const getValue = getterFrom({'0:0:0': {type: 'str', value: ''}})
        const out = checkFieldConstraints(
            [
                {
                    field: {name: 'X', required: true, unique: false},
                    cells: [{sheetIdx: 0, row: 0, col: 0}],
                },
            ],
            getValue
        )
        expect(out[0].kind).toBe('required')
    })
})
