import {describe, expect, it} from 'vitest'
import type {Client} from 'logisheets-web/pure'
import type {ToolContext} from '../tool.js'
import {createPivot, describeBlock, editPivot, refreshPivot} from './builder.js'

/**
 * The AI-facing half of pivots. A pivot's numbers are live but its SHAPE is
 * not, so a stale one shows correct numbers with whole groups missing — the
 * one way a block can mislead without being wrong. These cover the two things
 * that protect a reader from that: `describe_block` saying so, and
 * `refresh_pivot` fixing it.
 *
 * The payload sequences are covered in logisheets-core, the computation in
 * crates/controller, and both end to end in packages/node.
 */

const SALES_FIELDS = [
    {field: 'id', idx: 0, renderId: 's0', writePolicy: 'inherit'},
    {field: 'region', idx: 1, renderId: 's1', writePolicy: 'inherit'},
    {field: 'quarter', idx: 2, renderId: 's2', writePolicy: 'inherit'},
    {
        field: 'amt',
        idx: 3,
        renderId: 's3',
        fieldType: {kind: 'number'},
        writePolicy: 'inherit',
    },
]

const PIVOT_RECIPE = {
    rowDim: 'region',
    colDim: 'quarter',
    measure: 'amt',
    func: 'SUM',
    order: 'ascending',
}

function clientWith(
    opts: {
        plan?: Record<string, unknown>
        withPivotBlock?: boolean
        /** Make `pivotPlan` fail, as it does when the recipe is unstuck. */
        planError?: string
        pivotRecipe?: Record<string, unknown>
        extraPivotFields?: Array<Record<string, unknown>>
        /** Render entries for the SOURCE, so a pivot of it can inherit them. */
        sourceRenders?: Array<Record<string, unknown>>
        /** What the engine says about saving this pivot to .xlsx. */
        excelReason?: string
    } = {}
) {
    const committed: Array<{type: string; value: Record<string, unknown>}> = []
    const plan = opts.plan ?? {
        keys: ['East', 'North'],
        fields: ['Q1', 'Q2'],
        currentKeys: [],
        currentFields: [],
        missingKeys: ['East', 'North'],
        missingFields: ['Q1', 'Q2'],
        extraKeys: [],
        extraFields: [],
        unassignedRecords: 0,
        isStale: true,
    }
    const blocks: Array<Record<string, unknown>> = [
        {
            sheetIdx: 0,
            sheetId: 7,
            blockId: 3,
            rowStart: 0,
            colStart: 0,
            rowCnt: 6,
            colCnt: 4,
            description: '',
            owner: '',
            modifyPolicy: 'all',
            permissions: {},
            fieldRenders: opts.sourceRenders ?? [],
            cells: [],
            analyzedBy: opts.withPivotBlock ? [9] : [],
            schema: {
                name: 'sales',
                schemaType: 'row',
                keys: [{key: 'o0', idx: 0}],
                fields: SALES_FIELDS,
                randomEntries: [],
            },
        },
    ]
    if (opts.withPivotBlock) {
        blocks.push({
            sheetIdx: 0,
            sheetId: 7,
            blockId: 9,
            rowStart: 10,
            colStart: 0,
            rowCnt: 2,
            colCnt: 3,
            description: '',
            owner: '',
            modifyPolicy: 'all',
            permissions: {},
            fieldRenders: [],
            cells: [],
            analyzes: 3,
            analyzedBy: [],
            pivot: opts.pivotRecipe ?? PIVOT_RECIPE,
            schema: {
                name: 'sales_pivot',
                schemaType: 'row',
                keys: [{key: 'East', idx: 0}],
                fields: [
                    {
                        field: 'region',
                        idx: 0,
                        renderId: 'p0',
                        writePolicy: 'inherit',
                    },
                    {
                        field: 'Q1',
                        idx: 1,
                        renderId: 'p1',
                        writePolicy: 'inherit',
                    },
                    {
                        field: 'Q2',
                        idx: 2,
                        renderId: 'p2',
                        writePolicy: 'inherit',
                    },
                    ...(opts.extraPivotFields ?? []),
                ],
                randomEntries: [],
            },
        })
    }
    const client = {
        getAllBlocks: async () => blocks,
        getAllSheetInfo: async () => [{name: 'Sheet1'}],
        getAvailableBlockId: async () => 9,
        mayModifyBlock: async () => true,
        pivotPlan: async () =>
            // `isErrorMessage` wants both fields, as the real RPC sends.
            opts.planError ? {msg: opts.planError, ty: 'unspecified'} : plan,
        pivotPlanFor: async () => plan,
        pivotExcelNote: async () =>
            opts.excelReason
                ? {expressible: false, reason: opts.excelReason}
                : {expressible: true},
        handleTransaction: async ({
            transaction,
        }: {
            transaction: {payloads: Array<{type: string; value: unknown}>}
        }) => {
            for (const p of transaction.payloads)
                committed.push(
                    p as {type: string; value: Record<string, unknown>}
                )
            return {status: {type: 'ok'}, taskIdx: [], asyncTasks: []}
        },
    } as unknown as Client
    return {client, committed}
}

function ctxFor(client: Client): ToolContext {
    return {
        workbook: client,
        signal: new AbortController().signal,
        confirm: async () => true,
        log: () => {},
    }
}

describe('build__create_pivot', () => {
    it('creates the block and tells the model how to reach a cell of it', async () => {
        // The whole reason a pivot is a block: one number out of a cross-tab
        // is addressable, so it can go in a sentence or another calculation.
        const {client, committed} = clientWith()
        const r = await createPivot.handler(
            {
                source: 'sales',
                rows: 'region',
                columns: 'quarter',
                measure: 'amt',
            },
            ctxFor(client)
        )
        expect(r.data.block).toBe('sales_pivot')
        expect(r.data.rows).toEqual(['East', 'North'])
        expect(r.data.columns).toEqual(['Q1', 'Q2'])
        expect(r.display).toContain('BLOCKREF("sales_pivot"')
        // One transaction: the shape was known before anything was created.
        expect(committed.map((p) => p.type)).toEqual([
            'insertRows',
            'createBlock',
            // The header line (three columns), then one key per group — all
            // block-relative, all inside the block.
            'blockInput',
            'blockInput',
            'blockInput',
            'blockInput',
            'blockInput',
            'bindFormSchema',
            // Formats last, attaching to the render ids the bind declares:
            // key column plus one per column-dimension value.
            'upsertFieldRenderInfo',
            'upsertFieldRenderInfo',
            'upsertFieldRenderInfo',
        ])
    })

    it('refuses a field the source does not have, and lists what it does', async () => {
        // Naming the alternatives is the difference between a model that
        // recovers on the next call and one that guesses again.
        const {client, committed} = clientWith()
        await expect(
            createPivot.handler(
                {
                    source: 'sales',
                    rows: 'territory',
                    measure: 'amt',
                },
                ctxFor(client)
            )
        ).rejects.toThrow(
            /no field named "territory".*id, region, quarter, amt/s
        )
        expect(committed).toEqual([])
    })

    it('checks the measure and the column dimension too', async () => {
        const {client} = clientWith()
        await expect(
            createPivot.handler(
                {source: 'sales', rows: 'region', measure: 'nope'},
                ctxFor(client)
            )
        ).rejects.toThrow(/`measure`/)
        await expect(
            createPivot.handler(
                {
                    source: 'sales',
                    rows: 'region',
                    columns: 'nope',
                    measure: 'amt',
                },
                ctxFor(client)
            )
        ).rejects.toThrow(/`columns`/)
    })

    it('refuses a name already in use', async () => {
        const {client} = clientWith({withPivotBlock: true})
        await expect(
            createPivot.handler(
                {source: 'sales', rows: 'region', measure: 'amt'},
                ctxFor(client)
            )
        ).rejects.toThrow(/already exists/)
    })

    it('surfaces records that belong to no group', async () => {
        // A refresh cannot fix these — the data has to be filled in — so the
        // model has to be told rather than quietly totalling without them.
        const {client} = clientWith({
            plan: {
                keys: ['East'],
                fields: ['Q1'],
                currentKeys: [],
                currentFields: [],
                missingKeys: ['East'],
                missingFields: ['Q1'],
                extraKeys: [],
                extraFields: [],
                unassignedRecords: 3,
                isStale: true,
            },
        })
        const r = await createPivot.handler(
            {source: 'sales', rows: 'region', measure: 'amt'},
            ctxFor(client)
        )
        expect(r.data.unassigned_records).toBe(3)
        expect(r.display).toContain('3 record(s) have no region')
    })
})

describe('build__describe_block on a pivot', () => {
    it('states the recipe in words', async () => {
        const {client} = clientWith({
            withPivotBlock: true,
            plan: {
                keys: ['East'],
                fields: ['Q1'],
                currentKeys: ['East'],
                currentFields: ['Q1'],
                missingKeys: [],
                missingFields: [],
                extraKeys: [],
                extraFields: [],
                unassignedRecords: 0,
                isStale: false,
            },
        })
        const r = await describeBlock.handler(
            {name: 'sales_pivot'},
            ctxFor(client)
        )
        expect(r.data.pivot).toBe(
            'rows = region, columns = quarter, SUM of amt (of "sales")'
        )
        expect(r.data.analyzes).toBe('sales')
        expect(r.data.pivot_is_stale).toBeUndefined()
    })

    it('says LOUDLY when the shape is behind, and what is missing', async () => {
        // The failure this exists for: every number on screen is correct and a
        // whole region is absent, so a total taken from it is short.
        const {client} = clientWith({
            withPivotBlock: true,
            plan: {
                keys: ['East', 'Northwest'],
                fields: ['Q1', 'Q2', 'Q3'],
                currentKeys: ['East'],
                currentFields: ['Q1', 'Q2'],
                missingKeys: ['Northwest'],
                missingFields: ['Q3'],
                extraKeys: [],
                extraFields: [],
                unassignedRecords: 0,
                isStale: true,
            },
        })
        const r = await describeBlock.handler(
            {name: 'sales_pivot'},
            ctxFor(client)
        )
        const stale = r.data.pivot_is_stale!
        expect(stale).toContain('Northwest')
        expect(stale).toContain('Q3')
        expect(stale).toContain('INCOMPLETE')
        expect(stale).toContain('build__refresh_pivot')
    })

    it('reports rows the source no longer justifies', async () => {
        const {client} = clientWith({
            withPivotBlock: true,
            plan: {
                keys: ['East'],
                fields: ['Q1'],
                currentKeys: ['East', 'North'],
                currentFields: ['Q1', 'Q2'],
                missingKeys: [],
                missingFields: [],
                extraKeys: ['North'],
                extraFields: ['Q2'],
                unassignedRecords: 0,
                isStale: true,
            },
        })
        const r = await describeBlock.handler(
            {name: 'sales_pivot'},
            ctxFor(client)
        )
        expect(r.data.pivot_is_stale).toContain('no longer exist')
        expect(r.data.pivot_is_stale).toContain('North')
    })

    it('counts unassigned records even when the shape is current', async () => {
        // Independent problems: the shape can be right while records with a
        // blank dimension are still in no cell at all.
        const {client} = clientWith({
            withPivotBlock: true,
            plan: {
                keys: ['East'],
                fields: ['Q1'],
                currentKeys: ['East'],
                currentFields: ['Q1'],
                missingKeys: [],
                missingFields: [],
                extraKeys: [],
                extraFields: [],
                unassignedRecords: 2,
                isStale: false,
            },
        })
        const r = await describeBlock.handler(
            {name: 'sales_pivot'},
            ctxFor(client)
        )
        expect(r.data.pivot_is_stale).toBeUndefined()
        expect(r.data.pivot_unassigned_records).toBe(2)
    })

    it('says nothing about pivots for an ordinary table', async () => {
        const {client} = clientWith({withPivotBlock: true})
        const r = await describeBlock.handler({name: 'sales'}, ctxFor(client))
        expect(r.data.pivot).toBeUndefined()
        expect(r.data.pivot_is_stale).toBeUndefined()
        // But it does report that something analyses it.
        expect(r.data.analyzed_by).toEqual(['sales_pivot'])
    })
})

describe('build__refresh_pivot', () => {
    it('reports doing nothing when the pivot is already current', async () => {
        const {client, committed} = clientWith({
            withPivotBlock: true,
            plan: {
                keys: ['East'],
                fields: ['Q1'],
                currentKeys: ['East'],
                currentFields: ['Q1'],
                missingKeys: [],
                missingFields: [],
                extraKeys: [],
                extraFields: [],
                unassignedRecords: 0,
                isStale: false,
            },
        })
        const r = await refreshPivot.handler(
            {name: 'sales_pivot'},
            ctxFor(client)
        )
        expect(r.data.changed).toBe(false)
        expect(committed).toEqual([])
        expect(r.display).toContain('already current')
    })

    it('says which groups it added', async () => {
        const {client, committed} = clientWith({
            withPivotBlock: true,
            plan: {
                keys: ['East', 'Northwest'],
                fields: ['Q1', 'Q2'],
                currentKeys: ['East'],
                currentFields: ['Q1', 'Q2'],
                missingKeys: ['Northwest'],
                missingFields: [],
                extraKeys: [],
                extraFields: [],
                unassignedRecords: 0,
                isStale: true,
            },
        })
        const r = await refreshPivot.handler(
            {name: 'sales_pivot'},
            ctxFor(client)
        )
        expect(r.data.changed).toBe(true)
        expect(r.data.added_rows).toEqual(['Northwest'])
        expect(r.display).toContain('added rows Northwest')
        // Keys before the bind, as always.
        const types = committed.map((p) => p.type)
        expect(types.lastIndexOf('cellInput')).toBeLessThan(
            types.indexOf('bindFormSchema')
        )
    })

    it('still reports unassigned records, which it cannot fix', async () => {
        const {client} = clientWith({
            withPivotBlock: true,
            plan: {
                keys: ['East', 'Northwest'],
                fields: ['Q1'],
                currentKeys: ['East'],
                currentFields: ['Q1'],
                missingKeys: ['Northwest'],
                missingFields: [],
                extraKeys: [],
                extraFields: [],
                unassignedRecords: 4,
                isStale: true,
            },
        })
        const r = await refreshPivot.handler(
            {name: 'sales_pivot'},
            ctxFor(client)
        )
        expect(r.data.unassigned_records).toBe(4)
        expect(r.display).toContain('a refresh cannot fix that')
    })

    it('refuses a block that is not a pivot', async () => {
        const {client} = clientWith({withPivotBlock: true})
        await expect(
            refreshPivot.handler({name: 'sales'}, ctxFor(client))
        ).rejects.toThrow(/is not a pivot/)
    })
})

describe('build__create_pivot — beyond a plain cross-tab', () => {
    it('adds a row total and second measures as declared columns', async () => {
        const {client, committed} = clientWith()
        await createPivot.handler(
            {
                source: 'sales',
                rows: 'region',
                columns: 'quarter',
                measure: 'amt',
                row_total: 'Total',
                extra_measures: [
                    {name: 'Orders', func: 'COUNT', measure: 'amt'},
                    {
                        name: 'Q1 Mean',
                        func: 'AVERAGE',
                        measure: 'amt',
                        column: 'Q1',
                    },
                ],
            },
            ctxFor(client)
        )
        const fields = (
            committed.find((p) => p.type === 'bindFormSchema')!.value as {
                fields: Array<Record<string, unknown>>
            }
        ).fields
        expect(fields.map((f) => f.name)).toEqual([
            'region',
            'Q1',
            'Q2',
            'Total',
            'Orders',
            'Q1 Mean',
        ])
        // `*` = every value of the column dimension.
        expect(fields[3]).toMatchObject({pivotColValue: '*'})
        expect(fields[4]).toMatchObject({
            pivotColValue: '*',
            pivotFunc: 'COUNT',
        })
        expect(fields[5]).toMatchObject({
            pivotColValue: 'Q1',
            pivotFunc: 'AVERAGE',
        })
    })

    it('sends filters and a custom order as part of the recipe', async () => {
        const {client, committed} = clientWith()
        await createPivot.handler(
            {
                source: 'sales',
                rows: 'region',
                measure: 'amt',
                order: 'custom',
                order_values: ['North', 'East'],
                filters: [{field: 'quarter', criteria: 'Q1'}],
            },
            ctxFor(client)
        )
        expect(
            committed.find((p) => p.type === 'createBlock')!.value
        ).toMatchObject({
            pivot: {
                order: 'custom',
                orderValues: ['North', 'East'],
                filters: [{field: 'quarter', criteria: 'Q1'}],
            },
        })
    })

    it('refuses a filter on a field the source does not have', async () => {
        const {client, committed} = clientWith()
        await expect(
            createPivot.handler(
                {
                    source: 'sales',
                    rows: 'region',
                    measure: 'amt',
                    filters: [{field: 'nope', criteria: 'x'}],
                },
                ctxFor(client)
            )
        ).rejects.toThrow(/`filters`.*no field named "nope"/s)
        expect(committed).toEqual([])
    })

    it('refuses a custom order with nothing to order by', async () => {
        const {client} = clientWith()
        await expect(
            createPivot.handler(
                {
                    source: 'sales',
                    rows: 'region',
                    measure: 'amt',
                    order: 'custom',
                },
                ctxFor(client)
            )
        ).rejects.toThrow(/needs `order_values`/)
    })

    it('refuses a row total on a pivot with no columns to total', async () => {
        // Without a column dimension the single value column ALREADY spans
        // everything, so a "total" column would duplicate it — and the model
        // should learn that rather than get a redundant column.
        const {client} = clientWith()
        await expect(
            createPivot.handler(
                {
                    source: 'sales',
                    rows: 'region',
                    measure: 'amt',
                    row_total: 'Total',
                },
                ctxFor(client)
            )
        ).rejects.toThrow(
            /spans the values of `columns`, and this pivot has none/
        )
    })
})

describe('build__describe_block — what the recipe actually does', () => {
    const planFor = (over: Record<string, unknown> = {}) => ({
        keys: ['East'],
        fields: ['Q1'],
        currentKeys: ['East'],
        currentFields: ['Q1'],
        missingKeys: [],
        missingFields: [],
        extraKeys: [],
        extraFields: [],
        unassignedRecords: 0,
        isStale: false,
        ...over,
    })

    it('says which records a filter excludes, because nothing else does', async () => {
        // A filtered pivot shows correct numbers over a subset. Without this
        // line a reader totals it and under-reports, exactly as with a stale
        // one — same failure, different cause.
        const {client} = clientWith({
            withPivotBlock: true,
            plan: planFor(),
            pivotRecipe: {
                ...PIVOT_RECIPE,
                filters: [{field: 'quarter', criteria: 'Q1'}],
            },
        })
        const r = await describeBlock.handler(
            {name: 'sales_pivot'},
            ctxFor(client)
        )
        expect(r.data.pivot).toContain('counting ONLY records where quarter Q1')
        expect(r.data.pivot).toContain('excludes the rest')
    })

    it('says when the rows are in a fixed order rather than sorted', async () => {
        const {client} = clientWith({
            withPivotBlock: true,
            plan: planFor(),
            pivotRecipe: {
                ...PIVOT_RECIPE,
                order: 'custom',
                orderValues: ['North', 'East'],
            },
        })
        const r = await describeBlock.handler(
            {name: 'sales_pivot'},
            ctxFor(client)
        )
        expect(r.data.pivot).toContain('fixed order (North, East)')
    })

    it('distinguishes a total column from a dimension column', async () => {
        // Otherwise an agent reads Total as one more quarter and adds it to the
        // others — double-counting the whole row.
        const {client} = clientWith({
            withPivotBlock: true,
            plan: planFor({
                fields: ['Q1', 'Total'],
                currentFields: ['Q1', 'Total'],
            }),
            extraPivotFields: [
                {
                    field: 'Total',
                    idx: 3,
                    renderId: 'p3',
                    writePolicy: 'inherit',
                    pivotColValue: '*',
                },
            ],
        })
        const r = await describeBlock.handler(
            {name: 'sales_pivot'},
            ctxFor(client)
        )
        expect(r.data.pivot).toContain('"Total" is a total across every column')
    })

    it('names a second measure and what it measures', async () => {
        const {client} = clientWith({
            withPivotBlock: true,
            plan: planFor({
                fields: ['Q1', 'Orders'],
                currentFields: ['Q1', 'Orders'],
            }),
            extraPivotFields: [
                {
                    field: 'Orders',
                    idx: 3,
                    renderId: 'p3',
                    writePolicy: 'inherit',
                    pivotColValue: '*',
                    pivotFunc: 'COUNT',
                    pivotMeasure: 'amt',
                },
            ],
        })
        const r = await describeBlock.handler(
            {name: 'sales_pivot'},
            ctxFor(client)
        )
        expect(r.data.pivot).toContain('(COUNT of amt)')
    })

    it('says nothing extra for a plain cross-tab', async () => {
        // The report has to stay short when there is nothing to warn about, or
        // the warnings stop being read.
        const {client} = clientWith({withPivotBlock: true, plan: planFor()})
        const r = await describeBlock.handler(
            {name: 'sales_pivot'},
            ctxFor(client)
        )
        expect(r.data.pivot).toBe(
            'rows = region, columns = quarter, SUM of amt (of "sales")'
        )
    })

    it('shouts when the recipe cannot be evaluated at all', async () => {
        // The case that used to be swallowed: the plan errors because the
        // recipe names a field that is gone, and the cells read 0 without
        // erroring — so with no report the pivot looks like real zeroes.
        const {client} = clientWith({
            withPivotBlock: true,
            planError:
                'the pivot groups by "region", which block 3 does not have',
        })
        const r = await describeBlock.handler(
            {name: 'sales_pivot'},
            ctxFor(client)
        )
        expect(r.data.pivot_is_broken).toContain('does not have')
        expect(r.data.pivot_is_broken).toContain('reading 0')
        expect(r.data.pivot_is_broken).toContain('do NOT report any number')
        // And it does not also claim to be merely stale, which would read as
        // a smaller problem than it is.
        expect(r.data.pivot_is_stale).toBeUndefined()
    })
})

describe('build__create_pivot carries the source number formats', () => {
    // A pivot of a money column that reads as bare numbers, directly beneath
    // the money it came from, looks broken even though every figure is right.
    const MONEY = '"$"#,##0.00'

    it('formats the value columns like the measure, and the key like its own field', async () => {
        const {client, committed} = clientWith({
            sourceRenders: [{renderId: 's3', style: {formatter: MONEY}}],
        })
        await createPivot.handler(
            {
                source: 'sales',
                rows: 'region',
                columns: 'quarter',
                measure: 'amt',
            },
            ctxFor(client)
        )
        expect(
            committed
                .filter((p) => p.type === 'upsertFieldRenderInfo')
                .map(
                    (p) =>
                        (p.value.styleUpdate as {setNumFmt: string}).setNumFmt
                )
        ).toEqual(['', MONEY, MONEY])
    })

    it('leaves a second measure that COUNTS plain', async () => {
        const {client, committed} = clientWith({
            sourceRenders: [{renderId: 's3', style: {formatter: MONEY}}],
        })
        await createPivot.handler(
            {
                source: 'sales',
                rows: 'region',
                columns: 'quarter',
                measure: 'amt',
                extra_measures: [
                    {name: 'orders', func: 'COUNT', measure: 'amt'},
                ],
            },
            ctxFor(client)
        )
        expect(
            committed
                .filter((p) => p.type === 'upsertFieldRenderInfo')
                .map(
                    (p) =>
                        (p.value.styleUpdate as {setNumFmt: string}).setNumFmt
                )
        ).toEqual(['', MONEY, MONEY, ''])
    })
})

/**
 * `build__edit_pivot` — change the recipe in place.
 *
 * The contract that matters to a model is "what you omit is unchanged": an
 * agent editing one thing must not silently reset the rest, because a pivot
 * whose filters quietly vanished still looks perfectly correct.
 */
describe('build__edit_pivot', () => {
    it('keeps every part of the recipe the caller did not mention', async () => {
        const {client, committed} = clientWith({
            withPivotBlock: true,
            pivotRecipe: {
                ...PIVOT_RECIPE,
                order: 'custom',
                orderValues: ['South', 'East'],
                filters: [{field: 'region', criteria: '<>North'}],
            },
        })
        await editPivot.handler(
            {name: 'sales_pivot', func: 'AVERAGE'},
            ctxFor(client)
        )
        const set = committed.find((p) => p.type === 'setBlockAnalyzes')!
        expect(set.value.pivot).toEqual({
            rowDim: 'region',
            colDim: 'quarter',
            measure: 'amt',
            // The one thing asked for.
            func: 'AVERAGE',
            order: 'custom',
            orderValues: ['South', 'East'],
            filters: [{field: 'region', criteria: '<>North'}],
        })
    })

    it('drops the columns when asked, turning a cross-tab into a group-by', async () => {
        // `columns` needs three states, and null is the one that means "no
        // longer cross-tabulated" as opposed to "leave it alone".
        const {client, committed} = clientWith({withPivotBlock: true})
        await editPivot.handler(
            {name: 'sales_pivot', columns: null},
            ctxFor(client)
        )
        const set = committed.find((p) => p.type === 'setBlockAnalyzes')!
        expect((set.value.pivot as {colDim?: string}).colDim).toBeUndefined()
    })

    it('clears the filters on an empty array, rather than reading it as absent', async () => {
        const {client, committed} = clientWith({
            withPivotBlock: true,
            pivotRecipe: {
                ...PIVOT_RECIPE,
                filters: [{field: 'region', criteria: '<>North'}],
            },
        })
        await editPivot.handler(
            {name: 'sales_pivot', filters: []},
            ctxFor(client)
        )
        const set = committed.find((p) => p.type === 'setBlockAnalyzes')!
        expect((set.value.pivot as {filters: unknown[]}).filters).toEqual([])
    })

    it('carries the declared columns through an edit that does not mention them', async () => {
        // A row total is not derived from the data, so an edit has no business
        // dropping it — the same rule a refresh follows.
        const {client, committed} = clientWith({
            withPivotBlock: true,
            extraPivotFields: [
                {
                    field: 'Total',
                    idx: 3,
                    renderId: 'p3',
                    writePolicy: 'inherit',
                    pivotColValue: '*',
                },
            ],
        })
        await editPivot.handler(
            {name: 'sales_pivot', measure: 'amt', func: 'COUNT'},
            ctxFor(client)
        )
        const bind = committed.find((p) => p.type === 'bindFormSchema')!
        const total = (
            bind.value.fields as Array<{name: string; pivotColValue?: string}>
        ).find((f) => f.name === 'Total')
        expect(total?.pivotColValue).toBe('*')
    })

    it('refuses a field the source does not have, before changing anything', async () => {
        const {client, committed} = clientWith({withPivotBlock: true})
        await expect(
            editPivot.handler(
                {name: 'sales_pivot', rows: 'nope'},
                ctxFor(client)
            )
        ).rejects.toThrow(/no field named "nope"/)
        expect(committed).toEqual([])
    })

    it('refuses a block that is not a pivot', async () => {
        const {client} = clientWith()
        await expect(
            editPivot.handler({name: 'sales', func: 'COUNT'}, ctxFor(client))
        ).rejects.toThrow(/not a pivot/)
    })
})

describe('COUNTA through the tools', () => {
    it('is offered as an aggregate and reaches the recipe', async () => {
        const {client, committed} = clientWith()
        await createPivot.handler(
            {
                source: 'sales',
                rows: 'region',
                columns: 'quarter',
                measure: 'amt',
                func: 'COUNTA',
            },
            ctxFor(client)
        )
        const create = committed.find((p) => p.type === 'createBlock')!
        expect((create.value.pivot as {func: string}).func).toBe('COUNTA')
    })

    it('is in the schema the model reads, so it knows the option exists', () => {
        const func = createPivot.inputSchema.properties!.func as {
            enum: string[]
        }
        expect(func.enum).toContain('COUNTA')
    })

    it('can be switched to by an edit', async () => {
        const {client, committed} = clientWith({withPivotBlock: true})
        await editPivot.handler(
            {name: 'sales_pivot', func: 'COUNTA'},
            ctxFor(client)
        )
        const set = committed.find((p) => p.type === 'setBlockAnalyzes')!
        expect((set.value.pivot as {func: string}).func).toBe('COUNTA')
    })
})

/**
 * `describe_block` says whether a pivot survives a save to .xlsx.
 *
 * The saver already decides this on every write, and used to be the only one
 * who knew. An agent could therefore build a pivot for someone who works in
 * Excel and have the file degrade silently to a grid of numbers — right
 * numbers, no pivot object, nothing recomputable.
 */
describe('build__describe_block reports Excel expressibility', () => {
    it('says nothing when the pivot maps exactly', async () => {
        const {client} = clientWith({withPivotBlock: true})
        const d = await describeBlock.handler(
            {name: 'sales_pivot'},
            ctxFor(client)
        )
        expect(d.data.pivot_excel_note).toBeUndefined()
    })

    it('names the part that does not map, and what to do instead', async () => {
        const {client} = clientWith({
            withPivotBlock: true,
            excelReason:
                "it filters records by condition, and Excel's pivot filters select items from a list. Drop the filters.",
        })
        const d = await describeBlock.handler(
            {name: 'sales_pivot'},
            ctxFor(client)
        )
        expect(d.data.pivot_excel_note).toContain(
            'filters records by condition'
        )
        expect(d.data.pivot_excel_note).toContain('still right')
    })

    it('survives a host that does not have the call at all', async () => {
        // A read-only report should not fail because one optional RPC is
        // missing — an older host simply says nothing about Excel.
        const {client} = clientWith({withPivotBlock: true})
        delete (client as unknown as Record<string, unknown>).pivotExcelNote
        const d = await describeBlock.handler(
            {name: 'sales_pivot'},
            ctxFor(client)
        )
        expect(d.data.pivot_excel_note).toBeUndefined()
        expect(d.data.pivot).toBeDefined()
    })
})
