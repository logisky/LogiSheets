import { Cell, match } from '../defs'
import { DATA_SERVICE, RenderCell } from 'core/data'
import { MouseEvent, useRef, useState } from 'react'
import { Buttons } from 'common'
import { SelectorProps } from 'components/selector'
import { Range } from 'core/standable'
export type StartCellType = 'mousedown' | 'contextmenu' | 'render' | 'unknown' | 'scroll'
export class StartCellEvent {
    constructor(
        public readonly cell: Cell,
        public readonly from: StartCellType = 'unknown',
    ) { }
    public event = new Event('')
    public same = false
}

export const useStartCell = () => {
    const startCell = useRef<Cell>()
    const [startCellEvent, setStartCellEvent] = useState<StartCellEvent>()
    const [canvas, setCanvas] = useState<HTMLCanvasElement>()

    const scroll = () => {
        const oldStartCell = startCell.current
        if (!oldStartCell || oldStartCell.type === 'LeftTop' || oldStartCell.type === 'unknown')
            return
        let renderCell: RenderCell | undefined
        const viewRange = DATA_SERVICE.cachedViewRange
        if (oldStartCell.type === 'FixedLeftHeader')
            renderCell = viewRange.rows.find(r => r.coodinate.cover(oldStartCell.coodinate))
        else if (oldStartCell.type === 'FixedTopHeader')
            renderCell = viewRange.cols.find(c => c.coodinate.cover(oldStartCell.coodinate))
        else if (oldStartCell.type === 'Cell')
            renderCell = viewRange.cells.find(c => c.coodinate.cover(oldStartCell.coodinate))
        else
            return
        if (!renderCell) {
            setStartCellEvent(undefined)
            return
        }
        const newStartCell = new Cell(oldStartCell.type).copyByRenderCell(renderCell)
        startCell.current = newStartCell
        const e = new StartCellEvent(newStartCell, 'scroll')
        e.same = true
        setStartCellEvent(e)
    }

    const canvasChange = (canvas: HTMLCanvasElement) => {
        setCanvas(canvas)
        const viewRange = DATA_SERVICE.cachedViewRange
        const oldStartCell = startCell.current
        const row = viewRange.rows.find(r => oldStartCell?.cover(r))
        if (row === undefined) {
            startCell.current = undefined
            return
        }
        const col = viewRange.cols.find(c => oldStartCell?.cover(c))
        if (col === undefined) {
            startCell.current = undefined
            return
        }
        const cell = new Cell(oldStartCell?.type ?? 'unknown')
        const event = new StartCellEvent(cell, 'render')
        event.same = false
        setStartCellEvent(event)
        startCell.current = cell
    }
    const mousedown = (e: MouseEvent, selector?: SelectorProps) => {
        const buttons = e.buttons
        if ((buttons !== Buttons.LEFT && buttons !== Buttons.RIGHT) || !canvas)
            return
        const matchCell = match(e.clientX, e.clientY, canvas)
        // 如果是在选中区域内右键，则不触发新的start cell
        if (selector && buttons === Buttons.RIGHT) {
            const range = new Range()
            range.startRow = selector.y - selector.borderTopWidth
            range.endRow = selector.y + selector.borderBottomWidth
            range.startCol = selector.x - selector.borderLeftWidth
            range.endCol = selector.x + selector.borderRightWidth
            if (range.cover(matchCell.position))
                return
        }
        const event = new StartCellEvent(matchCell, buttons === Buttons.LEFT ? 'mousedown' : 'contextmenu')
        if (startCell.current && matchCell.equals(startCell.current))
            event.same = true
        startCell.current = matchCell
        setStartCellEvent(event)
    }
    return {
        canvas,
        startCellEvent,
        scroll,
        canvasChange,
        mousedown,
    }
}