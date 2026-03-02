import type {Transaction, Payload} from 'logisheets-engine'

/**
 * Helper to create a Transaction object.
 * Replaces the old `new Transaction(payloads, undoable)` constructor
 * now that Transaction is an interface.
 */
export function tx(
    payloads: readonly Payload[],
    undoable: boolean,
    temp = false
): Transaction {
    return {payloads, undoable, temp}
}
