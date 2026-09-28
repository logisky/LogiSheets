// The `ErrorMessage` guard, defined locally.
//
// This is a copy of `logisheets-web`'s `isErrorMessage` ON PURPOSE. Do not
// replace it with an import from `logisheets-web`: that package's main entry
// statically imports the web-target WASM glue, so a *value* import of it makes
// this package unloadable under plain Node ESM (`logisheets-web` is not even a
// dependency here — logisheets-core takes it as a peer and keeps its own copy
// of this guard for the same reason). Type-only imports are fine; they are
// erased at compile time.

import type {ErrorMessage} from 'logisheets-web'

/**
 * Whether an engine reply is an {@link ErrorMessage}. Structural: any object
 * carrying both `msg` and `ty` matches. Use it on every `Result<T>` before
 * reading the value; an engine refusal to APPLY a transaction is not an
 * `ErrorMessage` but an `ActionEffect` with `status.type === 'err'`.
 */
export function isErrorMessage(v: unknown): v is ErrorMessage {
    if (typeof v !== 'object' || v === null) return false
    return 'msg' in v && 'ty' in v
}
