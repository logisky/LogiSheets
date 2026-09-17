/**
 * The analysis-block TOOLS — `build__create_analysis_block`,
 * `build__edit_analysis_block` — against the REAL engine.
 *
 * `block-analysis.test.ts` next door drives the same engine with hand-built
 * payloads and `WorkbookOps`, which proves the declarations survive the wasm
 * boundary. It only ever asks for SUM, and it never goes through the tools.
 *
 * What is left, and what these cover, is the part a model actually exercises:
 * every aggregate the tool offers, the number format that comes with it, and
 * what happens to a block afterwards — the source shrinking under it, an undo,
 * a second analysis beside it, somebody typing over a computed cell.
 */
import {describe, it, expect, beforeEach} from 'vitest'
import type {Client} from 'logisheets-web/pure'
import {handle} from '../wasm/logisheets_wasm_server'
import {
    createAnalysisBlock,
    editAnalysisBlock,
    describeBlock,
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

interface Block {
    blockId: number
    rowStart: number
    colStart: number
    analyzedBy: readonly number[]
    fieldRenders?: ReadonlyArray<{
        renderId: string
        style?: {formatter?: string}
    }>
    schema?: {name: string; fields: ReadonlyArray<{renderId: string}>}
}

function blocks(bookId: number): Block[] {
    return rpc('getAllBlocks', {}, bookId) as Block[]
}

function byName(bookId: number, name: string): Block {
    const b = blocks(bookId).find((x) => x.schema?.name === name)
    expect(b, `a block named ${name}`).toBeDefined()
    return b!
}

function commit(
    bookId: number,
    payloads: ReadonlyArray<Record<string, unknown>>
) {
    return rpc(
        'handleTransaction',
        {transaction: {payloads, undoable: true, temp: false}},
        bookId
    )
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

const CURRENCY = '"$"#,##0.00'

/**
 * `orders` — `amt` is money (so it carries a number format worth inheriting),
 * `note` has a BLANK in the middle (so COUNT and COUNTA can disagree), `rate`
 * is a second number (so an aggregate can name a column other than the first).
 */
const ROWS: ReadonlyArray<readonly [string, string, string, string]> = [
    ['k0', '10', 'a', '1.5'],
    ['k1', '20', '', '2.5'],
    ['k2', '30', 'c', '3.5'],
]

function orders(bookId: number): number {
    const id = rpc('getAvailableBlockId', {sheetIdx: 0}, bookId) as number
    const eff = commit(bookId, [
        {
            type: 'createBlock',
            value: {
                sheetIdx: 0,
                id,
                masterRow: 0,
                masterCol: 0,
                rowCnt: ROWS.length,
                colCnt: 4,
            },
        },
        {
            type: 'bindFormSchema',
            value: {
                refName: 'orders',
                sheetIdx: 0,
                blockId: id,
                fieldFrom: 0,
                keyIdx: 0,
                row: true,
                fields: [
                    {name: 'key', renderId: 'o0'},
                    {name: 'amt', renderId: 'o1', fieldType: {kind: 'number'}},
                    {name: 'note', renderId: 'o2'},
                    {name: 'rate', renderId: 'o3', fieldType: {kind: 'number'}},
                ],
            },
        },
        {
            type: 'upsertFieldRenderInfo',
            value: {
                renderId: 'o1',
                diyRender: false,
                styleUpdate: {setNumFmt: CURRENCY},
            },
        },
        ...ROWS.flatMap((r, y) =>
            r.map((v, x) => ({
                type: 'cellInput',
                value: {sheetIdx: 0, row: y, col: x, content: v},
            }))
        ),
    ])
    expect(eff.status.type, eff.errorMessage).toBe('ok')
    return id
}

describe('every aggregate the tool offers, computed by the engine', () => {
    let bookId: number
    let client: Client

    beforeEach(() => {
        bookId = rpc('newWorkbook') as number
        orders(bookId)
        client = clientFor(bookId)
    })

    /** The analysis row's cell under the source column at `col`. */
    const at = (col: number) => {
        const a = byName(bookId, 'agg')
        return cell(bookId, a.rowStart, a.colStart + col)
    }

    it('computes each one, and says so', async () => {
        // One block asking three different questions of three columns — the
        // combination a model reaches for, and the one that catches an
        // aggregate being applied to the wrong column.
        const r = await createAnalysisBlock.handler(
            {
                source: 'orders',
                name: 'agg',
                aggregates: [
                    {field: 'amt', func: 'AVERAGE'},
                    {field: 'note', func: 'COUNTA'},
                    {field: 'rate', func: 'MAX'},
                ],
            },
            ctxFor(client)
        )
        expect(r.data.aggregated).toEqual([
            'AVERAGE of amt',
            'COUNTA of note',
            'MAX of rate',
        ])
        expect(at(1)).toBe(20) // (10 + 20 + 30) / 3
        expect(at(2)).toBe(2) // three records, one blank note
        expect(at(3)).toBe(3.5)
    })

    it('swaps between them without rebuilding the block', async () => {
        await createAnalysisBlock.handler(
            {
                source: 'orders',
                name: 'agg',
                aggregates: [{field: 'amt', func: 'SUM'}],
            },
            ctxFor(client)
        )
        const blockId = byName(bookId, 'agg').blockId

        for (const [func, want] of [
            ['SUM', 60],
            ['AVERAGE', 20],
            ['COUNT', 3],
            ['MIN', 10],
            ['MAX', 30],
        ] as const) {
            await editAnalysisBlock.handler(
                {name: 'agg', aggregates: [{field: 'amt', func}]},
                ctxFor(client)
            )
            expect(at(1), `${func} of amt`).toBe(want)
        }
        // An edit is a re-bind, never a rebuild: the block, and therefore
        // every formula pointing at it, is the same one throughout.
        expect(byName(bookId, 'agg').blockId).toBe(blockId)
    })

    it('separates COUNT from COUNTA on the same column', async () => {
        // COUNT answers "how many records", COUNTA "how many are filled in".
        // The two differ only when something is blank, which is exactly when
        // somebody is relying on the difference.
        await createAnalysisBlock.handler(
            {
                source: 'orders',
                name: 'agg',
                aggregates: [{field: 'note', func: 'COUNT'}],
            },
            ctxFor(client)
        )
        // `note` holds text, so COUNT — which counts NUMBERS — finds none.
        expect(at(2)).toBe(0)

        await editAnalysisBlock.handler(
            {name: 'agg', aggregates: [{field: 'note', func: 'COUNTA'}]},
            ctxFor(client)
        )
        expect(at(2)).toBe(2)
    })
})

describe('an analysis block carries the format of what it aggregates', () => {
    let bookId: number
    let client: Client

    beforeEach(() => {
        bookId = rpc('newWorkbook') as number
        orders(bookId)
        client = clientFor(bookId)
    })

    /** The number format the block's own render entry gives column `col`. */
    const fmtAt = (col: number) => {
        const a = byName(bookId, 'agg')
        const renderId = a.schema!.fields[col].renderId
        return a.fieldRenders?.find((r) => r.renderId === renderId)?.style
            ?.formatter
    }

    it('inherits currency for a total, and follows the FUNCTION across an edit', async () => {
        // A total of money is money; a COUNT of money is a number of records
        // and must not read as $3.00. The distinction lives in
        // `aggregateKeepsFormat`, and an edit has to re-apply it — the format
        // belongs to the function in force, not to the column.
        await createAnalysisBlock.handler(
            {
                source: 'orders',
                name: 'agg',
                aggregates: [{field: 'amt', func: 'SUM'}],
            },
            ctxFor(client)
        )
        expect(fmtAt(1)).toBe(CURRENCY)

        await editAnalysisBlock.handler(
            {name: 'agg', aggregates: [{field: 'amt', func: 'COUNT'}]},
            ctxFor(client)
        )
        expect(fmtAt(1), 'a count of money is not money').toBeFalsy()

        await editAnalysisBlock.handler(
            {name: 'agg', aggregates: [{field: 'amt', func: 'SUM'}]},
            ctxFor(client)
        )
        expect(fmtAt(1), 'and it comes back').toBe(CURRENCY)
    })

    it('leaves the label column plain', async () => {
        await createAnalysisBlock.handler(
            {
                source: 'orders',
                name: 'agg',
                aggregates: [{field: 'amt', func: 'SUM'}],
            },
            ctxFor(client)
        )
        expect(fmtAt(0)).toBeFalsy()
    })
})

describe('an analysis block after the fact', () => {
    let bookId: number
    let src: number
    let client: Client

    beforeEach(async () => {
        bookId = rpc('newWorkbook') as number
        src = orders(bookId)
        client = clientFor(bookId)
        await createAnalysisBlock.handler(
            {
                source: 'orders',
                name: 'agg',
                aggregates: [{field: 'amt', func: 'SUM'}],
            },
            ctxFor(client)
        )
    })

    const total = () => {
        const a = byName(bookId, 'agg')
        return cell(bookId, a.rowStart, a.colStart + 1)
    }

    it('follows the source SHRINKING', async () => {
        // The growth case is covered next door. A shrink is the one that can
        // leave a total counting a row that is no longer there.
        expect(total()).toBe(60)
        const eff = commit(bookId, [
            {
                type: 'deleteRowsInBlock',
                value: {sheetIdx: 0, blockId: src, start: 2, cnt: 1},
            },
        ])
        expect(eff.status.type, eff.errorMessage).toBe('ok')
        expect(total()).toBe(30)
    })

    it('cannot be typed over', async () => {
        // The cells are generated from a declaration, so a value written into
        // one is not an edit — it is a value the next calculation discards.
        // Worth pinning either way: whatever the engine decides to do with the
        // write, the cell must still show the aggregate.
        const a = byName(bookId, 'agg')
        commit(bookId, [
            {
                type: 'cellInput',
                value: {
                    sheetIdx: 0,
                    row: a.rowStart,
                    col: a.colStart + 1,
                    content: '999',
                },
            },
        ])
        expect(total()).toBe(60)
    })

    it('comes and goes in ONE undo', async () => {
        // The tool makes room, creates the block, binds it, writes the label
        // and sets the formats in a single transaction — so undoing it is one
        // step, not five, and the source is untouched.
        expect(blocks(bookId).map((b) => b.blockId)).toHaveLength(2)
        expect(rpc('undo', undefined, bookId)).toBe(true)
        expect(blocks(bookId).map((b) => b.blockId)).toEqual([src])
        expect(cell(bookId, 0, 1)).toBe(10)
    })

    it('shares its source with a second analysis', async () => {
        // Two questions about one table. Each is its own block with its own
        // ref name, and the source reports both.
        await createAnalysisBlock.handler(
            {
                source: 'orders',
                name: 'peak',
                aggregates: [{field: 'amt', func: 'MAX'}],
            },
            ctxFor(client)
        )
        const peak = byName(bookId, 'peak')
        expect(total()).toBe(60)
        expect(cell(bookId, peak.rowStart, peak.colStart + 1)).toBe(30)

        const d = await describeBlock.handler({name: 'orders'}, ctxFor(client))
        expect(d.data.analyzed_by).toEqual(['agg', 'peak'])
        // And neither counts the other: an analysis block is not a record of
        // the table it sits under.
        expect(total()).not.toBe(90)
    })
})
