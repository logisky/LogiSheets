import {afterEach, beforeEach, describe, it, expect} from 'vitest'
import {
    SpreadsheetRuntime,
    RpcServer,
    RpcError,
    RPC_METHOD_NOT_FOUND,
} from './index.js'

describe('RpcServer (JSON-RPC 2.0 over HTTP, real WASM engine)', () => {
    let rt: SpreadsheetRuntime
    let server: RpcServer
    let url: string

    // A developer-defined RPC surface whose bodies read/write the workbook.
    beforeEach(async () => {
        rt = new SpreadsheetRuntime()
        server = new RpcServer(rt)
        server
            .register('newWorkbook', (_p, {runtime}) => ({
                id: runtime.createWorkbook().id,
            }))
            .register<{id: number; row: number; col: number; text: string}>(
                'setCell',
                async (p, {runtime}) => {
                    const wb = runtime.workbooks.find((w) => w.id === p.id)
                    if (!wb)
                        throw new RpcError(1001, `no workbook ${p.id}`)
                    await wb.ops.inputCell(0, p.row, p.col, p.text)
                }
            )
            .register<{id: number; row: number; col: number}>(
                'getCell',
                (p, {runtime}) => {
                    const wb = runtime.workbooks.find((w) => w.id === p.id)
                    if (!wb) throw new RpcError(1001, `no workbook ${p.id}`)
                    return wb.getValue(0, p.row, p.col)
                }
            )
            // A mutating method: honors the per-call `save` flag and always
            // leaves the workbook's history clean afterwards.
            .registerMutation<{
                id: number
                row: number
                col: number
                text: string
                save?: boolean
            }>(
                'mutCell',
                (p, {runtime}) => {
                    const wb = runtime.workbooks.find((w) => w.id === p.id)
                    if (!wb) throw new RpcError(1001, `no workbook ${p.id}`)
                    return wb
                },
                async (wb, p) => {
                    await wb.ops.inputCell(0, p.row, p.col, p.text)
                    return wb.getValue(0, p.row, p.col)
                }
            )
            // Reports whether the workbook still has anything to undo.
            .register<{id: number}>('canUndo', async (p, {runtime}) => {
                const wb = runtime.workbooks.find((w) => w.id === p.id)
                if (!wb) throw new RpcError(1001, `no workbook ${p.id}`)
                const undone = await wb.undo()
                return undone
            })
        const addr = await server.listen(0)
        url = `http://127.0.0.1:${addr.port}`
    })

    afterEach(async () => {
        await server.close()
        rt.closeAll()
    })

    async function rpc(method: string, params?: unknown, id: unknown = 1) {
        const res = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({jsonrpc: '2.0', id, method, params}),
        })
        return res.json()
    }

    it('round-trips a developer-defined read/write workflow', async () => {
        const opened = await rpc('newWorkbook')
        expect(opened.error).toBeUndefined()
        const id = opened.result.id

        const written = await rpc('setCell', {id, row: 0, col: 0, text: 'hi'})
        expect(written.result).toBeNull() // handler returned undefined -> null

        const read = await rpc('getCell', {id, row: 0, col: 0})
        expect(read.result).toEqual({type: 'str', value: 'hi'})
        expect(read.id).toBe(1)
    })

    it('returns method-not-found for unregistered methods', async () => {
        const res = await rpc('doesNotExist', {})
        expect(res.error.code).toBe(RPC_METHOD_NOT_FOUND)
        expect(res.result).toBeUndefined()
    })

    it('surfaces a thrown RpcError with its custom code', async () => {
        const res = await rpc('getCell', {id: 999999, row: 0, col: 0})
        expect(res.error.code).toBe(1001)
        expect(res.error.message).toContain('no workbook')
    })

    it('handles a JSON-RPC batch', async () => {
        const opened = await rpc('newWorkbook')
        const id = opened.result.id
        const res = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify([
                {jsonrpc: '2.0', id: 'a', method: 'setCell', params: {id, row: 1, col: 0, text: 'x'}},
                {jsonrpc: '2.0', id: 'b', method: 'getCell', params: {id, row: 1, col: 0}},
            ]),
        })
        const batch = await res.json()
        expect(Array.isArray(batch)).toBe(true)
        const get = batch.find((r: {id: string}) => r.id === 'b')
        expect(get.result).toEqual({type: 'str', value: 'x'})
    })

    it('rejects duplicate method registration', () => {
        expect(() => server.register('getCell', () => null)).toThrow(/duplicate/)
    })

    it('persists a mutation when save is true and cleans history', async () => {
        const {result: {id}} = await rpc('newWorkbook')
        const mut = await rpc('mutCell', {id, row: 0, col: 0, text: 'keep', save: true})
        expect(mut.result).toEqual({type: 'str', value: 'keep'})

        // Change stuck...
        const read = await rpc('getCell', {id, row: 0, col: 0})
        expect(read.result).toEqual({type: 'str', value: 'keep'})

        // ...but history was cleaned, so there is nothing left to undo.
        const undo = await rpc('canUndo', {id})
        expect(undo.result).toBe(false)
    })

    it('rolls a mutation back when save is false, restoring the prior value', async () => {
        const {result: {id}} = await rpc('newWorkbook')
        // Establish a baseline value with a persisted write.
        await rpc('mutCell', {id, row: 0, col: 0, text: 'base', save: true})

        // A save:false mutation computes against the change but then reverts.
        const mut = await rpc('mutCell', {id, row: 0, col: 0, text: 'temp', save: false})
        expect(mut.result).toEqual({type: 'str', value: 'temp'})

        const read = await rpc('getCell', {id, row: 0, col: 0})
        expect(read.result).toEqual({type: 'str', value: 'base'})
    })

    it('defaults to saving when the save flag is omitted', async () => {
        const {result: {id}} = await rpc('newWorkbook')
        await rpc('mutCell', {id, row: 0, col: 0, text: 'dflt'})
        const read = await rpc('getCell', {id, row: 0, col: 0})
        expect(read.result).toEqual({type: 'str', value: 'dflt'})
    })
})
