import {describe, it, expect, beforeEach} from 'vitest'
import {handle} from '../wasm/logisheets_wasm_server'
import {
    BLOCKS,
    DRAFT_ROUNDS,
    ELEMENTS,
    OFFER,
} from '../../../crafts/four-elements-core/src/sheet'

const DECK_SIZE = DRAFT_ROUNDS * OFFER
import {
    PLACEMENT,
    cellOf,
    colWidths,
    setupPayloads,
    shufflePayloads,
} from '../../../crafts/four-elements-core/src/setup'
import {fieldLabel} from '../../../crafts/four-elements-core/src/i18n'

// Step 1 of design/four-elements-game.md: build the sheet in a real workbook
// and check it against hand-worked boards. No craft, no AI — if the scoring or
// the turn order is wrong, it is wrong here.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rpc(m: string, v?: Record<string, unknown>, b?: number): any {
    return handle(v === undefined ? m : {method: m, value: v}, b ?? null)
}

describe('the 四象 sheet', () => {
    let bookId: number

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tx = (payloads: unknown[]) => {
        const e = rpc(
            'handleTransaction',
            {transaction: {payloads, undoable: true, temp: false}},
            bookId
        )
        if (e?.status?.type !== 'ok')
            throw new Error(e?.errorMessage ?? JSON.stringify(e))
        return e
    }

    /** Read one field of one row, by name — never by coordinate. */
    function read(ref: string, key: string | number, field: string) {
        const {row, col} = cellOf(ref, key, field)
        const c = rpc('getCell', {sheetIdx: 0, row, col}, bookId)
        return c?.value?.value ?? c?.value
    }

    function write(
        ref: string,
        key: string | number,
        field: string,
        v: string
    ) {
        const {row, col} = cellOf(ref, key, field)
        tx([{type: 'cellInput', value: {sheetIdx: 0, row, col, content: v}}])
    }

    /** Fill both lines at once, as a hand-worked board. */
    function board(you: string[], ai: string[]) {
        const payloads: unknown[] = []
        you.forEach((card, i) => {
            const put = (side: 'you' | 'ai', c: string) => {
                const {row, col} = cellOf('play', i + 1, side)
                payloads.push({
                    type: 'cellInput',
                    value: {sheetIdx: 0, row, col, content: c},
                })
            }
            if (card) put('you', card)
            if (ai[i]) put('ai', ai[i])
        })
        tx(payloads)
    }

    const totals = () => ({
        you: read('score', 's', 'youTotal'),
        ai: read('score', 's', 'aiTotal'),
    })

    beforeEach(() => {
        bookId = rpc('newWorkbook') as number
        tx(setupPayloads(0))
    })

    it('builds every block without an engine rejection', () => {
        expect(read('counter', 'fire>wind', 'pts')).toBe(1)
        expect(read('formation', 'triple', 'value')).toBe(6)
        expect(read('knob', 'cancelKeep', 'value')).toBe(0)
    })

    describe('card scoring', () => {
        it('gives a point for a beat and nothing for a neutral pair', () => {
            board(['fire', 'fire', '', '', ''], ['wind', 'earth', '', '', ''])
            expect(read('play', 1, 'youPts')).toBe(1) // fire beats wind
            expect(read('play', 2, 'youPts')).toBe(0) // fire vs earth: neutral
            expect(read('play', 1, 'aiPts')).toBe(0)
        })

        it('scores an empty slot as zero rather than erroring', () => {
            expect(read('play', 3, 'youPts')).toBe(0)
        })
    })

    describe('formations', () => {
        const shapeOf = (you: string[]) => {
            board(you, ['', '', '', '', ''])
            return read('window', 1, 'youShape')
        }

        it('reads three of a kind as a triple', () => {
            expect(shapeOf(['fire', 'fire', 'fire', '', ''])).toBe('triple')
        })

        it('reads a b a as a split', () => {
            expect(shapeOf(['fire', 'wind', 'fire', '', ''])).toBe('split')
        })

        it('reads a run down the counter cycle as a chain', () => {
            expect(shapeOf(['fire', 'wind', 'earth', '', ''])).toBe('chain')
        })

        it('reads three unrelated cards as nothing', () => {
            expect(shapeOf(['fire', 'earth', 'wind', '', ''])).toBe('none')
        })

        it('reads an unfinished window as nothing', () => {
            expect(shapeOf(['fire', 'fire', '', '', ''])).toBe('none')
        })
    })

    describe('cancellation', () => {
        it('lets a split kill a triple and keep its own two points', () => {
            board(
                ['fire', 'fire', 'fire', '', ''],
                ['wind', 'fire', 'wind', '', '']
            )
            expect(read('window', 1, 'youShape')).toBe('triple')
            expect(read('window', 1, 'aiShape')).toBe('split')
            expect(read('window', 1, 'youScore')).toBe(0)
            expect(read('window', 1, 'aiScore')).toBe(2)
        })

        it('leaves an uncontested formation whole', () => {
            board(['fire', 'fire', 'fire', '', ''], ['', '', '', '', ''])
            expect(read('window', 1, 'youScore')).toBe(6)
        })

        it('lets both keep their value when the shapes match', () => {
            board(
                ['fire', 'fire', 'fire', '', ''],
                ['water', 'water', 'water', '', '']
            )
            expect(read('window', 1, 'youScore')).toBe(6)
            expect(read('window', 1, 'aiScore')).toBe(6)
        })
    })

    describe('the runaway line loses — the mechanic doing its job', () => {
        it('scores five-of-a-kind 3 against the cheapest answer 6', () => {
            board(
                ['fire', 'fire', 'fire', 'fire', 'fire'],
                ['wind', 'fire', 'wind', 'fire', 'wind']
            )
            expect(totals()).toEqual({you: 3, ai: 6})
        })
    })

    describe('the knobs', () => {
        it('halves a cancelled formation when cancelKeep says so', () => {
            board(
                ['fire', 'fire', 'fire', '', ''],
                ['wind', 'fire', 'wind', '', '']
            )
            expect(read('window', 1, 'youScore')).toBe(0)
            write('knob', 'cancelKeep', 'value', '0.5')
            expect(read('window', 1, 'youScore')).toBe(3)
        })

        it('resolves same-shape windows by element when the toggle is on', () => {
            board(
                ['fire', 'fire', 'fire', '', ''],
                ['water', 'water', 'water', '', '']
            )
            expect(read('window', 1, 'youScore')).toBe(6)
            write('knob', 'byElement', 'value', '1')
            // water beats fire, so the fire triple dies and the water one lives
            expect(read('window', 1, 'youScore')).toBe(0)
            expect(read('window', 1, 'aiScore')).toBe(6)
        })

        it('re-reads what a chain is when the counter cycle is edited', () => {
            board(['fire', 'wind', 'earth', '', ''], ['', '', '', '', ''])
            expect(read('window', 1, 'youShape')).toBe('chain')
            // Break the cycle: fire no longer beats wind.
            write('counter', 'fire>wind', 'pts', '0')
            expect(read('window', 1, 'youShape')).toBe('none')
        })
    })

    describe('turn order', () => {
        it('starts in the draft with the player to move', () => {
            expect(read('turn', 't', 'phase')).toBe('draft')
            expect(read('turn', 't', 'toMove')).toBe('you')
            expect(read('turn', 't', 'round')).toBe(1)
        })

        it('passes to the AI once the player has picked', () => {
            write('draft', 1, 'youPick', 'fire')
            expect(read('turn', 't', 'toMove')).toBe('ai')
            expect(read('turn', 't', 'round')).toBe(1)
        })

        it('moves to the next round once both have picked', () => {
            write('draft', 1, 'youPick', 'fire')
            write('draft', 1, 'aiPick', 'wind')
            expect(read('turn', 't', 'toMove')).toBe('you')
            expect(read('turn', 't', 'round')).toBe(2)
        })

        it('enters the play phase with the AI leading, after ten picks', () => {
            for (let r = 1; r <= 5; r++) {
                write('draft', r, 'youPick', 'fire')
                write('draft', r, 'aiPick', 'wind')
            }
            expect(read('turn', 't', 'phase')).toBe('play')
            expect(read('turn', 't', 'toMove')).toBe('ai')
            expect(read('turn', 't', 'nextSlot')).toBe(1)
        })

        it('alternates within the play phase and names the next slot', () => {
            for (let r = 1; r <= 5; r++) {
                write('draft', r, 'youPick', 'fire')
                write('draft', r, 'aiPick', 'wind')
            }
            write('play', 1, 'ai', 'wind')
            expect(read('turn', 't', 'toMove')).toBe('you')
            expect(read('turn', 't', 'nextSlot')).toBe(1)
            write('play', 1, 'you', 'fire')
            expect(read('turn', 't', 'toMove')).toBe('ai')
            expect(read('turn', 't', 'nextSlot')).toBe(2)
        })

        it('ends after ten plays', () => {
            for (let r = 1; r <= 5; r++) {
                write('draft', r, 'youPick', 'fire')
                write('draft', r, 'aiPick', 'wind')
            }
            board(
                ['fire', 'fire', 'fire', 'fire', 'fire'],
                ['wind', 'wind', 'wind', 'wind', 'wind']
            )
            expect(read('turn', 't', 'phase')).toBe('done')
        })
    })

    describe('hands', () => {
        it('counts what was drafted, less what has been committed', () => {
            write('draft', 1, 'youPick', 'fire')
            write('draft', 2, 'youPick', 'fire')
            write('draft', 3, 'youPick', 'water')
            expect(read('hand', 'fire', 'you')).toBe(2)
            expect(read('hand', 'water', 'you')).toBe(1)
            expect(read('hand', 'wind', 'you')).toBe(0)
            write('play', 1, 'you', 'fire')
            expect(read('hand', 'fire', 'you')).toBe(1)
        })
    })

    describe('the draft offer derives from the deck', () => {
        it('reveals three cards per round, in deck order', () => {
            const cards = ['fire', 'wind', 'earth', 'water', 'fire', 'wind']
            tx(
                cards.map((c, i) => {
                    const {row, col} = cellOf('deck', i + 1, 'card')
                    return {
                        type: 'cellInput',
                        value: {sheetIdx: 0, row, col, content: c},
                    }
                })
            )
            expect(read('draft', 1, 'offer1')).toBe('fire')
            expect(read('draft', 1, 'offer2')).toBe('wind')
            expect(read('draft', 1, 'offer3')).toBe('earth')
            expect(read('draft', 2, 'offer1')).toBe('water')
        })
    })

    describe('the shuffle', () => {
        it('deals as even a mix as 15 cards over 4 elements allows', () => {
            tx(shufflePayloads(0, ELEMENTS, DECK_SIZE, mulberry(7)))
            const dealt = Array.from({length: DECK_SIZE}, (_, i) =>
                read('deck', i + 1, 'card')
            )
            const counts = ELEMENTS.map(
                (e) => dealt.filter((c) => c === e).length
            )
            expect(counts.reduce((a, b) => a + b)).toBe(DECK_SIZE)
            expect(
                Math.max(...counts) - Math.min(...counts)
            ).toBeLessThanOrEqual(1)
        })

        it('is a shuffle, not the pool in order', () => {
            tx(shufflePayloads(0, ELEMENTS, DECK_SIZE, mulberry(7)))
            const dealt = Array.from({length: DECK_SIZE}, (_, i) =>
                read('deck', i + 1, 'card')
            )
            expect(dealt.join()).not.toBe(
                Array.from(
                    {length: DECK_SIZE},
                    (_, i) => ELEMENTS[i % ELEMENTS.length]
                ).join()
            )
        })
    })

    // The point of step 2: drive a whole game the way the craft will — read
    // `turn`, write one cell, never compute anything.
    describe('a game driven only by turn + one write', () => {
        it('plays to done and settles on a score', () => {
            tx(shufflePayloads(0, ELEMENTS, DECK_SIZE, mulberry(3)))

            let guard = 0
            while (read('turn', 't', 'phase') !== 'done') {
                if (guard++ > 40) throw new Error('game did not terminate')
                const phase = read('turn', 't', 'phase')
                const who = read('turn', 't', 'toMove') as 'you' | 'ai'
                if (phase === 'draft') {
                    const round = read('turn', 't', 'round') as number
                    // Take the first offer nobody has taken this round.
                    const taken = read('draft', round, 'youPick')
                    const offer = [1, 2, 3]
                        .map((n) => read('draft', round, `offer${n}`))
                        .find((c) => c !== taken)
                    write('draft', round, `${who}Pick`, String(offer))
                } else {
                    const slot = read('turn', 't', 'nextSlot') as number
                    // Any card still in hand.
                    const card = ELEMENTS.find(
                        (e) => (read('hand', e, who) as number) > 0
                    )
                    expect(card).toBeDefined()
                    write('play', slot, who, String(card))
                }
            }

            expect(read('turn', 't', 'phase')).toBe('done')
            for (const e of ELEMENTS) {
                expect(read('hand', e, 'you')).toBe(0)
                expect(read('hand', e, 'ai')).toBe(0)
            }
            const {you, ai} = totals()
            expect(typeof you).toBe('number')
            expect(typeof ai).toBe('number')
            // Cards cap at 5 a side, formations at 3 windows x 6.
            expect(you).toBeGreaterThanOrEqual(0)
            expect(you).toBeLessThanOrEqual(23)
            expect(ai).toBeLessThanOrEqual(23)
        })
    })
})

/** A seeded PRNG, so a shuffle assertion is not a coin flip in CI. */
function mulberry(seed: number): () => number {
    let a = seed
    return () => {
        a |= 0
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

// The stored formula cannot name what it reads: the engine forbids a
// self-block BLOCKREF and materialises `#FIELD("x")` into a bare `(B90)`.
// Prose is therefore the only thing standing between a reader and A1, which
// makes it load-bearing rather than a nicety.
describe('the sheet explains itself', () => {
    let bookId: number

    beforeEach(() => {
        bookId = rpc('newWorkbook') as number
        const e = rpc(
            'handleTransaction',
            {
                transaction: {
                    payloads: setupPayloads(0),
                    undoable: true,
                    temp: false,
                },
            },
            bookId
        )
        if (e?.status?.type !== 'ok')
            throw new Error(e?.errorMessage ?? JSON.stringify(e))
    })

    const infoOf = (blockId: number) =>
        rpc('getBlockInfo', {sheetId: 0, blockId}, bookId)

    // A column whose name only exists in the schema is named only while the
    // pointer is on the block — and the chrome that names it is drawn ABOVE
    // the block, so on a tall table you hover the middle and get nothing.
    it('names every column on the sheet, not only in the schema', () => {
        BLOCKS.forEach((b, i) => {
            const info = infoOf(i + 1)
            expect(info.schema.headerIdx, `block ${b.ref}`).toBe(0)
            b.fields.forEach((f, ci) => {
                const cell = rpc(
                    'getCell',
                    {sheetIdx: 0, row: info.rowStart, col: ci},
                    bookId
                )
                // The header says the LABEL; the schema keeps the NAME. They
                // are deliberately two things, which is what lets the sheet
                // change language without a formula moving.
                expect(cell?.value?.value, `${b.ref} header col ${ci}`).toBe(
                    fieldLabel(f.name, 'en')
                )
                expect(
                    info.schema.fields.find(
                        (e: {field: string}) => e.field === f.name
                    ),
                    `${b.ref}.${f.name} keeps its schema name`
                ).toBeDefined()
            })
        })
    })

    it('does not let the header line count as a record', () => {
        // `hand` counts picks off `draft` through BLOCKREFS; a header counted
        // as a record would show up as a phantom card.
        const at = (ref: string, key: string | number, field: string) => {
            const {row, col} = cellOf(ref, key, field)
            return rpc('getCell', {sheetIdx: 0, row, col}, bookId)?.value?.value
        }
        const total = ELEMENTS.reduce(
            (n, e) => n + Number(at('hand', e, 'you') ?? 0),
            0
        )
        expect(total).toBe(0)
        expect(at('turn', 't', 'youPicks')).toBe(0)
    })

    it('makes the header line read as a heading', () => {
        BLOCKS.forEach((b, i) => {
            const info = infoOf(i + 1)
            b.fields.forEach((f, ci) => {
                const cell = rpc(
                    'getCell',
                    {sheetIdx: 0, row: info.rowStart, col: ci},
                    bookId
                )
                expect(cell?.style?.font?.bold, `${b.ref}.${f.name}`).toBe(true)
            })
        })
    })

    // Columns belong to the SHEET, so column A carries `byElement`
    // from `knob` and `water>water` from `counter` at once. Too narrow and the
    // names the header line exists to show are the first thing clipped.
    it('makes every column wide enough for the widest thing in it', () => {
        const widths = colWidths()
        BLOCKS.forEach((b) => {
            b.fields.forEach((f, ci) => {
                expect(widths[ci], `${b.ref}.${f.name}`).toBeGreaterThanOrEqual(
                    f.name.length
                )
            })
            b.rows.forEach((r) =>
                r.forEach((v, ci) => {
                    expect(
                        widths[ci],
                        `${b.ref} value "${v}"`
                    ).toBeGreaterThanOrEqual(String(v).length)
                })
            )
        })
    })

    // A constant with no test is a constant that silently reverts.
    it('leaves the block chrome room between stacked blocks', () => {
        // The hover header hangs 72px above a block (title bar + field names)
        // and the add-row handle ~30px below. At the default 20px row that is
        // a bit over five rows. Any tighter and a block's overlay covers its
        // neighbour's body and, taking pointer events, swallows its hover.
        const MIN_GAP_ROWS = 5
        const stacked = [...PLACEMENT.entries()].sort(
            (a, b) => a[1].row - b[1].row
        )
        // The first block needs it too, or its header is clipped away against
        // the column-header row and never appears at all.
        expect(stacked[0][1].row).toBeGreaterThanOrEqual(MIN_GAP_ROWS)
        for (let i = 1; i < stacked.length; i++) {
            const [prevRef, prev] = stacked[i - 1]
            const rows = BLOCKS.find((b) => b.ref === prevRef)!.rows.length
            const gap = stacked[i][1].row - (prev.row + rows)
            expect(
                gap,
                `${prevRef} \u2192 ${stacked[i][0]}`
            ).toBeGreaterThanOrEqual(MIN_GAP_ROWS)
        }
    })

    it('gives every block a description', () => {
        BLOCKS.forEach((b, i) => {
            const info = infoOf(i + 1)
            expect(info.msg, `block ${b.ref}`).toBeUndefined()
            expect(info.description, `block ${b.ref}`).toBe(b.description)
            expect(info.description.length, `block ${b.ref}`).toBeGreaterThan(
                20
            )
        })
    })

    it('keeps the readable template on the schema, not just the A1 formula', () => {
        const i = BLOCKS.findIndex((b) => b.ref === 'window')
        const fields = infoOf(i + 1).schema.fields
        const shape = fields.find(
            (e: {field: string}) => e.field === 'youShape'
        )
        // What a reader should be shown. The cell's own formula is this with
        // `#FIELD` already flattened to `(B90)`.
        expect(shape.valueFormula).toContain('#FIELD("you1")')
        expect(shape.valueFormula).toContain('BLOCKREF("counter"')
    })

    it('describes every computed field, where A1 would otherwise be all there is', () => {
        BLOCKS.forEach((b, i) => {
            const fields = infoOf(i + 1).schema.fields
            b.fields.forEach((f, fi) => {
                if (!f.valueFormula) return
                const entry = fields.find(
                    (e: {field: string}) => e.field === f.name
                )
                expect(entry, `${b.ref}.${f.name}`).toBeDefined()
                expect(entry.description, `${b.ref}.${f.name}`).toBe(
                    f.description
                )
                expect(
                    (entry.description ?? '').length,
                    `${b.ref}.${f.name}`
                ).toBeGreaterThan(10)
            })
        })
    })
})
