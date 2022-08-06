import { RefObject, useRef, useState } from 'react'
import { getPosition, getSelector } from './selector'
import { Range } from '@/core/standable'
import { AttributeName } from '@/core/const'
import { match, Cell, visibleCells } from '../defs'
import { Payload } from '@/api'
import { Backend, DataService, SheetService } from '@/core/data'
import { useInjection } from '@/core/ioc/provider'
import { TYPES } from '@/core/ioc/types'
interface _Selector {
    readonly start: Cell
    readonly end?: Cell
}
export const useDnd = (canvas: RefObject<HTMLCanvasElement>) => {
    const BACKEND_SERVICE = useInjection<Backend>(TYPES.Backend)
    const SHEET_SERVICE = useInjection<SheetService>(TYPES.Sheet)
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)
    const [promptReplace, setPrompReplace] = useState(false)
    const [range, setRange] = useState<Range>()
    const [dragging, setDragging] = useState<Range>()
    const mousedownStart = useRef<{ x: number, y: number }>()
    const _selector = useRef<_Selector>()
    const _endSelector = useRef<_Selector>()
    const onReplace = () => {
        const startSelector = _selector.current
        const endSelector = _endSelector.current
        if (!startSelector || !endSelector)
            return
        const payloads: Payload[] = []
        const startVisibleCells = visibleCells(
            startSelector.start,
            startSelector.end ?? startSelector.start,
            SHEET_SERVICE,
        )
        startVisibleCells.forEach(c => {
            payloads.push({
                type: 'cellInput',
                sheetIdx: SHEET_SERVICE.getActiveSheet(),
                row: c.row,
                col: c.col,
                input: '',
            })
        })
        visibleCells(endSelector.start, endSelector.end ?? endSelector.start, SHEET_SERVICE).forEach((c, i) => {
            const { row, col } = startVisibleCells[i]
            const input = SHEET_SERVICE.getCell(row, col)?.getText()
            payloads.push({
                type: 'cellInput',
                sheetIdx: SHEET_SERVICE.getActiveSheet(),
                row: c.row,
                col: c.col,
                input: input ?? '',
            })
        })
        BACKEND_SERVICE.sendTransaction(payloads)
    }
    const _setRange = (selector?: _Selector) => {
        if (!canvas.current)
            return
        _selector.current = selector
        const sel = selector ? getSelector(canvas.current, selector.start, selector.end) : undefined
        const newRange = sel ? getPosition(sel) : undefined
        setRange(newRange)
    }
    const _setEnd = (selector?: { canvas: HTMLCanvasElement, start: Cell, end?: Cell }) => {
        _endSelector.current = selector
        const sel = selector ?
            getSelector(selector.canvas, selector.start, selector.end) : undefined
        const draggingRange = sel ? getPosition(sel) : undefined
        setDragging(draggingRange)
    }

    const onMouseDown = (e: MouseEvent) => {
        const target = e.target as HTMLDivElement
        const isHandle = target.getAttribute(AttributeName.SELECTOR_DND_HANDLE)
        if (isHandle === null) {
            mousedownStart.current = undefined
            return false
        }
        mousedownStart.current = { x: e.clientX, y: e.clientY }
        return true
    }

    const onMouseMove = (e: MouseEvent, startCell: Cell, oldEnd: Cell) => {
        if (!mousedownStart.current || !canvas.current)
            return false
        const moved = { x: e.clientX - mousedownStart.current.x, y: e.clientY - mousedownStart.current.y }
        if (startCell.type !== 'Cell')
            return true
        const endCell = match(oldEnd.position.startCol + moved.x, oldEnd.position.startRow + moved.y, canvas.current, DATA_SERVICE.cachedViewRange)
        if (endCell.type !== 'Cell')
            return true
        _setEnd({ canvas: canvas.current, start: startCell, end: endCell })
        return true
    }

    const onMouseUp = () => {
        _setEnd(undefined)
    }
    const clean = () => {
        mousedownStart.current = undefined
        _setRange(undefined)
    }
    const selectorChange = (selector?: _Selector) => {
        if (!selector) {
            clean()
            return
        }
        _setRange(selector)
    }
    return {
        onReplace,
        _endSelector,
        clean,
        range,
        dragging,
        onMouseDown,
        onMouseMove,
        onMouseUp,
        selectorChange,
        promptReplace,
        setPrompReplace,
    }
}
