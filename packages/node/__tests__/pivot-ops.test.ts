/**
 * `WorkbookOps.createPivot` / `refreshPivot` against the REAL engine.
 *
 * The unit tests in logisheets-core prove those methods emit a particular
 * payload sequence; the engine tests prove the engine computes correctly. This
 * closes the gap between them — that the exact payloads the ops send are
 * accepted and produce the right numbers. It matters more than usual here
 * because the sequence's failure mode is silent: keys after the bind, or a
 * bind before a grow, and the grid reads 0 with no error anywhere.
 *
 * The tools (`build__create_pivot` / `build__refresh_pivot`) go through these
 * same two methods, so this covers them too.
 */
import {describe, it, expect, beforeEach} from 'vitest'
import {WorkbookOps} from 'logisheets-core'
import type {Client} from 'logisheets-web/pure'
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

/**
 * The smallest Client that `WorkbookOps` needs for pivots — which is also
 * exactly what a headless host provides: a transaction sink and the two
 * read-only planning calls.
 */
function clientFor(bookId: number): Client {
    return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        handleTransaction: async (p: any) =>
            rpc('handleTransaction', p, bookId),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pivotPlan: async (p: any) => rpc('pivotPlan', p, bookId),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pivotPlanFor: async (p: any) => rpc('pivotPlanFor', p, bookId),
    } as unknown as Client
}

function num(bookId: number, row: number, col: number): number | undefined {
    const v = rpc('getValue', {sheetIdx: 0, row, col}, bookId) as
        | {type: string; value: number}
        | string
    return typeof v === 'object' && v.type === 'number' ? v.value : undefined
}

function str(bookId: number, row: number, col: number): string | undefined {
    const v = rpc('getValue', {sheetIdx: 0, row, col}, bookId) as
        | {type: string; value: string}
        | string
    return typeof v === 'object' && v.type === 'str' ? v.value : undefined
}

const SALES: ReadonlyArray<readonly [string, string, string, string]> = [
    ['o0', 'East', 'Q1', '10'],
    ['o1', 'East', 'Q2', '20'],
    ['o2', 'South', 'Q1', '3'],
    ['o3', 'South', 'Q1', '4'],
    ['o4', 'South', 'Q2', '5'],
    ['o5', 'North', 'Q1', '7'],
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
                                    name: 'amt',
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

function addSale(bookId: number, src: number, at: number, row: string[]) {
    const eff = rpc(
        'handleTransaction',
        {
            transaction: {
                payloads: [
                    // The sheet insert FIRST. `insertRowsInBlock` alone grows
                    // the block into whatever sits below it — and a pivot is
                    // placed directly below its source, so skipping this
                    // overwrites the pivot's first row.
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

describe('WorkbookOps pivots against the real engine', () => {
    let bookId: number
    let src: number
    let ops: WorkbookOps

    beforeEach(() => {
        bookId = rpc('newWorkbook') as number
        src = salesBlock(bookId)
        ops = new WorkbookOps(clientFor(bookId))
    })

    const source = () => ({
        sheetIdx: 0,
        blockId: src,
        refName: 'sales',
        rowStart: 0,
        rowCnt: SALES.length,
        colStart: 0,
    })

    // An explicit `null` for "no column dimension" — a default parameter
    // would swallow a passed `undefined` and silently keep 'quarter'.
    async function create(colDim: string | null = 'quarter') {
        const pivotId = rpc(
            'getAvailableBlockId',
            {sheetIdx: 0},
            bookId
        ) as number
        const made = await ops.createPivot({
            source: source(),
            blockId: pivotId,
            refName: 'sales_pivot',
            rowDim: 'region',
            colDim: colDim ?? undefined,
            measure: 'amt',
            func: 'SUM',
        })
        return {pivotId, made}
    }

    it('creates a pivot that computes, in one transaction', async () => {
        const {made} = await create()
        expect(made.keys).toEqual(['East', 'North', 'South'])
        expect(made.fields).toEqual(['Q1', 'Q2'])

        // Placed directly below the source, sorted, and computing.
        expect(str(bookId, 6, 0)).toBe('East')
        expect(num(bookId, 6, 1)).toBe(10) // East Q1
        expect(num(bookId, 6, 2)).toBe(20) // East Q2
        expect(str(bookId, 7, 0)).toBe('North')
        expect(num(bookId, 7, 1)).toBe(7)
        expect(num(bookId, 7, 2)).toBe(0) // no Q2 records
        expect(str(bookId, 8, 0)).toBe('South')
        expect(num(bookId, 8, 1)).toBe(7) // 3 + 4

        // ONE undo removes the whole thing — the property that made
        // `pivotPlanFor` worth adding.
        expect(rpc('undo', undefined, bookId)).toBe(true)
        const blocks = rpc('getAllBlocks', {}, bookId) as Array<{
            blockId: number
        }>
        expect(blocks.map((b) => b.blockId)).toEqual([src])
    })

    it('creates a grouped pivot with one value column', async () => {
        const {made} = await create(null)
        expect(made.fields).toEqual(['amt'])
        expect(num(bookId, 6, 1)).toBe(30) // East = 10 + 20
        expect(num(bookId, 7, 1)).toBe(7) // North
        expect(num(bookId, 8, 1)).toBe(12) // South = 3 + 4 + 5
    })

    it('refreshes a pivot that has fallen behind, and the new group computes', async () => {
        const {pivotId} = await create()
        addSale(bookId, src, 6, ['o6', 'Northwest', 'Q1', '99'])

        const changed = await ops.refreshPivot({
            sheetIdx: 0,
            blockId: pivotId,
            refName: 'sales_pivot',
            keyField: 'region',
            // The source grew by a row, so the pivot moved down with it.
            rowStart: 7,
            colStart: 0,
        })
        expect(changed).not.toBeNull()
        expect(changed!.addedKeys).toEqual(['Northwest'])

        // East / North / Northwest / South, sorted, all computing.
        expect(num(bookId, 7, 1)).toBe(10)
        expect(num(bookId, 8, 1)).toBe(7)
        expect(str(bookId, 9, 0)).toBe('Northwest')
        expect(num(bookId, 9, 1)).toBe(99)
        expect(num(bookId, 10, 1)).toBe(7)
    })

    it('adds a column when a new value of the column dimension appears', async () => {
        const {pivotId} = await create()
        addSale(bookId, src, 6, ['o6', 'East', 'Q3', '55'])

        const changed = await ops.refreshPivot({
            sheetIdx: 0,
            blockId: pivotId,
            refName: 'sales_pivot',
            keyField: 'region',
            rowStart: 7,
            colStart: 0,
        })
        expect(changed!.addedFields).toEqual(['Q3'])
        expect(num(bookId, 7, 3)).toBe(55) // East Q3
        expect(num(bookId, 8, 3)).toBe(0) // North Q3
    })

    it('drops a group the source no longer has', async () => {
        // The shrink half: bind before resize, or the resize orphans a schema
        // entry. This is the path `editFormBlock`'s v1 contract forbids.
        const {pivotId} = await create()
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
                                start: 5,
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

        const changed = await ops.refreshPivot({
            sheetIdx: 0,
            blockId: pivotId,
            refName: 'sales_pivot',
            keyField: 'region',
            // Still 6. `deleteRowsInBlock` shrinks the SOURCE but does not
            // pull the blocks below it up — only a sheet-level delete does
            // that — so the pivot has not moved.
            rowStart: 6,
            colStart: 0,
        })
        expect(changed!.removedKeys).toEqual(['North'])

        const blocks = rpc('getAllBlocks', {}, bookId) as Array<{
            blockId: number
            rowCnt: number
            schema?: {fields: Array<{field: string}>}
        }>
        const p = blocks.find((b) => b.blockId === pivotId)!
        expect(p.rowCnt).toBe(2)
        // The schema really lost the row — no orphaned entry.
        expect(p.schema!.fields.map((f) => f.field)).toEqual([
            'region',
            'Q1',
            'Q2',
        ])
        expect(str(bookId, 6, 0)).toBe('East')
        expect(str(bookId, 7, 0)).toBe('South')
        // And the surviving rows COMPUTE. Keys alone would not have caught it:
        // South slides up into the row North held, so only a VALUE says
        // whether the row was re-aimed or merely relabelled. Q2 is the column
        // that separates them — South is 5 where North was 0.
        expect(num(bookId, 6, 1)).toBe(10)
        expect(num(bookId, 7, 1)).toBe(7)
        expect(num(bookId, 7, 2)).toBe(5)
    })

    it('reports doing nothing when the pivot is already current', async () => {
        const {pivotId} = await create()
        const again = await ops.refreshPivot({
            sheetIdx: 0,
            blockId: pivotId,
            refName: 'sales_pivot',
            keyField: 'region',
            rowStart: 6,
            colStart: 0,
        })
        expect(again).toBeNull()
        // And nothing moved.
        expect(num(bookId, 6, 1)).toBe(10)
    })
})

describe('a pivot beyond a plain cross-tab, against the real engine', () => {
    let bookId: number
    let src: number
    let ops: WorkbookOps

    beforeEach(() => {
        bookId = rpc('newWorkbook') as number
        src = salesBlock(bookId)
        ops = new WorkbookOps(clientFor(bookId))
    })

    const source = () => ({
        sheetIdx: 0,
        blockId: src,
        refName: 'sales',
        rowStart: 0,
        rowCnt: SALES.length,
        colStart: 0,
    })

    it('totals each row across every column, and keeps doing so after a refresh', async () => {
        const pivotId = rpc(
            'getAvailableBlockId',
            {sheetIdx: 0},
            bookId
        ) as number
        await ops.createPivot({
            source: source(),
            blockId: pivotId,
            refName: 'p',
            rowDim: 'region',
            colDim: 'quarter',
            measure: 'amt',
            func: 'SUM',
            extraColumns: [{name: 'Total', colValue: null}],
        })
        // East / North / South, columns Q1, Q2, Total.
        expect(num(bookId, 6, 3)).toBe(30) // East 10 + 20
        expect(num(bookId, 7, 3)).toBe(7) // North, Q1 only
        expect(num(bookId, 8, 3)).toBe(12) // South 3 + 4 + 5

        // A new group arrives; the refresh must add its row AND leave the
        // total column meaning what it meant.
        addSale(bookId, src, 6, ['o6', 'Northwest', 'Q1', '99'])
        const blocks = rpc('getAllBlocks', {}, bookId) as Array<{
            blockId: number
            rowStart: number
            colStart: number
            schema?: {fields: Array<{field: string; pivotColValue?: string}>}
        }>
        const p = blocks.find((b) => b.blockId === pivotId)!
        const changed = await ops.refreshPivot({
            sheetIdx: 0,
            blockId: pivotId,
            refName: 'p',
            keyField: 'region',
            rowStart: p.rowStart,
            colStart: p.colStart,
            currentFields: p.schema!.fields,
        })
        expect(changed!.addedKeys).toEqual(['Northwest'])
        // If the total column had been rewritten as a derived one it would
        // filter on the literal "Total" and read 0 for every row.
        expect(num(bookId, 7, 3)).toBe(30) // East, moved down a row
        expect(num(bookId, 9, 3)).toBe(99) // Northwest, the new group
    })

    it('shows a second measure beside the first', async () => {
        const pivotId = rpc(
            'getAvailableBlockId',
            {sheetIdx: 0},
            bookId
        ) as number
        await ops.createPivot({
            source: source(),
            blockId: pivotId,
            refName: 'p',
            rowDim: 'region',
            colDim: 'quarter',
            measure: 'amt',
            func: 'SUM',
            extraColumns: [
                {name: 'Orders', colValue: null, func: 'COUNT', measure: 'amt'},
            ],
        })
        expect(num(bookId, 6, 1)).toBe(10) // East Q1 amount
        expect(num(bookId, 6, 3)).toBe(2) // East has two records
        expect(num(bookId, 8, 3)).toBe(3) // South has three
    })

    it('counts only the records a filter admits, in the rows and the numbers', async () => {
        const pivotId = rpc(
            'getAvailableBlockId',
            {sheetIdx: 0},
            bookId
        ) as number
        const made = await ops.createPivot({
            source: source(),
            blockId: pivotId,
            refName: 'p',
            rowDim: 'region',
            measure: 'amt',
            func: 'SUM',
            filters: [{field: 'quarter', criteria: 'Q2'}],
        })
        // Only East and South have a Q2 record; North gets no row at all rather
        // than a row reading 0 as if that were its Q2 total.
        expect(made.keys).toEqual(['East', 'South'])
        expect(num(bookId, 6, 1)).toBe(20) // East Q2
        expect(num(bookId, 7, 1)).toBe(5) // South Q2
    })

    it('puts the rows in a declared order, without losing the ones not declared', async () => {
        const pivotId = rpc(
            'getAvailableBlockId',
            {sheetIdx: 0},
            bookId
        ) as number
        const made = await ops.createPivot({
            source: source(),
            blockId: pivotId,
            refName: 'p',
            rowDim: 'region',
            measure: 'amt',
            func: 'SUM',
            order: 'custom',
            // South deliberately unlisted.
            orderValues: ['North', 'East'],
        })
        expect(made.keys).toEqual(['North', 'East', 'South'])
        expect(str(bookId, 6, 0)).toBe('North')
        expect(num(bookId, 6, 1)).toBe(7)
        expect(str(bookId, 8, 0)).toBe('South')
        expect(num(bookId, 8, 1)).toBe(12)
    })
})

describe('a source field rename, through the real wasm', () => {
    it('carries into the pivot recipe instead of leaving it reading 0', async () => {
        // The failure this prevents is the worst kind on offer: the cells do
        // not error, they read 0, so the pivot looks like a table of real
        // zeroes. Nothing on the sheet says otherwise.
        const bookId = rpc('newWorkbook') as number
        const src = salesBlock(bookId)
        const ops = new WorkbookOps(clientFor(bookId))
        const pivotId = rpc(
            'getAvailableBlockId',
            {sheetIdx: 0},
            bookId
        ) as number
        await ops.createPivot({
            source: {
                sheetIdx: 0,
                blockId: src,
                refName: 'sales',
                rowStart: 0,
                rowCnt: SALES.length,
                colStart: 0,
            },
            blockId: pivotId,
            refName: 'p',
            rowDim: 'region',
            colDim: 'quarter',
            measure: 'amt',
            func: 'SUM',
        })
        expect(num(bookId, 6, 1)).toBe(10)

        // Rename `region` to `area`, keeping every render id — which is what
        // makes it a rename rather than a drop plus an add.
        const eff = rpc(
            'handleTransaction',
            {
                transaction: {
                    payloads: [
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
                                    {name: 'area', renderId: 's1'},
                                    {name: 'quarter', renderId: 's2'},
                                    {
                                        name: 'amt',
                                        renderId: 's3',
                                        fieldType: {kind: 'number'},
                                    },
                                ],
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

        expect(num(bookId, 6, 1)).toBe(10) // still East Q1
        expect(num(bookId, 8, 1)).toBe(7) // still South Q1 = 3 + 4

        const blocks = rpc('getAllBlocks', {}, bookId) as Array<{
            blockId: number
            pivot?: {rowDim: string}
        }>
        expect(blocks.find((b) => b.blockId === pivotId)!.pivot!.rowDim).toBe(
            'area'
        )
        // And the plan works rather than erroring on a field that is gone.
        const plan = rpc('pivotPlan', {sheetIdx: 0, blockId: pivotId}, bookId)
        expect(plan.msg).toBeUndefined()
        expect(plan.isStale).toBe(false)
    })
})

/**
 * A pivot inherits its source's number formats, through the real engine.
 *
 * The core unit tests prove the payloads are emitted; only here can we see
 * that the engine accepts them and that the format actually lands on the
 * pivot's cells. The failure without this is quiet and ugly: a table of money
 * rendered as bare numbers directly beneath the money it came from.
 */
describe('a pivot inherits its source number formats, against the real engine', () => {
    let bookId: number
    let src: number

    const MONEY = '"$"#,##0.00'

    beforeEach(() => {
        bookId = rpc('newWorkbook') as number
        src = salesBlock(bookId)
        // Give the source's amount column a currency format, the way a user
        // would before pivoting it.
        const sheetId = rpc('getSheetId', {sheetIdx: 0}, bookId) as number
        const eff = rpc(
            'handleTransaction',
            {
                transaction: {
                    payloads: [
                        {
                            type: 'upsertFieldRenderInfo',
                            value: {
                                renderId: 's3',
                                diyRender: false,
                                styleUpdate: {setNumFmt: MONEY},
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
        expect(sheetId).toBeGreaterThanOrEqual(0)
    })

    /**
     * The number format the pivot's Nth field carries, read the way the
     * renderer reads it: off the block's render entries.
     */
    const fmtOf = (pivotId: number, renderId: string): string => {
        const sheetId = rpc('getSheetId', {sheetIdx: 0}, bookId) as number
        const info = rpc(
            'getBlockInfo',
            {sheetId, blockId: pivotId},
            bookId
        ) as {
            fieldRenders?: Array<{
                renderId: string
                style?: {formatter?: string}
            }>
        }
        return (
            info.fieldRenders?.find((r) => r.renderId === renderId)?.style
                ?.formatter ?? ''
        )
    }

    it('formats a value column like the measure and leaves the key plain', async () => {
        const ops = new WorkbookOps(clientFor(bookId))
        const pivotId = rpc(
            'getAvailableBlockId',
            {sheetIdx: 0},
            bookId
        ) as number
        await ops.createPivot({
            source: {
                sheetIdx: 0,
                blockId: src,
                refName: 'sales',
                rowStart: 0,
                rowCnt: SALES.length,
                colStart: 0,
                numFmts: {amt: MONEY},
            },
            blockId: pivotId,
            refName: 'sales_pivot',
            rowDim: 'region',
            colDim: 'quarter',
            measure: 'amt',
            func: 'SUM',
        })

        // Row 6 is the pivot's first record: East, Q1 = 10.
        expect(num(bookId, 6, 1)).toBe(10)
        expect(fmtOf(pivotId, 'sales_pivot__p1')).toBe(MONEY)
        expect(fmtOf(pivotId, 'sales_pivot__p2')).toBe(MONEY)
        // The key column holds region names, which have no format of their own.
        expect(fmtOf(pivotId, 'sales_pivot__p0')).toBe('')
    })

    it('leaves a COUNT column plain — it counts records, not money', async () => {
        const ops = new WorkbookOps(clientFor(bookId))
        const pivotId = rpc(
            'getAvailableBlockId',
            {sheetIdx: 0},
            bookId
        ) as number
        await ops.createPivot({
            source: {
                sheetIdx: 0,
                blockId: src,
                refName: 'sales',
                rowStart: 0,
                rowCnt: SALES.length,
                colStart: 0,
                numFmts: {amt: MONEY},
            },
            blockId: pivotId,
            refName: 'p',
            rowDim: 'region',
            measure: 'amt',
            func: 'SUM',
            valueColumn: 'total',
            extraColumns: [
                {name: 'orders', colValue: null, func: 'COUNT', measure: 'amt'},
            ],
        })
        expect(fmtOf(pivotId, 'p__p1')).toBe(MONEY)
        expect(fmtOf(pivotId, 'p__p2')).toBe('')
    })
})

/**
 * `WorkbookOps.editPivot` against the real engine.
 *
 * Changing a recipe is not the same as changing a table: every cell is
 * generated from the recipe, the column names ARE the column dimension's
 * values and the key column holds the row dimension's. So an edit has to
 * restate the recipe, rewrite the keys and re-bind, in that order — the same
 * silent failure modes as creation, plus one of its own: set the recipe AFTER
 * the bind and the block re-materializes from the old one.
 */
describe('editing a pivot recipe, against the real engine', () => {
    let bookId: number
    let src: number
    let pivotId: number
    let ops: WorkbookOps

    const source = () => ({
        sheetIdx: 0,
        blockId: src,
        refName: 'sales',
        rowStart: 0,
        rowCnt: SALES.length,
        colStart: 0,
    })

    beforeEach(async () => {
        bookId = rpc('newWorkbook') as number
        src = salesBlock(bookId)
        ops = new WorkbookOps(clientFor(bookId))
        pivotId = rpc('getAvailableBlockId', {sheetIdx: 0}, bookId) as number
        await ops.createPivot({
            source: source(),
            blockId: pivotId,
            refName: 'p',
            rowDim: 'region',
            colDim: 'quarter',
            measure: 'amt',
            func: 'SUM',
        })
        // East / North / South by row, Q1 / Q2 by column.
        expect(str(bookId, 6, 0)).toBe('East')
        expect(num(bookId, 6, 1)).toBe(10)
    })

    const edit = (recipe: Record<string, unknown>) =>
        ops.editPivot({
            sheetIdx: 0,
            blockId: pivotId,
            refName: 'p',
            source: source(),
            rowStart: 6,
            colStart: 0,
            currentRowCnt: 3,
            currentColCnt: 3,
            rowDim: 'region',
            colDim: 'quarter',
            measure: 'amt',
            func: 'SUM',
            ...recipe,
        })

    it('changes the function, and every cell recomputes', async () => {
        await edit({func: 'COUNT'})
        // East has one Q1 record and one Q2 record; South has two in Q1.
        expect(num(bookId, 6, 1)).toBe(1)
        expect(num(bookId, 8, 1)).toBe(2)
    })

    it('re-aims the rows at a different dimension, keys and all', async () => {
        const made = await edit({rowDim: 'quarter', colDim: undefined})
        expect(made.keys).toEqual(['Q1', 'Q2'])
        expect(str(bookId, 6, 0)).toBe('Q1')
        // Q1 = 10 + 3 + 4 + 7, Q2 = 20 + 5.
        expect(num(bookId, 6, 1)).toBe(24)
        expect(num(bookId, 7, 1)).toBe(25)
    })

    it('narrows to a filtered set of records, and the numbers follow', async () => {
        await edit({filters: [{field: 'region', criteria: 'South'}]})
        // Only South records count now, so it is the only row with a number.
        expect(str(bookId, 6, 0)).toBe('South')
        expect(num(bookId, 6, 1)).toBe(7)
    })

    it('grows the block when the new recipe has more groups', async () => {
        // region has 3 values, id has 6 — one row per record.
        const made = await edit({rowDim: 'id', colDim: undefined})
        expect(made.keys.length).toBe(6)
        expect(str(bookId, 11, 0)).toBe('o5')
        expect(num(bookId, 11, 1)).toBe(7)
    })

    it('fixes a pivot whose recipe stopped resolving — the reason to edit at all', async () => {
        // Rename the measure on the source. The recipe still says "amt", which
        // no longer exists, so BLOCKREFS matches nothing and every cell reads
        // 0 rather than erroring. Planning the OLD recipe is exactly what
        // cannot be relied on here, which is why editPivot never asks.
        const eff = rpc(
            'handleTransaction',
            {
                transaction: {
                    payloads: [
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
                                        name: 'value',
                                        renderId: 's3',
                                        fieldType: {kind: 'number'},
                                    },
                                ],
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

        await edit({measure: 'value'})
        expect(num(bookId, 6, 1)).toBe(10)
    })

    it('is one undo, whatever it changed', async () => {
        await edit({rowDim: 'quarter', colDim: undefined})
        expect(str(bookId, 6, 0)).toBe('Q1')
        expect(rpc('undo', undefined, bookId)).toBe(true)
        expect(str(bookId, 6, 0)).toBe('East')
        expect(num(bookId, 6, 1)).toBe(10)
    })
})

/**
 * COUNTA against the real engine.
 *
 * It is the one aggregate with no `*IFS` form, so a pivot lowers it to
 * `COUNTIFS` plus a non-blank test on the measure. That substitution is
 * invisible in the recipe and only the engine can confirm it evaluates — a
 * naive lowering would emit `COUNTAIFS(...)`, a function that does not exist.
 */
describe('COUNTA against the real engine', () => {
    let bookId: number
    let src: number

    // East: one amount and one GAP. South: the text "n/a" and a number.
    const GAPPY: ReadonlyArray<readonly [string, string, string]> = [
        ['o0', 'East', '10'],
        ['o1', 'East', ''],
        ['o2', 'South', 'n/a'],
        ['o3', 'South', '5'],
    ]

    beforeEach(() => {
        bookId = rpc('newWorkbook') as number
        src = rpc('getAvailableBlockId', {sheetIdx: 0}, bookId) as number
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
                                rowCnt: GAPPY.length,
                                colCnt: 3,
                            },
                        },
                        {
                            type: 'bindFormSchema',
                            value: {
                                refName: 'gappy',
                                sheetIdx: 0,
                                blockId: src,
                                fieldFrom: 0,
                                keyIdx: 0,
                                row: true,
                                fields: [
                                    {name: 'id', renderId: 'g0'},
                                    {name: 'region', renderId: 'g1'},
                                    {name: 'amt', renderId: 'g2'},
                                ],
                            },
                        },
                        ...GAPPY.flatMap((row, r) =>
                            row
                                .map((v, c) => ({
                                    type: 'cellInput',
                                    value: {
                                        sheetIdx: 0,
                                        row: r,
                                        col: c,
                                        content: v,
                                    },
                                }))
                                // The gap is the point of the fixture.
                                .filter((p) => p.value.content !== '')
                        ),
                    ],
                    undoable: true,
                    temp: false,
                },
            },
            bookId
        )
        expect(eff.status.type, eff.errorMessage).toBe('ok')
    })

    it('counts the records whose measure is filled in, where COUNT counts records', async () => {
        const ops = new WorkbookOps(clientFor(bookId))
        const pivotId = rpc(
            'getAvailableBlockId',
            {sheetIdx: 0},
            bookId
        ) as number
        await ops.createPivot({
            source: {
                sheetIdx: 0,
                blockId: src,
                refName: 'gappy',
                rowStart: 0,
                rowCnt: GAPPY.length,
                colStart: 0,
            },
            blockId: pivotId,
            refName: 'g',
            rowDim: 'region',
            measure: 'amt',
            func: 'COUNTA',
            valueColumn: 'filled',
            extraColumns: [
                {
                    name: 'records',
                    colValue: null,
                    func: 'COUNT',
                    measure: 'amt',
                },
            ],
        })

        // Row 4 is the pivot's first record: East, then South.
        expect(str(bookId, 4, 0)).toBe('East')
        expect(num(bookId, 4, 1)).toBe(1) // one amount, one gap
        expect(num(bookId, 4, 2)).toBe(2) // but two records
        expect(num(bookId, 5, 1)).toBe(2) // "n/a" is present, if not numeric
        expect(num(bookId, 5, 2)).toBe(2)
    })
})
