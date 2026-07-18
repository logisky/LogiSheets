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
import {
    checkFieldConstraints as checkFieldConstraintsPure,
    type FieldColumn,
} from '../field/index.js'
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
    /** Whether the field renders via a host-drawn (DIY) overlay. */
    diyRender: boolean
    /** Number format applied to the field's render info. */
    numFmt?: string
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
            {
                type: 'bindFormSchema',
                value: {
                    refName,
                    sheetIdx,
                    blockId,
                    fieldFrom: 0,
                    row: true,
                    keyIdx: keyIdx < 0 ? 0 : keyIdx,
                    fields: fields.map((f) => f.name),
                    renderIds: fields.map((f) => f.renderId),
                    fieldFormulas: fields.map((f) => f.valueFormula ?? ''),
                    validationFormulas: [],
                    editabilityFormulas: [],
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
            {
                type: 'bindFormSchema',
                value: {
                    refName,
                    sheetIdx,
                    blockId,
                    fieldFrom: 0,
                    row: true,
                    keyIdx: keyIdx < 0 ? 0 : keyIdx,
                    fields: fields.map((f) => f.name),
                    renderIds: fields.map((f) => f.renderId),
                    fieldFormulas: fields.map((f) => f.valueFormula ?? ''),
                    validationFormulas: [],
                    editabilityFormulas: [],
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

    /** Check required / unique / membership field constraints. */
    async checkFieldConstraints(
        columns: readonly FieldColumn[]
    ): Promise<Violation[]> {
        const values = new Map<string, Value>()
        for (const {cells} of columns) {
            for (const c of cells) {
                const key = `${c.sheetIdx}:${c.row}:${c.col}`
                if (values.has(key)) continue
                const v = await this.client.getValue({
                    sheetIdx: c.sheetIdx,
                    row: c.row,
                    col: c.col,
                })
                if (isErrorMessage(v)) {
                    throw new Error('Failed to read cell value: ' + v.msg)
                }
                values.set(key, v)
            }
        }
        return checkFieldConstraintsPure(columns, (sheetIdx, row, col) => {
            const v = values.get(`${sheetIdx}:${row}:${col}`)
            return (v ?? 'empty') as Value
        })
    }
}
