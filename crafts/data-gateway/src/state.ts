// data-gateway state schema — the contract between the craft's two faces.
//
// The web authoring UI (src/ui.ts) writes this object into the workbook's
// AppData side channel via `window.setCraftState(JSON.stringify(state))`; the
// headless runtime (src/runtime.ts) reads it back in `onLoad`. The host never
// looks inside — it round-trips the serialized string opaquely (see
// logisheets-core's craft/state.ts). So this module owns the schema on both
// ends: parsing here is the single source of truth for what a valid gateway
// declaration looks like.
//
// Design choices:
//   * Blocks are referenced by their stable `refName` (the block schema name),
//     not by blockId or coordinates — a refName survives row/col edits and is
//     what BLOCKREF-style resolution already keys on.
//   * Validation targets are referenced by (sheetId, CellId), the engine's
//     stable identity for a cell, so a rule stays attached to the same logical
//     cell across insertions and deletions. The runtime resolves these back to
//     live coordinates at load time.

import type {CellId} from 'logisheets-web'

/** The state schema version. Bump when the shape changes incompatibly. */
export const DATA_GATEWAY_VERSION = 1 as const

/**
 * One per-cell validation rule. `formula` is an Excel expression with no
 * leading `=` that should evaluate to a boolean — TRUE means valid, FALSE
 * means the cell violates the rule (mirrors logisheets-core's ValidationRule).
 *
 * Reference the target cell with `#PLACEHOLDER` (the engine resolves it to
 * this very cell), e.g. `#PLACEHOLDER>0` or `LEN(#PLACEHOLDER)<=10`. Because
 * the rule is bound by stable `cellId` and the formula self-references via
 * `#PLACEHOLDER`, it keeps checking the right cell after rows/cols are
 * inserted or deleted — never write a literal `A1`, which would not move.
 */
export interface ValidationEntry {
    /** Stable sheet id of the target cell. */
    sheetId: number
    /** Stable cell id of the target cell (normal / block / ephemeral). */
    cellId: CellId
    /** Excel boolean expression, no leading `=`. */
    formula: string
}

/**
 * The whole data-gateway declaration for a workbook.
 *
 *   inputBlocks   blocks (by refName) an incoming RPC request may WRITE
 *   outputBlocks  blocks (by refName) an incoming RPC request may READ
 *   validations   per-cell rules checked once request inputs are in place
 */
// A `type` (not `interface`) so it is assignable to logisheets-core's
// `CraftState` (= Record<string, unknown>): a closed object type carries an
// implicit index signature for that check, an interface does not.
export type DataGatewayState = {
    version: typeof DATA_GATEWAY_VERSION
    inputBlocks: string[]
    outputBlocks: string[]
    validations: ValidationEntry[]
}

/** A fresh, empty declaration. */
export function emptyState(): DataGatewayState {
    return {
        version: DATA_GATEWAY_VERSION,
        inputBlocks: [],
        outputBlocks: [],
        validations: [],
    }
}

/** Serialize for `window.setCraftState`. */
export function serializeState(state: DataGatewayState): string {
    return JSON.stringify(state)
}

/**
 * Parse a stored state string back into a {@link DataGatewayState}. Tolerant:
 * unknown/malformed input yields a fresh empty state rather than throwing, so a
 * corrupt AppData slice degrades to "no gateway configured" instead of
 * breaking load. Individual malformed entries are dropped.
 */
export function parseState(json: string | undefined): DataGatewayState {
    if (!json) return emptyState()
    let raw: unknown
    try {
        raw = JSON.parse(json)
    } catch {
        return emptyState()
    }
    return normalizeState(raw)
}

/** Coerce an already-parsed value into a valid {@link DataGatewayState}. */
export function normalizeState(raw: unknown): DataGatewayState {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return emptyState()
    }
    const r = raw as Record<string, unknown>
    return {
        version: DATA_GATEWAY_VERSION,
        inputBlocks: uniqueStrings(r.inputBlocks),
        outputBlocks: uniqueStrings(r.outputBlocks),
        validations: normalizeValidations(r.validations),
    }
}

/** Stable string key for a validation target, for dedup / lookup. */
export function validationKey(sheetId: number, cellId: CellId): string {
    return `${sheetId}:${cellIdKey(cellId)}`
}

/** Stable string key for a CellId across its variants. */
export function cellIdKey(cellId: CellId): string {
    switch (cellId.type) {
        case 'normalCell':
            return `n:${cellId.value.row}:${cellId.value.col}`
        case 'blockCell':
            return `b:${cellId.value.blockId}:${cellId.value.row}:${cellId.value.col}`
        case 'ephemeralCell':
            return `e:${cellId.value}`
    }
}

function uniqueStrings(v: unknown): string[] {
    if (!Array.isArray(v)) return []
    const out: string[] = []
    const seen = new Set<string>()
    for (const item of v) {
        if (typeof item !== 'string' || item.length === 0) continue
        if (seen.has(item)) continue
        seen.add(item)
        out.push(item)
    }
    return out
}

function normalizeValidations(v: unknown): ValidationEntry[] {
    if (!Array.isArray(v)) return []
    const out: ValidationEntry[] = []
    const seen = new Set<string>()
    for (const item of v) {
        const entry = normalizeValidationEntry(item)
        if (!entry) continue
        const key = validationKey(entry.sheetId, entry.cellId)
        if (seen.has(key)) continue // last-write-wins would need a map; first wins is fine
        seen.add(key)
        out.push(entry)
    }
    return out
}

function normalizeValidationEntry(item: unknown): ValidationEntry | null {
    if (!item || typeof item !== 'object') return null
    const r = item as Record<string, unknown>
    if (typeof r.sheetId !== 'number') return null
    if (typeof r.formula !== 'string' || r.formula.length === 0) return null
    const cellId = normalizeCellId(r.cellId)
    if (!cellId) return null
    return {sheetId: r.sheetId, cellId, formula: r.formula}
}

function normalizeCellId(v: unknown): CellId | null {
    if (!v || typeof v !== 'object') return null
    const r = v as Record<string, unknown>
    switch (r.type) {
        case 'normalCell': {
            const val = r.value as Record<string, unknown> | undefined
            if (
                val &&
                typeof val.row === 'number' &&
                typeof val.col === 'number'
            ) {
                return {
                    type: 'normalCell',
                    value: {row: val.row, col: val.col},
                }
            }
            return null
        }
        case 'blockCell': {
            const val = r.value as Record<string, unknown> | undefined
            if (
                val &&
                typeof val.blockId === 'number' &&
                typeof val.row === 'number' &&
                typeof val.col === 'number'
            ) {
                return {
                    type: 'blockCell',
                    value: {
                        blockId: val.blockId,
                        row: val.row,
                        col: val.col,
                    },
                }
            }
            return null
        }
        case 'ephemeralCell': {
            if (typeof r.value === 'number') {
                return {type: 'ephemeralCell', value: r.value}
            }
            return null
        }
        default:
            return null
    }
}
