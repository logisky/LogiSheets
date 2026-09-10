/**
 * End-to-end proof, through the real wasm RPC, that a block's row keys are
 * unique — and that the workbook can be asked about the ones it arrived with.
 *
 * `(block, key, field)` is how a block addresses a cell. `BLOCKREF` resolves a
 * key by taking the FIRST record that matches, so two records sharing a key
 * make one unreachable and every aggregate over the block count the reachable
 * one twice — with no error raised anywhere. Both halves of the fix are
 * exercised here across the wasm boundary, which the Rust unit tests cannot
 * reach:
 *
 *   - `handleTransaction` refuses a write that would create a duplicate.
 *   - `duplicateBlockKeys` reports the duplicates a workbook already holds.
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

function keyInput(row: number, content: string) {
    return {type: 'cellInput', value: {sheetIdx: 0, row, col: 0, content}}
}

interface DuplicateBlockKey {
    sheetIdx: number
    blockId: number
    blockName: string
    key: string
    records: number[]
}

describe('block row-key uniqueness', () => {
    let bookId: number

    /** A 4x2 block at A1 bound as `rec`: key column plus an `amt` field. */
    function createBlock(bookId: number): number {
        const id = rpc('getAvailableBlockId', {sheetIdx: 0}, bookId) as number
        const effect = commit(bookId, [
            {
                type: 'createBlock',
                value: {
                    sheetIdx: 0,
                    id,
                    masterRow: 0,
                    masterCol: 0,
                    rowCnt: 4,
                    colCnt: 2,
                },
            },
            {
                type: 'bindFormSchema',
                value: {
                    refName: 'rec',
                    sheetIdx: 0,
                    blockId: id,
                    fieldFrom: 0,
                    keyIdx: 0,
                    row: true,
                    fields: [
                        {name: 'key', renderId: 'r0'},
                        {name: 'amt', renderId: 'r1'},
                    ],
                },
            },
        ])
        expect(effect.status.type).toBe('ok')
        return id
    }

    beforeEach(() => {
        bookId = rpc('newWorkbook') as number
        createBlock(bookId)
    })

    it('refuses a write that would repeat an existing row key', () => {
        expect(
            commit(bookId, [keyInput(0, 'a'), keyInput(1, 'b')]).status.type
        ).toBe('ok')

        const effect = commit(bookId, [keyInput(1, 'a')])
        expect(effect.status.type).toBe('err')
        expect(effect.errorMessage).toContain('rec')
        expect(effect.errorMessage).toContain('unique')

        // The refusal is atomic — the key it tried to overwrite is untouched.
        expect(rpc('getValue', {sheetIdx: 0, row: 1, col: 0}, bookId)).toEqual({
            type: 'str',
            value: 'b',
        })
    })

    it('refuses two records given the same key in one transaction', () => {
        const effect = commit(bookId, [keyInput(0, 'x'), keyInput(1, 'x')])
        expect(effect.status.type).toBe('err')
        expect(rpc('getValue', {sheetIdx: 0, row: 0, col: 0}, bookId)).toBe(
            'empty'
        )
    })

    it('allows two records to swap keys in one transaction', () => {
        commit(bookId, [keyInput(0, 'a'), keyInput(1, 'b')])
        const effect = commit(bookId, [keyInput(0, 'b'), keyInput(1, 'a')])
        expect(effect.status.type).toBe('ok')
        expect(rpc('getValue', {sheetIdx: 0, row: 0, col: 0}, bookId)).toEqual({
            type: 'str',
            value: 'b',
        })
    })

    it('does not treat blank key cells as duplicates of each other', () => {
        // Every key cell of a fresh block is blank; a block that could not be
        // created is not much use.
        expect(rpc('duplicateBlockKeys', undefined, bookId)).toEqual([])
    })

    it('reports the duplicates a workbook already holds, and stops once fixed', () => {
        // Plant them the only way that is still possible: write the column
        // first, name it the key column afterwards. (Doing both in ONE
        // transaction is itself refused — the guard reads the finished state.)
        const legacy = rpc('newWorkbook') as number
        const legacyBlock = rpc(
            'getAvailableBlockId',
            {sheetIdx: 0},
            legacy
        ) as number
        expect(
            commit(legacy, [
                {
                    type: 'createBlock',
                    value: {
                        sheetIdx: 0,
                        id: legacyBlock,
                        masterRow: 0,
                        masterCol: 0,
                        rowCnt: 4,
                        colCnt: 2,
                    },
                },
                keyInput(0, 'dup'),
                keyInput(1, 'solo'),
                keyInput(2, 'dup'),
            ]).status.type
        ).toBe('ok')

        expect(rpc('duplicateBlockKeys', undefined, legacy)).toEqual([])

        expect(
            commit(legacy, [
                {
                    type: 'bindFormSchema',
                    value: {
                        refName: 'rec',
                        sheetIdx: 0,
                        blockId: legacyBlock,
                        fieldFrom: 0,
                        keyIdx: 0,
                        row: true,
                        fields: [
                            {name: 'key', renderId: 'r0'},
                            {name: 'amt', renderId: 'r1'},
                        ],
                    },
                },
            ]).status.type
        ).toBe('ok')

        const dups = rpc(
            'duplicateBlockKeys',
            undefined,
            legacy
        ) as DuplicateBlockKey[]
        expect(dups).toHaveLength(1)
        expect(dups[0].blockName).toBe('rec')
        expect(dups[0].sheetIdx).toBe(0)
        expect(dups[0].blockId).toBe(legacyBlock)
        expect(dups[0].key).toBe('dup')
        // "solo" is unique and the fourth row is blank, so neither is reported.
        expect(dups[0].records).toEqual([0, 2])

        // The block stays editable despite being dirty: refusing every later
        // write would lock out the repair itself.
        expect(commit(legacy, [keyInput(2, 'other')]).status.type).toBe('ok')
        expect(rpc('duplicateBlockKeys', undefined, legacy)).toEqual([])

        rpc('release', undefined, legacy)
    })

    it('reports nothing for a block with distinct keys', () => {
        commit(bookId, [keyInput(0, 'a'), keyInput(1, 'b'), keyInput(2, 'c')])
        expect(rpc('duplicateBlockKeys', undefined, bookId)).toEqual([])
    })
})
