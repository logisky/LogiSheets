/**
 * The logician pivot TOOLS — `build__create_pivot`, `build__refresh_pivot`,
 * `inspect__describe_block` — against the REAL engine.
 *
 * `pivot-ops.test.ts` next door covers `WorkbookOps`, which the tools call.
 * That layer takes the pivot's key field as an argument, so everything it
 * proves holds for a caller that passes the right one — and the tool layer is
 * where that argument is worked out from the block's schema.
 *
 * Which is where a pivot's shape can go wrong in the one way nothing else
 * catches: the numbers stay live and correct while a COLUMN NAME is written
 * back wrong, so the grid looks right and `BLOCKREF` reaches the wrong cell.
 * Proving that needs a real engine — a name is only ambiguous once something
 * has to resolve it.
 */
import {describe, it, expect, beforeEach} from 'vitest'
import type {Client} from 'logisheets-web/pure'
import {handle} from '../wasm/logisheets_wasm_server'
import {
    createPivot,
    refreshPivot,
    renameBlock,
    renameField,
} from '../../logician/src/tools/builder.js'
import {describeBlock} from '../../logician/src/tools/builder.js'
import type {ToolContext} from '../../logician/src/tool.js'

function rpc(
    method: string,
    params?: Record<string, unknown>,
    bookId?: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
    const msg = params === undefined ? method : {method, value: params}
    return handle(msg, bookId ?? null)
}

/**
 * A `Client` that forwards every method straight to the engine, rather than a
 * hand-listed subset: a tool reaching for one RPC nobody thought to stub
 * should fail loudly here, not quietly take a different branch.
 */
function clientFor(bookId: number): Client {
    return new Proxy(
        {},
        {
            get:
                (_t, name: string) =>
                async (params?: Record<string, unknown>) =>
                    rpc(name, params, bookId),
        }
    ) as unknown as Client
}

function ctxFor(client: Client): ToolContext {
    return {
        workbook: client,
        signal: new AbortController().signal,
        confirm: async () => true,
        log: () => {},
    }
}

function value(
    bookId: number,
    row: number,
    col: number
): string | number | undefined {
    const v = rpc('getValue', {sheetIdx: 0, row, col}, bookId) as
        | {type: string; value: string | number}
        | string
    if (typeof v !== 'object') return undefined
    return v.type === 'number' || v.type === 'str' ? v.value : undefined
}

/** `id, region, quarter, amount` — two records, both Q1. */
const SALES: ReadonlyArray<readonly [string, string, string, string]> = [
    ['o1', 'East', 'Q1', '100'],
    ['o2', 'West', 'Q1', '80'],
]

function salesBlock(bookId: number): number {
    const src = rpc('getAvailableBlockId', {sheetIdx: 0}, bookId) as number
    const eff = rpc(
        'handleTransaction',
        {
            transaction: {
                payloads: [
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
                                {name: 'id', renderId: 's0'},
                                {name: 'region', renderId: 's1'},
                                {name: 'quarter', renderId: 's2'},
                                {
                                    name: 'amount',
                                    renderId: 's3',
                                    fieldType: {kind: 'number'},
                                },
                            ],
                        },
                    },
                    ...SALES.flatMap((row, r) =>
                        row.map((v, c) => ({
                            type: 'cellInput',
                            value: {sheetIdx: 0, row: r, col: c, content: v},
                        }))
                    ),
                ],
                undoable: true,
                temp: false,
            },
        },
        bookId
    )
    expect(eff.status.type, eff.errorMessage).toBe('ok')
    return src
}

/** One more source record, at sheet row `at`. The sheet insert comes first:
 *  `insertRowsInBlock` alone grows the block into the pivot below it. */
function addSale(bookId: number, src: number, at: number, row: string[]) {
    const eff = rpc(
        'handleTransaction',
        {
            transaction: {
                payloads: [
                    {
                        type: 'insertRows',
                        value: {sheetIdx: 0, start: at, count: 1},
                    },
                    {
                        type: 'insertRowsInBlock',
                        value: {sheetIdx: 0, blockId: src, start: at, cnt: 1},
                    },
                    ...row.map((v, c) => ({
                        type: 'cellInput',
                        value: {sheetIdx: 0, row: at, col: c, content: v},
                    })),
                ],
                undoable: true,
                temp: false,
            },
        },
        bookId
    )
    expect(eff.status.type, eff.errorMessage).toBe('ok')
}

/** Where the pivot sits now — it moves down as its source grows. */
function pivotBlock(bookId: number): {rowStart: number; colStart: number} {
    const b = (
        rpc('getAllBlocks', {}, bookId) as Array<{
            schema?: {name: string}
            rowStart: number
            colStart: number
        }>
    ).find((b) => b.schema?.name === 'by_region')
    expect(b, 'the pivot block is there').toBeDefined()
    return b!
}

/** Evaluate a formula in a spare cell well clear of the blocks. */
function formula(bookId: number, content: string): string | number | undefined {
    const eff = rpc(
        'handleTransaction',
        {
            transaction: {
                payloads: [
                    {
                        type: 'cellInput',
                        value: {sheetIdx: 0, row: 30, col: 8, content},
                    },
                ],
                undoable: true,
                temp: false,
            },
        },
        bookId
    )
    expect(eff.status.type, eff.errorMessage).toBe('ok')
    return value(bookId, 30, 8)
}

describe('build__refresh_pivot against the real engine', () => {
    let bookId: number
    let src: number
    let client: Client

    beforeEach(async () => {
        bookId = rpc('newWorkbook') as number
        src = salesBlock(bookId)
        client = clientFor(bookId)
        await createPivot.handler(
            {
                source: 'sales',
                rows: 'region',
                columns: 'quarter',
                measure: 'amount',
                name: 'by_region',
            },
            ctxFor(client)
        )
    })

    const fieldNames = async () => {
        const r = await describeBlock.handler(
            {name: 'by_region'},
            ctxFor(client)
        )
        return r.data.fields.map((f) => f.name)
    }

    it('keeps the pivot addressable by name after it adds a row', async () => {
        // The bug: a refresh that ADDS a row wrote the FIRST MEASURE column's
        // name over the key column's, so ["region", "Q1"] came back as
        // ["Q1", "Q1"] — in the saved cell, not just in a report. Two fields
        // then answer to "Q1", the key one first, and the pivot silently hands
        // back the group label where a number belongs.
        expect(await fieldNames()).toEqual(['region', 'Q1'])

        addSale(bookId, src, 2, ['o3', 'North', 'Q1', '55'])
        const r = await refreshPivot.handler(
            {name: 'by_region'},
            ctxFor(client)
        )
        expect(r.data.changed).toBe(true)
        expect(r.data.added_rows).toEqual(['North'])

        // (a) The schema is what it was. A refresh adds GROUPS; the columns of
        // a cross-tab come from the column dimension, and no new quarter
        // appeared.
        expect(await fieldNames()).toEqual(['region', 'Q1'])

        // (b) And the cell the model would reach for holds the aggregate, not
        // the label. This is the assertion that would have caught it: the
        // header row alone reads plausibly either way, because the clobbered
        // name is a name the pivot really does have.
        expect(formula(bookId, '=BLOCKREF("by_region","North","Q1")')).toBe(55)
        expect(formula(bookId, '=BLOCKREF("by_region","East","Q1")')).toBe(100)
    })

    it('writes the key column header the source field is named after', async () => {
        // The same fact one level down, in the cells themselves — so a failure
        // says whether the header was written wrong or only bound wrong.
        addSale(bookId, src, 2, ['o3', 'North', 'Q1', '55'])
        await refreshPivot.handler({name: 'by_region'}, ctxFor(client))

        const p = pivotBlock(bookId)
        expect(value(bookId, p.rowStart, p.colStart)).toBe('region')
        expect(value(bookId, p.rowStart, p.colStart + 1)).toBe('Q1')
    })

    it('keeps it when the refresh adds a COLUMN rather than a row', async () => {
        // The other half of a refresh. A new column shifts every field after
        // the key one, which is exactly the situation a positional mistake
        // survives — the names still look like names.
        addSale(bookId, src, 2, ['o3', 'East', 'Q2', '40'])
        const r = await refreshPivot.handler(
            {name: 'by_region'},
            ctxFor(client)
        )
        expect(r.data.added_columns).toEqual(['Q2'])
        expect(r.data.added_rows).toEqual([])

        expect(await fieldNames()).toEqual(['region', 'Q1', 'Q2'])
        expect(formula(bookId, '=BLOCKREF("by_region","East","Q2")')).toBe(40)
        expect(formula(bookId, '=BLOCKREF("by_region","East","Q1")')).toBe(100)
    })

    it('keeps it when a group DISAPPEARS', async () => {
        // The shrink path writes the header in full too.
        const eff = rpc(
            'handleTransaction',
            {
                transaction: {
                    payloads: [
                        {
                            type: 'deleteRowsInBlock',
                            value: {
                                sheetIdx: 0,
                                blockId: src,
                                start: 1,
                                cnt: 1,
                            },
                        },
                    ],
                    undoable: true,
                    temp: false,
                },
            },
            bookId
        )
        expect(eff.status.type, eff.errorMessage).toBe('ok')

        const r = await refreshPivot.handler(
            {name: 'by_region'},
            ctxFor(client)
        )
        expect(r.data.removed_rows).toEqual(['West'])
        expect(await fieldNames()).toEqual(['region', 'Q1'])
        expect(formula(bookId, '=BLOCKREF("by_region","East","Q1")')).toBe(100)
    })

    it('does not drift over repeated refreshes', async () => {
        // A name written from a positional lookup can degrade a step at a
        // time, so one refresh proving correct is not the same as the shape
        // being a fixed point.
        for (const [i, sale] of [
            ['o3', 'North', 'Q1', '55'],
            ['o4', 'South', 'Q2', '11'],
            ['o5', 'North', 'Q3', '7'],
        ].entries()) {
            addSale(bookId, src, 2 + i, sale as string[])
            await refreshPivot.handler({name: 'by_region'}, ctxFor(client))
        }
        expect(await fieldNames()).toEqual(['region', 'Q1', 'Q2', 'Q3'])

        // And a refresh with nothing to do is still a no-op afterwards.
        const again = await refreshPivot.handler(
            {name: 'by_region'},
            ctxFor(client)
        )
        expect(again.data.changed).toBe(false)
        expect(await fieldNames()).toEqual(['region', 'Q1', 'Q2', 'Q3'])
        expect(formula(bookId, '=BLOCKREF("by_region","North","Q3")')).toBe(7)
        expect(formula(bookId, '=BLOCKREF("by_region","South","Q2")')).toBe(11)
    })

    it('converges — describe_block stops calling it stale', async () => {
        addSale(bookId, src, 2, ['o3', 'North', 'Q1', '55'])
        const stale = await describeBlock.handler(
            {name: 'by_region'},
            ctxFor(client)
        )
        expect(stale.data.pivot_is_stale).toContain('North')

        await refreshPivot.handler({name: 'by_region'}, ctxFor(client))
        const fresh = await describeBlock.handler(
            {name: 'by_region'},
            ctxFor(client)
        )
        expect(fresh.data.pivot_is_stale).toBeUndefined()
        expect(fresh.data.pivot_is_broken).toBeUndefined()
    })

    it('carries the corrected header into a saved .xlsx', async () => {
        // The reason this was worth more than a reporting fix: the clobbered
        // name was the CELL's content, so it left the product entirely.
        addSale(bookId, src, 2, ['o3', 'North', 'Q1', '55'])
        await refreshPivot.handler({name: 'by_region'}, ctxFor(client))

        const saved = rpc('saveWorkbook', {appData: ''}, bookId) as {
            code: number
            data: number[] | Uint8Array
        }
        expect(saved.code).toBe(0)
        const bytes = Array.isArray(saved.data)
            ? saved.data
            : Array.from(saved.data)

        const reopened = rpc('newWorkbook') as number
        rpc('loadWorkbook', {content: bytes, name: 'pivot.xlsx'}, reopened)
        const p = pivotBlock(reopened)
        expect(value(reopened, p.rowStart, p.colStart)).toBe('region')
        expect(value(reopened, p.rowStart, p.colStart + 1)).toBe('Q1')
        rpc('release', undefined, reopened)
    })
})

describe('build__refresh_pivot on the shapes beyond a plain cross-tab', () => {
    let bookId: number
    let src: number
    let client: Client

    beforeEach(() => {
        bookId = rpc('newWorkbook') as number
        src = salesBlock(bookId)
        client = clientFor(bookId)
    })

    const fieldNames = async (name: string) => {
        const r = await describeBlock.handler({name}, ctxFor(client))
        return r.data.fields.map((f) => f.name)
    }

    it('keeps the key column beside a hand-declared row total', async () => {
        // A declared column is restated from the block's CURRENT fields rather
        // than derived, so this path reads the schema twice over — once for the
        // key field and once per declared column. Both readings have to agree
        // about which entry is which.
        await createPivot.handler(
            {
                source: 'sales',
                rows: 'region',
                columns: 'quarter',
                measure: 'amount',
                name: 'by_region',
                row_total: 'Total',
            },
            ctxFor(client)
        )
        expect(await fieldNames('by_region')).toEqual(['region', 'Q1', 'Total'])

        addSale(bookId, src, 2, ['o3', 'North', 'Q2', '55'])
        await refreshPivot.handler({name: 'by_region'}, ctxFor(client))

        expect(await fieldNames('by_region')).toEqual([
            'region',
            'Q1',
            'Q2',
            'Total',
        ])
        // The total still spans the columns; had it been rewritten as a
        // derived one it would filter on the literal "Total" and read 0.
        expect(formula(bookId, '=BLOCKREF("by_region","East","Total")')).toBe(
            100
        )
        expect(formula(bookId, '=BLOCKREF("by_region","North","Total")')).toBe(
            55
        )
        expect(formula(bookId, '=BLOCKREF("by_region","North","Q2")')).toBe(55)
    })

    it('keeps the key column of a GROUPED pivot, whose one column is the measure', async () => {
        // No column dimension, so the plan proposes no fields and the refresh
        // keeps the ones the block has — a different branch for `fieldNames`,
        // reached with the same key field.
        await createPivot.handler(
            {
                source: 'sales',
                rows: 'region',
                measure: 'amount',
                name: 'by_region',
            },
            ctxFor(client)
        )
        expect(await fieldNames('by_region')).toEqual(['region', 'amount'])

        addSale(bookId, src, 2, ['o3', 'North', 'Q1', '55'])
        const r = await refreshPivot.handler(
            {name: 'by_region'},
            ctxFor(client)
        )
        expect(r.data.added_rows).toEqual(['North'])
        expect(await fieldNames('by_region')).toEqual(['region', 'amount'])
        expect(formula(bookId, '=BLOCKREF("by_region","North","amount")')).toBe(
            55
        )
    })
})

describe('a pivot survives being renamed', () => {
    // Both rename tools re-bind the block's whole schema from a snapshot, and
    // the snapshot used to omit the header line. `BindFormSchema` states a
    // block's ENTIRE interpretation, so the omission DELETED it: the header
    // row stopped being a header and became a record keyed "region", which is
    // a group the source has never heard of. The payload-level half of this is
    // packages/logician/src/tools/rename-preserves-schema.test.ts; this is the
    // half that shows what the loss actually does to a workbook.
    let bookId: number
    let src: number
    let client: Client

    beforeEach(async () => {
        bookId = rpc('newWorkbook') as number
        src = salesBlock(bookId)
        client = clientFor(bookId)
        await createPivot.handler(
            {
                source: 'sales',
                rows: 'region',
                columns: 'quarter',
                measure: 'amount',
                name: 'by_region',
            },
            ctxFor(client)
        )
    })

    const described = (name: string) =>
        describeBlock.handler({name}, ctxFor(client))

    it('keeps its header line through rename_block', async () => {
        await renameBlock.handler(
            {from: 'by_region', to: 'by_area'},
            ctxFor(client)
        )

        const d = await described('by_area')
        // The header row is still a header. It used to appear here as a third
        // group called "region" — the key column's own title, read as data.
        expect(d.data.keys).toEqual(['East', 'West'])
        expect(d.data.fields.map((f) => f.name)).toEqual(['region', 'Q1'])
        expect(formula(bookId, '=BLOCKREF("by_area","East","Q1")')).toBe(100)
    })

    it('still refreshes after rename_block', async () => {
        // The consequence, one step on: with the header line gone the refresh
        // tried to DROP the phantom group and the engine rejected the whole
        // transaction — so a renamed pivot could never be brought up to date
        // again.
        await renameBlock.handler(
            {from: 'by_region', to: 'by_area'},
            ctxFor(client)
        )
        addSale(bookId, src, 2, ['o3', 'North', 'Q1', '55'])

        const r = await refreshPivot.handler({name: 'by_area'}, ctxFor(client))
        expect(r.data.added_rows).toEqual(['North'])
        expect(r.data.removed_rows).toEqual([])
        expect(formula(bookId, '=BLOCKREF("by_area","North","Q1")')).toBe(55)
    })

    it('keeps its header line through rename_field, and shows the new name', async () => {
        await renameField.handler(
            {block: 'by_region', from: 'region', to: 'territory'},
            ctxFor(client)
        )

        const d = await described('by_region')
        expect(d.data.keys).toEqual(['East', 'West'])
        expect(d.data.fields.map((f) => f.name)).toEqual(['territory', 'Q1'])
        // The grid agrees with the schema straight away, rather than waiting
        // for some later refresh to rewrite the header row.
        const p = pivotBlock(bookId)
        expect(value(bookId, p.rowStart, p.colStart)).toBe('territory')
    })

    it('refreshes under the renamed key column, keeping the new name', async () => {
        // And the name the refresh restates is the one the block HAS, not the
        // row dimension it was built from — which is the whole reason the key
        // field is read off the schema instead of taken from the recipe.
        await renameField.handler(
            {block: 'by_region', from: 'region', to: 'territory'},
            ctxFor(client)
        )
        addSale(bookId, src, 2, ['o3', 'North', 'Q1', '55'])

        const r = await refreshPivot.handler(
            {name: 'by_region'},
            ctxFor(client)
        )
        expect(r.data.added_rows).toEqual(['North'])
        expect(r.data.removed_rows).toEqual([])

        const d = await described('by_region')
        expect(d.data.fields.map((f) => f.name)).toEqual(['territory', 'Q1'])
        const p = pivotBlock(bookId)
        expect(value(bookId, p.rowStart, p.colStart)).toBe('territory')
        expect(formula(bookId, '=BLOCKREF("by_region","North","Q1")')).toBe(55)
    })
})

describe("a block's unique_together survives being renamed", () => {
    // Not a pivot thing: any block can carry the rule, `build__create_block`
    // is what sets it, and both rename tools used to drop it — so an agent
    // that created a block with a rule and then tidied up its names was left
    // with a block the engine no longer checked.
    let bookId: number
    let client: Client

    beforeEach(() => {
        bookId = rpc('newWorkbook') as number
        const blockId = rpc(
            'getAvailableBlockId',
            {sheetIdx: 0},
            bookId
        ) as number
        const eff = rpc(
            'handleTransaction',
            {
                transaction: {
                    payloads: [
                        {
                            type: 'createBlock',
                            value: {
                                sheetIdx: 0,
                                id: blockId,
                                masterRow: 0,
                                masterCol: 0,
                                rowCnt: 2,
                                colCnt: 3,
                            },
                        },
                        {
                            type: 'bindFormSchema',
                            value: {
                                refName: 'rec',
                                sheetIdx: 0,
                                blockId,
                                fieldFrom: 0,
                                keyIdx: 0,
                                row: true,
                                fields: [
                                    {name: 'k', renderId: 'r0'},
                                    {name: 'a', renderId: 'r1'},
                                    {name: 'b', renderId: 'r2'},
                                ],
                                uniqueTogether: [{fields: ['a', 'b']}],
                            },
                        },
                    ],
                    undoable: true,
                    temp: false,
                },
            },
            bookId
        )
        expect(eff.status.type, eff.errorMessage).toBe('ok')
        client = clientFor(bookId)
    })

    const rulesOf = (name: string) =>
        (
            rpc('getAllBlocks', {}, bookId) as Array<{
                schema?: {
                    name: string
                    uniqueTogether?: ReadonlyArray<{fields: readonly string[]}>
                }
            }>
        )
            .find((b) => b.schema?.name === name)!
            .schema!.uniqueTogether!.map((g) => [...g.fields])

    it('survives rename_block', async () => {
        await renameBlock.handler({from: 'rec', to: 'records'}, ctxFor(client))
        expect(rulesOf('records')).toEqual([['a', 'b']])
    })

    it('survives rename_field', async () => {
        await renameField.handler(
            {block: 'rec', from: 'k', to: 'key'},
            ctxFor(client)
        )
        expect(rulesOf('rec')).toEqual([['a', 'b']])
    })
})
