import {describe, it, expect, vi, beforeEach} from 'vitest'
import {acquireCraftCalc, CraftCalc} from '../../src/api/craft-calc'
import type {Client} from '../../src/client'
import type {ActionEffect, CellInfo, Value} from '../../src/bindings'

const okEffect = {
    status: {type: 'ok', value: 'cell'},
    asyncTasks: [],
    valueChanged: [],
    cellRemoved: [],
    headerUpdated: [],
} as unknown as ActionEffect

function valueCellInfo(value: Value): CellInfo {
    return {
        value,
        formula: '',
        style: {
            font: {},
            fill: {type: 'patternFill', value: {}},
        },
    } as unknown as CellInfo
}

function createMockClient() {
    const values = new Map<number, Value>()
    const writtenIds = new Set<number>()
    const handleTransaction = vi.fn(
        async ({
            transaction,
        }: {
            transaction: {
                payloads: {
                    type: string
                    value: {id: number; content?: string; sheetIdx?: number}
                }[]
            }
        }): Promise<ActionEffect> => {
            transaction.payloads.forEach((p) => {
                if (p.type === 'ephemeralCellInput') {
                    writtenIds.add(p.value.id)
                }
            })
            return okEffect
        }
    )
    const batchGetCellInfoById = vi.fn(
        async ({ids}: {ids: {cellId: {value: number}}[]}) => {
            const unknown = ids.find(
                ({cellId}) =>
                    !writtenIds.has(cellId.value) && !values.has(cellId.value)
            )
            if (unknown) {
                return {msg: 'Cell not found', ty: 0}
            }
            return ids.map(({cellId}) =>
                valueCellInfo(values.get(cellId.value) ?? 'empty')
            )
        }
    )
    const getSheetId = vi.fn(async () => 42)

    const client = {
        isReady: vi.fn(),
        handleTransactionWithoutEvents: vi.fn(),
        registerCustomFunc: vi.fn(),
        registerCellUpdatedCallback: vi.fn(),
        registerSheetUpdatedCallback: vi.fn(),
        registerCellValueChangedCallback: vi.fn(),
        registerCellValueChangedByCellId: vi.fn(),
        registerCellRemovedCallback: vi.fn(),
        registerShadowCellValueChangedCallback: vi.fn(),
        getSheetId,
        batchGetCellInfoById,
        handleTransaction,
    } as unknown as Client

    return {
        client,
        handleTransaction,
        batchGetCellInfoById,
        getSheetId,
        values,
        writtenIds,
    }
}

function getWrittenId(
    handleTransaction: {mock: {calls: any[]}},
    callIndex = 0
): number {
    return handleTransaction.mock.calls[callIndex][0].transaction.payloads[0]
        .value.id
}

describe('CraftCalc', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('prepends = to calcOnce formulas when missing', async () => {
        const {client, handleTransaction} = createMockClient()
        const craft = acquireCraftCalc(client)
        await craft.calcOnce('1+1')

        const tx = handleTransaction.mock.calls[0][0]
        expect(tx.transaction.payloads[0].value.content).toBe('=1+1')
    })

    it('keeps leading = in calcOnce formulas', async () => {
        const {client, handleTransaction} = createMockClient()
        const craft = acquireCraftCalc(client)
        await craft.calcOnce('=A1+B1')

        const tx = handleTransaction.mock.calls[0][0]
        expect(tx.transaction.payloads[0].value.content).toBe('=A1+B1')
    })

    it('uses slot 0 for calcOnce', async () => {
        const {client, handleTransaction} = createMockClient()
        const craft = acquireCraftCalc(client)
        await craft.calcOnce('1')

        const tx = handleTransaction.mock.calls[0][0]
        expect(tx.transaction.payloads[0].value.sheetIdx).toBe(0)
        expect(typeof tx.transaction.payloads[0].value.id).toBe('number')
    })

    it('offsets user localIds by 1', async () => {
        const {client, handleTransaction} = createMockClient()
        const craft = acquireCraftCalc(client)
        await craft.setCalc(0, '1')
        await craft.setCalc(1, '2')

        const id0 = getWrittenId(handleTransaction, 0)
        const id1 = getWrittenId(handleTransaction, 1)
        expect(id1 - id0).toBe(1)
    })

    it('throws for invalid localIds', async () => {
        const {client} = createMockClient()
        const craft = acquireCraftCalc(client)
        await expect(craft.setCalc(-1, '1')).rejects.toThrow(
            'localId must be a non-negative integer'
        )
        await expect(craft.setCalc(1.5, '1')).rejects.toThrow(
            'localId must be a non-negative integer'
        )
    })

    it('reads back previously set values', async () => {
        const {client, handleTransaction, values} = createMockClient()
        const craft = acquireCraftCalc(client)

        // Seed the mock with the value that will be read back.
        await craft.calcOnce('100')
        const engineId = getWrittenId(handleTransaction)
        values.set(engineId, {type: 'number', value: 100})

        const v = await craft.calcOnce('100')
        expect(v).toEqual({type: 'number', value: 100})
    })

    it('throws when getCalc reads an unknown localId', async () => {
        const {client} = createMockClient()
        const craft = acquireCraftCalc(client)
        await expect(craft.getCalc(99)).rejects.toThrow('getCalc(99) failed')
    })

    it('emits an ephemeralCellRemove payload on dropCalc', async () => {
        const {client, handleTransaction} = createMockClient()
        const craft = acquireCraftCalc(client)
        await craft.setCalc(5, '1')
        await craft.dropCalc(5)

        const removePayload =
            handleTransaction.mock.calls.at(-1)![0].transaction.payloads[0]
        expect(removePayload.type).toBe('ephemeralCellRemove')
        expect(removePayload.value.sheetIdx).toBe(0)
    })

    it('emits one remove payload per used slot on dropAll', async () => {
        const {client, handleTransaction} = createMockClient()
        const craft = acquireCraftCalc(client)
        await craft.setCalc(0, '1')
        await craft.setCalc(1, '2')
        await craft.calcOnce('3')

        handleTransaction.mockClear()
        await craft.dropAll()

        const payloads = handleTransaction.mock.calls[0][0].transaction.payloads
        expect(payloads).toHaveLength(3)
        expect(
            payloads.every(
                (p: {type: string}) => p.type === 'ephemeralCellRemove'
            )
        ).toBe(true)
    })

    it('does nothing on dropAll when no slots were used', async () => {
        const {client, handleTransaction} = createMockClient()
        const craft = acquireCraftCalc(client)
        await craft.dropAll()
        expect(handleTransaction).not.toHaveBeenCalled()
    })

    it('caches the resolved sheet id', async () => {
        const {client, getSheetId, batchGetCellInfoById} = createMockClient()
        const craft = acquireCraftCalc(client)
        await craft.setCalc(0, '1')
        await craft.getCalc(0)
        expect(getSheetId).toHaveBeenCalledTimes(1)
        expect(batchGetCellInfoById).toHaveBeenCalledTimes(2)
    })

    it('throws when the transaction fails', async () => {
        const {client, handleTransaction} = createMockClient()
        handleTransaction.mockResolvedValue({
            msg: 'fail',
            ty: 1,
        } as unknown as ActionEffect)
        const craft = acquireCraftCalc(client)
        await expect(craft.calcOnce('1')).rejects.toThrow(
            'formula evaluation failed'
        )
    })

    it('exposes the base via slot 0 and prevents range overflow', async () => {
        const {client} = createMockClient()
        const craft = acquireCraftCalc(client)
        // Range size is 2^20, so localId 2^20 - 2 is the largest valid value
        // because the offset is localId + 1 and must be < CRAFT_RANGE_SIZE.
        const maxLocalId = (1 << 20) - 2
        await expect(craft.setCalc(maxLocalId, '1')).resolves.toBeDefined()
        await expect(craft.setCalc(maxLocalId + 1, '1')).rejects.toThrow(
            'exceeds craft range size'
        )
    })
})

describe('acquireCraftCalc', () => {
    it('returns distinct CraftCalc instances', () => {
        const {client} = createMockClient()
        const a = acquireCraftCalc(client)
        const b = acquireCraftCalc(client)
        expect(a).toBeInstanceOf(CraftCalc)
        expect(b).toBeInstanceOf(CraftCalc)
        expect(a).not.toBe(b)
    })
})
