// Pure Value helpers — parsing/formatting/emptiness of engine cell values.
//
// These are data transformations with no UI or engine dependency (the Value
// type is imported as a type only), so they are shared by the App's renderers
// and any Node-side logic.

import type {Value} from 'logisheets-web'

/** The engine represents an empty cell as the literal string 'empty'. */
export function isValueEmpty(v: Value): boolean {
    if (v === undefined) return true
    if ((v as unknown) === 'empty') return true
    const x = v as {type?: string; value?: unknown}
    if (x.type === 'empty') return true
    if (x.type === 'str' && (x.value === '' || x.value === undefined))
        return true
    return false
}

/** Extract a string, or '' for non-string / empty values. */
export function valueToString(val: Value): string {
    if ((val as unknown) === 'empty') return ''
    const x = val as {type?: string; value?: unknown}
    if (x.type === 'str') return x.value as string
    return ''
}

/** Extract a number, or null for non-number / empty values. */
export function valueToNumber(val: Value): number | null {
    if ((val as unknown) === 'empty') return null
    const x = val as {type?: string; value?: unknown}
    if (x.type === 'number') return x.value as number
    return null
}

/** Coerce any Value to its display string (str / number / bool). */
export function valueToDisplayString(val: Value): string {
    if ((val as unknown) === 'empty') return ''
    const x = val as {type?: string; value?: unknown}
    if (x.type === 'str') return x.value as string
    if (x.type === 'number') return String(x.value)
    if (x.type === 'bool') return x.value ? 'TRUE' : 'FALSE'
    return ''
}
