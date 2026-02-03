import {action, makeObservable, observable} from 'mobx'
import {CanvasStore} from './store'
import {isFormula} from '@/core/snippet'
import initFc, {
    formula_check,
} from '../../../../crates/wasms/fc/pkg/logisheets_wasm_fc'
import {
    CellInputBuilder,
    isErrorMessage,
    Payload,
    Transaction,
} from 'logisheets-web'
import {Cell} from '../defs'
import {StandardKeyboardEvent} from '@/core/events'
import type {Grid} from '@/core/worker/types'
import {xForColStart, yForRowStart} from '../grid_helper'
import {LeftTop} from '@/core/settings'

/**
 * Editor context - simplified version for the new FormulaEditor
 */
export interface EditorContext {
    /** Initial text to edit (including leading '=' for formulas) */
    text: string
    /** Current sheet name */
    sheetName: string
    /** The cell being edited */
    cell: Cell
    /** Position on canvas */
    position: {
        x: number
        y: number
        width: number
        height: number
    }
    /** Initial cursor position: 'start' or 'end' */
    cursorPosition: 'start' | 'end'
}

export class Textarea {
    constructor(public readonly store: CanvasStore) {
        makeObservable(this)
    }

    @observable.ref
    context?: EditorContext

    @observable
    editing = false

    private _currText = ''

    getText() {
        return this._currText
    }

    @action
    async blur(finalText?: string) {
        if (!this.editing) return true
        const newText = (finalText ?? this._currText).trim()
        const checked = await checkFormula(newText)
        if (!checked || !this.context?.cell) return false

        const cell = this.context.cell
        if (cell.type !== 'Cell') return false

        const payload: Payload = {
            type: 'cellInput',
            value: new CellInputBuilder()
                .row(cell.coordinate.startRow)
                .col(cell.coordinate.startCol)
                .sheetIdx(this.store.dataSvc.getCurrentSheetIdx())
                .content(newText)
                .build(),
        }
        await this.store.dataSvc.handleTransaction(
            new Transaction([payload], true)
        )
        this._setEditing(false)
        return true
    }

    @action
    cancel() {
        this._setEditing(false)
    }

    @action
    keydown(e: KeyboardEvent, startCell?: Cell) {
        const standardEvent = new StandardKeyboardEvent(e)
        if (standardEvent.isKeyBinding) return
        if (startCell === undefined) return
        if (startCell.type !== 'Cell') return

        // Start editing with empty text (overwrite mode)
        this._startEditing(startCell, '')
    }

    @action
    mousedown(event: MouseEvent) {
        const startCell = this.store.startCell
        const now = Date.now()
        const isDoubleClick = now - this._lastMousedownTime < 300
        this._lastMousedownTime = now

        if (startCell === undefined) return
        if (startCell.type !== 'Cell' || !this.store.same) {
            this._setEditing(false)
            return
        }
        if (!isDoubleClick) {
            this._setEditing(false)
            return
        }

        // Double click - start editing with current cell content
        const {
            coordinate: {startRow: row, startCol: col},
        } = startCell
        const sheet = this.store.dataSvc.getCurrentSheetIdx()
        const info = this.store.dataSvc.getCellInfo(sheet, row, col)
        info.then((c) => {
            if (isErrorMessage(c)) return

            let text = c.getText()
            if (c.getFormula() !== '') {
                text = `=${c.getFormula()}`
            }
            this._startEditing(startCell, text)
        })
    }

    /**
     * Start editing by direct typing: always overwrite existing content.
     * Optionally seed with an initial string (e.g. the first typed character).
     */
    @action
    beginDirectTyping(initialText = '') {
        const startCell = this.store.startCell
        if (!startCell) return
        if (startCell.type !== 'Cell') return
        if (!this.store.same) this._setEditing(false)

        this._startEditing(startCell, initialText)
    }

    @action
    updateGrid(grid: Grid) {
        if (!this.context) return
        const cell = this.context.cell
        if (cell.type !== 'Cell') return

        const row = cell.coordinate.startRow
        const col = cell.coordinate.startCol

        if (
            row < grid.rows[0].idx ||
            col < grid.columns[0].idx ||
            row > grid.rows[grid.rows.length - 1].idx ||
            col > grid.columns[grid.columns.length - 1].idx
        ) {
            // Cell is out of visible range - hide editor
            this.context = {
                ...this.context,
                position: {
                    ...this.context.position,
                    x: -9999,
                    y: -9999,
                },
            }
        } else {
            const startX = xForColStart(col, grid) + LeftTop.width
            const startY = yForRowStart(row, grid) + LeftTop.height
            this.context = {
                ...this.context,
                position: {
                    ...this.context.position,
                    x: startX,
                    y: startY,
                },
            }
        }
    }

    @action
    reset() {
        this._setEditing(false)
    }

    private _lastMousedownTime = 0

    @action
    private _startEditing(
        cell: Cell,
        text: string,
        cursorPosition: 'start' | 'end' = 'end'
    ) {
        if (cell.type !== 'Cell') return

        const {height, width, position} = cell
        const pos = this.store.convertToMainCanvasPosition(position)

        const context: EditorContext = {
            text,
            sheetName: this.store.dataSvc.getCurrentSheetName(),
            cell,
            position: {
                x: pos.startCol,
                y: pos.startRow,
                width: Math.max(width, 100), // Minimum width
                height,
            },
            cursorPosition,
        }

        this._currText = text
        this.context = context
        this.editing = true
    }

    @action
    private _setEditing(isEditing: boolean) {
        if (!isEditing) {
            this.editing = false
            this.context = undefined
            this._currText = ''
        }
    }
}

const checkFormula = async (formula: string) => {
    if (!isFormula(formula)) return true
    await initFc()
    return formula_check(formula)
}
