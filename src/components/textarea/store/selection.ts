import {makeObservable} from 'mobx'
import {TextareaStore} from './store'
import {CanvasAttr, PainterService} from '@/core/painter'
import {BaseInfo} from '../cursor'

export class Selection {
    constructor(public readonly store: TextareaStore) {
        makeObservable(this)
    }

    selection?: SelectionInfo

    clear() {
        this.selection = undefined
        this._painterSvc.clear()
    }

    init(selectionCanvas: HTMLCanvasElement) {
        this._painterSvc.setupCanvas(selectionCanvas, 1, 1)
        this.clear()
    }

    mousemove(e: MouseEvent) {
        const [x, y] = this.store.context.getOffset(e.clientX, e.clientY)
        const curr = this.store.cursor.getCursorInfoByPosition(x, y)
        const start = this.store.cursor.toBaseInfo()
        const baseHeight = this.store.context.lineHeight()

        let _start: BaseInfo
        let _end: BaseInfo
        if (curr.lineNumber > start.lineNumber) {
            _start = start
            _end = curr
        } else if (curr.lineNumber < start.lineNumber) {
            _start = curr
            _end = start
        } else {
            if (curr.column <= start.column) {
                _start = curr
                _end = start
            } else {
                _start = start
                _end = curr
            }
        }
        this.selection = new SelectionInfo()
            .setStartX(_start.x)
            .setStartY(_start.y)
            .setStartColumn(_start.column)
            .setStartLine(_start.lineNumber)
            .setEndX(_end.x)
            .setEndY(_end.y + baseHeight)
            .setEndColumn(_end.column)
            .setEndLine(_end.lineNumber)
        this._drawSelection()
    }

    private _drawSelection() {
        if (this.selection === undefined) return
        const [totalWidth, totalHeight] = this.store.textManager.getNewSize()
        this._painterSvc.setupCanvas(undefined, totalWidth, totalHeight)
        this._painterSvc.save()
        const attr = new CanvasAttr()
        attr.fillStyle = 'rgba(0,0,0,0.3)'
        this._painterSvc.attr(attr)
        const height = this.store.context.lineHeight()
        const {startX, startY, endX, startLine, endLine} = this.selection
        if (startLine === endLine) {
            const width = endX - startX
            this._painterSvc.fillRect(startX, startY, width, height)
            return
        }
        for (let i = startLine; i <= endLine; i += 1) {
            let x = 0
            const y = this.selection.startY + (i - startLine) * height
            let width = 0
            if (i === startLine) {
                x = this.selection.startX
                width = totalWidth - this.selection.startX
            } else {
                x = 0
                width = i === endLine ? this.selection.endX : totalWidth
            }
            this._painterSvc.fillRect(x, y, width, height)
        }
        this._painterSvc.restore()
    }

    private _painterSvc = new PainterService()
}

export class SelectionInfo {
    setStartX(x: number) {
        this.startX = x
        return this
    }
    setStartY(y: number) {
        this.startY = y
        return this
    }
    setEndX(x: number) {
        this.endX = x
        return this
    }
    setEndY(y: number) {
        this.endY = y
        return this
    }
    setStartLine(line: number) {
        this.startLine = line
        return this
    }
    setStartColumn(column: number) {
        this.startColumn = column
        return this
    }
    setEndLine(line: number) {
        this.endLine = line
        return this
    }
    setEndColumn(column: number) {
        this.endColumn = column
        return this
    }
    startLine = 0
    startColumn = 0
    endLine = 0
    endColumn = 0
    startX = 0
    startY = 0
    endX = 0
    endY = 0
}
