/**
 * Inspect tools — read-only views over the workbook for the agent to
 * "see" what the user sees: where validation warnings fire, why a cell
 * is currently locked, what sheets and blocks exist, and what the user
 * has selected.
 *
 * Handlers are intentionally thin — they describe the contract. Real
 * implementations dispatch to the workbook client and the block manager
 * (which owns shadow-cell state for validation / editability formulas).
 */

import {getFirstCell, isErrorMessage} from 'logisheets-web/pure'
import type {
    BlockInfo,
    Client,
    Selection,
    SheetCellId,
    Value,
} from 'logisheets-web/pure'
import type {JSONSchema, Tool, ToolContext} from '../tool.js'
import {locateInBlock} from './edit.js'

function asClient(ctx: ToolContext): Client {
    return ctx.workbook as Client
}

/** Flatten an engine `Value` for LLM consumption. Errors get a
 *  "#ERR:..." prefix so they're distinguishable from real strings. */
function flattenCellValue(v: Value): string | number | boolean | null {
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

// ---------------------------------------------------------------------------
// Shared output shapes
// ---------------------------------------------------------------------------

export interface CellAddress {
    sheet: string
    row: number
    col: number
}

export interface ValidationViolation {
    /** Block ref name. */
    block: string
    /** Row key (value of the first/key column). */
    row_key: string
    /** Field (column) name that failed validation. */
    field: string
    /** Current cell value rendered as string. */
    current_value: string
    /** The validation formula source, with placeholders unsubstituted. */
    rule: string
    /**
     * Optional human-readable explanation. Crafts may attach a
     * `validation_description` in field metadata; if absent, this is the
     * raw rule.
     */
    explanation?: string
    address: CellAddress
}

// ---------------------------------------------------------------------------
// 1. list_violations
// ---------------------------------------------------------------------------

interface ListViolationsInput {
    /** Restrict to a single block by ref name; omit to scan everything. */
    block?: string
    /** Restrict to a single sheet by name. Composes with `block` (a
     *  block ref name is workbook-unique, but a caller might pass both
     *  for documentation purposes). */
    sheet?: string
    /** Cap on entries returned. Default 50. Hitting the cap surfaces as
     *  `truncated: true` so the LLM knows to narrow its scope or pull
     *  more. */
    limit?: number
}

const DEFAULT_LIMIT = 50

export const listViolations: Tool<
    ListViolationsInput,
    {violations: ValidationViolation[]; truncated: boolean}
> = {
    namespace: 'inspect',
    name: 'list_violations',
    description: [
        'Scan validation shadow cells and return every cell whose validation formula currently evaluates FALSE. Validation is advisory — the cell still holds its value, but the host UI renders a warning marker and you should treat it as "something the user/AI got wrong".',
        '',
        "Use this when answering 'why is something red?', 'what's broken after my last edit?', or before committing a multi-step build that depends on existing constraints.",
        '',
        'Filters compose: omit both `block` and `sheet` to scan the whole workbook; pass either to narrow.',
        '',
        'Pull-based on purpose: the LLM is turn-based, polling at decision points is cheaper than maintaining a live subscription. The host UI has its own per-cell push subscription for canvas warning markers.',
    ].join('\n'),
    mutates: false,
    confirmation: 'never',
    cost: 'cheap',
    inputSchema: {
        properties: {
            block: {
                type: 'string',
                description: 'Block ref name. Omit to scan all blocks.',
            },
            sheet: {
                type: 'string',
                description: 'Sheet name. Omit to scan all sheets.',
            },
            limit: {
                type: 'integer',
                minimum: 1,
                default: DEFAULT_LIMIT,
            },
        },
    },
    handler: async (input, ctx) => {
        const client = asClient(ctx)
        const limit = input.limit ?? DEFAULT_LIMIT

        // 1. Pull blocks (with their schemas + cells) and sheet name
        //    map in parallel.
        const [blocksRes, sheetsRes] = await Promise.all([
            client.getAllBlocks({}),
            client.getAllSheetInfo(),
        ])
        if (isErrorMessage(blocksRes)) {
            throw new Error(`getAllBlocks failed: ${blocksRes.msg}`)
        }
        if (isErrorMessage(sheetsRes)) {
            throw new Error(`getAllSheetInfo failed: ${sheetsRes.msg}`)
        }
        const sheetName = (idx: number): string =>
            sheetsRes[idx]?.name ?? `sheet#${idx}`

        // 2. Filter to blocks in scope.
        let blocks: readonly BlockInfo[] = blocksRes
        if (input.sheet !== undefined) {
            const targetIdx = sheetsRes.findIndex((s) => s.name === input.sheet)
            if (targetIdx < 0) {
                throw new Error(`No sheet named "${input.sheet}"`)
            }
            blocks = blocks.filter((b) => b.sheetIdx === targetIdx)
        }
        if (input.block !== undefined) {
            blocks = blocks.filter((b) => b.schema?.name === input.block)
            if (blocks.length === 0) {
                throw new Error(`No block with ref name "${input.block}"`)
            }
        }

        // 3. For each block, enumerate (row, field-with-validation)
        //    pairs as sheet-absolute coordinates. Group by sheetIdx so
        //    we can issue one bulk shadow fetch per sheet.
        type Probe = {
            block: BlockInfo
            fieldName: string
            fieldRule: string
            keyValue: string
            blockRow: number
            blockCol: number
            sheetRow: number
            sheetCol: number
        }
        const probesBySheet = new Map<number, Probe[]>()

        for (const block of blocks) {
            const schema = block.schema
            if (!schema) continue

            // Fields that carry a validation rule.
            const ruled = schema.fields.filter(
                (f) =>
                    typeof f.validationFormula === 'string' &&
                    f.validationFormula.trim() !== ''
            )
            if (ruled.length === 0) continue

            // Row index → key (for output labelling).
            const keyByRow = new Map<number, string>()
            for (const k of schema.keys) keyByRow.set(k.idx, k.key)

            for (let r = 0; r < block.rowCnt; r++) {
                for (const f of ruled) {
                    const sheetRow = block.rowStart + r
                    const sheetCol = block.colStart + f.idx
                    const list = probesBySheet.get(block.sheetIdx) ?? []
                    list.push({
                        block,
                        fieldName: f.field,
                        fieldRule: (f.validationFormula ?? '').trim(),
                        keyValue: keyByRow.get(r) ?? '',
                        blockRow: r,
                        blockCol: f.idx,
                        sheetRow,
                        sheetCol,
                    })
                    probesBySheet.set(block.sheetIdx, list)
                }
            }
        }

        if (probesBySheet.size === 0) {
            return {
                data: {violations: [], truncated: false},
                display: 'No validation rules declared in scope.',
            }
        }

        // 4. Bulk-allocate validation shadow ids per sheet, then bulk-
        //    read their values. Two RPCs per sheet (allocate + read)
        //    instead of two per probe.
        type Resolved = Probe & {value: Value}
        const resolved: Resolved[] = []
        for (const [sheetIdx, probes] of probesBySheet) {
            const idsRes = await client.getShadowCellIds({
                sheetIdx,
                rowIdx: probes.map((p) => p.sheetRow),
                colIdx: probes.map((p) => p.sheetCol),
                kind: 'validation',
            })
            if (isErrorMessage(idsRes)) {
                throw new Error(
                    `getShadowCellIds failed on sheet ${sheetIdx}: ${idsRes.msg}`
                )
            }
            const sids: readonly SheetCellId[] = idsRes
            const infosRes = await client.batchGetCellInfoById({
                ids: sids as unknown as Parameters<
                    typeof client.batchGetCellInfoById
                >[0]['ids'],
            })
            if (isErrorMessage(infosRes)) {
                throw new Error(
                    `batchGetCellInfoById failed on sheet ${sheetIdx}: ${infosRes.msg}`
                )
            }
            probes.forEach((p, i) => {
                resolved.push({...p, value: infosRes[i].value})
            })
        }

        // 5. Filter to actual violations (shadow value is bool=false,
        //    or any truthy-falsy form that maps to false). Skip
        //    'empty' / errors — the validation rule hasn't computed
        //    yet, treat it as "no decision".
        const isViolation = (v: Value): boolean => {
            if (v === 'empty') return false
            if (v.type === 'bool') return v.value === false
            if (v.type === 'number') return v.value === 0
            if (v.type === 'str')
                return v.value === '' || v.value.toUpperCase() === 'FALSE'
            if (v.type === 'error') return false
            return false
        }

        const violations: ValidationViolation[] = []
        let truncated = false
        for (const r of resolved) {
            if (!isViolation(r.value)) continue
            if (violations.length >= limit) {
                truncated = true
                break
            }
            // Pull the cell's *actual* value (not the shadow's bool)
            // from BlockInfo.cells. cells is row-major: r * colCnt + c.
            const cellIdx = r.blockRow * r.block.colCnt + r.blockCol
            const cell = r.block.cells[cellIdx]
            const flat = cell ? flattenCellValue(cell.value) : null
            violations.push({
                block: r.block.schema?.name ?? `block#${r.block.blockId}`,
                row_key: r.keyValue,
                field: r.fieldName,
                current_value: flat === null ? '' : String(flat),
                rule: r.fieldRule,
                address: {
                    sheet: sheetName(r.block.sheetIdx),
                    row: r.sheetRow,
                    col: r.sheetCol,
                },
            })
        }

        return {
            data: {violations, truncated},
            display:
                violations.length === 0
                    ? 'No validation violations.'
                    : `${violations.length} violation${
                          violations.length === 1 ? '' : 's'
                      }${truncated ? ` (truncated at limit=${limit})` : ''}.`,
        }
    },
}

// ---------------------------------------------------------------------------
// 2. why_locked
// ---------------------------------------------------------------------------

interface WhyLockedInput {
    block: string
    row_key: string
    field: string
}

interface WhyLockedOutput {
    /** Final verdict — true if the agent can write to this cell. */
    editable: boolean
    /** Engine-computed cell? `value_formula` on the schema forces the
     *  cell to be derived; writes are rejected at the container layer. */
    has_value_formula: boolean
    value_formula?: string
    /** The schema's editability formula, if declared. */
    editability_formula?: string
    /** Current evaluation of the per-cell UserEditable shadow:
     *    'true' / 'false' — formula's current boolean result
     *    'empty'           — no shadow installed (no rule, or not yet computed)
     *    'error: <code>'   — formula errored
     */
    editability_rule_value?: string
    /** True for fields[0] (the row-key column — always read-only by
     *  the system, regardless of any other rule). */
    is_key_column: boolean
    /** Plain-language reason. Always set, even when `editable: true`. */
    reason: string
}

/** Minimal host-side interface for the static `userEditable` flag.
 *  Read-only — we never write back. Loose-typed because the engine
 *  package isn't a dependency of logician. */
interface FieldManagerLike {
    getByBlock(
        sheetId: number,
        blockId: number
    ): ReadonlyArray<{name: string; userEditable?: boolean}>
}
interface BlockManagerLike {
    fieldManager: FieldManagerLike
}
function tryReadStaticUserEditable(
    sheetId: number,
    blockId: number,
    fieldName: string
): boolean | undefined {
    const g = globalThis as unknown as {blockManager?: BlockManagerLike}
    const bm = g.blockManager
    if (!bm) return undefined
    try {
        const fis = bm.fieldManager.getByBlock(sheetId, blockId)
        const fi = fis.find((f) => f.name === fieldName)
        return fi?.userEditable
    } catch {
        return undefined
    }
}

export const whyLocked: Tool<WhyLockedInput, WhyLockedOutput> = {
    namespace: 'inspect',
    name: 'why_locked',
    description: [
        'Explain whether a specific cell is editable right now, and why. Three gates compose (any one says "no" → not editable):',
        '',
        '  1. **value_formula** on the schema → cell is engine-computed; writes always rejected by the container layer.',
        '  2. **editability_formula** on the schema → per-row UserEditable shadow evaluates true/false. False means the host permission layer rejects writes.',
        '  3. **Key column** — fields[0] is always read-only by system convention.',
        '',
        '(If the host exposes its FieldManager, the static `userEditable` flag on FieldInfo is also reported, but it overlaps with #3 + #2 in practice.)',
        '',
        'Use this when set_block_cell fails with "permission denied" / "engine-computed" or the user asks why a cell looks locked.',
    ].join('\n'),
    mutates: false,
    confirmation: 'never',
    cost: 'cheap',
    inputSchema: {
        properties: {
            block: {type: 'string'},
            row_key: {type: 'string'},
            field: {type: 'string'},
        },
        required: ['block', 'row_key', 'field'],
    },
    handler: async (input, ctx) => {
        const client = asClient(ctx)

        // 1. Resolve block + schema; find the (row, field) pair's
        //    block-relative + sheet-absolute coordinates.
        const blocksRes = await client.getAllBlocks({})
        if (isErrorMessage(blocksRes)) {
            throw new Error(`getAllBlocks failed: ${blocksRes.msg}`)
        }
        const block = blocksRes.find((b) => b.schema?.name === input.block)
        if (!block) {
            throw new Error(`No block with ref name "${input.block}"`)
        }
        const schema = block.schema!

        const fieldEntry = schema.fields.find((f) => f.field === input.field)
        if (!fieldEntry) {
            throw new Error(
                `No field named "${input.field}" in block "${input.block}"`
            )
        }
        const rowEntry = schema.keys.find((k) => k.key === input.row_key)
        if (!rowEntry) {
            throw new Error(
                `No row with key "${input.row_key}" in block "${input.block}"`
            )
        }

        // Block-relative cols of the field == fieldEntry.idx;
        // fields[0] is always the key column per BindFormSchema convention.
        const isKeyCol = fieldEntry.idx === 0
        const sheetRow = block.rowStart + rowEntry.idx
        const sheetCol = block.colStart + fieldEntry.idx

        const valueFormula =
            typeof fieldEntry.valueFormula === 'string' &&
            fieldEntry.valueFormula.trim() !== ''
                ? fieldEntry.valueFormula.trim()
                : undefined
        const editabilityFormula =
            typeof fieldEntry.editabilityFormula === 'string' &&
            fieldEntry.editabilityFormula.trim() !== ''
                ? fieldEntry.editabilityFormula.trim()
                : undefined

        // 2. If an editability formula is declared, read the shadow's
        //    current value. (No shadow → no formula → skip.)
        let editabilityRuleValue: string | undefined
        let editabilityRulePasses = true
        if (editabilityFormula) {
            const sidRes = await client.getShadowCellId({
                sheetIdx: block.sheetIdx,
                rowIdx: sheetRow,
                colIdx: sheetCol,
                kind: 'userEditable',
            })
            if (isErrorMessage(sidRes)) {
                editabilityRuleValue = `error: ${sidRes.msg}`
                editabilityRulePasses = false
            } else if (sidRes.cellId.type !== 'ephemeralCell') {
                editabilityRuleValue = 'empty'
            } else {
                const eid = sidRes.cellId.value as number
                const info = await client.getShadowInfoById({shadowId: eid})
                if (isErrorMessage(info)) {
                    editabilityRuleValue = `error: ${info.msg}`
                    editabilityRulePasses = false
                } else {
                    const v = info.value
                    if (v === 'empty') {
                        editabilityRuleValue = 'empty'
                        // Treat empty as "rule not computed yet" — same
                        // policy as use-editable.ts: fall back to other
                        // gates; don't make a decision here.
                    } else if (v.type === 'bool') {
                        editabilityRuleValue = v.value ? 'true' : 'false'
                        editabilityRulePasses = v.value
                    } else if (v.type === 'number') {
                        const b = v.value !== 0
                        editabilityRuleValue = b ? 'true' : 'false'
                        editabilityRulePasses = b
                    } else if (v.type === 'str') {
                        const b =
                            v.value !== '' && v.value.toUpperCase() !== 'FALSE'
                        editabilityRuleValue = b ? 'true' : 'false'
                        editabilityRulePasses = b
                    } else if (v.type === 'error') {
                        editabilityRuleValue = `error: ${v.value}`
                        // Fail-closed on errors — match permission patch's
                        // behaviour of denying writes when the rule is
                        // broken.
                        editabilityRulePasses = false
                    }
                }
            }
        }

        // 3. Optional: read static userEditable from host FieldManager.
        const staticUserEditable = tryReadStaticUserEditable(
            block.sheetId,
            block.blockId,
            input.field
        )

        // 4. Compose final verdict + plain-language reason.
        let editable = true
        let reason: string

        if (valueFormula) {
            editable = false
            reason = `Field "${input.field}" has value_formula \`${valueFormula}\` — every cell in this column is engine-computed; direct writes are rejected.`
        } else if (isKeyCol) {
            editable = false
            reason = `Field "${input.field}" is the row-key column; keys are row identifiers and always read-only by system convention.`
        } else if (editabilityFormula && !editabilityRulePasses) {
            editable = false
            reason = `editability_formula \`${editabilityFormula}\` evaluates to ${editabilityRuleValue} on row "${input.row_key}" — the host permission layer rejects writes.`
        } else if (staticUserEditable === false) {
            editable = false
            reason = `Field "${input.field}" has static \`userEditable: false\` on its FieldInfo (host UI guard).`
        } else {
            editable = true
            const bits: string[] = []
            if (editabilityFormula) {
                bits.push(
                    `editability_formula evaluates to ${
                        editabilityRuleValue ?? 'true'
                    }`
                )
            }
            if (staticUserEditable === true)
                bits.push('static userEditable=true')
            reason = bits.length
                ? `Editable — ${bits.join(', ')}.`
                : 'Editable — no rules forbid this cell.'
        }

        return {
            data: {
                editable,
                has_value_formula: valueFormula !== undefined,
                value_formula: valueFormula,
                editability_formula: editabilityFormula,
                editability_rule_value: editabilityRuleValue,
                is_key_column: isKeyCol,
                reason,
            },
            display: reason,
        }
    },
}

// ---------------------------------------------------------------------------
// 3. get_active_selection
// ---------------------------------------------------------------------------

interface ActiveSelectionOutput {
    /** Empty if the user has no active selection. */
    selection: CellAddress | null
    /** If the selected cell falls inside a block, this resolves to it. */
    in_block?: {
        block: string
        row_key: string
        field: string
    }
    /** Current displayed value of the selected cell, if any. */
    value?: string
}

export const getActiveSelection: Tool<
    Record<string, never>,
    ActiveSelectionOutput
> = {
    namespace: 'inspect',
    name: 'get_active_selection',
    description:
        'Return the cell the user currently has selected, with block/row/field context if the cell falls inside a block. Use this when the user asks about "this cell" / "this row" without naming it.',
    mutates: false,
    confirmation: 'never',
    cost: 'cheap',
    inputSchema: {
        properties: {},
    },
    handler: async (_input, ctx) => {
        // Host (logisheets-engine craft panel) sets `window.selection`
        // before invoking the craft. We read it loosely — logician
        // doesn't depend on logisheets-engine — but the shape matches
        // logisheets-web's `Selection`.
        const sel = (globalThis as {selection?: Selection}).selection
        if (!sel || !sel.data.data) {
            return {
                data: {selection: null},
                display: 'No active selection.',
            }
        }

        const client = asClient(ctx)
        const [sheetsRes, blocksRes] = await Promise.all([
            client.getAllSheetInfo(),
            client.getAllBlocks({}),
        ])
        if (isErrorMessage(sheetsRes)) {
            throw new Error(`getAllSheetInfo failed: ${sheetsRes.msg}`)
        }
        if (isErrorMessage(blocksRes)) {
            throw new Error(`getAllBlocks failed: ${blocksRes.msg}`)
        }

        const {y: row, x: col} = getFirstCell(sel.data)
        const sheetIdx = sel.sheetIdx
        const sheetName = sheetsRes[sheetIdx]?.name ?? `sheet#${sheetIdx}`
        const address: CellAddress = {sheet: sheetName, row, col}

        // Find enclosing block, if any.
        let in_block: ActiveSelectionOutput['in_block']
        for (const b of blocksRes) {
            if (b.sheetIdx !== sheetIdx) continue
            if (row < b.rowStart || row >= b.rowStart + b.rowCnt) continue
            if (col < b.colStart || col >= b.colStart + b.colCnt) continue
            const schema = b.schema
            if (!schema) break
            const rRel = row - b.rowStart
            const cRel = col - b.colStart
            const keyEntry = schema.keys.find((k) => k.idx === rRel)
            const fieldEntry = schema.fields.find((f) => f.idx === cRel)
            if (keyEntry && fieldEntry) {
                in_block = {
                    block: schema.name,
                    row_key: keyEntry.key,
                    field: fieldEntry.field,
                }
            }
            break
        }

        // Cell value — best-effort; failure is non-fatal.
        let value: string | undefined
        const cellRes = await client.getCell({sheetIdx, row, col})
        if (!isErrorMessage(cellRes)) {
            const flat = flattenCellValue(cellRes.value)
            if (flat !== null) value = String(flat)
        }

        const displayParts = [`${sheetName}!R${row}C${col}`]
        if (in_block) {
            displayParts.push(
                `→ ${in_block.block}[${in_block.row_key}].${in_block.field}`
            )
        }
        if (value !== undefined) displayParts.push(`= ${value}`)

        return {
            data: {selection: address, in_block, value},
            display: displayParts.join(' '),
        }
    },
}

// ---------------------------------------------------------------------------
// Design note: no `get_sheet_summary`.
//
// `build__list_blocks` already returns blocks grouped by sheet, which
// covers the "what is in this file" question for a block-only agent.
// Adding a second top-level overview tool just gives the LLM two near-
// identical entry points to pick between — and the wrong choice when it
// matters (block schemas live on list_blocks, not summary). Point the
// agent at list_blocks via its description.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Bundle
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// trace — what a number depends on, and what depends on it
// ---------------------------------------------------------------------------

/** A cell named either semantically or by coordinate. */
interface TraceTarget {
    block?: string
    row_key?: string
    field?: string
    sheet_idx?: number
    row?: number
    col?: number
}

interface TraceInput {
    target: TraceTarget
    /** Which way to look. Both by default — they answer different questions. */
    direction?: 'precedents' | 'dependents' | 'both'
}

/** A cell, reported semantically when it sits in a block. */
interface TracedCell {
    block: string | null
    row_key: string | null
    field: string | null
    sheet_idx: number
    row: number
    col: number
    /** A1 form, so the answer is readable without doing the arithmetic. */
    ref: string
}

interface TracedRange {
    sheet_idx: number
    ref: string
    /**
     * How precise this edge is.
     *
     * `cell` — exactly this cell. `field` — the engine tracks BLOCKREF
     * dependencies per (block, field), not per row, so the edge is really "this
     * block's field", of which the queried cell is one row. `block` — a
     * BLOCKREFS scan, which depends on the block as a whole.
     */
    scope: 'cell' | 'field' | 'block'
    /** Set when the range is a single cell that lands inside a block. */
    block: string | null
    row_key: string | null
    field: string | null
    /** A whole-column (`A:A`) or whole-row (`3:3`) reference. */
    all_rows: boolean
    all_cols: boolean
}

interface TraceOutput {
    target: TracedCell
    /** What this cell reads. Present unless direction was 'dependents'. */
    precedents?: TracedRange[]
    /** What reads this cell, each with the reference it used. Present unless
     *  direction was 'precedents'. */
    dependents?: Array<TracedCell & {via: string; scope: 'cell' | 'field' | 'block'}>
    /**
     * Set when any reported edge is wider than a single cell. Block
     * dependencies are tracked per field, so a dependent list for one block
     * cell is everything that reads that field — an over-approximation, not a
     * per-row answer.
     */
    approximate?: boolean
}

/** 0-based (row, col) to A1. */
function a1(row: number, col: number): string {
    let n = col
    let name = ''
    do {
        name = String.fromCharCode(65 + (n % 26)) + name
        n = Math.floor(n / 26) - 1
    } while (n >= 0)
    return `${name}${row + 1}`
}

function rangeRef(r: {
    startRow: number
    startCol: number
    endRow: number
    endCol: number
    allRows: boolean
    allCols: boolean
}): string {
    if (r.allRows) {
        return `${a1(0, r.startCol).replace(/\d+$/, '')}:${a1(0, r.endCol).replace(/\d+$/, '')}`
    }
    if (r.allCols) {
        return `${r.startRow + 1}:${r.endRow + 1}`
    }
    const from = a1(r.startRow, r.startCol)
    const to = a1(r.endRow, r.endCol)
    return from === to ? from : `${from}:${to}`
}

export const trace: Tool<TraceInput, TraceOutput> = {
    namespace: 'inspect',
    name: 'trace',
    description: [
        "Follow a cell's dependencies, in either direction, using the engine's own dependency graph.",
        '',
        '  - `precedents` — what this cell reads. Use it to audit a number: "why is value-per-share what it is".',
        '  - `dependents` — what reads this cell, and through which reference. Use it before changing something: "what breaks if I edit this assumption".',
        '',
        'Both by default. Name the cell semantically as (block, row_key, field), or by coordinate as (row, col) with an optional sheet_idx. Results come back named the same way whenever the cell sits inside a block, so you get "assumptions.wacc" rather than a coordinate to interpret.',
        '',
        'This asks the engine rather than reading formula text, so it sees through BLOCKREF, ranges and whole-column references, and it answers the reverse direction — which formula strings cannot.',
        '',
        'Granularity matters when blocks are involved. The engine tracks block dependencies per (block, field), not per row, so `dependents` of one block cell is everything reading that FIELD — the queried row among them. Each edge carries `scope`: "cell" is exact, "field" and "block" are over-approximations, and `approximate: true` is set on the result when any edge is wider than a cell. Treat a field-wide answer as "at least these", not "exactly these".',
    ].join('\n'),
    mutates: false,
    confirmation: 'never',
    cost: 'cheap',
    inputSchema: {
        properties: {
            target: {
                type: 'object',
                description:
                    'The cell to trace. Either (block, row_key, field) or (row, col).',
                properties: {
                    block: {type: 'string'},
                    row_key: {type: 'string'},
                    field: {type: 'string'},
                    sheet_idx: {type: 'integer', default: 0},
                    row: {type: 'integer'},
                    col: {type: 'integer'},
                },
            },
            direction: {
                type: 'string',
                enum: ['precedents', 'dependents', 'both'],
                default: 'both',
            },
        },
        required: ['target'],
    },
    handler: async (input, ctx) => {
        const client = asClient(ctx)
        const direction = input.direction ?? 'both'

        const allRes = await client.getAllBlocks({})
        if (isErrorMessage(allRes)) {
            throw new Error(`getAllBlocks failed: ${allRes.msg}`)
        }
        const blocks = allRes

        // Resolve the target to coordinates.
        const t = input.target
        let sheetIdx: number
        let row: number
        let col: number
        if (t.block !== undefined) {
            const block = blocks.find((b) => b.schema?.name === t.block)
            if (!block) {
                throw new Error(`no block with ref name "${t.block}"`)
            }
            const schema = block.schema
            if (!schema) {
                throw new Error(`block "${t.block}" has no schema`)
            }
            const key = schema.keys.find((k) => k.key === t.row_key)
            if (!key) {
                throw new Error(
                    `no row with key "${t.row_key}" in block "${t.block}"`
                )
            }
            const field = schema.fields.find((f) => f.field === t.field)
            if (!field) {
                throw new Error(
                    `no field named "${t.field}" in block "${t.block}"`
                )
            }
            sheetIdx = block.sheetIdx
            row = block.rowStart + key.idx
            col = block.colStart + field.idx
        } else {
            if (t.row === undefined || t.col === undefined) {
                throw new Error(
                    'target needs either (block, row_key, field) or (row, col)'
                )
            }
            sheetIdx = t.sheet_idx ?? 0
            row = t.row
            col = t.col
        }

        const name = (si: number, r: number, c: number): TracedCell => {
            const annot = locateInBlock(si, r, c, blocks)
            return {
                block: annot?.block ?? null,
                row_key: annot?.row_key ?? null,
                field: annot?.field ?? null,
                sheet_idx: si,
                row: r,
                col: c,
                ref: a1(r, c),
            }
        }

        const out: TraceOutput = {target: name(sheetIdx, row, col)}

        /**
         * Name a referenced rectangle the way the model talks about it.
         *
         * A BLOCKREF resolves to a rectangle covering a block's rows and one
         * field's column, so reporting the coordinates back would throw away
         * exactly the naming that makes this readable — the point is to answer
         * "assumptions.wacc", not "C1:C2".
         */
        const nameRange = (r: {
            sheetIdx: number
            startRow: number
            startCol: number
            endRow: number
            endCol: number
            allRows: boolean
            allCols: boolean
        }): {
            block: string | null
            row_key: string | null
            field: string | null
            scope: 'cell' | 'field' | 'block'
            isKeyColumn: boolean
        } => {
            const none = {
                block: null,
                row_key: null,
                field: null,
                scope: 'cell' as const,
                isKeyColumn: false,
            }
            if (r.allRows || r.allCols) return none
            // A single cell inside a block names one (key, field) exactly.
            if (r.startRow === r.endRow && r.startCol === r.endCol) {
                const a = locateInBlock(r.sheetIdx, r.startRow, r.startCol, blocks)
                return a === undefined
                    ? none
                    : {...none, block: a.block, row_key: a.row_key, field: a.field}
            }
            // A rectangle spanning a block's whole row range is that block —
            // one column of it names a field, all of it names the block.
            for (const b of blocks) {
                if (b.sheetIdx !== r.sheetIdx) continue
                if (r.startRow !== b.rowStart) continue
                if (r.endRow !== b.rowStart + b.rowCnt - 1) continue
                const schema = b.schema
                if (!schema) continue
                if (r.startCol === r.endCol) {
                    const f = schema.fields.find(
                        (x) => x.idx === r.startCol - b.colStart
                    )
                    if (f) {
                        // fields[0] is the row-key column by construction. A
                        // BLOCKREF depends on it to find its row, but the
                        // formula is not reading the key — flag it so it can be
                        // dropped instead of making every block reference look
                        // like two.
                        const isKey =
                            schema.fields.length > 0 &&
                            f.idx === schema.fields[0]?.idx
                        return {
                            block: schema.name,
                            row_key: null,
                            field: f.field,
                            scope: 'field' as const,
                            isKeyColumn: isKey,
                        }
                    }
                }
                if (
                    r.startCol === b.colStart &&
                    r.endCol === b.colStart + b.colCnt - 1
                ) {
                    return {
                        block: schema.name,
                        row_key: null,
                        field: null,
                        scope: 'block' as const,
                        isKeyColumn: false,
                    }
                }
            }
            return none
        }

        if (direction === 'precedents' || direction === 'both') {
            const res = await client.getPrecedents({sheetIdx, row, col})
            if (isErrorMessage(res)) {
                throw new Error(`getPrecedents failed: ${res.msg}`)
            }
            out.precedents = res
                .map((r) => ({r, named: nameRange(r)}))
                // Drop the key-column edge: a BLOCKREF depends on it to find
                // its row, but the formula is not reading the key, and listing
                // it makes every block reference look like two.
                .filter(({named}) => !named.isKeyColumn)
                // A BLOCKREF depends on both its field and the block as a
                // whole. Reporting both says the same thing twice, the second
                // time less precisely — so keep the block-wide edge only when it
                // is the whole answer, which is the BLOCKREFS case.
                .filter(({named}, _i, all) => {
                    if (named.scope !== 'block' || named.block === null) return true
                    return !all.some(
                        (o) =>
                            o.named.scope === 'field' &&
                            o.named.block === named.block
                    )
                })
                .map(({r, named}) => ({
                    sheet_idx: r.sheetIdx,
                    ref: rangeRef(r),
                    block: named.block,
                    row_key: named.row_key,
                    field: named.field,
                    scope: named.scope,
                    all_rows: r.allRows,
                    all_cols: r.allCols,
                }))
        }

        if (direction === 'dependents' || direction === 'both') {
            const res = await client.getDependents({
                sheetIdx,
                startRow: row,
                startCol: col,
                endRow: row,
                endCol: col,
            })
            if (isErrorMessage(res)) {
                throw new Error(`getDependents failed: ${res.msg}`)
            }
            // One row per dependent cell. A reader that goes through BLOCKREF
            // hangs off more than one virtual vertex — the field's and the
            // block's — so the engine legitimately reports it once per
            // reference. For "what depends on this" that reads as a duplicate,
            // so keep the narrowest reference, which is also the most
            // informative one.
            const area = (r: {
                startRow: number
                startCol: number
                endRow: number
                endCol: number
                allRows: boolean
                allCols: boolean
            }): number =>
                r.allRows || r.allCols
                    ? Number.MAX_SAFE_INTEGER
                    : (r.endRow - r.startRow + 1) * (r.endCol - r.startCol + 1)
            const best = new Map<string, (typeof res)[number]>()
            for (const d of res) {
                const key = `${d.sheetIdx}:${d.row}:${d.col}`
                const prev = best.get(key)
                if (prev === undefined || area(d.via) < area(prev.via)) {
                    best.set(key, d)
                }
            }
            out.dependents = [...best.values()].map((d) => {
                const named = nameRange(d.via)
                return {
                    ...name(d.sheetIdx, d.row, d.col),
                    via:
                        named.block !== null
                            ? `${named.block}.${named.field ?? '*'}`
                            : rangeRef(d.via),
                    scope: named.scope,
                }
            })
        }

        const wide = [
            ...(out.precedents ?? []),
            ...(out.dependents ?? []),
        ].some((x) => x.scope !== 'cell')
        if (wide) out.approximate = true

        const parts: string[] = []
        if (out.precedents) parts.push(`${out.precedents.length} precedent(s)`)
        if (out.dependents) parts.push(`${out.dependents.length} dependent(s)`)
        if (wide) parts.push('some edges are field- or block-wide')
        return {
            data: out,
            display: `${out.target.block ? `${out.target.block}.${out.target.field}` : out.target.ref}: ${parts.join(', ')}.`,
        }
    },
}

export const INSPECT_TOOLS: Tool[] = [
    listViolations,
    whyLocked,
    getActiveSelection,
    trace,
] as Tool[]

// Mark JSONSchema as referenced to keep the import explicit for future use.
void (null as unknown as JSONSchema)
