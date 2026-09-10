// debugger craft — pure, host-agnostic payload builders.
//
// A dev tool. Building a block by hand — composer dialog, nine fields, a
// hundred rows of plausible data — takes minutes, and you need one every time
// you want to look at sorting, validation markers, pivots or a schema change.
// This turns that into a button.
//
// Everything here is a pure function returning `Payload[]`; the DOM and the
// `window.workbook` calls live in index.html. That split is the same one every
// other craft uses, and it is what lets these be reasoned about without a
// host: given the same options they produce the same payloads.
//
// Registered `devOnly` in crafts.config.json, so the panel offers it under
// `vite` (dev) and no production build ships it.

import {isErrorMessage} from 'logisheets-web'
import type {EditPayload, ErrorMessage, Transaction} from 'logisheets-web'

/**
 * Re-exported for index.html, which is plain script — no bundler, no imports.
 *
 * Every read on the client returns `V | ErrorMessage` rather than throwing, so
 * a caller that skips the check gets an object where it expected a number and
 * fails somewhere else entirely.
 */
export function errOf(v: unknown): string | null {
    return isErrorMessage(v) ? (v as ErrorMessage).msg : null
}

/** Header line, and the first record under it. Both block-relative. */
export const HEADER_ROW = 0
export const FIRST_RECORD = 1

/** `fields[0]` is the row-key column, so the key field's name is fixed. */
export const KEY_FIELD = 'id'

/** Who the blocks belong to. Any policy reads as `all` without an owner. */
export const OWNER = 'debugger'

export interface BlockSpec {
    sheetIdx: number
    blockId: number
    /** Where the block's master (top-left) cell lands. */
    masterRow: number
    masterCol: number
    /** Name formulas reach it by: `BLOCKREF("<refName>", key, field)`. */
    refName: string
}

/**
 * A render id per field.
 *
 * Nothing is stored against it — every field's meaning lives on the schema,
 * which is where each host reads it back from — but the engine keeps a
 * field's number format under it, so it has to be stable and distinct. The
 * same name-derived form `create_block` falls back to in a headless host.
 */
function renderId(refName: string, i: number): string {
    return `${refName}__f${i}`
}

/**
 * Deterministic pseudo-random, so two runs of "big block" are comparable.
 *
 * A debugger that produced different data every click would make "did my
 * change do that?" unanswerable. Plain 32-bit LCG — the numeric quality is
 * irrelevant here, repeatability is the whole point.
 */
function rng(seed: number): () => number {
    let s = seed >>> 0
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0
        return s / 0x100000000
    }
}

function pick<T>(r: () => number, xs: readonly T[]): T {
    return xs[Math.floor(r() * xs.length) % xs.length]
}

const REGIONS = ['North', 'South', 'East', 'West', 'Central'] as const
const QUARTERS = ['2024-Q1', '2024-Q2', '2024-Q3', '2024-Q4'] as const
const OWNERS = ['ada', 'grace', 'alan', 'edsger'] as const

/** A `blockInput` — block-relative, so it does not care where the block sits. */
function put(
    spec: BlockSpec,
    row: number,
    col: number,
    input: string
): EditPayload {
    return {
        type: 'blockInput',
        value: {
            sheetIdx: spec.sheetIdx,
            blockId: spec.blockId,
            row,
            col,
            input,
        },
    }
}

/**
 * The header line's names.
 *
 * The engine cannot write these itself: the container pass that creates the
 * block runs before the schema pass that would know the names, so a re-bind
 * could never fill them in. The caller writes them, and the schema's
 * `headerIdx` is what makes them a header rather than a stray first record.
 *
 * Exactly as many cells as the block has columns — a `blockInput` past the
 * edge fails the whole transaction rather than being ignored.
 */
function headerRow(spec: BlockSpec, fieldNames: readonly string[]) {
    return fieldNames.map((name, i) => put(spec, HEADER_ROW, i, name))
}

export interface BigBlockOptions extends BlockSpec {
    /** Records, not counting the header line. */
    rows: number
    seed?: number
}

/**
 * The headline button: a wide, deep, *clean* table.
 *
 * Clean is deliberate. This is the starting point you build the next
 * experiment on, so it declares no rule it then breaks — no violations to
 * squint past, no red triangles that were already there. `seedViolations`
 * below is how you dirty it, once you have decided what kind of wrong you
 * are looking at.
 *
 * Nine fields chosen to cover what the interesting code paths key off:
 * a unique required key, text to sort, two numbers to aggregate, an
 * engine-computed column, a boolean and a date for the widget layer, and a
 * free-text column that is allowed to be blank.
 */
export function bigBlockPayloads(opts: BigBlockOptions): EditPayload[] {
    const {rows, refName} = opts
    const r = rng(opts.seed ?? 20260910)
    const names = [
        KEY_FIELD,
        'region',
        'quarter',
        'units',
        'price',
        'revenue',
        'active',
        'updated',
        'note',
    ]

    const payloads: EditPayload[] = [
        {
            type: 'createBlock',
            value: {
                sheetIdx: opts.sheetIdx,
                id: opts.blockId,
                masterRow: opts.masterRow,
                masterCol: opts.masterCol,
                // The header is one of the block's own lines, so it counts.
                rowCnt: rows + 1,
                colCnt: names.length,
                owner: OWNER,
                description: `Debug fixture: ${rows} rows of synthetic sales data. Created by the debugger craft.`,
            },
        },
        ...headerRow(opts, names),
    ]

    for (let i = 0; i < rows; i++) {
        const row = FIRST_RECORD + i
        const units = 1 + Math.floor(r() * 500)
        const price = Math.round((5 + r() * 95) * 100) / 100
        const day = 1 + Math.floor(r() * 28)
        const month = 1 + Math.floor(r() * 12)
        payloads.push(
            put(opts, row, 0, `R${String(i + 1).padStart(4, '0')}`),
            put(opts, row, 1, pick(r, REGIONS)),
            put(opts, row, 2, pick(r, QUARTERS)),
            put(opts, row, 3, String(units)),
            put(opts, row, 4, price.toFixed(2)),
            // col 5 (revenue) is engine-computed — writing it would be dropped
            put(opts, row, 6, r() > 0.3 ? 'TRUE' : 'FALSE'),
            put(
                opts,
                row,
                7,
                `2024-${String(month).padStart(2, '0')}-${String(day).padStart(
                    2,
                    '0'
                )}`
            ),
            // Left blank often on purpose: `note` declares nothing, so a blank
            // here is correct, and it gives the eye something to check that a
            // *required* blank is flagged and this one is not.
            put(opts, row, 8, r() > 0.6 ? `owner:${pick(r, OWNERS)}` : '')
        )
    }

    payloads.push({
        type: 'bindFormSchema',
        value: {
            refName,
            sheetIdx: opts.sheetIdx,
            blockId: opts.blockId,
            fieldFrom: 0,
            keyIdx: 0,
            row: true,
            headerIdx: HEADER_ROW,
            fields: [
                {
                    name: KEY_FIELD,
                    renderId: renderId(refName, 0),
                    fieldType: {kind: 'string'},
                    description: 'Record key. Unique, and never blank.',
                    required: true,
                    unique: true,
                },
                {
                    name: 'region',
                    renderId: renderId(refName, 1),
                    fieldType: {kind: 'string'},
                    description: 'Sales region.',
                },
                {
                    name: 'quarter',
                    renderId: renderId(refName, 2),
                    fieldType: {kind: 'string'},
                    description: 'Fiscal quarter, as YYYY-Qn.',
                },
                {
                    name: 'units',
                    renderId: renderId(refName, 3),
                    fieldType: {kind: 'number'},
                    description: 'Units sold.',
                    required: true,
                },
                {
                    name: 'price',
                    renderId: renderId(refName, 4),
                    fieldType: {kind: 'number'},
                    description: 'Unit price.',
                    required: true,
                },
                {
                    // Engine-computed: writes to it are dropped, and
                    // `why_locked` names this formula as the reason.
                    name: 'revenue',
                    renderId: renderId(refName, 5),
                    fieldType: {kind: 'number'},
                    valueFormula: '#FIELD("units")*#FIELD("price")',
                    description: 'units × price. Computed by the engine.',
                },
                {
                    name: 'active',
                    renderId: renderId(refName, 6),
                    fieldType: {kind: 'boolean'},
                    description: 'Whether the line is still live.',
                },
                {
                    name: 'updated',
                    renderId: renderId(refName, 7),
                    fieldType: {kind: 'datetime'},
                    description: 'Last touched.',
                },
                {
                    name: 'note',
                    renderId: renderId(refName, 8),
                    fieldType: {kind: 'string'},
                    description: 'Free text. May be blank.',
                },
            ],
        },
    })
    return payloads
}

export const TYPED_ENUM_SET = 'debugger_status'

export interface TypedBlockOptions extends BlockSpec {
    rows?: number
}

/**
 * One column per field type — the widget-layer fixture.
 *
 * The point is coverage, not realism: every `kind` the schema can declare,
 * so a change to the block-interface overlay can be eyeballed against all of
 * them at once instead of one hand-built block per type.
 *
 * `fieldRef` / `multiSelectRef` are left out. They need a *target* block to
 * point at, so a self-contained fixture cannot declare one honestly, and a
 * ref to a block that does not exist is a different bug from the one you
 * would be looking for. Point one at the big block by hand when that is what
 * you are testing.
 */
export function typedBlockPayloads(opts: TypedBlockOptions): EditPayload[] {
    const rows = opts.rows ?? 8
    const {refName} = opts
    const r = rng(7)
    const names = [
        KEY_FIELD,
        'text',
        'amount',
        'flag',
        'when',
        'status',
        'tags',
        'picture',
    ]
    const STATUSES = ['draft', 'review', 'done'] as const

    const payloads: EditPayload[] = [
        {
            type: 'upsertEnumSet',
            value: {
                id: TYPED_ENUM_SET,
                name: 'Debug status',
                variants: STATUSES.map((s) => ({
                    id: s,
                    label: s[0].toUpperCase() + s.slice(1),
                })),
            },
        },
        {
            type: 'createBlock',
            value: {
                sheetIdx: opts.sheetIdx,
                id: opts.blockId,
                masterRow: opts.masterRow,
                masterCol: opts.masterCol,
                rowCnt: rows + 1,
                colCnt: names.length,
                owner: OWNER,
                description:
                    'Debug fixture: one column per declarable field type, for eyeballing the widget layer.',
            },
        },
        ...headerRow(opts, names),
    ]

    for (let i = 0; i < rows; i++) {
        const row = FIRST_RECORD + i
        payloads.push(
            put(opts, row, 0, `T${i + 1}`),
            put(opts, row, 1, `row ${i + 1}`),
            put(opts, row, 2, String(Math.round(r() * 10000) / 100)),
            put(opts, row, 3, i % 2 === 0 ? 'TRUE' : 'FALSE'),
            put(opts, row, 4, `2026-0${1 + (i % 9)}-15`),
            put(opts, row, 5, pick(r, STATUSES)),
            put(opts, row, 6, pick(r, STATUSES)),
            put(opts, row, 7, '')
        )
    }

    payloads.push({
        type: 'bindFormSchema',
        value: {
            refName,
            sheetIdx: opts.sheetIdx,
            blockId: opts.blockId,
            fieldFrom: 0,
            keyIdx: 0,
            row: true,
            headerIdx: HEADER_ROW,
            fields: [
                {
                    name: KEY_FIELD,
                    renderId: renderId(refName, 0),
                    fieldType: {kind: 'string'},
                    required: true,
                    unique: true,
                },
                {
                    name: 'text',
                    renderId: renderId(refName, 1),
                    fieldType: {kind: 'string'},
                },
                {
                    name: 'amount',
                    renderId: renderId(refName, 2),
                    fieldType: {kind: 'number'},
                },
                {
                    name: 'flag',
                    renderId: renderId(refName, 3),
                    fieldType: {kind: 'boolean'},
                },
                {
                    name: 'when',
                    renderId: renderId(refName, 4),
                    fieldType: {kind: 'datetime'},
                },
                {
                    name: 'status',
                    renderId: renderId(refName, 5),
                    fieldType: {kind: 'enum', enumSetId: TYPED_ENUM_SET},
                },
                {
                    name: 'tags',
                    renderId: renderId(refName, 6),
                    fieldType: {kind: 'multiSelect', enumSetId: TYPED_ENUM_SET},
                },
                {
                    name: 'picture',
                    renderId: renderId(refName, 7),
                    fieldType: {kind: 'image'},
                },
            ],
        },
    })
    return payloads
}

/**
 * Re-bind a block's schema with `unique_together` on (region, quarter), and
 * overwrite the first rows so the rule is actually broken.
 *
 * Both halves matter. Declaring the rule over data that happens to satisfy it
 * proves nothing, and dirtying the data without the rule flags nothing — the
 * bug you are usually chasing is that one of the two did not take.
 *
 * Needs the big block's exact field list, so it is not general: it re-sends
 * the schema, and anything a re-bind leaves out is dropped.
 */
export function seedViolationsPayloads(
    opts: BlockSpec & {rows: number}
): EditPayload[] {
    const {refName} = opts
    const names = [
        KEY_FIELD,
        'region',
        'quarter',
        'units',
        'price',
        'revenue',
        'active',
        'updated',
        'note',
    ]
    const payloads: EditPayload[] = [
        {
            type: 'bindFormSchema',
            value: {
                refName,
                sheetIdx: opts.sheetIdx,
                blockId: opts.blockId,
                fieldFrom: 0,
                keyIdx: 0,
                row: true,
                headerIdx: HEADER_ROW,
                uniqueTogether: [{fields: ['region', 'quarter']}],
                fields: names.map((name, i) => ({
                    name,
                    renderId: renderId(refName, i),
                    fieldType: {
                        kind:
                            name === 'units' ||
                            name === 'price' ||
                            name === 'revenue'
                                ? 'number'
                                : name === 'active'
                                ? 'boolean'
                                : name === 'updated'
                                ? 'datetime'
                                : 'string',
                    },
                    ...(name === KEY_FIELD ? {required: true, unique: true} : {}),
                    ...(name === 'units' || name === 'price'
                        ? {required: true}
                        : {}),
                    // Declared unique HERE and not in the clean fixture:
                    // it is what the third marker below trips.
                    ...(name === 'note' ? {unique: true} : {}),
                    ...(name === 'revenue'
                        ? {valueFormula: '#FIELD("units")*#FIELD("price")'}
                        : {}),
                })),
            },
        },
    ]

    // Three kinds of wrong, one per rule, so each marker can be told apart:
    //   rows 1-2  same (region, quarter)  → unique_together
    //   row  3    blank units             → required
    //   rows 4-5  same note               → unique
    //
    // The obvious fourth — a duplicate KEY — is deliberately absent. The
    // row-key guard refuses that write outright rather than letting it land
    // and flagging it, so it is not a marker at all; attempting it only fails
    // the whole transaction and takes the other three down with it.
    if (opts.rows >= 5) {
        payloads.push(
            put(opts, FIRST_RECORD, 1, 'South'),
            put(opts, FIRST_RECORD, 2, '2024-Q1'),
            put(opts, FIRST_RECORD + 1, 1, 'South'),
            put(opts, FIRST_RECORD + 1, 2, '2024-Q1'),
            put(opts, FIRST_RECORD + 2, 3, ''),
            put(opts, FIRST_RECORD + 3, 8, 'owner:ada'),
            put(opts, FIRST_RECORD + 4, 8, 'owner:ada')
        )
    }
    return payloads
}

export interface AnalysisOptions extends BlockSpec {
    /** The block being summarised, and how tall it is (header included). */
    sourceBlockId: number
    sourceRowCnt: number
}

/**
 * A totals row under the big block: SUM(units), SUM(price), SUM(revenue).
 *
 * An analysis block declares `analyzes` at creation rather than in a
 * follow-up, so the table is never briefly a stray row of numbers that a
 * reader — or a schema pass — would take for a record.
 */
export function analysisBlockPayloads(opts: AnalysisOptions): EditPayload[] {
    const {refName} = opts
    const names = ['label', 'units', 'price', 'revenue']
    return [
        {
            type: 'createBlock',
            value: {
                sheetIdx: opts.sheetIdx,
                id: opts.blockId,
                masterRow: opts.masterRow,
                masterCol: opts.masterCol,
                rowCnt: 2,
                colCnt: names.length,
                owner: OWNER,
                analyzes: opts.sourceBlockId,
                description: 'Debug fixture: totals over the big block.',
            },
        },
        ...headerRow(opts, names),
        put(opts, FIRST_RECORD, 0, 'Total'),
        {
            type: 'bindFormSchema',
            value: {
                refName,
                sheetIdx: opts.sheetIdx,
                blockId: opts.blockId,
                fieldFrom: 0,
                keyIdx: 0,
                row: true,
                headerIdx: HEADER_ROW,
                fields: [
                    {
                        name: 'label',
                        renderId: renderId(refName, 0),
                        fieldType: {kind: 'string'},
                    },
                    ...['units', 'price', 'revenue'].map((f, i) => ({
                        name: f,
                        renderId: renderId(refName, i + 1),
                        fieldType: {kind: 'number'},
                        aggFunc: 'SUM',
                        aggField: f,
                    })),
                ],
            },
        },
    ]
}

/** `{payloads, undoable, temp}` — what `handleTransaction` takes. */
export function buildTransaction(
    payloads: readonly EditPayload[],
    undoable = true
): Transaction {
    return {payloads, undoable, temp: false}
}
