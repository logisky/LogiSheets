/**
 * An analysis block through the real wasm: a totals row that is an ordinary
 * block declaring which block it analyses. See design/block-analysis.md.
 *
 * The computation is covered exhaustively in the engine
 * (crates/controller/src/api/test.rs). What only this level can check is that
 * the two declarations — `analyzes` on the block, `aggFunc`/`aggField` on the
 * field — survive the wasm boundary and a real .xlsx round trip, since a
 * declaration a host cannot send or read back is no declaration at all. The
 * formula itself is never sent: the engine generates it, and these tests are
 * how we know that generation is reachable from a host.
 */
import {describe, it, expect, beforeEach} from 'vitest'
import {handle} from '../wasm/logisheets_wasm_server'

function rpc(
    method: string,
    params?: Record<string, unknown>,
    bookId?: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
    const msg = params === undefined ? method : {method, value: params}
    return handle(msg, bookId ?? null)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function commit(bookId: number, payloads: any[]) {
    return rpc(
        'handleTransaction',
        {transaction: {payloads, undoable: true, temp: false}},
        bookId
    )
}

interface FieldEntry {
    field: string
    idx: number
    aggFunc?: string
    aggField?: string
}

interface Block {
    blockId: number
    rowStart: number
    rowCnt: number
    analyzes?: number
    analyzedBy: number[]
    schema?: {name: string; fields: FieldEntry[]}
}

function blocks(bookId: number): Block[] {
    return rpc('getAllBlocks', {}, bookId) as Block[]
}

function byName(bookId: number, name: string): Block {
    const b = blocks(bookId).find((x) => x.schema?.name === name)
    expect(b, `a block named ${name}`).toBeDefined()
    return b!
}

/** The number in a sheet cell, or undefined when it holds anything else. */
function num(bookId: number, row: number, col: number): number | undefined {
    const v = rpc('getValue', {sheetIdx: 0, row, col}, bookId) as
        | {type: string; value: number}
        | string
    return typeof v === 'object' && v.type === 'number' ? v.value : undefined
}

/**
 * `orders` — three records with a key and a DECLARED number — and, below it,
 * `orders_analysis`: one row, `analyzes` set, its `amt` field declaring a SUM
 * over the source's `amt`. No formula anywhere. Exactly the payload sequence
 * `build__create_analysis_block` sends.
 */
function ordersWithAnalysis(bookId: number): {src: number; analysis: number} {
    const src = rpc('getAvailableBlockId', {sheetIdx: 0}, bookId) as number
    const eff = commit(bookId, [
        {
            type: 'createBlock',
            value: {
                sheetIdx: 0,
                id: src,
                masterRow: 0,
                masterCol: 0,
                rowCnt: 3,
                colCnt: 2,
            },
        },
        {
            type: 'bindFormSchema',
            value: {
                refName: 'orders',
                sheetIdx: 0,
                blockId: src,
                fieldFrom: 0,
                keyIdx: 0,
                row: true,
                fields: [
                    {name: 'key', renderId: 's0'},
                    {name: 'amt', renderId: 's1', fieldType: {kind: 'number'}},
                ],
            },
        },
        ...[
            [0, 'k0', 10],
            [1, 'k1', 20],
            [2, 'k2', 30],
        ].flatMap(([row, key, amt]) => [
            {
                type: 'blockInput',
                value: {sheetIdx: 0, blockId: src, row, col: 0, input: key},
            },
            {
                type: 'blockInput',
                value: {
                    sheetIdx: 0,
                    blockId: src,
                    row,
                    col: 1,
                    input: String(amt),
                },
            },
        ]),
    ])
    expect(eff.status.type, eff.errorMessage).toBe('ok')

    const analysis = rpc('getAvailableBlockId', {sheetIdx: 0}, bookId) as number
    const eff2 = commit(bookId, [
        // Room first, as the tool does — this is also what pushes anything
        // below the table out of the way.
        {type: 'insertRows', value: {sheetIdx: 0, start: 3, count: 1}},
        {
            type: 'createBlock',
            value: {
                sheetIdx: 0,
                id: analysis,
                masterRow: 3,
                masterCol: 0,
                rowCnt: 1,
                colCnt: 2,
                analyzes: src,
            },
        },
        {
            type: 'bindFormSchema',
            value: {
                refName: 'orders_analysis',
                sheetIdx: 0,
                blockId: analysis,
                fieldFrom: 0,
                keyIdx: 0,
                row: true,
                fields: [
                    {name: 'key', renderId: 'a0'},
                    // A declaration, not a formula.
                    {
                        name: 'amt',
                        renderId: 'a1',
                        aggFunc: 'SUM',
                        aggField: 'amt',
                    },
                ],
            },
        },
        {
            type: 'blockInput',
            value: {
                sheetIdx: 0,
                blockId: analysis,
                row: 0,
                col: 0,
                input: 'TOTAL',
            },
        },
    ])
    expect(eff2.status.type, eff2.errorMessage).toBe('ok')
    return {src, analysis}
}

describe('an analysis block, driven the way a host drives it', () => {
    let bookId: number
    let src: number
    let analysis: number

    beforeEach(() => {
        bookId = rpc('newWorkbook') as number
        ;({src, analysis} = ordersWithAnalysis(bookId))
    })

    it('totals the source from the declaration alone', () => {
        // No host sent a formula. If this reads 60, the engine generated one
        // from `analyzes` + `aggFunc`, and a host can reach that generation.
        expect(num(bookId, 3, 1)).toBe(60)
    })

    it('follows an edit to a record', () => {
        const eff = commit(bookId, [
            {
                type: 'blockInput',
                value: {sheetIdx: 0, blockId: src, row: 1, col: 1, input: '99'},
            },
        ])
        expect(eff.status.type, eff.errorMessage).toBe('ok')
        expect(num(bookId, 3, 1)).toBe(139)
    })

    it('follows the source GROWING, without anything being rewritten', () => {
        // The reason the generated formula goes through BLOCKREFS rather than
        // a resolved range: a range would have to be rewritten per insert.
        const eff = commit(bookId, [
            {type: 'insertRows', value: {sheetIdx: 0, start: 3, count: 1}},
            {
                type: 'insertRowsInBlock',
                value: {sheetIdx: 0, blockId: src, start: 3, cnt: 1},
            },
            {
                type: 'blockInput',
                value: {sheetIdx: 0, blockId: src, row: 3, col: 0, input: 'k3'},
            },
            {
                type: 'blockInput',
                value: {sheetIdx: 0, blockId: src, row: 3, col: 1, input: '1'},
            },
        ])
        expect(eff.status.type, eff.errorMessage).toBe('ok')

        // The analysis block was pushed down a row by the sheet insert, and
        // the total counts the new record.
        expect(byName(bookId, 'orders_analysis').rowStart).toBe(4)
        expect(num(bookId, 4, 1)).toBe(61) // 10 + 20 + 30 + 1
    })

    it('is addressable by key from anywhere, which is the point of it being a block', () => {
        // A total you can only look at is much less useful than one you can
        // reference. An in-block summary row would have no key to reach.
        const eff = commit(bookId, [
            {
                type: 'cellInput',
                value: {
                    sheetIdx: 0,
                    row: 10,
                    col: 5,
                    content: '=BLOCKREF("orders_analysis","TOTAL","amt")*2',
                },
            },
        ])
        expect(eff.status.type, eff.errorMessage).toBe('ok')
        expect(num(bookId, 10, 5)).toBe(120)
    })

    it('does not count itself', () => {
        // The whole cycle question. `BlockAll(source)` and
        // `BlockAll(analysis)` are two independent barriers, which is only
        // true because the analysis lives in its own block.
        expect(num(bookId, 3, 1)).toBe(60)
        expect(num(bookId, 3, 1)).not.toBe(120)
    })

    it('reports the relation from both ends', () => {
        // What an agent reads. Without this it sees two unrelated tables and
        // may well sum both, counting the same numbers twice.
        const table = byName(bookId, 'orders')
        expect(table.analyzes).toBeUndefined()
        expect(table.analyzedBy).toEqual([analysis])

        const a = byName(bookId, 'orders_analysis')
        expect(a.analyzes).toBe(src)
        expect(a.analyzedBy).toEqual([])

        // And per field, WHAT the number is.
        const amt = a.schema!.fields.find((f) => f.field === 'amt')!
        expect(amt.aggFunc).toBe('SUM')
        expect(amt.aggField).toBe('amt')
        const key = a.schema!.fields.find((f) => f.field === 'key')!
        expect(key.aggFunc).toBeUndefined()
    })

    it('goes when its source goes, and comes back with it', () => {
        // An analysis of a block that no longer exists would sit there reading
        // empty with nothing to say why.
        const eff = commit(bookId, [
            {type: 'removeBlock', value: {sheetIdx: 0, id: src}},
        ])
        expect(eff.status.type, eff.errorMessage).toBe('ok')
        expect(blocks(bookId).map((b) => b.blockId)).toEqual([])

        // One transaction, so one undo brings the pair back.
        expect(rpc('undo', undefined, bookId)).toBe(true)
        expect(
            blocks(bookId)
                .map((b) => b.blockId)
                .sort()
        ).toEqual([src, analysis].sort())
        expect(num(bookId, 3, 1)).toBe(60)
    })

    it('leaves the source alone when only the analysis is removed', () => {
        const eff = commit(bookId, [
            {type: 'removeBlock', value: {sheetIdx: 0, id: analysis}},
        ])
        expect(eff.status.type, eff.errorMessage).toBe('ok')
        const left = blocks(bookId)
        expect(left.map((b) => b.blockId)).toEqual([src])
        expect(left[0].analyzedBy).toEqual([])
    })

    it('survives a real .xlsx round trip', () => {
        // Both declarations are persisted attributes, and the total is
        // regenerated from them rather than restored as a saved string.
        const saved = rpc('saveWorkbook', {appData: '{}'}, bookId) as {
            code: number
            data: number[] | Uint8Array
        }
        expect(saved.code).toBe(0)
        const bytes = Array.isArray(saved.data)
            ? saved.data
            : Array.from(saved.data)

        const reopened = rpc('newWorkbook') as number
        rpc('loadWorkbook', {content: bytes, name: 'analysis.xlsx'}, reopened)

        const a = byName(reopened, 'orders_analysis')
        expect(a.analyzes).toBe(byName(reopened, 'orders').blockId)
        expect(byName(reopened, 'orders').analyzedBy).toEqual([a.blockId])
        const amt = a.schema!.fields.find((f) => f.field === 'amt')!
        expect(amt.aggFunc).toBe('SUM')
        expect(amt.aggField).toBe('amt')

        expect(num(reopened, 3, 1)).toBe(60)
    })

    it('rebuilds the total when the source field is renamed', () => {
        // The generated formula names the source FIELD as a string, and
        // nothing else re-materializes a block when a DIFFERENT block is
        // re-bound. Without the trigger the total would silently read 0: a
        // BLOCKREFS whose field matches nothing yields an empty matrix.
        const eff = commit(bookId, [
            {
                type: 'bindFormSchema',
                value: {
                    refName: 'orders_analysis',
                    sheetIdx: 0,
                    blockId: analysis,
                    fieldFrom: 0,
                    keyIdx: 0,
                    row: true,
                    fields: [
                        {name: 'key', renderId: 'a0'},
                        {
                            name: 'amount',
                            renderId: 'a1',
                            aggFunc: 'SUM',
                            aggField: 'amount',
                        },
                    ],
                },
            },
            {
                type: 'bindFormSchema',
                value: {
                    refName: 'orders',
                    sheetIdx: 0,
                    blockId: src,
                    fieldFrom: 0,
                    keyIdx: 0,
                    row: true,
                    fields: [
                        {name: 'key', renderId: 's0'},
                        {
                            name: 'amount',
                            renderId: 's1',
                            fieldType: {kind: 'number'},
                        },
                    ],
                },
            },
        ])
        expect(eff.status.type, eff.errorMessage).toBe('ok')
        expect(num(bookId, 3, 1)).toBe(60)
    })
})
