/**
 * Edit tools — modify data in an existing workbook without changing
 * structure. Use builder tools for create_sheet / create_block /
 * set_field_rule; use these for "change this value", "fill these in",
 * "wipe this block". Preview is a dry-run wrapper around a batch of
 * edits, leveraging the workbook's temp-transaction machinery.
 */

import {BlockInputBuilder, isErrorMessage} from 'logisheets-web'
import type {Client, EditPayload, Transaction} from 'logisheets-web'
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
// 1. set_block_cell  (single value, common case)
// ---------------------------------------------------------------------------

export const setBlockCell: Tool<BlockCellChange, {ok: true}> = {
    namespace: 'edit',
    name: 'set_block_cell',
    description:
        "Write a single cell inside a block, identified by (block, row_key, field) rather than (sheet, row, col). Refuses fields that have a value_formula declared on the schema — those are engine-computed. Value can be a literal or a formula prefixed with '='; null clears.",
    mutates: true,
    confirmation: 'always',
    inputSchema: BLOCK_CELL_CHANGE_SCHEMA,
    handler: async (input, ctx) => {
        const client = asClient(ctx)

        // 1. Resolve block ref name → (sheetIdx, blockId, schema with
        //    keys + fields). One getAllBlocks call gives us everything.
        const all = await client.getAllBlocks({})
        if (isErrorMessage(all)) {
            throw new Error(`getAllBlocks failed: ${all.msg}`)
        }
        const block = all.find((b) => b.schema?.name === input.block)
        if (!block) {
            throw new Error(`No block with ref name "${input.block}"`)
        }
        const schema = block.schema
        if (!schema) {
            throw new Error(
                `Block "${input.block}" has no schema — can't locate cells by (key, field)`
            )
        }

        // 2. Resolve row_key → block-row index.
        const rowEntry = schema.keys.find((k) => k.key === input.row_key)
        if (!rowEntry) {
            throw new Error(
                `No row with key "${input.row_key}" in block "${input.block}"`
            )
        }

        // 3. Resolve field name → block-col index (also catches the
        //    value_formula constraint: templated cells reject blockInput
        //    in the container layer, so we surface a friendlier error
        //    here instead of letting the engine fail the whole tx).
        const fieldEntry = schema.fields.find((f) => f.field === input.field)
        if (!fieldEntry) {
            throw new Error(
                `No field named "${input.field}" in block "${input.block}"`
            )
        }
        if (
            typeof fieldEntry.valueFormula === 'string' &&
            fieldEntry.valueFormula.trim() !== ''
        ) {
            throw new Error(
                `Field "${input.field}" has a value_formula — its cells are engine-computed and cannot be written directly. To change the rule, call set_field_rule.`
            )
        }

        // 4. Issue the BlockInput. The engine handles the rest
        //    (recompute, validation shadow refresh, etc).
        const payloads: EditPayload[] = [
            {
                type: 'blockInput',
                value: new BlockInputBuilder()
                    .sheetIdx(block.sheetIdx)
                    .blockId(block.blockId)
                    .row(rowEntry.idx)
                    .col(fieldEntry.idx)
                    .input(stringifyForBlockInput(input.value))
                    .build(),
            },
        ]

        await commitTransaction(
            client,
            payloads,
            `set_block_cell("${input.block}", "${input.row_key}", "${input.field}")`
        )

        return {
            data: {ok: true},
            display: `Set ${input.block}[${input.row_key}].${input.field} = ${JSON.stringify(input.value)}`,
        }
    },
}

// ---------------------------------------------------------------------------
// 2. set_block_cells  (batch)
// ---------------------------------------------------------------------------

interface SetBlockCellsInput {
    changes: ReadonlyArray<BlockCellChange>
}

interface SetBlockCellsOutput {
    applied: number
    rejected: Array<{change: BlockCellChange; reason: string}>
}

export const setBlockCells: Tool<SetBlockCellsInput, SetBlockCellsOutput> = {
    namespace: 'edit',
    name: 'set_block_cells',
    description:
        'Apply a batch of block-cell writes as a single transaction. All-or-nothing semantics: if any change is rejected (locked / non-existent / formula-bound), the whole batch is aborted and `rejected` reports why. Prefer this over many set_block_cell calls when filling in a row.',
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
    handler: async () => {
        throw new Error('TODO: set_block_cells')
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
    handler: async () => {
        throw new Error('TODO: clear_block')
    },
}

// ---------------------------------------------------------------------------
// 4. preview_changes  (dry-run a batch via temp transaction)
// ---------------------------------------------------------------------------

interface PreviewChangesInput {
    changes: ReadonlyArray<BlockCellChange>
    /**
     * Cells whose post-change values you want reported back. Useful for
     * "what does total revenue look like if I bump price by 10%". If
     * omitted, all cells whose computed values differ from baseline are
     * included.
     */
    watch?: ReadonlyArray<{block: string; row_key: string; field: string}>
}

interface PreviewDiffEntry {
    block: string
    row_key: string
    field: string
    before: CellValue
    after: CellValue
}

interface PreviewChangesOutput {
    /** Cells whose values change as a result of the proposed edits. */
    diff: PreviewDiffEntry[]
    /** Validation violations that would be introduced by the changes. */
    new_violations: Array<{
        block: string
        row_key: string
        field: string
        rule: string
    }>
    /** Validation violations that the changes would resolve. */
    resolved_violations: Array<{
        block: string
        row_key: string
        field: string
    }>
}

export const previewChanges: Tool<PreviewChangesInput, PreviewChangesOutput> = {
    namespace: 'edit',
    name: 'preview_changes',
    description:
        'Dry-run a batch of edits using the workbook\'s temp-transaction machinery: returns the resulting cell-value diff plus any validation violations introduced or resolved. Nothing is committed. Use before set_block_cells when the user asks "what would happen if…".',
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
            watch: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        block: {type: 'string'},
                        row_key: {type: 'string'},
                        field: {type: 'string'},
                    },
                    required: ['block', 'row_key', 'field'],
                },
            },
        },
        required: ['changes'],
    },
    handler: async () => {
        throw new Error('TODO: preview_changes')
    },
}

// ---------------------------------------------------------------------------
// 5. undo / redo
// ---------------------------------------------------------------------------

interface UndoRedoInput {
    op: 'undo' | 'redo'
    /** How many steps. Default 1. */
    steps?: number
}

export const undoRedo: Tool<UndoRedoInput, {applied: number}> = {
    namespace: 'edit',
    name: 'undo_redo',
    description:
        'Walk the workbook\'s undo stack. op="undo" reverses the most recent commits; op="redo" replays them. For long multi-step rollbacks the builder checkpoint tool is usually clearer than counting steps here.',
    mutates: true,
    confirmation: 'never',
    inputSchema: {
        properties: {
            op: {type: 'string', enum: ['undo', 'redo']},
            steps: {type: 'integer', minimum: 1, default: 1},
        },
        required: ['op'],
    },
    handler: async () => {
        throw new Error('TODO: undo_redo')
    },
}

// ---------------------------------------------------------------------------
// Bundle
// ---------------------------------------------------------------------------

export const EDIT_TOOLS: Tool[] = [
    setBlockCell,
    setBlockCells,
    clearBlock,
    previewChanges,
    undoRedo,
] as Tool[]
