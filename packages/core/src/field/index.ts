// Field model + non-formula field constraints (required / unique).
//
// The field type model is lifted verbatim from the browser's block-composer so
// the App, the data-gateway craft, and a Node runtime all share one source of
// truth for what a field is. The constraint *checks* here are pure logic over
// values read through an injected port — the engine just supplies the values.
//
// Formula-based validation lives in ../validation; this module covers the two
// constraints that aren't formulas: `required` (no empty cells) and `unique`
// (no duplicate values within a field column).

import type {Value} from 'logisheets-web'
import type {Violation} from '../validation/index.js'
import {isValueEmpty} from '../value/index.js'

// ---- Field model (mirrors block-composer/types.ts) ----------------------

export type FieldTypeEnum =
    | 'enum'
    | 'multiSelect'
    | 'datetime'
    | 'boolean'
    | 'string'
    | 'number'
    | 'image'
    | 'fieldRef'
    | 'multiSelectRef'

export interface EnumValue {
    id: string
    label: string
    description: string
    color: string
}

export interface FieldSetting {
    id: string
    name: string
    type: FieldTypeEnum
    description?: string
    required: boolean
    primary: boolean
    enumId?: string
    defaultValue?: string
    format?: string
    validation?: string
    unique?: boolean
    valueFormula?: string
    refSelf?: boolean
    refSheetId?: number
    refBlockId?: number
    refFieldName?: string
}

// ---- Constraint checking ------------------------------------------------

/** Read a single cell's evaluated value. */
export interface CellReadPort {
    getValue(sheetIdx: number, row: number, col: number): Value
}

export interface CellRef {
    sheetIdx: number
    row: number
    col: number
}

/** A field column: its constraints plus the data cells that belong to it. */
export interface FieldColumn {
    field: Pick<FieldSetting, 'name' | 'required' | 'unique'>
    cells: readonly CellRef[]
    /**
     * Allowed values for membership-constrained fields (enum / multiSelect /
     * fieldRef / multiSelectRef). When provided, every non-empty cell value
     * must appear here. The caller resolves the candidate set — for enums it
     * is the enum labels; for fieldRef it is the referenced field's values.
     * Leave undefined for fields with no membership constraint.
     */
    allowed?: readonly string[]
}

const isEmpty = isValueEmpty

/** Stable string key for duplicate detection. */
function valueKey(v: Value): string {
    const x = v as {type?: string; value?: unknown}
    return `${x.type}:${String(x.value)}`
}

/** The cell's value as the plain text used for membership comparison. */
function valueText(v: Value): string {
    const x = v as {type?: string; value?: unknown}
    return String(x.value)
}

/**
 * Check `required` and `unique` across every field column and return all
 * violating cells. Runs identically in the browser and on Node — only the
 * injected `CellReadPort` differs.
 */
export function checkFieldConstraints(
    port: CellReadPort,
    columns: readonly FieldColumn[]
): Violation[] {
    const out: Violation[] = []
    for (const {field, cells, allowed} of columns) {
        const seen = new Map<string, CellRef>()
        const allowedSet = allowed ? new Set(allowed) : undefined
        for (const cell of cells) {
            const v = port.getValue(cell.sheetIdx, cell.row, cell.col)
            const empty = isEmpty(v)

            if (field.required && empty) {
                out.push({
                    ...cell,
                    kind: 'required',
                    message: `Field "${field.name}" is required`,
                })
                continue
            }
            if (empty) continue

            if (allowedSet && !allowedSet.has(valueText(v))) {
                out.push({
                    ...cell,
                    kind: 'membership',
                    message: `Value "${valueText(
                        v
                    )}" is not an allowed option for field "${field.name}"`,
                })
                continue
            }
            if (field.unique) {
                const key = valueKey(v)
                if (seen.has(key)) {
                    out.push({
                        ...cell,
                        kind: 'duplicate',
                        message: `Duplicate value in unique field "${field.name}"`,
                    })
                } else {
                    seen.set(key, cell)
                }
            }
        }
    }
    return out
}
