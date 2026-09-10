/**
 * A block states a rule about ITSELF, and the rule survives the wire.
 *
 * The engine's enforcement of `unique_together` — which cells go false, and
 * which pointedly do not — is asserted against the formula engine in
 * `crates/controller/src/api/test.rs`. What can only be checked from here is
 * the crossing: a host declares the groups in a `bindFormSchema` payload, and
 * reads the same groups back off `getAllBlocks`. Both directions go through
 * the generated bindings, and the shape is not the obvious one — a group is a
 * `{fields}` struct rather than a bare list, because the binding generator
 * renders a nested list as `readonly readonly string[][]`, which does not
 * compile.
 *
 * A host that sends the bare list does not lose just the rule: the payload
 * fails to deserialize and the RPC refuses the WHOLE transaction ("data did
 * not match any variant"), so the block is never created either. Cheap to get
 * wrong, and the resulting error names none of this — hence a test that says
 * what the accepted shape is.
 */
import {describe, it, expect} from 'vitest'
import {handle} from '../wasm/logisheets_wasm_server'

function rpc(
    method: string,
    params?: Record<string, unknown>,
    bookId?: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
    const msg = params === undefined ? method : {method, value: params}
    return handle(msg, bookId ?? null)
}

describe('a block-level unique_together group', () => {
    it('round-trips through the schema', () => {
        const bookId = rpc('newWorkbook') as number
        const id = rpc('getAvailableBlockId', {sheetIdx: 0}, bookId) as number
        const status = rpc(
            'handleTransaction',
            {
                transaction: {
                    payloads: [
                        {
                            type: 'createBlock',
                            value: {
                                sheetIdx: 0,
                                id,
                                masterRow: 0,
                                masterCol: 0,
                                rowCnt: 2,
                                colCnt: 3,
                            },
                        },
                        {
                            type: 'bindFormSchema',
                            value: {
                                refName: 'facts',
                                sheetIdx: 0,
                                blockId: id,
                                fieldFrom: 0,
                                keyIdx: 0,
                                row: true,
                                uniqueTogether: [
                                    {fields: ['region', 'quarter']},
                                ],
                                fields: [
                                    {name: 'id', renderId: 'u0'},
                                    {name: 'region', renderId: 'u1'},
                                    {name: 'quarter', renderId: 'u2'},
                                ],
                            },
                        },
                    ],
                    undoable: true,
                    temp: false,
                },
            },
            bookId
        )
        expect(status.status?.type, 'the transaction applied').toBe('ok')

        const blocks = rpc('getAllBlocks', {}, bookId) as Array<{
            blockId: number
            schema?: {uniqueTogether: ReadonlyArray<{fields: string[]}>}
        }>
        const schema = blocks.find((b) => b.blockId === id)?.schema
        expect(schema, 'the block has a schema').toBeDefined()
        expect(schema!.uniqueTogether).toEqual([
            {fields: ['region', 'quarter']},
        ])
    })

    it('is absent, not empty-by-accident, when nothing is declared', () => {
        const bookId = rpc('newWorkbook') as number
        const id = rpc('getAvailableBlockId', {sheetIdx: 0}, bookId) as number
        rpc(
            'handleTransaction',
            {
                transaction: {
                    payloads: [
                        {
                            type: 'createBlock',
                            value: {
                                sheetIdx: 0,
                                id,
                                masterRow: 0,
                                masterCol: 0,
                                rowCnt: 2,
                                colCnt: 2,
                            },
                        },
                        {
                            type: 'bindFormSchema',
                            value: {
                                refName: 'plain',
                                sheetIdx: 0,
                                blockId: id,
                                fieldFrom: 0,
                                keyIdx: 0,
                                row: true,
                                fields: [
                                    {name: 'id', renderId: 'p0'},
                                    {name: 'note', renderId: 'p1'},
                                ],
                            },
                        },
                    ],
                    undoable: true,
                    temp: false,
                },
            },
            bookId
        )
        const blocks = rpc('getAllBlocks', {}, bookId) as Array<{
            blockId: number
            schema?: {uniqueTogether: ReadonlyArray<{fields: string[]}>}
        }>
        // An omitted `uniqueTogether` must read back as "no rules", never as
        // undefined: `describe_block` branches on `.length`.
        expect(
            blocks.find((b) => b.blockId === id)?.schema?.uniqueTogether
        ).toEqual([])
    })
})
