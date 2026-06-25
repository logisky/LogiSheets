// Validation — headless rule checking.
//
// A validation rule is just a formula that must evaluate to TRUE for the cell
// to be valid (this is exactly the model used by the browser's ValidationCell:
// it writes `=<formula>` into a shadow/ephemeral cell, lets the WASM engine
// evaluate it, and reads back a bool). The *evaluation* lives entirely in the
// engine, so it already runs on Node — this module is only the pure result
// interpretation. The engine access is supplied by the caller as a plain
// `evalFormula` function (WorkbookOps wraps the Client); see ../ops.

import type {Value} from 'logisheets-web'

/** One cell's validation rule. `formula` is an Excel expression (no leading
 * `=`) that should reference the target cell(s) and evaluate to a boolean,
 * e.g. `A1>0` or `LEN(B2)<=10`. */
export interface ValidationRule {
    sheetIdx: number
    row: number
    col: number
    formula: string
}

export type ViolationKind =
    | 'failed'
    | 'error'
    | 'required'
    | 'duplicate'
    | 'membership'

export interface Violation {
    sheetIdx: number
    row: number
    col: number
    formula?: string
    kind: ViolationKind
    message: string
}

/**
 * Interpret a single evaluated validation result. Mirrors the branch logic
 * in the browser's ValidationCell:
 *   - empty            -> valid (nothing to check)
 *   - bool false       -> failed
 *   - error            -> formula error
 *   - anything else    -> unexpected, treated as error
 */
export function interpretValidation(
    rule: ValidationRule,
    value: Value
): Violation | null {
    if (value === undefined) return null
    // The engine represents an empty cell as the literal string 'empty'.
    if ((value as unknown) === 'empty') return null
    const v = value as {type?: string; value?: unknown}
    if (v.type === 'empty') return null
    if (v.type === 'bool') {
        if (v.value === false) {
            return {
                ...rule,
                kind: 'failed',
                message: 'Value does not meet validation criteria',
            }
        }
        return null
    }
    if (v.type === 'error') {
        return {
            ...rule,
            kind: 'error',
            message: 'Validation formula error: ' + String(v.value),
        }
    }
    return {...rule, kind: 'error', message: 'Unexpected validation result'}
}

/**
 * Check every rule and return the cells that break their validation. Pure:
 * the caller supplies `evalFormula` (WorkbookOps wraps the engine). `rules`
 * are evaluated against the values already resolved by the caller.
 */
export function checkValidations(
    rules: readonly ValidationRule[],
    evalFormula: (sheetIdx: number, formula: string) => Value
): Violation[] {
    const out: Violation[] = []
    for (const rule of rules) {
        const value = evalFormula(rule.sheetIdx, rule.formula)
        const violation = interpretValidation(rule, value)
        if (violation) out.push(violation)
    }
    return out
}
