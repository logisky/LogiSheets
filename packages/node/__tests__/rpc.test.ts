import {describe, it, expect, beforeEach} from 'vitest'
import {handle} from '../wasm/logisheets_wasm_server'

// Helper matching the one in src/api/workbook.ts
function rpc(
    method: string,
    params?: Record<string, unknown>,
    bookId?: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
    const msg = params === undefined ? method : {method, value: params}
    return handle(msg, bookId ?? null)
}

function isErrorMessage(v: unknown): boolean {
    return typeof v === 'object' && v !== null && 'msg' in v && 'ty' in v
}

describe('RPC', () => {
    let bookId: number

    beforeEach(() => {
        bookId = rpc('newWorkbook') as number
    })

    describe('workbook lifecycle', () => {
        it('should create a new workbook and return a numeric id', () => {
            expect(typeof bookId).toBe('number')
        })

        it('should release a workbook without error', () => {
            expect(() => rpc('release', undefined, bookId)).not.toThrow()
        })
    })

    describe('sheet info', () => {
        it('should return sheet count of 1 for a default workbook', () => {
            const count = rpc('getSheetCount', undefined, bookId) as number
            expect(count).toBe(1)
        })

        it('should return all sheet info with one sheet', () => {
            const infos = rpc('getAllSheetInfo', undefined, bookId) as Array<{
                name: string
                id: number
                hidden: boolean
                tabColor: string
            }>
            expect(infos).toHaveLength(1)
            expect(infos[0].name).toBe('Sheet1')
            expect(infos[0].hidden).toBe(false)
        })

        it('should get sheet name by index', () => {
            const name = rpc('getSheetNameByIdx', {idx: 0}, bookId)
            expect(name).toBe('Sheet1')
        })

        it('should get sheet id by index', () => {
            const sheetId = rpc('getSheetId', {sheetIdx: 0}, bookId)
            expect(typeof sheetId).toBe('number')
        })

        it('should get sheet index by id', () => {
            const sheetId = rpc('getSheetId', {sheetIdx: 0}, bookId) as number
            const sheetIdx = rpc('getSheetIdx', {sheetId}, bookId)
            expect(sheetIdx).toBe(0)
        })

        it('should get sheet dimension', () => {
            const sheetId = rpc('getSheetId', {sheetIdx: 0}, bookId) as number
            const dim = rpc('getSheetDimension', {sheetId}, bookId) as {
                maxRow: number
                maxCol: number
                height: number
                width: number
            }
            expect(typeof dim.maxRow).toBe('number')
            expect(typeof dim.maxCol).toBe('number')
            expect(typeof dim.height).toBe('number')
            expect(typeof dim.width).toBe('number')
        })
    })

    describe('cell operations', () => {
        it('should get cell info for an empty cell', () => {
            const cell = rpc('getCell', {sheetIdx: 0, row: 0, col: 0}, bookId)
            expect(cell).toBeDefined()
            expect(cell.value).toBe('empty')
            expect(cell.formula).toBe('')
        })

        it('should get value for an empty cell', () => {
            const value = rpc('getValue', {sheetIdx: 0, row: 0, col: 0}, bookId)
            expect(value).toBe('empty')
        })

        it('should get formula for an empty cell', () => {
            const formula = rpc(
                'getFormula',
                {sheetIdx: 0, row: 0, col: 0},
                bookId
            )
            expect(formula).toBe('')
        })

        it('should get style for a cell', () => {
            const style = rpc('getStyle', {sheetIdx: 0, row: 0, col: 0}, bookId)
            expect(style).toBeDefined()
        })

        it('should get cell position', () => {
            const pos = rpc(
                'getCellPosition',
                {sheetIdx: 0, row: 0, col: 0},
                bookId
            ) as {x: number; y: number}
            expect(typeof pos.x).toBe('number')
            expect(typeof pos.y).toBe('number')
            expect(pos.x).toBe(0)
            expect(pos.y).toBe(0)
        })

        it('should get cell id', () => {
            const cellId = rpc(
                'getCellId',
                {sheetIdx: 0, rowIdx: 0, colIdx: 0},
                bookId
            )
            expect(cellId).toBeDefined()
            expect(typeof cellId.sheetId).toBe('number')
            expect(cellId.cellId).toBeDefined()
            expect(cellId.cellId.type).toBe('normalCell')
        })

        it('should get multiple cell infos', () => {
            const cells = rpc(
                'getCellInfos',
                {sheetIdx: 0, startRow: 0, startCol: 0, endRow: 2, endCol: 2},
                bookId
            ) as Array<unknown>
            expect(Array.isArray(cells)).toBe(true)
        })
    })

    describe('transactions - cell input', () => {
        it('should input a string value into a cell', () => {
            const effect = rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'cellInput',
                                value: {
                                    sheetIdx: 0,
                                    row: 0,
                                    col: 0,
                                    content: 'Hello',
                                },
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )
            expect(effect.status.type).toBe('ok')

            const value = rpc('getValue', {sheetIdx: 0, row: 0, col: 0}, bookId)
            expect(value).toEqual({type: 'str', value: 'Hello'})
        })

        it('should input a numeric value into a cell', () => {
            rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'cellInput',
                                value: {
                                    sheetIdx: 0,
                                    row: 1,
                                    col: 1,
                                    content: '42',
                                },
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )

            const value = rpc('getValue', {sheetIdx: 0, row: 1, col: 1}, bookId)
            expect(value).toEqual({type: 'number', value: 42})
        })

        it('should input a formula', () => {
            // First set a value
            rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'cellInput',
                                value: {
                                    sheetIdx: 0,
                                    row: 0,
                                    col: 0,
                                    content: '10',
                                },
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )

            // Set a formula that references the value
            rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'cellInput',
                                value: {
                                    sheetIdx: 0,
                                    row: 0,
                                    col: 1,
                                    content: '=A1*2',
                                },
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )

            const value = rpc('getValue', {sheetIdx: 0, row: 0, col: 1}, bookId)
            expect(value).toEqual({type: 'number', value: 20})
        })

        it('should handle multiple payloads in one transaction', () => {
            const effect = rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'cellInput',
                                value: {
                                    sheetIdx: 0,
                                    row: 0,
                                    col: 0,
                                    content: '1',
                                },
                            },
                            {
                                type: 'cellInput',
                                value: {
                                    sheetIdx: 0,
                                    row: 0,
                                    col: 1,
                                    content: '2',
                                },
                            },
                            {
                                type: 'cellInput',
                                value: {
                                    sheetIdx: 0,
                                    row: 0,
                                    col: 2,
                                    content: '=A1+B1',
                                },
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )
            expect(effect.status.type).toBe('ok')

            const v0 = rpc('getValue', {sheetIdx: 0, row: 0, col: 0}, bookId)
            const v1 = rpc('getValue', {sheetIdx: 0, row: 0, col: 1}, bookId)
            const v2 = rpc('getValue', {sheetIdx: 0, row: 0, col: 2}, bookId)
            expect(v0).toEqual({type: 'number', value: 1})
            expect(v1).toEqual({type: 'number', value: 2})
            expect(v2).toEqual({type: 'number', value: 3})
        })
    })

    describe('undo and redo', () => {
        it('should undo a cell input', () => {
            rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'cellInput',
                                value: {
                                    sheetIdx: 0,
                                    row: 0,
                                    col: 0,
                                    content: 'test',
                                },
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )

            const before = rpc(
                'getValue',
                {sheetIdx: 0, row: 0, col: 0},
                bookId
            )
            expect(before).toEqual({type: 'str', value: 'test'})

            const undone = rpc('undo', undefined, bookId) as boolean
            expect(undone).toBe(true)

            const after = rpc('getValue', {sheetIdx: 0, row: 0, col: 0}, bookId)
            expect(after).toBe('empty')
        })

        it('should redo after undo', () => {
            rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'cellInput',
                                value: {
                                    sheetIdx: 0,
                                    row: 0,
                                    col: 0,
                                    content: 'hello',
                                },
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )

            rpc('undo', undefined, bookId)
            const afterUndo = rpc(
                'getValue',
                {sheetIdx: 0, row: 0, col: 0},
                bookId
            )
            expect(afterUndo).toBe('empty')

            const redone = rpc('redo', undefined, bookId) as boolean
            expect(redone).toBe(true)

            const afterRedo = rpc(
                'getValue',
                {sheetIdx: 0, row: 0, col: 0},
                bookId
            )
            expect(afterRedo).toEqual({type: 'str', value: 'hello'})
        })

        it('should return false when nothing to undo', () => {
            const result = rpc('undo', undefined, bookId) as boolean
            expect(result).toBe(false)
        })

        it('should return false when nothing to redo', () => {
            const result = rpc('redo', undefined, bookId) as boolean
            expect(result).toBe(false)
        })
    })

    describe('row and column operations', () => {
        it('should get row height', () => {
            const sheetId = rpc('getSheetId', {sheetIdx: 0}, bookId) as number
            const height = rpc('getRowHeight', {sheetId, rowIdx: 0}, bookId)
            expect(typeof height).toBe('number')
            expect(height).toBeGreaterThan(0)
        })

        it('should get col width', () => {
            const sheetId = rpc('getSheetId', {sheetIdx: 0}, bookId) as number
            const width = rpc('getColWidth', {sheetId, colIdx: 0}, bookId)
            expect(typeof width).toBe('number')
            expect(width).toBeGreaterThan(0)
        })

        it('should get row info', () => {
            const info = rpc(
                'getRowInfo',
                {sheetIdx: 0, rowIdx: 0},
                bookId
            ) as {idx: number; height: number; hidden: boolean}
            expect(info.idx).toBe(0)
            expect(typeof info.height).toBe('number')
            expect(info.hidden).toBe(false)
        })

        it('should insert rows via transaction', () => {
            rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'cellInput',
                                value: {
                                    sheetIdx: 0,
                                    row: 0,
                                    col: 0,
                                    content: 'A',
                                },
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )

            rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'insertRows',
                                value: {sheetIdx: 0, start: 0, count: 1},
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )

            // The value should have shifted down
            const v0 = rpc('getValue', {sheetIdx: 0, row: 0, col: 0}, bookId)
            expect(v0).toBe('empty')

            const v1 = rpc('getValue', {sheetIdx: 0, row: 1, col: 0}, bookId)
            expect(v1).toEqual({type: 'str', value: 'A'})
        })

        it('should insert cols via transaction', () => {
            rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'cellInput',
                                value: {
                                    sheetIdx: 0,
                                    row: 0,
                                    col: 0,
                                    content: 'X',
                                },
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )

            rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'insertCols',
                                value: {sheetIdx: 0, start: 0, count: 1},
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )

            const v0 = rpc('getValue', {sheetIdx: 0, row: 0, col: 0}, bookId)
            expect(v0).toBe('empty')

            const v1 = rpc('getValue', {sheetIdx: 0, row: 0, col: 1}, bookId)
            expect(v1).toEqual({type: 'str', value: 'X'})
        })
    })

    describe('sheet management', () => {
        it('should create a new sheet', () => {
            rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'createSheet',
                                value: {idx: 1, newName: 'Sheet2'},
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )

            const count = rpc('getSheetCount', undefined, bookId) as number
            expect(count).toBe(2)

            const name = rpc('getSheetNameByIdx', {idx: 1}, bookId)
            expect(name).toBe('Sheet2')
        })

        it('should rename a sheet', () => {
            rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'sheetRename',
                                value: {
                                    oldName: 'Sheet1',
                                    newName: 'Renamed',
                                },
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )

            const name = rpc('getSheetNameByIdx', {idx: 0}, bookId)
            expect(name).toBe('Renamed')
        })

        it('should delete a sheet', () => {
            // Create a second sheet first
            rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'createSheet',
                                value: {idx: 1, newName: 'ToDelete'},
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )
            expect(rpc('getSheetCount', undefined, bookId)).toBe(2)

            rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'deleteSheet',
                                value: {idx: 1},
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )
            expect(rpc('getSheetCount', undefined, bookId)).toBe(1)
        })
    })

    describe('formula operations', () => {
        it('should check valid formula', () => {
            const result = rpc(
                'checkFormula',
                {formula: '=1+1'},
                bookId
            ) as boolean
            expect(result).toBe(true)
        })

        it('should get display units of formula', () => {
            const result = rpc(
                'getDisplayUnitsOfFormula',
                {formula: 'A1+B1'},
                bookId
            )
            expect(result).toBeDefined()
            expect(isErrorMessage(result)).toBe(false)
        })
    })

    describe('merged cells', () => {
        it('should merge and query merged cells', () => {
            rpc(
                'handleTransaction',
                {
                    transaction: {
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
                    },
                },
                bookId
            )

            const merged = rpc(
                'getMergedCells',
                {sheetIdx: 0, startRow: 0, startCol: 0, endRow: 5, endCol: 5},
                bookId
            ) as Array<unknown>
            expect(merged.length).toBeGreaterThan(0)
        })

        it('should split merged cells', () => {
            rpc(
                'handleTransaction',
                {
                    transaction: {
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
                    },
                },
                bookId
            )

            rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'splitMergedCells',
                                value: {sheetIdx: 0, row: 0, col: 0},
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )

            const merged = rpc(
                'getMergedCells',
                {sheetIdx: 0, startRow: 0, startCol: 0, endRow: 5, endCol: 5},
                bookId
            ) as Array<unknown>
            expect(merged.length).toBe(0)
        })
    })

    describe('cell clear', () => {
        it('should clear a cell value', () => {
            rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'cellInput',
                                value: {
                                    sheetIdx: 0,
                                    row: 0,
                                    col: 0,
                                    content: 'data',
                                },
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )

            rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'cellClear',
                                value: {sheetIdx: 0, row: 0, col: 0},
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )

            const value = rpc('getValue', {sheetIdx: 0, row: 0, col: 0}, bookId)
            expect(value).toBe('empty')
        })
    })

    describe('display window', () => {
        it('should get display window', () => {
            const window = rpc(
                'getDisplayWindow',
                {sheetIdx: 0, startRow: 0, endRow: 10, startCol: 0, endCol: 5},
                bookId
            )
            expect(window).toBeDefined()
            expect(isErrorMessage(window)).toBe(false)
        })
    })

    describe('batch operations', () => {
        it('should batch get cell info by id', () => {
            const cellId = rpc(
                'getCellId',
                {sheetIdx: 0, rowIdx: 0, colIdx: 0},
                bookId
            )
            expect(isErrorMessage(cellId)).toBe(false)

            const infos = rpc('batchGetCellInfoById', {ids: [cellId]}, bookId)
            expect(isErrorMessage(infos)).toBe(false)
            expect(Array.isArray(infos)).toBe(true)
            expect(infos).toHaveLength(1)
        })

        it('should batch get cell coordinate with sheet by id', () => {
            const cellId = rpc(
                'getCellId',
                {sheetIdx: 0, rowIdx: 3, colIdx: 5},
                bookId
            )
            expect(isErrorMessage(cellId)).toBe(false)

            const coords = rpc(
                'batchGetCellCoordinateWithSheetById',
                {ids: [cellId]},
                bookId
            )
            expect(isErrorMessage(coords)).toBe(false)
            expect(Array.isArray(coords)).toBe(true)
            expect(coords).toHaveLength(1)
        })
    })

    describe('set row height and col width', () => {
        it('should set row height via transaction', () => {
            const sheetId = rpc('getSheetId', {sheetIdx: 0}, bookId) as number

            rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'setRowHeight',
                                value: {sheetIdx: 0, row: 0, height: 50},
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )

            const height = rpc('getRowHeight', {sheetId, rowIdx: 0}, bookId)
            expect(height).toBe(50)
        })

        it('should set col width via transaction', () => {
            const sheetId = rpc('getSheetId', {sheetIdx: 0}, bookId) as number

            rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'setColWidth',
                                value: {sheetIdx: 0, col: 0, width: 200},
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )

            const width = rpc('getColWidth', {sheetId, colIdx: 0}, bookId)
            expect(width).toBe(200)
        })
    })

    describe('next visible cell', () => {
        it('should get next visible cell in each direction', () => {
            const directions = ['up', 'down', 'left', 'right'] as const
            for (const direction of directions) {
                const result = rpc(
                    'getNextVisibleCell',
                    {sheetIdx: 0, rowIdx: 5, colIdx: 5, direction},
                    bookId
                )
                expect(result).toBeDefined()
                expect(typeof result.x).toBe('number')
                expect(typeof result.y).toBe('number')
            }
        })
    })

    describe('reproducible cell', () => {
        it('should get reproducible cell', () => {
            // Set a value first
            rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'cellInput',
                                value: {
                                    sheetIdx: 0,
                                    row: 0,
                                    col: 0,
                                    content: 'abc',
                                },
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )

            const cell = rpc(
                'getReproducibleCell',
                {sheetIdx: 0, row: 0, col: 0},
                bookId
            )
            expect(cell).toBeDefined()
            expect(isErrorMessage(cell)).toBe(false)
        })

        it('should get reproducible cells', () => {
            rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'cellInput',
                                value: {
                                    sheetIdx: 0,
                                    row: 0,
                                    col: 0,
                                    content: '1',
                                },
                            },
                            {
                                type: 'cellInput',
                                value: {
                                    sheetIdx: 0,
                                    row: 0,
                                    col: 1,
                                    content: '2',
                                },
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )

            const cells = rpc(
                'getReproducibleCells',
                {
                    sheetIdx: 0,
                    coordinates: [
                        {row: 0, col: 0},
                        {row: 0, col: 1},
                    ],
                },
                bookId
            )
            expect(isErrorMessage(cells)).toBe(false)
            expect(Array.isArray(cells)).toBe(true)
            expect(cells).toHaveLength(2)
        })
    })

    describe('temp status', () => {
        it('should toggle and clean temp status', () => {
            expect(() =>
                rpc('toggleStatus', {useTemp: true}, bookId)
            ).not.toThrow()
            expect(() =>
                rpc('cleanTempStatus', undefined, bookId)
            ).not.toThrow()
        })

        it('should commit temp status', () => {
            rpc('toggleStatus', {useTemp: true}, bookId)
            rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'cellInput',
                                value: {
                                    sheetIdx: 0,
                                    row: 0,
                                    col: 0,
                                    content: 'temp',
                                },
                            },
                        ],
                        undoable: true,
                        temp: true,
                    },
                },
                bookId
            )
            expect(() =>
                rpc('commitTempStatus', undefined, bookId)
            ).not.toThrow()
        })
    })

    describe('app data', () => {
        it('should get app data', () => {
            const data = rpc('getAppData', undefined, bookId) as Array<unknown>
            expect(Array.isArray(data)).toBe(true)
        })
    })

    describe('block operations', () => {
        it('should create a block and query it', () => {
            const effect = rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'createBlock',
                                value: {
                                    sheetIdx: 0,
                                    id: 1,
                                    masterRow: 0,
                                    masterCol: 0,
                                    rowCnt: 3,
                                    colCnt: 3,
                                },
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )
            expect(effect.status.type).toBe('ok')

            const sheetId = rpc('getSheetId', {sheetIdx: 0}, bookId) as number
            const blockInfo = rpc('getBlockInfo', {sheetId, blockId: 1}, bookId)
            expect(blockInfo).toBeDefined()
            expect(isErrorMessage(blockInfo)).toBe(false)
        })

        it('should get available block id', () => {
            const id = rpc('getAvailableBlockId', {sheetIdx: 0}, bookId)
            expect(typeof id).toBe('number')
        })

        it('should get all block fields', () => {
            const fields = rpc('getAllBlockFields', undefined, bookId)
            expect(isErrorMessage(fields)).toBe(false)
            expect(Array.isArray(fields)).toBe(true)
        })

        it('should get block display window after creation', () => {
            rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'createBlock',
                                value: {
                                    sheetIdx: 0,
                                    id: 2,
                                    masterRow: 5,
                                    masterCol: 5,
                                    rowCnt: 2,
                                    colCnt: 2,
                                },
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )

            const sheetId = rpc('getSheetId', {sheetIdx: 0}, bookId) as number
            const window = rpc(
                'getBlockDisplayWindow',
                {sheetId, blockId: 2},
                bookId
            )
            expect(window).toBeDefined()
            expect(isErrorMessage(window)).toBe(false)
        })

        it('should remove a block', () => {
            rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'createBlock',
                                value: {
                                    sheetIdx: 0,
                                    id: 3,
                                    masterRow: 10,
                                    masterCol: 10,
                                    rowCnt: 2,
                                    colCnt: 2,
                                },
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )

            const effect = rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'removeBlock',
                                value: {sheetIdx: 0, id: 3},
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )
            expect(effect.status.type).toBe('ok')
        })
    })
})
