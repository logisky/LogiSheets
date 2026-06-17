/**
 * Edit tools — modify data in an existing workbook without changing
 * structure. Use builder tools for create_sheet / create_block /
 * set_field_rule; use these for "change this value", "fill these in",
 * "wipe this block". Preview is a dry-run wrapper around a batch of
 * edits, leveraging the workbook's temp-transaction machinery.
 */

import {
    BlockInputBuilder,
    DeleteRowsInBlockBuilder,
    isErrorMessage,
} from 'logisheets-web'
import type {
    BlockInfo,
    Client,
    EditPayload,
    Transaction,
    Value,
} from 'logisheets-web'
import type {JSONSchema, Tool, ToolContext} from '../tool'

/** Narrow ToolContext.workbook to the concrete `Client` from
 *  logisheets-web. `WorkbookClient` is a type alias for `Client` —
 *  this helper hides the cast at call sites. */
function asClient(ctx: ToolContext): Client {
    return ctx.workbook as Client
}

/** Coerce arbitrary JSON values into the string form BlockInput
 *  expects. Mirrors the helper in builder.ts; lifted here so edit
 *  handlers don't reach into builder.ts. */
function stringifyForBlockInput(v: unknown): string {
    if (v === null || v === undefined) return ''
    if (typeof v === 'string') return v
    if (typeof v === 'number' || typeof v === 'boolean') return String(v)
    return JSON.stringify(v)
}

/** Submit one transaction; throw on transport or status='err'. */
async function commitTransaction(
    client: Client,
    payloads: EditPayload[],
    label: string
): Promise<void> {
    const tx: Transaction = {payloads, undoable: true, temp: false}
    const result = await client.handleTransaction({transaction: tx})
    if (isErrorMessage(result)) {
        throw new Error(`${label}: ${result.msg}`)
    }
    if (result.status.type === 'err') {
        throw new Error(`${label}: status code ${result.status.value}`)
    }
}

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

export type CellValue = string | number | boolean | null

export interface BlockCellChange {
    block: string
    row_key: string
    field: string
    value: CellValue
}

const BLOCK_CELL_CHANGE_SCHEMA: JSONSchema = {
    type: 'object',
    properties: {
        block: {type: 'string'},
        row_key: {
            type: 'string',
            description: "Value of the block's key column.",
        },
        field: {type: 'string'},
        value: {
            type: ['string', 'number', 'boolean', 'null'],
            description:
                'Cell value. Prefix with "=" to write a formula. null clears.',
        },
    },
    required: ['block', 'row_key', 'field', 'value'],
}

// ---------------------------------------------------------------------------
// 1. set_block_cells — single tool for both single-cell and batch writes.
// ---------------------------------------------------------------------------

interface SetBlockCellsInput {
    changes: ReadonlyArray<BlockCellChange>
}

interface SetBlockCellsOutput {
    /** Number of changes successfully translated into BlockInput
     *  payloads (== changes.length when the call returns; rejections
     *  surface as thrown errors before commit). */
    applied: number
}

export const setBlockCells: Tool<SetBlockCellsInput, SetBlockCellsOutput> = {
    namespace: 'edit',
    name: 'set_block_cells',
    description: [
        'Write one or more cells inside any block(s) in a single atomic transaction. Each change addresses a cell by (block ref name, row_key, field) — the LLM never deals with raw (sheet, row, col).',
        '',
        'Pass `changes` as an array; one-cell writes are just length-1 arrays. Batching is the cheap default — putting N writes in one call is one transaction, one calc pass, one undo entry.',
        '',
        'Rejected up-front (whole tx aborts) when any change:',
        '  - targets a non-existent block / row_key / field, or',
        '  - targets a field with a `value_formula` on its schema (engine-computed; use set_field_rule to change the rule instead).',
        '',
        "Value can be a literal (string / number / boolean) or a formula prefixed with '='. `null` clears the cell.",
    ].join('\n'),
    mutates: true,
    confirmation: 'always',
    inputSchema: {
        properties: {
            changes: {
                type: 'array',
                items: BLOCK_CELL_CHANGE_SCHEMA,
                minItems: 1,
            },
        },
        required: ['changes'],
    },
    handler: async (input, ctx) => {
        const client = asClient(ctx)

        // 1. Resolve every distinct block ref name once. One workbook-
        //    wide getAllBlocks is cheaper than N getBlockInfo by id.
        const allRes = await client.getAllBlocks({})
        if (isErrorMessage(allRes)) {
            throw new Error(`getAllBlocks failed: ${allRes.msg}`)
        }
        const blockByName = new Map<string, (typeof allRes)[number]>()
        for (const b of allRes) {
            if (b.schema?.name) blockByName.set(b.schema.name, b)
        }

        // 2. Translate each change into a BlockInput payload, failing
        //    fast on any unresolved reference. We collect ALL payloads
        //    before committing so a single bad change rejects the whole
        //    batch (matches the description's "all-or-nothing" promise).
        const payloads: EditPayload[] = []
        for (let i = 0; i < input.changes.length; i++) {
            const c = input.changes[i]
            const block = blockByName.get(c.block)
            if (!block) {
                throw new Error(
                    `changes[${i}]: no block with ref name "${c.block}"`
                )
            }
            const schema = block.schema
            if (!schema) {
                throw new Error(
                    `changes[${i}]: block "${c.block}" has no schema`
                )
            }
            const rowEntry = schema.keys.find((k) => k.key === c.row_key)
            if (!rowEntry) {
                throw new Error(
                    `changes[${i}]: no row with key "${c.row_key}" in block "${c.block}"`
                )
            }
            const fieldEntry = schema.fields.find((f) => f.field === c.field)
            if (!fieldEntry) {
                throw new Error(
                    `changes[${i}]: no field named "${c.field}" in block "${c.block}"`
                )
            }
            // Surface the engine-computed gate up front (the container
            // layer would silently drop the write otherwise — bad UX for
            // an LLM that doesn't know why nothing happened).
            if (
                typeof fieldEntry.valueFormula === 'string' &&
                fieldEntry.valueFormula.trim() !== ''
            ) {
                throw new Error(
                    `changes[${i}]: field "${c.field}" on block "${c.block}" has a value_formula — its cells are engine-computed. Use set_field_rule to change the rule.`
                )
            }
            payloads.push({
                type: 'blockInput',
                value: new BlockInputBuilder()
                    .sheetIdx(block.sheetIdx)
                    .blockId(block.blockId)
                    .row(rowEntry.idx)
                    .col(fieldEntry.idx)
                    .input(stringifyForBlockInput(c.value))
                    .build(),
            })
        }

        // 3. One atomic transaction.
        await commitTransaction(
            client,
            payloads,
            `set_block_cells (${payloads.length} change${
                payloads.length === 1 ? '' : 's'
            })`
        )

        return {
            data: {applied: payloads.length},
            display:
                payloads.length === 1
                    ? `Set ${input.changes[0].block}[${
                          input.changes[0].row_key
                      }].${input.changes[0].field} = ${JSON.stringify(
                          input.changes[0].value
                      )}.`
                    : `Applied ${payloads.length} cell writes in one transaction.`,
        }
    },
}

// ---------------------------------------------------------------------------
// 3. clear_block  (wipe all rows, keep the block + schema)
// ---------------------------------------------------------------------------

interface ClearBlockInput {
    block: string
    /** Don\'t actually clear — just report how many rows would be removed. */
    dry_run?: boolean
}

export const clearBlock: Tool<ClearBlockInput, {rows_cleared: number}> = {
    namespace: 'edit',
    name: 'clear_block',
    description:
        'Remove all rows from a block while keeping its schema and rules intact. Useful for resetting a working sheet between scenarios. Pass dry_run=true to count without committing.',
    mutates: true,
    confirmation: 'destructive',
    inputSchema: {
        properties: {
            block: {type: 'string'},
            dry_run: {type: 'boolean', default: false},
        },
        required: ['block'],
    },
    handler: async (input, ctx) => {
        const client = asClient(ctx)
        const allRes = await client.getAllBlocks({})
        if (isErrorMessage(allRes)) {
            throw new Error(`getAllBlocks failed: ${allRes.msg}`)
        }
        const block = allRes.find((b) => b.schema?.name === input.block)
        if (!block) {
            throw new Error(`no block with ref name "${input.block}"`)
        }
        if (block.rowCnt === 0) {
            return {
                data: {rows_cleared: 0},
                display: `${input.block} already empty.`,
            }
        }
        if (input.dry_run) {
            return {
                data: {rows_cleared: block.rowCnt},
                display: `dry_run: would clear ${block.rowCnt} rows from ${input.block}.`,
            }
        }
        const payload: EditPayload = {
            type: 'deleteRowsInBlock',
            value: new DeleteRowsInBlockBuilder()
                .sheetIdx(block.sheetIdx)
                .blockId(block.blockId)
                .start(0)
                .cnt(block.rowCnt)
                .build(),
        }
        await commitTransaction(
            client,
            [payload],
            `clear_block(${input.block})`
        )
        return {
            data: {rows_cleared: block.rowCnt},
            display: `Cleared ${block.rowCnt} row${
                block.rowCnt === 1 ? '' : 's'
            } from ${input.block}.`,
        }
    },
}

// ---------------------------------------------------------------------------
// 4. preview_changes  (dry-run a batch via temp transaction)
// ---------------------------------------------------------------------------

interface PreviewChangesInput {
    changes: ReadonlyArray<BlockCellChange>
}

interface PreviewDiffEntry {
    /** Block ref name if the cell falls inside a block, else null. */
    block: string | null
    row_key: string | null
    field: string | null
    sheet_idx: number
    row: number
    col: number
    before: CellValue
    after: CellValue
}

interface PreviewChangesOutput {
    /** Every cell whose value changes — both directly written cells and
     *  cascaded recalculations (formula deps, value_formula fields). */
    diff: PreviewDiffEntry[]
}

export const previewChanges: Tool<PreviewChangesInput, PreviewChangesOutput> = {
    namespace: 'edit',
    name: 'preview_changes',
    description:
        'Dry-run a batch of edits via the workbook\'s temp-transaction branch: returns every cell whose value would change (direct writes + cascaded formula recalcs). Nothing is committed. Use before set_block_cells when the user asks "what would happen if…".',
    mutates: false,
    confirmation: 'never',
    cost: 'normal',
    inputSchema: {
        properties: {
            changes: {
                type: 'array',
                items: BLOCK_CELL_CHANGE_SCHEMA,
                minItems: 1,
            },
        },
        required: ['changes'],
    },
    handler: async (input, ctx) => {
        const client = asClient(ctx)

        // Resolve blocks for payload translation + diff annotation.
        const allRes = await client.getAllBlocks({})
        if (isErrorMessage(allRes)) {
            throw new Error(`getAllBlocks failed: ${allRes.msg}`)
        }
        const blockByName = new Map<string, BlockInfo>()
        for (const b of allRes) {
            if (b.schema?.name) blockByName.set(b.schema.name, b)
        }

        const payloads: EditPayload[] = []
        for (let i = 0; i < input.changes.length; i++) {
            const c = input.changes[i]
            const block = blockByName.get(c.block)
            if (!block) {
                throw new Error(
                    `changes[${i}]: no block with ref name "${c.block}"`
                )
            }
            const schema = block.schema
            if (!schema) {
                throw new Error(
                    `changes[${i}]: block "${c.block}" has no schema`
                )
            }
            const rowEntry = schema.keys.find((k) => k.key === c.row_key)
            if (!rowEntry) {
                throw new Error(
                    `changes[${i}]: no row with key "${c.row_key}" in block "${c.block}"`
                )
            }
            const fieldEntry = schema.fields.find((f) => f.field === c.field)
            if (!fieldEntry) {
                throw new Error(
                    `changes[${i}]: no field named "${c.field}" in block "${c.block}"`
                )
            }
            payloads.push({
                type: 'blockInput',
                value: new BlockInputBuilder()
                    .sheetIdx(block.sheetIdx)
                    .blockId(block.blockId)
                    .row(rowEntry.idx)
                    .col(fieldEntry.idx)
                    .input(stringifyForBlockInput(c.value))
                    .build(),
            })
        }

        // Run inside a temp branch — toggle on, apply, snapshot diff,
        // discard. cleanup runs in finally so a mid-flight failure
        // doesn't leave the workbook stuck in temp mode.
        const toggleRes = await client.toggleStatus({useTemp: true})
        if (isErrorMessage(toggleRes)) {
            throw new Error(`toggleStatus failed: ${toggleRes.msg}`)
        }
        try {
            const tx: Transaction = {payloads, undoable: false, temp: true}
            const result = await client.handleTransaction({transaction: tx})
            if (isErrorMessage(result)) {
                throw new Error(`preview_changes: ${result.msg}`)
            }
            if (result.status.type === 'err') {
                throw new Error(
                    `preview_changes: status code ${result.status.value}`
                )
            }
            const diffRes = await client.getTempStatusChanges()
            if (isErrorMessage(diffRes)) {
                throw new Error(`getTempStatusChanges failed: ${diffRes.msg}`)
            }

            // Annotate diff entries with block context when the cell
            // falls inside a known block.
            const diff: PreviewDiffEntry[] = diffRes.cells.map((c) => {
                const annot = locateInBlock(c.sheetIdx, c.row, c.col, allRes)
                return {
                    block: annot?.block ?? null,
                    row_key: annot?.row_key ?? null,
                    field: annot?.field ?? null,
                    sheet_idx: c.sheetIdx,
                    row: c.row,
                    col: c.col,
                    before: flattenValue(c.oldValue),
                    after: flattenValue(c.newValue),
                }
            })

            return {
                data: {diff},
                display:
                    diff.length === 0
                        ? 'No cells would change.'
                        : `${diff.length} cell${
                              diff.length === 1 ? '' : 's'
                          } would change.`,
            }
        } finally {
            await client.cleanupTempStatus()
        }
    },
}

function flattenValue(v: Value): CellValue {
    if (v === 'empty') return null
    switch (v.type) {
        case 'str':
            return v.value
        case 'number':
            return v.value
        case 'bool':
            return v.value
        case 'error':
            return `#ERR:${v.value}`
    }
}

function locateInBlock(
    sheetIdx: number,
    row: number,
    col: number,
    blocks: readonly BlockInfo[]
): {block: string; row_key: string; field: string} | undefined {
    for (const b of blocks) {
        if (b.sheetIdx !== sheetIdx) continue
        if (row < b.rowStart || row >= b.rowStart + b.rowCnt) continue
        if (col < b.colStart || col >= b.colStart + b.colCnt) continue
        const schema = b.schema
        if (!schema) return undefined
        const key = schema.keys.find((k) => k.idx === row - b.rowStart)
        const field = schema.fields.find((f) => f.idx === col - b.colStart)
        if (key && field) {
            return {block: schema.name, row_key: key.key, field: field.field}
        }
        return undefined
    }
    return undefined
}

// ---------------------------------------------------------------------------
// Design note: no `undo_redo` here.
//
// Rationale: the engine's undo stack is shared with the human user
// (it's what Ctrl-Z/Y drives). Letting the AI step it would silently
// wipe user actions that landed between AI tx's. The AI's rollback
// primitive is `build__checkpoint` — labelled, isolated, and itself
// undoable so the user can reverse an AI restore with a single Ctrl-Z.
// Users still get standard Ctrl-Z/Y on the canvas; that path is
// untouched.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Bundle
// ---------------------------------------------------------------------------

export const EDIT_TOOLS: Tool[] = [
    setBlockCells,
    clearBlock,
    previewChanges,
] as Tool[]
