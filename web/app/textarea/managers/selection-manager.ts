// tslint:disable: limit-indent-for-method-in-class
import {CanvasAttrBuilder, PainterService} from '@logi-sheets/web/core/painter'
import {BaseInfo} from '@logi-sheets/web/app/textarea/cursor'
import {CursorManager} from './cursor-manager'
import {Context} from './context'
import {Selection, SelectionBuilder} from './selection'
import {TextManager} from './text-manager'
import {StandardKeyboardEvent} from '@logi-sheets/web/core/events'
export class SelectionManager {
    constructor(
        private readonly _cursorManager: CursorManager,
        private readonly _canvas: HTMLCanvasElement,
        private readonly _context: Context,
        private readonly _textManager: TextManager,
    ) {
        this._painterSvc.setupCanvas(this._canvas, 0, 0)
        this._initSelection()
    }
    mousedown(e: MouseEvent): void {
        const [x, y] = this._context.getOffset(e.clientX, e.clientY)
        this._start =
            this._cursorManager.getCursorInfoByPosition(x, y)
        this._initSelection()
    }

    mousemove(e: MouseEvent): void {
        const [x, y] = this._context.getOffset(e.clientX, e.clientY)
        let curr =
            this._cursorManager.getCursorInfoByPosition(x, y)
        let start = this._start
        if (!curr || !start)
            return
        if (start.biggerThan(curr)) {
            const tmp = curr
            curr = start
            start = tmp
        }
        const selection = new SelectionBuilder()
            .startX(start.x)
            .startY(start.y)
            .startColumn(start.column)
            .startLineNumber(start.lineNumber)
            .endX(curr.x)
            .endY(curr.y)
            .endColumn(curr.column)
            .endLineNumber(curr.lineNumber)
            .build()
        if (!curr.equal(start))
            this._currSelection = selection
        this._drawSelection()
    }

    keydown(e: StandardKeyboardEvent): void {
        if (e.isKeyBinding)
            return
        this._painterSvc.clear(this._canvas)
        this._initSelection()
    }

    type(): void {
        this._initSelection()
    }

    getSelection(): Selection | undefined {
        const sel = this._currSelection
        if (sel.startColumn === sel.endColumn && sel.startLineNumber === sel.endLineNumber)
            return
        return sel
    }
    private _currSelection = new SelectionBuilder().build()
    private _painterSvc = new PainterService()
    private _start?: BaseInfo
    private _initSelection(): void {
        this._currSelection = new SelectionBuilder().build()
        this._drawSelection()
    }

    // tslint:disable-next-line: max-func-body-length
    private _drawSelection(): void {
        const selection = this.getSelection()
        if (selection === undefined)
            return
        const [totalWidth, totalHeight] = this._textManager.getNewSize()
        this._painterSvc.setupCanvas(this._canvas, totalWidth, totalHeight)
        this._painterSvc.save()
        const selAttr = new CanvasAttrBuilder()
            .fillStyle('rgba(0,0,0,0.38)')
            .build()
        this._painterSvc.attr(selAttr)
        const height = this._context.lineHeight()
        const startLine = selection.startLineNumber
        const endLine = selection.endLineNumber
        if (startLine === endLine) {
            const x = selection.startX
            const y = selection.startY
            const width = selection.endX - x
            this._painterSvc.fillRect(x, y, width, height)
            return
        }
        for (let i = startLine; i <= endLine; i += 1) {
            let x = 0
            const y = selection.startY + (i - startLine) * height
            let width = 0
            if (i === startLine) {
                x = selection.startX
                width = totalWidth - selection.startX
            } else {
                x = 0
                width = i === endLine ? selection.endX : totalWidth
            }
            this._painterSvc.fillRect(x, y, width, height)
        }
        this._painterSvc.restore()
    }

}
