/**
 * Structure tools — sheet-level shape: insert/delete rows & columns, set row
 * height / column width, and delete/rename whole sheets. (Use build create_sheet
 * to add a sheet; block-local row ops live in the build tools.)
 */

import {isErrorMessage} from 'logisheets-web/pure'
import type {Client, EditPayload, Transaction} from 'logisheets-web/pure'
import type {Tool, ToolContext} from '../tool.js'

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
    if (r.status.type === 'err')
        throw new Error(`${label}: status code ${r.status.value}`)
}

interface LineRange {
    sheetIdx: number
    start: number
    count: number
}
const LINE_RANGE_SCHEMA = {
    properties: {
        sheetIdx: {type: 'integer', description: 'Zero-based sheet index.'},
        start: {type: 'integer', description: 'Zero-based first row/column.'},
        count: {type: 'integer', description: 'How many to insert/delete.'},
    },
    required: ['sheetIdx', 'start', 'count'],
} as const

function lineTool(
    name: string,
    payloadType:
        | 'insertRows'
        | 'deleteRows'
        | 'insertCols'
        | 'deleteCols',
    desc: string
): Tool<LineRange, {ok: true}> {
    return {
        namespace: 'sheet',
        name,
        description: desc,
        mutates: true,
        confirmation: payloadType.startsWith('delete') ? 'destructive' : 'always',
        inputSchema: LINE_RANGE_SCHEMA,
        handler: async (input, ctx) => {
            await commit(
                asClient(ctx),
                {type: payloadType, value: input} as EditPayload,
                name
            )
            return {data: {ok: true}, display: `${name} ${input.count}`}
        },
    }
}

export const insertRows = lineTool(
    'insert_rows',
    'insertRows',
    'Insert `count` blank rows at zero-based `start` on a sheet (existing rows shift down).'
)
export const deleteRows = lineTool(
    'delete_rows',
    'deleteRows',
    'Delete `count` rows starting at zero-based `start` on a sheet.'
)
export const insertCols = lineTool(
    'insert_cols',
    'insertCols',
    'Insert `count` blank columns at zero-based `start` on a sheet (existing columns shift right).'
)
export const deleteCols = lineTool(
    'delete_cols',
    'deleteCols',
    'Delete `count` columns starting at zero-based `start` on a sheet.'
)

export const setColWidth: Tool<
    {sheetIdx: number; col: number; width: number},
    {ok: true}
> = {
    namespace: 'sheet',
    name: 'set_col_width',
    description: 'Set a column\'s width (in pixels), zero-based column index.',
    mutates: true,
    confirmation: 'never',
    inputSchema: {
        properties: {
            sheetIdx: {type: 'integer'},
            col: {type: 'integer'},
            width: {type: 'number', description: 'Width in pixels.'},
        },
        required: ['sheetIdx', 'col', 'width'],
    },
    handler: async (input, ctx) => {
        await commit(
            asClient(ctx),
            {type: 'setColWidth', value: input},
            'set_col_width'
        )
        return {data: {ok: true}, display: `col ${input.col} → ${input.width}px`}
    },
}

export const setRowHeight: Tool<
    {sheetIdx: number; row: number; height: number},
    {ok: true}
> = {
    namespace: 'sheet',
    name: 'set_row_height',
    description: "Set a row's height (in pixels), zero-based row index.",
    mutates: true,
    confirmation: 'never',
    inputSchema: {
        properties: {
            sheetIdx: {type: 'integer'},
            row: {type: 'integer'},
            height: {type: 'number', description: 'Height in pixels.'},
        },
        required: ['sheetIdx', 'row', 'height'],
    },
    handler: async (input, ctx) => {
        await commit(
            asClient(ctx),
            {type: 'setRowHeight', value: input},
            'set_row_height'
        )
        return {data: {ok: true}, display: `row ${input.row} → ${input.height}px`}
    },
}

export const deleteSheet: Tool<{idx: number}, {ok: true}> = {
    namespace: 'sheet',
    name: 'delete_sheet',
    description:
        'Delete a whole sheet by its zero-based index. Frees the sheet name for reuse.',
    mutates: true,
    confirmation: 'destructive',
    inputSchema: {
        properties: {idx: {type: 'integer', description: 'Zero-based sheet index.'}},
        required: ['idx'],
    },
    handler: async (input, ctx) => {
        await commit(
            asClient(ctx),
            {type: 'deleteSheet', value: input},
            'delete_sheet'
        )
        return {data: {ok: true}, display: `deleted sheet ${input.idx}`}
    },
}

/** Hex → 8-digit ARGB string, no '#' (the engine's color format). */
function hexToArgb(hex: string): string {
    const h = hex.replace('#', '').toUpperCase()
    if (h.length === 8) return h
    if (h.length === 6) return `FF${h}`
    return 'FF000000'
}

export const setSheetColor: Tool<{idx: number; color: string}, {ok: true}> = {
    namespace: 'sheet',
    name: 'set_sheet_color',
    description: "Set a sheet's tab color (hex, e.g. \"#1976D2\"), by zero-based index.",
    mutates: true,
    confirmation: 'never',
    inputSchema: {
        properties: {
            idx: {type: 'integer', description: 'Zero-based sheet index.'},
            color: {type: 'string', description: 'Hex tab color.'},
        },
        required: ['idx', 'color'],
    },
    handler: async (input, ctx) => {
        await commit(
            asClient(ctx),
            {type: 'setSheetColor', value: {idx: input.idx, color: hexToArgb(input.color)}},
            'set_sheet_color'
        )
        return {data: {ok: true}, display: `tab color set`}
    },
}

export const setSheetVisible: Tool<
    {idx: number; visible: boolean},
    {ok: true}
> = {
    namespace: 'sheet',
    name: 'set_sheet_visible',
    description:
        'Show or hide a sheet by its zero-based index (visible=false hides it).',
    mutates: true,
    confirmation: 'always',
    inputSchema: {
        properties: {
            idx: {type: 'integer', description: 'Zero-based sheet index.'},
            visible: {type: 'boolean'},
        },
        required: ['idx', 'visible'],
    },
    handler: async (input, ctx) => {
        await commit(
            asClient(ctx),
            {type: 'setSheetVisible', value: input},
            'set_sheet_visible'
        )
        return {
            data: {ok: true},
            display: input.visible ? 'sheet shown' : 'sheet hidden',
        }
    },
}

export const renameSheet: Tool<
    {idx: number; newName: string},
    {ok: true}
> = {
    namespace: 'sheet',
    name: 'rename_sheet',
    description: 'Rename a sheet (by zero-based index) to `newName`.',
    mutates: true,
    confirmation: 'always',
    inputSchema: {
        properties: {
            idx: {type: 'integer', description: 'Zero-based sheet index.'},
            newName: {type: 'string'},
        },
        required: ['idx', 'newName'],
    },
    handler: async (input, ctx) => {
        await commit(
            asClient(ctx),
            {type: 'sheetRename', value: {idx: input.idx, newName: input.newName}},
            'rename_sheet'
        )
        return {data: {ok: true}, display: `renamed to ${input.newName}`}
    },
}

export const STRUCTURE_TOOLS: Tool[] = [
    insertRows as Tool,
    deleteRows as Tool,
    insertCols as Tool,
    deleteCols as Tool,
    setColWidth as Tool,
    setRowHeight as Tool,
    deleteSheet as Tool,
    renameSheet as Tool,
    setSheetColor as Tool,
    setSheetVisible as Tool,
]
