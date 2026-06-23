import {describe, it, expect} from 'vitest'
import {SpreadsheetRuntime} from './index.js'

describe('SpreadsheetRuntime (Node, real WASM engine)', () => {
    it('imports records and exports them back', () => {
        const rt = SpreadsheetRuntime.create()
        const target = {sheetIdx: 0, startRow: 0, startCol: 0}
        const ok = rt.writeRecords(target, [
            ['Name', 'Qty'],
            ['Widget', '10'],
        ])
        expect(ok).toBe(true)
        const back = rt.readRecords(target, 2, 2)
        expect(back[0][0]).toEqual({type: 'str', value: 'Name'})
        expect(back[1][1]).toEqual({type: 'number', value: 10})
        rt.close()
    })

    it('reports formula-validation and field-constraint violations', () => {
        const rt = SpreadsheetRuntime.create()
        rt.writeRecords({sheetIdx: 0, startRow: 0, startCol: 0}, [
            ['Alice', 'Active', '30'],
            ['Bob', 'Frozen', '25'], // Frozen not allowed
            ['Alice', 'Active', '-5'], // dup name; age fails >0
        ])
        const rows = [0, 1, 2]

        const fieldViol = rt.checkFieldConstraints([
            {
                field: {name: 'Name', required: true, unique: true},
                cells: rows.map((r) => ({sheetIdx: 0, row: r, col: 0})),
            },
            {
                field: {name: 'Status', required: true, unique: false},
                allowed: ['Active', 'Closed'],
                cells: rows.map((r) => ({sheetIdx: 0, row: r, col: 1})),
            },
        ])
        expect(fieldViol.map((v) => v.kind).sort()).toEqual([
            'duplicate',
            'membership',
        ])

        const formulaViol = rt.checkValidations(
            rows.map((r) => ({
                sheetIdx: 0,
                row: r,
                col: 2,
                formula: `C${r + 1}>0`,
            }))
        )
        expect(formulaViol).toHaveLength(1)
        expect(formulaViol[0].row).toBe(2)
        rt.close()
    })
})
