/**
 * Pure helpers between the UI's form state and the engine's `CfRuleSpec`.
 *
 * Kept free of React so the mapping — which is where the fiddly parts live
 * (operand counts per operator, ARGB vs CSS hex, which fields a type uses) — can
 * be read and tested on its own.
 */

import type {CfRuleSpec} from 'logisheets-engine'

/** The rule types the editor can author. The engine understands more; these are
 * the ones with a form. Anything else loaded from a file is listed read-only. */
export const EDITABLE_TYPES = [
    'cellIs',
    'containsText',
    'colorScale',
    'dataBar',
] as const
export type EditableType = (typeof EDITABLE_TYPES)[number]

export function isEditableType(ty: string): ty is EditableType {
    return (EDITABLE_TYPES as readonly string[]).includes(ty)
}

/** `cellIs` operators, with how many operands each needs. */
// `label` is a translation key resolved at render — this list is
// module-level and the language changes under it.
export const CELL_IS_OPERATORS = [
    {value: 'greaterThan', label: 'ui.cf.op.greaterThan', operands: 1},
    {value: 'lessThan', label: 'ui.cf.op.lessThan', operands: 1},
    {
        value: 'greaterThanOrEqual',
        label: 'ui.cf.op.greaterThanOrEqual',
        operands: 1,
    },
    {value: 'lessThanOrEqual', label: 'ui.cf.op.lessThanOrEqual', operands: 1},
    {value: 'equal', label: 'ui.cf.op.equal', operands: 1},
    {value: 'notEqual', label: 'ui.cf.op.notEqual', operands: 1},
    {value: 'between', label: 'ui.cf.op.between', operands: 2},
    {value: 'notBetween', label: 'ui.cf.op.notBetween', operands: 2},
] as const

export function operandCount(operator: string): number {
    return CELL_IS_OPERATORS.find((o) => o.value === operator)?.operands ?? 1
}

/** The editor's form state. A superset of all four types' fields; only the ones
 * the active type uses are read when building the spec. */
export interface RuleForm {
    ty: EditableType
    operator: string
    operand1: string
    operand2: string
    text: string
    /** Colour-scale stops (2 or 3) / the data-bar colour, as CSS `#rrggbb`. */
    colors: string[]
    fillColor: string
    fontColor: string
    bold: boolean
    italic: boolean
    /** Whether the differential format sets a fill / font colour at all. */
    useFill: boolean
    useFontColor: boolean
    stopIfTrue: boolean
}

export const DEFAULT_FORM: RuleForm = {
    ty: 'cellIs',
    operator: 'greaterThan',
    operand1: '',
    operand2: '',
    text: '',
    // Excel's default 2-colour scale and bar colour, near enough.
    colors: ['#ffef9c', '#63be7b'],
    fillColor: '#ffc7ce',
    fontColor: '#9c0006',
    bold: false,
    italic: false,
    useFill: true,
    useFontColor: false,
    stopIfTrue: false,
}

/** CSS `#rrggbb` (or `rrggbb`) → the `AARRGGBB` the engine stores. */
export function cssToArgb(css: string): string {
    const h = css.trim().replace(/^#/, '').toUpperCase()
    return h.length === 6 ? `FF${h}` : h
}

/** `AARRGGBB` / `RRGGBB` → CSS `#rrggbb`, for seeding a colour input. */
export function argbToCss(argb: string): string {
    const h = argb.trim().replace(/^#/, '')
    const rgb = h.length === 8 ? h.slice(2) : h
    return `#${rgb.toLowerCase()}`
}

/** Build the spec to send. Returns a message instead when the form can't make a
 * valid rule — the engine rejects these too, but saying so before dispatching
 * gives a better error than a failed transaction. */
/** `error` is a translation KEY — the caller resolves it. */
export function formToSpec(
    form: RuleForm
): {spec: CfRuleSpec} | {error: string} {
    const visual = form.ty === 'colorScale' || form.ty === 'dataBar'
    const format = visual
        ? undefined
        : {
              fillColor: form.useFill ? cssToArgb(form.fillColor) : undefined,
              fontColor: form.useFontColor
                  ? cssToArgb(form.fontColor)
                  : undefined,
              bold: form.bold,
              italic: form.italic,
          }

    const base = {
        ty: form.ty,
        operands: [] as string[],
        colors: [] as string[],
        percent: false,
        bottom: false,
        aboveAverage: true,
        equalAverage: false,
        reverse: false,
        stopIfTrue: form.stopIfTrue,
        format,
    }

    switch (form.ty) {
        case 'cellIs': {
            const n = operandCount(form.operator)
            const ops = [form.operand1, form.operand2].slice(0, n)
            if (ops.some((o) => o.trim() === '')) {
                return {
                    error:
                        n === 2 ? 'ui.cf.err.bothValues' : 'ui.cf.err.oneValue',
                }
            }
            return {
                spec: {
                    ...base,
                    operator: form.operator,
                    operands: ops.map((o) => o.trim()),
                },
            }
        }
        case 'containsText': {
            if (form.text.trim() === '') return {error: 'ui.cf.err.text'}
            return {spec: {...base, text: form.text}}
        }
        case 'colorScale': {
            if (form.colors.length < 2)
                return {error: 'A colour scale needs at least two colours.'}
            return {spec: {...base, colors: form.colors.map(cssToArgb)}}
        }
        case 'dataBar': {
            return {spec: {...base, colors: [cssToArgb(form.colors[0])]}}
        }
    }
}

/** Seed the form from an existing rule, for the edit path. `null` when the rule
 * is of a type the editor has no form for. */
export function specToForm(spec: CfRuleSpec): RuleForm | null {
    if (!isEditableType(spec.ty)) return null
    const fmt = spec.format
    return {
        ...DEFAULT_FORM,
        ty: spec.ty,
        operator: spec.operator ?? 'greaterThan',
        operand1: spec.operands[0] ?? '',
        operand2: spec.operands[1] ?? '',
        text: spec.text ?? '',
        colors:
            spec.colors.length > 0
                ? spec.colors.map(argbToCss)
                : DEFAULT_FORM.colors,
        fillColor: fmt?.fillColor
            ? argbToCss(fmt.fillColor)
            : DEFAULT_FORM.fillColor,
        fontColor: fmt?.fontColor
            ? argbToCss(fmt.fontColor)
            : DEFAULT_FORM.fontColor,
        bold: fmt?.bold ?? false,
        italic: fmt?.italic ?? false,
        useFill: !!fmt?.fillColor,
        useFontColor: !!fmt?.fontColor,
        stopIfTrue: spec.stopIfTrue,
    }
}

/** A one-line summary for the rule list. Covers every type the engine can load,
 * not just the editable ones, so a rule from a file is never shown as blank.
 *
 * Takes the translator rather than reaching for a hook: this is a pure
 * function, and the caller is the component that re-renders on a language
 * change. */
export function describeRule(
    spec: CfRuleSpec,
    t: (key: string, vars?: Record<string, unknown>) => string
): string {
    const ops = spec.operands
    switch (spec.ty) {
        case 'cellIs': {
            const entry = CELL_IS_OPERATORS.find(
                (o) => o.value === spec.operator
            )
            return t('ui.cf.desc.cellIs', {
                op: entry ? t(entry.label) : spec.operator,
                operands: ops.join(' and '),
            }).trim()
        }
        case 'expression':
            return t('ui.cf.desc.expression', {formula: ops[0] ?? ''})
        case 'containsText':
            return t('ui.cf.desc.containsText', {text: spec.text ?? ''})
        case 'notContainsText':
            return t('ui.cf.desc.notContainsText', {text: spec.text ?? ''})
        case 'beginsWith':
            return t('ui.cf.desc.beginsWith', {text: spec.text ?? ''})
        case 'endsWith':
            return t('ui.cf.desc.endsWith', {text: spec.text ?? ''})
        case 'containsBlanks':
            return t('ui.cf.desc.containsBlanks')
        case 'notContainsBlanks':
            return t('ui.cf.desc.notContainsBlanks')
        case 'containsErrors':
            return t('ui.cf.desc.containsErrors')
        case 'notContainsErrors':
            return t('ui.cf.desc.notContainsErrors')
        case 'duplicateValues':
            return t('ui.cf.desc.duplicateValues')
        case 'uniqueValues':
            return t('ui.cf.desc.uniqueValues')
        case 'top10': {
            const unit = spec.percent ? '%' : ''
            return t(spec.bottom ? 'ui.cf.desc.bottom' : 'ui.cf.desc.top', {
                rank: spec.rank ?? 0,
                unit,
            })
        }
        case 'aboveAverage': {
            const eq = spec.equalAverage ? t('ui.cf.desc.orEqualTo') : ''
            const sd = spec.stdDev
                ? t('ui.cf.desc.byStdDev', {n: Math.abs(spec.stdDev)})
                : ''
            return t(
                spec.aboveAverage
                    ? 'ui.cf.desc.aboveAverage'
                    : 'ui.cf.desc.belowAverage',
                {eq, sd}
            )
        }
        case 'timePeriod':
            return t('ui.cf.desc.timePeriod', {period: spec.timePeriod ?? ''})
        case 'colorScale':
            return t('ui.cf.desc.colorScale', {count: spec.colors.length})
        case 'dataBar':
            return t('ui.cf.desc.dataBar')
        case 'iconSet':
            return t('ui.cf.desc.iconSet', {name: spec.iconSet ?? ''})
        default:
            return spec.ty
    }
}
