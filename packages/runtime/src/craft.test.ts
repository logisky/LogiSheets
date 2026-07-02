import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import type {
    CraftRuntime,
    CraftState,
    CraftManifest,
    Violation,
} from 'logisheets-core'
import type {SheetCellId} from 'logisheets-web'
import {
    SpreadsheetRuntime,
    applyCraftRequest,
    validateLoadedCrafts,
    applyCraftResponse,
    type LoadedCraft,
    type Workbook,
} from './index.js'

// The craft-loading tests exercise the request/validate/response helpers
// directly against a real WASM workbook, driving a hand-built craft runtime
// (the AppData round-trip that `loadCrafts` reads is covered by the host's
// save path; here we focus on the exchange helpers the RPC boundary uses).

const MANIFEST: CraftManifest = {rtJs: 'x.js', html: 'x.html'}

function loaded<S extends CraftState>(
    runtime: CraftRuntime<S, Workbook>,
    state: S
): LoadedCraft<S> {
    return {craftId: 'test', manifest: MANIFEST, runtime, state}
}

describe('craft exchange helpers (real WASM engine)', () => {
    let rt: SpreadsheetRuntime
    let wb: Workbook

    beforeEach(() => {
        rt = new SpreadsheetRuntime()
        wb = rt.createWorkbook()
    })

    afterEach(() => rt.closeAll())

    it('validateLoadedCrafts returns violations via the cached shadow id, then none once fixed', async () => {
        // A craft that validates cell A1 with the self-referential rule
        // "#PLACEHOLDER>10": onLoad installs the shadow and caches the id it
        // returns; onValidate reads the verdict back by that id.
        const rule = {sheetIdx: 0, row: 0, col: 0, formula: '#PLACEHOLDER>10'}
        let shadow: SheetCellId
        const runtime: CraftRuntime<CraftState, Workbook> = {
            onLoad: async (_s, w) => {
                shadow = await w.ops.setValidationRule(0, 0, 0, rule.formula)
                return undefined
            },
            onRequest: () => undefined,
            onValidate: (_s, w): Promise<Violation[]> =>
                w.ops.checkValidationShadows([{shadow, rule}]),
            onResponse: () => undefined,
        }
        const crafts = [loaded(runtime, {})]
        await crafts[0].runtime.onLoad({}, wb)

        await wb.ops.inputCell(0, 0, 0, '5')
        const bad = await validateLoadedCrafts(crafts, wb)
        expect(bad).toHaveLength(1)
        expect(bad[0]).toMatchObject({sheetIdx: 0, row: 0, col: 0})

        await wb.ops.inputCell(0, 0, 0, '20')
        const good = await validateLoadedCrafts(crafts, wb)
        expect(good).toHaveLength(0)
    })

    it('a cached shadow id still reads the right verdict after a row insert', async () => {
        // Install on A1 (#PLACEHOLDER>10), cache the shadow id, set A1 = 5
        // (fails). Insert a row above so the value moves to A2. Reading by the
        // SAME cached id — no re-resolution — still reports the violation.
        const shadow = await wb.ops.setValidationRule(0, 0, 0, '#PLACEHOLDER>10')
        const rule = {sheetIdx: 0, row: 0, col: 0, formula: '#PLACEHOLDER>10'}
        await wb.ops.inputCell(0, 0, 0, '5')
        expect(
            await wb.ops.checkValidationShadows([{shadow, rule}])
        ).toHaveLength(1)

        // Insert one row at the top of sheet 0, pushing the value to row 1.
        await wb.client.handleTransaction({
            transaction: {
                undoable: true,
                temp: false,
                payloads: [
                    {
                        type: 'insertRows',
                        value: {sheetIdx: 0, start: 0, count: 1},
                    },
                ],
            },
        })
        // Same cached id, no re-resolution: the verdict follows the cell.
        expect(
            await wb.ops.checkValidationShadows([{shadow, rule}])
        ).toHaveLength(1)
    })

    it('crafts without onValidate contribute no violations', async () => {
        const runtime: CraftRuntime<CraftState, Workbook> = {
            onLoad: () => undefined,
            onRequest: () => undefined,
            onResponse: () => undefined,
        }
        expect(await validateLoadedCrafts([loaded(runtime, {})], wb)).toEqual([])
    })

    it('applyCraftRequest collects a craft objection', async () => {
        const runtime: CraftRuntime<CraftState, Workbook> = {
            onLoad: () => undefined,
            onRequest: (req) =>
                req.method === 'blocked'
                    ? {msg: 'not allowed', ty: 0}
                    : undefined,
            onResponse: () => undefined,
        }
        const crafts = [loaded(runtime, {})]

        expect(
            await applyCraftRequest(crafts, {jsonrpc: '2.0', method: 'ok'}, wb)
        ).toEqual([])
        expect(
            await applyCraftRequest(
                crafts,
                {jsonrpc: '2.0', method: 'blocked'},
                wb
            )
        ).toEqual(['not allowed'])
    })

    it('applyCraftRequest turns a thrown error into an objection message', async () => {
        const runtime: CraftRuntime<CraftState, Workbook> = {
            onLoad: () => undefined,
            onRequest: () => {
                throw new Error('boom')
            },
            onResponse: () => undefined,
        }
        expect(
            await applyCraftRequest(
                [loaded(runtime, {})],
                {jsonrpc: '2.0', method: 'x'},
                wb
            )
        ).toEqual(['boom'])
    })

    it('applyCraftResponse forwards the response and collects objections', async () => {
        const seen: unknown[] = []
        const runtime: CraftRuntime<CraftState, Workbook> = {
            onLoad: () => undefined,
            onRequest: () => undefined,
            onResponse: (resp) => {
                seen.push(resp.result)
                return undefined
            },
        }
        const errs = await applyCraftResponse(
            [loaded(runtime, {})],
            {jsonrpc: '2.0', id: 1, result: 42},
            wb
        )
        expect(errs).toEqual([])
        expect(seen).toEqual([42])
    })
})
