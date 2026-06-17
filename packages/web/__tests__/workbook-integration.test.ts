import {describe, it, expect, beforeEach} from 'vitest'
import {Workbook} from '../src/api/workbook'
import {isErrorMessage} from '../src/api/utils'
import {CalcException, CustomFunc} from '../src/api/calculator'
import type {Value} from '../src/bindings'

describe('Workbook integration (real WASM)', () => {
    beforeEach(() => {
        // Each test gets a fresh workbook instance; WASM state is shared but
        // every Workbook constructor allocates a new book id on the Rust side.
    })

    it('creates a workbook with one default sheet', () => {
        const book = new Workbook()
        expect(book.getSheetCount()).toBe(1)

        const name = book.getSheetNameByIdx(0)
        expect(isErrorMessage(name)).toBe(false)
        expect(name).toBe('Sheet1')
    })

    it('inputs values and evaluates formulas', () => {
        const book = new Workbook()
        const sheet = book.getWorksheet(0)

        const effect = book.execTransaction({
            payloads: [
                {
                    type: 'cellInput',
                    value: {sheetIdx: 0, row: 0, col: 0, content: '10'},
                },
                {
                    type: 'cellInput',
                    value: {sheetIdx: 0, row: 0, col: 1, content: '20'},
                },
                {
                    type: 'cellInput',
                    value: {sheetIdx: 0, row: 0, col: 2, content: '=A1+B1'},
                },
            ],
            undoable: true,
            temp: false,
        })
        expect(effect.status.type).toBe('ok')

        const value = sheet.getValue(0, 2)
        expect(isErrorMessage(value)).toBe(false)
        expect(value).toEqual({type: 'number', value: 30})
    })

    it('updates dependents after editing a source cell', () => {
        const book = new Workbook()
        const sheet = book.getWorksheet(0)

        book.execTransaction({
            payloads: [
                {
                    type: 'cellInput',
                    value: {sheetIdx: 0, row: 1, col: 0, content: '5'},
                },
                {
                    type: 'cellInput',
                    value: {sheetIdx: 0, row: 1, col: 1, content: '=A2*3'},
                },
            ],
            undoable: true,
            temp: false,
        })
        expect(sheet.getValue(1, 1)).toEqual({type: 'number', value: 15})

        book.execTransaction({
            payloads: [
                {
                    type: 'cellInput',
                    value: {sheetIdx: 0, row: 1, col: 0, content: '7'},
                },
            ],
            undoable: true,
            temp: false,
        })
        expect(sheet.getValue(1, 1)).toEqual({type: 'number', value: 21})
    })

    it('inserts rows and shifts dependent formulas', () => {
        const book = new Workbook()
        const sheet = book.getWorksheet(0)

        book.execTransaction({
            payloads: [
                {
                    type: 'cellInput',
                    value: {sheetIdx: 0, row: 0, col: 0, content: '1'},
                },
                {
                    type: 'cellInput',
                    value: {sheetIdx: 0, row: 1, col: 0, content: '=A1+10'},
                },
            ],
            undoable: true,
            temp: false,
        })
        expect(sheet.getValue(1, 0)).toEqual({type: 'number', value: 11})

        book.execTransaction({
            payloads: [
                {
                    type: 'insertRows',
                    value: {sheetIdx: 0, start: 0, count: 1},
                },
            ],
            undoable: true,
            temp: false,
        })

        // The original A1 moved to A2; the formula moved to A3 and still references A2.
        expect(sheet.getValue(2, 0)).toEqual({type: 'number', value: 11})
    })

    it('manages multiple sheets', () => {
        const book = new Workbook()

        book.execTransaction({
            payloads: [
                {
                    type: 'createSheet',
                    value: {idx: 1, newName: 'Summary'},
                },
            ],
            undoable: true,
            temp: false,
        })
        expect(book.getSheetCount()).toBe(2)

        const summary = book.getWorksheet(1)
        book.execTransaction({
            payloads: [
                {
                    type: 'cellInput',
                    value: {sheetIdx: 0, row: 0, col: 0, content: '123'},
                },
                {
                    type: 'cellInput',
                    value: {sheetIdx: 1, row: 0, col: 0, content: '=Sheet1!A1'},
                },
            ],
            undoable: true,
            temp: false,
        })

        // The formula on Summary pulls its value from Sheet1 across sheets.
        const value = summary.getValue(0, 0)
        expect(isErrorMessage(value)).toBe(false)
        expect(value).toEqual({type: 'number', value: 123})
    })

    it('sets row heights and column widths', () => {
        const book = new Workbook()
        const sheet = book.getWorksheet(0)

        const heightEffect = book.execTransaction({
            payloads: [
                {
                    type: 'setRowHeight',
                    value: {sheetIdx: 0, row: 0, height: 99},
                },
                {
                    type: 'setColWidth',
                    value: {sheetIdx: 0, col: 0, width: 199},
                },
            ],
            undoable: true,
            temp: false,
        })
        expect(heightEffect.status.type).toBe('ok')

        const row = sheet.getRowInfo(0)
        expect(isErrorMessage(row)).toBe(false)
        if (!isErrorMessage(row)) {
            expect(row.height).toBe(99)
        }

        const col = sheet.getColInfo(0)
        expect(isErrorMessage(col)).toBe(false)
        if (!isErrorMessage(col)) {
            expect(col.width).toBe(199)
        }
    })

    it('undoes and redoes transactions', () => {
        const book = new Workbook()
        const sheet = book.getWorksheet(0)

        book.execTransaction({
            payloads: [
                {
                    type: 'cellInput',
                    value: {sheetIdx: 0, row: 0, col: 0, content: 'hello'},
                },
            ],
            undoable: true,
            temp: false,
        })
        expect(sheet.getValue(0, 0)).toEqual({type: 'str', value: 'hello'})

        expect(book.undo()).toBe(true)
        expect(sheet.getValue(0, 0)).toBe('empty')

        expect(book.redo()).toBe(true)
        expect(sheet.getValue(0, 0)).toEqual({type: 'str', value: 'hello'})
    })

    it('merges and splits cells', () => {
        const book = new Workbook()
        const sheet = book.getWorksheet(0)

        book.execTransaction({
            payloads: [
                {
                    type: 'mergeCells',
                    value: {
                        sheetIdx: 0,
                        startRow: 0,
                        startCol: 0,
                        endRow: 1,
                        endCol: 1,
                    },
                },
            ],
            undoable: true,
            temp: false,
        })
        expect(sheet.getMergedCells(0, 0, 5, 5)).toHaveLength(1)

        book.execTransaction({
            payloads: [
                {
                    type: 'splitMergedCells',
                    value: {sheetIdx: 0, row: 0, col: 0},
                },
            ],
            undoable: true,
            temp: false,
        })
        expect(sheet.getMergedCells(0, 0, 5, 5)).toHaveLength(0)
    })

    it('round-trips save and load with app data', () => {
        const book = new Workbook()
        book.execTransaction({
            payloads: [
                {
                    type: 'cellInput',
                    value: {sheetIdx: 0, row: 0, col: 0, content: 'persist'},
                },
            ],
            undoable: true,
            temp: false,
        })

        const envelope = JSON.stringify({version: 1, payload: 'test'})
        const saved = book.save(envelope)
        expect(saved.code).toBe(0)
        expect(saved.data.length).toBeGreaterThan(0)

        const restored = new Workbook()
        const bytes = new Uint8Array(saved.data as unknown as number[])
        const loadCode = restored.load(bytes, 'roundtrip.xlsx')
        expect(loadCode).toBe(0)

        const sheet = restored.getWorksheet(0)
        expect(sheet.getValue(0, 0)).toEqual({type: 'str', value: 'persist'})

        const appData = restored.getAppData()
        const ours = appData.find((d) => d.name === 'logisheets')
        expect(ours).toBeDefined()
        expect(ours!.data).toBe(envelope)
    })

    it('surfaces async functions as tasks and invokes the JS executor', async () => {
        const book = new Workbook()
        const sheet = book.getWorksheet(0)

        // The engine only recognizes async function names that are registered
        // in its settings. BAIDUHOTSEARCH is the built-in demo async function.
        const seenArgs: string[][] = []
        book.registryCustomFunc(
            new CustomFunc('BAIDUHOTSEARCH', async (args) => {
                seenArgs.push([...args])
                const v = Number(args[0])
                if (Number.isNaN(v)) return CalcException.ArgErr
                return String(v * 2)
            })
        )

        const effect = book.execTransaction({
            payloads: [
                {
                    type: 'cellInput',
                    value: {sheetIdx: 0, row: 0, col: 0, content: '21'},
                },
                {
                    type: 'cellInput',
                    value: {
                        sheetIdx: 0,
                        row: 0,
                        col: 1,
                        content: '=BAIDUHOTSEARCH(A1)',
                    },
                },
            ],
            undoable: true,
            temp: false,
        })

        // The engine hands the async call back to JS as a task carrying the
        // resolved argument value, and the cell shows the pending placeholder
        // until the result is fed back in.
        expect(effect.asyncTasks).toEqual([
            {asyncFunc: 'BAIDUHOTSEARCH', args: ['21']},
        ])
        expect(sheet.getValue(0, 1)).toEqual({
            type: 'error',
            value: '#GETTING_DATA',
        })

        // Let the registered executor run; it should receive the same args.
        await new Promise((resolve) => setTimeout(resolve, 10))
        expect(seenArgs).toEqual([['21']])
    })

    it('supports temp status branch and commit', () => {
        const book = new Workbook()
        const sheet = book.getWorksheet(0)

        book.toggleStatus(true)
        book.execTransaction({
            payloads: [
                {
                    type: 'cellInput',
                    value: {sheetIdx: 0, row: 0, col: 0, content: 'temp-value'},
                },
            ],
            undoable: true,
            temp: true,
        })

        // Temp value is visible while on the temp branch.
        expect(sheet.getValue(0, 0)).toEqual({type: 'str', value: 'temp-value'})

        book.cleanupTempStatus()
        book.toggleStatus(false)
        expect(sheet.getValue(0, 0)).toBe('empty')

        // Run the temp transaction again and commit it.
        book.toggleStatus(true)
        book.execTransaction({
            payloads: [
                {
                    type: 'cellInput',
                    value: {sheetIdx: 0, row: 0, col: 0, content: 'committed'},
                },
            ],
            undoable: true,
            temp: true,
        })
        book.commitTempStatus()
        book.toggleStatus(false)
        expect(sheet.getValue(0, 0)).toEqual({type: 'str', value: 'committed'})
    })
})
