import {describe, expect, it} from 'vitest'
import type {BlockOp, Client} from 'logisheets-web/pure'
import type {ToolContext} from '../tool.js'
import {
    BUILDER_TOOLS,
    describeBlock,
    setBlockDescription,
    setBlockPermissions,
} from './builder.js'
import {toolId} from '../tool.js'

/**
 * A workbook stub holding one block, plus whatever verdicts the test wants
 * `mayModifyBlock` to give. What matters about these tools is that they ASK
 * before writing and honour the answer, so the fake records both.
 */
function blockClient(
    opts: {
        denied?: readonly BlockOp[]
        description?: string
        owner?: string
        name?: string
    } = {}
) {
    const {
        denied = [],
        description = '',
        owner = 'watson',
        name = 'orders',
    } = opts
    const committed: Array<{type: string; value: Record<string, unknown>}> = []
    const asked: Array<{op: BlockOp; actor: unknown}> = []
    const client = {
        getAllBlocks: async () => [
            {
                sheetIdx: 0,
                sheetId: 7,
                blockId: 3,
                rowStart: 0,
                colStart: 0,
                rowCnt: 2,
                colCnt: 2,
                description,
                owner,
                modifyPolicy: 'all',
                permissions: {},
                fieldRenders: [],
                cells: [],
                schema: {
                    name,
                    schemaType: 'row',
                    keys: [{key: 'k1', idx: 0}],
                    fields: [{field: 'qty', idx: 0, renderId: 'r'}],
                    randomEntries: [],
                },
            },
        ],
        getAllSheetInfo: async () => [{name: 'Sheet1'}],
        mayModifyBlock: async ({op, actor}: {op: BlockOp; actor: unknown}) => {
            asked.push({op, actor})
            return !denied.includes(op)
        },
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
    return {client, committed, asked}
}

function ctxFor(client: Client): ToolContext {
    return {
        workbook: client,
        signal: new AbortController().signal,
        confirm: async () => true,
        log: () => {},
    }
}

describe('build__set_block_description', () => {
    it('writes the prose onto the block', async () => {
        const {client, committed} = blockClient()
        await setBlockDescription.handler(
            {name: 'orders', description: 'One row per customer order.'},
            ctxFor(client)
        )
        expect(committed).toEqual([
            {
                type: 'setBlockDescription',
                value: {
                    sheetIdx: 0,
                    blockId: 3,
                    description: 'One row per customer order.',
                },
            },
        ])
    })

    it('asks permission first, and refuses when told no', async () => {
        // The engine cannot enforce the policy, so a tool that wrote without
        // asking would walk straight through it.
        const {client, committed, asked} = blockClient({
            denied: ['modifyDescription'],
            owner: 'some-other-craft',
        })
        await expect(
            setBlockDescription.handler(
                {name: 'orders', description: 'mine now'},
                ctxFor(client)
            )
        ).rejects.toThrow(/reserves modifyDescription to "some-other-craft"/)
        expect(committed).toEqual([])
        expect(asked.map((a) => a.op)).toEqual(['modifyDescription'])
    })

    it('identifies itself as the watson craft when asking', async () => {
        // Not as the user: a block Watson owns must stay editable by Watson,
        // and a block reserved to the user must not be.
        const {client, asked} = blockClient()
        await setBlockDescription.handler(
            {name: 'orders', description: 'x'},
            ctxFor(client)
        )
        expect(asked[0].actor).toEqual({type: 'craft', value: 'watson'})
    })

    it('names the blocks that do exist when given a name that does not', async () => {
        const {client} = blockClient({name: 'orders'})
        await expect(
            setBlockDescription.handler(
                {name: 'ordrs', description: 'x'},
                ctxFor(client)
            )
        ).rejects.toThrow(/No block named "ordrs".*orders/s)
    })

    it('takes an empty string, which is how a description is cleared', async () => {
        const {client, committed} = blockClient({description: 'stale'})
        await setBlockDescription.handler(
            {name: 'orders', description: ''},
            ctxFor(client)
        )
        expect(committed[0].value.description).toBe('')
    })
})

describe('build__set_block_permissions', () => {
    it('sends the whole set, with omitted operations left unstated', async () => {
        // All-or-nothing on purpose: an operation left out goes back to
        // following the default policy, and that has to be expressible.
        const {client, committed} = blockClient()
        await setBlockPermissions.handler(
            {
                name: 'orders',
                operations: {
                    insertDeleteLines: 'ownerOnly',
                    removeBlock: 'ownerOnly',
                    cellInput: 'all',
                },
                default_policy: 'ownerAndUser',
            },
            ctxFor(client)
        )
        expect(committed[0].value).toEqual({
            sheetIdx: 0,
            blockId: 3,
            permissions: {
                insertDeleteLines: 'ownerOnly',
                removeBlock: 'ownerOnly',
                modifySchema: undefined,
                cellInput: 'all',
                sortByField: undefined,
                modifyDescription: undefined,
            },
            modifyPolicy: 'ownerAndUser',
        })
    })

    it('leaves the default policy alone when not given one', async () => {
        const {client, committed} = blockClient()
        await setBlockPermissions.handler(
            {name: 'orders', operations: {cellInput: 'all'}},
            ctxFor(client)
        )
        expect(committed[0].value.modifyPolicy).toBeUndefined()
    })

    it('cannot unlock a block another craft reserved', async () => {
        const {client, committed} = blockClient({
            denied: ['modifySchema'],
            owner: 'data-gateway',
        })
        await expect(
            setBlockPermissions.handler(
                {name: 'orders', operations: {insertDeleteLines: 'all'}},
                ctxFor(client)
            )
        ).rejects.toThrow(/reserves modifySchema to "data-gateway"/)
        expect(committed).toEqual([])
    })
})

describe('build__describe_block', () => {
    it('reports the description and owner so the agent knows what it is for', async () => {
        const {client} = blockClient({
            description: 'One row per order. `total` is maintained by a craft.',
            owner: 'orders-craft',
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res: any = await describeBlock.handler(
            {name: 'orders'},
            ctxFor(client)
        )
        expect(res.data.description).toBe(
            'One row per order. `total` is maintained by a craft.'
        )
        expect(res.data.owner).toBe('orders-craft')
    })

    it('reports nothing rather than an empty string when nobody said', async () => {
        const {client} = blockClient({description: '   ', owner: ''})
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res: any = await describeBlock.handler(
            {name: 'orders'},
            ctxFor(client)
        )
        expect(res.data.description).toBeNull()
        expect(res.data.owner).toBeNull()
    })

    it('lists the operations closed to it, and stays quiet when none are', async () => {
        const {client} = blockClient({
            denied: ['insertDeleteLines', 'removeBlock', 'modifySchema'],
            owner: 'orders-craft',
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res: any = await describeBlock.handler(
            {name: 'orders'},
            ctxFor(client)
        )
        expect(Object.keys(res.data.denied_operations)).toEqual([
            'insertDeleteLines',
            'removeBlock',
            'modifySchema',
        ])
        expect(res.data.denied_operations.modifySchema).toMatch(
            /reserved to "orders-craft"/
        )

        const open = blockClient()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res2: any = await describeBlock.handler(
            {name: 'orders'},
            ctxFor(open.client)
        )
        expect(res2.data.denied_operations).toBeUndefined()
    })
})

describe('registration', () => {
    it('exposes both tools under the block namespace', () => {
        const ids = BUILDER_TOOLS.map(toolId)
        expect(ids).toContain('build__set_block_description')
        expect(ids).toContain('build__set_block_permissions')
    })

    it('marks them as writes, and the policy change as needing confirmation', () => {
        expect(setBlockDescription.mutates).toBe(true)
        expect(setBlockPermissions.mutates).toBe(true)
        // Handing control of a block over is not something to do quietly.
        expect(setBlockPermissions.confirmation).toBe('always')
    })
})
