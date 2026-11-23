/**
 * The Data validation dialog's form, and its conversion to and from the
 * engine's `DataValidationSpec`.
 *
 * The form speaks the way Excel's dialog does — a list source is typed
 * `Yes, No` or `=$D$1:$D$5`, a date `2026-01-31`, a time `09:30` — and this
 * module turns that into the stored OOXML operands (`"Yes,No"`,
 * `DATE(2026,1,31)`, `TIME(9,30,0)`) and back.
 */

import type {DataValidationSpec} from 'logisheets-engine'

export const ALLOW_KINDS = [
    'any',
    'whole',
    'decimal',
    'list',
    'date',
    'time',
    'textLength',
    'custom',
] as const
export type AllowKind = (typeof ALLOW_KINDS)[number]

export const ERROR_STYLES = ['stop', 'warning', 'information'] as const
export type ErrorStyle = (typeof ERROR_STYLES)[number]

export interface DvForm {
    /** `any` means no rule: OK clears the selection's validation. */
    allow: AllowKind
    operator: string
    value1: string
    value2: string
    /** A list's options (`Yes, No`) or a reference (`=$D$1:$D$5`). */
    source: string
    /** A custom rule's condition, written for the selection's top-left cell. */
    formula: string
    allowBlank: boolean
    inCellDropdown: boolean
    errorStyle: ErrorStyle
    errorTitle: string
    error: string
    promptTitle: string
    prompt: string
}

export const DEFAULT_FORM: DvForm = {
    allow: 'any',
    operator: 'between',
    value1: '',
    value2: '',
    source: '',
    formula: '',
    allowBlank: true,
    inCellDropdown: true,
    errorStyle: 'stop',
    errorTitle: '',
    error: '',
    promptTitle: '',
    prompt: '',
}

/** Operators take one or two values; a list and a custom rule take none. */
export function usesOperator(allow: AllowKind): boolean {
    return allow !== 'any' && allow !== 'list' && allow !== 'custom'
}

export function isTwoValued(operator: string): boolean {
    return operator === 'between' || operator === 'notBetween'
}

const stripEq = (s: string) => s.trim().replace(/^=/, '').trim()

/** `Yes, No` → `"Yes,No"`; `=$D$1:$D$5` → `$D$1:$D$5`. */
export function sourceToFormula(source: string): string {
    const s = source.trim()
    if (s.startsWith('=')) return stripEq(s)
    const items = s
        .split(',')
        .map((i) => i.trim())
        .filter((i) => i !== '')
    if (items.length === 0) return ''
    return `"${items.map((i) => i.replace(/"/g, '""')).join(',')}"`
}

export function formulaToSource(formula: string): string {
    const f = formula.trim()
    if (f.length >= 2 && f.startsWith('"') && f.endsWith('"')) {
        return f
            .slice(1, -1)
            .split(',')
            .map((i) => i.trim().replace(/""/g, '"'))
            .join(', ')
    }
    return f === '' ? '' : `=${f}`
}

/** `2026-01-31` → `DATE(2026,1,31)`; anything else is taken as a formula. */
export function dateToFormula(v: string): string {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v.trim())
    if (!m) return stripEq(v)
    return `DATE(${+m[1]},${+m[2]},${+m[3]})`
}

export function formulaToDate(f: string): string {
    const m = /^DATE\((\d+),(\d+),(\d+)\)$/i.exec(f.replace(/\s/g, ''))
    if (!m) return f
    const p = (n: string) => n.padStart(2, '0')
    return `${m[1]}-${p(m[2])}-${p(m[3])}`
}

/** `09:30` or `9:30:15` → `TIME(9,30,15)`; anything else is a formula. */
export function timeToFormula(v: string): string {
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(v.trim())
    if (!m) return stripEq(v)
    return `TIME(${+m[1]},${+m[2]},${+(m[3] ?? 0)})`
}

export function formulaToTime(f: string): string {
    const m = /^TIME\((\d+),(\d+),(\d+)\)$/i.exec(f.replace(/\s/g, ''))
    if (!m) return f
    const p = (n: string) => n.padStart(2, '0')
    return `${p(m[1])}:${p(m[2])}${+m[3] ? `:${p(m[3])}` : ''}`
}

function valueToFormula(allow: AllowKind, v: string): string {
    if (allow === 'date') return dateToFormula(v)
    if (allow === 'time') return timeToFormula(v)
    return stripEq(v)
}

function formulaToValue(allow: AllowKind, f: string): string {
    if (allow === 'date') return formulaToDate(f)
    if (allow === 'time') return formulaToTime(f)
    return f
}

/**
 * The spec OK sends, `null` for "Any value" (clear the rule), or a
 * translation KEY naming what is missing.
 */
export function formToSpec(
    form: DvForm
): {spec: DataValidationSpec | null} | {error: string} {
    if (form.allow === 'any') return {spec: null}
    let formula1 = ''
    let formula2 = ''
    if (form.allow === 'list') {
        formula1 = sourceToFormula(form.source)
        if (!formula1) return {error: 'ui.dv.err.source'}
    } else if (form.allow === 'custom') {
        formula1 = stripEq(form.formula)
        if (!formula1) return {error: 'ui.dv.err.formula'}
    } else {
        formula1 = valueToFormula(form.allow, form.value1)
        if (!formula1) return {error: 'ui.dv.err.value'}
        if (isTwoValued(form.operator)) {
            formula2 = valueToFormula(form.allow, form.value2)
            if (!formula2) return {error: 'ui.dv.err.value2'}
        }
    }
    return {
        spec: {
            ty: form.allow,
            operator: usesOperator(form.allow) ? form.operator : '',
            formula1,
            formula2,
            allowBlank: form.allowBlank,
            inCellDropdown: form.inCellDropdown,
            errorStyle: form.errorStyle,
            errorTitle: form.errorTitle.trim(),
            error: form.error.trim(),
            promptTitle: form.promptTitle.trim(),
            prompt: form.prompt.trim(),
        },
    }
}

export function specToForm(spec: DataValidationSpec): DvForm {
    const allow = (ALLOW_KINDS as readonly string[]).includes(spec.ty)
        ? (spec.ty as AllowKind)
        : 'any'
    const errorStyle = (ERROR_STYLES as readonly string[]).includes(
        spec.errorStyle
    )
        ? (spec.errorStyle as ErrorStyle)
        : 'stop'
    return {
        ...DEFAULT_FORM,
        allow,
        operator: spec.operator || 'between',
        value1: usesOperator(allow) ? formulaToValue(allow, spec.formula1) : '',
        value2: usesOperator(allow) ? formulaToValue(allow, spec.formula2) : '',
        source: allow === 'list' ? formulaToSource(spec.formula1) : '',
        formula: allow === 'custom' ? spec.formula1 : '',
        allowBlank: spec.allowBlank,
        inCellDropdown: spec.inCellDropdown,
        errorStyle,
        errorTitle: spec.errorTitle,
        error: spec.error,
        promptTitle: spec.promptTitle,
        prompt: spec.prompt,
    }
}
