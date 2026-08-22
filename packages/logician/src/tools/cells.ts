/**
 * Cell tools — general (non-block) read/write of arbitrary cells by
 * (sheet, row, col). The build/edit tools are block-shaped; these cover
 * ordinary spreadsheet work: "what's in B2:D10", "put 5 in A1", "clear this
 * range". Watson addresses cells by zero-based row/col; results echo A1 refs
 * so the model can talk about them naturally.
 */

import {isErrorMessage} from 'logisheets-web/pure'
import type {
    CellInfo,
    CellInput,
    Client,
    EditPayload,
    Transaction,
    Value,
} from 'logisheets-web/pure'
import type {JSONSchema, Tool, ToolContext} from '../tool.js'
import {transactionFailure} from './effect.js'

function asClient(ctx: ToolContext): Client {
    return ctx.workbook as Client
}

async function commit(
    client: Client,
    payloads: EditPayload[],
    label: string
): Promise<void> {
    const tx: Transaction = {payloads, undoable: true, temp: false}
    const result = await client.handleTransaction({transaction: tx})
    if (isErrorMessage(result)) throw new Error(`${label}: ${result.msg}`)
    if (result.status.type === 'err')
        throw transactionFailure(label, result)
}

/** A cell value in a form the model reads directly (null = empty). */
type ScalarValue = string | number | boolean | null

function valueToScalar(v: Value): ScalarValue {
    if (v === 'empty') return null
    switch (v.type) {
        case 'number':
            return v.value
        case 'str':
            return v.value
        case 'bool':
            return v.value
        case 'error':
            // The engine's error value already carries its `#` — `#DIV/0!`,
            // not `DIV/0!`. Prefixing another one produced `##DIV/0!`, which
            // matches nothing an agent or a test would look for.
            return v.value
        default:
            return null
    }
}

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
function a1(row: number, col: number): string {
    return `${colToA1(col)}${row + 1}`
}

/** cap on how many cells one call may read/clear, to keep tool calls bounded. */
const MAX_RANGE = 500
/** cap on how many cells one set_cells call may write. */
const MAX_WRITE = 200

// ---------------------------------------------------------------------------
// get_cells — read the values (and formulas) in a rectangular range
// ---------------------------------------------------------------------------

interface RangeInput {
    sheetIdx: number
    startRow: number
    startCol: number
    endRow: number
    endCol: number
}

const RANGE_SCHEMA: JSONSchema['properties'] = {
    sheetIdx: {type: 'integer', description: 'Zero-based sheet index.'},
    startRow: {type: 'integer', description: 'Zero-based first row.'},
    startCol: {type: 'integer', description: 'Zero-based first column.'},
    endRow: {type: 'integer', description: 'Zero-based last row (inclusive).'},
    endCol: {type: 'integer', description: 'Zero-based last column (inclusive).'},
}

function normalizeRange(i: RangeInput): RangeInput {
    return {
        sheetIdx: i.sheetIdx,
        startRow: Math.min(i.startRow, i.endRow),
        startCol: Math.min(i.startCol, i.endCol),
        endRow: Math.max(i.startRow, i.endRow),
        endCol: Math.max(i.startCol, i.endCol),
    }
}

interface CellReadout {
    ref: string
    value: ScalarValue
    /** Present only when the cell holds a formula. */
    formula?: string
}

export const getCells: Tool<RangeInput, {range: string; cells: CellReadout[]}> =
    {
        namespace: 'cell',
        name: 'get_cells',
        description: [
            'Read the values (and formulas) in a rectangular range of cells, addressed by zero-based (sheetIdx, startRow, startCol, endRow, endCol).',
            'Returns only the non-empty cells, each with its A1 ref, value, and formula (if any). Use this for ordinary "what is in these cells" questions; for a single computed result you can also use build eval_formula.',
            `Reads at most ${MAX_RANGE} cells per call — narrow the range if it is bigger.`,
        ].join('\n'),
        mutates: false,
        confirmation: 'never',
        inputSchema: {properties: RANGE_SCHEMA, required: Object.keys(RANGE_SCHEMA)},
        handler: async (input, ctx) => {
            const r = normalizeRange(input)
            const count = (r.endRow - r.startRow + 1) * (r.endCol - r.startCol + 1)
            if (count > MAX_RANGE)
                throw new Error(
                    `range covers ${count} cells (max ${MAX_RANGE}); narrow it`
                )
            const client = asClient(ctx)
            // getCells (not getCellInfos — the latter is unimplemented in the
            // engine worker) returns the range's CellInfo[] row-major.
            const res = await client.getCells({
                sheetIdx: r.sheetIdx,
                startRow: r.startRow,
                startCol: r.startCol,
                endRow: r.endRow,
                endCol: r.endCol,
            })
            if (isErrorMessage(res)) throw new Error(`get_cells: ${res.msg}`)
            const infos = res as readonly CellInfo[]
            const width = r.endCol - r.startCol + 1
            const cells: CellReadout[] = []
            infos.forEach((info, i) => {
                const value = valueToScalar(info.value)
                const formula = info.formula || undefined
                if (value === null && !formula) return // skip empties → compact
                const row = r.startRow + Math.floor(i / width)
                const col = r.startCol + (i % width)
                const out: CellReadout = {ref: a1(row, col), value}
                if (formula) out.formula = formula
                cells.push(out)
            })
            return {
                data: {range: `${a1(r.startRow, r.startCol)}:${a1(r.endRow, r.endCol)}`, cells},
                display: `Read ${cells.length} non-empty cell(s) in ${a1(r.startRow, r.startCol)}:${a1(r.endRow, r.endCol)}`,
            }
        },
    }

// ---------------------------------------------------------------------------
// set_cells — write arbitrary cells (values or formulas)
// ---------------------------------------------------------------------------

interface CellWrite {
    row: number
    col: number
    content: string | number | boolean | null
}

interface SetCellsInput {
    sheetIdx: number
    cells: ReadonlyArray<CellWrite>
}

function contentToString(v: CellWrite['content']): string {
    if (v === null || v === undefined) return ''
    if (typeof v === 'string') return v
    return String(v)
}

export const setCells: Tool<SetCellsInput, {written: number}> = {
    namespace: 'cell',
    name: 'set_cells',
    description: [
        'Write one or more arbitrary cells on a sheet in a single atomic transaction (one undo step). Each cell is addressed by zero-based row/col.',
        "Content is a literal (string / number / boolean) or a formula prefixed with '='. null or '' clears the cell.",
        'For cells that belong to a block, prefer edit set_block_cells (it respects the schema); use this for plain, non-block cells.',
        `At most ${MAX_WRITE} cells per call.`,
    ].join('\n'),
    mutates: true,
    confirmation: 'always',
    inputSchema: {
        properties: {
            sheetIdx: {type: 'integer', description: 'Zero-based sheet index.'},
            cells: {
                type: 'array',
                minItems: 1,
                items: {
                    type: 'object',
                    properties: {
                        row: {type: 'integer', description: 'Zero-based row.'},
                        col: {type: 'integer', description: 'Zero-based column.'},
                        content: {
                            type: ['string', 'number', 'boolean', 'null'],
                            description:
                                "Literal value, or a formula starting with '='. null clears.",
                        },
                    },
                    required: ['row', 'col', 'content'],
                },
            },
        },
        required: ['sheetIdx', 'cells'],
    },
    handler: async (input, ctx) => {
        if (input.cells.length > MAX_WRITE)
            throw new Error(
                `${input.cells.length} cells (max ${MAX_WRITE}) — split into batches`
            )
        const payloads: EditPayload[] = input.cells.map((c) => ({
            type: 'cellInput',
            value: {
                sheetIdx: input.sheetIdx,
                row: c.row,
                col: c.col,
                content: contentToString(c.content),
            },
        }))
        await commit(asClient(ctx), payloads, 'set_cells')
        return {
            data: {written: input.cells.length},
            display: `Wrote ${input.cells.length} cell(s)`,
        }
    },
}

// ---------------------------------------------------------------------------
// clear_cells — clear the values in a rectangular range
// ---------------------------------------------------------------------------

export const clearCells: Tool<RangeInput, {cleared: number}> = {
    namespace: 'cell',
    name: 'clear_cells',
    description: [
        'Clear the contents of every cell in a rectangular range, addressed by zero-based (sheetIdx, startRow, startCol, endRow, endCol). One undo step.',
        `Clears at most ${MAX_RANGE} cells per call.`,
    ].join('\n'),
    mutates: true,
    confirmation: 'always',
    inputSchema: {properties: RANGE_SCHEMA, required: Object.keys(RANGE_SCHEMA)},
    handler: async (input, ctx) => {
        const r = normalizeRange(input)
        const count = (r.endRow - r.startRow + 1) * (r.endCol - r.startCol + 1)
        if (count > MAX_RANGE)
            throw new Error(
                `range covers ${count} cells (max ${MAX_RANGE}); narrow it`
            )
        const payloads: EditPayload[] = []
        for (let row = r.startRow; row <= r.endRow; row++)
            for (let col = r.startCol; col <= r.endCol; col++)
                payloads.push({
                    type: 'cellClear',
                    value: {sheetIdx: r.sheetIdx, row, col},
                })
        await commit(asClient(ctx), payloads, 'clear_cells')
        return {
            data: {cleared: count},
            display: `Cleared ${a1(r.startRow, r.startCol)}:${a1(r.endRow, r.endCol)}`,
        }
    },
}

// ---------------------------------------------------------------------------
// fill — autofill a destination range from a source range (drag-fill)
// ---------------------------------------------------------------------------

interface FillInput {
    sheetIdx: number
    srcStartRow: number
    srcStartCol: number
    srcEndRow: number
    srcEndCol: number
    dstStartRow: number
    dstStartCol: number
    dstEndRow: number
    dstEndCol: number
}

export const fillCells: Tool<FillInput, {filled: number}> = {
    namespace: 'cell',
    name: 'fill',
    description: [
        'Autofill a destination range from a source range — the "drag the fill handle" operation. Continues number/date series, copies values, and shifts relative formula references. All coordinates zero-based.',
        'The destination should extend the source (e.g. src A1:A1, dst A2:A10 to fill down from A1; or src A1:B1, dst A1:B10 to fill that pair down).',
    ].join('\n'),
    mutates: true,
    confirmation: 'always',
    inputSchema: {
        properties: {
            sheetIdx: {type: 'integer'},
            srcStartRow: {type: 'integer'},
            srcStartCol: {type: 'integer'},
            srcEndRow: {type: 'integer'},
            srcEndCol: {type: 'integer'},
            dstStartRow: {type: 'integer'},
            dstStartCol: {type: 'integer'},
            dstEndRow: {type: 'integer'},
            dstEndCol: {type: 'integer'},
        },
        required: [
            'sheetIdx',
            'srcStartRow',
            'srcStartCol',
            'srcEndRow',
            'srcEndCol',
            'dstStartRow',
            'dstStartCol',
            'dstEndRow',
            'dstEndCol',
        ],
    },
    handler: async (input, ctx) => {
        const client = asClient(ctx)
        // The engine predicts the filled cells (series continuation, relative
        // formula shifting), then we commit them as ordinary cell inputs.
        const predicted = await client.predictFill(input)
        if (isErrorMessage(predicted))
            throw new Error(`fill: ${predicted.msg}`)
        const inputs = predicted as readonly CellInput[]
        const payloads: EditPayload[] = inputs.map((ci) => ({
            type: 'cellInput',
            value: ci,
        }))
        await commit(client, payloads, 'fill')
        return {data: {filled: payloads.length}, display: `Filled ${payloads.length} cell(s)`}
    },
}

export const CELL_TOOLS: Tool[] = [
    getCells as Tool,
    setCells as Tool,
    clearCells as Tool,
    fillCells as Tool,
]
