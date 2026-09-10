import {describe, expect, it} from 'vitest'
import type {Client} from '../port.js'
import {
    WorkbookOps,
    defaultAnalysisAggregates,
    type AnalysisSource,
} from './index.js'

/**
 * `createAnalysisBlock` sends a DECLARATION and no formula — see
 * design/block-analysis.md. What the engine does with it is covered in
 * crates/controller and end to end in packages/node; what matters here is the
 * payload shape, because a host that gets it wrong produces a one-row table
 * that looks like a record.
 */

function opsWith(): {
    ops: WorkbookOps
    committed: Array<{type: string; value: Record<string, unknown>}>
} {
    const committed: Array<{type: string; value: Record<string, unknown>}> = []
    const client = {
        handleTransaction: async ({
            transaction,
        }: {
            transaction: {payloads: Array<{type: string; value: unknown}>}
        }) => {
            for (const p of transaction.payloads)
                committed.push(
                    p as {type: string; value: Record<string, unknown>}
                )
            return {status: {type: 'ok'}, taskIdx: [], asyncTasks: []}
        },
    } as unknown as Client
    return {ops: new WorkbookOps(client), committed}
}

const ORDERS: AnalysisSource = {
    sheetIdx: 0,
    blockId: 3,
    refName: 'orders',
    rowStart: 2,
    rowCnt: 3,
    colStart: 1,
    keyIdx: 0,
    fields: [
        {name: 'key', isNumber: false},
        {name: 'amt', isNumber: true, numFmt: '#,##0.00'},
        {name: 'note', isNumber: false},
    ],
}

describe('defaultAnalysisAggregates', () => {
    it('sums what the source DECLARES a number, and nothing else', () => {
        expect(defaultAnalysisAggregates(ORDERS.fields)).toEqual([
            {field: 'amt', func: 'SUM'},
        ])
    })

    it('is empty when nothing is declared, rather than guessing', () => {
        expect(
            defaultAnalysisAggregates([{name: 'a', isNumber: false}])
        ).toEqual([])
    })
})

describe('WorkbookOps.createAnalysisBlock', () => {
    it('makes room, then declares the block and its aggregates', async () => {
        const {ops, committed} = opsWith()
        const agg = await ops.createAnalysisBlock({
            source: ORDERS,
            blockId: 9,
            refName: 'orders_analysis',
            label: 'TOTAL',
        })
        expect(agg).toEqual([{field: 'amt', func: 'SUM'}])

        expect(committed.map((p) => p.type)).toEqual([
            'insertRows',
            'createBlock',
            'bindFormSchema',
            'blockInput',
            // One per column, carrying the source's number formats.
            'upsertFieldRenderInfo',
            'upsertFieldRenderInfo',
            'upsertFieldRenderInfo',
        ])

        // Directly below the table, in its columns.
        expect(committed[0].value).toMatchObject({start: 5, count: 1})
        expect(committed[1].value).toMatchObject({
            masterRow: 5,
            masterCol: 1,
            rowCnt: 1,
            colCnt: 3,
            // Declared as it is created, not in a follow-up payload.
            analyzes: 3,
        })
    })

    it('sends declarations, never formulas', async () => {
        // The engine generates the formula from the declaration. A formula
        // written here would go stale the moment a source field is renamed,
        // and go stale SILENTLY — a BLOCKREFS matching nothing reads zero.
        const {ops, committed} = opsWith()
        await ops.createAnalysisBlock({
            source: ORDERS,
            blockId: 9,
            refName: 'orders_analysis',
            label: 'TOTAL',
        })
        const fields = (
            committed[2].value as {fields: Array<Record<string, unknown>>}
        ).fields
        expect(fields.map((f) => [f.name, f.aggFunc, f.aggField])).toEqual([
            // The label column aggregates nothing, so it stays a cell someone
            // can type into — and it is the key the result is addressed by.
            ['key', undefined, undefined],
            ['amt', 'SUM', 'amt'],
            ['note', undefined, undefined],
        ])
        expect(fields.every((f) => f.valueFormula === undefined)).toBe(true)
    })

    it('writes the label into the key column', async () => {
        const {ops, committed} = opsWith()
        await ops.createAnalysisBlock({
            source: {...ORDERS, keyIdx: 1},
            blockId: 9,
            refName: 'orders_analysis',
            label: 'Total',
        })
        expect(committed[3].value).toMatchObject({
            row: 0,
            col: 1,
            input: 'Total',
        })
        expect(committed[2].value).toMatchObject({keyIdx: 1})
    })

    it('formats a total like the column it totals', async () => {
        const {ops, committed} = opsWith()
        await ops.createAnalysisBlock({
            source: ORDERS,
            blockId: 9,
            refName: 'orders_analysis',
            label: 'TOTAL',
        })
        const renders = committed.filter(
            (p) => p.type === 'upsertFieldRenderInfo'
        )
        expect(renders[1].value).toMatchObject({
            styleUpdate: {setNumFmt: '#,##0.00'},
        })
        // A column with no format asks for none rather than inheriting one.
        expect(renders[0].value).toMatchObject({styleUpdate: {setNumFmt: ''}})
    })

    it('honours an explicit choice of functions', async () => {
        const {ops, committed} = opsWith()
        const agg = await ops.createAnalysisBlock({
            source: ORDERS,
            blockId: 9,
            refName: 'orders_analysis',
            label: 'TOTAL',
            aggregates: [
                {field: 'note', func: 'COUNT'},
                {field: 'amt', func: 'AVERAGE'},
            ],
        })
        // Reported in COLUMN order, not the order asked for, so a caller can
        // print it next to the block.
        expect(agg).toEqual([
            {field: 'amt', func: 'AVERAGE'},
            {field: 'note', func: 'COUNT'},
        ])
        const fields = (
            committed[2].value as {fields: Array<Record<string, unknown>>}
        ).fields
        expect(fields[1]).toMatchObject({aggFunc: 'AVERAGE'})
        expect(fields[2]).toMatchObject({aggFunc: 'COUNT'})
    })

    it('refuses a field the source does not have, before writing anything', async () => {
        const {ops, committed} = opsWith()
        await expect(
            ops.createAnalysisBlock({
                source: ORDERS,
                blockId: 9,
                refName: 'orders_analysis',
                label: 'TOTAL',
                aggregates: [{field: 'nope', func: 'SUM'}],
            })
        ).rejects.toThrow(/no such field/)
        expect(committed).toEqual([])
    })

    it('says what to do when there is nothing to aggregate', async () => {
        // Rather than creating an analysis block with no analysis in it.
        const {ops, committed} = opsWith()
        await expect(
            ops.createAnalysisBlock({
                source: {
                    ...ORDERS,
                    fields: [{name: 'key', isNumber: false}],
                },
                blockId: 9,
                refName: 'orders_analysis',
                label: 'TOTAL',
            })
        ).rejects.toThrow(/number/)
        expect(committed).toEqual([])
    })
})
