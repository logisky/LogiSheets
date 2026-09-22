import {describe, it, expect, beforeEach} from 'vitest'
import {handle} from '../wasm/logisheets_wasm_server'

// These assert the *content* of the messages, not just that something failed:
// the caller is often an agent that gets one shot at fixing it.

function rpc(
    method: string,
    params?: Record<string, unknown>,
    bookId?: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
    const msg = params === undefined ? method : {method, value: params}
    return handle(msg, bookId ?? null)
}

describe('error messages', () => {
    let bookId: number

    beforeEach(() => {
        bookId = rpc('newWorkbook') as number
    })

    it('names the payload that a long transaction was rejected at', () => {
        const payloads = [
            {
                type: 'cellInput',
                value: {sheetIdx: 0, row: 0, col: 0, content: 'ok'},
            },
            {
                type: 'sheetRename',
                value: {oldName: 'Sheet1', newName: 'Renamed'},
            },
            {type: 'createSheet', value: {idx: 1, newName: 'Renamed'}},
            {
                type: 'cellInput',
                value: {sheetIdx: 0, row: 1, col: 0, content: 'never runs'},
            },
        ]
        const effect = rpc(
            'handleTransaction',
            {transaction: {payloads, undoable: true, temp: false}},
            bookId
        )

        expect(effect.status.type).toBe('err')
        // Position in the list as sent, reason, and the payload as it arrived.
        expect(effect.errorMessage).toContain('payloads[2] of 4')
        expect(effect.errorMessage).toContain('already exists')
        expect(effect.errorMessage).toContain('"type":"createSheet"')
    })

    it('reports a sheet index that is out of range', () => {
        const err = rpc('getComments', {sheetIdx: 9}, bookId)
        expect(err.msg).toContain('sheet index 9')
        expect(err.msg).toContain('out of range')
    })

    it('reports a book id that names no open workbook', () => {
        const err = rpc('getSheetCount', undefined, 4242)
        expect(err.msg).toContain('book id 4242')
    })

    it('reports why a file could not be read, and survives it', () => {
        const err = rpc(
            'loadWorkbook',
            {content: [1, 2, 3, 4], name: 'broken.xlsx'},
            bookId
        )
        expect(err.msg).toContain('.xlsx archive')
        // A bad request must not poison the instance for every later call.
        expect(rpc('getSheetCount', undefined, bookId)).toBe(1)
    })

    it('names the method of a request it cannot read', () => {
        const err = rpc('noSuchMethod', {}, bookId)
        expect(err.msg).toContain('"noSuchMethod"')
    })

    it('says a book id is required when none is given', () => {
        const err = rpc('getSheetCount')
        expect(err.msg).toContain('book id')
    })

    // An id is several layers from the coordinate it came from by the time it
    // fails to resolve, and N in "no row exists at row index N" is often not a
    // number the caller passed. Each layer that still knows says so.
    describe('a failed lookup says where it came from', () => {
        beforeEach(() => {
            rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [
                            {
                                type: 'sheetRename',
                                value: {oldName: 'Sheet1', newName: 'Sales'},
                            },
                        ],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )
        })

        it('names the request, the sheet and the cell on a read', () => {
            const err = rpc(
                'getValue',
                {sheetIdx: 0, row: 5_000_000, col: 3},
                bookId
            )
            expect(err.msg).toContain('reading the value of D5000001')
            expect(err.msg).toContain('sheet "Sales" (sheet index 0)')
            expect(err.msg).toContain('row index 5000000, column index 3')
            expect(err.msg).toContain('no row exists at row index 5000000')
        })

        it('keeps the requested cell when the engine trips on another index', () => {
            // This clamps to the sheet's last row, so it fails on an index the
            // caller never passed — unframed, the message is about 1048576.
            // Kept just past the maximum: the engine walks to the clamp, and a
            // far-off row turns a fast check into a multi-second one.
            const err = rpc(
                'getCellPosition',
                {sheetIdx: 0, row: 1_100_000, col: 0},
                bookId
            )
            expect(err.msg).toContain('reading the position of A1100001')
            expect(err.msg).toContain('sheet "Sales"')
            // Resolving a position past the last row walks to the clamp, which
            // takes seconds. This asserts the message, not the speed.
        }, 30_000)

        it('names the payload and the cell inside it on a write', () => {
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
                                    content: 'ok',
                                },
                            },
                            {
                                type: 'mergeCells',
                                value: {
                                    sheetIdx: 0,
                                    startRow: 3_000_000,
                                    startCol: 0,
                                    endRow: 3_000_001,
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
            expect(effect.status.type).toBe('err')
            expect(effect.errorMessage).toContain('payloads[1] of 2')
            expect(effect.errorMessage).toContain('converting cell A3000001')
            expect(effect.errorMessage).toContain(
                'no row exists at row index 3000000'
            )
        })
    })

    // These lookups used to be unwrapped, so a bad payload panicked and left
    // the wasm instance trapping on every later call.
    describe('a rejected payload leaves the engine usable', () => {
        const cases: ReadonlyArray<[string, Record<string, unknown>, string]> =
            [
                [
                    'resizeBlock',
                    {sheetIdx: 0, id: 99, newRowCnt: 5, newColCnt: 5},
                    'block id 99',
                ],
                [
                    'moveBlock',
                    {sheetIdx: 0, id: 99, newMasterRow: 1, newMasterCol: 1},
                    'block id 99',
                ],
                [
                    'deleteRows',
                    {sheetIdx: 0, start: 1_048_570, count: 20},
                    'run past the end of the sheet',
                ],
                [
                    'createAppendix',
                    {
                        blockId: 1,
                        rowIdx: 0,
                        colIdx: 0,
                        craftId: 'x',
                        tag: 1,
                        content: 'y',
                    },
                    'missing a sheetId or a sheetIdx',
                ],
                [
                    'upsertFieldFormulas',
                    {
                        sheetIdx: 0,
                        blockId: 7,
                        fieldFormulas: ['=1'],
                        validationFormulas: [],
                        editabilityFormulas: [],
                    },
                    'block id 7',
                ],
            ]

        it.each(cases)('%s', (type, value, expected) => {
            const effect = rpc(
                'handleTransaction',
                {
                    transaction: {
                        payloads: [{type, value}],
                        undoable: true,
                        temp: false,
                    },
                },
                bookId
            )
            expect(effect.status.type).toBe('err')
            expect(effect.errorMessage).toContain(expected)
            expect(rpc('getSheetCount', undefined, bookId)).toBe(1)
        })
    })
})
