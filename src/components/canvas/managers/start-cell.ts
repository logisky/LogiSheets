import { Cell, match } from '../defs'
import { DATA_SERVICE, RenderCell } from 'core/data'
import { MouseEvent, useState } from 'react'
import { Buttons } from 'common'
import { SelectorProps } from 'components/selector'
import { Range } from 'core/standable'
export type StartCellType = 'mousedown' | 'contextmenu' | 'render' | 'unknown'
export class StartCellEvent {
    public from: StartCellType = 'unknown'
    public cell!: Cell
    public event = new Event('')
    public same = false
}

export const useStartCell = () => {
    const [startCell, setStartCell] = useState<Cell>()
    const [startCellEvent, setStartCellEvent] = useState<StartCellEvent>()
    const [canvas, setCanvas] = useState<HTMLCanvasElement>()

    const scroll = () => {
        const oldStartCell = startCell
        if (!oldStartCell || oldStartCell.type === 'LeftTop' || oldStartCell.type === 'unknown')
            return
        const newStartCell = new Cell()
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
            setStartCell(undefined)
            return
        }
        newStartCell.copyByRenderCell(renderCell)
        setStartCell(newStartCell)
    }

    const canvasChange = (canvas: HTMLCanvasElement) => {
        setCanvas(canvas)
        const viewRange = DATA_SERVICE.cachedViewRange
        const row = viewRange.rows.find(r => startCell?.cover(r))
        if (row === undefined) {
            setStartCell(undefined)
            return
        }
        const col = viewRange.cols.find(c => startCell?.cover(c))
        if (col === undefined) {
            setStartCell(undefined)
            return
        }
        const cell = new Cell()
        cell.type = startCell?.type ?? 'unknown'
        const event = new StartCellEvent()
        event.cell = cell
        event.from = 'render'
        event.same = false
        setStartCellEvent(event)
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
        const event = new StartCellEvent()
        event.cell = matchCell
        event.from = buttons === Buttons.LEFT ? 'mousedown' : 'contextmenu'
        if (startCell && matchCell.equals(startCell))
            event.same = true
        setStartCell(matchCell)
        setStartCellEvent(event)
    }
    return {
        canvas,
        startCell,
        startCellEvent,
        scroll,
        canvasChange,
        mousedown,
    }
}