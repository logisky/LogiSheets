import {describe, it, expect, vi} from 'vitest'
import type {CellId, SheetCellId} from 'logisheets-web'
import type {Violation} from 'logisheets-core'
import runtime, {getGatewayRecord, type GatewayWorkbook} from './runtime'
import {DATA_GATEWAY_VERSION, type DataGatewayState} from './state'

const normalCell = (row: number, col: number): CellId => ({
    type: 'normalCell',
    value: {row, col},
})

// A distinct shadow id per install, so tests can assert the right ids are
// cached and read back.
const shadowFor = (n: number): SheetCellId => ({
    sheetId: 0,
    cellId: {type: 'ephemeralCell', value: 1000 + n},
})

// A mock workbook: records how often the resolve-path client methods are hit,
// hands out a shadow id per install, and lets a test script the batch read.
// Cast through unknown because GatewayWorkbook.ops is the real WorkbookOps
// class (private members), which a plain object can't nominally satisfy.
function mockWorkbook(checkValidationShadows: () => Promise<Violation[]>) {
    const getSheetIdx = vi.fn(async () => 0)
    const batchGetCellCoordinateWithSheetById = vi.fn(
        async ({ids}: {ids: readonly unknown[]}) =>
            ids.map(() => ({sheetIdx: 0, coordinate: {x: 1, y: 2}}))
    )
    let installed = 0
    const setValidationRule = vi.fn(async () => shadowFor(installed++))
    const check = vi.fn(checkValidationShadows)
    const wb = {
        ops: {setValidationRule, checkValidationShadows: check},
        client: {getSheetIdx, batchGetCellCoordinateWithSheetById},
    } as unknown as GatewayWorkbook
    return {
        wb,
        getSheetIdx,
        batchGetCellCoordinateWithSheetById,
        setValidationRule,
        check,
    }
}

const stateWith = (
    validations: DataGatewayState['validations']
): DataGatewayState => ({
    version: DATA_GATEWAY_VERSION,
    inputBlocks: ['orders'],
    outputBlocks: [],
    validations,
})

describe('data-gateway runtime orchestration', () => {
    it('onLoad resolves, installs, and caches the shadow ids', async () => {
        const state = stateWith([
            {sheetId: 7, cellId: normalCell(0, 0), formula: '#PLACEHOLDER>0'},
        ])
        const m = mockWorkbook(async () => [])

        await runtime.onLoad(state, m.wb)

        // Installed the shadow at the RESOLVED coordinate (y=2 → row, x=1 → col).
        expect(m.setValidationRule).toHaveBeenCalledWith(0, 2, 1, '#PLACEHOLDER>0')
        // Cached the shadow id (returned by the install) + the target rule.
        const record = getGatewayRecord(m.wb)
        expect(record?.inputBlocks.has('orders')).toBe(true)
        expect(record?.validations).toEqual([
            {
                shadow: shadowFor(0),
                rule: {sheetIdx: 0, row: 2, col: 1, formula: '#PLACEHOLDER>0'},
            },
        ])
    })

    it('onValidate reads verdicts by cached id — no re-parse, no re-resolve', async () => {
        const state = stateWith([
            {sheetId: 7, cellId: normalCell(0, 0), formula: '#PLACEHOLDER>0'},
        ])
        const m = mockWorkbook(async () => [])

        await runtime.onLoad(state, m.wb)
        const resolveCallsAfterLoad =
            m.getSheetIdx.mock.calls.length +
            m.batchGetCellCoordinateWithSheetById.mock.calls.length

        await runtime.onValidate!(state, m.wb)

        // The resolve path was NOT touched again during validation.
        expect(
            m.getSheetIdx.mock.calls.length +
                m.batchGetCellCoordinateWithSheetById.mock.calls.length
        ).toBe(resolveCallsAfterLoad)
        // It batch-read exactly the cached shadow id + rule.
        expect(m.check).toHaveBeenCalledTimes(1)
        expect(m.check).toHaveBeenCalledWith([
            {
                shadow: shadowFor(0),
                rule: {sheetIdx: 0, row: 2, col: 1, formula: '#PLACEHOLDER>0'},
            },
        ])
    })

    it('onValidate returns the violations the shadow read reports', async () => {
        const violation: Violation = {
            sheetIdx: 0,
            row: 2,
            col: 1,
            kind: 'failed',
            message: 'nope',
        }
        const state = stateWith([
            {sheetId: 7, cellId: normalCell(0, 0), formula: '#PLACEHOLDER>0'},
        ])
        const m = mockWorkbook(async () => [violation])

        await runtime.onLoad(state, m.wb)
        expect(await runtime.onValidate!(state, m.wb)).toEqual([violation])
    })

    it('onRequest rejects a write to a block outside the allowed set', async () => {
        const state = stateWith([])
        const m = mockWorkbook(async () => [])
        await runtime.onLoad(state, m.wb)

        const ok = runtime.onRequest(
            {jsonrpc: '2.0', method: 'x', params: {dataGateway: {writeBlocks: ['orders']}}},
            state,
            m.wb
        )
        expect(ok).toBeUndefined()

        const bad = runtime.onRequest(
            {jsonrpc: '2.0', method: 'x', params: {dataGateway: {writeBlocks: ['secret']}}},
            state,
            m.wb
        )
        expect(bad).toMatchObject({msg: expect.stringContaining('secret')})
    })
})
