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
} from 'logisheets-web/pure'
import type {
    BlockInfo,
    CellInfo,
    Client,
    EditPayload,
    Transaction,
    Value,
} from 'logisheets-web/pure'
import type {JSONSchema, Tool, ToolContext} from '../tool.js'
import {transactionFailure} from './effect.js'

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
        throw transactionFailure(label, result)
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

/** One cell to report a value for, either semantically or by coordinate. */
export interface WatchTarget {
    block?: string
    row_key?: string
    field?: string
    sheet_idx?: number
    row?: number
    col?: number
}

/** One hypothetical, optionally named so the caller can line results up. */
export interface PreviewScenario {
    label?: string
    changes: ReadonlyArray<BlockCellChange>
}

interface PreviewChangesInput {
    /** A single hypothetical. Mutually exclusive with `scenarios`. */
    changes?: ReadonlyArray<BlockCellChange>
    /** Several hypotheticals, each evaluated on its own temp branch. */
    scenarios?: ReadonlyArray<PreviewScenario>
    /**
     * Report just these cells' resulting values instead of the full diff.
     *
     * A sensitivity grid wants one number per scenario, not every cell the
     * change moved: sixteen scenarios over a model that cascades into 26 cells
     * is 416 diff rows, which is a lot of context to spend on sixteen answers.
     */
    watch?: ReadonlyArray<WatchTarget>
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

/** What one scenario produced. */
interface PreviewScenarioResult {
    label?: string
    /** Every cell whose value changes. Present unless `watch` was given. */
    diff?: PreviewDiffEntry[]
    /** The watched cells' values, in the same order as `watching` on the
     *  result. Bare values: repeating the target on every scenario cost more
     *  bytes than all the answers put together on a 16-cell grid, and the
     *  caller named those targets in the first place. */
    values?: CellValue[]
}

interface PreviewChangesOutput {
    /** The watched targets, once, in the order their values appear on each
     *  scenario. Present only when `watch` was given. */
    watching?: WatchTarget[]
    /** One entry per scenario, in the order given. */
    scenarios: PreviewScenarioResult[]
    /** The single scenario's diff, when called with `changes` and no `watch` —
     *  kept so the one-hypothetical shape stays what it always was. */
    diff?: PreviewDiffEntry[]
}

export const previewChanges: Tool<PreviewChangesInput, PreviewChangesOutput> = {
    namespace: 'edit',
    name: 'preview_changes',
    description: [
        'Dry-run edits on the workbook\'s temp branch and report what they would do. Nothing is committed — the branch is discarded, so this is the safe way to explore a model instead of changing it and putting it back.',
        '',
        'Two shapes. `changes` runs one hypothetical and returns every cell that would move, direct writes and cascaded recalculations alike. `scenarios` runs several, each on its own branch, and returns one result per scenario in order — that is a sensitivity table or a scenario comparison in a single call.',
        '',
        'Add `watch` to get just the cells you care about instead of the whole cascade. A grid of sixteen scenarios over a model that cascades into 26 cells is 416 rows of diff to answer sixteen questions; `watch` makes it sixteen numbers. Name a cell semantically (`{block, row_key, field}`) or by coordinate (`{sheet_idx, row, col}`).',
    ].join('\n'),
    mutates: false,
    confirmation: 'never',
    cost: 'normal',
    inputSchema: {
        properties: {
            changes: {
                type: 'array',
                items: BLOCK_CELL_CHANGE_SCHEMA,
                minItems: 1,
                description:
                    'One hypothetical. Use `scenarios` for more than one.',
            },
            scenarios: {
                type: 'array',
                minItems: 1,
                description:
                    'Several hypotheticals, each evaluated independently. Results come back in this order.',
                items: {
                    type: 'object',
                    properties: {
                        label: {
                            type: 'string',
                            description:
                                'Echoed back on the result, so a grid is easy to line up.',
                        },
                        changes: {
                            type: 'array',
                            items: BLOCK_CELL_CHANGE_SCHEMA,
                            minItems: 1,
                        },
                    },
                    required: ['changes'],
                },
            },
            watch: {
                type: 'array',
                minItems: 1,
                description:
                    "Report only these cells' values instead of the full diff. Name each one semantically or by coordinate.",
                items: {
                    type: 'object',
                    properties: {
                        block: {type: 'string'},
                        row_key: {type: 'string'},
                        field: {type: 'string'},
                        sheet_idx: {type: 'integer', default: 0},
                        row: {type: 'integer'},
                        col: {type: 'integer'},
                    },
                },
            },
        },
    },
    handler: async (input, ctx) => {
        const client = asClient(ctx)

        const scenarios: PreviewScenario[] =
            input.scenarios !== undefined
                ? [...input.scenarios]
                : input.changes !== undefined
                  ? [{changes: input.changes}]
                  : []
        if (scenarios.length === 0) {
            throw new Error('pass either `changes` or `scenarios`')
        }
        if (input.scenarios !== undefined && input.changes !== undefined) {
            throw new Error('pass `changes` or `scenarios`, not both')
        }

        // Resolve blocks once for the whole call: payload translation, diff
        // annotation and watch targets all need the same lookup, and the
        // scenarios are evaluated against the same committed state.
        const allRes = await client.getAllBlocks({})
        if (isErrorMessage(allRes)) {
            throw new Error(`getAllBlocks failed: ${allRes.msg}`)
        }
        const blockByName = new Map<string, BlockInfo>()
        for (const b of allRes) {
            if (b.schema?.name) blockByName.set(b.schema.name, b)
        }

        /** Translate one change into a BlockInput payload, failing fast. */
        const toPayload = (
            c: BlockCellChange,
            where: string
        ): EditPayload => {
            const block = blockByName.get(c.block)
            if (!block) {
                throw new Error(`${where}: no block with ref name "${c.block}"`)
            }
            const schema = block.schema
            if (!schema) {
                throw new Error(`${where}: block "${c.block}" has no schema`)
            }
            const rowEntry = schema.keys.find((k) => k.key === c.row_key)
            if (!rowEntry) {
                throw new Error(
                    `${where}: no row with key "${c.row_key}" in block "${c.block}"`
                )
            }
            const fieldEntry = schema.fields.find((f) => f.field === c.field)
            if (!fieldEntry) {
                throw new Error(
                    `${where}: no field named "${c.field}" in block "${c.block}"`
                )
            }
            return {
                type: 'blockInput',
                value: new BlockInputBuilder()
                    .sheetIdx(block.sheetIdx)
                    .blockId(block.blockId)
                    .row(rowEntry.idx)
                    .col(fieldEntry.idx)
                    .input(stringifyForBlockInput(c.value))
                    .build(),
            }
        }

        /** Resolve a watch target to concrete coordinates, once, up front. */
        const watchCoords = (input.watch ?? []).map((t, i) => {
            if (t.block !== undefined) {
                const block = blockByName.get(t.block)
                if (!block) {
                    throw new Error(
                        `watch[${i}]: no block with ref name "${t.block}"`
                    )
                }
                const schema = block.schema
                if (!schema) {
                    throw new Error(`watch[${i}]: block "${t.block}" has no schema`)
                }
                const rowEntry = schema.keys.find((k) => k.key === t.row_key)
                if (!rowEntry) {
                    throw new Error(
                        `watch[${i}]: no row with key "${t.row_key}" in block "${t.block}"`
                    )
                }
                const fieldEntry = schema.fields.find((f) => f.field === t.field)
                if (!fieldEntry) {
                    throw new Error(
                        `watch[${i}]: no field named "${t.field}" in block "${t.block}"`
                    )
                }
                return {
                    target: t,
                    sheetIdx: block.sheetIdx,
                    row: block.rowStart + rowEntry.idx,
                    col: block.colStart + fieldEntry.idx,
                }
            }
            if (t.row === undefined || t.col === undefined) {
                throw new Error(
                    `watch[${i}]: give either (block, row_key, field) or (row, col)`
                )
            }
            return {
                target: t,
                sheetIdx: t.sheet_idx ?? 0,
                row: t.row,
                col: t.col,
            }
        })

        const results: PreviewScenarioResult[] = []
        for (let n = 0; n < scenarios.length; n++) {
            const scenario = scenarios[n]
            const where =
                scenarios.length === 1 && input.scenarios === undefined
                    ? 'changes'
                    : `scenarios[${n}]`
            const payloads = scenario.changes.map((c, i) =>
                toPayload(c, `${where}[${i}]`)
            )

            // Each scenario gets its own temp branch, so they are independent
            // hypotheticals rather than a cumulative sequence. Cleanup is in
            // `finally` — and checked, because a failed discard leaves the
            // previewed writes as the live state, which is the one outcome this
            // tool must never produce.
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
                    throw transactionFailure(`preview_changes (${where})`, result)
                }

                if (watchCoords.length > 0) {
                    // Read the watched cells inside the branch, so a cell the
                    // change did not move still reports its (unchanged) value
                    // rather than going missing from a diff.
                    const values: CellValue[] = []
                    for (const w of watchCoords) {
                        const cells = await client.getCells({
                            sheetIdx: w.sheetIdx,
                            startRow: w.row,
                            startCol: w.col,
                            endRow: w.row,
                            endCol: w.col,
                        })
                        if (isErrorMessage(cells)) {
                            throw new Error(`getCells failed: ${cells.msg}`)
                        }
                        const info = (cells as readonly CellInfo[])[0]
                        values.push(
                            info === undefined ? null : flattenValue(info.value)
                        )
                    }
                    results.push({label: scenario.label, values})
                } else {
                    const diffRes = await client.getTempStatusChanges()
                    if (isErrorMessage(diffRes)) {
                        throw new Error(
                            `getTempStatusChanges failed: ${diffRes.msg}`
                        )
                    }
                    const diff: PreviewDiffEntry[] = diffRes.cells.map((c) => {
                        const annot = locateInBlock(
                            c.sheetIdx,
                            c.row,
                            c.col,
                            allRes
                        )
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
                    results.push({label: scenario.label, diff})
                }
            } finally {
                // A cleanup that fails leaves the temp branch — and therefore
                // the previewed writes — as the live state, the exact opposite
                // of what this tool promises. Swallowing the result is how that
                // went unnoticed once already: the engine's RPC was named
                // `cleanTempStatus` while the client interface said
                // `cleanupTempStatus`, so on any host that forwards method
                // names verbatim the discard was a silent no-op and every dry
                // run committed itself.
                const cleaned = await client.cleanupTempStatus()
                if (isErrorMessage(cleaned)) {
                    throw new Error(
                        `preview_changes could not discard its temp branch (${cleaned.msg}) — ` +
                            'the workbook may now hold the previewed values'
                    )
                }
            }
        }

        const single =
            input.scenarios === undefined && watchCoords.length === 0
                ? results[0]?.diff
                : undefined

        const describe = (): string => {
            if (watchCoords.length > 0) {
                const n = results.length
                return `${n} scenario${n === 1 ? '' : 's'}, ${
                    watchCoords.length
                } watched cell${watchCoords.length === 1 ? '' : 's'} each.`
            }
            if (results.length === 1) {
                const d = results[0]?.diff ?? []
                return d.length === 0
                    ? 'No cells would change.'
                    : `${d.length} cell${d.length === 1 ? '' : 's'} would change.`
            }
            return `${results.length} scenarios previewed.`
        }

        return {
            data:
                single !== undefined
                    ? {scenarios: results, diff: single}
                    : watchCoords.length > 0
                      ? {
                            watching: watchCoords.map((w) => w.target),
                            scenarios: results,
                        }
                      : {scenarios: results},
            display: describe(),
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
            // The engine's error value is already spelled the way a
            // spreadsheet spells it — `#DIV/0!`. Decorating it produced
            // `#ERR:#DIV/0!`, which matches nothing anyone would look for.
            return v.value
    }
}

/** Which (block, row_key, field) a coordinate names, if any. Shared with the
 *  inspect tools so a traced cell reads back semantically rather than as a
 *  coordinate the agent then has to interpret. */
export function locateInBlock(
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

// ---------------------------------------------------------------------------
// goal_seek — what input produces the answer I want
// ---------------------------------------------------------------------------

/** A cell named semantically or by coordinate. */
interface CellPointer {
    block?: string
    row_key?: string
    field?: string
    sheet_idx?: number
    row?: number
    col?: number
}

interface GoalSeekInput {
    /** The input to vary. */
    set: CellPointer
    /** The output to land on. */
    target: CellPointer
    /** The value `target` should reach. */
    to: number
    /** Search bracket. Derived by expanding around the current input if absent. */
    between?: readonly [number, number]
    /** How close to `to` counts as solved. Defaults to 1e-6 relative. */
    tolerance?: number
    max_iterations?: number
}

interface GoalSeekOutput {
    /** The input value found. */
    value: number | null
    /** What `target` evaluates to there. */
    achieved: number | null
    converged: boolean
    iterations: number
    /** The bracket actually searched. */
    searched?: [number, number]
    /** Why it stopped, when it did not converge. */
    note?: string
}

export const goalSeek: Tool<GoalSeekInput, GoalSeekOutput> = {
    namespace: 'edit',
    name: 'goal_seek',
    description: [
        'Find the input value that makes a chosen output equal a target — "what discount rate gives a value per share of 30".',
        '',
        'Runs entirely on the engine\'s temp branch, so the workbook is never modified: this is a question, not an edit. The search happens inside the engine rather than as a conversation, so it costs one tool call instead of one per iteration.',
        '',
        'Name both cells semantically as (block, row_key, field) or by coordinate as (row, col). Give `between` when you know a bracket; otherwise it expands outward from the current input value to find one.',
        '',
        'Bisection, so it needs the output to move monotonically between the bracket ends and it finds one crossing. If the bracket does not straddle the target it says so rather than returning a number — a non-answer you can act on beats a plausible one you cannot.',
    ].join('\n'),
    mutates: false,
    confirmation: 'never',
    cost: 'normal',
    inputSchema: {
        properties: {
            set: {
                type: 'object',
                description: 'The input cell to vary.',
                properties: {
                    block: {type: 'string'},
                    row_key: {type: 'string'},
                    field: {type: 'string'},
                    sheet_idx: {type: 'integer', default: 0},
                    row: {type: 'integer'},
                    col: {type: 'integer'},
                },
            },
            target: {
                type: 'object',
                description: 'The output cell to drive to `to`.',
                properties: {
                    block: {type: 'string'},
                    row_key: {type: 'string'},
                    field: {type: 'string'},
                    sheet_idx: {type: 'integer', default: 0},
                    row: {type: 'integer'},
                    col: {type: 'integer'},
                },
            },
            to: {type: 'number', description: 'The value `target` should reach.'},
            between: {
                type: 'array',
                items: {type: 'number'},
                minItems: 2,
                maxItems: 2,
                description:
                    'Search bracket [low, high]. Omit to expand outward from the current input value.',
            },
            tolerance: {
                type: 'number',
                description: 'How close to `to` counts as solved. Default 1e-6 relative.',
            },
            max_iterations: {type: 'integer', default: 60},
        },
        required: ['set', 'target', 'to'],
    },
    handler: async (input, ctx) => {
        const client = asClient(ctx)
        const maxIter = input.max_iterations ?? 60
        const tol =
            input.tolerance ?? Math.max(1e-9, Math.abs(input.to) * 1e-9 + 1e-9)

        const allRes = await client.getAllBlocks({})
        if (isErrorMessage(allRes)) {
            throw new Error(`getAllBlocks failed: ${allRes.msg}`)
        }
        const blocks = allRes

        /** Resolve a pointer to coordinates, plus the payload needed to write it. */
        const resolve = (
            ptr: CellPointer,
            what: string
        ): {sheetIdx: number; row: number; col: number; blockId?: number; blockRow?: number; blockCol?: number} => {
            if (ptr.block !== undefined) {
                const b = blocks.find((x) => x.schema?.name === ptr.block)
                if (!b) throw new Error(`${what}: no block named "${ptr.block}"`)
                const schema = b.schema
                if (!schema) throw new Error(`${what}: block "${ptr.block}" has no schema`)
                const key = schema.keys.find((k) => k.key === ptr.row_key)
                if (!key) {
                    throw new Error(
                        `${what}: no row with key "${ptr.row_key}" in "${ptr.block}"`
                    )
                }
                const field = schema.fields.find((f) => f.field === ptr.field)
                if (!field) {
                    throw new Error(
                        `${what}: no field "${ptr.field}" in "${ptr.block}"`
                    )
                }
                return {
                    sheetIdx: b.sheetIdx,
                    row: b.rowStart + key.idx,
                    col: b.colStart + field.idx,
                    blockId: b.blockId,
                    blockRow: key.idx,
                    blockCol: field.idx,
                }
            }
            if (ptr.row === undefined || ptr.col === undefined) {
                throw new Error(
                    `${what}: give either (block, row_key, field) or (row, col)`
                )
            }
            return {sheetIdx: ptr.sheet_idx ?? 0, row: ptr.row, col: ptr.col}
        }

        const setAt = resolve(input.set, 'set')
        const targetAt = resolve(input.target, 'target')

        const writePayload = (v: number): EditPayload =>
            setAt.blockId !== undefined
                ? {
                      type: 'blockInput',
                      value: new BlockInputBuilder()
                          .sheetIdx(setAt.sheetIdx)
                          .blockId(setAt.blockId)
                          .row(setAt.blockRow ?? 0)
                          .col(setAt.blockCol ?? 0)
                          .input(String(v))
                          .build(),
                  }
                : {
                      type: 'cellInput',
                      value: {
                          sheetIdx: setAt.sheetIdx,
                          row: setAt.row,
                          col: setAt.col,
                          content: String(v),
                      },
                  }

        const readTarget = async (): Promise<number | null> => {
            const cells = await client.getCells({
                sheetIdx: targetAt.sheetIdx,
                startRow: targetAt.row,
                startCol: targetAt.col,
                endRow: targetAt.row,
                endCol: targetAt.col,
            })
            if (isErrorMessage(cells)) {
                throw new Error(`getCells failed: ${cells.msg}`)
            }
            const info = (cells as readonly CellInfo[])[0]
            if (info === undefined) return null
            const v = flattenValue(info.value)
            return typeof v === 'number' ? v : null
        }

        /** Evaluate the target with the input set to `v`, changing nothing. */
        let probes = 0
        const probe = async (v: number): Promise<number | null> => {
            probes += 1
            const toggleRes = await client.toggleStatus({useTemp: true})
            if (isErrorMessage(toggleRes)) {
                throw new Error(`toggleStatus failed: ${toggleRes.msg}`)
            }
            try {
                const result = await client.handleTransaction({
                    transaction: {payloads: [writePayload(v)], undoable: false, temp: true},
                })
                if (isErrorMessage(result)) {
                    throw new Error(`goal_seek: ${result.msg}`)
                }
                if (result.status.type === 'err') {
                    throw transactionFailure('goal_seek', result)
                }
                return await readTarget()
            } finally {
                const cleaned = await client.cleanupTempStatus()
                if (isErrorMessage(cleaned)) {
                    throw new Error(
                        `goal_seek could not discard its temp branch (${cleaned.msg}) — ` +
                            'the workbook may now hold a probe value'
                    )
                }
            }
        }

        const current = await (async (): Promise<number> => {
            const cells = await client.getCells({
                sheetIdx: setAt.sheetIdx,
                startRow: setAt.row,
                startCol: setAt.col,
                endRow: setAt.row,
                endCol: setAt.col,
            })
            if (isErrorMessage(cells)) return 0
            const info = (cells as readonly CellInfo[])[0]
            const v = info === undefined ? null : flattenValue(info.value)
            return typeof v === 'number' ? v : 0
        })()

        // f(x) = target(x) - to. Bisection needs a sign change.
        const f = async (x: number): Promise<number | null> => {
            const y = await probe(x)
            return y === null ? null : y - input.to
        }

        let lo: number
        let hi: number
        let flo: number | null
        let fhi: number | null
        if (input.between !== undefined) {
            lo = Math.min(input.between[0], input.between[1])
            hi = Math.max(input.between[0], input.between[1])
            flo = await f(lo)
            fhi = await f(hi)
        } else {
            // Expand outward from the current value until the sign flips. A
            // model's inputs are rarely near zero in a useful way, so step by a
            // fraction of the value and grow geometrically.
            const base = current === 0 ? 1 : Math.abs(current)
            lo = current
            hi = current
            flo = await f(current)
            fhi = flo
            let step = base * 0.5
            let found = false
            for (let k = 0; k < 24 && !found; k++) {
                const nextLo = current - step
                const nextHi = current + step
                const fNextLo = await f(nextLo)
                if (fNextLo !== null && flo !== null && fNextLo * flo <= 0) {
                    lo = nextLo
                    hi = current
                    fhi = flo
                    flo = fNextLo
                    found = true
                    break
                }
                const fNextHi = await f(nextHi)
                if (fNextHi !== null && flo !== null && fNextHi * flo <= 0) {
                    lo = current
                    hi = nextHi
                    fhi = fNextHi
                    found = true
                    break
                }
                step *= 2
            }
            if (!found) {
                return {
                    data: {
                        value: null,
                        achieved: null,
                        converged: false,
                        iterations: probes,
                        note:
                            `no bracket found around the current value (${current}) after ` +
                            `${probes} probes — pass \`between\` with a range you expect the answer in`,
                    },
                    display: 'No bracket found; pass `between`.',
                }
            }
        }

        if (flo === null || fhi === null) {
            return {
                data: {
                    value: null,
                    achieved: null,
                    converged: false,
                    iterations: probes,
                    searched: [lo, hi],
                    note: 'the target did not evaluate to a number at a bracket end',
                },
                display: 'Target is not numeric at the bracket ends.',
            }
        }
        if (flo * fhi > 0) {
            return {
                data: {
                    value: null,
                    achieved: null,
                    converged: false,
                    iterations: probes,
                    searched: [lo, hi],
                    note:
                        `the target does not cross ${input.to} between ${lo} and ${hi} ` +
                        `(it is ${flo + input.to} and ${fhi + input.to} at the ends)`,
                },
                display: `No crossing of ${input.to} in [${lo}, ${hi}].`,
            }
        }

        let mid = (lo + hi) / 2
        let fmid: number | null = null
        for (let k = 0; k < maxIter; k++) {
            mid = (lo + hi) / 2
            fmid = await f(mid)
            if (fmid === null) break
            if (Math.abs(fmid) <= tol) break
            if (fmid * flo <= 0) {
                hi = mid
                fhi = fmid
            } else {
                lo = mid
                flo = fmid
            }
        }

        const achieved = fmid === null ? null : fmid + input.to
        const converged = fmid !== null && Math.abs(fmid) <= tol
        return {
            data: {
                value: mid,
                achieved,
                converged,
                iterations: probes,
                searched: [lo, hi],
                note: converged
                    ? undefined
                    : `stopped after ${maxIter} bisection steps; the bracket narrowed to ` +
                      `[${lo}, ${hi}] without reaching the tolerance`,
            },
            display: converged
                ? `${mid} gives ${achieved} (${probes} probes).`
                : `Best ${mid} gives ${achieved}; not within tolerance.`,
        }
    },
}

export const EDIT_TOOLS: Tool[] = [
    goalSeek as Tool,
    setBlockCells,
    clearBlock,
    previewChanges,
] as Tool[]
