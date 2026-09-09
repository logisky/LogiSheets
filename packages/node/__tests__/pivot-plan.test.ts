/**
 * A pivot through the real wasm: the recipe crosses the boundary, the cells
 * compute from it, and `pivotPlan` says whether the shape is still right.
 * See design/block-pivot.md.
 *
 * The computation is covered exhaustively in the engine
 * (crates/controller/src/api/test.rs). What only this level can check is that
 * a HOST can declare a pivot and read its staleness back — which is the whole
 * point of the plan, since a stale pivot's numbers are each correct while a
 * whole group is missing, and nothing else in the sheet shows that.
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

/** The number in a sheet cell, or undefined when it holds anything else. */
function num(bookId: number, row: number, col: number): number | undefined {
    const v = rpc('getValue', {sheetIdx: 0, row, col}, bookId) as
        | {type: string; value: number}
        | string
    return typeof v === 'object' && v.type === 'number' ? v.value : undefined
}

interface Plan {
    keys: string[]
    fields: string[]
    currentKeys: string[]
    currentFields: string[]
    missingKeys: string[]
    missingFields: string[]
    extraKeys: string[]
    extraFields: string[]
    unassignedRecords: number
    isStale: boolean
}

function plan(bookId: number, blockId: number): Plan {
    const p = rpc('pivotPlan', {sheetIdx: 0, blockId}, bookId)
    expect(p, `pivotPlan(${blockId})`).not.toHaveProperty('msg')
    return p as Plan
}

const SALES: ReadonlyArray<readonly [string, string, string, string]> = [
    ['o0', 'East', 'Q1', '10'],
    ['o1', 'East', 'Q2', '20'],
    ['o2', 'South', 'Q1', '3'],
    ['o3', 'South', 'Q1', '4'],
    ['o4', 'South', 'Q2', '5'],
    ['o5', 'North', 'Q1', '7'],
]

/**
 * A `sales` fact table plus a pivot of it: rows East/South/North, columns Q1/Q2.
 *
 * The pivot is built the way a refresh builds one — grow, **write the keys**,
 * bind — because `#KEY` is captured when the bind materializes the row. Get
 * that order wrong and every cell filters on `""` and the grid reads 0.
 */
function salesWithPivot(bookId: number): {src: number; pivot: number} {
    const src = rpc('getAvailableBlockId', {sheetIdx: 0}, bookId) as number
    const eff = commit(bookId, [
        {
            type: 'createBlock',
            value: {
                sheetIdx: 0,
                id: src,
                masterRow: 0,
                masterCol: 0,
                rowCnt: SALES.length,
                colCnt: 4,
            },
        },
        {
            type: 'bindFormSchema',
            value: {
                refName: 'sales',
                sheetIdx: 0,
                blockId: src,
                fieldFrom: 0,
                keyIdx: 0,
                row: true,
                fields: [
                    // A fact table's dimension columns repeat, so a dimension
                    // can never be the block's key — hence the id.
                    {name: 'id', renderId: 's0'},
                    {name: 'region', renderId: 's1'},
                    {name: 'quarter', renderId: 's2'},
                    {name: 'amt', renderId: 's3', fieldType: {kind: 'number'}},
                ],
            },
        },
        ...SALES.flatMap((row, r) =>
            row.map((v, c) => ({
                type: 'cellInput',
                value: {sheetIdx: 0, row: r, col: c, content: v},
            }))
        ),
    ])
    expect(eff.status.type, eff.errorMessage).toBe('ok')

    const pivot = rpc('getAvailableBlockId', {sheetIdx: 0}, bookId) as number
    const keys = ['East', 'South', 'North']
    const eff2 = commit(bookId, [
        {
            type: 'createBlock',
            value: {
                sheetIdx: 0,
                id: pivot,
                masterRow: 10,
                masterCol: 0,
                rowCnt: keys.length,
                colCnt: 3,
                analyzes: src,
                // The recipe, declared as the block is created.
                pivot: {
                    rowDim: 'region',
                    colDim: 'quarter',
                    measure: 'amt',
                    func: 'SUM',
                    order: 'ascending',
                },
            },
        },
        ...keys.map((k, i) => ({
            type: 'cellInput',
            value: {sheetIdx: 0, row: 10 + i, col: 0, content: k},
        })),
        {
            type: 'bindFormSchema',
            value: {
                refName: 'sales_pivot',
                sheetIdx: 0,
                blockId: pivot,
                fieldFrom: 0,
                keyIdx: 0,
                row: true,
                // Field names ARE the column dimension's values. Nothing
                // per-field is declared; the engine derives every cell.
                fields: [
                    {name: 'region', renderId: 'p0'},
                    {name: 'Q1', renderId: 'p1'},
                    {name: 'Q2', renderId: 'p2'},
                ],
            },
        },
    ])
    expect(eff2.status.type, eff2.errorMessage).toBe('ok')
    return {src, pivot}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addSale(bookId: number, src: number, at: number, row: string[]) {
    const eff = commit(bookId, [
        {
            type: 'insertRowsInBlock',
            value: {sheetIdx: 0, blockId: src, start: at, cnt: 1},
        },
        ...row.map((v, c) => ({
            type: 'cellInput',
            value: {sheetIdx: 0, row: at, col: c, content: v},
        })),
    ])
    expect(eff.status.type, eff.errorMessage).toBe('ok')
}

describe('a pivot, driven the way a host drives it', () => {
    let bookId: number
    let src: number
    let pivot: number

    beforeEach(() => {
        bookId = rpc('newWorkbook') as number
        ;({src, pivot} = salesWithPivot(bookId))
    })

    it('cross-tabulates from the recipe alone', () => {
        // No host sent a formula. Each cell was generated from
        // `region x quarter -> SUM(amt)` plus its own row key and field name.
        expect(num(bookId, 10, 1)).toBe(10) // East Q1
        expect(num(bookId, 10, 2)).toBe(20) // East Q2
        expect(num(bookId, 11, 1)).toBe(7) // South Q1 = 3 + 4
        expect(num(bookId, 12, 1)).toBe(7) // North Q1
        expect(num(bookId, 12, 2)).toBe(0) // North has no Q2
    })

    it('reports the recipe back, so a reader knows it is looking at a pivot', () => {
        const blocks = rpc('getAllBlocks', {}, bookId) as Array<{
            blockId: number
            pivot?: Record<string, unknown>
        }>
        const p = blocks.find((b) => b.blockId === pivot)!
        expect(p.pivot).toMatchObject({
            rowDim: 'region',
            colDim: 'quarter',
            measure: 'amt',
            func: 'SUM',
        })
        // The source is a table, not an analysis.
        expect(blocks.find((b) => b.blockId === src)!.pivot).toBeUndefined()
    })

    it('is not stale when it shows what the source justifies', () => {
        const p = plan(bookId, pivot)
        expect(p.isStale).toBe(false)
        expect(p.keys).toEqual(['East', 'North', 'South'])
        expect(p.fields).toEqual(['Q1', 'Q2'])
        expect(p.unassignedRecords).toBe(0)
    })

    it('names the group whose numbers are shown NOWHERE', () => {
        // The failure the whole reporting story exists for: every number in
        // the pivot stays correct and a whole region is simply absent.
        addSale(bookId, src, 6, ['o6', 'Northwest', 'Q1', '99'])

        const p = plan(bookId, pivot)
        expect(p.isStale).toBe(true)
        expect(p.missingKeys).toEqual(['Northwest'])
        // And the numbers on screen are each still right — which is exactly
        // why an agent cannot tell without asking.
        expect(num(bookId, 10, 1)).toBe(10)
    })

    it('names a new column value too', () => {
        addSale(bookId, src, 6, ['o6', 'East', 'Q3', '99'])
        const p = plan(bookId, pivot)
        expect(p.isStale).toBe(true)
        expect(p.missingFields).toEqual(['Q3'])
        expect(p.missingKeys).toEqual([])
    })

    it('counts records that belong to no group at all', () => {
        // A blank dimension is not a group, so those records are in no cell of
        // the pivot and its grand total is short by their measure.
        addSale(bookId, src, 6, ['o6', '', 'Q1', '99'])
        const p = plan(bookId, pivot)
        expect(p.unassignedRecords).toBe(1)
        expect(p.keys).not.toContain('')
    })

    it('does not call a mere reorder stale', () => {
        // Built East/South/North; the plan sorts to East/North/South. Every group
        // is present, so flagging it would train a reader to ignore the flag.
        const p = plan(bookId, pivot)
        expect(p.currentKeys).toEqual(['East', 'South', 'North'])
        expect(p.keys).not.toEqual(p.currentKeys)
        expect(p.isStale).toBe(false)
    })

    it('refuses to plan a block that is not a pivot', () => {
        const err = rpc('pivotPlan', {sheetIdx: 0, blockId: src}, bookId)
        expect(err.msg).toContain('is not a pivot')
    })

    it('survives a real .xlsx round trip, recipe and all', () => {
        const saved = rpc('saveWorkbook', {appData: '{}'}, bookId) as {
            code: number
            data: number[] | Uint8Array
        }
        expect(saved.code).toBe(0)
        const bytes = Array.isArray(saved.data)
            ? saved.data
            : Array.from(saved.data)

        const reopened = rpc('newWorkbook') as number
        rpc('loadWorkbook', {content: bytes, name: 'pivot.xlsx'}, reopened)

        const blocks = rpc('getAllBlocks', {}, reopened) as Array<{
            blockId: number
            pivot?: {rowDim: string; colDim?: string; func: string}
            schema?: {name: string}
        }>
        const p = blocks.find((b) => b.schema?.name === 'sales_pivot')!
        expect(p.pivot).toMatchObject({
            rowDim: 'region',
            colDim: 'quarter',
            func: 'SUM',
        })
        // Regenerated from the recipe, not restored as saved strings.
        expect(num(reopened, 11, 1)).toBe(7)
        // And the plan still works against the reopened file.
        expect(plan(reopened, p.blockId).isStale).toBe(false)
    })

    it('applies a refresh through existing payloads, as one undo', () => {
        // The §6 sequence, exactly as a host would send it: grow, write the
        // keys, bind. This is the shape `WorkbookOps.refreshPivot` will take.
        addSale(bookId, src, 6, ['o6', 'Northwest', 'Q1', '99'])
        const before = plan(bookId, pivot)
        expect(before.isStale).toBe(true)

        const eff = commit(bookId, [
            {
                type: 'resizeBlock',
                value: {
                    sheetIdx: 0,
                    id: pivot,
                    newRowCnt: before.keys.length,
                    newColCnt: 1 + before.fields.length,
                },
            },
            ...before.keys.map((k, i) => ({
                type: 'cellInput',
                value: {sheetIdx: 0, row: 10 + i, col: 0, content: k},
            })),
            {
                type: 'bindFormSchema',
                value: {
                    refName: 'sales_pivot',
                    sheetIdx: 0,
                    blockId: pivot,
                    fieldFrom: 0,
                    keyIdx: 0,
                    row: true,
                    fields: [
                        {name: 'region', renderId: 'p0'},
                        ...before.fields.map((f, i) => ({
                            name: f,
                            renderId: `p${i + 1}`,
                        })),
                    ],
                },
            },
        ])
        expect(eff.status.type, eff.errorMessage).toBe('ok')

        expect(plan(bookId, pivot).isStale).toBe(false)
        // Rows are now East / North / Northwest / South, sorted.
        expect(num(bookId, 12, 1)).toBe(99) // Northwest Q1, the new group
        expect(num(bookId, 10, 1)).toBe(10) // East Q1, unchanged
        expect(num(bookId, 13, 1)).toBe(7) // South Q1, moved but intact

        // One undo puts the old shape back.
        expect(rpc('undo', undefined, bookId)).toBe(true)
        expect(plan(bookId, pivot).currentKeys).toEqual([
            'East',
            'South',
            'North',
        ])
    })
})
