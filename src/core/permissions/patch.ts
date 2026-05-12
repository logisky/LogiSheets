import {WorkbookClient, Transaction} from 'logisheets-engine'
import {callerRegistry} from './caller-registry'

const CALLER_UUID_KEY = '__callerUuid'
const PATCHED_FLAG = '__logisheetsPermPatched'

declare module 'logisheets-engine' {
    interface WorkbookClient {
        validate(transaction: unknown, callerUuid: string): boolean
    }
}

interface ParamsWithCaller {
    transaction: Transaction
    [CALLER_UUID_KEY]?: string
}

function permissionDeniedError() {
    return {msg: 'permission denied by modify policy', ty: 403}
}

function applyPatch() {
    const proto = WorkbookClient.prototype as unknown as Record<string, unknown>
    if (proto[PATCHED_FLAG]) return
    proto[PATCHED_FLAG] = true

    if (typeof proto.validate !== 'function') {
        proto.validate = function (
            _transaction: unknown,
            _callerUuid: string
        ): boolean {
            // todo: validate the function call that attempts
            // to modify blocks.
            return true
        }
    }

    for (const name of [
        'handleTransaction',
        'handleTransactionWithoutEvents',
    ] as const) {
        const original = proto[name] as
            | ((params: ParamsWithCaller) => Promise<unknown>)
            | undefined
        if (typeof original !== 'function') continue

        proto[name] = function (
            this: WorkbookClient,
            params: ParamsWithCaller
        ) {
            const callerUuid =
                params?.[CALLER_UUID_KEY] ?? callerRegistry.getUserUuid()

            const validate = (
                this as unknown as {
                    validate: (tx: Transaction, uuid: string) => boolean
                }
            ).validate
            const ok = validate.call(this, params?.transaction, callerUuid)
            if (!ok) {
                return Promise.resolve(permissionDeniedError())
            }

            const forwarded: {transaction: Transaction} = {
                transaction: params.transaction,
            }
            return original.call(this, forwarded as ParamsWithCaller)
        } as typeof original
    }
}

applyPatch()

export const CALLER_UUID_PARAM_KEY = CALLER_UUID_KEY
