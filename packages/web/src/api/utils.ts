import {Fill, PatternFill} from '../bindings'
import {ErrorMessage} from '../bindings/error_message'

/**
 * Whether an engine reply is an {@link ErrorMessage}. Structural: any object
 * carrying both `msg` and `ty` matches. Use it on every `Result<T>` before
 * reading the value; an engine refusal to APPLY a transaction is not an
 * `ErrorMessage` but an `ActionEffect` with `status.type === 'err'`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isErrorMessage(v: any): v is ErrorMessage {
    if (typeof v !== 'object' || v === null) return false
    return 'msg' in v && 'ty' in v
}

/** A synchronous engine reply: the value, or an {@link ErrorMessage}. */
export type Result<V> = V | ErrorMessage

/** The pattern fill of a cell `Fill`, or null for a gradient fill. */
export function getPatternFill(v: Fill): PatternFill | null {
    if (v.type === 'patternFill') return v.value
    return null
}
