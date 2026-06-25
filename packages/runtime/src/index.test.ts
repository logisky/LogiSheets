import {describe, it, expect} from 'vitest'
import {SpreadsheetRuntime} from './index.js'

// Write a 2-D block of string cells anchored at (0,0) via the shared ops
// layer — the runtime no longer ships a bespoke bulk importer.
async function writeBlock(
    rt: SpreadsheetRuntime,
    rows: ReadonlyArray<ReadonlyArray<string>>
) {
    for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) {
            await rt.inputCell(0, r, c, rows[r][c])
        }
    }
}

describe('SpreadsheetRuntime (Node, real WASM engine)', () => {
    it('inputs cells and reads their evaluated values back', async () => {
        const rt = SpreadsheetRuntime.create()
        await writeBlock(rt, [
            ['Name', 'Qty'],
            ['Widget', '10'],
        ])
        expect(rt.getValue(0, 0, 0)).toEqual({type: 'str', value: 'Name'})
        expect(rt.getValue(0, 1, 1)).toEqual({type: 'number', value: 10})
        rt.close()
    })

    it('reports formula-validation and field-constraint violations', async () => {
        const rt = SpreadsheetRuntime.create()
        await writeBlock(rt, [
            ['Alice', 'Active', '30'],
            ['Bob', 'Frozen', '25'], // Frozen not allowed
            ['Alice', 'Active', '-5'], // dup name; age fails >0
        ])
        const rows = [0, 1, 2]

        const fieldViol = await rt.checkFieldConstraints([
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

        const formulaViol = await rt.checkValidations(
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

    it('sets a validation rule via the shared WorkbookOps operation layer', async () => {
        const rt = SpreadsheetRuntime.create()
        await writeBlock(rt, [['5']])

        // Same operation the browser's ValidationCell runs, served from
        // logisheets-core. It parks `=A1>0` in A1's shadow cell.
        await expect(
            rt.setValidationRule(0, 0, 0, 'A1>0')
        ).resolves.toBeUndefined()

        rt.close()
    })

    it('applies a number format via the shared formatting operation', async () => {
        const rt = SpreadsheetRuntime.create()
        await writeBlock(rt, [['1.5']])

        // Same operation the browser's toolbar/num-fmt dialog runs — the
        // payload generation now lives in logisheets-core, so Node runs it
        // unchanged.
        await expect(
            rt.ops.setNumFmt(
                0,
                {
                    data: {
                        ty: 'cellRange',
                        d: {startRow: 0, endRow: 0, startCol: 0, endCol: 0},
                    },
                    source: 'none',
                },
                '0.00'
            )
        ).resolves.toBeUndefined()

        rt.close()
    })
})
