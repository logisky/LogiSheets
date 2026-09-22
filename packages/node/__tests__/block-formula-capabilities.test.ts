import {describe, it, expect, beforeEach} from 'vitest'
import {handle} from '../wasm/logisheets_wasm_server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rpc(m: string, v?: Record<string, unknown>, b?: number): any {
    return handle(v === undefined ? m : {method: m, value: v}, b ?? null)
}
const tx = (payloads: unknown[], bookId: number) =>
    rpc(
        'handleTransaction',
        {transaction: {payloads, undoable: true, temp: false}},
        bookId
    )

const input = (row: number, col: number, content: string) => ({
    type: 'cellInput',
    value: {sheetIdx: 0, row, col, content},
})
const block = (
    id: number,
    masterRow: number,
    rowCnt: number,
    colCnt: number
) => ({
    type: 'createBlock',
    value: {sheetIdx: 0, id, masterRow, masterCol: 0, rowCnt, colCnt},
})
const bind = (
    id: number,
    refName: string,
    fields: {name: string; valueFormula?: string}[]
) => ({
    type: 'bindFormSchema',
    value: {
        refName,
        sheetIdx: 0,
        blockId: id,
        fieldFrom: 0,
        keyIdx: 0,
        row: true,
        fields: fields.map((f, i) => ({
            name: f.name,
            renderId: `${refName}${i}`,
            ...(f.valueFormula ? {valueFormula: f.valueFormula} : {}),
        })),
    },
})

// What a block field template may contain, and what it may not. The 四象 sheet
// (crafts/four-elements-core) is built on exactly these answers, and two of
// them are the opposite of what Excel would do — so they are pinned here rather
// than rediscovered.
describe('block formula capabilities', () => {
    let bookId: number
    beforeEach(() => {
        bookId = rpc('newWorkbook') as number
    })

    const cell = (row: number, col: number) => {
        const c = rpc('getCell', {sheetIdx: 0, row, col}, bookId)
        return c?.value?.value ?? c?.value
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ok = (e: any) => {
        if (e?.status?.type !== 'ok')
            throw new Error(e?.errorMessage ?? JSON.stringify(e))
    }

    /** A 2-row lookup table `tier`, keys written BEFORE the schema binds. */
    function lookup() {
        return [
            block(1, 0, 2, 2),
            input(0, 0, '1'),
            input(0, 1, '10'),
            input(1, 0, '2'),
            input(1, 1, '20'),
            bind(1, 'tier', [{name: 'n'}, {name: 'v'}]),
        ]
    }

    it('resolves #KEY against keys written after the schema binds', () => {
        // Same table, but bound while the key column is still blank.
        ok(
            tx(
                [
                    block(1, 0, 2, 2),
                    bind(1, 'tier', [{name: 'n'}, {name: 'v'}]),
                    input(0, 0, '1'),
                    input(0, 1, '10'),
                    block(2, 6, 1, 2),
                    input(6, 0, '1'),
                    bind(2, 'probe', [
                        {name: 'n'},
                        {name: 'x', valueFormula: '=BLOCKREF("tier",#KEY,"v")'},
                    ]),
                ],
                bookId
            )
        )
        expect(cell(6, 1)).toBe(10)
    })

    it('#KEY works as a BLOCKREF key', () => {
        ok(
            tx(
                [
                    ...lookup(),
                    block(2, 6, 1, 2),
                    input(6, 0, '1'),
                    bind(2, 'probe', [
                        {name: 'n'},
                        {name: 'x', valueFormula: '=BLOCKREF("tier",#KEY,"v")'},
                    ]),
                ],
                bookId
            )
        )
        expect(cell(6, 1)).toBe(10)
    })

    it('#KEY+1 works as a BLOCKREF key', () => {
        ok(
            tx(
                [
                    ...lookup(),
                    block(2, 6, 1, 2),
                    input(6, 0, '1'),
                    bind(2, 'probe', [
                        {name: 'n'},
                        {
                            name: 'x',
                            valueFormula: '=BLOCKREF("tier",#KEY+1,"v")',
                        },
                    ]),
                ],
                bookId
            )
        )
        expect(cell(6, 1)).toBe(20)
    })

    it('#FIELD works as a BLOCKREF key', () => {
        ok(
            tx(
                [
                    ...lookup(),
                    block(2, 6, 1, 3),
                    input(6, 0, 'r'),
                    input(6, 1, '2'),
                    bind(2, 'probe', [
                        {name: 'n'},
                        {name: 'which'},
                        {
                            name: 'x',
                            valueFormula:
                                '=BLOCKREF("tier",#FIELD("which"),"v")',
                        },
                    ]),
                ],
                bookId
            )
        )
        expect(cell(6, 2)).toBe(20)
    })

    it('a CONCATENATED key works — the 2-D lookup without a 2-D table', () => {
        ok(
            tx(
                [
                    // counter as a flat list: key "fire>wind" → 1
                    block(1, 0, 2, 2),
                    input(0, 0, 'fire>wind'),
                    input(0, 1, '1'),
                    input(1, 0, 'wind>fire'),
                    input(1, 1, '0'),
                    bind(1, 'counter', [{name: 'pair'}, {name: 'pts'}]),
                    block(2, 6, 1, 4),
                    input(6, 0, '1'),
                    input(6, 1, 'fire'),
                    input(6, 2, 'wind'),
                    bind(2, 'play', [
                        {name: 'slot'},
                        {name: 'you'},
                        {name: 'ai'},
                        {
                            name: 'pts',
                            valueFormula:
                                '=BLOCKREF("counter",#FIELD("you")&">"&#FIELD("ai"),"pts")',
                        },
                    ]),
                ],
                bookId
            )
        )
        expect(cell(6, 3)).toBe(1)
    })

    // The one that fails. It is why `counter` is a flat list keyed "fire>wind"
    // instead of the 4x4 matrix the design first assumed.
    it('REJECTS a dynamic field name in BLOCKREF', () => {
        ok(
            tx(
                [
                    block(1, 0, 2, 3),
                    input(0, 0, 'fire'),
                    input(0, 1, '0'),
                    input(0, 2, '1'),
                    input(1, 0, 'wind'),
                    input(1, 1, '0'),
                    input(1, 2, '0'),
                    bind(1, 'matrix', [
                        {name: 'e'},
                        {name: 'fire'},
                        {name: 'wind'},
                    ]),
                    block(2, 6, 1, 4),
                    input(6, 0, '1'),
                    input(6, 1, 'fire'),
                    input(6, 2, 'wind'),
                    bind(2, 'play2', [
                        {name: 'slot'},
                        {name: 'you'},
                        {name: 'ai'},
                        {
                            name: 'pts',
                            valueFormula:
                                '=BLOCKREF("matrix",#FIELD("you"),#FIELD("ai"))',
                        },
                    ]),
                ],
                bookId
            )
        )
        expect(cell(6, 3)).toBe('#NAME?')
    })

    it('COUNTIF / SUM over a BLOCKREFS column', () => {
        ok(
            tx(
                [
                    block(1, 0, 2, 2),
                    input(0, 0, '1'),
                    input(0, 1, 'fire'),
                    input(1, 0, '2'),
                    input(1, 1, 'wind'),
                    bind(1, 'play', [{name: 'slot'}, {name: 'you'}]),
                    input(
                        20,
                        0,
                        '=COUNTIF(BLOCKREFS("play","*","you"),"fire")'
                    ),
                    input(21, 0, '=COUNTA(BLOCKREFS("play","*","you"))'),
                ],
                bookId
            )
        )
        expect(cell(20, 0)).toBe(1)
        expect(cell(21, 0)).toBe(2)
    })
})

describe('empty cells and error propagation', () => {
    let bookId: number
    beforeEach(() => {
        bookId = rpc('newWorkbook') as number
    })
    const cell = (row: number, col: number) => {
        const c = rpc('getCell', {sheetIdx: 0, row, col}, bookId)
        return c?.value?.value ?? c?.value
    }

    it('reads an empty cell through BLOCKREF as #VALUE!, not blank', () => {
        tx(
            [
                block(1, 0, 2, 2),
                input(0, 0, '1'),
                input(1, 0, '2'),
                bind(1, 'play', [{name: 'slot'}, {name: 'you'}]),
                input(20, 0, '=BLOCKREF("play",1,"you")'),
                input(21, 0, '=IFERROR(BLOCKREF("play",1,"you"),"")'),
            ],
            bookId
        )
        expect(cell(20, 0)).toBe('#VALUE!')
        expect(cell(21, 0)).toBe('')
    })

    // IF itself is lazy, as in Excel. The trap is upstream: a helper column
    // that read an empty cell is already an error, and comparing it in the
    // CONDITION propagates before the branch is ever chosen. Guard where the
    // value is read, not where it is used.
    it('short-circuits IF, but propagates an error in the condition', () => {
        tx(
            [
                block(1, 0, 1, 2),
                input(0, 0, '1'),
                bind(1, 'play', [{name: 'slot'}, {name: 'you'}]),
                input(20, 0, '=IF(TRUE,0,BLOCKREF("play",1,"you"))'),
                input(21, 0, '=IF(BLOCKREF("play",1,"you")="",0,1)'),
                input(
                    22,
                    0,
                    '=IF(IFERROR(BLOCKREF("play",1,"you"),"")="",0,1)'
                ),
            ],
            bookId
        )
        expect(cell(20, 0)).toBe(0) // untaken branch never evaluated
        expect(cell(21, 0)).toBe('#VALUE!') // the condition itself errored
        expect(cell(22, 0)).toBe(0) // guarded at the read
    })
})
