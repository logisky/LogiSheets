import {describe, expect, it} from 'vitest'
import type {Client} from '../port.js'
import {WorkbookOps} from './index.js'

function opsWith(sheetNames: string[], status: object = {type: 'ok'}) {
    const sent: Array<{type: string; value: Record<string, unknown>}> = []
    const client = {
        getAllSheetInfo: async () => sheetNames.map((name) => ({name})),
        handleTransaction: async ({
            transaction,
        }: {
            transaction: {payloads: Array<{type: string; value: unknown}>}
        }) => {
            for (const p of transaction.payloads)
                sent.push(p as {type: string; value: Record<string, unknown>})
            return {status, errorMessage: 'nope'}
        },
    } as unknown as Client
    return {ops: new WorkbookOps(client), sent}
}

describe('WorkbookOps.importCsv', () => {
    it('creates a sheet after the last and fills it in one transaction', async () => {
        const {ops, sent} = opsWith(['Sheet1', 'orders'])
        const res = await ops.importCsv(
            'orders.csv',
            'name,qty\r\nApple,3\r\n=CMD(),\r\n'
        )
        expect(res).toEqual({
            sheetIdx: 2,
            sheetName: 'orders (2)',
            rows: 3,
            cols: 2,
        })
        expect(sent[0]).toEqual({
            type: 'createSheet',
            value: {idx: 2, newName: 'orders (2)'},
        })
        expect(sent.slice(1).map((p) => p.value)).toEqual([
            {sheetIdx: 2, row: 0, col: 0, content: 'name'},
            {sheetIdx: 2, row: 0, col: 1, content: 'qty'},
            {sheetIdx: 2, row: 1, col: 0, content: 'Apple'},
            {sheetIdx: 2, row: 1, col: 1, content: '3'},
            // Data, not a formula; the empty field writes nothing.
            {sheetIdx: 2, row: 2, col: 0, content: "'=CMD()"},
        ])
    })

    it('throws when the engine refuses the import', async () => {
        const {ops} = opsWith(['Sheet1'], {type: 'err', value: 0})
        await expect(ops.importCsv('a.csv', 'x')).rejects.toThrow('nope')
    })
})
