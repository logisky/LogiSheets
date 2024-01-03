import {ErrorMessage} from '../bindings/error_message'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isErrorMessage(v: any): v is ErrorMessage {
    return 'msg' in v && 'ty' in v
}

export type Result<V> = V | ErrorMessage
