import {
    WorkbookClient,
    Transaction,
    Payload,
    isErrorMessage,
} from 'logisheets-engine'
import {callerRegistry} from './caller-registry'

const CALLER_UUID_KEY = '__callerUuid'
const PATCHED_FLAG = '__logisheetsPermPatched'

declare module 'logisheets-engine' {
    interface WorkbookClient {
        validate(transaction: unknown, callerUuid: string): Promise<boolean>
    }
}

interface ParamsWithCaller {
    transaction: Transaction
    [CALLER_UUID_KEY]?: string
}

function permissionDeniedError() {
    return {msg: 'permission denied by modify policy', ty: 403}
}

function isBlockPayload(payload: Payload): boolean {
    const blockTypes = [
        'blockInput',
        'moveBlock',
        'removeBlock',
        'resizeBlock',
        'convertBlock',
        'bindFormSchema',
        'bindRandomSchema',
        'upsertFieldRenderInfo',
        'blockStyleUpdate',
        'blockLineStyleUpdate',
        'blockLineNameFieldUpdate',
        'insertColsInBlock',
        'deleteColsInBlock',
        'insertRowsInBlock',
        'deleteRowsInBlock',
    ]
    return blockTypes.includes(payload.type)
}

function getBlockRefFromPayload(
    payload: Payload
): {sheetIdx: number; blockId: number} | undefined {
    const v = payload.value as unknown as Record<string, unknown>
    if (
        payload.type === 'moveBlock' ||
        payload.type === 'removeBlock' ||
        payload.type === 'resizeBlock' ||
        payload.type === 'convertBlock'
    ) {
        return {
            sheetIdx: v.sheetIdx as number,
            blockId: v.id as number,
        }
    }
    if ('blockId' in v && 'sheetIdx' in v) {
        return {
            sheetIdx: v.sheetIdx as number,
            blockId: v.blockId as number,
        }
    }
    return undefined
}

async function validateCellInput(
    client: WorkbookClient,
    payload: Payload,
    callerUuid: string
): Promise<boolean> {
    const v = payload.value as {
        sheetIdx: number
        row: number
        col: number
    }
    const sheetCellId = await client.getCellId({
        sheetIdx: v.sheetIdx,
        rowIdx: v.row,
        colIdx: v.col,
    })
    if (isErrorMessage(sheetCellId)) {
        return true
    }
    if (sheetCellId.cellId.type !== 'blockCell') {
        return true
    }
    const blockId = sheetCellId.cellId.value.blockId
    const owner = callerRegistry.getBlockOwner(v.sheetIdx, blockId)
    if (owner !== undefined && owner !== callerUuid) {
        return false
    }
    return true
}

function applyPatch() {
    const proto = WorkbookClient.prototype as unknown as Record<string, unknown>
    if (proto[PATCHED_FLAG]) return
    proto[PATCHED_FLAG] = true

    if (typeof proto.validate !== 'function') {
        proto.validate = async function (
            this: WorkbookClient,
            transaction: unknown,
            callerUuid: string
        ): Promise<boolean> {
            const tx = transaction as Transaction
            for (const payload of tx.payloads) {
                if (payload.type === 'cellInput') {
                    const ok = await validateCellInput(
                        this,
                        payload,
                        callerUuid
                    )
                    if (!ok) return false
                    continue
                }
                if (
                    !isBlockPayload(payload) ||
                    payload.type === 'createBlock'
                ) {
                    continue
                }
                const ref = getBlockRefFromPayload(payload)
                if (!ref) continue
                const owner = callerRegistry.getBlockOwner(
                    ref.sheetIdx,
                    ref.blockId
                )
                if (owner !== undefined && owner !== callerUuid) {
                    return false
                }
            }
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

        proto[name] = async function (
            this: WorkbookClient,
            params: ParamsWithCaller
        ) {
            const callerUuid =
                params?.[CALLER_UUID_KEY] ?? callerRegistry.getUserUuid()

            const validate = (
                this as unknown as {
                    validate: (
                        tx: Transaction,
                        uuid: string
                    ) => Promise<boolean>
                }
            ).validate
            const ok = await validate.call(
                this,
                params?.transaction,
                callerUuid
            )
            if (!ok) {
                return Promise.resolve(permissionDeniedError())
            }

            const tx = params?.transaction as Transaction | undefined
            if (tx) {
                for (const payload of tx.payloads) {
                    if (payload.type === 'createBlock') {
                        const v = payload.value as {
                            sheetIdx: number
                            id: number
                        }
                        callerRegistry.registerBlockOwner(
                            v.sheetIdx,
                            v.id,
                            callerUuid
                        )
                    }
                }
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
