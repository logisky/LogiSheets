import {Cell} from '../defs'
import {DataService, RenderCell} from '@/core/data'
import {MouseEvent, useRef} from 'react'
import {Buttons} from '@/core'
import {SelectorProps} from '@/components/selector'
import {Range} from '@/core/standable'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
export type StartCellType =
    | 'mousedown'
    | 'contextmenu'
    | 'render'
    | 'unknown'
    | 'scroll'
export class StartCellEvent {
    constructor(
        public readonly cell?: Cell,
        public readonly from: StartCellType = 'unknown'
    ) {}
    public event = new Event('')
    public same = false
}

interface StartCellProps {
    readonly startCellChange: (e: StartCellEvent) => void
}

export const useStartCell = ({startCellChange}: StartCellProps) => {
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)
    const startCell = useRef<Cell>()
    const isMouseDown = useRef(false)

    const scroll = () => {
        const oldStartCell = startCell.current
        if (
            !oldStartCell ||
            oldStartCell.type === 'LeftTop' ||
            oldStartCell.type === 'unknown'
        )
            return
        let renderCell: RenderCell | undefined
        const viewRange = DATA_SERVICE.cachedViewRange
        if (oldStartCell.type === 'FixedLeftHeader')
            renderCell = viewRange.rows.find((r) =>
                r.coordinate.cover(oldStartCell.coordinate)
            )
        else if (oldStartCell.type === 'FixedTopHeader')
            renderCell = viewRange.cols.find((c) =>
                c.coordinate.cover(oldStartCell.coordinate)
            )
        else if (oldStartCell.type === 'Cell')
            renderCell = viewRange.cells.find((c) =>
                c.coordinate.cover(oldStartCell.coordinate)
            )
        else return
        if (!renderCell) {
            startCellChange(new StartCellEvent())
            return
        }
        const newStartCell = new Cell(oldStartCell.type).copyByRenderCell(
            renderCell
        )
        startCell.current = newStartCell
        const e = new StartCellEvent(newStartCell, 'scroll')
        e.same = true
        startCellChange(e)
    }

    const canvasChange = () => {
        const viewRange = DATA_SERVICE.cachedViewRange
        const oldStartCell = startCell.current
        const row = viewRange.rows.find((r) => oldStartCell?.cover(r))
        if (row === undefined) {
            startCell.current = undefined
            return
        }
        const col = viewRange.cols.find((c) => oldStartCell?.cover(c))
        if (col === undefined) {
            startCell.current = undefined
            return
        }
        const cell = new Cell(oldStartCell?.type ?? 'unknown')
        const event = new StartCellEvent(cell, 'render')
        event.same = false
        startCell.current = cell
        startCellChange(event)
    }
    const mousedown = (
        e: MouseEvent,
        matchCell: Cell,
        selector?: SelectorProps
    ) => {
        const buttons = e.buttons
        if (buttons !== Buttons.LEFT && buttons !== Buttons.RIGHT) return
        // 如果是在选中区域内右键，则不触发新的start cell
        if (selector && buttons === Buttons.RIGHT) {
            const range = new Range()
                .setStartRow(selector.y - selector.borderTopWidth)
                .setEndRow(selector.y + selector.borderBottomWidth)
                .setStartCol(selector.x - selector.borderLeftWidth)
                .setEndCol(selector.x + selector.borderRightWidth)
            if (range.cover(matchCell.position)) return
        }
        isMouseDown.current = true
        const event = new StartCellEvent(
            matchCell,
            buttons === Buttons.LEFT ? 'mousedown' : 'contextmenu'
        )
        if (startCell.current && matchCell.equals(startCell.current))
            event.same = true
        startCell.current = matchCell
        startCellChange(event)
    }
    return {
        startCell,
        isMouseDown,
        scroll,
        canvasChange,
        mousedown,
    }
}
