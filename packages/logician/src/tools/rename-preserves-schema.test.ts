/**
 * A rename must not take anything else with it.
 *
 * `rename_block` and `rename_field` both work by re-binding the block's whole
 * schema from a snapshot of it, and `BindFormSchema` states a block's ENTIRE
 * interpretation — the engine builds a fresh schema from the payload rather
 * than merging with what was there. So the snapshot is not a convenience: any
 * part of the schema it forgets is DELETED, by a tool whose only job was to
 * change a name.
 *
 * Two parts were being forgotten, both added to the schema after the snapshot
 * was last shaped:
 *
 *   - `headerIdx`. Losing it does not merely forget a label — the header line
 *     stops being a header and becomes a RECORD, keyed by whatever the key
 *     column's title happens to be. A renamed pivot grew a phantom group
 *     called "region", and its next refresh tried to drop it and failed the
 *     whole transaction.
 *   - `uniqueTogether`. `build__create_block` sets these; a rename removed
 *     them, so the rule an agent had just been told was in force silently
 *     was not.
 *
 * These assert the payload. The engine-level half — that a real pivot survives
 * a rename and still refreshes — is in packages/node/__tests__.
 */
import {describe, expect, it} from 'vitest'
import type {Client} from 'logisheets-web/pure'
import type {ToolContext} from '../tool.js'
import {renameBlock, renameField} from './builder.js'

const SHEET_ID = 7
const BLOCK_ID = 3

/**
 * One block whose schema declares BOTH of the things a rename used to drop: a
 * header line at block row 0, and a `unique_together` group.
 */
function blockClient(
    opts: {headerIdx?: number; schemaType?: string} = {headerIdx: 0}
) {
    const committed: Array<{type: string; value: Record<string, unknown>}> = []
    const client = {
        getAllBlocks: async () => [
            {
                sheetIdx: 0,
                sheetId: SHEET_ID,
                blockId: BLOCK_ID,
                rowStart: 10,
                colStart: 2,
                rowCnt: 3,
                colCnt: 3,
                description: '',
                owner: '',
                modifyPolicy: 'all',
                permissions: {},
                fieldRenders: [],
                cells: [],
                schema: {
                    name: 'orders',
                    schemaType: opts.schemaType ?? 'row',
                    keys: [
                        {key: 'k1', idx: 1},
                        {key: 'k2', idx: 2},
                    ],
                    fields: [
                        {field: 'id', idx: 0, renderId: 'r0'},
                        {field: 'region', idx: 1, renderId: 'r1'},
                        {field: 'quarter', idx: 2, renderId: 'r2'},
                    ],
                    randomEntries: [],
                    headerIdx: opts.headerIdx,
                    uniqueTogether: [{fields: ['region', 'quarter']}],
                },
            },
        ],
        getAllSheetInfo: async () => [{name: 'Sheet1'}],
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

function bindOf(
    committed: Array<{type: string; value: Record<string, unknown>}>
) {
    const bind = committed.find((p) => p.type === 'bindFormSchema')
    expect(bind, 'the rename re-binds the schema').toBeDefined()
    return bind!.value as {
        headerIdx?: number
        uniqueTogether?: ReadonlyArray<{fields: readonly string[]}>
        fields: Array<{name: string}>
    }
}

describe('build__rename_block keeps the rest of the schema', () => {
    it('restates the header line and the block-level rule', async () => {
        const {client, committed} = blockClient()

        await renameBlock.handler({from: 'orders', to: 'sales'}, ctxFor(client))

        const bind = bindOf(committed)
        expect(bind.headerIdx, 'the header line survives').toBe(0)
        expect(bind.uniqueTogether?.map((g) => [...g.fields])).toEqual([
            ['region', 'quarter'],
        ])
        // And it really was just a rename.
        expect(bind.fields.map((f) => f.name)).toEqual([
            'id',
            'region',
            'quarter',
        ])
    })

    it('does not invent a header line for a block that has none', async () => {
        // The other direction, and the reason `headerIdx` is restated
        // conditionally: telling a plain table its first row is titles would
        // hide a record from every reader of the block.
        const {client, committed} = blockClient({headerIdx: undefined})

        await renameBlock.handler({from: 'orders', to: 'sales'}, ctxFor(client))

        expect(bindOf(committed).headerIdx).toBeUndefined()
    })
})

describe('build__rename_field keeps the rest of the schema', () => {
    it('restates the header line and the block-level rule', async () => {
        const {client, committed} = blockClient()

        await renameField.handler(
            {block: 'orders', from: 'region', to: 'territory'},
            ctxFor(client)
        )

        const bind = bindOf(committed)
        expect(bind.headerIdx).toBe(0)
        expect(bind.uniqueTogether?.map((g) => [...g.fields])).toEqual([
            ['region', 'quarter'],
        ])
        expect(bind.fields.map((f) => f.name)).toEqual([
            'id',
            'territory',
            'quarter',
        ])
    })

    it('writes the new name into the header cell, so the grid agrees', async () => {
        // Otherwise describe_block says "territory" and the sheet still shows
        // "region", and nobody can reconcile them by hand: the engine makes a
        // header cell read-only, so this tool is the only thing that can.
        const {client, committed} = blockClient()

        await renameField.handler(
            {block: 'orders', from: 'region', to: 'territory'},
            ctxFor(client)
        )

        const write = committed.find((p) => p.type === 'blockInput')
        expect(write, 'the header cell is rewritten').toBeDefined()
        expect(write!.value).toMatchObject({
            sheetIdx: 0,
            blockId: BLOCK_ID,
            // Block-relative: the header ROW the schema declares, and the
            // renamed field's own COLUMN. Not the block's position on the
            // sheet, which this does not depend on.
            row: 0,
            col: 1,
            input: 'territory',
        })
        // Before the bind, as every block-relative write in this codebase is.
        const types = committed.map((p) => p.type)
        expect(types.indexOf('blockInput')).toBeLessThan(
            types.indexOf('bindFormSchema')
        )
    })

    it('writes no header cell when the block has no header line', async () => {
        const {client, committed} = blockClient({headerIdx: undefined})

        await renameField.handler(
            {block: 'orders', from: 'region', to: 'territory'},
            ctxFor(client)
        )

        expect(committed.some((p) => p.type === 'blockInput')).toBe(false)
        expect(bindOf(committed).fields.map((f) => f.name)).toEqual([
            'id',
            'territory',
            'quarter',
        ])
    })

    it('leaves the header cell alone on a column schema', async () => {
        // There the header runs along the other axis, so `(headerIdx, col)`
        // would be the wrong cell. These tools already re-bind every block as
        // `row: true`, which is its own problem; writing a second wrong thing
        // on top of it would not help.
        const {client, committed} = blockClient({
            headerIdx: 0,
            schemaType: 'col',
        })

        await renameField.handler(
            {block: 'orders', from: 'region', to: 'territory'},
            ctxFor(client)
        )

        expect(committed.some((p) => p.type === 'blockInput')).toBe(false)
    })
})
