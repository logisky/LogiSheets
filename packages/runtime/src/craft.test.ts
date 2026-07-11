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
    runCraftExchange,
    loadCrafts,
    MemoryCraftRegistry,
    RPC_VALIDATION_FAILED,
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

describe('runCraftExchange (real WASM engine)', () => {
    let rt: SpreadsheetRuntime
    let wb: Workbook

    beforeEach(() => {
        rt = new SpreadsheetRuntime()
        wb = rt.createWorkbook()
    })
    afterEach(() => rt.closeAll())

    it('drives onRequest → onResponse into a JSON-RPC result', async () => {
        // A craft that writes params.value into A1, then reads A1 back out.
        const runtime: CraftRuntime<CraftState, Workbook> = {
            onLoad: () => undefined,
            onRequest: async (req, _s, w) => {
                const v = (req.params as {value?: number})?.value
                if (v !== undefined) await w.ops.inputCell(0, 0, 0, String(v))
                return undefined
            },
            onResponse: async (resp, _s, w) => {
                resp.result = {a1: await w.client.getValue({sheetIdx: 0, row: 0, col: 0})}
                return undefined
            },
        }
        const resp = await runCraftExchange([loaded(runtime, {})], wb, {
            jsonrpc: '2.0',
            id: 7,
            method: 'compute',
            params: {value: 42},
        })
        expect(resp.id).toBe(7)
        expect(resp.error).toBeUndefined()
        expect(resp.result).toMatchObject({a1: {type: 'number', value: 42}})
    })

    it('maps an onRequest objection to INVALID_PARAMS (-32602)', async () => {
        const runtime: CraftRuntime<CraftState, Workbook> = {
            onLoad: () => undefined,
            onRequest: () => ({msg: 'nope', ty: 0}),
            onResponse: () => undefined,
        }
        const resp = await runCraftExchange([loaded(runtime, {})], wb, {
            jsonrpc: '2.0',
            id: 1,
            method: 'compute',
        })
        expect(resp.error?.code).toBe(-32602)
        expect(resp.error?.message).toContain('nope')
        expect(resp.result).toBeUndefined()
    })

    it('maps onValidate violations to VALIDATION_FAILED, carrying the violations', async () => {
        const rule = {sheetIdx: 0, row: 0, col: 0, formula: '#PLACEHOLDER>10'}
        let shadow: SheetCellId
        const runtime: CraftRuntime<CraftState, Workbook> = {
            onLoad: async (_s, w) => {
                shadow = await w.ops.setValidationRule(0, 0, 0, rule.formula)
                return undefined
            },
            onRequest: async (_r, _s, w) => {
                await w.ops.inputCell(0, 0, 0, '5') // fails #>10
                return undefined
            },
            onValidate: (_s, w) => w.ops.checkValidationShadows([{shadow, rule}]),
            onResponse: () => undefined,
        }
        const crafts = [loaded(runtime, {})]
        await crafts[0].runtime.onLoad({}, wb)

        const resp = await runCraftExchange(crafts, wb, {
            jsonrpc: '2.0',
            id: 1,
            method: 'compute',
        })
        expect(resp.error?.code).toBe(RPC_VALIDATION_FAILED)
        expect(Array.isArray(resp.error?.data)).toBe(true)
        expect(resp.result).toBeUndefined()
    })
})

describe('MemoryCraftRegistry + loadCrafts round-trip (real WASM engine)', () => {
    it('discovers a craft from a saved AppData envelope and runs its onLoad', async () => {
        const rt = new SpreadsheetRuntime()
        const wb = rt.createWorkbook()
        await wb.ops.inputCell(0, 0, 0, '1')

        // Embed craft state in AppData exactly as a publish step would, then
        // reload from the saved bytes — this is the whole discovery path.
        const state = {greeting: 'hi'}
        const appData = JSON.stringify({
            craftStates: {'my-craft': JSON.stringify(state)},
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const save = await (wb.client as any).saveWorkbook({appData})
        expect(save.code).toBe(0)
        const wb2 = rt.loadWorkbookFromBytes(new Uint8Array(save.data), 'x.xlsx')

        let seenState: unknown
        const runtime: CraftRuntime<CraftState, Workbook> = {
            onLoad: (s) => {
                seenState = s
                return undefined
            },
            onRequest: () => undefined,
            onResponse: () => undefined,
        }
        const registry = new MemoryCraftRegistry().add('my-craft', runtime)

        const crafts = await loadCrafts(wb2, registry)
        expect(crafts).toHaveLength(1)
        expect(crafts[0].craftId).toBe('my-craft')
        expect(seenState).toEqual(state)
        rt.closeAll()
    })
})
