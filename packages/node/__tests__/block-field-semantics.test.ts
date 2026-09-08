/**
 * A block schema carries its fields' semantics, and every host reads the same
 * answer. See design/block-field-semantics.md.
 *
 * This file began as stage-0 evidence: it asserted the opposite — that
 * `getAllBlocks` reported a field as a name, a position, a renderId and three
 * formula templates and nothing else, because a field's type, description,
 * `required` and `unique` lived only in the browser host's `FieldManager`,
 * persisted as an opaque JSON blob the engine stored and never read. That is
 * why `describe_block` could not report a field type in ANY host: an agent
 * declared one at `create_block` and could never read it back.
 *
 * Stage 1 moved the declaration into the schema, beside the rules it implies.
 * The assertions below are the flipped versions of the original ones.
 */
import {describe, it, expect, beforeEach} from 'vitest'
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function commit(bookId: number, payloads: any[]) {
    return rpc(
        'handleTransaction',
        {transaction: {payloads, undoable: true, temp: false}},
        bookId
    )
}

type FieldEntry = Record<string, unknown>

function fieldsOf(bookId: number): FieldEntry[] {
    const blocks = rpc('getAllBlocks', {}, bookId) as Array<{
        schema?: {fields: FieldEntry[]}
    }>
    const schema = blocks[0]?.schema
    expect(schema, 'the block has a schema').toBeDefined()
    return schema!.fields
}

/** A 3-column block: a plain key, a declared number, and a reference. */
function bindDeclared(bookId: number, blockId: number) {
    return commit(bookId, [
        {
            type: 'createBlock',
            value: {
                sheetIdx: 0,
                id: blockId,
                masterRow: 0,
                masterCol: 0,
                rowCnt: 2,
                colCnt: 3,
            },
        },
        {
            type: 'bindFormSchema',
            value: {
                refName: 'rec',
                sheetIdx: 0,
                blockId,
                fieldFrom: 0,
                keyIdx: 0,
                row: true,
                fields: [
                    {name: 'key', renderId: 'r0'},
                    {
                        name: 'amt',
                        renderId: 'r1',
                        validationFormula: '#PLACEHOLDER>0',
                        fieldType: {kind: 'number'},
                        description: 'amount, in units of 10k',
                        required: true,
                        defaultValue: '0',
                    },
                    {
                        name: 'customer',
                        renderId: 'r2',
                        fieldType: {
                            kind: 'fieldRef',
                            refSheetId: 0,
                            refBlockId: blockId,
                            refFieldName: 'key',
                        },
                        unique: true,
                    },
                ],
            },
        },
    ])
}

describe('a block schema carries its fields semantics', () => {
    let bookId: number
    let blockId: number

    beforeEach(() => {
        bookId = rpc('newWorkbook') as number
        blockId = rpc('getAvailableBlockId', {sheetIdx: 0}, bookId) as number
        expect(bindDeclared(bookId, blockId).status.type).toBe('ok')
    })

    it('reports what a field IS alongside what guards it', () => {
        const amt = fieldsOf(bookId).find((f) => f.field === 'amt')
        expect(amt, 'the schema knows the field by name').toBeDefined()

        // What guards it — unchanged.
        expect(amt!.validationFormula).toBe('#PLACEHOLDER>0')

        // What it is. This is the half no host but the browser could read
        // before, and that no host could read back at all.
        expect(amt!.fieldType).toEqual({kind: 'number'})
        expect(amt!.description).toBe('amount, in units of 10k')
        expect(amt!.required).toBe(true)
        expect(amt!.unique).toBe(false)
        expect(amt!.defaultValue).toBe('0')
    })

    it('carries a reference target, so a host can follow it', () => {
        const customer = fieldsOf(bookId).find((f) => f.field === 'customer')
        expect(customer!.fieldType).toEqual({
            kind: 'fieldRef',
            refSheetId: 0,
            refBlockId: blockId,
            refFieldName: 'key',
        })
        expect(customer!.unique).toBe(true)
    })

    it('leaves a field nobody declared as unspecified rather than guessing', () => {
        // The key column declared nothing. Absent is the honest answer — a
        // block from before the declaration existed, or one converted from
        // plain cells, is in exactly this state.
        const key = fieldsOf(bookId).find((f) => f.field === 'key')
        expect(key!.fieldType).toBeUndefined()
        expect(key!.description).toBeUndefined()
        expect(key!.required).toBe(false)
        expect(key!.unique).toBe(false)
    })

    it('survives a save/load round-trip', () => {
        // The point of putting the declaration beside the templates: the
        // transport was already there. While it lived in the host's AppData
        // blob, every host but the browser lost it on open.
        const saved = rpc('saveWorkbook', {appData: ''}, bookId) as {
            code: number
            data: number[] | Uint8Array
        }
        expect(saved.code).toBe(0)
        const bytes = Array.isArray(saved.data)
            ? saved.data
            : Array.from(saved.data)
        expect(bytes.length).toBeGreaterThan(0)

        const reopened = rpc('newWorkbook') as number
        rpc('loadWorkbook', {content: bytes, name: 'roundtrip.xlsx'}, reopened)

        const fields = fieldsOf(reopened)
        const amt = fields.find((f) => f.field === 'amt')
        expect(amt, 'the schema round-trips').toBeDefined()
        expect(amt!.validationFormula).toBe('#PLACEHOLDER>0')
        expect(amt!.fieldType).toEqual({kind: 'number'})
        expect(amt!.description).toBe('amount, in units of 10k')
        expect(amt!.required).toBe(true)
        expect(amt!.defaultValue).toBe('0')

        const customer = fields.find((f) => f.field === 'customer')
        expect(customer!.fieldType).toEqual({
            kind: 'fieldRef',
            refSheetId: 0,
            refBlockId: blockId,
            refFieldName: 'key',
        })
        expect(customer!.unique).toBe(true)

        rpc('release', undefined, reopened)
    })

    it('reads a kind it does not know as unspecified instead of failing', () => {
        // A file written by a newer build must still open. `kind` is a free
        // string on purpose, and an unknown one degrades to "nobody said".
        const other = rpc('newWorkbook') as number
        const bid = rpc('getAvailableBlockId', {sheetIdx: 0}, other) as number
        const effect = commit(other, [
            {
                type: 'createBlock',
                value: {
                    sheetIdx: 0,
                    id: bid,
                    masterRow: 0,
                    masterCol: 0,
                    rowCnt: 2,
                    colCnt: 2,
                },
            },
            {
                type: 'bindFormSchema',
                value: {
                    refName: 'future',
                    sheetIdx: 0,
                    blockId: bid,
                    fieldFrom: 0,
                    keyIdx: 0,
                    row: true,
                    fields: [
                        {name: 'key', renderId: 'r0'},
                        {
                            name: 'weird',
                            renderId: 'r1',
                            fieldType: {kind: 'someFutureKind'},
                        },
                    ],
                },
            },
        ])
        expect(effect.status.type).toBe('ok')

        const blocks = rpc('getAllBlocks', {}, other) as Array<{
            schema?: {fields: FieldEntry[]}
        }>
        const weird = blocks[0]?.schema?.fields.find((f) => f.field === 'weird')
        expect(weird!.fieldType).toBeUndefined()

        rpc('release', undefined, other)
    })
})

describe('the workbook carries its enum sets', () => {
    let bookId: number

    beforeEach(() => {
        bookId = rpc('newWorkbook') as number
    })

    function upsert(
        id: string,
        variants: Array<{id: string; label?: string}>,
        name?: string
    ) {
        return commit(bookId, [
            {type: 'upsertEnumSet', value: {id, name, variants}},
        ])
    }

    it('stores ids and labels, and reads them back in a stable order', () => {
        expect(
            upsert(
                'status',
                [
                    {id: 'open', label: 'Open'},
                    {id: 'done', label: 'Done'},
                ],
                'Order status'
            ).status.type
        ).toBe('ok')
        // A set inferred from a column's distinct values: no name, labels equal
        // ids. It costs no redundant data.
        expect(
            upsert('region', [{id: 'north'}, {id: 'south'}]).status.type
        ).toBe('ok')

        const sets = rpc('getEnumSets', undefined, bookId) as Array<{
            id: string
            name: string
            variants: Array<{id: string; label: string}>
        }>
        expect(sets.map((s) => s.id)).toEqual(['region', 'status'])

        const status = sets.find((s) => s.id === 'status')!
        expect(status.name).toBe('Order status')
        expect(status.variants).toEqual([
            {id: 'open', label: 'Open'},
            {id: 'done', label: 'Done'},
        ])

        // An omitted label reads back as the id, which is what it meant.
        const region = sets.find((s) => s.id === 'region')!
        expect(region.name).toBe('')
        expect(region.variants).toEqual([
            {id: 'north', label: 'north'},
            {id: 'south', label: 'south'},
        ])
    })

    it('replaces the option list rather than merging into it', () => {
        // Removing an option has to be expressible; a merge would make a set
        // impossible to ever narrow.
        upsert('status', [{id: 'open'}, {id: 'done'}])
        upsert('status', [{id: 'open'}])
        const sets = rpc('getEnumSets', undefined, bookId) as Array<{
            id: string
            variants: Array<{id: string}>
        }>
        expect(sets[0].variants.map((v) => v.id)).toEqual(['open'])
    })

    it('refuses a set with no options instead of allowing nothing', () => {
        const effect = upsert('empty', [])
        expect(effect.status.type).toBe('err')
        expect(effect.errorMessage).toContain('no variants')
        expect(rpc('getEnumSets', undefined, bookId)).toEqual([])
    })

    it('survives a save/load round-trip, so another host can read the options', () => {
        upsert(
            'status',
            [
                {id: 'open', label: 'Open'},
                {id: 'done', label: 'Done'},
            ],
            'Order status'
        )
        const saved = rpc('saveWorkbook', {appData: ''}, bookId) as {
            code: number
            data: number[] | Uint8Array
        }
        expect(saved.code).toBe(0)
        const bytes = Array.isArray(saved.data)
            ? saved.data
            : Array.from(saved.data)

        const reopened = rpc('newWorkbook') as number
        rpc('loadWorkbook', {content: bytes, name: 'roundtrip.xlsx'}, reopened)

        const sets = rpc('getEnumSets', undefined, reopened) as Array<{
            id: string
            name: string
            variants: Array<{id: string; label: string}>
        }>
        expect(sets).toEqual([
            {
                id: 'status',
                name: 'Order status',
                variants: [
                    {id: 'open', label: 'Open'},
                    {id: 'done', label: 'Done'},
                ],
            },
        ])

        rpc('release', undefined, reopened)
    })

    it('drops a set, and a field declaring it keeps the declaration', () => {
        // The declaration outliving its set is the honest state: the field
        // still says it holds one of a named list, and the list is gone. That
        // should surface as a violation, not as silent acceptance.
        upsert('status', [{id: 'open'}])
        const bid = rpc('getAvailableBlockId', {sheetIdx: 0}, bookId) as number
        commit(bookId, [
            {
                type: 'createBlock',
                value: {
                    sheetIdx: 0,
                    id: bid,
                    masterRow: 0,
                    masterCol: 0,
                    rowCnt: 2,
                    colCnt: 2,
                },
            },
            {
                type: 'bindFormSchema',
                value: {
                    refName: 'rec',
                    sheetIdx: 0,
                    blockId: bid,
                    fieldFrom: 0,
                    keyIdx: 0,
                    row: true,
                    fields: [
                        {name: 'key', renderId: 'r0'},
                        {
                            name: 'state',
                            renderId: 'r1',
                            fieldType: {kind: 'enum', enumSetId: 'status'},
                        },
                    ],
                },
            },
        ])

        expect(
            commit(bookId, [{type: 'removeEnumSet', value: {id: 'status'}}])
                .status.type
        ).toBe('ok')
        expect(rpc('getEnumSets', undefined, bookId)).toEqual([])

        const blocks = rpc('getAllBlocks', {}, bookId) as Array<{
            schema?: {fields: FieldEntry[]}
        }>
        const state = blocks[0]?.schema?.fields.find((f) => f.field === 'state')
        expect(state!.fieldType).toEqual({kind: 'enum', enumSetId: 'status'})
    })
})

describe('write policy is declared in the engine, not in a host store', () => {
    let bookId: number
    let blockId: number

    beforeEach(() => {
        bookId = rpc('newWorkbook') as number
        blockId = rpc('getAvailableBlockId', {sheetIdx: 0}, bookId) as number
        const effect = commit(bookId, [
            {
                type: 'createBlock',
                value: {
                    sheetIdx: 0,
                    id: blockId,
                    masterRow: 0,
                    masterCol: 0,
                    rowCnt: 2,
                    colCnt: 3,
                    owner: 'some-craft',
                },
            },
            {
                type: 'bindFormSchema',
                value: {
                    refName: 'rec',
                    sheetIdx: 0,
                    blockId,
                    fieldFrom: 0,
                    keyIdx: 0,
                    row: true,
                    fields: [
                        {name: 'key', renderId: 'r0', writePolicy: 'ownerOnly'},
                        {name: 'note', renderId: 'r1', writePolicy: 'anyone'},
                        // Says nothing — inherits the block's own rules.
                        {name: 'amt', renderId: 'r2'},
                    ],
                },
            },
        ])
        expect(effect.status.type).toBe('ok')
    })

    it('reports each field policy, always, so a reader never guesses', () => {
        const byName = new Map(fieldsOf(bookId).map((f) => [f.field, f]))
        expect(byName.get('key')!.writePolicy).toBe('ownerOnly')
        expect(byName.get('note')!.writePolicy).toBe('anyone')
        // Reported rather than omitted: "nobody said" is an answer.
        expect(byName.get('amt')!.writePolicy).toBe('inherit')
    })

    it('survives a save/load round-trip', () => {
        const saved = rpc('saveWorkbook', {appData: ''}, bookId) as {
            code: number
            data: number[] | Uint8Array
        }
        expect(saved.code).toBe(0)
        const bytes = Array.isArray(saved.data)
            ? saved.data
            : Array.from(saved.data)

        const reopened = rpc('newWorkbook') as number
        rpc('loadWorkbook', {content: bytes, name: 'roundtrip.xlsx'}, reopened)

        const byName = new Map(fieldsOf(reopened).map((f) => [f.field, f]))
        expect(byName.get('key')!.writePolicy).toBe('ownerOnly')
        expect(byName.get('note')!.writePolicy).toBe('anyone')
        expect(byName.get('amt')!.writePolicy).toBe('inherit')

        rpc('release', undefined, reopened)
    })

    it('says which operation each payload counts as', () => {
        // One table, in the thing that defines the operations. Each host
        // keeping its own is how the same payload comes to be governed
        // differently depending on who sent it.
        const table = rpc('getBlockOpForPayloads', undefined, bookId) as Array<{
            payloadType: string
            op: string
        }>
        const lookup = (t: string) => table.find((e) => e.payloadType === t)?.op
        expect(lookup('cellInput')).toBe('cellInput')
        expect(lookup('blockInput')).toBe('cellInput')
        expect(lookup('setBlockPermissions')).toBe('modifySchema')
        // Not something a block singles out — the caller falls back to its own
        // owner check rather than treating it as unguarded.
        expect(lookup('moveBlock')).toBeUndefined()
    })

    it('distinguishes "anyone may" from "nobody said"', () => {
        // The block has an owner and no policy. Reading the unstated policy as
        // "anyone" would make it LESS protected than before the engine knew
        // about policies, so a host has to be able to tell the two apart.
        const policies = rpc(
            'getBlockOpPolicies',
            {sheetIdx: 0, blockId},
            bookId
        ) as Array<{op: string; policy: string; stated: boolean}>
        const cellInput = policies.find((p) => p.op === 'cellInput')!
        expect(cellInput.policy).toBe('all')
        expect(cellInput.stated).toBe(false)

        const effect = commit(bookId, [
            {
                type: 'setBlockPermissions',
                value: {
                    sheetIdx: 0,
                    blockId,
                    permissions: {cellInput: 'ownerOnly'},
                },
            },
        ])
        expect(effect.status.type).toBe('ok')

        const after = rpc(
            'getBlockOpPolicies',
            {sheetIdx: 0, blockId},
            bookId
        ) as Array<{op: string; policy: string; stated: boolean}>
        expect(after.find((p) => p.op === 'cellInput')).toEqual({
            op: 'cellInput',
            policy: 'ownerOnly',
            stated: true,
        })
        expect(
            after.filter((p) => p.op !== 'cellInput').every((p) => !p.stated)
        ).toBe(true)
    })
})
