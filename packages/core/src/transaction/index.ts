// Transaction construction — the engine-neutral core of building an edit
// transaction. The browser app wraps this with a store-bound `tx()` that
// supplies the temp-mode flag; the Node runtime builds transactions directly.

import type {Transaction, Payload} from 'logisheets-web'

export type {Transaction, Payload}

/**
 * Build a {@link Transaction}. `temp` is explicit here — the host decides
 * where it comes from (the App reads its global temp-mode toggle; a runtime
 * passes false). This keeps the construction logic free of any store.
 */
export function makeTransaction(
    payloads: readonly Payload[],
    undoable: boolean,
    temp: boolean
): Transaction {
    return {payloads, undoable, temp}
}
