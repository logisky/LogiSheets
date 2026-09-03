import {describe, expect, it} from 'vitest'
import type {Client} from 'logisheets-web/pure'
import type {ToolContext} from '../tool.js'
import {ToolRegistry, toLlmTool, toolId} from '../tool.js'
import {defaultCategory} from './taxonomy.js'
import {
    CHART_TOOLS,
    chartFromBlock,
    deleteChart,
    insertChart,
    listCharts,
    suggestChart,
    updateChart,
} from './charts.js'
import {LINK_TOOLS} from './links.js'

/**
 * A client that records the payloads it is handed instead of touching a
 * workbook. What matters about these tools is the payload they build — the
 * references they normalise and the anchor they choose — so that is what the
 * fake captures.
 */
function fakeClient(over: Partial<Record<string, unknown>> = {}) {
    const committed: Array<{type: string; value: Record<string, unknown>}> = []
    const client = {
        getSheetNameByIdx: async ({idx}: {idx: number}) =>
            idx === 0
                ? 'Sheet1'
                : idx === 1
                ? "Bob's Data"
                : {msg: 'no sheet', ty: 1},
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
        ...over,
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

/** The payload the tool committed, as a loosely-typed record. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Payload = any

describe('chart__insert', () => {
    it('qualifies and absolutises every reference', async () => {
        const {client, committed} = fakeClient()
        await insertChart.handler(
            {
                sheetIdx: 0,
                chartType: 'col',
                categoriesRef: 'A2:A5',
                series: [
                    {name: 'Q1', valueRef: 'B2:B5'},
                    {name: 'Q2', valueRef: '$C$2:$C$5'},
                ],
            },
            ctxFor(client)
        )
        const v: Payload = committed[0].value
        // A bare range would resolve against whatever sheet the chart lands
        // on; qualified, it always means the sheet the tool was asked about.
        expect(v.categoriesRef).toBe('Sheet1!$A$2:$A$5')
        expect(v.series[0].valueRef).toBe('Sheet1!$B$2:$B$5')
        expect(v.series[1].valueRef).toBe('Sheet1!$C$2:$C$5')
    })

    it('keeps an explicit sheet, and quotes one that needs it', async () => {
        const {client, committed} = fakeClient()
        await insertChart.handler(
            {
                sheetIdx: 0,
                chartType: 'line',
                series: [{valueRef: 'Sheet2!B2:B5'}],
            },
            ctxFor(client)
        )
        expect((committed[0].value as Payload).series[0].valueRef).toBe(
            'Sheet2!$B$2:$B$5'
        )

        const two = fakeClient()
        await insertChart.handler(
            {sheetIdx: 1, chartType: 'line', series: [{valueRef: 'B2:B5'}]},
            ctxFor(two.client)
        )
        expect((two.committed[0].value as Payload).series[0].valueRef).toBe(
            "'Bob''s Data'!$B$2:$B$5"
        )
    })

    it('anchors below the data so the chart never covers it', async () => {
        const {client, committed} = fakeClient()
        await insertChart.handler(
            {
                sheetIdx: 0,
                chartType: 'col',
                series: [{valueRef: 'B2:B10'}, {valueRef: 'C2:C6'}],
            },
            ctxFor(client)
        )
        const v: Payload = committed[0].value
        // Bottom-most referenced row is 10 (index 9), plus two rows of gap.
        expect(v.fromRow).toBe(11)
        // Left-most referenced column is B (index 1).
        expect(v.fromCol).toBe(1)
        expect(v.toRow - v.fromRow).toBe(15)
        expect(v.toCol - v.fromCol).toBe(8)
    })

    it('honours an explicit anchor and size', async () => {
        const {client, committed} = fakeClient()
        await insertChart.handler(
            {
                sheetIdx: 0,
                chartType: 'col',
                series: [{valueRef: 'B2:B10'}],
                anchor: 'H3',
                sizeInCells: {rows: 20, cols: 12},
            },
            ctxFor(client)
        )
        const v: Payload = committed[0].value
        expect([v.fromRow, v.fromCol]).toEqual([2, 7])
        expect([v.toRow, v.toCol]).toEqual([22, 19])
    })

    it('writes no cell values — only references', async () => {
        const {client, committed} = fakeClient()
        await insertChart.handler(
            {sheetIdx: 0, chartType: 'pie', series: [{valueRef: 'B2:B5'}]},
            ctxFor(client)
        )
        // A chart that copied numbers would go stale the moment a cell
        // changed; every committed payload here must be the chart itself.
        expect(committed.map((p) => p.type)).toEqual(['createChart'])
    })

    it('carries bubble sizes and a per-series kind through', async () => {
        const {client, committed} = fakeClient()
        await insertChart.handler(
            {
                sheetIdx: 0,
                chartType: 'bubble',
                categoriesRef: 'A2:A5',
                series: [
                    {valueRef: 'B2:B5', sizeRef: 'C2:C5', color: '#FF0000'},
                ],
            },
            ctxFor(client)
        )
        const v: Payload = committed[0].value
        expect(v.series[0].sizeRef).toBe('Sheet1!$C$2:$C$5')
        // The core wants the hex without the leading '#'.
        expect(v.series[0].color).toBe('FF0000')

        const combo = fakeClient()
        await insertChart.handler(
            {
                sheetIdx: 0,
                chartType: 'col',
                series: [
                    {valueRef: 'B2:B5'},
                    {valueRef: 'C2:C5', seriesType: 'line'},
                ],
            },
            ctxFor(combo.client)
        )
        const cv: Payload = combo.committed[0].value
        expect(cv.series[0].seriesType).toBeUndefined()
        expect(cv.series[1].seriesType).toBe('line')
    })

    it('gives each chart its own id', async () => {
        const {client, committed} = fakeClient()
        for (let i = 0; i < 3; i++)
            await insertChart.handler(
                {sheetIdx: 0, chartType: 'col', series: [{valueRef: 'B2:B5'}]},
                ctxFor(client)
            )
        const ids = committed.map((p) => (p.value as Payload).chartId)
        expect(new Set(ids).size).toBe(3)
        // The id also names the chart's part inside the .xlsx.
        for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9-]+$/)
    })

    it('rejects a reference it cannot parse instead of dropping it', async () => {
        const {client} = fakeClient()
        // Silently ignoring this would produce an empty chart much later.
        await expect(
            insertChart.handler(
                {
                    sheetIdx: 0,
                    chartType: 'col',
                    series: [{valueRef: 'not a ref'}],
                },
                ctxFor(client)
            )
        ).rejects.toThrow(/not an A1 reference/)
    })

    it('refuses a chart with no series', async () => {
        const {client} = fakeClient()
        await expect(
            insertChart.handler(
                {sheetIdx: 0, chartType: 'col', series: []},
                ctxFor(client)
            )
        ).rejects.toThrow(/at least one series/)
    })

    it('surfaces a failed transaction rather than reporting success', async () => {
        const {client} = fakeClient({
            handleTransaction: async () => ({
                status: {type: 'err', err: 'boom'},
                taskIdx: [],
                asyncTasks: [],
            }),
        })
        await expect(
            insertChart.handler(
                {sheetIdx: 0, chartType: 'col', series: [{valueRef: 'B2:B5'}]},
                ctxFor(client)
            )
        ).rejects.toThrow()
    })
})

describe('chart__update', () => {
    it('sends only what was asked for, so the rest is kept', async () => {
        const {client, committed} = fakeClient()
        await updateChart.handler(
            {sheetIdx: 0, chartId: 'chart1', chartType: 'line', title: 'Sales'},
            ctxFor(client)
        )
        const v: Payload = committed[0].value
        expect(v.chartType).toBe('line')
        expect(v.title).toBe('Sales')
        // Untouched fields must be absent, not null — the core reads
        // `undefined` as "keep".
        expect(v.legendPos).toBeUndefined()
        expect(v.series).toBeUndefined()
        expect(v.valAxisScale).toBeUndefined()
    })

    it('normalises re-pointed references too', async () => {
        const {client, committed} = fakeClient()
        await updateChart.handler(
            {
                sheetIdx: 0,
                chartId: 'chart1',
                categoriesRef: 'A2:A9',
                series: [{name: 'New', valueRef: 'D2:D9'}],
            },
            ctxFor(client)
        )
        const v: Payload = committed[0].value
        expect(v.categoriesRef).toBe('Sheet1!$A$2:$A$9')
        expect(v.series[0].valueRef).toBe('Sheet1!$D$2:$D$9')
    })

    it('sends the axis scale whole, defaulting reversed', async () => {
        const {client, committed} = fakeClient()
        await updateChart.handler(
            {sheetIdx: 0, chartId: 'chart1', valAxisScale: {min: 0, max: 80}},
            ctxFor(client)
        )
        const v: Payload = committed[0].value
        // The payload replaces the scale outright, so `reversed` cannot be
        // left undefined or the axis would flip depending on the old value.
        expect(v.valAxisScale).toEqual({
            min: 0,
            max: 80,
            majorUnit: undefined,
            logBase: undefined,
            reversed: false,
        })
    })

    it('passes an empty string through, which is how a title is cleared', async () => {
        const {client, committed} = fakeClient()
        await updateChart.handler(
            {sheetIdx: 0, chartId: 'chart1', title: ''},
            ctxFor(client)
        )
        expect((committed[0].value as Payload).title).toBe('')
    })
})

describe('chart__list', () => {
    it('reports each chart with the ranges it reads', async () => {
        const {client} = fakeClient({
            getCharts: async () => [
                {
                    chartId: 'chart1',
                    chartType: 'col',
                    title: 'Sales',
                    stacked: false,
                    legendPos: 'bottom',
                    fromRow: 4,
                    fromCol: 7,
                    catRef: 'Sheet1!$A$2:$A$5',
                    series: [
                        {
                            name: 'Q1',
                            valRef: 'Sheet1!$B$2:$B$5',
                            values: [1, 2, 3, 4],
                        },
                    ],
                },
            ],
        })
        const res = await listCharts.handler({sheetIdx: 0}, ctxFor(client))
        const {charts}: Payload = res.data
        expect(charts).toHaveLength(1)
        expect(charts[0]).toMatchObject({
            chart_id: 'chart1',
            type: 'col',
            title: 'Sales',
            legend: 'bottom',
            anchor: 'H5',
            categories_ref: 'Sheet1!$A$2:$A$5',
        })
        expect(charts[0].series[0]).toEqual({
            name: 'Q1',
            value_ref: 'Sheet1!$B$2:$B$5',
            size_ref: null,
            point_count: 4,
        })
    })

    it('says so when the read fails', async () => {
        const {client} = fakeClient({
            // An ErrorMessage carries `ty` as well as `msg`.
            getCharts: async () => ({msg: 'nope', ty: 1}),
        })
        await expect(
            listCharts.handler({sheetIdx: 0}, ctxFor(client))
        ).rejects.toThrow(/nope/)
    })
})

/**
 * A sheet for `chart__suggest`, written as a literal grid. Strings are text
 * cells, numbers numeric, `null` blank; a `[number, fmt]` pair is a number
 * carrying a format code, which is how a date is recognised.
 */
type CellLit = string | number | null | [number, string]

function gridClient(rows: CellLit[][]) {
    return fakeClient({
        getCells: async ({
            startRow,
            startCol,
            endRow,
            endCol,
        }: {
            startRow: number
            startCol: number
            endRow: number
            endCol: number
        }) => {
            const out: unknown[] = []
            for (let r = startRow; r <= endRow; r++)
                for (let c = startCol; c <= endCol; c++) {
                    const v = rows[r]?.[c] ?? null
                    const lit = Array.isArray(v) ? v[0] : v
                    const fmt = Array.isArray(v) ? v[1] : ''
                    out.push({
                        value:
                            lit === null || lit === ''
                                ? 'empty'
                                : typeof lit === 'number'
                                ? {type: 'number', value: lit}
                                : {type: 'str', value: lit},
                        formula: '',
                        style: {formatter: fmt},
                    })
                }
            return out
        },
    })
}

async function suggest(
    rows: CellLit[][],
    range: string,
    seriesIn?: 'columns' | 'rows'
) {
    const {client} = gridClient(rows)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await suggestChart.handler(
        {sheetIdx: 0, range, ...(seriesIn ? {seriesIn} : {})},
        ctxFor(client)
    )
    return res.data
}

describe('chart__suggest', () => {
    const TABLE: CellLit[][] = [
        ['', 'Q1', 'Q2'],
        ['North', 1, 2],
        ['South', 3, 4],
    ]

    it('reads a header row and a label column', async () => {
        const d = await suggest(TABLE, 'A1:C3')
        expect(d.detected).toMatchObject({
            has_header: true,
            has_label_column: true,
            category_count: 2,
        })
        expect(d.suggestion.categoriesRef).toBe('Sheet1!$A$2:$A$3')
        expect(d.suggestion.series).toEqual([
            {name: 'Q1', valueRef: 'Sheet1!$B$2:$B$3'},
            {name: 'Q2', valueRef: 'Sheet1!$C$2:$C$3'},
        ])
    })

    it('keeps the first row of data when only the labels are text', async () => {
        // Row labels, no header row. The corner cell is text but belongs to
        // the label column, so it must not turn row 1 into series names.
        const d = await suggest(
            [
                ['North', 9, 9],
                ['South', 1, 2],
                ['East', 3, 4],
            ],
            'A1:C3'
        )
        expect(d.detected.has_header).toBe(false)
        expect(d.suggestion.series.map((s: {name?: string}) => s.name)).toEqual(
            [undefined, undefined]
        )
        expect(d.suggestion.categoriesRef).toBe('Sheet1!$A$1:$A$3')
        expect(d.suggestion.series[0].valueRef).toBe('Sheet1!$B$1:$B$3')
    })

    it('skips a text column that is not a series', async () => {
        const d = await suggest(
            [
                ['City', 'Region', 'Sales'],
                ['A', 'North', 10],
                ['B', 'South', 20],
            ],
            'A1:C3'
        )
        // "Region" is text, so it is not plottable.
        expect(d.suggestion.series).toEqual([
            {name: 'Sales', valueRef: 'Sheet1!$C$2:$C$3'},
        ])
        expect(d.detected.non_numeric_columns_skipped).toBe(1)
    })

    it('suggests a pie for one series over a few categories', async () => {
        const d = await suggest(
            [
                ['', 'Share'],
                ['A', 40],
                ['B', 35],
                ['C', 25],
            ],
            'A1:B4'
        )
        expect(d.suggestion.chartType).toBe('pie')
        expect(d.suggestion.why).toMatch(/parts of a whole/)
    })

    it('suggests a column chart when one series has many categories', async () => {
        const rows: CellLit[][] = [['', 'V']]
        for (let i = 0; i < 12; i++) rows.push([`r${i}`, i])
        const d = await suggest(rows, 'A1:B13')
        expect(d.suggestion.chartType).toBe('col')
        expect(d.detected.category_count).toBe(12)
    })

    it('suggests a line when the categories are dates', async () => {
        const d = await suggest(
            [
                ['', 'Revenue'],
                [[45000, 'yyyy-mm-dd'], 10],
                [[45001, 'yyyy-mm-dd'], 20],
                [[45002, 'yyyy-mm-dd'], 30],
            ],
            'A1:B4'
        )
        expect(d.suggestion.chartType).toBe('line')
        expect(d.suggestion.why).toMatch(/dates/)
    })

    it('does not mistake a currency format for a date', async () => {
        // `[$¥-804]#,##0` holds letters inside a bracket; only the bare
        // pattern may vote on whether this is a date.
        const d = await suggest(
            [
                ['', 'V'],
                [[1, '[$¥-804]#,##0'], 10],
                [[2, '[$¥-804]#,##0'], 20],
            ],
            'A1:B3'
        )
        expect(d.suggestion.chartType).not.toBe('line')
    })

    it('treats a date column as labels, not as a second series', async () => {
        // Dates are stored as numbers, so a text-only test would see two
        // numeric columns here and suggest a scatter.
        const d = await suggest(
            [
                ['', 'Revenue'],
                [[45000, 'yyyy-mm-dd'], 10],
                [[45001, 'yyyy-mm-dd'], 20],
            ],
            'A1:B3'
        )
        expect(d.detected.has_label_column).toBe(true)
        expect(d.suggestion.categoriesRef).toBe('Sheet1!$A$2:$A$3')
        expect(d.suggestion.series).toHaveLength(1)
    })

    it('suggests a scatter for two numeric columns with no labels', async () => {
        const d = await suggest(
            [
                [1, 10],
                [2, 20],
                [3, 30],
            ],
            'A1:B3'
        )
        expect(d.suggestion.chartType).toBe('scatter')
        expect(d.suggestion.categoriesRef).toBeNull()
        expect(d.suggestion.series).toHaveLength(2)
    })

    it('reads series across rows when asked', async () => {
        const d = await suggest(
            [
                ['', 'Jan', 'Feb', 'Mar'],
                ['North', 1, 2, 3],
                ['South', 4, 5, 6],
            ],
            'A1:D3',
            'rows'
        )
        expect(d.detected.series_in).toBe('rows')
        // Each row is a series; the first row supplies the categories.
        expect(d.suggestion.categoriesRef).toBe('Sheet1!$B$1:$D$1')
        expect(d.suggestion.series).toEqual([
            {name: 'North', valueRef: 'Sheet1!$B$2:$D$2'},
            {name: 'South', valueRef: 'Sheet1!$B$3:$D$3'},
        ])
    })

    it('says so rather than inventing a series when nothing is numeric', async () => {
        const d = await suggest(
            [
                ['a', 'b'],
                ['c', 'd'],
            ],
            'A1:B2'
        )
        expect(d.suggestion.series).toEqual([])
        expect(d.suggestion.why).toMatch(/no numeric series/)
    })

    it('samples the head but returns refs for the whole range', async () => {
        const rows: CellLit[][] = [['', 'V']]
        for (let i = 0; i < 400; i++) rows.push([`r${i}`, i])
        const {client} = gridClient(rows)
        let requestedRows = 0
        const spy = new Proxy(client, {
            get(t, k) {
                if (k === 'getCells')
                    return async (p: {startRow: number; endRow: number}) => {
                        requestedRows = p.endRow - p.startRow + 1
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        return (t as any).getCells(p)
                    }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return (t as any)[k]
            },
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res: any = await suggestChart.handler(
            {sheetIdx: 0, range: 'A1:B401'},
            ctxFor(spy as Client)
        )
        // Reading all 401 rows to decide "is row 1 a header" would be absurd.
        expect(requestedRows).toBe(50)
        // But the series must cover every row of data.
        expect(res.data.suggestion.series[0].valueRef).toBe(
            'Sheet1!$B$2:$B$401'
        )
        expect(res.data.detected.sampled_rows).toBe(50)
    })

    it('is a read, and its refs feed straight into chart__insert', async () => {
        expect(suggestChart.mutates).toBe(false)
        expect(suggestChart.confirmation).toBe('never')
        const d = await suggest(TABLE, 'A1:C3')
        const {client, committed} = fakeClient()
        await insertChart.handler(
            {
                sheetIdx: 0,
                chartType: d.suggestion.chartType,
                categoriesRef: d.suggestion.categoriesRef,
                series: d.suggestion.series,
            },
            ctxFor(client)
        )
        // Already normalised, so nothing changes on the way through.
        const v: Payload = committed[0].value
        expect(v.categoriesRef).toBe('Sheet1!$A$2:$A$3')
        expect(v.series[0].valueRef).toBe('Sheet1!$B$2:$B$3')
    })
})

/**
 * A block as `getBlockInfo` returns it. `row` schema means records are rows and
 * fields are columns; `col` is transposed — the axis a field's `idx` refers to
 * is the whole point of these tests.
 */
function blockClient(opts: {
    schemaType?: 'row' | 'col' | 'random' | null
    rowStart?: number
    colStart?: number
    rowCnt?: number
    colCnt?: number
    fields?: Array<[string, number]>
    keys?: Array<[string, number]>
    name?: string
}) {
    const {
        schemaType = 'row',
        rowStart = 1,
        colStart = 1,
        rowCnt = 4,
        colCnt = 3,
        fields = [
            ['name', 0],
            ['qty', 1],
            ['price', 2],
        ],
        keys = [
            ['k1', 0],
            ['k2', 1],
            ['k3', 2],
            ['k4', 3],
        ],
        name = 'people',
    } = opts
    return fakeClient({
        getSheetId: async () => 7,
        getBlockInfo: async () => ({
            sheetIdx: 0,
            sheetId: 7,
            blockId: 1,
            rowStart,
            colStart,
            rowCnt,
            colCnt,
            fieldRenders: [],
            cells: [],
            schema:
                schemaType === null
                    ? undefined
                    : {
                          name,
                          schemaType,
                          keys: keys.map(([k, idx]) => ({key: k, idx})),
                          fields: fields.map(([field, idx]) => ({
                              field,
                              idx,
                              renderId: 'r',
                          })),
                          randomEntries: [],
                      },
        }),
    })
}

describe('chart__from_block', () => {
    it('states the fields and lets the engine find them', async () => {
        // The point of the tool: no ranges are sent at all. The engine derives
        // them from the block and keeps deriving them, which is what makes the
        // chart follow the block instead of freezing where it started.
        const {client, committed} = blockClient({})
        await chartFromBlock.handler(
            {
                sheetIdx: 0,
                blockId: 1,
                valueFields: ['qty', 'price'],
                categoryField: 'name',
            },
            ctxFor(client)
        )
        const v: Payload = committed[0].value
        expect(v.blockSource).toEqual({
            blockId: 1,
            categoryField: 'name',
            valueFields: ['qty', 'price'],
        })
        expect(v.series).toEqual([])
        expect(v.categoriesRef).toBeUndefined()
    })

    it('leaves the category field out when none was named', async () => {
        const {client, committed} = blockClient({})
        await chartFromBlock.handler(
            {sheetIdx: 0, blockId: 1, valueFields: ['qty']},
            ctxFor(client)
        )
        expect((committed[0].value as Payload).blockSource).toEqual({
            blockId: 1,
            categoryField: undefined,
            valueFields: ['qty'],
        })
    })

    it('titles the chart after the schema', async () => {
        const {client, committed} = blockClient({name: 'orders'})
        await chartFromBlock.handler(
            {sheetIdx: 0, blockId: 1, valueFields: ['qty', 'price']},
            ctxFor(client)
        )
        expect((committed[0].value as Payload).title).toBe('orders')
    })

    it('anchors below the block', async () => {
        const {client, committed} = blockClient({})
        await chartFromBlock.handler(
            {sheetIdx: 0, blockId: 1, valueFields: ['qty']},
            ctxFor(client)
        )
        const v: Payload = committed[0].value
        // Last record row is 4 (rowStart 1 + last key idx 3), plus two of gap.
        expect(v.fromRow).toBe(6)
        expect(v.fromCol).toBe(1)
    })

    it('anchors past the fields for a col schema, where fields are rows', async () => {
        // Records run along columns here, so the block's depth is its field
        // count — anchoring past the records would land on top of the block.
        const {client, committed} = blockClient({schemaType: 'col'})
        await chartFromBlock.handler(
            {sheetIdx: 0, blockId: 1, valueFields: ['qty']},
            ctxFor(client)
        )
        // Deepest field is at idx 2 from rowStart 1, plus two of gap.
        expect((committed[0].value as Payload).fromRow).toBe(5)
    })

    it('lists the real field names when asked for one that does not exist', async () => {
        const {client} = blockClient({})
        await expect(
            chartFromBlock.handler(
                {sheetIdx: 0, blockId: 1, valueFields: ['revenue']},
                ctxFor(client)
            )
        ).rejects.toThrow(/no field "revenue".*name, qty, price/)
    })

    it('checks the category field too, not just the values', async () => {
        // Left to the engine this would come back as a chart with no labels
        // and no explanation.
        const {client} = blockClient({})
        await expect(
            chartFromBlock.handler(
                {
                    sheetIdx: 0,
                    blockId: 1,
                    valueFields: ['qty'],
                    categoryField: 'lable',
                },
                ctxFor(client)
            )
        ).rejects.toThrow(/no field "lable"/)
    })

    it('refuses a random schema and points at the alternative', async () => {
        const {client} = blockClient({schemaType: 'random'})
        await expect(
            chartFromBlock.handler(
                {sheetIdx: 0, blockId: 1, valueFields: ['qty']},
                ctxFor(client)
            )
        ).rejects.toThrow(/random.*chart__suggest/s)
    })

    it('refuses a block with no schema', async () => {
        const {client} = blockClient({schemaType: null})
        await expect(
            chartFromBlock.handler(
                {sheetIdx: 0, blockId: 1, valueFields: ['qty']},
                ctxFor(client)
            )
        ).rejects.toThrow(/no schema/)
    })

    it('reports the keys so the answer can name the records', async () => {
        const {client} = blockClient({})
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res: any = await chartFromBlock.handler(
            {sheetIdx: 0, blockId: 1, valueFields: ['qty']},
            ctxFor(client)
        )
        expect(res.data.record_count).toBe(4)
        expect(res.data.keys).toEqual(['k1', 'k2', 'k3', 'k4'])
        expect(res.data.bound_to_block).toBe(1)
    })
})

describe('chart tool contracts', () => {
    it('marks the writes as writes, and delete as destructive', () => {
        expect(listCharts.mutates).toBe(false)
        expect(listCharts.confirmation).toBe('never')
        for (const t of [insertChart, updateChart]) {
            expect(t.mutates).toBe(true)
            expect(t.confirmation).toBe('always')
        }
        expect(deleteChart.mutates).toBe(true)
        expect(deleteChart.confirmation).toBe('destructive')
    })

    it('exposes every chart kind the core accepts', () => {
        const kinds = insertChart.inputSchema.properties?.chartType
            ?.enum as readonly string[]
        // The core's `chart_type_from_str` falls back to 'col' for anything it
        // does not know, so an enum here is what stops a typo becoming a
        // silently wrong chart.
        expect(kinds).toContain('col')
        expect(kinds).toContain('surface3d')
        expect(kinds).toContain('barOfPie')
        expect(kinds).toHaveLength(19)
    })
})

describe('chart tools in a registry', () => {
    it('register without colliding and serialise for the LLM', () => {
        const r = new ToolRegistry()
        r.registerMany([...LINK_TOOLS, ...CHART_TOOLS])
        const ids = CHART_TOOLS.map(toolId)
        expect(ids).toEqual([
            'chart__suggest',
            'chart__list',
            'chart__insert',
            'chart__from_block',
            'chart__update',
            'chart__delete',
        ])
        for (const t of CHART_TOOLS) {
            const llm = toLlmTool(t)
            expect(llm.name).toMatch(/^chart__/)
            expect(llm.description.length).toBeGreaterThan(20)
            expect(llm.input_schema.type).toBe('object')
            expect(defaultCategory(t)).toEqual(['Charts'])
        }
    })
})
