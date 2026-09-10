import {describe, expect, it} from 'vitest'
import type {Client} from 'logisheets-web/pure'
import type {ToolContext} from '../tool.js'
import {
    createAnalysisBlock,
    describeBlock,
    editAnalysisBlock,
} from './builder.js'

/**
 * An analysis block exists so an agent can read a table's conclusions *and use
 * them*: it is an ordinary block, so its total has a key and is addressable.
 * These cover the two halves of that — creating one from declarations rather
 * than hand-written formulas, and reading the relation back from either end.
 *
 * The computation itself is covered in the engine
 * (crates/controller/src/api/test.rs) and end-to-end through the real wasm
 * (packages/node/__tests__).
 */

interface StubField {
    field: string
    idx: number
    renderId: string
    fieldType?: {kind: string}
    aggFunc?: string
    aggField?: string
    writePolicy?: string
}

function blockClient(
    opts: {
        fields?: StubField[]
        analyzes?: number
        analyzedBy?: number[]
        extraBlocks?: Array<Record<string, unknown>>
    } = {}
) {
    const {
        fields = [
            {field: 'key', idx: 0, renderId: 's0', writePolicy: 'inherit'},
            {
                field: 'amt',
                idx: 1,
                renderId: 's1',
                fieldType: {kind: 'number'},
                writePolicy: 'inherit',
            },
            {
                field: 'note',
                idx: 2,
                renderId: 's2',
                fieldType: {kind: 'string'},
                writePolicy: 'inherit',
            },
        ],
    } = opts
    const committed: Array<{type: string; value: Record<string, unknown>}> = []
    const client = {
        getAllBlocks: async () => [
            {
                sheetIdx: 0,
                sheetId: 7,
                blockId: 3,
                rowStart: 0,
                colStart: 0,
                rowCnt: 3,
                colCnt: fields.length,
                description: '',
                owner: '',
                modifyPolicy: 'all',
                permissions: {},
                fieldRenders: [],
                cells: [],
                analyzes: opts.analyzes,
                analyzedBy: opts.analyzedBy ?? [],
                schema: {
                    name: 'orders',
                    schemaType: 'row',
                    keys: [{key: 'k0', idx: 0}],
                    fields,
                    randomEntries: [],
                },
            },
            ...(opts.extraBlocks ?? []),
        ],
        getAllSheetInfo: async () => [{name: 'Sheet1'}],
        getAvailableBlockId: async () => 9,
        mayModifyBlock: async () => true,
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
    return {client, committed}
}

function ctxFor(client: Client): ToolContext {
    return {
        workbook: client,
        signal: new AbortController().signal,
        confirm: async () => true,
        log: () => {},
    }
}

describe('build__create_analysis_block', () => {
    it('sums the fields the source DECLARES as numbers, and leaves the rest alone', async () => {
        // The declaration is what makes a default possible at all. Guessing
        // from the data would total an id column.
        const {client, committed} = blockClient()
        const r = await createAnalysisBlock.handler(
            {source: 'orders'},
            ctxFor(client)
        )
        expect(r.data.aggregated).toEqual(['SUM of amt'])

        const bind = committed.find((p) => p.type === 'bindFormSchema')!
        const fields = (bind.value as {fields: Array<Record<string, unknown>>})
            .fields
        expect(fields.map((f) => [f.name, f.aggFunc])).toEqual([
            // The label column: no aggregate, so it stays an ordinary cell —
            // and it is the key the result is addressed by.
            ['key', undefined],
            ['amt', 'SUM'],
            // Declared a string, so nothing to total.
            ['note', undefined],
        ])
        // No formula is written by hand. The engine generates it from the
        // declaration, which is what makes a source rename safe.
        expect(fields.every((f) => f.valueFormula === undefined)).toBe(true)
    })

    it('declares what it analyses as it creates the block', async () => {
        // Not in a follow-up payload: between the two, a reader would see a
        // stray one-row table and take its total for a record.
        const {client, committed} = blockClient()
        await createAnalysisBlock.handler({source: 'orders'}, ctxFor(client))
        const create = committed.find((p) => p.type === 'createBlock')!
        expect(create.value.analyzes).toBe(3)
    })

    it('makes room before placing the block', async () => {
        // Otherwise it lands on whatever sits below the table — and the sheet
        // insert is also what keeps the pair adjacent as the source grows.
        const {client, committed} = blockClient()
        await createAnalysisBlock.handler({source: 'orders'}, ctxFor(client))
        expect(committed.map((p) => p.type)).toEqual([
            'insertRows',
            'createBlock',
            'bindFormSchema',
            'blockInput',
            // One per source column, carrying its number format across so a
            // total of currency reads as currency.
            'upsertFieldRenderInfo',
            'upsertFieldRenderInfo',
            'upsertFieldRenderInfo',
        ])
        expect(committed[0].value).toMatchObject({start: 3, count: 1})
        expect(committed[1].value).toMatchObject({masterRow: 3, rowCnt: 1})
    })

    it('writes the label, because that is the key the result is addressed by', async () => {
        const {client, committed} = blockClient()
        const r = await createAnalysisBlock.handler(
            {source: 'orders', label: 'Total'},
            ctxFor(client)
        )
        const label = committed.find((p) => p.type === 'blockInput')!
        expect(label.value).toMatchObject({input: 'Total', row: 0, col: 0})
        // The tool says how to reference the result, since that is the whole
        // reason it is a block of its own.
        expect(r.display).toContain('BLOCKREF("orders_analysis", "Total"')
    })

    it('honours an explicit choice of functions', async () => {
        const {client, committed} = blockClient()
        const r = await createAnalysisBlock.handler(
            {
                source: 'orders',
                aggregates: [
                    {field: 'amt', func: 'AVERAGE'},
                    {field: 'note', func: 'COUNT'},
                ],
            },
            ctxFor(client)
        )
        expect(r.data.aggregated.sort()).toEqual([
            'AVERAGE of amt',
            'COUNT of note',
        ])
        const bind = committed.find((p) => p.type === 'bindFormSchema')!
        const fields = (bind.value as {fields: Array<Record<string, unknown>>})
            .fields
        expect(fields[1]).toMatchObject({aggFunc: 'AVERAGE', aggField: 'amt'})
        expect(fields[2]).toMatchObject({aggFunc: 'COUNT', aggField: 'note'})
    })

    it('refuses a field the source does not have', async () => {
        const {client, committed} = blockClient()
        await expect(
            createAnalysisBlock.handler(
                {source: 'orders', aggregates: [{field: 'nope', func: 'SUM'}]},
                ctxFor(client)
            )
        ).rejects.toThrow(/no field named "nope"/)
        expect(committed).toEqual([])
    })

    it('refuses a name that is already taken', async () => {
        // Ref names are how formulas reach a block, so a duplicate would make
        // every reference to either one ambiguous.
        const {client, committed} = blockClient({
            extraBlocks: [
                {
                    sheetIdx: 0,
                    blockId: 5,
                    analyzedBy: [],
                    schema: {name: 'orders_analysis', fields: []},
                },
            ],
        })
        await expect(
            createAnalysisBlock.handler({source: 'orders'}, ctxFor(client))
        ).rejects.toThrow(/already exists/)
        expect(committed).toEqual([])
    })

    it('says what to do when the source declares no number fields', async () => {
        // Rather than creating an analysis block with nothing in it.
        const {client} = blockClient({
            fields: [
                {field: 'key', idx: 0, renderId: 's0', writePolicy: 'inherit'},
                {field: 'note', idx: 1, renderId: 's1', writePolicy: 'inherit'},
            ],
        })
        await expect(
            createAnalysisBlock.handler({source: 'orders'}, ctxFor(client))
        ).rejects.toThrow(/declares no number fields/)
    })
})

describe('build__describe_block reports the relation', () => {
    it('tells an analysis block from a table, in both directions', async () => {
        // The reason the whole feature is a separate block: an agent must not
        // sum an analysis alongside its source, and it can only avoid that if
        // it can tell them apart.
        const {client} = blockClient({
            analyzedBy: [9],
            extraBlocks: [
                {
                    sheetIdx: 0,
                    sheetId: 7,
                    blockId: 9,
                    rowStart: 3,
                    colStart: 0,
                    rowCnt: 1,
                    colCnt: 2,
                    description: '',
                    owner: '',
                    modifyPolicy: 'all',
                    permissions: {},
                    fieldRenders: [],
                    cells: [],
                    analyzes: 3,
                    analyzedBy: [],
                    schema: {
                        name: 'orders_analysis',
                        schemaType: 'row',
                        keys: [{key: 'TOTAL', idx: 0}],
                        fields: [
                            {
                                field: 'key',
                                idx: 0,
                                renderId: 'a0',
                                writePolicy: 'inherit',
                            },
                            {
                                field: 'amt',
                                idx: 1,
                                renderId: 'a1',
                                writePolicy: 'inherit',
                                aggFunc: 'SUM',
                                aggField: 'amt',
                            },
                        ],
                        randomEntries: [],
                    },
                },
            ],
        })

        const table = await describeBlock.handler(
            {name: 'orders'},
            ctxFor(client)
        )
        expect(table.data.analyzes).toBeUndefined()
        // By NAME, not id — an agent reads names.
        expect(table.data.analyzed_by).toEqual(['orders_analysis'])

        const analysis = await describeBlock.handler(
            {name: 'orders_analysis'},
            ctxFor(client)
        )
        expect(analysis.data.analyzes).toBe('orders')
        expect(analysis.data.analyzed_by).toBeUndefined()

        // And per field, WHAT the number is — not merely that it is a number.
        const amt = analysis.data.fields.find((f) => f.name === 'amt')!
        expect(amt.aggregates).toBe('SUM of amt')
        const key = analysis.data.fields.find((f) => f.name === 'key')!
        expect(key.aggregates).toBeUndefined()
    })
})

/**
 * `build__edit_analysis_block` — arriving at an analysis in steps.
 *
 * The contract that matters to a model: `aggregates` REPLACES the set. An
 * agent that meant to add a column and instead silently dropped the others
 * would leave a summary row that still looks like a summary row.
 */
describe('build__edit_analysis_block', () => {
    /** An analysis block over `orders`, declaring SUM of amt. */
    const analysisOf = () => ({
        sheetIdx: 0,
        sheetId: 7,
        blockId: 9,
        rowStart: 4,
        colStart: 0,
        rowCnt: 1,
        colCnt: 3,
        description: '',
        owner: '',
        modifyPolicy: 'all',
        permissions: {},
        fieldRenders: [],
        cells: [],
        analyzes: 3,
        analyzedBy: [],
        schema: {
            name: 'orders_analysis',
            schemaType: 'row',
            keys: [{key: 'TOTAL', idx: 0}],
            fields: [
                {field: 'key', idx: 0, renderId: 'a0', writePolicy: 'inherit'},
                {
                    field: 'amt',
                    idx: 1,
                    renderId: 'a1',
                    writePolicy: 'inherit',
                    aggFunc: 'SUM',
                    aggField: 'amt',
                },
                {field: 'note', idx: 2, renderId: 'a2', writePolicy: 'inherit'},
            ],
            randomEntries: [],
        },
    })

    it('replaces the declarations with the ones it is given', async () => {
        const {client, committed} = blockClient({
            analyzedBy: [9],
            extraBlocks: [analysisOf()],
        })
        const r = await editAnalysisBlock.handler(
            {
                name: 'orders_analysis',
                aggregates: [
                    {field: 'amt', func: 'AVERAGE'},
                    {field: 'note', func: 'COUNTA'},
                ],
            },
            ctxFor(client)
        )
        const bind = committed.find((p) => p.type === 'bindFormSchema')!
        const fields = bind.value.fields as Array<{
            name: string
            aggFunc?: string
        }>
        expect(fields.map((f) => [f.name, f.aggFunc])).toEqual([
            ['key', undefined],
            ['amt', 'AVERAGE'],
            ['note', 'COUNTA'],
        ])
        expect(r.data.aggregated).toEqual(['AVERAGE of amt', 'COUNTA of note'])
    })

    it('blanks a column it stopped computing', async () => {
        // The engine drops the stale FORMULA on its own; the value it last
        // produced has to be cleared, or the column keeps showing a number
        // nothing is claiming any more.
        const {client, committed} = blockClient({
            analyzedBy: [9],
            extraBlocks: [analysisOf()],
        })
        await editAnalysisBlock.handler(
            {
                name: 'orders_analysis',
                aggregates: [{field: 'note', func: 'COUNTA'}],
            },
            ctxFor(client)
        )
        const blanked = committed.filter(
            (p) => p.type === 'blockInput' && p.value.input === ''
        )
        expect(blanked.map((p) => p.value.col)).toEqual([1])
    })

    it('keeps the declarations when only the label changes', async () => {
        const {client, committed} = blockClient({
            analyzedBy: [9],
            extraBlocks: [analysisOf()],
        })
        await editAnalysisBlock.handler(
            {name: 'orders_analysis', label: 'GRAND'},
            ctxFor(client)
        )
        const bind = committed.find((p) => p.type === 'bindFormSchema')!
        const fields = bind.value.fields as Array<{
            name: string
            aggFunc?: string
        }>
        expect(fields.find((f) => f.name === 'amt')?.aggFunc).toBe('SUM')
        const label = committed.find(
            (p) => p.type === 'blockInput' && p.value.input === 'GRAND'
        )
        expect(label).toBeDefined()
    })

    it('sends a pivot to the pivot tool instead of half-editing it', async () => {
        const pivot = {
            ...analysisOf(),
            pivot: {
                rowDim: 'key',
                measure: 'amt',
                func: 'SUM',
                order: 'ascending',
            },
        }
        const {client} = blockClient({analyzedBy: [9], extraBlocks: [pivot]})
        await expect(
            editAnalysisBlock.handler(
                {
                    name: 'orders_analysis',
                    aggregates: [{field: 'amt', func: 'MAX'}],
                },
                ctxFor(client)
            )
        ).rejects.toThrow(/build__edit_pivot/)
    })

    it('refuses a block that analyses nothing', async () => {
        const {client} = blockClient()
        await expect(
            editAnalysisBlock.handler(
                {name: 'orders', aggregates: [{field: 'amt', func: 'SUM'}]},
                ctxFor(client)
            )
        ).rejects.toThrow(/does not analyse anything/)
    })
})
