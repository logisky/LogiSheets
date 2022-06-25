import { useRef, useState } from 'react'
import { getPosition, getSelector } from './selector'
import { Range } from '@/core/standable'
import { AttributeName } from '@/common/const'
import { match, Cell } from '../defs'
import { Payload, CellInputBuilder } from '@/api'
import { DATA_SERVICE } from '@/core/data'
interface _Selector {
    readonly canvas: HTMLCanvasElement
    readonly start: Cell
    readonly end?: Cell
}
export const useDnd = () => {
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
        const startVisibleCells = startSelector.start.visibleCells(startSelector.end)
        startVisibleCells.forEach(c => {
            payloads.push({
                type: "cellInput",
                sheetIdx: DATA_SERVICE.sheetSvc.getActiveSheet(),
                row: c.row,
                col: c.col,
                input: '',
            })
        })
        endSelector.start.visibleCells(endSelector.end).forEach((c, i) => {
            const { row, col } = startVisibleCells[i]
            const input = DATA_SERVICE.sheetSvc.getCell(row, col)?.getText()
            payloads.push({
                type: "cellInput",
                sheetIdx: DATA_SERVICE.sheetSvc.getActiveSheet(),
                row: c.row,
                col: c.col,
                input: input ?? '',
            })
        })
        DATA_SERVICE.backend.sendTransaction(payloads)
    }
    const _setRange = (selector?: _Selector) => {
        _selector.current = selector
        const sel = selector ? getSelector(selector.canvas, selector.start, selector.end) : undefined
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

    const onMouseMove = (e: MouseEvent, canvas: HTMLCanvasElement, startCell: Cell, oldEnd: Cell) => {
        if (!mousedownStart.current)
            return false
        const moved = { x: e.clientX - mousedownStart.current.x, y: e.clientY - mousedownStart.current.y }
        if (startCell.type !== 'Cell')
            return true
        const endCell = match(oldEnd.position.startCol + moved.x, oldEnd.position.startRow + moved.y, canvas)
        if (endCell.type !== 'Cell')
            return true
        _setEnd({ canvas, start: startCell, end: endCell })
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
