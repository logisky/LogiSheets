import {action, makeObservable, observable} from 'mobx'
import {CanvasStore} from './store'
import {isFormula} from '@/core/snippet'
import initFc, {
    formula_check,
} from '../../../../crates/wasms/fc/pkg/logisheets_wasm_fc'
import {Context} from '@/components/textarea'
import {
    CellInputBuilder,
    isErrorMessage,
    Payload,
    Transaction,
} from 'logisheets-web'
import {Cell} from '../defs'
import {StandardKeyboardEvent} from '@/core/events'
import {shallowCopy} from '@/core'

export class Textarea {
    constructor(public readonly store: CanvasStore) {
        makeObservable(this)
    }
    @observable.ref
    context?: Context

    @observable
    editing = false

    @observable
    currText = ''

    @action
    async blur() {
        if (!this.editing) return true
        const newText = this.currText.trim()
        const checked = await checkFormula(newText)
        if (!checked || !this.context?.bindingData) return false
        const payload = new CellInputBuilder()
            .row(this.context.bindingData.coordinate.startRow)
            .col(this.context.bindingData.coordinate.startCol)
            .sheetIdx(this.store.dataSvc.getCurrentSheetIdx())
            .content(newText)
            .build() as Payload
        this.store.dataSvc.handleTransaction(new Transaction([payload], true))
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
            type,
        } = startCell
        const pos = this.store.convertToMainCanvasPosition(position, type)
        const x = pos.startCol
        const y = pos.startRow
        const sheet = this.store.dataSvc.getCurrentSheetIdx()
        const info = this.store.dataSvc.getCellInfo(sheet, row, col)
        info.then((c) => {
            if (isErrorMessage(c)) return
            const text =
                c.getFormula() === '' ? c.getFormula() : c.getText() ?? ''
            const rect = this.store.renderer.canvas.getBoundingClientRect()
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
            this._setEditing(true, context)
        })
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
        if (isEditing && this.currText) {
            this.store.highlights.update(this.currText)
        }
    }
}

const checkFormula = async (formula: string) => {
    if (!isFormula(formula)) return true
    await initFc()
    return formula_check(formula)
}
