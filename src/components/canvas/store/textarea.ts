import {action, makeObservable, observable} from 'mobx'
import {CanvasStore} from './store'
import {isFormula} from '@/core/snippet'
import initFc, {
    formula_check,
} from '../../../../crates/wasms/fc/pkg/logisheets_wasm_fc'
import {Context} from '@/components/textarea'
import {
    CellInputBuilder,
    FormulaDisplayInfo,
    isErrorMessage,
    Payload,
    Transaction,
} from 'logisheets-web'
import {Cell} from '../defs'
import {StandardKeyboardEvent} from '@/core/events'
import {shallowCopy} from '@/core'
import type {Grid} from '@/core/worker/types'
import {xForColStart, yForRowStart} from '../grid_helper'
import {LeftTop} from '@/core/settings'

export class Textarea {
    constructor(public readonly store: CanvasStore) {
        makeObservable(this)
    }
    @observable.ref
    context?: Context

    @observable
    editing = false

    private _currText = ''

    async updateText(t: string): Promise<FormulaDisplayInfo | undefined> {
        this._currText = t
        if (t.startsWith('=')) {
            return this.store.dataSvc
                .getWorkbook()
                .getDisplayUnitsOfFormula(t.slice(1))
                .then((displayInfo) => {
                    if (isErrorMessage(displayInfo)) return
                    return displayInfo
                })
        }
        return Promise.resolve(undefined)
    }

    getText() {
        return this._currText
    }

    @action
    async blur() {
        if (!this.editing) return true
        const newText = this._currText.trim()
        const checked = await checkFormula(newText)
        if (!checked || !this.context?.bindingData) return false
        const payload: Payload = {
            type: 'cellInput',
            value: new CellInputBuilder()
                .row(this.context.bindingData.coordinate.startRow)
                .col(this.context.bindingData.coordinate.startCol)
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
    keydown(e: KeyboardEvent, startCell?: Cell) {
        const standardEvent = new StandardKeyboardEvent(e)
        if (standardEvent.isKeyBinding) return
        if (startCell === undefined) return
        if (startCell.type !== 'Cell') return
        if (this.context === undefined) return
        const newContext = new Context<Cell>()
        shallowCopy(this.context, newContext)
        newContext.textareaOffsetX = -1
        newContext.textareaOffsetY = -1
        this._setEditing(true, newContext)
    }

    @action
    mousedown(event: MouseEvent) {
        const startCell = this.store.startCell
        const now = Date.now()
        const editing = now - this._lastMousedownTime < 300
        this._lastMousedownTime = now
        if (startCell === undefined) return
        if (startCell.type !== 'Cell' || !this.store.same) {
            this._setEditing(false)
            return
        }
        if (!editing) {
            this._setEditing(false)
            return
        }
        const {
            height,
            width,
            coordinate: {startRow: row, startCol: col},
            position,
        } = startCell
        const pos = this.store.convertToMainCanvasPosition(position)
        const x = pos.startCol
        const y = pos.startRow
        const sheet = this.store.dataSvc.getCurrentSheetIdx()
        const info = this.store.dataSvc.getCellInfo(sheet, row, col)
        info.then((c) => {
            if (isErrorMessage(c)) return

            let text = c.getText()
            if (c.getFormula() !== '') {
                text = `=${c.getFormula()}`
            }
            // const rect = this.store.renderer.canvas.getBoundingClientRect()
            const rect = {
                x: 0,
                y: 0,
                width: 100,
                height: 100,
            }
            const [clientX, clientY] = [rect.x + x, rect.y + y]
            const context = new Context()
            context.text = text
            context.canvasOffsetX = x
            context.canvasOffsetY = y
            context.clientX = clientX ?? -1
            context.clientY = clientY ?? -1
            context.cellHeight = height
            context.cellWidth = width
            context.bindingData = startCell
            context.textareaOffsetX =
                (event as globalThis.MouseEvent).clientX - clientX
            context.textareaOffsetY =
                (event as globalThis.MouseEvent).clientY - clientY
            context.sheetName = this.store.dataSvc.getCurrentSheetName()
            this._currText = text
            this._setEditing(true, context)
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

        const {height, width, position} = startCell
        const pos = this.store.convertToMainCanvasPosition(position)
        const x = pos.startCol
        const y = pos.startRow

        // const rect = this.store.renderer.canvas.getBoundingClientRect()
        const rect = {x: 0, y: 0, width: 100, height: 100}
        const [clientX, clientY] = [rect.x + x, rect.y + y]
        const context = new Context()
        context.text = initialText
        context.canvasOffsetX = x
        context.canvasOffsetY = y
        context.clientX = clientX ?? -1
        context.clientY = clientY ?? -1
        context.cellHeight = height
        context.cellWidth = width
        context.bindingData = startCell
        context.textareaOffsetX = -1
        context.textareaOffsetY = -1
        context.sheetName = this.store.dataSvc.getCurrentSheetName()
        this._currText = initialText
        this._setEditing(true, context)
    }

    @action
    updateGrid(grid: Grid) {
        if (!this.context) return
        const context = new Context()
        shallowCopy(this.context, context)
        const row = this.context?.bindingData.coordinate.startRow
        const col = this.context?.bindingData.coordinate.startCol

        if (
            row < grid.rows[0].idx ||
            col < grid.columns[0].idx ||
            row > grid.rows[grid.rows.length - 1].idx ||
            col > grid.columns[grid.columns.length - 1].idx
        ) {
            context.visible = false
        } else {
            const startX = xForColStart(col, grid) + LeftTop.width
            const startY = yForRowStart(row, grid) + LeftTop.height
            context.visible = true
            context.canvasOffsetX = startX
            context.canvasOffsetY = startY
        }
        this.context = context
    }

    @action
    reset() {
        this._setEditing(false)
    }

    private _lastMousedownTime = 0

    @action
    private _setEditing(isEditing: boolean, context?: Context) {
        if (isEditing === this.editing) return
        this.editing = isEditing
        this.context = context
        if (isEditing) {
            if (this._currText !== '') {
                this.updateText(this._currText)
            }
        } else {
            this._currText = ''
        }
    }
}

const checkFormula = async (formula: string) => {
    if (!isFormula(formula)) return true
    await initFc()
    return formula_check(formula)
}
