import {Fill, PatternFill} from '../bindings'
import {ErrorMessage} from '../bindings/error_message'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isErrorMessage(v: any): v is ErrorMessage {
    if (typeof v !== 'object' || v === null) return false
    return 'msg' in v && 'ty' in v
}

export type Result<V> = V | ErrorMessage

export function getPatternFill(v: Fill): PatternFill | null {
    if ('patternFill' in v) return v.patternFill
    return null
}
