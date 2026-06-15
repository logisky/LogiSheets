import {
    WorkbookClient,
    Transaction,
    Payload,
    isErrorMessage,
} from 'logisheets-engine'
import {toast} from 'react-toastify'
import {getEngine} from '@/core/engine'
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

/**
 * Read the per-cell UserEditable shadow value (if any). The engine
 * installs the shadow's formula at BindFormSchema / InsertRowsInBlock
 * time; calling getShadowCellId with kind='userEditable' gets the
 * ephemeral id, then a single getCell read returns the current bool.
 *
 * Returns:
 *   - `true`  — formula evaluated truthy → allow the edit
 *   - `false` — formula evaluated falsy / error → reject the edit
 *   - `undefined` — no userEditable formula on this field → caller
 *                   should fall back to the static userEditable flag
 *                   and block-owner rules.
 */
async function lookupUserEditableShadow(
    client: WorkbookClient,
    sheetIdx: number,
    row: number,
    col: number
): Promise<boolean | undefined> {
    try {
        const shadowSheetCellId = await client.getShadowCellId({
            sheetIdx,
            rowIdx: row,
            colIdx: col,
            kind: 'userEditable',
        })
        if (isErrorMessage(shadowSheetCellId)) return undefined
        if (shadowSheetCellId.cellId.type !== 'ephemeralCell') return undefined
        const shadowId = shadowSheetCellId.cellId.value as number
        // No formula installed → engine still allocates an id on demand
        // (idempotent), but its cell value will be `empty`. Treat empty
        // as "no rule" so callers fall through. A populated shadow that
        // evaluates to false is a real reject.
        const info = await client.getShadowInfoById({shadowId})
        if (isErrorMessage(info)) return undefined
        const v = info.value
        if (v === 'empty') return undefined
        if (v.type === 'bool') return v.value
        // Truthy/falsy coercion for non-bool results: number 0 → false,
        // anything else → true (Excel semantics). Error values → false
        // (fail-closed).
        if (v.type === 'number') return v.value !== 0
        if (v.type === 'str') return v.value !== ''
        if (v.type === 'error') return false
        return undefined
    } catch {
        return undefined
    }
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
    const blockCellId = sheetCellId.cellId.value
    const blockId = blockCellId.blockId
    const owner = callerRegistry.getBlockOwner(v.sheetIdx, blockId)

    // Dynamic editability formula takes precedence over the static
    // flag — the formula lets the schema author express conditions
    // like "editable only while 等级<3". Only consult the shadow when
    // the schema actually declares an editability formula for this
    // field (post-Phase-1+2 authoritative source); otherwise we skip
    // the extra RPC and avoid allocating a wasteful shadow id.
    if (
        await lookupFieldEditabilityFormula(
            client,
            v.sheetIdx,
            blockId,
            blockCellId.col
        )
    ) {
        const dynamicEditable = await lookupUserEditableShadow(
            client,
            v.sheetIdx,
            v.row,
            v.col
        )
        if (dynamicEditable === true) return true
        if (dynamicEditable === false) return false
        // Shadow read returned `undefined` (no formula installed
        // or value still 'empty'). This means the craft declared
        // a userEditable formula on the FieldInfo but never
        // installed the corresponding shadow — a bug in the
        // craft's setup, not a permission decision. Fall through
        // to the static-flag / owner check below so we don't
        // silently grant blanket access.
    }

    // Field-level override: if this cell's field has an explicit
    // userEditable flag, that flag wins over the block-owner check.
    // Otherwise (undefined) we fall back to block-owner rules.
    const fieldEditable = lookupFieldUserEditable(
        v.sheetIdx,
        blockId,
        blockCellId.row,
        blockCellId.col
    )
    if (fieldEditable === true) {
        return true
    }
    if (fieldEditable === false && owner !== callerUuid) {
        return false
    }

    if (owner !== undefined && owner !== callerUuid) {
        return false
    }
    return true
}

/**
 * Returns the field's declared `userEditable` setting. Note: this can
 * now be `boolean | string | undefined`:
 *   - `boolean` — static decision (`false` blocks edits permanently).
 *   - `string`  — a formula. The patch path doesn't evaluate formulas
 *     synchronously (that would require an async shadow lookup per
 *     payload); it routes through {@link lookupUserEditableShadow}
 *     when a string is present.
 *   - `undefined` — fall back to block-owner rules.
 */
function lookupFieldUserEditable(
    sheetIdx: number,
    blockId: number,
    blockRow: number,
    blockCol: number
): boolean | string | undefined {
    const renderId = callerRegistry.getFieldRenderId(
        sheetIdx,
        blockId,
        blockRow,
        blockCol
    )
    if (!renderId) return undefined
    try {
        const blockManager = getEngine().getBlockManager()
        const info = blockManager.fieldManager.get(renderId)
        return info?.userEditable
    } catch {
        return undefined
    }
}

/**
 * "Does this field declare a dynamic editability formula?" — used by
 * validateCellInput to gate whether to look up the per-cell shadow.
 * Reads `BlockInfo.schema.fields[i].editabilityFormula` directly from
 * the Rust schema (the authoritative source since Phase 1+2). One
 * extra getBlockInfo RPC per validate; cheap because schema fetch
 * doesn't trigger calc.
 *
 * `blockCol` is the col index relative to the block's master cell
 * (the same form callers pass elsewhere); schema entries store `idx`
 * with the same convention for RowSchemas.
 */
async function lookupFieldEditabilityFormula(
    client: WorkbookClient,
    sheetIdx: number,
    blockId: number,
    blockCol: number
): Promise<boolean> {
    try {
        const sheetId = await client.getSheetId({sheetIdx})
        if (isErrorMessage(sheetId)) return false
        const info = await client.getBlockInfo({sheetId, blockId})
        if (isErrorMessage(info)) return false
        const schema = info.schema
        if (!schema) return false
        const entry = schema.fields.find((f) => f.idx === blockCol)
        const t = entry?.editabilityFormula
        return typeof t === 'string' && t.trim() !== ''
    } catch {
        return false
    }
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
                    if (!ok) {
                        return false
                    }
                    continue
                }
                if (
                    !isBlockPayload(payload) ||
                    payload.type === 'createBlock'
                ) {
                    continue
                }
                // Field-level override for blockInput: a per-cell
                // `userEditable: true` flag (set by the craft when it
                // binds the schema) lets host UI commit into a craft-
                // owned cell. Mirrors what `validateCellInput` already
                // does for `cellInput`. Used by widgets like the
                // PercentAllocator overlay, which writes into supplier-%
                // cells the factory-simulator marked editable.
                if (payload.type === 'blockInput') {
                    const v = payload.value as {
                        sheetIdx: number
                        blockId: number
                        row: number
                        col: number
                    }
                    const fieldEditable = lookupFieldUserEditable(
                        v.sheetIdx,
                        v.blockId,
                        v.row,
                        v.col
                    )
                    if (fieldEditable === true) continue
                    // fieldEditable === false or undefined → fall through
                    // to block-owner check below.
                }
                const ref = getBlockRefFromPayload(payload)
                if (!ref) continue
                const owner = callerRegistry.getBlockOwner(
                    ref.sheetIdx,
                    ref.blockId
                )
                if (owner !== undefined && owner !== callerUuid) {
                    toast.error(
                        `Operation blocked: block ${ref.blockId} on sheet ${ref.sheetIdx} is owned by another caller.`
                    )
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
                        continue
                    }
                    if (payload.type === 'bindFormSchema') {
                        const v = payload.value as {
                            sheetIdx: number
                            blockId: number
                            fieldFrom: number
                            row: boolean
                            renderIds: readonly string[]
                        }
                        // `row: true` → fields are arranged across columns
                        // (one field per column starting at fieldFrom);
                        // `row: false` → fields are across rows.
                        // Remember the mapping so cellInput validation can
                        // look up the FieldInfo and consult userEditable.
                        const axis: 'col' | 'row' = v.row ? 'col' : 'row'
                        v.renderIds.forEach((renderId, i) => {
                            callerRegistry.registerFieldPosition(
                                v.sheetIdx,
                                v.blockId,
                                axis,
                                v.fieldFrom + i,
                                renderId
                            )
                        })
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
