import type {Transaction, Payload} from 'logisheets-engine'
import {makeTransaction} from 'logisheets-core'
import {globalStore} from '@/store'

/**
 * Helper to create a Transaction object.
 * When `temp` is not provided, it inherits the global isTempMode flag so all
 * actions in the app automatically follow the temp-mode toggle.
 *
 * The construction itself lives in logisheets-core (`makeTransaction`); this
 * wrapper only injects the App's global temp-mode default.
 */
export function tx(
    payloads: readonly Payload[],
    undoable: boolean,
    temp?: boolean
): Transaction {
    return makeTransaction(payloads, undoable, temp ?? globalStore.isTempMode)
}
