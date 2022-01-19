import {Subject, Observable, Subscription} from 'rxjs'
import {DataService} from '@logi-sheets/web/core/data'
import {Context, ContextBuilder} from '@logi-sheets/web/app/textarea'
import {StandardKeyboardEvent} from '@logi-sheets/web/core/events'
import {StartCellManager} from './start-cell-manager'

export class TextManager extends Subscription{
    constructor(
        public readonly dataSvc: DataService,
        public readonly startCellMng: StartCellManager,
        public readonly canvas: HTMLCanvasElement,
    ) {
        super()
        this._init()
    }
    editing$(): Observable<boolean> {
        return this._editing$
    }

    blur(): void {
        this._setEditing(false)
    }

    context$(): Observable<Context | undefined> {
        return this._context$
    }

    keydown(e: KeyboardEvent): void {
        const standardEvent = new StandardKeyboardEvent(e)
        if (standardEvent.isKeyBinding)
            return
        const startCell = this.startCellMng.startCell
        if (startCell === undefined)
            return
        if (startCell.type !== 'Cell')
            return
        if (this._lastContext === undefined)
            return
        this._lastContext = new ContextBuilder(this._lastContext)
            .textareaOffsetX(-1)
            .textareaOffsetY(-1)
            .build()
        this._setEditing(true)
    }

    // tslint:disable-next-line: max-func-body-length
    mousedown(e: MouseEvent, same: boolean): void {
        const now = Date.now()
        const editing = (now - this._lastMouseDownTime) < 300
        this._lastMouseDownTime = now
        const startCell = this.startCellMng.startCell
        if (startCell === undefined)
            return
        if (startCell.type !== 'Cell' || !same) {
            this._setEditing(false)
            return
        }
        if (!editing) {
            this._setEditing(false)
            return
        }
        const {height, width, coodinate: {startRow: row, startCol: col}, position: {startCol: x, startRow: y}} = startCell
        const info = this.dataSvc.sheetSvc.getCell(row, col)
        const text = info?.formula ? info.getFormular() : info?.getText() ?? ''
        const rect = this.canvas.getBoundingClientRect()
        const [clientX, clientY] = [rect.x + x, rect.y + y]
        const context = new ContextBuilder()
            .text(text)
            .canvasOffsetX(x)
            .canvasOffsetY(y)
            .clientX(clientX ?? -1)
            .clientY(clientY ?? -1)
            .cellHeight(height)
            .cellWidth(width)
            .textareaOffsetX(e.clientX - clientX)
            .textareaOffsetY(e.clientY - clientY)
            .bindingData(startCell)
            .build()
        this._lastContext = context
        this._setEditing(true)
    }
    private _context$ = new Subject<Context>()
    private _editing$ = new Subject<boolean>()
    private _isEditing = false
    private _lastMouseDownTime = 0
    private _lastContext?: Context
    private _init(): void {
        this.add(this.startCellMng.startCell$().subscribe(e => {
            if (e === undefined)
                this._setEditing(false)
            else if (e.from === 'mousedown')
                // tslint:disable-next-line: no-type-assertion
                this.mousedown(e.event as MouseEvent, e.same)
            else
                this._setEditing(false)
        }))
    }

    private _setEditing(isEditing: boolean): void {
        if (isEditing === this._isEditing)
            return
        this._isEditing = isEditing
        this._editing$.next(isEditing)
        if (this._lastContext === undefined)
            return
        this._context$.next(this._lastContext)
    }
}
