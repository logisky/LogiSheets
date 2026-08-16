/**
 * History tools — undo / redo the last committed change(s). These operate on
 * the workbook's own undo stack (the same one Ctrl-Z drives), so they reverse
 * any edit, whether made by the user or by Watson.
 */

import {isErrorMessage} from 'logisheets-web/pure'
import type {Client} from 'logisheets-web/pure'
import type {Tool, ToolContext} from '../tool.js'

function asClient(ctx: ToolContext): Client {
    return ctx.workbook as Client
}

export const undo: Tool<Record<string, never>, {undone: boolean}> = {
    namespace: 'history',
    name: 'undo',
    description:
        'Undo the last committed change to the workbook. Returns whether anything was undone (false if the undo stack was empty).',
    mutates: true,
    // Undo/redo are inherently reversible — no confirmation needed.
    confirmation: 'never',
    inputSchema: {properties: {}},
    handler: async (_input, ctx) => {
        const r = await asClient(ctx).undo()
        if (isErrorMessage(r)) throw new Error(`undo: ${r.msg}`)
        return {data: {undone: r}, display: r ? 'Undone' : 'Nothing to undo'}
    },
}

export const redo: Tool<Record<string, never>, {redone: boolean}> = {
    namespace: 'history',
    name: 'redo',
    description:
        'Redo the change that was just undone. Returns whether anything was redone.',
    mutates: true,
    confirmation: 'never',
    inputSchema: {properties: {}},
    handler: async (_input, ctx) => {
        const r = await asClient(ctx).redo()
        if (isErrorMessage(r)) throw new Error(`redo: ${r.msg}`)
        return {data: {redone: r}, display: r ? 'Redone' : 'Nothing to redo'}
    },
}

export const HISTORY_TOOLS: Tool[] = [undo as Tool, redo as Tool]
