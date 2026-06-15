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

import type {JSONSchema, Tool} from '../tool'

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
    /** Restrict to a single block; omit for workbook-wide scan. */
    block?: string
    /** Cap on entries returned. Default 50. */
    limit?: number
}

export const listViolations: Tool<
    ListViolationsInput,
    {violations: ValidationViolation[]; truncated: boolean}
> = {
    namespace: 'inspect',
    name: 'list_violations',
    description:
        'Scan validation shadow cells and return every cell whose validation formula currently evaluates FALSE. Validation is advisory — the cell still holds the value, but the host renders a warning marker. Use this to answer "why is something red" or "what did I do wrong" without reading the full sheet.',
    mutates: false,
    confirmation: 'never',
    cost: 'cheap',
    inputSchema: {
        properties: {
            block: {
                type: 'string',
                description: 'Block ref name. Omit to scan the whole workbook.',
            },
            limit: {type: 'integer', minimum: 1, default: 50},
        },
    },
    handler: async () => {
        throw new Error('TODO: list_violations')
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
    editable: boolean
    /** Static flag from field schema. */
    user_editable_flag: boolean
    /** Editability formula source (if any). */
    editability_rule?: string
    /** Current value of the editability shadow ('true'/'false'/error string). */
    rule_value?: string
    /** One-line plain-language explanation. */
    reason: string
}

export const whyLocked: Tool<WhyLockedInput, WhyLockedOutput> = {
    namespace: 'inspect',
    name: 'why_locked',
    description:
        'Explain whether a specific cell is editable right now and why. Combines the static user_editable flag with the per-cell editability formula (if set) and reports both. Use this when the user asks "why can\'t I change this".',
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
    handler: async () => {
        throw new Error('TODO: why_locked')
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
    handler: async () => {
        throw new Error('TODO: get_active_selection')
    },
}

// ---------------------------------------------------------------------------
// 4. get_sheet_summary
// ---------------------------------------------------------------------------

interface SheetSummary {
    name: string
    sheet_idx: number
    /** Lightweight: just names + positions, not full schemas. */
    blocks: Array<{
        name: string
        position: {row: number; col: number}
        row_count: number
        col_count: number
    }>
    /** Dimensions of populated cells, even outside blocks. */
    dimension: {max_row: number; max_col: number}
}

export const getSheetSummary: Tool<{}, {sheets: SheetSummary[]}> = {
    namespace: 'inspect',
    name: 'get_sheet_summary',
    description:
        'Lightweight workbook map: list of sheets, each with its blocks and overall dimensions. Use this as the first call when the agent is dropped into an unfamiliar workbook — it answers "what is in this file" cheaply. For block schemas, follow up with describe_block.',
    mutates: false,
    confirmation: 'never',
    cost: 'cheap',
    inputSchema: {properties: {}},
    handler: async () => {
        throw new Error('TODO: get_sheet_summary')
    },
}

// ---------------------------------------------------------------------------
// Bundle
// ---------------------------------------------------------------------------

export const INSPECT_TOOLS: Tool[] = [
    listViolations,
    whyLocked,
    getActiveSelection,
    getSheetSummary,
] as Tool[]

// Mark JSONSchema as referenced to keep the import explicit for future use.
void (null as unknown as JSONSchema)
