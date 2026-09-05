// Local checks for a field's value-formula template, so the composer can say
// what's wrong while the person is still typing it.
//
// The engine validates the same thing at bind time and refuses the whole
// payload — correct, but it arrives as an aborted save with a message written
// for a caller, after the dialog has already collected everything else. These
// checks are deliberately narrow: only the mistakes that are certain without
// parsing (an unknown field name, a self-reference). Everything else — syntax,
// function names, cross-block refs — stays the engine's call.

import type {FieldSetting} from 'logisheets-core'

/**
 * `#FIELD("name")` / `#FIELD('name')`, capturing the name and whether a second
 * (row-key) argument follows. The keyed form addresses another row, so it is
 * the one case where a field may legitimately name itself.
 */
const FIELD_REF = /#FIELD\s*\(\s*(["'])(.*?)\1\s*(,)?/gi

/** Every `#FIELD(...)` reference in a template, in order. */
export function referencedFieldNames(
    formula: string
): {name: string; keyed: boolean}[] {
    const refs: {name: string; keyed: boolean}[] = []
    for (const m of formula.matchAll(FIELD_REF))
        refs.push({name: m[2], keyed: m[3] === ','})
    return refs
}

/** Which rule is being written — they differ in what they may reference. */
export type FieldRuleKind = 'value' | 'validation'

/**
 * What's wrong with a rule as typed, or `null` when it's fine (or empty — a
 * field with no rule is the normal case, not an error).
 *
 * Text-level so both the composer, which edits a block that does not exist
 * yet, and the grid's per-field dialog, which edits a live one, can ask the
 * same question. `selfName` is the field the rule belongs to; `allNames` every
 * field of its block, including that one.
 */
export function validateRuleText(
    kind: FieldRuleKind,
    text: string | undefined,
    selfName: string,
    allNames: readonly string[]
): string | null {
    const formula = (text ?? '').trim()
    if (formula === '') return null

    const declared = new Set(allNames)
    for (const {name, keyed} of referencedFieldNames(formula)) {
        if (!declared.has(name))
            return `#FIELD("${name}") refers to a field this block doesn’t have.`
        // In a VALUE formula an unkeyed self-reference resolves to the very
        // cell being computed — a self-loop. Keyed (`#FIELD("x", "some-key")`)
        // it reaches another row, which is the supported way to read across
        // records.
        //
        // A VALIDATION rule may name its own field freely: it is evaluated
        // against the cell rather than computing it, so `#FIELD("qty")` inside
        // `qty`'s rule is just a longhand `#PLACEHOLDER`.
        if (kind === 'value' && name === selfName && !keyed)
            return `#FIELD("${name}") resolves to this cell itself. Add a row key — #FIELD("${name}", "…") — to read another record.`
    }
    return null
}

/**
 * What's wrong with `field`'s value formula, or `null` when it's fine.
 *
 * `allFields` is every field of the block being composed, including `field`
 * itself.
 */
export function validateFieldFormula(
    field: FieldSetting,
    allFields: readonly FieldSetting[]
): string | null {
    return validateRuleText(
        'value',
        field.valueFormula,
        field.name,
        allFields.map((f) => f.name)
    )
}

/** What's wrong with `field`'s validation rule, or `null` when it's fine. */
export function validateValidationFormula(
    field: FieldSetting,
    allFields: readonly FieldSetting[]
): string | null {
    return validateRuleText(
        'validation',
        field.validation,
        field.name,
        allFields.map((f) => f.name)
    )
}

/**
 * The first field whose rules don't check out, with its message. Used to stop
 * a save before it reaches the engine, which would otherwise refuse the whole
 * bind — taking every other edit in the dialog with it.
 */
export function firstFieldFormulaError(
    allFields: readonly FieldSetting[]
): {field: FieldSetting; message: string} | null {
    for (const field of allFields) {
        const value = validateFieldFormula(field, allFields)
        if (value) return {field, message: value}
        const validation = validateValidationFormula(field, allFields)
        if (validation) return {field, message: validation}
    }
    return null
}
