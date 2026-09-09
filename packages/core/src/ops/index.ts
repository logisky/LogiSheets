// WorkbookOps — the operation layer.
//
// This is the single home for high-level, engine-neutral workbook
// *operations* (input a cell, add a sheet, insert a block row, set a
// validation rule, ...). Each operation is an async method that does the full
// orchestration — resolve ids, build payloads, send the transaction, surface
// errors — on top of the injected {@link Client} seam (see ../port).
//
// Both hosts are thin shells over this layer:
//   - browser app  -> injects logisheets-engine's worker-backed client
//   - node runtime -> injects an async client built over the Node WASM engine
//
// Operations are written async against the full Client. The browser client is
// already async; the Node runtime adapts its synchronous handle() into an
// async Client, so this one implementation runs unchanged on both.
//
// UI side effects (refocus, toasts, event buses, closing dialogs) stay in the
// host — only the engine-facing operation lives here.

import type {
    Payload,
    ActionEffect,
    SelectedData,
    Alignment,
    StPatternType,
    Value,
    SheetCellId,
} from 'logisheets-web'
import type {Client} from '../port.js'
import {makeTransaction} from '../transaction/index.js'
import {
    checkValidations as checkValidationsPure,
    interpretValidation,
    type ValidationRule,
    type Violation,
} from '../validation/index.js'
import type {FieldTypeEnum} from '../field/index.js'
import {
    generateFontPayload,
    generateAlgnmentPayload,
    generateWrapTextPayload,
    generateNumFmtPayload,
    generatePatternFillPayload,
    generateBorderPayloads,
    type FontStyle,
    type BorderBatchUpdate,
} from '../format/index.js'

function isErrorMessage(v: unknown): v is {msg: string} {
    return (
        typeof v === 'object' &&
        v !== null &&
        'msg' in (v as Record<string, unknown>)
    )
}

/**
 * Tells WorkbookOps whether to mark transactions temp (speculative). The
 * browser injects its global temp-mode toggle; the Node runtime leaves it at
 * the default (always committed).
 */
export type TempModeProvider = () => boolean

/** One field of a form-backed block, resolved by the host. */
export interface FormBlockField {
    /** Display name. */
    name: string
    /** Engine render id, allocated by the host's FieldManager. */
    renderId: string
    /** Per-field value-formula template (#FIELD("X") / #KEY); '' if free-form. */
    valueFormula?: string
    /**
     * Per-field validation template (#PLACEHOLDER for the value under test,
     * #FIELD("X") for a same-row sibling); '' when the field has no rule.
     *
     * This goes into the schema rather than staying host-side so the engine
     * installs the per-record shadow itself — on bind AND on every row added
     * later — and so one answer serves every reader: the warning marker, the
     * `overrideValidation` write gate, and any other host.
     */
    validationFormula?: string
    /**
     * Per-field editability template — FALSE installs a `UserEditable` lock the
     * host permission layer reads.
     *
     * Carried here because a schema re-bind replaces the field wholesale: the
     * three bind sites below used to send `editabilityFormulas: []` ("all
     * None"), so editing a block through this layer silently dropped any
     * editability template it had.
     */
    editabilityFormula?: string
    /** Whether the field renders via a host-drawn (DIY) overlay. */
    diyRender: boolean
    /** Number format applied to the field's render info. */
    numFmt?: string

    // ---- Declaration -----------------------------------------------------
    // What the field IS, as opposed to what currently guards it. These reach
    // the engine schema, so every host reads the same answer and they survive
    // a save/load — previously they lived only in the browser's FieldManager,
    // persisted as opaque JSON nothing but the browser read. See
    // design/block-field-semantics.md.

    /** Declared type. Omitted reads as unspecified (free-form). */
    fieldType?: FieldTypeEnum
    /** Enum set backing a `fieldType` of 'enum' / 'multiSelect'. */
    enumSetId?: string
    /** Target of a `fieldType` of 'fieldRef' / 'multiSelectRef'. */
    refTarget?: {sheetId: number; blockId: number; fieldName: string}
    /** What the field means, in prose, for whoever reads the block next. */
    description?: string
    /** Every record must carry a value here. */
    required?: boolean
    /** No two records may carry the same value here. */
    unique?: boolean
    /** What a newly-added record starts with. */
    defaultValue?: string
    /**
     * Who may write to this field's cells: `'inherit'` (the block's own owner
     * rules) | `'ownerOnly'` | `'anyone'`.
     *
     * Declared on the schema so every host reads the same answer — it was the
     * last field-level rule that lived only in the browser's own field store,
     * as a tri-state `userEditable` boolean. The engine persists and answers;
     * it does not enforce, because it does not know who is writing.
     */
    writePolicy?: 'inherit' | 'ownerOnly' | 'anyone'
}

/** The engine's flat `FieldTypeParts` shape, or undefined for unspecified. */
function fieldTypeParts(f: FormBlockField) {
    if (!f.fieldType || f.fieldType === 'unspecified') return undefined
    return {
        kind: f.fieldType,
        enumSetId: f.enumSetId,
        refSheetId: f.refTarget?.sheetId,
        refBlockId: f.refTarget?.blockId,
        refFieldName: f.refTarget?.fieldName,
    }
}

/**
 * An option list a field can draw from, as the engine stores it.
 *
 * Ids and labels only. A variant's COLOUR is presentation and stays in the
 * host, keyed by variant id — the engine needs the options in order to judge a
 * value and needs nothing else.
 */
export interface EnumSetDecl {
    id: string
    name?: string
    variants: ReadonlyArray<{id: string; label?: string}>
}

/**
 * `upsertEnumSet` payloads for the sets a block's fields reference.
 *
 * Emitted in the same transaction as the schema bind, so a field declaring
 * `enum{setId}` and the set it names never land apart — the declaration is
 * useless to any other host without the options beside it. A set with no
 * variants is skipped rather than sent: the engine refuses it (it would allow
 * nothing), and failing the whole bind over a half-authored option list is the
 * wrong trade.
 */
function enumSetPayloads(
    fields: readonly FormBlockField[],
    sets: readonly EnumSetDecl[] | undefined
): Payload[] {
    if (!sets || sets.length === 0) return []
    const referenced = new Set(
        fields.map((f) => f.enumSetId).filter((id): id is string => !!id)
    )
    return sets
        .filter((s) => referenced.has(s.id) && s.variants.length > 0)
        .map((s) => ({
            type: 'upsertEnumSet' as const,
            value: {
                id: s.id,
                name: s.name,
                variants: s.variants.map((v) => ({id: v.id, label: v.label})),
            },
        }))
}

/**
 * How an analysis field aggregates the field it reads. Every one lowers to
 * `FUNC(BLOCKREFSB(...))` in the engine, which is why adding one is a one-line
 * change there and none here.
 *
 * `COUNT` counts numbers, `COUNTA` counts values that are simply THERE — over
 * `10, 20, "n/a", <blank>` they say 2 and 3. In a pivot, COUNT counts matching
 * records and COUNTA counts the ones whose measure is filled in.
 */
export type AggFunc = 'SUM' | 'COUNT' | 'COUNTA' | 'AVERAGE' | 'MIN' | 'MAX'

/** One field of an analysis block: what it aggregates, and how. */
export interface AnalysisAggregate {
    /** Field name of the SOURCE block. */
    field: string
    func: AggFunc
}

/** One column of the block being analysed, as the analysis needs to see it. */
export interface AnalysisSourceField {
    name: string
    /**
     * Whether the source DECLARES this field a number. Not whether its cells
     * currently hold numbers: guessing from the data totals an id column, and
     * leaves a still-empty column out of a total it belongs in.
     */
    isNumber: boolean
    /**
     * The source column's number format, carried onto the total so a sum of
     * currency reads as currency.
     */
    numFmt?: string
}

/**
 * Whether the result of `func` over a column is still measured in that
 * column's units, and so should carry its number format.
 *
 * A sum, an average, a minimum or a maximum of a currency column is currency.
 * The counts are not: they answer "how many", so formatting one like the
 * column it counts would print "$3" for three orders. These are the aggregates
 * whose result changes what is being measured.
 */
export function aggregateKeepsFormat(func: AggFunc): boolean {
    return func !== 'COUNT' && func !== 'COUNTA'
}

/**
 * A pivot recipe as PLAIN data, whatever the caller handed over.
 *
 * A recipe read back off a block arrives through the worker boundary, and what
 * comes out the other side is not necessarily structured-cloneable on the way
 * back in — a host that passes a recipe straight from `BlockInfo.pivot` into a
 * payload gets "could not be cloned" from `postMessage`, at the moment of the
 * write, with nothing in any test to warn it. Rebuilding every field by value
 * makes that impossible to hit.
 */
function plainSpec(spec: {
    rowDim: string
    colDim?: string
    measure: string
    func: AggFunc
    order: DimOrder
    orderValues: readonly string[]
    filters: readonly PivotFilter[]
}) {
    return {
        rowDim: String(spec.rowDim),
        ...(spec.colDim === undefined ? {} : {colDim: String(spec.colDim)}),
        measure: String(spec.measure),
        func: spec.func,
        order: spec.order,
        orderValues: spec.orderValues.map((v) => String(v)),
        filters: spec.filters.map((f) => ({
            field: String(f.field),
            criteria: String(f.criteria),
        })),
    }
}

/**
 * A pivot's header is the FIRST line of its block, and its records follow.
 *
 * Named because three places have to agree about it: the geometry (a pivot is
 * one line taller than it has groups), the bind (`headerIdx`), and the writes
 * that fill it. It is first because Excel's `headerRowCount="1"` cannot mean
 * anything else.
 */
const PIVOT_HEADER_ROW = 0
/** Block-relative row of a pivot's first RECORD, i.e. just after the header. */
const PIVOT_FIRST_RECORD = 1

/** The block being analysed. */
export interface AnalysisSource {
    sheetIdx: number
    blockId: number
    /** Its ref name — used in the new block's description, not in a formula. */
    refName: string
    rowStart: number
    rowCnt: number
    colStart: number
    /** Fields in COLUMN order, so the analysis's columns line up with them. */
    fields: readonly AnalysisSourceField[]
    /** Which column is the key — where the label goes. */
    keyIdx: number
}

/**
 * SUM over every field the source declares a number.
 *
 * A default is only possible because the declaration exists: this is what the
 * field-type work in `design/block-field-semantics.md` bought — before it, a
 * caller could only guess from the data.
 */
export function defaultAnalysisAggregates(
    fields: readonly AnalysisSourceField[]
): AnalysisAggregate[] {
    return fields
        .filter((f) => f.isNumber)
        .map((f) => ({field: f.name, func: 'SUM' as const}))
}

/**
 * How a pivot orders the distinct values it turns into rows and columns.
 *
 * `custom` takes the sequence from `orderValues`; values it does not mention
 * follow in ascending order rather than disappearing, because a hidden group
 * is the failure a pivot must never commit silently.
 */
export type DimOrder = 'ascending' | 'firstSeen' | 'custom'

/** One condition a source record must meet to be counted by a pivot. */
export interface PivotFilter {
    field: string
    /** Spreadsheet condition syntax: `">100"`, `"East"`, `"<>closed"`. */
    criteria: string
}

/**
 * A pivot column that is declared rather than derived.
 *
 * A plain cross-tab needs none of these: each column's name IS the dimension
 * value and the block's recipe supplies the rest. These exist for the two
 * things that cannot express — a ROW TOTAL (`colValue: null`, spanning every
 * value) and a SECOND MEASURE (`measure` / `func` of its own).
 *
 * A refresh leaves declared columns alone: they were never derived from the
 * data, so the data cannot justify removing them.
 */
export interface PivotColumnSpec {
    /** Column name in the pivot. */
    name: string
    /** Which column-dimension value it filters on; `null` spans every one. */
    colValue: string | null
    measure?: string
    func?: AggFunc
}

/** The block a pivot analyses, as the create needs to see it. */
export interface PivotSource {
    sheetIdx: number
    blockId: number
    /** Its ref name — used in the new block's description, not in a formula. */
    refName: string
    rowStart: number
    rowCnt: number
    colStart: number
    /**
     * Number format per SOURCE field name, for the pivot to inherit: a cell of
     * a pivot is an aggregate of one source column, so a SUM of a currency
     * column should read as currency rather than as a bare number.
     *
     * Optional — omit it and the pivot is left unformatted, which is what
     * every caller got before this existed.
     */
    numFmts?: Readonly<Record<string, string | undefined>>
}

/** What a refresh actually changed. */
export interface PivotRefresh {
    /** Groups that appeared in the source and now have a row. */
    addedKeys: string[]
    /** Rows the source no longer justifies. */
    removedKeys: string[]
    addedFields: string[]
    removedFields: string[]
    /**
     * Source records with a blank dimension. They are in NO cell of the pivot,
     * so its grand total is short by their measure — a refresh cannot fix
     * that, only report it.
     */
    unassignedRecords: number
}

/**
 * One field of a `bindFormSchema` payload.
 *
 * The payload used to take five positionally-aligned arrays (names, renderIds,
 * and one per rule kind), which three call sites below each spelled out by
 * hand. Carrying the declaration too would have made it eight — so the payload
 * became a list of these, and the three call sites became one function.
 */
function toSchemaFieldSpec(f: FormBlockField) {
    return {
        name: f.name,
        renderId: f.renderId,
        valueFormula: f.valueFormula || undefined,
        validationFormula: f.validationFormula || undefined,
        editabilityFormula: f.editabilityFormula || undefined,
        fieldType: fieldTypeParts(f),
        description: f.description || undefined,
        required: f.required,
        unique: f.unique,
        defaultValue: f.defaultValue || undefined,
        writePolicy: f.writePolicy,
    }
}

/**
 * High-level workbook operations bound to one engine {@link Client}.
 * Construct one per workbook and share it across the host.
 */
export class WorkbookOps {
    /** Monotonic id for the throwaway ephemeral cells used by evalFormula. */
    private ephemeralSeq = 1

    constructor(
        private readonly client: Client,
        private readonly tempMode: TempModeProvider = () => false
    ) {}

    /**
     * Build a transaction at the host's current temp-mode, send it, and return
     * the engine's effect. Throws on an engine ErrorMessage so callers can use
     * normal try/catch instead of inspecting a union.
     */
    private async apply(
        payloads: readonly Payload[],
        undoable: boolean
    ): Promise<ActionEffect> {
        const transaction = makeTransaction(payloads, undoable, this.tempMode())
        const res = await this.client.handleTransaction({transaction})
        if (isErrorMessage(res)) {
            throw new Error('Transaction failed: ' + res.msg)
        }
        return res
    }

    // ---- cell / block input --------------------------------------------

    /** Write a value or formula into a cell. */
    inputCell(
        sheetIdx: number,
        row: number,
        col: number,
        content: string,
        undoable = true
    ): Promise<ActionEffect> {
        return this.apply(
            [{type: 'cellInput', value: {sheetIdx, row, col, content}}],
            undoable
        )
    }

    /** Write a value into a cell addressed within a block's coordinate space. */
    inputBlockCell(
        sheetIdx: number,
        blockId: number,
        row: number,
        col: number,
        input: string,
        undoable = true
    ): Promise<ActionEffect> {
        return this.apply(
            [
                {
                    type: 'blockInput',
                    value: {sheetIdx, blockId, row, col, input},
                },
            ],
            undoable
        )
    }

    /**
     * Write several block cells in one transaction. Used when an interaction
     * changes a group of related cells at once (e.g. redistributing a percent
     * allocation across a pool).
     */
    inputBlockCells(
        inputs: ReadonlyArray<{
            sheetIdx: number
            blockId: number
            row: number
            col: number
            input: string
        }>,
        undoable = true
    ): Promise<ActionEffect> {
        return this.apply(
            inputs.map((i) => ({type: 'blockInput', value: i})),
            undoable
        )
    }

    /**
     * Set a cell's content to an image URL, optionally widening the column
     * and/or heightening the row to fit — all in one transaction. The host
     * computes the target `colWidth`/`rowHeight` (in engine units) and passes
     * them only when an adjustment is actually needed.
     */
    setCellImage(
        sheetIdx: number,
        row: number,
        col: number,
        url: string,
        opts?: {colWidth?: number; rowHeight?: number}
    ): Promise<ActionEffect> {
        const payloads: Payload[] = [
            {type: 'cellInput', value: {sheetIdx, row, col, content: url}},
        ]
        if (opts?.colWidth !== undefined) {
            payloads.push({
                type: 'setColWidth',
                value: {sheetIdx, col, width: opts.colWidth},
            })
        }
        if (opts?.rowHeight !== undefined) {
            payloads.push({
                type: 'setRowHeight',
                value: {sheetIdx, row, height: opts.rowHeight},
            })
        }
        return this.apply(payloads, true)
    }

    // ---- sheets ---------------------------------------------------------

    /** Create a new sheet named `name` at index `idx`. */
    createSheet(name: string, idx: number): Promise<ActionEffect> {
        return this.apply(
            [{type: 'createSheet', value: {idx, newName: name}}],
            true
        )
    }

    /** Rename a sheet. */
    renameSheet(oldName: string, newName: string): Promise<ActionEffect> {
        return this.apply(
            [{type: 'sheetRename', value: {oldName, newName}}],
            true
        )
    }

    /** Delete the sheet at index `idx`. */
    deleteSheet(idx: number): Promise<ActionEffect> {
        return this.apply([{type: 'deleteSheet', value: {idx}}], true)
    }

    /** Set a sheet tab's color (ARGB string; empty clears it). */
    setSheetColor(idx: number, color: string): Promise<ActionEffect> {
        return this.apply([{type: 'setSheetColor', value: {idx, color}}], true)
    }

    // ---- blocks ---------------------------------------------------------

    /** Insert `cnt` rows into a block, starting at block-row `start`. */
    insertRowsInBlock(
        sheetIdx: number,
        blockId: number,
        start: number,
        cnt = 1
    ): Promise<ActionEffect> {
        return this.apply(
            [
                {
                    type: 'insertRowsInBlock',
                    value: {sheetIdx, blockId, start, cnt},
                },
            ],
            true
        )
    }

    /** Delete a block. */
    removeBlock(sheetIdx: number, blockId: number): Promise<ActionEffect> {
        return this.apply(
            [{type: 'removeBlock', value: {sheetIdx, id: blockId}}],
            true
        )
    }

    /**
     * Move a block so its master (top-left) cell lands at
     * (`newMasterRow`, `newMasterCol`). The engine relocates the whole block
     * region; the caller is responsible for making sure the destination is
     * clear (see the drag-to-move overlay, which cancels on collision).
     */
    moveBlock(
        sheetIdx: number,
        blockId: number,
        newMasterRow: number,
        newMasterCol: number
    ): Promise<ActionEffect> {
        return this.apply(
            [
                {
                    type: 'moveBlock',
                    value: {sheetIdx, id: blockId, newMasterRow, newMasterCol},
                },
            ],
            true
        )
    }

    /**
     * Sort a block's records by the named field. Rows are reordered for a
     * row-schema block, columns for a col-schema block. The engine computes a
     * type-aware order (numbers numerically, text lexicographically, blanks
     * last); the reorder is one undoable transaction.
     *
     * Throws for random-schema blocks (no fields) or an unknown field name.
     */
    async sortBlock(
        sheetIdx: number,
        blockId: number,
        field: string,
        asc = true,
        undoable = true
    ): Promise<ActionEffect> {
        const order = await this.client.getBlockSortOrder({
            sheetIdx,
            blockId,
            field,
            asc,
        })
        if (isErrorMessage(order)) {
            throw new Error('Sort failed: ' + order.msg)
        }
        return this.apply(
            [
                {
                    type: 'reorderBlockLines',
                    value: {
                        sheetIdx,
                        blockId,
                        isRow: order.isRow,
                        newOrder: order.newOrder,
                    },
                },
            ],
            undoable
        )
    }

    /**
     * Move a single block line (column or row) from one position to another —
     * positional `remove(from)` then `insert(to)` on the block's line order
     * (`MoveBlockLine`). For a row-schema form block, a FIELD is a column, so
     * reordering fields is `isRow = false` with block-inner column indices.
     *
     * `to` is the index in the post-removal frame (matching the engine's
     * `move_line`). The field's stable line id keeps its cell data, and the
     * schema's per-field `idx` is re-derived from the new position on the next
     * read — so both data and field order follow the move automatically; no
     * re-`bindFormSchema` is needed.
     */
    moveBlockLine(
        sheetIdx: number,
        blockId: number,
        from: number,
        to: number,
        isRow = false,
        undoable = true
    ): Promise<ActionEffect> {
        return this.apply(
            [
                {
                    type: 'moveBlockLine',
                    value: {sheetIdx, blockId, from, to, isRow},
                },
            ],
            undoable
        )
    }

    // ---- formatting -----------------------------------------------------
    //
    // Each method turns the current sheet + selection into style-update
    // payloads (logic in ../format) and applies them. The host supplies the
    // sheet index (a view concern) and the selection.

    /** Apply font styling (bold/italic/underline/strike/color/size). */
    async setFont(
        sheetIdx: number,
        data: SelectedData,
        update: FontStyle
    ): Promise<void> {
        await this.applyGenerated(generateFontPayload(sheetIdx, data, update))
    }

    /** Apply horizontal/vertical alignment. */
    async setAlignment(
        sheetIdx: number,
        data: SelectedData,
        alignment: Alignment
    ): Promise<void> {
        await this.applyGenerated(
            generateAlgnmentPayload(sheetIdx, data, alignment)
        )
    }

    /** Toggle wrap-text. */
    async setWrapText(
        sheetIdx: number,
        data: SelectedData,
        wrapText: boolean
    ): Promise<void> {
        await this.applyGenerated(
            generateWrapTextPayload(sheetIdx, data, wrapText)
        )
    }

    /** Apply a number format. */
    async setNumFmt(
        sheetIdx: number,
        data: SelectedData,
        numFmt: string
    ): Promise<void> {
        await this.applyGenerated(generateNumFmtPayload(sheetIdx, data, numFmt))
    }

    /** Apply a pattern fill (foreground/background color + pattern). */
    async setPatternFill(
        sheetIdx: number,
        data: SelectedData,
        opts: {fgColor?: string; bgColor?: string; pattern?: StPatternType}
    ): Promise<void> {
        await this.applyGenerated(
            generatePatternFillPayload(
                sheetIdx,
                data,
                opts.fgColor,
                opts.bgColor,
                opts.pattern
            )
        )
    }

    /** Apply borders to the selection per the batch directive. */
    async setBorder(
        sheetIdx: number,
        data: SelectedData,
        update: BorderBatchUpdate
    ): Promise<void> {
        await this.applyGenerated(
            generateBorderPayloads(sheetIdx, data, update)
        )
    }

    /** Apply a generated payload list, skipping the round-trip when empty. */
    private async applyGenerated(payloads: readonly Payload[]): Promise<void> {
        if (payloads.length === 0) return
        await this.apply(payloads, true)
    }

    // ---- structured blocks ---------------------------------------------

    /**
     * Create a form-backed block: the `createBlock` + `bindFormSchema` +
     * per-field `upsertFieldRenderInfo` payloads, in one transaction.
     *
     * The host resolves each field first (type → FieldInfo, validation
     * formulas, and the engine render id from its FieldManager), then hands
     * the flattened list here. Field/formula composition and FieldManager
     * registration stay in the host because they touch engine-side render
     * state that isn't part of the Client seam.
     */
    async createFormBlock(opts: {
        sheetIdx: number
        blockId: number
        masterRow: number
        masterCol: number
        refName: string
        keyIdx: number
        fields: readonly FormBlockField[]
        /** Option lists the fields reference; written in the same transaction. */
        enumSets?: readonly EnumSetDecl[]
    }): Promise<void> {
        const {
            sheetIdx,
            blockId,
            masterRow,
            masterCol,
            refName,
            keyIdx,
            fields,
        } = opts
        const payloads: Payload[] = [
            {
                type: 'createBlock',
                value: {
                    sheetIdx,
                    id: blockId,
                    masterRow,
                    masterCol,
                    rowCnt: 1,
                    colCnt: fields.length,
                },
            },
            ...enumSetPayloads(fields, opts.enumSets),
            {
                type: 'bindFormSchema',
                value: {
                    refName,
                    sheetIdx,
                    blockId,
                    fieldFrom: 0,
                    row: true,
                    keyIdx: keyIdx < 0 ? 0 : keyIdx,
                    fields: fields.map(toSchemaFieldSpec),
                },
            },
            ...fields.map((f) => ({
                type: 'upsertFieldRenderInfo' as const,
                value: {
                    renderId: f.renderId,
                    diyRender: f.diyRender,
                    styleUpdate: {setNumFmt: f.numFmt ?? ''},
                },
            })),
        ]
        await this.apply(payloads, true)
    }

    /**
     * Turn an EXISTING cell region into a form-backed block in place: like
     * `createFormBlock`, but `convertBlock` (keeps the region's cells + values
     * and its row/col extent, and remaps formulas that reference the range so
     * they track the block). `fields.length` must equal the region's columns.
     */
    async convertToFormBlock(opts: {
        sheetIdx: number
        blockId: number
        masterRow: number
        masterCol: number
        rowCnt: number
        colCnt: number
        refName: string
        keyIdx: number
        fields: readonly FormBlockField[]
        /** Option lists the fields reference; written in the same transaction. */
        enumSets?: readonly EnumSetDecl[]
    }): Promise<void> {
        const {
            sheetIdx,
            blockId,
            masterRow,
            masterCol,
            rowCnt,
            colCnt,
            refName,
            keyIdx,
            fields,
        } = opts
        const payloads: Payload[] = [
            {
                type: 'convertBlock',
                value: {
                    sheetIdx,
                    id: blockId,
                    masterRow,
                    masterCol,
                    rowCnt,
                    colCnt,
                },
            },
            ...enumSetPayloads(fields, opts.enumSets),
            {
                type: 'bindFormSchema',
                value: {
                    refName,
                    sheetIdx,
                    blockId,
                    fieldFrom: 0,
                    row: true,
                    keyIdx: keyIdx < 0 ? 0 : keyIdx,
                    fields: fields.map(toSchemaFieldSpec),
                },
            },
            ...fields.map((f) => ({
                type: 'upsertFieldRenderInfo' as const,
                value: {
                    renderId: f.renderId,
                    diyRender: f.diyRender,
                    styleUpdate: {setNumFmt: f.numFmt ?? ''},
                },
            })),
        ]
        await this.apply(payloads, true)
    }

    /**
     * Edit an EXISTING form-backed block: rename it, re-type / re-formula its
     * existing fields, and/or append new fields — in one transaction. The v1
     * contract is **fields are never removed**, so the column count is
     * monotonically non-decreasing: `fields.length >= currentColCnt`. That
     * keeps this safe with only a *tail* `resizeBlock` (new columns are
     * appended, existing field columns — and the cells/formulas that
     * reference them — are untouched, and no schema entry is ever orphaned).
     *
     * `fields` is the FULL field list (existing fields first, in their
     * current order, followed by any newly-added fields). Existing fields
     * MUST keep their original `renderId` so the block's cells stay wired to
     * their render/type metadata; the host reconstructs the list from
     * `BlockInfo.schema.fields[i].renderId`.
     *
     * Order matters: the `resizeBlock` runs BEFORE `bindFormSchema` so the
     * appended field columns exist when the schema binds to them. Validation
     * / editability formulas are carried on `FieldInfo` (the field type) via
     * the host's FieldManager, same as `createFormBlock`, so this only needs
     * to round-trip each field's value-formula template.
     */
    async editFormBlock(opts: {
        sheetIdx: number
        blockId: number
        currentColCnt: number
        refName: string
        keyIdx: number
        fields: readonly FormBlockField[]
        /** Option lists the fields reference; written in the same transaction. */
        enumSets?: readonly EnumSetDecl[]
    }): Promise<void> {
        const {sheetIdx, blockId, currentColCnt, refName, keyIdx, fields} = opts
        const newColCnt = fields.length
        if (newColCnt < currentColCnt) {
            throw new Error(
                `editFormBlock cannot remove fields: got ${newColCnt} field(s) ` +
                    `for a block with ${currentColCnt} column(s).`
            )
        }
        const payloads: Payload[] = []
        if (newColCnt !== currentColCnt) {
            payloads.push({
                type: 'resizeBlock',
                value: {
                    sheetIdx,
                    id: blockId,
                    newColCnt,
                },
            })
        }
        payloads.push(...enumSetPayloads(fields, opts.enumSets))
        payloads.push({
            type: 'bindFormSchema',
            value: {
                refName,
                sheetIdx,
                blockId,
                fieldFrom: 0,
                row: true,
                keyIdx: keyIdx < 0 ? 0 : keyIdx,
                fields: fields.map(toSchemaFieldSpec),
            },
        })
        payloads.push(
            ...fields.map((f) => ({
                type: 'upsertFieldRenderInfo' as const,
                value: {
                    renderId: f.renderId,
                    diyRender: f.diyRender,
                    styleUpdate: {setNumFmt: f.numFmt ?? ''},
                },
            }))
        )
        await this.apply(payloads, true)
    }

    /**
     * Rewrite ONE kind of per-field rule on a block, leaving the others alone.
     *
     * `formulas` is one entry per field, in the schema's field order — a rule
     * or `''` for none. The other two rule kinds are sent empty, which the
     * engine reads as "don't touch these", so editing a validation rule cannot
     * clear the value formulas standing next to it.
     *
     * Every existing row is re-materialized from the new rule, so this is also
     * how a rule is removed: pass `''` for that field.
     */
    async setFieldRules(opts: {
        sheetIdx: number
        blockId: number
        kind: 'value' | 'validation' | 'editability'
        formulas: readonly string[]
    }): Promise<void> {
        const {sheetIdx, blockId, kind, formulas} = opts
        const forKind = (k: typeof kind) =>
            kind === k ? formulas.map((f) => f ?? '') : []
        await this.apply(
            [
                {
                    type: 'upsertFieldFormulas',
                    value: {
                        sheetIdx,
                        blockId,
                        fieldFormulas: forKind('value'),
                        validationFormulas: forKind('validation'),
                        editabilityFormulas: forKind('editability'),
                    },
                },
            ],
            true
        )
    }

    // ---- analysis blocks ------------------------------------------------

    /**
     * Create the block that analyses `source`: a totals row placed directly
     * below it, declaring what it analyses and how each of its fields
     * aggregates. See `design/block-analysis.md`.
     *
     * **No formula is sent.** The engine generates each aggregate field's
     * formula from the declaration, which is what makes renaming a source
     * field rebuild the total instead of silently zeroing it. A field with no
     * aggregate stays an ordinary cell — that is the label column, and the
     * label is also the key the result is addressed by
     * (`BLOCKREF(refName, label, field)`).
     *
     * One transaction, so it is one undo, and so a reader between two payloads
     * never sees a one-row table it would mistake for a record.
     *
     * Returns what it aggregated, in column order, for the caller to report.
     */
    async createAnalysisBlock(opts: {
        source: AnalysisSource
        blockId: number
        refName: string
        label: string
        /**
         * Which source fields to aggregate and how. Omit for
         * {@link defaultAnalysisAggregates} — SUM over every field the source
         * DECLARES as a number.
         */
        aggregates?: readonly AnalysisAggregate[]
    }): Promise<readonly AnalysisAggregate[]> {
        const {source, blockId, refName, label} = opts
        const chosen = new Map<string, AggFunc>()
        for (const a of opts.aggregates ??
            defaultAnalysisAggregates(source.fields)) {
            if (!source.fields.some((f) => f.name === a.field)) {
                throw new Error(
                    `Cannot aggregate "${a.field}": the block has no such field.`
                )
            }
            chosen.set(a.field, a.func)
        }
        if (chosen.size === 0) {
            throw new Error(
                'Nothing to aggregate: no field of this block is declared a ' +
                    'number. Give a field the number type first, or choose ' +
                    'what to aggregate explicitly.'
            )
        }

        const row = source.rowStart + source.rowCnt
        const renderIdOf = (i: number) => `${refName}__agg${i}`
        await this.apply(
            [
                // Room first, or the block would land on whatever sits below
                // the table. This is also what pushes the pair apart as the
                // source grows, keeping them adjacent.
                {
                    type: 'insertRows',
                    value: {sheetIdx: source.sheetIdx, start: row, count: 1},
                },
                {
                    type: 'createBlock',
                    value: {
                        sheetIdx: source.sheetIdx,
                        id: blockId,
                        masterRow: row,
                        masterCol: source.colStart,
                        rowCnt: 1,
                        colCnt: source.fields.length,
                        analyzes: source.blockId,
                        description: `Analysis of "${source.refName}".`,
                    },
                },
                {
                    type: 'bindFormSchema',
                    value: {
                        refName,
                        sheetIdx: source.sheetIdx,
                        blockId,
                        fieldFrom: 0,
                        row: true,
                        keyIdx: source.keyIdx < 0 ? 0 : source.keyIdx,
                        fields: source.fields.map((f, i) => {
                            const func = chosen.get(f.name)
                            return {
                                name: f.name,
                                renderId: renderIdOf(i),
                                aggFunc: func,
                                aggField: func ? f.name : undefined,
                            }
                        }),
                    },
                },
                // The label, which is the key the result is addressed by.
                {
                    type: 'blockInput',
                    value: {
                        sheetIdx: source.sheetIdx,
                        blockId,
                        row: 0,
                        col: source.keyIdx < 0 ? 0 : source.keyIdx,
                        input: label,
                    },
                },
                // Carry each source column's number format across, so a total
                // is formatted like the column it totals rather than as a bare
                // number. A COUNT is the exception — it counts records, not
                // currency — so it is left plain.
                ...source.fields.map((f, i) => {
                    const func = chosen.get(f.name)
                    const keep =
                        func === undefined || aggregateKeepsFormat(func)
                    return {
                        type: 'upsertFieldRenderInfo' as const,
                        value: {
                            renderId: renderIdOf(i),
                            diyRender: false,
                            styleUpdate: {
                                setNumFmt: (keep ? f.numFmt : undefined) ?? '',
                            },
                        },
                    }
                }),
            ],
            true
        )

        return source.fields
            .filter((f) => chosen.has(f.name))
            .map((f) => ({field: f.name, func: chosen.get(f.name)!}))
    }

    /**
     * Change WHAT an existing analysis block computes — which source fields it
     * aggregates, with which function, and the label its row is addressed by.
     *
     * The shape never changes: an analysis block is one row with one column
     * per source field, so an edit is a re-bind and nothing else. That is the
     * whole difference from {@link editPivot}, where changing the recipe
     * changes how many rows and columns there are.
     *
     * Exists so an analysis can be arrived at in STEPS. The first guess (sum
     * every number) is often nearly right and occasionally wrong in one
     * column, and without this the only remedy was to delete the block and
     * build it again — losing its ref name, and with it every formula pointing
     * at it.
     */
    async editAnalysisBlock(opts: {
        sheetIdx: number
        /** The analysis block being edited. */
        blockId: number
        /** Its ref name, which the re-bind has to restate. */
        refName: string
        /** The block it analyses, for its field list and number formats. */
        source: AnalysisSource
        aggregates: readonly AnalysisAggregate[]
        /**
         * A new row label, or omit to leave it alone. Rewriting it re-aims
         * nothing — unlike a pivot key, an analysis block's label is just the
         * name its single row is addressed by.
         */
        label?: string
        /** Where the block sits, needed only when `label` is given. */
        rowStart?: number
        colStart?: number
    }): Promise<readonly AnalysisAggregate[]> {
        const {sheetIdx, blockId, refName, source} = opts
        const chosen = new Map<string, AggFunc>()
        for (const a of opts.aggregates) {
            if (!source.fields.some((f) => f.name === a.field)) {
                throw new Error(
                    `Cannot aggregate "${a.field}": the block has no such field.`
                )
            }
            chosen.set(a.field, a.func)
        }
        if (chosen.size === 0) {
            throw new Error(
                'Nothing to aggregate: choose at least one field and function.'
            )
        }

        const renderIdOf = (i: number) => `${refName}__agg${i}`
        const payloads: Payload[] = [
            {
                type: 'bindFormSchema',
                value: {
                    refName,
                    sheetIdx,
                    blockId,
                    fieldFrom: 0,
                    row: true,
                    keyIdx: source.keyIdx < 0 ? 0 : source.keyIdx,
                    fields: source.fields.map((f, i) => {
                        const func = chosen.get(f.name)
                        return {
                            name: f.name,
                            renderId: renderIdOf(i),
                            aggFunc: func,
                            aggField: func ? f.name : undefined,
                        }
                    }),
                },
            },
        ]
        const keyCol = source.keyIdx < 0 ? 0 : source.keyIdx
        if (opts.label !== undefined) {
            payloads.push({
                type: 'blockInput',
                value: {
                    sheetIdx,
                    blockId,
                    row: 0,
                    col: keyCol,
                    input: opts.label,
                },
            })
        }
        // Blank the columns this edit STOPPED computing.
        //
        // The engine drops the formula on its own — a generated cell with no
        // declaration must not keep one, or it would go on recomputing under a
        // heading that no longer claims it. What it does not do is clear the
        // VALUE the formula last produced: removing a formula normally leaves
        // its value behind, which is right everywhere else and wrong here, and
        // a re-bind gives the container no hook to say so. So the caller says
        // it. Never the key column — that holds the label.
        source.fields.forEach((f, i) => {
            if (i === keyCol || chosen.has(f.name)) return
            payloads.push({
                type: 'blockInput',
                value: {sheetIdx, blockId, row: 0, col: i, input: ''},
            })
        })
        // Formats last, for the same reason as everywhere else: they attach to
        // the render ids the bind declares. A column that stopped being a SUM
        // and became a COUNT stops being currency with it.
        payloads.push(
            ...source.fields.map((f, i) => {
                const func = chosen.get(f.name)
                const keep = func === undefined || aggregateKeepsFormat(func)
                return {
                    type: 'upsertFieldRenderInfo' as const,
                    value: {
                        renderId: renderIdOf(i),
                        diyRender: false,
                        styleUpdate: {
                            setNumFmt: (keep ? f.numFmt : undefined) ?? '',
                        },
                    },
                }
            })
        )

        await this.apply(payloads, true)
        return source.fields
            .filter((f) => chosen.has(f.name))
            .map((f) => ({field: f.name, func: chosen.get(f.name)!}))
    }

    // ---- pivots -----------------------------------------------------------

    /**
     * The label row a pivot carries directly above itself, as `cellInput`
     * payloads.
     *
     * A pivot's column names are DATA — they are the column dimension's own
     * values — but they live on the schema, which means the raw sheet shows a
     * grid of numbers with nothing to say what the columns are. Everything
     * that is not our own UI sees it that way: another tool, a person reading
     * the file, and Excel, whose pivot tables require the labels to be in
     * cells. So the pivot writes them there.
     *
     * The row sits OUTSIDE the block, immediately above it. Inside would break
     * what a block is: every row of a block is a record addressed by its key,
     * so a header row would become a record keyed "region" — captured by
     * `#KEY`, counted by the key-uniqueness guard, and aggregated by anything
     * reading the block.
     *
     * Rewritten in full whenever the column set can have changed, because a
     * label left behind from a previous shape is worse than no label: it names
     * a column that is now something else.
     */
    private pivotHeaderRow(opts: {
        sheetIdx: number
        blockId: number
        fieldNames: readonly string[]
    }): Payload[] {
        // Block-relative, so nothing here depends on where the block sits.
        // The header is one of the block's own lines — the schema says which —
        // so it travels with the block, which a row above it did not.
        //
        // Exactly the columns the block now has, and no attempt to blank the
        // ones a shrink dropped: those cells went with the columns. Reaching
        // past the block's width is not a harmless no-op either — a
        // `blockInput` outside the block fails the whole transaction, which is
        // how the old absolute-coordinate version hid the mistake.
        return opts.fieldNames.map((name, i) => ({
            type: 'blockInput' as const,
            value: {
                sheetIdx: opts.sheetIdx,
                blockId: opts.blockId,
                row: PIVOT_HEADER_ROW,
                col: i,
                input: name,
            },
        }))
    }

    /**
     * The number format each of a pivot's columns should carry, in the order
     * the columns are declared (`[key, ...value columns]`).
     *
     * Every column of a pivot aggregates ONE source column, so it is formatted
     * like that column. Which source column differs per kind:
     *
     * - the key column holds the row dimension's own values;
     * - a derived column is `func(measure)` from the recipe;
     * - a declared column (a row total, a second measure) names its own, and
     *   falls back to the recipe's for whatever it leaves out.
     *
     * A COUNT column is deliberately plain — see {@link aggregateKeepsFormat}.
     *
     * Returned as `''` rather than `undefined` for "no format", because the
     * payload is also how a format is CLEARED, and a refresh re-states every
     * column: `refreshPivot` reassigns render ids by position, so a column
     * that appears shifts the ids after it, and only restating all of them
     * keeps each format on the column it belongs to.
     */
    private pivotColumnFormats(opts: {
        fieldNames: readonly string[]
        measure: string
        func: AggFunc
        numFmts: Readonly<Record<string, string | undefined>>
        declared?: (
            name: string
        ) => {measure?: string; func?: string} | undefined
    }): string[] {
        const {fieldNames, numFmts} = opts
        const fmt = (field: string, func: AggFunc) =>
            (aggregateKeepsFormat(func) ? numFmts[field] : undefined) ?? ''
        return fieldNames.map((name, i) => {
            // Field 0 is the key column: the row dimension's values, named
            // after the dimension itself.
            if (i === 0) return numFmts[name] ?? ''
            const d = opts.declared?.(name)
            if (d)
                return fmt(
                    d.measure ?? opts.measure,
                    (d.func as AggFunc | undefined) ?? opts.func
                )
            return fmt(opts.measure, opts.func)
        })
    }

    /**
     * Create a pivot of `source`: a cross-tab whose rows are the distinct
     * values of `rowDim`, whose columns are the distinct values of `colDim`,
     * and whose cells are `func` over `measure`.
     *
     * **One transaction**, so it is one undo — which is why it asks the engine
     * for the shape BEFORE creating the block (`pivotPlanFor`). Creating first
     * and reshaping after would leave an empty declared pivot as an
     * intermediate state and take two undos to remove.
     *
     * No formula is sent. The engine generates every cell from the recipe plus
     * the cell's own row key and field name, which is what makes renaming a
     * source field rebuild the pivot instead of breaking it.
     *
     * Returns the shape it created, for the caller to report.
     */
    async createPivot(opts: {
        source: PivotSource
        blockId: number
        refName: string
        rowDim: string
        /** Omit for a grouped pivot: one value column, no cross-tab. */
        colDim?: string
        measure: string
        func: AggFunc
        order?: DimOrder
        /** The sequence for `order: 'custom'`. */
        orderValues?: readonly string[]
        /** Which source records to count at all. Omit to count every one. */
        filters?: readonly PivotFilter[]
        /**
         * Columns beyond the derived ones — a row total, a second measure.
         * Appended after the cross-tab's own columns.
         */
        extraColumns?: readonly PivotColumnSpec[]
        /**
         * Name of the pivot's single value column when `colDim` is omitted.
         * Ignored for a real cross-tab, whose column names ARE the dimension's
         * values.
         */
        valueColumn?: string
    }): Promise<{keys: string[]; fields: string[]; unassignedRecords: number}> {
        const {source, blockId, refName, rowDim, colDim, measure, func} = opts
        const spec = plainSpec({
            rowDim,
            colDim,
            measure,
            func,
            order: opts.order ?? 'ascending',
            // Always sent, even empty: the plan and the cells must agree
            // about what is counted, and an omitted list on one side only
            // would be exactly that disagreement.
            orderValues: opts.orderValues ?? [],
            filters: opts.filters ?? [],
        })
        const plan = await this.client.pivotPlanFor({
            sheetIdx: source.sheetIdx,
            sourceBlock: source.blockId,
            spec,
        })
        if (isErrorMessage(plan)) {
            throw new Error(plan.msg)
        }
        if (plan.keys.length === 0) {
            throw new Error(
                `Nothing to pivot: no record of "${source.refName}" has a value ` +
                    `for "${rowDim}", so the pivot would have no rows.`
            )
        }

        const extra = opts.extraColumns ?? []
        const valueFields = [
            ...(colDim ? plan.fields : [opts.valueColumn ?? measure]),
            ...extra.map((c) => c.name),
        ]
        // The block starts directly below the source and OWNS its header
        // line, so it is one row taller than it has groups.
        const row = source.rowStart + source.rowCnt
        // The key column is named after the row dimension: it holds that
        // dimension's values, and the name is what a reader sees.
        const fieldNames = [rowDim, ...valueFields]
        const rowCnt = plan.keys.length + 1

        await this.apply(
            [
                // Room first, so the pivot does not land on whatever sits
                // below the table.
                {
                    type: 'insertRows',
                    value: {
                        sheetIdx: source.sheetIdx,
                        start: row,
                        count: rowCnt,
                    },
                },
                {
                    type: 'createBlock',
                    value: {
                        sheetIdx: source.sheetIdx,
                        id: blockId,
                        masterRow: row,
                        masterCol: source.colStart,
                        rowCnt,
                        colCnt: fieldNames.length,
                        analyzes: source.blockId,
                        // Declared as it is created, so it is never briefly a
                        // stray table a reader would take for records.
                        pivot: spec,
                        description:
                            `Pivot of "${source.refName}": rows = ${rowDim}` +
                            (colDim ? `, columns = ${colDim}` : '') +
                            `, ${func} of ${measure}.`,
                    },
                },
                // The header names, and the keys, BOTH before the bind.
                // `#KEY` is captured when the bind materializes each row, so a
                // key written afterwards leaves that row filtering on "" — a
                // whole grid of zeros, no error.
                ...this.pivotHeaderRow({
                    sheetIdx: source.sheetIdx,
                    blockId,
                    fieldNames,
                }),
                ...plan.keys.map((key, i) => ({
                    type: 'blockInput' as const,
                    value: {
                        sheetIdx: source.sheetIdx,
                        blockId,
                        row: PIVOT_FIRST_RECORD + i,
                        col: 0,
                        input: key,
                    },
                })),
                {
                    type: 'bindFormSchema',
                    value: {
                        refName,
                        sheetIdx: source.sheetIdx,
                        blockId,
                        fieldFrom: 0,
                        keyIdx: 0,
                        row: true,
                        // The first line holds the field names, not a record.
                        headerIdx: PIVOT_HEADER_ROW,
                        // Field names ARE the column dimension's values.
                        // Nothing per-field is declared; the engine derives
                        // every cell from the recipe.
                        fields: fieldNames.map((name, i) => {
                            const declared = extra.find((c) => c.name === name)
                            return {
                                name,
                                renderId: `${refName}__p${i}`,
                                // Only a DECLARED column carries these; a
                                // derived one says nothing and the engine
                                // reads its name as the dimension value.
                                ...(declared
                                    ? {
                                          pivotColValue:
                                              declared.colValue ?? '*',
                                          pivotMeasure: declared.measure,
                                          pivotFunc: declared.func,
                                      }
                                    : {}),
                            }
                        }),
                    },
                },
                // After the bind, which is what declares the render ids these
                // attach to. A pivot of a currency column reads as currency.
                ...this.pivotColumnFormats({
                    fieldNames,
                    measure,
                    func,
                    numFmts: source.numFmts ?? {},
                    declared: (name) => extra.find((c) => c.name === name),
                }).map((numFmt, i) => ({
                    type: 'upsertFieldRenderInfo' as const,
                    value: {
                        renderId: `${refName}__p${i}`,
                        diyRender: false,
                        styleUpdate: {setNumFmt: numFmt},
                    },
                })),
            ],
            true
        )

        return {
            keys: [...plan.keys],
            fields: valueFields,
            unassignedRecords: plan.unassignedRecords,
        }
    }

    /**
     * Bring a pivot's SHAPE back in line with its source: add rows for groups
     * that appeared, drop rows for groups that are gone, same for columns.
     *
     * Its numbers were never stale — they are live formulas. Only the set of
     * rows and columns needs this, because no formula can add a row.
     *
     * One transaction, and the payload order is not negotiable
     * (`design/block-pivot.md` §6): grow, write the keys, bind, shrink. Keys
     * before the bind because `#KEY` is captured at materialization; grow
     * before the bind because a field cannot bind to a column that does not
     * exist; shrink after, so nothing is left bound to a vanishing column.
     *
     * Returns what changed, or `null` when the pivot was already current — so
     * a caller can say "nothing to do" instead of reporting an empty refresh.
     */
    async refreshPivot(opts: {
        sheetIdx: number
        blockId: number
        /** The pivot's ref name, which the re-bind has to restate. */
        refName: string
        /** Its key field's name — the column holding the row dimension. */
        keyField: string
        /**
         * The pivot's CURRENT schema fields, so a re-bind can restate any
         * column that was declared by hand.
         *
         * Without them the re-bind would rewrite every column as a derived
         * one, silently turning a row total into a column filtering on the
         * literal value "Total" — which matches nothing and reads 0.
         */
        currentFields?: ReadonlyArray<{
            field: string
            pivotColValue?: string
            pivotMeasure?: string
            pivotFunc?: string
        }>
        /**
         * Number format per SOURCE field name, and the recipe the pivot runs,
         * so a column the refresh ADDS is formatted like the columns beside it
         * instead of arriving as a bare number.
         *
         * Both or neither: without the recipe there is no way to know which
         * source column a derived column aggregates. Omit to leave every
         * format alone.
         */
        formats?: {
            numFmts: Readonly<Record<string, string | undefined>>
            measure: string
            func: AggFunc
        }
    }): Promise<PivotRefresh | null> {
        // No sheet coordinates: the keys and the header are written
        // block-relative now, so a caller cannot get them wrong. It used to
        // take `rowStart`, and a stale one wrote the keys outside the block —
        // silently, because a key nobody reads just leaves the row filtering
        // on the value it already had.
        const {sheetIdx, blockId, refName, keyField} = opts
        const plan = await this.client.pivotPlan({sheetIdx, blockId})
        if (isErrorMessage(plan)) {
            throw new Error(plan.msg)
        }
        if (!plan.isStale) return null

        // A grouped pivot plans no columns, so it keeps the ones it has.
        const fields =
            plan.fields.length > 0 ? [...plan.fields] : [...plan.currentFields]
        const fieldNames = [keyField, ...fields]
        // The block owns its header line, so it is one row taller than it has
        // groups.
        const newRowCnt = plan.keys.length + 1
        const newColCnt = fieldNames.length
        const payloads: Payload[] = []
        // ONE resize, to the final size, BEFORE the bind — in both directions.
        //
        // Growing first is obvious: a field cannot bind to a column that does
        // not exist. Shrinking first is the part that cost something to learn:
        // a `ResizeBlock` sent AFTER a bind leaves the generated formulas
        // uncalculated, so a refresh that dropped a group left every surviving
        // row BLANK — the keys were right and the numbers were gone. It is the
        // same hazard as the no-op resize in
        // `refreshing_a_pivot_with_a_trailing_no_op_resize_loses_the_new_row`,
        // and the rule that covers both is: never resize a block after binding
        // it. Nothing is orphaned, because the bind that follows states the
        // surviving fields and only those.
        if (
            newRowCnt !== plan.currentKeys.length + 1 ||
            newColCnt !== plan.currentFields.length + 1
        ) {
            payloads.push({
                type: 'resizeBlock',
                value: {sheetIdx, id: blockId, newRowCnt, newColCnt},
            })
        }
        payloads.push(
            // The labels, in full: a refresh can add or drop columns, and a
            // label left over from the old shape names a column that is now
            // something else.
            ...this.pivotHeaderRow({
                sheetIdx,
                blockId,
                fieldNames,
            }),
            ...plan.keys.map((key, i) => ({
                type: 'blockInput' as const,
                value: {
                    sheetIdx,
                    blockId,
                    row: PIVOT_FIRST_RECORD + i,
                    col: 0,
                    input: key,
                },
            })),
            {
                type: 'bindFormSchema',
                value: {
                    refName,
                    sheetIdx,
                    blockId,
                    fieldFrom: 0,
                    keyIdx: 0,
                    row: true,
                    // Restated: the bind states the whole interpretation, so
                    // omitting this would turn the header line into a record.
                    headerIdx: PIVOT_HEADER_ROW,
                    fields: fieldNames.map((name, i) => {
                        const was = opts.currentFields?.find(
                            (f) => f.field === name
                        )
                        return {
                            name,
                            renderId: `${refName}__p${i}`,
                            // Restated verbatim. A declared column is not
                            // derived from the data, so a refresh has no
                            // business reinterpreting it.
                            ...(was?.pivotColValue !== undefined
                                ? {
                                      pivotColValue: was.pivotColValue,
                                      pivotMeasure: was.pivotMeasure,
                                      pivotFunc: was.pivotFunc,
                                  }
                                : {}),
                        }
                    }),
                },
            }
        )
        // EVERY column is restated: render ids are assigned by position,
        // so a column that appears shifts the ids after it and each format
        // would otherwise stay behind on the wrong column.
        if (opts.formats) {
            payloads.push(
                ...this.pivotColumnFormats({
                    fieldNames,
                    measure: opts.formats.measure,
                    func: opts.formats.func,
                    numFmts: opts.formats.numFmts,
                    declared: (name) => {
                        const was = opts.currentFields?.find(
                            (f) => f.field === name
                        )
                        return was?.pivotColValue !== undefined
                            ? {
                                  measure: was.pivotMeasure,
                                  func: was.pivotFunc,
                              }
                            : undefined
                    },
                }).map((numFmt, i) => ({
                    type: 'upsertFieldRenderInfo' as const,
                    value: {
                        renderId: `${refName}__p${i}`,
                        diyRender: false,
                        styleUpdate: {setNumFmt: numFmt},
                    },
                }))
            )
        }

        await this.apply(payloads, true)
        return {
            addedKeys: [...plan.missingKeys],
            removedKeys: [...plan.extraKeys],
            addedFields: [...plan.missingFields],
            removedFields: [...plan.extraFields],
            unassignedRecords: plan.unassignedRecords,
        }
    }

    /**
     * Change a pivot's RECIPE — what it groups by, what it measures, how, in
     * what order, over which records — and reshape it to match, in one
     * transaction.
     *
     * A recipe is not editable in place by hand: a pivot's numbers are
     * generated from it, its column names ARE the column dimension's values,
     * and its key column holds the row dimension's. Changing any of those by
     * typing produces a table that says one thing and computes another —
     * editing a row label does not re-aim the row, it relabels a group.
     *
     * Deliberately does NOT ask for the current plan. The commonest reason to
     * edit is that the recipe has stopped resolving (a source field renamed
     * out from under it, say), and planning the OLD recipe would fail exactly
     * then. The caller states the block's present size instead, which it can
     * always see.
     *
     * Payload order, for the same reasons as §6 with one addition: the RECIPE
     * goes before the bind, because the bind is what regenerates every cell
     * from it — set it after and the block re-materializes from the old one.
     *
     *   grow (if growing) → recipe → keys → bind → shrink (only if shrinking)
     *
     * Returns the shape it produced.
     */
    async editPivot(opts: {
        sheetIdx: number
        /** The pivot being edited. */
        blockId: number
        /** Its ref name, which the re-bind has to restate. */
        refName: string
        /** The block it analyses: what the new recipe is planned against. */
        source: PivotSource

        /**
         * Its present size, so the reshape knows whether it grows or shrinks.
         * Asked for rather than planned, so a broken recipe can still be
         * fixed — which is most of the point of this method.
         */
        currentRowCnt: number
        currentColCnt: number
        rowDim: string
        colDim?: string
        measure: string
        func: AggFunc
        order?: DimOrder
        orderValues?: readonly string[]
        filters?: readonly PivotFilter[]
        extraColumns?: readonly PivotColumnSpec[]
        valueColumn?: string
    }): Promise<{keys: string[]; fields: string[]; unassignedRecords: number}> {
        const {
            sheetIdx,
            blockId,
            refName,
            source,
            rowDim,
            colDim,
            measure,
            func,
        } = opts
        // Rebuilt by value: an edit's recipe usually comes from the block
        // itself, and passing that back through the worker unchanged fails to
        // clone.
        const spec = plainSpec({
            rowDim,
            colDim,
            measure,
            func,
            order: opts.order ?? 'ascending',
            orderValues: opts.orderValues ?? [],
            filters: opts.filters ?? [],
        })
        const plan = await this.client.pivotPlanFor({
            sheetIdx,
            sourceBlock: source.blockId,
            spec,
        })
        if (isErrorMessage(plan)) {
            throw new Error(plan.msg)
        }
        if (plan.keys.length === 0) {
            throw new Error(
                `Nothing to pivot: no record of "${source.refName}" has a value ` +
                    `for "${rowDim}", so the pivot would have no rows.`
            )
        }

        const extra = opts.extraColumns ?? []
        const valueFields = [
            ...(colDim ? plan.fields : [opts.valueColumn ?? measure]),
            ...extra.map((c) => c.name),
        ]
        // The key column is named after the row dimension, which the edit may
        // have just changed.
        const fieldNames = [rowDim, ...valueFields]
        // One line taller than it has groups: the block owns its header.
        const newRowCnt = plan.keys.length + 1
        const newColCnt = fieldNames.length

        const payloads: Payload[] = []
        // ONE resize, to the final size, BEFORE the bind — in both directions.
        //
        // A refresh has to grow before and shrink after, because it keeps the
        // old rows' keys and only adds to them. An edit rewrites every key, so
        // it can take the block to its final size first and then bind onto it
        // — which is the safer order: a `ResizeBlock` sent AFTER a bind leaves
        // the generated formulas uncalculated, showing the value each cell had
        // before the edit under its new formula. Resizing first also means the
        // rows a shrink drops are gone before the new keys are written, so a
        // key that already exists further down is not briefly a duplicate.
        if (
            newRowCnt !== opts.currentRowCnt ||
            newColCnt !== opts.currentColCnt
        ) {
            payloads.push({
                type: 'resizeBlock',
                value: {sheetIdx, id: blockId, newRowCnt, newColCnt},
            })
        }
        payloads.push(
            // The labels, in full — an edit can change the whole column set.
            ...this.pivotHeaderRow({
                sheetIdx,
                blockId,
                fieldNames,
            }),
            // The new recipe, BEFORE the bind that regenerates from it.
            {
                type: 'setBlockAnalyzes',
                value: {
                    sheetIdx,
                    blockId,
                    analyzes: source.blockId,
                    pivot: spec,
                },
            },
            // Keys before the bind: `#KEY` is captured at materialization.
            ...plan.keys.map((key, i) => ({
                type: 'blockInput' as const,
                value: {
                    sheetIdx,
                    blockId,
                    row: PIVOT_FIRST_RECORD + i,
                    col: 0,
                    input: key,
                },
            })),
            {
                type: 'bindFormSchema',
                value: {
                    refName,
                    sheetIdx,
                    blockId,
                    fieldFrom: 0,
                    keyIdx: 0,
                    row: true,
                    // Restated: the bind states the whole interpretation, so
                    // omitting this would turn the header line into a record.
                    headerIdx: PIVOT_HEADER_ROW,
                    fields: fieldNames.map((name, i) => {
                        const declared = extra.find((c) => c.name === name)
                        return {
                            name,
                            renderId: `${refName}__p${i}`,
                            ...(declared
                                ? {
                                      pivotColValue: declared.colValue ?? '*',
                                      pivotMeasure: declared.measure,
                                      pivotFunc: declared.func,
                                  }
                                : {}),
                        }
                    }),
                },
            }
        )
        payloads.push(
            ...this.pivotColumnFormats({
                fieldNames,
                measure,
                func,
                numFmts: source.numFmts ?? {},
                declared: (name) => extra.find((c) => c.name === name),
            }).map((numFmt, i) => ({
                type: 'upsertFieldRenderInfo' as const,
                value: {
                    renderId: `${refName}__p${i}`,
                    diyRender: false,
                    styleUpdate: {setNumFmt: numFmt},
                },
            }))
        )

        await this.apply(payloads, true)
        return {
            keys: [...plan.keys],
            fields: valueFields,
            unassignedRecords: plan.unassignedRecords,
        }
    }

    // ---- generic / temp-branch -----------------------------------------

    /**
     * Apply a caller-built payload list as one transaction (at the host's
     * temp-mode). Escape hatch for operations whose payload construction still
     * lives in the host — e.g. the toolbar's format/border generators. Prefer
     * a named method above when one exists; this exists so no caller has to
     * reach past WorkbookOps to `client.handleTransaction` directly.
     */
    applyPayloads(
        payloads: readonly Payload[],
        undoable = true
    ): Promise<ActionEffect> {
        return this.apply(payloads, undoable)
    }

    /** Commit the workbook's temp (speculative) branch into the main branch. */
    async commitTempStatus(): Promise<void> {
        const res = await this.client.commitTempStatus()
        if (isErrorMessage(res)) {
            throw new Error('Failed to commit temp status: ' + res.msg)
        }
    }

    /** Discard the workbook's temp (speculative) branch. */
    async cleanupTempStatus(): Promise<void> {
        const res = await this.client.cleanupTempStatus()
        if (isErrorMessage(res)) {
            throw new Error('Failed to clean up temp status: ' + res.msg)
        }
    }

    // ---- validation -----------------------------------------------------

    /**
     * Establish (or refresh) the validation rule for a cell.
     *
     * A validation rule is an Excel formula (no leading `=`) that should
     * evaluate to a boolean. We park it in the cell's *shadow* cell so the
     * engine evaluates it reactively; the host reads the shadow value back and
     * renders the result (see logisheets-core's `interpretValidation`).
     *
     * Lifted verbatim out of the browser's ValidationCell component so the
     * Node runtime gets the same operation.
     */
    async setValidationRule(
        sheetIdx: number,
        row: number,
        col: number,
        formula: string
    ): Promise<SheetCellId> {
        const shadow = await this.client.getShadowCellId({
            sheetIdx,
            rowIdx: row,
            colIdx: col,
        })
        if (isErrorMessage(shadow)) {
            throw new Error('Failed to get shadow cell id: ' + shadow.msg)
        }
        await this.apply(
            [
                {
                    type: 'ephemeralCellInput',
                    value: {
                        id: shadow.cellId.value as number,
                        sheetIdx,
                        content: `=${formula}`,
                    },
                },
            ],
            false
        )
        // Return the shadow's stable id so callers can cache it and later read
        // the verdict back by id (see {@link checkValidationShadows}) without
        // re-resolving the cell's coordinates.
        return shadow
    }

    /**
     * Read a set of *installed* validation shadows by their ids and interpret
     * each — the read half of {@link setValidationRule}.
     *
     * The engine evaluates each shadow reactively (with `#PLACEHOLDER` bound to
     * its target cell), so a caller that cached the shadow ids at install time
     * gets the up-to-date verdicts here in a single batch read, with no
     * coordinate resolution. `rule` is carried only into the returned
     * {@link Violation} for reporting; the evaluation is entirely the engine's.
     *
     * Returns one {@link Violation} per failing cell (passing cells and empty
     * shadows contribute nothing), in input order.
     */
    async checkValidationShadows(
        entries: readonly {shadow: SheetCellId; rule: ValidationRule}[]
    ): Promise<Violation[]> {
        if (entries.length === 0) return []
        const infos = await this.client.batchGetCellInfoById({
            ids: entries.map((e) => e.shadow),
        })
        if (isErrorMessage(infos)) {
            throw new Error('Failed to read shadow cells: ' + infos.msg)
        }
        const out: Violation[] = []
        for (let i = 0; i < entries.length; i++) {
            const info = infos[i]
            if (!info) continue
            const violation = interpretValidation(entries[i].rule, info.value)
            if (violation) out.push(violation)
        }
        return out
    }

    /**
     * Evaluate an Excel formula (no leading `=`) in a sheet and return its
     * Value. Parks the formula in a throwaway ephemeral cell, reads the result
     * back, and leaves no committed change — the same mechanism the browser
     * uses for shadow cells, here for one-shot evaluation.
     */
    async evalFormula(sheetIdx: number, formula: string): Promise<Value> {
        const id = this.ephemeralSeq++
        await this.apply(
            [
                {
                    type: 'ephemeralCellInput',
                    value: {id, sheetIdx, content: '=' + formula},
                },
            ],
            false
        )
        const sheetId = await this.client.getSheetId({sheetIdx})
        if (isErrorMessage(sheetId)) {
            throw new Error('Failed to resolve sheet id: ' + sheetId.msg)
        }
        const infos = await this.client.batchGetCellInfoById({
            ids: [{sheetId, cellId: {type: 'ephemeralCell', value: id}}],
        })
        if (isErrorMessage(infos)) {
            throw new Error('Failed to read ephemeral cell: ' + infos.msg)
        }
        return infos[0].value
    }

    /**
     * Evaluate formula-based validation rules and return the violating cells.
     * Headless batch check — the per-cell browser path uses setValidationRule +
     * interpretValidation instead.
     */
    async checkValidations(
        rules: readonly ValidationRule[]
    ): Promise<Violation[]> {
        const values = new Map<string, Value>()
        for (const rule of rules) {
            values.set(
                rule.formula,
                await this.evalFormula(rule.sheetIdx, rule.formula)
            )
        }
        return checkValidationsPure(
            rules,
            (_sheetIdx, formula) => values.get(formula) as Value
        )
    }
}
