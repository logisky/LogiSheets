/**
 * Link tools — a "link" makes a plain cell range a facade over a backing block:
 * references to the source range (e.g. A1:A10) transparently resolve to the
 * block's cells, and the block is the real, growable store. The source range's
 * column count must equal the block's column count.
 *
 * Flow for the model: find a block to back the range (linkable_blocks, matched
 * on column count) → create_link → inspect with list_links.
 */

import {isErrorMessage} from 'logisheets-web/pure'
import type {
    BlockInfo,
    Client,
    EditPayload,
    LinkInfo,
    Transaction,
} from 'logisheets-web/pure'
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

export const listLinks: Tool<{sheetIdx: number}, unknown> = {
    namespace: 'link',
    name: 'list_links',
    description:
        'List the linked ranges on a sheet — each is a source range (A1 range) that resolves to a backing block (blockId).',
    mutates: false,
    confirmation: 'never',
    inputSchema: {
        properties: {sheetIdx: {type: 'integer', description: 'Zero-based sheet index.'}},
        required: ['sheetIdx'],
    },
    handler: async (input, ctx) => {
        const res = await asClient(ctx).getLinks({sheetIdx: input.sheetIdx})
        if (isErrorMessage(res)) throw new Error(`list_links: ${res.msg}`)
        const links = (res as readonly LinkInfo[]).map((l) => ({
            range: `${a1(l.startRow, l.startCol)}:${a1(l.endRow, l.endCol)}`,
            blockId: l.blockId,
        }))
        return {data: {links}, display: `${links.length} link(s)`}
    },
}

export const linkableBlocks: Tool<{sheetIdx: number; colCnt: number}, unknown> = {
    namespace: 'link',
    name: 'linkable_blocks',
    description:
        'List blocks that can back a source range of the given column count on a sheet (a link requires matching column counts). Returns each candidate\'s blockId, position, and size.',
    mutates: false,
    confirmation: 'never',
    inputSchema: {
        properties: {
            sheetIdx: {type: 'integer'},
            colCnt: {type: 'integer', description: 'Column count the source range will have.'},
        },
        required: ['sheetIdx', 'colCnt'],
    },
    handler: async (input, ctx) => {
        const res = await asClient(ctx).getLinkableBlocks({
            sheetIdx: input.sheetIdx,
            colCnt: input.colCnt,
        })
        if (isErrorMessage(res)) throw new Error(`linkable_blocks: ${res.msg}`)
        const blocks = (res as readonly BlockInfo[]).map((b) => ({
            block_id: b.blockId,
            sheet_idx: b.sheetIdx,
            position: {row: b.rowStart, col: b.colStart},
            row_count: b.rowCnt,
            col_count: b.colCnt,
        }))
        return {data: {blocks}, display: `${blocks.length} linkable block(s)`}
    },
}

export const createLink: Tool<
    {
        sheetIdx: number
        masterRow: number
        masterCol: number
        rowCnt: number
        colCnt: number
        blockId: number
        blockSheetIdx?: number
    },
    {ok: true; range: string}
> = {
    namespace: 'link',
    name: 'create_link',
    description: [
        'Link a source cell range to an existing block so references to the source resolve to the block. The source range is a facade; the block is the backing store.',
        'The source range column count (colCnt) MUST equal the block\'s column count. Set blockSheetIdx for a cross-sheet link (block on a different sheet than the source).',
    ].join('\n'),
    mutates: true,
    confirmation: 'always',
    inputSchema: {
        properties: {
            sheetIdx: {type: 'integer', description: 'Sheet holding the source range.'},
            masterRow: {type: 'integer', description: 'Top-left row of the source range (zero-based).'},
            masterCol: {type: 'integer', description: 'Top-left column of the source range (zero-based).'},
            rowCnt: {type: 'integer', description: 'Source range row count.'},
            colCnt: {type: 'integer', description: 'Source range column count (must match the block).'},
            blockId: {type: 'integer', description: 'The backing block.'},
            blockSheetIdx: {type: 'integer', description: 'Sheet of the block, if different from the source.'},
        },
        required: ['sheetIdx', 'masterRow', 'masterCol', 'rowCnt', 'colCnt', 'blockId'],
    },
    handler: async (input, ctx) => {
        await commit(asClient(ctx), {type: 'createLink', value: input}, 'create_link')
        return {
            data: {
                ok: true,
                range: `${a1(input.masterRow, input.masterCol)}:${a1(input.masterRow + input.rowCnt - 1, input.masterCol + input.colCnt - 1)}`,
            },
            display: 'Linked',
        }
    },
}

export const LINK_TOOLS: Tool[] = [
    listLinks as Tool,
    linkableBlocks as Tool,
    createLink as Tool,
]
