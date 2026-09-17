/**
 * Which COLUMN of a block holds its keys, and what a host does when it has to
 * find out.
 *
 * `BlockSchema` reports two indices that both sound like "where the key is",
 * and they count on DIFFERENT AXES:
 *
 *   - `keyIdx`     — the key LINE, on the same axis `fields[].idx` uses. For a
 *                    row schema that is a COLUMN.
 *   - `keys[].idx` — where each key CELL sits along the RECORD axis. For a row
 *                    schema that is a ROW.
 *
 * They read the same for a plain table (0 and 0) and diverge for any block
 * with a header line, where the first record is line 1. Three call sites in
 * logisheets-logician reached for `keys[0].idx` when they wanted the column,
 * because until `keyIdx` was projected it was the only key index there was —
 * and one of them was actively corrupting pivots.
 *
 * These pin the projection itself and the two things that read it, against the
 * real engine. `pivot-tools.test.ts` covers the third (`refresh_pivot`).
 */
import {describe, it, expect} from 'vitest'
import type {Client} from 'logisheets-web/pure'
import {handle} from '../wasm/logisheets_wasm_server'
import {
    createAnalysisBlock,
    createPivot,
    editAnalysisBlock,
} from '../../logician/src/tools/builder.js'
import type {ToolContext} from '../../logician/src/tool.js'

function rpc(
    method: string,
    params?: Record<string, unknown>,
    bookId?: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
    const msg = params === undefined ? method : {method, value: params}
    return handle(msg, bookId ?? null)
}

function clientFor(bookId: number): Client {
    return new Proxy(
        {},
        {
            get:
                (_t, name: string) =>
                async (params?: Record<string, unknown>) =>
                    rpc(name, params, bookId),
        }
    ) as unknown as Client
}

function ctxFor(client: Client): ToolContext {
    return {
        workbook: client,
        signal: new AbortController().signal,
        confirm: async () => true,
        log: () => {},
    }
}

interface Schema {
    name: string
    keyIdx?: number
    headerIdx?: number
    keys: ReadonlyArray<{key: string; idx: number}>
    fields: ReadonlyArray<{field: string; idx: number}>
}

function blockNamed(
    bookId: number,
    name: string
): {schema: Schema; rowStart: number; colStart: number} {
    const b = (
        rpc('getAllBlocks', {}, bookId) as Array<{
            schema?: Schema
            rowStart: number
            colStart: number
        }>
    ).find((b) => b.schema?.name === name)
    expect(b, `block "${name}" exists`).toBeDefined()
    return b as {schema: Schema; rowStart: number; colStart: number}
}

function cell(
    bookId: number,
    row: number,
    col: number
): string | number | undefined {
    const v = rpc('getValue', {sheetIdx: 0, row, col}, bookId) as
        | {type: string; value: string | number}
        | string
    if (typeof v !== 'object') return undefined
    return v.type === 'number' || v.type === 'str' ? v.value : undefined
}

/** Evaluate a formula somewhere clear of every block. */
function formula(bookId: number, content: string): string | number | undefined {
    const eff = rpc(
        'handleTransaction',
        {
            transaction: {
                payloads: [
                    {
                        type: 'cellInput',
                        value: {sheetIdx: 0, row: 40, col: 10, content},
                    },
                ],
                undoable: true,
                temp: false,
            },
        },
        bookId
    )
    expect(eff.status.type, eff.errorMessage).toBe('ok')
    return cell(bookId, 40, 10)
}

function commit(
    bookId: number,
    payloads: ReadonlyArray<Record<string, unknown>>
) {
    const eff = rpc(
        'handleTransaction',
        {transaction: {payloads, undoable: true, temp: false}},
        bookId
    )
    expect(eff.status.type, eff.errorMessage).toBe('ok')
}

/** A table whose key column is `keyIdx`, filled row-major from `rows`. */
function table(
    bookId: number,
    refName: string,
    fields: ReadonlyArray<{name: string; number?: boolean}>,
    keyIdx: number,
    rows: ReadonlyArray<ReadonlyArray<string>>
): number {
    const id = rpc('getAvailableBlockId', {sheetIdx: 0}, bookId) as number
    commit(bookId, [
        {
            type: 'createBlock',
            value: {
                sheetIdx: 0,
                id,
                masterRow: 0,
                masterCol: 0,
                rowCnt: rows.length,
                colCnt: fields.length,
            },
        },
        {
            type: 'bindFormSchema',
            value: {
                refName,
                sheetIdx: 0,
                blockId: id,
                fieldFrom: 0,
                keyIdx,
                row: true,
                fields: fields.map((f, i) => ({
                    name: f.name,
                    renderId: `${refName}__${i}`,
                    ...(f.number ? {fieldType: {kind: 'number'}} : {}),
                })),
            },
        },
        ...rows.flatMap((r, y) =>
            r.map((v, x) => ({
                type: 'cellInput',
                value: {sheetIdx: 0, row: y, col: x, content: v},
            }))
        ),
    ])
    return id
}

describe('BlockSchema reports the key COLUMN, not just the key rows', () => {
    it('names the column the bind keyed on, even when it is not the first', () => {
        // The projection itself. `keys[].idx` counts records here (0, 1) while
        // `keyIdx` counts fields (1) — different axes, different numbers, and
        // nothing but the name used to say which was which.
        const bookId = rpc('newWorkbook') as number
        table(
            bookId,
            'rec',
            [{name: 'a'}, {name: 'k'}, {name: 'n', number: true}],
            1,
            [
                ['1', 'x', '10'],
                ['2', 'y', '20'],
            ]
        )

        const s = blockNamed(bookId, 'rec').schema
        expect(s.keyIdx).toBe(1)
        expect(s.fields.map((f) => [f.field, f.idx])).toEqual([
            ['a', 0],
            ['k', 1],
            ['n', 2],
        ])
        // The other index, on the other axis, for the same block.
        expect(s.keys.map((k) => k.idx)).toEqual([0, 1])
        // And it really is the key column: the keys are the values in it.
        expect(s.keys.map((k) => k.key)).toEqual(['x', 'y'])
    })

    it('separates the two indices on a pivot, which is where they diverge', () => {
        // A pivot keys on column 0 and owns a header line, so its first record
        // is ROW 1. Reading `keys[0].idx` as a column therefore lands on the
        // first measure column — the whole bug, visible as data.
        const bookId = rpc('newWorkbook') as number
        table(
            bookId,
            'sales',
            [
                {name: 'id'},
                {name: 'region'},
                {name: 'quarter'},
                {name: 'amount', number: true},
            ],
            0,
            [
                ['o1', 'East', 'Q1', '100'],
                ['o2', 'West', 'Q1', '80'],
            ]
        )
        const client = clientFor(bookId)
        return createPivot
            .handler(
                {
                    source: 'sales',
                    rows: 'region',
                    columns: 'quarter',
                    measure: 'amount',
                    name: 'by_region',
                },
                ctxFor(client)
            )
            .then(() => {
                const s = blockNamed(bookId, 'by_region').schema
                expect(s.headerIdx).toBe(0)
                expect(s.keyIdx).toBe(0)
                expect(s.keys.map((k) => k.idx)).toEqual([1, 2])
                // What the old code resolved to, spelled out: field idx 1.
                expect(s.fields.find((f) => f.idx === 1)?.field).toBe('Q1')
                // What it should have resolved to.
                expect(s.fields.find((f) => f.idx === s.keyIdx)?.field).toBe(
                    'region'
                )
            })
    })
})

describe('build__create_analysis_block keys where its source keys', () => {
    it('puts the label in the key column of a source that has a header line', async () => {
        // An analysis OVER A PIVOT is the case that bit: the pivot's
        // `keys[0].idx` is 1, so the label was written into column 1 — where
        // the generated aggregate promptly overwrote it — and column 0, the
        // key column the bind had declared, was left EMPTY. The block came out
        // with no key at all, so nothing could BLOCKREF it.
        const bookId = rpc('newWorkbook') as number
        table(
            bookId,
            'sales',
            [
                {name: 'id'},
                {name: 'region'},
                {name: 'quarter'},
                {name: 'amount', number: true},
            ],
            0,
            [
                ['o1', 'East', 'Q1', '100'],
                ['o2', 'West', 'Q1', '80'],
            ]
        )
        const client = clientFor(bookId)
        await createPivot.handler(
            {
                source: 'sales',
                rows: 'region',
                columns: 'quarter',
                measure: 'amount',
                name: 'by_region',
            },
            ctxFor(client)
        )
        await createAnalysisBlock.handler(
            {
                source: 'by_region',
                name: 'pivot_total',
                aggregates: [{field: 'Q1', func: 'SUM'}],
            },
            ctxFor(client)
        )

        const a = blockNamed(bookId, 'pivot_total')
        expect(a.schema.keyIdx).toBe(0)
        expect(cell(bookId, a.rowStart, a.colStart)).toBe('TOTAL')
        expect(cell(bookId, a.rowStart, a.colStart + 1)).toBe(180)
        // The point of the label being in the key column: the row is
        // addressable. This returned nothing at all before.
        expect(formula(bookId, '=BLOCKREF("pivot_total","TOTAL","Q1")')).toBe(
            180
        )
    })

    it('mirrors a source that keys on a later column', async () => {
        // An analysis block has one column per source field, so its key column
        // is the source's — not column 0 by assumption.
        const bookId = rpc('newWorkbook') as number
        table(
            bookId,
            'rec',
            [{name: 'n', number: true}, {name: 'k'}, {name: 'm', number: true}],
            1,
            [
                ['10', 'x', '1'],
                ['20', 'y', '2'],
            ]
        )
        const client = clientFor(bookId)
        await createAnalysisBlock.handler(
            {source: 'rec', name: 'rec_total'},
            ctxFor(client)
        )

        const a = blockNamed(bookId, 'rec_total')
        expect(a.schema.keyIdx).toBe(1)
        expect(cell(bookId, a.rowStart, a.colStart + 1)).toBe('TOTAL')
        expect(cell(bookId, a.rowStart, a.colStart)).toBe(30)
        expect(formula(bookId, '=BLOCKREF("rec_total","TOTAL","n")')).toBe(30)
    })

    it('keeps the key column through an edit', async () => {
        // `edit_analysis_block` re-binds, so it restates `keyIdx` — and a
        // wrong one there would move the key column out from under the label
        // that is already written.
        const bookId = rpc('newWorkbook') as number
        table(
            bookId,
            'rec',
            [{name: 'n', number: true}, {name: 'k'}, {name: 'm', number: true}],
            1,
            [
                ['10', 'x', '1'],
                ['20', 'y', '2'],
            ]
        )
        const client = clientFor(bookId)
        await createAnalysisBlock.handler(
            {source: 'rec', name: 'rec_total'},
            ctxFor(client)
        )
        await editAnalysisBlock.handler(
            {name: 'rec_total', aggregates: [{field: 'm', func: 'SUM'}]},
            ctxFor(client)
        )

        const a = blockNamed(bookId, 'rec_total')
        expect(a.schema.keyIdx).toBe(1)
        expect(cell(bookId, a.rowStart, a.colStart + 1)).toBe('TOTAL')
        expect(formula(bookId, '=BLOCKREF("rec_total","TOTAL","m")')).toBe(3)
    })
})
