/**
 * Comment tools — threaded cell comments. A comment is a thread anchored at a
 * cell, with one or more notes (a root note + replies). Watson can list, add,
 * reply, edit, resolve, and delete.
 *
 * Authorship: comments Watson creates are attributed to "Watson (AI)" by
 * default (honest — the assistant added them). The user can override the name
 * per call (e.g. "add a comment as Alice"). There is no global "current user"
 * in the open-source app, so we don't invent one.
 */

import {isErrorMessage} from 'logisheets-web/pure'
import type {
    Client,
    Comment,
    EditPayload,
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

const DEFAULT_AUTHOR = 'Watson (AI)'

function newGuid(): string {
    const g = globalThis as {crypto?: {randomUUID?: () => string}}
    const uuid =
        g.crypto?.randomUUID?.() ??
        `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
    return `{${uuid}}`
}
function nowIso(): string {
    return new Date().toISOString()
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

async function readComments(client: Client, sheetIdx: number): Promise<readonly Comment[]> {
    const res = await client.getComments({sheetIdx})
    if (isErrorMessage(res)) throw new Error(`comments: ${res.msg}`)
    return res as readonly Comment[]
}

// ---------------------------------------------------------------------------

export const listComments: Tool<{sheetIdx: number}, unknown> = {
    namespace: 'comment',
    name: 'list_comments',
    description:
        'List the comment threads on a sheet. Each thread is anchored at a cell (A1 ref) and holds one or more notes (root + replies), each with its id, author, text, timestamp, and resolved flag.',
    mutates: false,
    confirmation: 'never',
    inputSchema: {
        properties: {sheetIdx: {type: 'integer', description: 'Zero-based sheet index.'}},
        required: ['sheetIdx'],
    },
    handler: async (input, ctx) => {
        const comments = await readComments(asClient(ctx), input.sheetIdx)
        const threads = comments.map((c) => ({
            cell: a1(c.row, c.col),
            row: c.row,
            col: c.col,
            notes: c.notes.map((n) => ({
                id: n.id,
                author: n.author?.displayName ?? '',
                content: n.content,
                dt: n.dt,
                resolved: n.resolved,
                parentId: n.parentId,
            })),
        }))
        return {data: {threads}, display: `${threads.length} comment thread(s)`}
    },
}

export const addComment: Tool<
    {sheetIdx: number; row: number; col: number; content: string; authorName?: string},
    {commentId: string; cell: string}
> = {
    namespace: 'comment',
    name: 'add_comment',
    description:
        'Start a new comment thread on a cell (zero-based row/col). Attributed to "Watson (AI)" unless you pass authorName.',
    mutates: true,
    confirmation: 'always',
    inputSchema: {
        properties: {
            sheetIdx: {type: 'integer'},
            row: {type: 'integer'},
            col: {type: 'integer'},
            content: {type: 'string'},
            authorName: {type: 'string', description: 'Override the comment author name.'},
        },
        required: ['sheetIdx', 'row', 'col', 'content'],
    },
    handler: async (input, ctx) => {
        const commentId = newGuid()
        await commit(
            asClient(ctx),
            {
                type: 'addComment',
                value: {
                    sheetIdx: input.sheetIdx,
                    row: input.row,
                    col: input.col,
                    commentId,
                    author: {displayName: input.authorName || DEFAULT_AUTHOR},
                    dt: nowIso(),
                    content: input.content,
                    mentions: [],
                },
            },
            'add_comment'
        )
        return {
            data: {commentId, cell: a1(input.row, input.col)},
            display: `Commented on ${a1(input.row, input.col)}`,
        }
    },
}

export const replyComment: Tool<
    {sheetIdx: number; parentId: string; content: string; authorName?: string},
    {commentId: string; cell: string}
> = {
    namespace: 'comment',
    name: 'reply_comment',
    description:
        'Reply to an existing comment thread. Pass the parentId of any note in the thread (from list_comments).',
    mutates: true,
    confirmation: 'always',
    inputSchema: {
        properties: {
            sheetIdx: {type: 'integer'},
            parentId: {type: 'string', description: 'Id of a note in the target thread.'},
            content: {type: 'string'},
            authorName: {type: 'string'},
        },
        required: ['sheetIdx', 'parentId', 'content'],
    },
    handler: async (input, ctx) => {
        const client = asClient(ctx)
        const comments = await readComments(client, input.sheetIdx)
        const thread = comments.find((c) =>
            c.notes.some((n) => n.id === input.parentId)
        )
        if (!thread)
            throw new Error(`reply_comment: no thread contains "${input.parentId}"`)
        const commentId = newGuid()
        await commit(
            client,
            {
                type: 'addComment',
                value: {
                    sheetIdx: input.sheetIdx,
                    row: thread.row,
                    col: thread.col,
                    commentId,
                    parentId: input.parentId,
                    author: {displayName: input.authorName || DEFAULT_AUTHOR},
                    dt: nowIso(),
                    content: input.content,
                    mentions: [],
                },
            },
            'reply_comment'
        )
        return {data: {commentId, cell: a1(thread.row, thread.col)}, display: 'Replied'}
    },
}

export const editComment: Tool<
    {sheetIdx: number; commentId: string; content: string},
    {ok: true}
> = {
    namespace: 'comment',
    name: 'edit_comment',
    description: 'Change the text of an existing comment note (by its id).',
    mutates: true,
    confirmation: 'always',
    inputSchema: {
        properties: {
            sheetIdx: {type: 'integer'},
            commentId: {type: 'string'},
            content: {type: 'string'},
        },
        required: ['sheetIdx', 'commentId', 'content'],
    },
    handler: async (input, ctx) => {
        await commit(
            asClient(ctx),
            {
                type: 'editComment',
                value: {
                    sheetIdx: input.sheetIdx,
                    commentId: input.commentId,
                    content: input.content,
                    mentions: [],
                },
            },
            'edit_comment'
        )
        return {data: {ok: true}, display: 'Edited'}
    },
}

export const resolveComment: Tool<
    {sheetIdx: number; commentId: string; resolved: boolean},
    {ok: true}
> = {
    namespace: 'comment',
    name: 'resolve_comment',
    description: 'Mark a comment thread resolved (or unresolved) by a note id.',
    mutates: true,
    confirmation: 'never',
    inputSchema: {
        properties: {
            sheetIdx: {type: 'integer'},
            commentId: {type: 'string'},
            resolved: {type: 'boolean'},
        },
        required: ['sheetIdx', 'commentId', 'resolved'],
    },
    handler: async (input, ctx) => {
        await commit(
            asClient(ctx),
            {type: 'resolveComment', value: input},
            'resolve_comment'
        )
        return {
            data: {ok: true},
            display: input.resolved ? 'Resolved' : 'Reopened',
        }
    },
}

export const deleteComment: Tool<
    {sheetIdx: number; commentId: string},
    {ok: true}
> = {
    namespace: 'comment',
    name: 'delete_comment',
    description:
        'Delete a comment note by its id. Deleting a thread\'s root note removes the whole thread.',
    mutates: true,
    confirmation: 'destructive',
    inputSchema: {
        properties: {
            sheetIdx: {type: 'integer'},
            commentId: {type: 'string'},
        },
        required: ['sheetIdx', 'commentId'],
    },
    handler: async (input, ctx) => {
        await commit(
            asClient(ctx),
            {type: 'deleteComment', value: input},
            'delete_comment'
        )
        return {data: {ok: true}, display: 'Deleted'}
    },
}

export const COMMENT_TOOLS: Tool[] = [
    listComments as Tool,
    addComment as Tool,
    replyComment as Tool,
    editComment as Tool,
    resolveComment as Tool,
    deleteComment as Tool,
]
