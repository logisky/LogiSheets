import {CanvasAttr, PainterService} from '@/core/painter'
import {BaseInfo} from '@/components/textarea/cursor'
import {useCursor} from './cursor'
import {Context} from '../defs'
import {TextManager} from './text'
import {StandardKeyboardEvent} from '@/core/events'
import {MouseEvent as ReactMouseEvent, useRef} from 'react'
export class Selection {
    public startX = 0
    public startY = 0
    public startLineNumber = 0
    public startColumn = 0
    public endX = 0
    public endY = 0
    public endLineNumber = 0
    public endColumn = 0
}

export const useSelection = <T>(
    cursorMng: ReturnType<typeof useCursor>,
    context: Context<T>,
    textMng: TextManager<T>
) => {
    const _painterSvc = new PainterService()

    const _startCursor = useRef<BaseInfo>()
    const currSelection = useRef(new Selection())

    const init = (canvas: HTMLCanvasElement) => {
        _painterSvc.setupCanvas(canvas, 0, 0)
    }

    const _initSelection = () => {
        currSelection.current = new Selection()
        _drawSelection()
    }
    const mousedown = (e: ReactMouseEvent) => {
        const [x, y] = context.getOffset(e.clientX, e.clientY)
        _startCursor.current = cursorMng.getCursorInfoByPosition(x, y)
        _initSelection()
    }

    const mousemove = (e: MouseEvent) => {
        const [x, y] = context.getOffset(e.clientX, e.clientY)
        let curr = cursorMng.getCursorInfoByPosition(x, y)
        const startCursor = _startCursor.current
        if (!curr || !startCursor) return
        if (startCursor.biggerThan(curr)) {
            const tmp = curr
            curr = startCursor
            _startCursor.current = tmp
        }
        const selection = new Selection()
        selection.startX = startCursor.x
        selection.startY = startCursor.y
        selection.startColumn = startCursor.column
        selection.startLineNumber = startCursor.lineNumber
        selection.endX = curr.x
        selection.endY = curr.y
        selection.endColumn = curr.column
        selection.endLineNumber = curr.lineNumber
        if (!curr.equal(startCursor)) currSelection.current = selection
        _drawSelection()
    }

    const keydown = (e: StandardKeyboardEvent) => {
        if (e.isKeyBinding) return
        _painterSvc.clear()
        _initSelection()
    }

    const type = () => {
        _initSelection()
    }

    const getSelection = () => {
        const sel = currSelection.current
        if (
            sel.startColumn === sel.endColumn &&
            sel.startLineNumber === sel.endLineNumber
        )
            return
        return sel
    }

    const _drawSelection = () => {
        const selection = getSelection()
        if (selection === undefined) return
        const [totalWidth, totalHeight] = textMng.getNewSize()
        _painterSvc.setupCanvas(undefined, totalWidth, totalHeight)
        _painterSvc.save()
        const selAttr = new CanvasAttr()
        selAttr.fillStyle = 'rgba(0,0,0,0.38)'
        _painterSvc.attr(selAttr)
        const height = context.lineHeight()
        const startLine = selection.startLineNumber
        const endLine = selection.endLineNumber
        if (startLine === endLine) {
            const x = selection.startX
            const y = selection.startY
            const width = selection.endX - x
            _painterSvc.fillRect(x, y, width, height)
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
            _painterSvc.fillRect(x, y, width, height)
        }
        _painterSvc.restore()
    }
    _drawSelection()
    return {
        selection: currSelection,
        init,
        getSelection,
        mousedown,
        mousemove,
        keydown,
        type,
    }
}
