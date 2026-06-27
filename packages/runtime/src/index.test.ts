import {fileURLToPath} from 'node:url'
import {resolve, dirname} from 'node:path'
import {describe, it, expect} from 'vitest'
import {SpreadsheetRuntime, Workbook} from './index.js'

// A real .xlsx fixture shipped in the repo's top-level tests/ directory.
const FIXTURE = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../tests/6.xlsx'
)

// Write a 2-D block of string cells anchored at (0,0) via the shared ops
// layer — the runtime no longer ships a bespoke bulk importer.
async function writeBlock(
    wb: Workbook,
    rows: ReadonlyArray<ReadonlyArray<string>>
) {
    for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) {
            await wb.ops.inputCell(0, r, c, rows[r][c])
        }
    }
}

describe('SpreadsheetRuntime (Node, real WASM engine)', () => {
    it('inputs cells and reads their evaluated values back', async () => {
        const rt = new SpreadsheetRuntime()
        const wb = rt.createWorkbook()
        await writeBlock(wb, [
            ['Name', 'Qty'],
            ['Widget', '10'],
        ])
        expect(wb.getValue(0, 0, 0)).toEqual({type: 'str', value: 'Name'})
        expect(wb.getValue(0, 1, 1)).toEqual({type: 'number', value: 10})
        rt.closeAll()
    })

    it('reports formula-validation and field-constraint violations', async () => {
        const rt = new SpreadsheetRuntime()
        const wb = rt.createWorkbook()
        await writeBlock(wb, [
            ['Alice', 'Active', '30'],
            ['Bob', 'Frozen', '25'], // Frozen not allowed
            ['Alice', 'Active', '-5'], // dup name; age fails >0
        ])
        const rows = [0, 1, 2]

        const fieldViol = await wb.ops.checkFieldConstraints([
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

        const formulaViol = await wb.ops.checkValidations(
            rows.map((r) => ({
                sheetIdx: 0,
                row: r,
                col: 2,
                formula: `C${r + 1}>0`,
            }))
        )
        expect(formulaViol).toHaveLength(1)
        expect(formulaViol[0].row).toBe(2)
        rt.closeAll()
    })

    it('sets a validation rule via the shared WorkbookOps operation layer', async () => {
        const rt = new SpreadsheetRuntime()
        const wb = rt.createWorkbook()
        await writeBlock(wb, [['5']])

        // Same operation the browser's ValidationCell runs, served from
        // logisheets-core. It parks `=A1>0` in A1's shadow cell.
        await expect(
            wb.ops.setValidationRule(0, 0, 0, 'A1>0')
        ).resolves.toBeUndefined()

        rt.closeAll()
    })

    it('applies a number format via the shared formatting operation', async () => {
        const rt = new SpreadsheetRuntime()
        const wb = rt.createWorkbook()
        await writeBlock(wb, [['1.5']])

        // Same operation the browser's toolbar/num-fmt dialog runs — the
        // payload generation now lives in logisheets-core, so Node runs it
        // unchanged.
        await expect(
            wb.ops.setNumFmt(
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

        rt.closeAll()
    })

    it('loads a workbook from a file path and exposes the raw client', async () => {
        const rt = new SpreadsheetRuntime()
        const wb = await rt.loadWorkbook(FIXTURE)
        try {
            expect(wb.path).toBe(FIXTURE)
            // The `client` escape hatch drives the engine directly.
            const sheets = await wb.client.getAllSheetInfo()
            expect(Array.isArray(sheets)).toBe(true)
            expect((sheets as readonly unknown[]).length).toBeGreaterThan(0)
        } finally {
            rt.closeAll()
        }
    })

    it('deduplicates repeated loads of the same path, then reloads after close', async () => {
        const rt = new SpreadsheetRuntime()
        const first = await rt.loadWorkbook(FIXTURE)
        const second = await rt.loadWorkbook(FIXTURE)
        expect(second).toBe(first) // same path -> same live workbook

        rt.close(first)

        // After close the cache entry is gone, so a fresh handle is built.
        const third = await rt.loadWorkbook(FIXTURE)
        expect(third).not.toBe(first)
        rt.closeAll()
    })

    it('holds multiple distinct workbooks at once', async () => {
        const rt = new SpreadsheetRuntime()
        const wb1 = rt.createWorkbook()
        const wb2 = rt.createWorkbook()
        const wb3 = rt.createWorkbook()
        await wb1.ops.inputCell(0, 0, 0, 'one')
        await wb2.ops.inputCell(0, 0, 0, 'two')
        await wb3.ops.inputCell(0, 0, 0, 'three')
        expect(wb1.getValue(0, 0, 0)).toEqual({type: 'str', value: 'one'})
        expect(wb2.getValue(0, 0, 0)).toEqual({type: 'str', value: 'two'})
        expect(wb3.getValue(0, 0, 0)).toEqual({type: 'str', value: 'three'})
        expect(rt.workbooks).toHaveLength(3)
        rt.closeAll()
        expect(rt.workbooks).toHaveLength(0)
    })
})
