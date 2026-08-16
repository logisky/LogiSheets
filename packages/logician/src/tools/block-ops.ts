/**
 * Advanced block ops — move, resize, and remove whole blocks. Blocks are
 * addressed by numeric blockId (from create_block's result or list_blocks'
 * block_id field). Row/column edits inside a block live in the build tools
 * (add_block_rows / delete_block_rows).
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

export const moveBlock: Tool<
    {sheetIdx: number; blockId: number; newMasterRow: number; newMasterCol: number},
    {ok: true}
> = {
    namespace: 'build',
    name: 'move_block',
    description:
        'Move a whole block so its top-left (master) cell lands at a new zero-based (row, col). Get blockId from list_blocks or create_block.',
    mutates: true,
    confirmation: 'always',
    inputSchema: {
        properties: {
            sheetIdx: {type: 'integer'},
            blockId: {type: 'integer'},
            newMasterRow: {type: 'integer', description: 'New top-left row (zero-based).'},
            newMasterCol: {type: 'integer', description: 'New top-left column (zero-based).'},
        },
        required: ['sheetIdx', 'blockId', 'newMasterRow', 'newMasterCol'],
    },
    handler: async (input, ctx) => {
        await commit(
            asClient(ctx),
            {
                type: 'moveBlock',
                value: {
                    sheetIdx: input.sheetIdx,
                    id: input.blockId,
                    newMasterRow: input.newMasterRow,
                    newMasterCol: input.newMasterCol,
                },
            },
            'move_block'
        )
        return {data: {ok: true}, display: `Moved block ${input.blockId}`}
    },
}

export const resizeBlock: Tool<
    {sheetIdx: number; blockId: number; newRowCnt?: number; newColCnt?: number},
    {ok: true}
> = {
    namespace: 'build',
    name: 'resize_block',
    description:
        'Resize a block to a new row and/or column count (omit one to leave that dimension unchanged). Get blockId from list_blocks.',
    mutates: true,
    confirmation: 'always',
    inputSchema: {
        properties: {
            sheetIdx: {type: 'integer'},
            blockId: {type: 'integer'},
            newRowCnt: {type: 'integer', description: 'New number of rows.'},
            newColCnt: {type: 'integer', description: 'New number of columns.'},
        },
        required: ['sheetIdx', 'blockId'],
    },
    handler: async (input, ctx) => {
        await commit(
            asClient(ctx),
            {
                type: 'resizeBlock',
                value: {
                    sheetIdx: input.sheetIdx,
                    id: input.blockId,
                    newRowCnt: input.newRowCnt,
                    newColCnt: input.newColCnt,
                },
            },
            'resize_block'
        )
        return {data: {ok: true}, display: `Resized block ${input.blockId}`}
    },
}

export const removeBlock: Tool<{sheetIdx: number; blockId: number}, {ok: true}> = {
    namespace: 'build',
    name: 'remove_block',
    description:
        'Remove a whole block (its schema and cells) by blockId. Get blockId from list_blocks.',
    mutates: true,
    confirmation: 'destructive',
    inputSchema: {
        properties: {
            sheetIdx: {type: 'integer'},
            blockId: {type: 'integer'},
        },
        required: ['sheetIdx', 'blockId'],
    },
    handler: async (input, ctx) => {
        await commit(
            asClient(ctx),
            {type: 'removeBlock', value: {sheetIdx: input.sheetIdx, id: input.blockId}},
            'remove_block'
        )
        return {data: {ok: true}, display: `Removed block ${input.blockId}`}
    },
}

export const BLOCK_OPS_TOOLS: Tool[] = [
    moveBlock as Tool,
    resizeBlock as Tool,
    removeBlock as Tool,
]
