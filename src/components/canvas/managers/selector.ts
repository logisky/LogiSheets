import { SelectorProps } from '@/components/selector'
import { Cell } from '../defs'
import { useEffect, useRef, useState } from 'react'
import { StartCellEvent } from './start-cell'
import { Range } from '@/core/standable'

export const getPosition = (selector: SelectorProps) => {
    return new Range()
        .setStartRow(selector.y)
        .setStartCol(selector.x)
        .setEndRow(selector.y + selector.height + selector.borderTopWidth + selector.borderBottomWidth)
        .setEndCol(selector.x + selector.width + selector.borderLeftWidth + selector.borderRightWidth)
}
export const getSelector = (canvas: HTMLCanvasElement, start: Cell, end?: Cell) => {
    const { type, width, height, position: startPos } = start
    const endCellInner = end ?? start
    const { position: endPos } = endCellInner
    if (type === 'unknown')
        return
    const selector = new SelectorProps()
    selector.width = width
    selector.height = height
    // 在单元格内框选
    if (endPos.startRow < startPos.startRow) {
        selector.borderTopWidth = startPos.startRow - endPos.startRow
        selector.y = endPos.startRow
    } else {
        selector.borderBottomWidth = endPos.endRow - startPos.endRow
        selector.y = startPos.startRow
    }
    if (endPos.startCol < startPos.startCol) {
        selector.borderLeftWidth = startPos.startCol - endPos.startCol
        selector.x = endPos.startCol
    } else {
        selector.borderRightWidth = endPos.endCol - startPos.endCol
        selector.x = startPos.startCol
    }
    // 起始点在左固定栏、上固定栏、leftTop
    const { width: totalWidth, height: totalHeight } =
        canvas.getBoundingClientRect()
    if (type === 'LeftTop') {
        selector.x = startPos.startRow
        selector.y = startPos.startCol
        selector.borderRightWidth = totalWidth - width
        selector.borderBottomWidth = totalHeight - height
    }
    // 起始点在左固定栏、上固定栏时，x,y的判断和type==='cell'一致
    else if (type === 'FixedLeftHeader')
        selector.borderRightWidth = totalWidth - width
    else if (type === 'FixedTopHeader')
        selector.borderBottomWidth = totalHeight - height
    return selector
}

export const useSelector = () => {
    const [selector, setSelector] = useState<SelectorProps>()
    const [startCellInner, setStartCell] = useState<Cell>()
    const [endCell, setEndCell] = useState<Cell | undefined>(undefined)

    const canvas = useRef<HTMLCanvasElement>()

    const init = (c: HTMLCanvasElement) => {
        canvas.current = c
    }
    // 更新selector
    useEffect(() => {
        if (startCellInner === undefined || canvas.current === undefined) {
            setSelector(undefined)
            return
        }
        const selector = getSelector(canvas.current!, startCellInner, endCell)
        setSelector(selector)
    }, [canvas, endCell, startCellInner])

    const onContextmenu = (startCell: Cell) => {
        setEndCell(undefined)
        setStartCell(startCell)
    }

    const onMouseDown = (startCell: Cell) => {
        setEndCell(undefined)
        setStartCell(startCell)
    }

    const onMouseMove = (matchCell: Cell) => {
        setEndCell(matchCell)
    }

    const onScroll = (startCell: Cell) => {
        setEndCell(undefined)
        setStartCell(startCell)
    }

    const startCellChange = (e?: StartCellEvent) => {
        if (e === undefined) {
            setSelector(undefined)
            return
        }
        if (e.from === 'scroll')
            onScroll(e.cell)
        else if (!e.same) {
            if (e.from === 'mousedown')
                onMouseDown(e.cell)
            else if (e.from === 'contextmenu')
                onContextmenu(e.cell)
            else
                setSelector(undefined)
        }
    }
    return {
        selector,
        startCell: startCellInner,
        endCell,
        startCellChange,
        onContextmenu,
        onMouseDown,
        onMouseMove,
        init,
    }
}
