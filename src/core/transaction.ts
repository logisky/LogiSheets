import type {Transaction, Payload} from 'logisheets-engine'
import {globalStore} from '@/store'

/**
 * Helper to create a Transaction object.
 * When `temp` is not provided, it inherits the global isTempMode flag so all
 * actions in the app automatically follow the temp-mode toggle.
 */
export function tx(
    payloads: readonly Payload[],
    undoable: boolean,
    temp?: boolean
): Transaction {
    return {payloads, undoable, temp: temp ?? globalStore.isTempMode}
}
