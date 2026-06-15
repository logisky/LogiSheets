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

import {getFirstCell, isErrorMessage} from 'logisheets-web'
import type {
    BlockInfo,
    Client,
    Selection,
    SheetCellId,
    Value,
} from 'logisheets-web'
import type {JSONSchema, Tool, ToolContext} from '../tool'

function asClient(ctx: ToolContext): Client {
    return ctx.workbook as Client
}

/** Flatten an engine `Value` for LLM consumption. Errors get a
 *  "#ERR:..." prefix so they're distinguishable from real strings. */
function flattenCellValue(
    v: Value
): string | number | boolean | null {
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
            const targetIdx = sheetsRes.findIndex(
                (s) => s.name === input.sheet
            )
            if (targetIdx < 0) {
                throw new Error(`No sheet named "${input.sheet}"`)
            }
            blocks = blocks.filter((b) => b.sheetIdx === targetIdx)
        }
        if (input.block !== undefined) {
            blocks = blocks.filter(
                (b) => b.schema?.name === input.block
            )
            if (blocks.length === 0) {
                throw new Error(
                    `No block with ref name "${input.block}"`
                )
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
                    const list =
                        probesBySheet.get(block.sheetIdx) ?? []
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
                    : `${violations.length} violation${violations.length === 1 ? '' : 's'}${truncated ? ` (truncated at limit=${limit})` : ''}.`,
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
        "  2. **editability_formula** on the schema → per-row UserEditable shadow evaluates true/false. False means the host permission layer rejects writes.",
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
        const block = blocksRes.find(
            (b) => b.schema?.name === input.block
        )
        if (!block) {
            throw new Error(`No block with ref name "${input.block}"`)
        }
        const schema = block.schema!

        const fieldEntry = schema.fields.find(
            (f) => f.field === input.field
        )
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
                            v.value !== '' &&
                            v.value.toUpperCase() !== 'FALSE'
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
                    `editability_formula evaluates to ${editabilityRuleValue ?? 'true'}`
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

export const INSPECT_TOOLS: Tool[] = [
    listViolations,
    whyLocked,
    getActiveSelection,
] as Tool[]

// Mark JSONSchema as referenced to keep the import explicit for future use.
void (null as unknown as JSONSchema)
