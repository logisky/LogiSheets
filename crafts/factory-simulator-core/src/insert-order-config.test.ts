import {describe, it, expect} from 'vitest'
import {createEngine} from './engine'
import {zhLocale} from './locale'

// Regression test for the "reused leftover row keeps last round's input"
// bug. When an order completes, the engine can't drop the block to
// rowCnt=0 (it panics), so it keeps a single emptied sentinel row.
// insertOrderConfig reuses that row when the next order is accepted.
//
// The old implementation wrote ONLY the 订单 column and assumed every
// other column was already blank — but isSentinelRowEmpty skips all
// valueFormula columns, so a stale value left in one of them (e.g. a
// player override on 本期预计良品率) would survive into the freshly
// accepted order. The fix makes insertOrderConfig overwrite the whole
// row: 订单 ← new id, every other column ← '' (a no-op on templated
// cells, a real clear on player-input cells like 生产线一/生产线二).

// Minimal BlockInfo for a single leftover row whose user-data columns
// read as empty (so isSentinelRowEmpty → true and the row is reused),
// but which still carries STALE data in cells the empty-check skips.
function leftoverRowInfo(colCnt: number, rowStart = 10) {
    // All cells default to empty; the test only cares that the user-data
    // columns (订单 / 生产线一 / 生产线二) are blank so the row qualifies
    // for reuse. Templated columns may hold stale values — the fix must
    // blank them regardless.
    const cells = Array.from({length: colCnt}, () => ({value: undefined}))
    return {rowCnt: 1, colCnt, rowStart, cells}
}

describe('insertOrderConfig — reused row is fully overwritten', () => {
    it('writes every column of the reused sentinel row, not just 订单', async () => {
        const engine = createEngine(zhLocale)
        const table = engine.ORDER_CONTRIBUTION_TABLE
        const colCnt = table.fields.length
        const orderColIdx = table.fields.findIndex(
            (f) => f.name === zhLocale.fields.order
        )
        expect(orderColIdx).toBeGreaterThanOrEqual(0)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let captured: any = null
        const mockClient = {
            // Any non-{msg,ty} value passes isErrorMessage's guard.
            getSheetId: async () => 0,
            getBlockInfo: async () => leftoverRowInfo(colCnt),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            handleTransaction: async (arg: any) => {
                captured = arg
                return {}
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any

        const blockIds = {orderContribution: 42} as never

        const targetRow = await engine.insertOrderConfig(
            mockClient,
            blockIds,
            'NEW_ORDER'
        )
        // Reuses the sentinel — row 0, no block growth.
        expect(targetRow).toBe(0)

        const payloads = captured?.transaction?.payloads ?? []
        const blockInputs = payloads
            .filter((p: {type: string}) => p.type === 'blockInput')
            .map((p: {value: unknown}) => p.value)

        // The whole row must be written: one blockInput per column, all on
        // row 0 of the contribution block.
        const writesByCol = new Map<number, string>()
        for (const bi of blockInputs) {
            expect(bi.blockId).toBe(42)
            expect(bi.row).toBe(0)
            writesByCol.set(bi.col, bi.input)
        }
        for (let c = 0; c < colCnt; c++) {
            expect(writesByCol.has(c)).toBe(true)
        }

        // 订单 carries the new id; every other column is blanked so the
        // previous order's data can't bleed through.
        expect(writesByCol.get(orderColIdx)).toBe('NEW_ORDER')
        for (let c = 0; c < colCnt; c++) {
            if (c === orderColIdx) continue
            expect(writesByCol.get(c)).toBe('')
        }
    })

    it('reuses the sentinel even when stale allocation data lingers in a non-key column', async () => {
        // The leftover row's 订单 (key) is empty, but a previous order's
        // production-line allocation was never cleared out of 生产线一. The
        // row is still the recyclable sentinel — insert must reuse row 0 and
        // overwrite the stale value, NOT grow the block and strand it.
        const engine = createEngine(zhLocale)
        const table = engine.ORDER_CONTRIBUTION_TABLE
        const colCnt = table.fields.length
        const orderColIdx = table.fields.findIndex(
            (f) => f.name === zhLocale.fields.order
        )
        const line1ColIdx = table.fields.findIndex(
            (f) => f.name === zhLocale.fields.productionLine1
        )
        expect(line1ColIdx).toBeGreaterThanOrEqual(0)

        const cells = Array.from({length: colCnt}, () => ({
            value: undefined as unknown,
        }))
        // 订单 empty, but a stale allocation lingers in 生产线一.
        cells[line1ColIdx] = {value: {type: 'number', value: 42}}

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let captured: any = null
        const mockClient = {
            getSheetId: async () => 0,
            getBlockInfo: async () => ({
                rowCnt: 1,
                colCnt,
                rowStart: 10,
                cells,
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            handleTransaction: async (arg: any) => {
                captured = arg
                return {}
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any

        const targetRow = await engine.insertOrderConfig(
            mockClient,
            {orderContribution: 42} as never,
            'NEW_ORDER'
        )
        // Reused row 0 (NOT grown to row 1).
        expect(targetRow).toBe(0)

        const payloads = captured?.transaction?.payloads ?? []
        // No row-growth payload — only blockInput overwrites.
        expect(
            payloads.some(
                (p: {type: string}) =>
                    p.type === 'insertRowsInBlock' || p.type === 'insertRows'
            )
        ).toBe(false)

        const writesByCol = new Map<number, string>()
        for (const p of payloads) {
            if (p.type !== 'blockInput') continue
            expect(p.value.row).toBe(0)
            writesByCol.set(p.value.col, p.value.input)
        }
        // Stale allocation column is blanked.
        expect(writesByCol.get(line1ColIdx)).toBe('')
        expect(writesByCol.get(orderColIdx)).toBe('NEW_ORDER')
    })

    it('is idempotent: a row already holding the order is a no-op', async () => {
        const engine = createEngine(zhLocale)
        const table = engine.ORDER_CONTRIBUTION_TABLE
        const colCnt = table.fields.length
        const orderColIdx = table.fields.findIndex(
            (f) => f.name === zhLocale.fields.order
        )

        const cells = Array.from({length: colCnt}, () => ({
            value: undefined as unknown,
        }))
        // Row 0 already carries NEW_ORDER in its 订单 column.
        cells[orderColIdx] = {value: {type: 'str', value: 'NEW_ORDER'}}

        let txCount = 0
        const mockClient = {
            getSheetId: async () => 0,
            getBlockInfo: async () => ({
                rowCnt: 1,
                colCnt,
                rowStart: 10,
                cells,
            }),
            handleTransaction: async () => {
                txCount++
                return {}
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any

        const targetRow = await engine.insertOrderConfig(
            mockClient,
            {orderContribution: 42} as never,
            'NEW_ORDER'
        )
        expect(targetRow).toBe(0)
        // Dedup short-circuits before emitting any transaction.
        expect(txCount).toBe(0)
    })
})
