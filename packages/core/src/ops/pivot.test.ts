import {describe, expect, it} from 'vitest'
import type {Client} from '../port.js'
import {WorkbookOps, aggregateKeepsFormat, type PivotSource} from './index.js'

/**
 * `createPivot` and `refreshPivot` send DECLARATIONS and a payload order that
 * is not negotiable — see design/block-pivot.md §6. What the engine does with
 * them is covered in crates/controller and end to end in packages/node; what
 * only this level can check is that the sequence is right, because getting it
 * wrong fails silently: a key written after the bind leaves that row filtering
 * on `""`, and the whole grid reads 0 with no error anywhere.
 */

type Committed = Array<{type: string; value: Record<string, unknown>}>

function opsWith(plan: Record<string, unknown>): {
    ops: WorkbookOps
    committed: Committed
    asked: Array<{method: string; params: unknown}>
} {
    const committed: Committed = []
    const asked: Array<{method: string; params: unknown}> = []
    const client = {
        pivotPlanFor: async (params: unknown) => {
            asked.push({method: 'pivotPlanFor', params})
            return plan
        },
        pivotPlan: async (params: unknown) => {
            asked.push({method: 'pivotPlan', params})
            return plan
        },
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
    return {ops: new WorkbookOps(client), committed, asked}
}

const FRESH = {
    keys: ['East', 'North', 'South'],
    fields: ['Q1', 'Q2'],
    currentKeys: [],
    currentFields: [],
    missingKeys: ['East', 'North', 'South'],
    missingFields: ['Q1', 'Q2'],
    extraKeys: [],
    extraFields: [],
    unassignedRecords: 0,
    isStale: true,
}

const SALES: PivotSource = {
    sheetIdx: 0,
    blockId: 3,
    refName: 'sales',
    rowStart: 0,
    rowCnt: 6,
    colStart: 0,
}

async function create(plan: Record<string, unknown>, extra = {}) {
    const {ops, committed, asked} = opsWith(plan)
    const result = await ops.createPivot({
        source: SALES,
        blockId: 9,
        refName: 'sales_pivot',
        rowDim: 'region',
        colDim: 'quarter',
        measure: 'amt',
        func: 'SUM',
        ...extra,
    })
    return {committed, asked, result}
}

describe('WorkbookOps.createPivot', () => {
    it('asks the engine for the shape BEFORE creating anything', async () => {
        // This is what makes creation one transaction and therefore one undo.
        // Creating first and reshaping after would leave an empty declared
        // pivot as an intermediate state.
        const {asked, committed} = await create(FRESH)
        expect(asked).toEqual([
            {
                method: 'pivotPlanFor',
                params: {
                    sheetIdx: 0,
                    sourceBlock: 3,
                    spec: {
                        rowDim: 'region',
                        colDim: 'quarter',
                        measure: 'amt',
                        func: 'SUM',
                        order: 'ascending',
                        // Always stated, so the plan and the cells cannot
                        // disagree about what is counted or in what order.
                        orderValues: [],
                        filters: [],
                    },
                },
            },
        ])
        expect(committed.length).toBeGreaterThan(0)
    })

    it('sends the keys BEFORE the bind', async () => {
        // The order that fails silently if reversed: `#KEY` is captured when
        // the bind materializes each row, so a key written afterwards leaves
        // that row filtering on the empty string.
        const {committed} = await create(FRESH)
        const types = committed.map((p) => p.type)
        expect(types).toEqual([
            'insertRows',
            'createBlock',
            'cellInput',
            'cellInput',
            'cellInput',
            'bindFormSchema',
            // Formats last: they attach to the render ids the bind declares.
            'upsertFieldRenderInfo',
            'upsertFieldRenderInfo',
            'upsertFieldRenderInfo',
        ])
        expect(types.lastIndexOf('cellInput')).toBeLessThan(
            types.indexOf('bindFormSchema')
        )
    })

    it('creates the block at the size the plan says, with the recipe on it', async () => {
        const {committed} = await create(FRESH)
        expect(committed[0].value).toMatchObject({start: 6, count: 3})
        expect(committed[1].value).toMatchObject({
            masterRow: 6,
            rowCnt: 3,
            // key column + one per column-dimension value
            colCnt: 3,
            analyzes: 3,
            pivot: {rowDim: 'region', colDim: 'quarter', func: 'SUM'},
        })
    })

    it('writes each group into the key column, in the plan order', async () => {
        const {committed} = await create(FRESH)
        const keys = committed.filter((p) => p.type === 'cellInput')
        expect(keys.map((p) => [p.value.row, p.value.content])).toEqual([
            [6, 'East'],
            [7, 'North'],
            [8, 'South'],
        ])
        expect(keys.every((p) => p.value.col === 0)).toBe(true)
    })

    it('names the columns after the dimension values, and declares nothing per field', async () => {
        // A pivot's field names ARE the column dimension's values; the engine
        // derives each cell from that plus `#KEY`. A per-field aggregate here
        // would be refused by the engine, and rightly.
        const {committed} = await create(FRESH)
        const bind = committed.find((p) => p.type === 'bindFormSchema')!
        const fields = (bind.value as {fields: Array<Record<string, unknown>>})
            .fields
        expect(fields.map((f) => f.name)).toEqual(['region', 'Q1', 'Q2'])
        expect(
            fields.every(
                (f) => f.valueFormula === undefined && f.aggFunc === undefined
            )
        ).toBe(true)
    })

    it('gives a grouped pivot one value column named after the measure', async () => {
        // `colDim` omitted: the plan returns no fields, because the single
        // column's name means nothing to the lowering.
        const {committed, result} = await create(
            {...FRESH, fields: [], missingFields: []},
            {colDim: undefined}
        )
        const bind = committed.find((p) => p.type === 'bindFormSchema')!
        const fields = (bind.value as {fields: Array<Record<string, unknown>>})
            .fields
        expect(fields.map((f) => f.name)).toEqual(['region', 'amt'])
        expect(result.fields).toEqual(['amt'])
        // The key is ABSENT, not present-and-undefined: `colDim` is an
        // `Option` on the wire, which deserializes from a missing field.
        expect(
            'colDim' in (committed[1].value.pivot as Record<string, unknown>)
        ).toBe(false)
        expect(committed[1].value).toMatchObject({
            colCnt: 2,
        })
    })

    it('refuses when no record has a value for the row dimension', async () => {
        // A zero-row pivot is not a pivot, and creating one would leave a
        // block nobody can read or refresh into anything.
        const {ops, committed} = opsWith({
            ...FRESH,
            keys: [],
            missingKeys: [],
        })
        await expect(
            ops.createPivot({
                source: SALES,
                blockId: 9,
                refName: 'sales_pivot',
                rowDim: 'region',
                measure: 'amt',
                func: 'SUM',
            })
        ).rejects.toThrow(/no record .* has a value for "region"/)
        expect(committed).toEqual([])
    })

    it('reports records that belong to no group', async () => {
        const {result} = await create({...FRESH, unassignedRecords: 2})
        expect(result.unassignedRecords).toBe(2)
    })
})

describe('WorkbookOps.refreshPivot', () => {
    const target = {
        sheetIdx: 0,
        blockId: 9,
        refName: 'sales_pivot',
        keyField: 'region',
        rowStart: 10,
        colStart: 0,
    }

    it('does nothing, and says so, when the pivot is already current', async () => {
        // So a caller can report "nothing to do" rather than an empty refresh.
        const {ops, committed} = opsWith({...FRESH, isStale: false})
        expect(await ops.refreshPivot(target)).toBeNull()
        expect(committed).toEqual([])
    })

    it('grows, writes the keys, binds — in that order', async () => {
        const {ops, committed} = opsWith({
            keys: ['East', 'North', 'South', 'Northwest'],
            fields: ['Q1', 'Q2'],
            currentKeys: ['East', 'South', 'North'],
            currentFields: ['Q1', 'Q2'],
            missingKeys: ['Northwest'],
            missingFields: [],
            extraKeys: [],
            extraFields: [],
            unassignedRecords: 0,
            isStale: true,
        })
        const changed = await ops.refreshPivot(target)

        const types = committed.map((p) => p.type)
        expect(types[0]).toBe('resizeBlock')
        expect(types.lastIndexOf('cellInput')).toBeLessThan(
            types.indexOf('bindFormSchema')
        )
        // The grow leaves room for every key before the bind materializes.
        expect(committed[0].value).toMatchObject({newRowCnt: 4, newColCnt: 3})
        expect(changed).toMatchObject({
            addedKeys: ['Northwest'],
            removedKeys: [],
        })
    })

    it('resizes BEFORE binding, even when shrinking', async () => {
        const {ops, committed} = opsWith({
            keys: ['East', 'South'],
            fields: ['Q1'],
            currentKeys: ['East', 'South', 'North'],
            currentFields: ['Q1', 'Q2'],
            missingKeys: [],
            missingFields: [],
            extraKeys: ['North'],
            extraFields: ['Q2'],
            unassignedRecords: 0,
            isStale: true,
        })
        const changed = await ops.refreshPivot(target)

        const types = committed.map((p) => p.type)
        // ONE resize, straight to the final size, ahead of the bind.
        //
        // This used to bind first and shrink after, on the reasoning that a
        // column should be unbound before it vanishes. Against the real engine
        // that loses the answers: a resize sent AFTER a bind leaves the
        // generated formulas uncalculated, so a refresh that dropped a group
        // left every surviving row blank — see the node test 'drops a group
        // the source no longer has'. Nothing is orphaned by resizing first,
        // because the bind that follows names the surviving fields and only
        // those.
        expect(types.filter((t) => t === 'resizeBlock')).toHaveLength(1)
        expect(types.indexOf('resizeBlock')).toBeLessThan(
            types.indexOf('bindFormSchema')
        )
        expect(committed[0]).toMatchObject({
            type: 'resizeBlock',
            value: {newRowCnt: 2, newColCnt: 2},
        })
        expect(changed).toMatchObject({
            removedKeys: ['North'],
            removedFields: ['Q2'],
        })
    })

    it('keeps a grouped pivot its existing value column', async () => {
        // A grouped pivot plans no columns, so a refresh must not read that as
        // "it should have none" and drop the one column it has.
        const {ops, committed} = opsWith({
            keys: ['East', 'Northwest'],
            fields: [],
            currentKeys: ['East'],
            currentFields: ['amt'],
            missingKeys: ['Northwest'],
            missingFields: [],
            extraKeys: [],
            extraFields: [],
            unassignedRecords: 0,
            isStale: true,
        })
        await ops.refreshPivot(target)
        const bind = committed.find((p) => p.type === 'bindFormSchema')!
        const fields = (bind.value as {fields: Array<Record<string, unknown>>})
            .fields
        expect(fields.map((f) => f.name)).toEqual(['region', 'amt'])
    })

    it('writes the keys at the block’s own rows', async () => {
        const {ops, committed} = opsWith({
            keys: ['a', 'b'],
            fields: ['Q1'],
            currentKeys: ['a'],
            currentFields: ['Q1'],
            missingKeys: ['b'],
            missingFields: [],
            extraKeys: [],
            extraFields: [],
            unassignedRecords: 0,
            isStale: true,
        })
        await ops.refreshPivot({...target, rowStart: 42, colStart: 3})
        const keys = committed.filter((p) => p.type === 'cellInput')
        expect(
            keys.map((p) => [p.value.row, p.value.col, p.value.content])
        ).toEqual([
            [42, 3, 'a'],
            [43, 3, 'b'],
        ])
    })
})

describe('WorkbookOps.createPivot — beyond a plain cross-tab', () => {
    it('appends a row total after the derived columns, filtering on every value', async () => {
        const {ops, committed} = opsWith(FRESH)
        await ops.createPivot({
            source: SALES,
            blockId: 9,
            refName: 'p',
            rowDim: 'region',
            colDim: 'quarter',
            measure: 'amt',
            func: 'SUM',
            extraColumns: [{name: 'Total', colValue: null}],
        })
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
        ])
        // `*` is what the engine reads as "every value of the column
        // dimension" — the same wildcard BLOCKREF already uses.
        expect(fields[3]).toMatchObject({pivotColValue: '*'})
        // The derived columns say nothing, so the engine reads their names as
        // the dimension value.
        expect(fields[1].pivotColValue).toBeUndefined()
    })

    it('carries a second measure with its own function', async () => {
        const {ops, committed} = opsWith(FRESH)
        await ops.createPivot({
            source: SALES,
            blockId: 9,
            refName: 'p',
            rowDim: 'region',
            colDim: 'quarter',
            measure: 'amt',
            func: 'SUM',
            extraColumns: [
                {
                    name: 'Q1 Orders',
                    colValue: 'Q1',
                    func: 'COUNT',
                    measure: 'amt',
                },
            ],
        })
        const fields = (
            committed.find((p) => p.type === 'bindFormSchema')!.value as {
                fields: Array<Record<string, unknown>>
            }
        ).fields
        expect(fields[3]).toMatchObject({
            name: 'Q1 Orders',
            pivotColValue: 'Q1',
            pivotFunc: 'COUNT',
            pivotMeasure: 'amt',
        })
    })

    it('sends the order and the filters as part of the recipe', async () => {
        const {ops, committed, asked} = opsWith(FRESH)
        await ops.createPivot({
            source: SALES,
            blockId: 9,
            refName: 'p',
            rowDim: 'region',
            measure: 'amt',
            func: 'SUM',
            order: 'custom',
            orderValues: ['North', 'East'],
            filters: [{field: 'quarter', criteria: 'Q1'}],
        })
        // The plan has to see them too, or the rows it returns would not match
        // the numbers the cells compute.
        expect(asked[0].params).toMatchObject({
            spec: {
                order: 'custom',
                orderValues: ['North', 'East'],
                filters: [{field: 'quarter', criteria: 'Q1'}],
            },
        })
        expect(committed[1].value).toMatchObject({
            pivot: {order: 'custom', filters: [{field: 'quarter'}]},
        })
    })
})

describe('WorkbookOps.refreshPivot — declared columns', () => {
    it('restates a declared column instead of rewriting it as derived', async () => {
        // The bug this prevents is silent: re-binding Total as an ordinary
        // column would make it filter on the literal value "Total", which
        // matches nothing, so the total would read 0 forever after a refresh.
        const {ops, committed} = opsWith({
            keys: ['East', 'Northwest'],
            fields: ['Q1', 'Total'],
            currentKeys: ['East'],
            currentFields: ['Q1', 'Total'],
            missingKeys: ['Northwest'],
            missingFields: [],
            extraKeys: [],
            extraFields: [],
            unassignedRecords: 0,
            isStale: true,
        })
        await ops.refreshPivot({
            sheetIdx: 0,
            blockId: 9,
            refName: 'p',
            keyField: 'region',
            rowStart: 10,
            colStart: 0,
            currentFields: [
                {field: 'region'},
                {field: 'Q1'},
                {field: 'Total', pivotColValue: '*'},
            ],
        })
        const fields = (
            committed.find((p) => p.type === 'bindFormSchema')!.value as {
                fields: Array<Record<string, unknown>>
            }
        ).fields
        expect(fields.map((f) => f.name)).toEqual(['region', 'Q1', 'Total'])
        expect(fields[2]).toMatchObject({pivotColValue: '*'})
        expect(fields[1].pivotColValue).toBeUndefined()
    })
})

/**
 * A pivot cell is an aggregate of one SOURCE column, so it is measured in that
 * column's units: a SUM of currency is currency. Without this the pivot of a
 * money table arrives as bare numbers beside a source that reads "$1,200" —
 * the numbers are right and the table looks wrong, which is the failure mode
 * this whole design keeps trying to avoid.
 */
describe('a pivot inherits its source number formats', () => {
    const MONEY = {...SALES, numFmts: {amt: '$#,##0.00', region: undefined}}

    const fmts = (committed: Committed) =>
        committed
            .filter((p) => p.type === 'upsertFieldRenderInfo')
            .map((p) => [
                p.value.renderId,
                (p.value.styleUpdate as {setNumFmt: string}).setNumFmt,
            ])

    it('formats every derived column like the measure, and the key like its own field', async () => {
        const {ops, committed} = opsWith(FRESH)
        await ops.createPivot({
            source: MONEY,
            blockId: 9,
            refName: 'p',
            rowDim: 'region',
            colDim: 'quarter',
            measure: 'amt',
            func: 'SUM',
        })
        expect(fmts(committed)).toEqual([
            // The key column holds region values, which carry no format.
            ['p__p0', ''],
            ['p__p1', '$#,##0.00'],
            ['p__p2', '$#,##0.00'],
        ])
    })

    it('leaves a COUNT plain — it counts records, not money', async () => {
        const {ops, committed} = opsWith(FRESH)
        await ops.createPivot({
            source: MONEY,
            blockId: 9,
            refName: 'p',
            rowDim: 'region',
            colDim: 'quarter',
            measure: 'amt',
            func: 'SUM',
            extraColumns: [
                {name: 'Total', colValue: null},
                {name: 'Orders', colValue: null, func: 'COUNT', measure: 'amt'},
            ],
        })
        expect(fmts(committed)).toEqual([
            ['p__p0', ''],
            ['p__p1', '$#,##0.00'],
            ['p__p2', '$#,##0.00'],
            // A row total is still a sum of the measure.
            ['p__p3', '$#,##0.00'],
            // A count of orders is a number of orders.
            ['p__p4', ''],
        ])
    })

    it('sends nothing at all when the caller supplies no formats', async () => {
        const {committed} = await create(FRESH)
        expect(
            committed.filter((p) => p.type === 'upsertFieldRenderInfo')
        ).toEqual([
            // Still emitted, but empty: this is also how a format is cleared,
            // and an unformatted pivot must not inherit a stale one.
            {
                type: 'upsertFieldRenderInfo',
                value: {
                    renderId: 'sales_pivot__p0',
                    diyRender: false,
                    styleUpdate: {setNumFmt: ''},
                },
            },
            {
                type: 'upsertFieldRenderInfo',
                value: {
                    renderId: 'sales_pivot__p1',
                    diyRender: false,
                    styleUpdate: {setNumFmt: ''},
                },
            },
            {
                type: 'upsertFieldRenderInfo',
                value: {
                    renderId: 'sales_pivot__p2',
                    diyRender: false,
                    styleUpdate: {setNumFmt: ''},
                },
            },
        ])
    })

    it('restates EVERY column on a refresh, because render ids shift', async () => {
        // Render ids are assigned by position. A column that appears ahead of
        // the others moves every id after it, so formats keyed by id would
        // stay behind on the wrong column. Restating all of them is what keeps
        // each format with its column.
        const {ops, committed} = opsWith({
            ...FRESH,
            keys: ['East'],
            fields: ['Q0', 'Q1', 'Q2'],
            currentKeys: ['East'],
            currentFields: ['Q1', 'Q2'],
            missingKeys: [],
            missingFields: ['Q0'],
            isStale: true,
        })
        await ops.refreshPivot({
            sheetIdx: 0,
            blockId: 9,
            refName: 'p',
            keyField: 'region',
            rowStart: 7,
            colStart: 0,
            formats: {numFmts: {amt: '$#,##0.00'}, measure: 'amt', func: 'SUM'},
        })
        expect(fmts(committed)).toEqual([
            ['p__p0', ''],
            ['p__p1', '$#,##0.00'],
            ['p__p2', '$#,##0.00'],
            ['p__p3', '$#,##0.00'],
        ])
    })

    it('formats nothing on a refresh when the caller supplies no formats', async () => {
        const {ops, committed} = opsWith({
            ...FRESH,
            currentKeys: ['East'],
            currentFields: ['Q1'],
        })
        await ops.refreshPivot({
            sheetIdx: 0,
            blockId: 9,
            refName: 'p',
            keyField: 'region',
            rowStart: 7,
            colStart: 0,
        })
        expect(
            committed.filter((p) => p.type === 'upsertFieldRenderInfo')
        ).toEqual([])
    })
})

/**
 * `editPivot` changes the RECIPE and reshapes to match. Two orderings decide
 * whether it works, and both fail silently when wrong: the recipe must precede
 * the bind (the bind is what regenerates every cell from it), and the resize
 * must precede the bind too (a resize after a bind leaves the generated
 * formulas uncalculated).
 */
describe('WorkbookOps.editPivot', () => {
    const target = {
        sheetIdx: 0,
        blockId: 9,
        refName: 'p',
        source: SALES,
        rowStart: 6,
        colStart: 0,
        currentRowCnt: 3,
        currentColCnt: 3,
        rowDim: 'region',
        colDim: 'quarter',
        measure: 'amt',
        func: 'SUM' as const,
    }

    it('plans the NEW recipe against the source, not the old one', async () => {
        // The commonest reason to edit is that the old recipe no longer
        // resolves, so planning it is exactly what cannot be relied on.
        const {ops, asked} = opsWith(FRESH)
        await ops.editPivot({...target, measure: 'value'})
        expect(asked.map((a) => a.method)).toEqual(['pivotPlanFor'])
        expect(asked[0].params).toMatchObject({
            sourceBlock: 3,
            spec: {measure: 'value'},
        })
    })

    it('sets the recipe and the keys BEFORE the bind that regenerates from them', async () => {
        const {ops, committed} = opsWith(FRESH)
        await ops.editPivot(target)
        const types = committed.map((p) => p.type)
        expect(types.indexOf('setBlockAnalyzes')).toBeLessThan(
            types.indexOf('bindFormSchema')
        )
        expect(types.lastIndexOf('cellInput')).toBeLessThan(
            types.indexOf('bindFormSchema')
        )
        expect(types.indexOf('resizeBlock')).toBeLessThan(
            types.indexOf('bindFormSchema')
        )
    })

    it('states the whole recipe, so nothing carries over from the old one', async () => {
        const {ops, committed} = opsWith(FRESH)
        await ops.editPivot({...target, func: 'COUNT', order: 'firstSeen'})
        const set = committed.find((p) => p.type === 'setBlockAnalyzes')!
        expect(set.value).toEqual({
            sheetIdx: 0,
            blockId: 9,
            analyzes: 3,
            pivot: {
                rowDim: 'region',
                colDim: 'quarter',
                measure: 'amt',
                func: 'COUNT',
                order: 'firstSeen',
                orderValues: [],
                filters: [],
            },
        })
    })

    it('renames the key column when the row dimension changes', async () => {
        const {ops, committed} = opsWith(FRESH)
        await ops.editPivot({...target, rowDim: 'quarter'})
        const bind = committed.find((p) => p.type === 'bindFormSchema')!
        expect(
            (bind.value.fields as Array<{name: string}>).map((f) => f.name)
        ).toEqual(['quarter', 'Q1', 'Q2'])
    })

    it('resizes once, to the final size, whichever way it moves', async () => {
        const {ops, committed} = opsWith(FRESH) // 3 keys, 2 fields => 3x3
        await ops.editPivot({...target, currentRowCnt: 8, currentColCnt: 9})
        const resizes = committed.filter((p) => p.type === 'resizeBlock')
        expect(resizes).toHaveLength(1)
        expect(resizes[0].value).toMatchObject({newRowCnt: 3, newColCnt: 3})
    })

    it('does not resize at all when the shape is unchanged', async () => {
        const {ops, committed} = opsWith(FRESH)
        await ops.editPivot({...target, func: 'AVERAGE'})
        expect(committed.filter((p) => p.type === 'resizeBlock')).toEqual([])
    })

    it('refuses a recipe that would leave no rows, before changing anything', async () => {
        const {ops, committed} = opsWith({...FRESH, keys: []})
        await expect(
            ops.editPivot({...target, rowDim: 'nothing'})
        ).rejects.toThrow(/Nothing to pivot/)
        expect(committed).toEqual([])
    })
})

describe('COUNTA', () => {
    // COUNTA answers "how many of these are filled in", which no other
    // aggregate can: COUNT counts a group's records whether or not the measure
    // is there, and SUM of a gappy column says nothing about the gaps.
    it('is left unformatted, like COUNT — it counts, it is not money', () => {
        expect(aggregateKeepsFormat('COUNTA')).toBe(false)
        expect(aggregateKeepsFormat('COUNT')).toBe(false)
        expect(aggregateKeepsFormat('SUM')).toBe(true)
        expect(aggregateKeepsFormat('AVERAGE')).toBe(true)
        expect(aggregateKeepsFormat('MIN')).toBe(true)
        expect(aggregateKeepsFormat('MAX')).toBe(true)
    })

    it('reaches the engine as the recipe, and its columns stay plain', async () => {
        const {ops, committed} = opsWith(FRESH)
        await ops.createPivot({
            source: {...SALES, numFmts: {amt: '$#,##0.00'}},
            blockId: 9,
            refName: 'p',
            rowDim: 'region',
            colDim: 'quarter',
            measure: 'amt',
            func: 'COUNTA',
        })
        expect((committed[1].value.pivot as {func: string}).func).toBe('COUNTA')
        expect(
            committed
                .filter((p) => p.type === 'upsertFieldRenderInfo')
                .map(
                    (p) =>
                        (p.value.styleUpdate as {setNumFmt: string}).setNumFmt
                )
        ).toEqual(['', '', ''])
    })
})
