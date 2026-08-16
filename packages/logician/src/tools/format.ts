/**
 * Format tools — cell appearance (fill, font, borders, alignment, number
 * format) and merging. Applies a style to every cell in a range in one
 * transaction. Colors are accepted as ordinary hex ("#1976D2" or "1976D2");
 * the engine's two internal color formats (RGB object for fills, 8-hex ARGB
 * string for fonts/borders) are handled here.
 */

import {isErrorMessage} from 'logisheets-web/pure'
import type {
    Client,
    EditPayload,
    StyleUpdateType,
    Transaction,
} from 'logisheets-web/pure'
import type {Tool, ToolContext} from '../tool.js'

function asClient(ctx: ToolContext): Client {
    return ctx.workbook as Client
}
async function commit(
    client: Client,
    payloads: EditPayload[],
    label: string
): Promise<void> {
    const tx: Transaction = {payloads, undoable: true, temp: false}
    const r = await client.handleTransaction({transaction: tx})
    if (isErrorMessage(r)) throw new Error(`${label}: ${r.msg}`)
    if (r.status.type === 'err')
        throw new Error(`${label}: status code ${r.status.value}`)
}

/** "#RRGGBB" / "RRGGBB" / "AARRGGBB" → {red,green,blue} (fills). */
function hexToRgb(hex: string): {red: number; green: number; blue: number} {
    const h = hex.replace('#', '')
    const rgb = h.length === 8 ? h.slice(2) : h
    return {
        red: parseInt(rgb.slice(0, 2), 16) || 0,
        green: parseInt(rgb.slice(2, 4), 16) || 0,
        blue: parseInt(rgb.slice(4, 6), 16) || 0,
    }
}
/** Hex → 8-digit ARGB string, no '#' (fonts/borders). */
function hexToArgb(hex: string): string {
    const h = hex.replace('#', '').toUpperCase()
    if (h.length === 8) return h
    if (h.length === 6) return `FF${h}`
    return 'FF000000'
}

const MAX_RANGE = 500

interface FormatInput {
    sheetIdx: number
    startRow: number
    startCol: number
    endRow: number
    endCol: number
    bold?: boolean
    italic?: boolean
    fontColor?: string
    fontSize?: number
    fill?: string
    align?: 'left' | 'center' | 'right'
    valign?: 'top' | 'center' | 'bottom'
    numberFormat?: string
    border?: 'thin' | 'medium' | 'thick' | 'none'
    borderColor?: string
}

function buildStyle(i: FormatInput): StyleUpdateType {
    const ty: StyleUpdateType = {}
    if (i.bold !== undefined) ty.setFontBold = i.bold
    if (i.italic !== undefined) ty.setFontItalic = i.italic
    if (i.fontColor) ty.setFontColor = hexToArgb(i.fontColor)
    if (i.fontSize !== undefined) ty.setFontSize = i.fontSize
    if (i.fill)
        ty.setPatternFill = {patternType: 'solid', fgColor: hexToRgb(i.fill)}
    if (i.align || i.valign) {
        const a: Record<string, string> = {}
        if (i.align) a.horizontal = i.align
        if (i.valign) a.vertical = i.valign
        ty.setAlignment = a as StyleUpdateType['setAlignment']
    }
    if (i.numberFormat) ty.setNumFmt = i.numberFormat
    if (i.border) {
        const style = i.border as StyleUpdateType['setTopBorderStyle']
        const color = i.borderColor ? hexToArgb(i.borderColor) : 'FF0B0F19'
        ty.setTopBorderStyle = style
        ty.setBottomBorderStyle = style
        ty.setLeftBorderStyle = style
        ty.setRightBorderStyle = style
        if (i.border !== 'none') {
            ty.setTopBorderColor = color
            ty.setBottomBorderColor = color
            ty.setLeftBorderColor = color
            ty.setRightBorderColor = color
        }
    }
    return ty
}

export const formatCells: Tool<FormatInput, {formatted: number}> = {
    namespace: 'format',
    name: 'format_cells',
    description: [
        'Apply formatting to every cell in a rectangular range (zero-based sheetIdx/startRow/startCol/endRow/endCol). One transaction, one undo step.',
        'Set any of: bold, italic, fontColor (hex), fontSize, fill (hex background), align (left|center|right), valign (top|center|bottom), numberFormat (e.g. "0.00", "0%", "$#,##0.00"), border (thin|medium|thick|none) + optional borderColor (hex). Omitted fields are left unchanged.',
        `At most ${MAX_RANGE} cells per call.`,
    ].join('\n'),
    mutates: true,
    confirmation: 'always',
    inputSchema: {
        properties: {
            sheetIdx: {type: 'integer'},
            startRow: {type: 'integer'},
            startCol: {type: 'integer'},
            endRow: {type: 'integer'},
            endCol: {type: 'integer'},
            bold: {type: 'boolean'},
            italic: {type: 'boolean'},
            fontColor: {type: 'string', description: 'Hex, e.g. "#1976D2".'},
            fontSize: {type: 'number'},
            fill: {type: 'string', description: 'Hex background, e.g. "#FFF3CD".'},
            align: {type: 'string', enum: ['left', 'center', 'right']},
            valign: {type: 'string', enum: ['top', 'center', 'bottom']},
            numberFormat: {type: 'string'},
            border: {type: 'string', enum: ['thin', 'medium', 'thick', 'none']},
            borderColor: {type: 'string', description: 'Hex.'},
        },
        required: ['sheetIdx', 'startRow', 'startCol', 'endRow', 'endCol'],
    },
    handler: async (input, ctx) => {
        const startRow = Math.min(input.startRow, input.endRow)
        const endRow = Math.max(input.startRow, input.endRow)
        const startCol = Math.min(input.startCol, input.endCol)
        const endCol = Math.max(input.startCol, input.endCol)
        const count = (endRow - startRow + 1) * (endCol - startCol + 1)
        if (count > MAX_RANGE)
            throw new Error(`range covers ${count} cells (max ${MAX_RANGE})`)
        const ty = buildStyle(input)
        const payloads: EditPayload[] = []
        for (let row = startRow; row <= endRow; row++)
            for (let col = startCol; col <= endCol; col++)
                payloads.push({
                    type: 'cellStyleUpdate',
                    value: {sheetIdx: input.sheetIdx, row, col, ty},
                })
        await commit(asClient(ctx), payloads, 'format_cells')
        return {data: {formatted: count}, display: `Formatted ${count} cell(s)`}
    },
}

export const mergeCells: Tool<
    {sheetIdx: number; startRow: number; startCol: number; endRow: number; endCol: number},
    {merged: boolean}
> = {
    namespace: 'format',
    name: 'merge_cells',
    description:
        'Merge a rectangular range of cells into one (zero-based coordinates). The top-left cell keeps its value.',
    mutates: true,
    confirmation: 'always',
    inputSchema: {
        properties: {
            sheetIdx: {type: 'integer'},
            startRow: {type: 'integer'},
            startCol: {type: 'integer'},
            endRow: {type: 'integer'},
            endCol: {type: 'integer'},
        },
        required: ['sheetIdx', 'startRow', 'startCol', 'endRow', 'endCol'],
    },
    handler: async (input, ctx) => {
        await commit(
            asClient(ctx),
            [{type: 'mergeCells', value: input}],
            'merge_cells'
        )
        return {data: {merged: true}, display: 'Merged'}
    },
}

export const unmergeCells: Tool<
    {sheetIdx: number; row: number; col: number},
    {unmerged: boolean}
> = {
    namespace: 'format',
    name: 'unmerge_cells',
    description:
        'Split a merged region back into individual cells. Pass any cell inside the merged region (zero-based).',
    mutates: true,
    confirmation: 'always',
    inputSchema: {
        properties: {
            sheetIdx: {type: 'integer'},
            row: {type: 'integer'},
            col: {type: 'integer'},
        },
        required: ['sheetIdx', 'row', 'col'],
    },
    handler: async (input, ctx) => {
        await commit(
            asClient(ctx),
            [{type: 'splitMergedCells', value: input}],
            'unmerge_cells'
        )
        return {data: {unmerged: true}, display: 'Unmerged'}
    },
}

export const formatBrush: Tool<
    {
        srcSheetIdx: number
        srcRow: number
        srcCol: number
        dstSheetIdx: number
        dstRowStart: number
        dstColStart: number
        dstRowEnd: number
        dstColEnd: number
    },
    {painted: number}
> = {
    namespace: 'format',
    name: 'format_brush',
    description:
        "Copy one source cell's formatting onto a destination range (the format-painter). Only formatting is copied, not values. All coordinates zero-based.",
    mutates: true,
    confirmation: 'always',
    inputSchema: {
        properties: {
            srcSheetIdx: {type: 'integer'},
            srcRow: {type: 'integer'},
            srcCol: {type: 'integer'},
            dstSheetIdx: {type: 'integer'},
            dstRowStart: {type: 'integer'},
            dstColStart: {type: 'integer'},
            dstRowEnd: {type: 'integer'},
            dstColEnd: {type: 'integer'},
        },
        required: [
            'srcSheetIdx',
            'srcRow',
            'srcCol',
            'dstSheetIdx',
            'dstRowStart',
            'dstColStart',
            'dstRowEnd',
            'dstColEnd',
        ],
    },
    handler: async (input, ctx) => {
        await commit(
            asClient(ctx),
            [{type: 'cellFormatBrush', value: input}],
            'format_brush'
        )
        const n =
            (Math.abs(input.dstRowEnd - input.dstRowStart) + 1) *
            (Math.abs(input.dstColEnd - input.dstColStart) + 1)
        return {data: {painted: n}, display: `Painted format onto ${n} cell(s)`}
    },
}

export const FORMAT_TOOLS: Tool[] = [
    formatCells as Tool,
    mergeCells as Tool,
    unmergeCells as Tool,
    formatBrush as Tool,
]
