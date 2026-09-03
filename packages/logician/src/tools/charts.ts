/**
 * Chart tools — create and reconfigure native Excel charts (`c:chartSpace`).
 *
 * A chart's values are read live from the ranges it points at, so these tools
 * only ever write references, never numbers: edit a source cell afterwards and
 * the chart follows. That is also why the model should look at the data first
 * (`cell__get_cells`) — it needs to know which columns are labels and which are
 * values before it can say what the series are.
 *
 * References are taken in loose A1 (`B2:B5`, `Sheet1!B2:B5`, `$B$2:$B$5`) and
 * normalised to the sheet-qualified absolute form the engine stores
 * (`'Sheet 1'!$B$2:$B$5`). Handing the engine a bare `B2:B5` would resolve
 * against whichever sheet the chart sits on, which is not always the one the
 * model meant — and a reference the engine cannot resolve fails silently, as an
 * empty chart rather than an error.
 */

import {isErrorMessage} from 'logisheets-web/pure'
import type {
    BlockInfo,
    CellInfo,
    ChartInfo,
    Client,
    EditPayload,
    Transaction,
} from 'logisheets-web/pure'
import type {Tool, ToolContext} from '../tool.js'
import {transactionFailure} from './effect.js'

function asClient(ctx: ToolContext): Client {
    return ctx.workbook as Client
}

async function commit(
    client: Client,
    payload: EditPayload,
    label: string
): Promise<void> {
    const tx: Transaction = {payloads: [payload], undoable: true, temp: false}
    const r = await client.handleTransaction({transaction: tx})
    if (isErrorMessage(r)) throw new Error(`${label}: ${r.msg}`)
    if (r.status.type === 'err') throw transactionFailure(label, r)
}

// ── A1 references ────────────────────────────────────────────────────────

function colToA1(col: number): string {
    let c = col + 1
    let s = ''
    while (c > 0) {
        const m = (c - 1) % 26
        s = String.fromCharCode(65 + m) + s
        c = (c - m - 1) / 26
    }
    return s
}

function a1ColToIndex(letters: string): number {
    let n = 0
    for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
    return n - 1
}

/** Quote a sheet name for a reference, as Excel does. */
function quoteSheet(name: string): string {
    return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(name) &&
        !/^[A-Za-z]{1,3}[0-9]+$/.test(name)
        ? name
        : `'${name.replace(/'/g, "''")}'`
}

interface ParsedRef {
    sheet?: string
    startRow: number
    startCol: number
    endRow: number
    endCol: number
}

/** Parse `[Sheet!]A1[:B2]`, with or without `$`. Returns undefined if unusable. */
function parseRef(ref: string): ParsedRef | undefined {
    const trimmed = ref.trim()
    if (!trimmed) return undefined
    const bang = trimmed.lastIndexOf('!')
    let sheet: string | undefined
    let body = trimmed
    if (bang >= 0) {
        let name = trimmed.slice(0, bang)
        if (name.length >= 2 && name.startsWith("'") && name.endsWith("'"))
            name = name.slice(1, -1).replace(/''/g, "'")
        sheet = name
        body = trimmed.slice(bang + 1)
    }
    const cell = (s: string) => {
        const m = /^\$?([A-Za-z]{1,3})\$?([0-9]+)$/.exec(s.trim())
        if (!m) return undefined
        return {col: a1ColToIndex(m[1]), row: Number(m[2]) - 1}
    }
    const [a, b] = body.includes(':') ? body.split(':') : [body, body]
    const from = cell(a)
    const to = cell(b)
    if (!from || !to) return undefined
    return {
        sheet,
        startRow: Math.min(from.row, to.row),
        startCol: Math.min(from.col, to.col),
        endRow: Math.max(from.row, to.row),
        endCol: Math.max(from.col, to.col),
    }
}

/** The absolute, sheet-qualified form the engine stores. */
function formatRef(sheetName: string, r: ParsedRef): string {
    const s = quoteSheet(r.sheet ?? sheetName)
    const from = `$${colToA1(r.startCol)}$${r.startRow + 1}`
    const to = `$${colToA1(r.endCol)}$${r.endRow + 1}`
    return `${s}!${from}${from === to ? '' : `:${to}`}`
}

async function sheetName(client: Client, sheetIdx: number): Promise<string> {
    // The RPC's param is `idx`, not `sheetIdx`.
    const r = await client.getSheetNameByIdx({idx: sheetIdx})
    if (isErrorMessage(r)) throw new Error(`no such sheet: ${sheetIdx}`)
    return r as string
}

/**
 * Normalise one reference, failing loudly. A silently-dropped reference would
 * surface much later as a chart with no data, so the model is told now.
 */
function normalise(
    ref: string,
    sheet: string,
    what: string
): {ref: string; parsed: ParsedRef} {
    const parsed = parseRef(ref)
    if (!parsed)
        throw new Error(
            `${what}: "${ref}" is not an A1 reference. Use e.g. B2:B10 or 'My Sheet'!B2:B10.`
        )
    return {ref: formatRef(sheet, parsed), parsed}
}

/** Filename-safe: the id also names the chart's part inside the .xlsx. */
function newChartId(): string {
    const rand = Math.random().toString(36).slice(2, 8)
    return `chart-${Date.now().toString(36)}${rand}`
}

export const CHART_TYPES = [
    'col',
    'bar',
    'line',
    'area',
    'pie',
    'doughnut',
    'scatter',
    'radar',
    'bubble',
    'stock',
    'ofPie',
    'barOfPie',
    'surface',
    'surface3d',
    'col3d',
    'bar3d',
    'line3d',
    'area3d',
    'pie3d',
] as const

const SERIES_SCHEMA = {
    type: 'array' as const,
    description:
        'One entry per data series. Each valueRef is an A1 range of the values to plot.',
    items: {
        type: 'object' as const,
        properties: {
            name: {
                type: 'string' as const,
                description: "Legend name, e.g. the column's header text.",
            },
            valueRef: {
                type: 'string' as const,
                description: "A1 range of this series' values, e.g. B2:B10.",
            },
            sizeRef: {
                type: 'string' as const,
                description:
                    'Bubble sizes (bubble charts only): a third A1 range.',
            },
            color: {
                type: 'string' as const,
                description: 'RGB hex without "#", e.g. 4472C4.',
            },
            seriesType: {
                type: 'string' as const,
                enum: ['col', 'bar', 'line', 'area'],
                description:
                    'Draw this one series as a different kind, making a combo chart. Only valid when the chart itself is col/bar/line/area.',
            },
        },
        required: ['valueRef'],
    },
} as const

// ── suggest ──────────────────────────────────────────────────────────────

/**
 * Rows sampled to infer a range's shape. The refs that come back span the whole
 * range — the head is enough to tell labels from values, and reading a hundred
 * thousand cells to answer "which column is the header" would be absurd.
 */
const SAMPLE_ROWS = 50

interface CellFacts {
    isText: boolean
    isNumber: boolean
    text: string
    /** The cell's number-format code, which is how a date betrays itself. */
    formatter: string
}

/** True when the format code renders a date or a time. */
function looksTemporal(formatter: string): boolean {
    // Strip the parts of a format code that can hold literal letters, so a
    // currency like [$¥-804]#,##0 is not mistaken for a month/day pattern.
    const bare = formatter.replace(/\[[^\]]*\]|"[^"]*"/g, '')
    return /[ymdhs]/i.test(bare)
}

function factsOf(cell: CellInfo | undefined): CellFacts {
    const v = cell?.value
    if (!cell || v === undefined || v === 'empty')
        return {isText: false, isNumber: false, text: '', formatter: ''}
    return {
        isText: v.type === 'str' && v.value !== '',
        isNumber: v.type === 'number',
        text:
            v.type === 'str' ? v.value : String((v as {value: unknown}).value),
        formatter: cell.style?.formatter ?? '',
    }
}

/** Most of a run is numeric (blanks abstain rather than voting). */
function mostlyNumeric(run: readonly CellFacts[]): boolean {
    const seen = run.filter((c) => c.isNumber || c.isText)
    if (!seen.length) return false
    return seen.filter((c) => c.isNumber).length * 2 > seen.length
}

function anyText(run: readonly CellFacts[]): boolean {
    return run.some((c) => c.isText)
}

/**
 * Whether a run reads as category labels. Text is the obvious case, but a date
 * column is just as much a label — and dates are stored as *numbers*, so a
 * text-only test would look at `2026-01-01` and see a second numeric series.
 */
function looksLikeLabels(run: readonly CellFacts[]): boolean {
    return (
        anyText(run) ||
        run.some((c) => c.isNumber && looksTemporal(c.formatter))
    )
}

interface SuggestInput {
    sheetIdx: number
    range: string
    seriesIn?: 'columns' | 'rows'
}

export const suggestChart: Tool<SuggestInput, unknown> = {
    namespace: 'chart',
    name: 'suggest',
    description: [
        'Read a range and work out how it would become a chart: which part is the category labels, which parts are the series, and what kind of chart suits the shape.',
        'Returns references ready to hand to chart__insert. Call this first instead of guessing the layout — then adjust anything it got wrong before inserting.',
        'It reads only the first rows of the range to judge the shape; the references it returns cover the whole range.',
    ].join('\n'),
    mutates: false,
    confirmation: 'never',
    cost: 'cheap',
    inputSchema: {
        properties: {
            sheetIdx: {type: 'integer', description: 'Zero-based sheet index.'},
            range: {
                type: 'string',
                description: 'The data to chart, as an A1 range, e.g. A1:D10.',
            },
            seriesIn: {
                type: 'string',
                enum: ['columns', 'rows'],
                description:
                    'Where a series runs. "columns" (the default) means each column of numbers is a series; "rows" means each row is.',
            },
        },
        required: ['sheetIdx', 'range'],
    },
    handler: async (input, ctx) => {
        const client = asClient(ctx)
        const sheet = await sheetName(client, input.sheetIdx)
        const {parsed: full} = normalise(input.range, sheet, 'range')

        const sampleEndRow = Math.min(
            full.endRow,
            full.startRow + SAMPLE_ROWS - 1
        )
        const res = await client.getCells({
            sheetIdx: input.sheetIdx,
            startRow: full.startRow,
            startCol: full.startCol,
            endRow: sampleEndRow,
            endCol: full.endCol,
        })
        if (isErrorMessage(res)) throw new Error(`chart suggest: ${res.msg}`)
        const cells = res as readonly CellInfo[]

        const width = full.endCol - full.startCol + 1
        const height = sampleEndRow - full.startRow + 1
        // getCells is row-major over the requested rectangle.
        let grid: CellFacts[][] = []
        for (let r = 0; r < height; r++) {
            const row: CellFacts[] = []
            for (let c = 0; c < width; c++)
                row.push(factsOf(cells[r * width + c]))
            grid.push(row)
        }
        const byRows = input.seriesIn === 'rows'
        if (byRows) {
            // Transpose so the rest of the inference only knows "columns".
            grid = Array.from({length: width}, (_, c) =>
                Array.from({length: height}, (_, r) => grid[r][c])
            )
        }
        // After the optional transpose these are the logical extents; the refs
        // built at the end map them back to real rows and columns.
        const logicalCols = byRows ? height : width
        const logicalRows = byRows ? width : height
        const fullLogicalRows = byRows ? width : full.endRow - full.startRow + 1

        const col = (c: number) => grid.map((row) => row[c])
        const cellAt = (r: number, c: number) =>
            grid[r]?.[c] ?? {
                isText: false,
                isNumber: false,
                text: '',
                formatter: '',
            }

        // The same rule the spreadsheet's own insert uses: the corner cell
        // votes for neither edge. A table with row labels but no header row
        // would otherwise lose its first row of data to the series names.
        const labelCol =
            logicalCols > 1 &&
            (logicalRows > 1
                ? looksLikeLabels(col(0).slice(1))
                : looksLikeLabels(col(0).slice(0, 1)))
        const dataStartCol = labelCol ? 1 : 0
        const headerRow =
            logicalRows > 1 &&
            Array.from({length: logicalCols - dataStartCol}, (_, i) =>
                cellAt(0, dataStartCol + i)
            ).some((c) => c.isText)
        const dataStartRow = headerRow ? 1 : 0

        // A series has to be numbers; a stray text column is not one.
        const seriesCols: number[] = []
        for (let c = dataStartCol; c < logicalCols; c++)
            if (mostlyNumeric(col(c).slice(dataStartRow))) seriesCols.push(c)

        /** Build a whole-range ref for one logical column. */
        const refForCol = (c: number): string => {
            const from = dataStartRow
            const to = fullLogicalRows - 1
            const r: ParsedRef = byRows
                ? {
                      startRow: full.startRow + c,
                      endRow: full.startRow + c,
                      startCol: full.startCol + from,
                      endCol: full.startCol + to,
                  }
                : {
                      startRow: full.startRow + from,
                      endRow: full.startRow + to,
                      startCol: full.startCol + c,
                      endCol: full.startCol + c,
                  }
            return formatRef(sheet, r)
        }

        const series = seriesCols.map((c) => ({
            name: headerRow ? cellAt(0, c).text || undefined : undefined,
            valueRef: refForCol(c),
        }))
        const categoriesRef = labelCol ? refForCol(0) : undefined

        // What kind suits the shape. Deliberately few rules, each stated, so
        // the model can disagree with a reason rather than a hunch.
        const categoryCount = fullLogicalRows - dataStartRow
        const temporalCategories =
            labelCol &&
            col(0)
                .slice(dataStartRow)
                .some((c) => looksTemporal(c.formatter))
        let chartType = 'col'
        let why = 'several series over categories'
        if (!series.length) {
            chartType = 'col'
            why = 'no numeric series found — check the range'
        } else if (!labelCol && series.length === 2) {
            chartType = 'scatter'
            why = 'two numeric columns and no labels: X against Y'
        } else if (temporalCategories) {
            chartType = 'line'
            why = 'the categories are dates, so a line reads as a trend'
        } else if (
            series.length === 1 &&
            categoryCount >= 2 &&
            categoryCount <= 8
        ) {
            chartType = 'pie'
            why = 'one series over a handful of categories: parts of a whole'
        } else if (series.length === 1) {
            chartType = 'col'
            why = 'a single series over many categories'
        }

        const skipped = logicalCols - dataStartCol - series.length
        return {
            data: {
                suggestion: {
                    chartType,
                    why,
                    categoriesRef: categoriesRef ?? null,
                    series,
                },
                detected: {
                    series_in: byRows ? 'rows' : 'columns',
                    has_header: headerRow,
                    has_label_column: labelCol,
                    category_count: categoryCount,
                    non_numeric_columns_skipped: skipped,
                    sampled_rows: Math.min(SAMPLE_ROWS, height),
                },
            },
            display: series.length
                ? `Suggests ${chartType}: ${series.length} series over ${categoryCount} categories`
                : 'No numeric series found in that range',
        }
    },
}

// ── list ─────────────────────────────────────────────────────────────────

export const listCharts: Tool<{sheetIdx: number}, unknown> = {
    namespace: 'chart',
    name: 'list',
    description:
        'List the charts on a sheet — id, kind, title, the ranges each series reads, and where the chart sits. Call this before updating or deleting one.',
    mutates: false,
    confirmation: 'never',
    inputSchema: {
        properties: {
            sheetIdx: {type: 'integer', description: 'Zero-based sheet index.'},
        },
        required: ['sheetIdx'],
    },
    handler: async (input, ctx) => {
        const res = await asClient(ctx).getCharts({sheetIdx: input.sheetIdx})
        if (isErrorMessage(res)) throw new Error(`chart list: ${res.msg}`)
        const charts = (res as readonly ChartInfo[]).map((c) => ({
            chart_id: c.chartId,
            type: c.chartType,
            title: c.title ?? null,
            stacked: c.stacked,
            legend: c.legendPos ?? 'none',
            anchor: `${colToA1(c.fromCol)}${c.fromRow + 1}`,
            categories_ref: c.catRef ?? null,
            series: c.series.map((s) => ({
                name: s.name ?? null,
                value_ref: s.valRef ?? null,
                size_ref: s.sizeRef ?? null,
                point_count: s.values.length,
            })),
        }))
        return {
            data: {charts},
            display: `${charts.length} chart(s)`,
        }
    },
}

// ── insert ───────────────────────────────────────────────────────────────

interface InsertInput {
    sheetIdx: number
    chartType: (typeof CHART_TYPES)[number]
    series: ReadonlyArray<{
        name?: string
        valueRef: string
        sizeRef?: string
        color?: string
        seriesType?: string
    }>
    categoriesRef?: string
    title?: string
    anchor?: string
    sizeInCells?: {rows?: number; cols?: number}
}

export const insertChart: Tool<InsertInput, {chart_id: string}> = {
    namespace: 'chart',
    name: 'insert',
    description: [
        'Insert a chart that reads its values live from the given ranges — editing those cells later updates the chart.',
        "Look at the data first so the series are right: a column of labels belongs in categoriesRef, each column of numbers is one series, and its header is that series' name.",
        'References are A1 (B2:B10, or Sheet2!B2:B10 to read another sheet). The chart is placed below the data unless `anchor` says otherwise.',
    ].join('\n'),
    mutates: true,
    confirmation: 'always',
    inputSchema: {
        properties: {
            sheetIdx: {
                type: 'integer',
                description: 'Sheet the chart is placed on (zero-based).',
            },
            chartType: {
                type: 'string',
                enum: CHART_TYPES,
                description:
                    'col = vertical bars, bar = horizontal. pie/doughnut plot one series. scatter/bubble take numeric X from categoriesRef. stock needs 4 series (open/high/low/close) or 3 (high/low/close). surface plots a grid, one series per row.',
            },
            series: SERIES_SCHEMA,
            categoriesRef: {
                type: 'string',
                description:
                    'A1 range of the category labels (the X axis), e.g. A2:A10. For scatter/bubble these are the numeric X values.',
            },
            title: {type: 'string', description: 'Chart title.'},
            anchor: {
                type: 'string',
                description:
                    "Top-left cell of the chart, e.g. 'H2'. Defaults to two rows below the data.",
            },
            sizeInCells: {
                type: 'object',
                description: 'Chart size in cells. Defaults to 15 × 8.',
                properties: {
                    rows: {type: 'integer', minimum: 1},
                    cols: {type: 'integer', minimum: 1},
                },
            },
        },
        required: ['sheetIdx', 'chartType', 'series'],
    },
    handler: async (input, ctx) => {
        const client = asClient(ctx)
        if (!input.series.length)
            throw new Error('chart insert: at least one series is required.')
        const sheet = await sheetName(client, input.sheetIdx)

        const series = input.series.map((s, i) => {
            const {ref, parsed} = normalise(
                s.valueRef,
                sheet,
                `series[${i}].valueRef`
            )
            return {
                name: s.name,
                valueRef: ref,
                color: s.color?.replace(/^#/, ''),
                seriesType: s.seriesType,
                sizeRef: s.sizeRef
                    ? normalise(s.sizeRef, sheet, `series[${i}].sizeRef`).ref
                    : undefined,
                parsed,
            }
        })
        const categoriesRef = input.categoriesRef
            ? normalise(input.categoriesRef, sheet, 'categoriesRef').ref
            : undefined

        // Below the data by default, so a fresh chart never lands on top of
        // the numbers it plots.
        const dataBottom = Math.max(...series.map((s) => s.parsed.endRow))
        const dataLeft = Math.min(...series.map((s) => s.parsed.startCol))
        let fromRow = dataBottom + 2
        let fromCol = dataLeft
        if (input.anchor) {
            const at = parseRef(input.anchor)
            if (!at)
                throw new Error(
                    `chart insert: anchor "${input.anchor}" is not a cell reference (e.g. H2).`
                )
            fromRow = at.startRow
            fromCol = at.startCol
        }
        const rows = Math.max(1, input.sizeInCells?.rows ?? 15)
        const cols = Math.max(1, input.sizeInCells?.cols ?? 8)

        const chartId = newChartId()
        await commit(
            client,
            {
                type: 'createChart',
                value: {
                    sheetIdx: input.sheetIdx,
                    chartId,
                    chartType: input.chartType,
                    fromRow,
                    fromCol,
                    fromColOff: 0,
                    fromRowOff: 0,
                    toRow: fromRow + rows,
                    toCol: fromCol + cols,
                    toColOff: 0,
                    toRowOff: 0,
                    title: input.title,
                    categoriesRef,
                    series: series.map((s) => ({
                        name: s.name,
                        valueRef: s.valueRef,
                        color: s.color,
                        sizeRef: s.sizeRef,
                        seriesType: s.seriesType,
                    })),
                },
            },
            'chart insert'
        )
        return {
            data: {chart_id: chartId},
            display: `Inserted ${input.chartType} chart at ${colToA1(fromCol)}${
                fromRow + 1
            }`,
        }
    },
}

// ── from a block ─────────────────────────────────────────────────────────

/**
 * Where a block keeps a thing, given its schema.
 *
 * A block is addressed by its schema, not by cell coordinates: a field's `idx`
 * is its position on the *field axis*, and that axis differs per schema type —
 * for a `row` schema records are rows and fields are columns, for a `col`
 * schema it is the other way round. Reading `idx` as "column" would silently
 * chart the wrong cells on a col-schema block.
 *
 * `keys[].idx` is the position of each record on the other axis. Every line of
 * a block is a record — the header that named the fields sits outside the block
 * — so the keys span it.
 *
 * The ranges themselves are NOT computed here: they are the engine's job, which
 * recomputes them from the block on every read. This is only what is needed to
 * reject a bad field name with a useful message and to put the chart somewhere
 * that is not on top of the block.
 */
interface BlockGeometry {
    /** Absolute row/col of the block's top-left. */
    rowStart: number
    colStart: number
    /** Field name → offset on the field axis. */
    fieldOffset: Map<string, number>
    /** Record offsets on the record axis, ascending. */
    recordOffsets: number[]
    /** True for a `row` schema: fields are columns, records are rows. */
    fieldsAreColumns: boolean
    keyValues: string[]
    schemaName: string
}

async function blockGeometry(
    client: Client,
    sheetIdx: number,
    blockId: number
): Promise<BlockGeometry> {
    const sheetId = await client.getSheetId({sheetIdx})
    if (isErrorMessage(sheetId)) throw new Error(`no such sheet: ${sheetIdx}`)
    const info = await client.getBlockInfo({
        sheetId: sheetId as number,
        blockId,
    })
    if (isErrorMessage(info)) throw new Error(`chart from_block: ${info.msg}`)
    const b = info as BlockInfo
    const schema = b.schema
    if (!schema)
        throw new Error(
            `block ${blockId} has no schema, so it has no fields to chart. Use chart__suggest on its cell range instead.`
        )
    if (schema.schemaType === 'random')
        throw new Error(
            `block ${blockId} uses a "random" schema, which has no regular records or fields. Chart its cell range with chart__suggest instead.`
        )
    const fieldsAreColumns = schema.schemaType === 'row'
    const recordOffsets = schema.keys.map((k) => k.idx).sort((a, b) => a - b)
    return {
        rowStart: b.rowStart,
        colStart: b.colStart,
        fieldOffset: new Map(schema.fields.map((f) => [f.field, f.idx])),
        recordOffsets: recordOffsets.length
            ? recordOffsets
            : // No keys: fall back to the whole block on the record axis.
              Array.from(
                  {length: fieldsAreColumns ? b.rowCnt : b.colCnt},
                  (_, i) => i
              ),
        fieldsAreColumns,
        keyValues: schema.keys.map((k) => k.key),
        schemaName: schema.name,
    }
}

interface FromBlockInput {
    sheetIdx: number
    blockId: number
    valueFields: readonly string[]
    categoryField?: string
    chartType?: (typeof CHART_TYPES)[number]
    title?: string
    anchor?: string
    sizeInCells?: {rows?: number; cols?: number}
}

export const chartFromBlock: Tool<
    FromBlockInput,
    {chart_id: string; bound_to_block: number}
> = {
    namespace: 'chart',
    name: 'from_block',
    description: [
        'Chart a block by naming its fields, instead of working out which cells they occupy.',
        'The chart stays bound to the block: it plots whatever the named fields hold, so records added to the block later appear on their own and inserting rows or columns cannot leave it pointing at the wrong cells. A col-schema block works the same way as a row-schema one.',
        'Use `edit__describe_block` or `inspect` first if you do not know the field names. Blocks with a "random" schema have no field axis and cannot be charted this way — chart their cell range with chart__insert instead.',
        'Fields are held by name. Renaming one breaks the link (the series goes empty); moving its column does not.',
    ].join('\n'),
    mutates: true,
    confirmation: 'always',
    inputSchema: {
        properties: {
            sheetIdx: {type: 'integer', description: 'Zero-based sheet index.'},
            blockId: {type: 'integer'},
            valueFields: {
                type: 'array',
                description: 'Field names to plot, one series each, in order.',
                items: {type: 'string'},
                minItems: 1,
            },
            categoryField: {
                type: 'string',
                description:
                    "Field whose values label the categories (the X axis). The block's key column is not addressable as a range, so name the field that reads as a label. Omitted, the categories are just 1..n.",
            },
            chartType: {
                type: 'string',
                enum: CHART_TYPES,
                description: 'Defaults to col.',
            },
            title: {
                type: 'string',
                description: "Defaults to the block's schema name.",
            },
            anchor: {
                type: 'string',
                description:
                    'Top-left cell of the chart. Defaults to two rows below the block.',
            },
            sizeInCells: {
                type: 'object',
                properties: {
                    rows: {type: 'integer', minimum: 1},
                    cols: {type: 'integer', minimum: 1},
                },
            },
        },
        required: ['sheetIdx', 'blockId', 'valueFields'],
    },
    handler: async (input, ctx) => {
        const client = asClient(ctx)
        if (!input.valueFields.length)
            throw new Error('chart from_block: name at least one field.')
        const g = await blockGeometry(client, input.sheetIdx, input.blockId)

        // Checked here rather than left to the engine: a misspelt field would
        // otherwise come back as a chart with an empty series, and the list of
        // real names is the useful part of the answer.
        const checkField = (field: string) => {
            if (!g.fieldOffset.has(field)) {
                const known = [...g.fieldOffset.keys()].join(', ')
                throw new Error(
                    `block ${
                        input.blockId
                    } has no field "${field}". Its fields are: ${
                        known || '(none)'
                    }.`
                )
            }
        }
        input.valueFields.forEach(checkField)
        if (input.categoryField) checkField(input.categoryField)

        // Below the block by default, so it never lands on the records.
        const lastRecord = g.recordOffsets[g.recordOffsets.length - 1]
        let fromRow = g.fieldsAreColumns
            ? g.rowStart + lastRecord + 2
            : g.rowStart + Math.max(...[...g.fieldOffset.values()]) + 2
        let fromCol = g.colStart
        if (input.anchor) {
            const at = parseRef(input.anchor)
            if (!at)
                throw new Error(
                    `chart from_block: anchor "${input.anchor}" is not a cell reference (e.g. H2).`
                )
            fromRow = at.startRow
            fromCol = at.startCol
        }
        const rows = Math.max(1, input.sizeInCells?.rows ?? 15)
        const cols = Math.max(1, input.sizeInCells?.cols ?? 8)

        const chartId = newChartId()
        await commit(
            client,
            {
                type: 'createChart',
                value: {
                    sheetIdx: input.sheetIdx,
                    chartId,
                    chartType: input.chartType ?? 'col',
                    fromRow,
                    fromCol,
                    fromColOff: 0,
                    fromRowOff: 0,
                    toRow: fromRow + rows,
                    toCol: fromCol + cols,
                    toColOff: 0,
                    toRowOff: 0,
                    title: input.title ?? g.schemaName ?? undefined,
                    // The ranges are deliberately not stated: the engine
                    // derives them from the block, and keeps deriving them, so
                    // the chart follows the block instead of a snapshot of it.
                    series: [],
                    blockSource: {
                        blockId: input.blockId,
                        categoryField: input.categoryField,
                        valueFields: input.valueFields,
                    },
                },
            },
            'chart from_block'
        )
        return {
            data: {
                chart_id: chartId,
                bound_to_block: input.blockId,
                value_fields: input.valueFields,
                category_field: input.categoryField ?? null,
                record_count: g.recordOffsets.length,
                // What identifies each record, so the answer can name them
                // even though the key column itself cannot be referenced.
                keys: g.keyValues.slice(0, 20),
            },
            display: `Charted ${input.valueFields.length} field(s) of block ${input.blockId} over ${g.recordOffsets.length} record(s), bound to the block`,
        }
    },
}

// ── update ───────────────────────────────────────────────────────────────

interface UpdateInput {
    sheetIdx: number
    chartId: string
    chartType?: (typeof CHART_TYPES)[number]
    title?: string
    legendPos?: 'top' | 'bottom' | 'left' | 'right' | 'none'
    stacked?: boolean
    catAxisTitle?: string
    valAxisTitle?: string
    showDataLabels?: boolean
    showPercentLabels?: boolean
    numFmt?: string
    categoriesRef?: string
    series?: InsertInput['series']
    valAxisScale?: {
        min?: number
        max?: number
        majorUnit?: number
        logBase?: number
        reversed?: boolean
    }
}

export const updateChart: Tool<UpdateInput, {ok: true}> = {
    namespace: 'chart',
    name: 'update',
    description: [
        'Reconfigure an existing chart in place, keeping its position. Anything left out keeps its current value; an empty string clears a text field (title, axis title, number format).',
        'Get the chart_id from chart__list first.',
    ].join('\n'),
    mutates: true,
    confirmation: 'always',
    inputSchema: {
        properties: {
            sheetIdx: {type: 'integer'},
            chartId: {
                type: 'string',
                description: 'From chart__list.',
            },
            chartType: {type: 'string', enum: CHART_TYPES},
            title: {type: 'string', description: 'Empty string clears it.'},
            legendPos: {
                type: 'string',
                enum: ['top', 'bottom', 'left', 'right', 'none'],
            },
            stacked: {
                type: 'boolean',
                description: 'Stack the series. Ignored by pie and scatter.',
            },
            catAxisTitle: {type: 'string'},
            valAxisTitle: {type: 'string'},
            showDataLabels: {
                type: 'boolean',
                description: "Print each point's value next to it.",
            },
            showPercentLabels: {
                type: 'boolean',
                description: 'Add the percentage to labels (pie-like charts).',
            },
            numFmt: {
                type: 'string',
                description:
                    'Excel number-format code for the value axis and labels, e.g. "#,##0.00" or "0%". Empty falls back to the source cells\' own format.',
            },
            categoriesRef: {
                type: 'string',
                description: 'Re-point the category labels (A1 range).',
            },
            series: SERIES_SCHEMA,
            valAxisScale: {
                type: 'object',
                description:
                    'Replaces the whole value-axis scale — fields left out become automatic, which is how a fixed bound is cleared.',
                properties: {
                    min: {type: 'number'},
                    max: {type: 'number'},
                    majorUnit: {
                        type: 'number',
                        description: 'Spacing between gridlines.',
                    },
                    logBase: {
                        type: 'number',
                        description: 'Log scale base (2–1000).',
                    },
                    reversed: {type: 'boolean'},
                },
            },
        },
        required: ['sheetIdx', 'chartId'],
    },
    handler: async (input, ctx) => {
        const client = asClient(ctx)
        const sheet = await sheetName(client, input.sheetIdx)
        const series = input.series?.map((s, i) => ({
            name: s.name,
            valueRef: normalise(s.valueRef, sheet, `series[${i}].valueRef`).ref,
            color: s.color?.replace(/^#/, ''),
            seriesType: s.seriesType,
            sizeRef: s.sizeRef
                ? normalise(s.sizeRef, sheet, `series[${i}].sizeRef`).ref
                : undefined,
        }))
        await commit(
            client,
            {
                type: 'updateChart',
                value: {
                    sheetIdx: input.sheetIdx,
                    chartId: input.chartId,
                    chartType: input.chartType,
                    title: input.title,
                    legendPos: input.legendPos,
                    stacked: input.stacked,
                    catAxisTitle: input.catAxisTitle,
                    valAxisTitle: input.valAxisTitle,
                    showDataLabels: input.showDataLabels,
                    showPercentLabels: input.showPercentLabels,
                    numFmt: input.numFmt,
                    categoriesRef: input.categoriesRef
                        ? normalise(input.categoriesRef, sheet, 'categoriesRef')
                              .ref
                        : undefined,
                    series,
                    valAxisScale: input.valAxisScale
                        ? {
                              min: input.valAxisScale.min,
                              max: input.valAxisScale.max,
                              majorUnit: input.valAxisScale.majorUnit,
                              logBase: input.valAxisScale.logBase,
                              reversed: input.valAxisScale.reversed ?? false,
                          }
                        : undefined,
                },
            },
            'chart update'
        )
        return {data: {ok: true}, display: 'Chart updated'}
    },
}

// ── delete ───────────────────────────────────────────────────────────────

export const deleteChart: Tool<
    {sheetIdx: number; chartId: string},
    {ok: true}
> = {
    namespace: 'chart',
    name: 'delete',
    description:
        'Delete a chart. Get the chart_id from chart__list. Undoable, but it removes the chart and its formatting.',
    mutates: true,
    confirmation: 'destructive',
    inputSchema: {
        properties: {
            sheetIdx: {type: 'integer'},
            chartId: {type: 'string', description: 'From chart__list.'},
        },
        required: ['sheetIdx', 'chartId'],
    },
    handler: async (input, ctx) => {
        await commit(
            asClient(ctx),
            {type: 'deleteChart', value: input},
            'chart delete'
        )
        return {data: {ok: true}, display: 'Chart deleted'}
    },
}

export const CHART_TOOLS: Tool[] = [
    suggestChart as Tool,
    listCharts as Tool,
    insertChart as Tool,
    chartFromBlock as Tool,
    updateChart as Tool,
    deleteChart as Tool,
]
