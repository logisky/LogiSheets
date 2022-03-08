import { getCell } from '../defs'
import { MouseEvent, useState } from 'react'
import { SelectorProps } from 'components/selector'
export const useDnd = () => {
    const [x, setX] = useState<number>(-1)
    const [y, setY] = useState<number>(-1)
    const [width, setWidth] = useState<number>(-1)
    const [height, setHeight] = useState<number>(-1)
    const [draggingX, setDraggingX] = useState<number>(-1)
    const [draggingY, setDraggingY] = useState<number>(-1)
    const [isDragging, setIsDragging] = useState<boolean>(false)
    const [_mousedown, setMouseDown] = useState<{ x: number, y: number }>()

    const onMouseDown = (e: MouseEvent) => {
        setIsDragging(true)
        setMouseDown({ x: e.clientX, y: e.clientY })
    }

    const onMouseMove = (e: MouseEvent, canvas: HTMLCanvasElement) => {
        if (!_mousedown)
            return
        const newX = x + e.clientX - _mousedown.x
        const newY = y + e.clientY - _mousedown.y
        const cell = getCell(newX, newY)
        const { width: canvasWidth, height: canvasHeight } = canvas.getBoundingClientRect()
        if (cell.type !== 'Cell')
            return
        if (newX + width > canvasWidth)
            return
        if (newY + height > canvasHeight)
            return
        setDraggingX(cell.position.startCol)
        setDraggingY(cell.position.startRow)
    }

    const onMouseUp = () => {
        clean()
    }
    const clean = () => {
        setMouseDown(undefined)
        setIsDragging(false)
        setDraggingX(-1)
        setDraggingY(-1)
    }
    const selectorChange = (selector?: SelectorProps) => {
        if (!selector) {
            clean()
            return
        }
        setX(selector.x)
        setY(selector.y)
        setWidth(selector.width + selector.borderLeftWidth + selector.borderRightWidth)
        setHeight(selector.height + selector.borderBottomWidth + selector.borderTopWidth)
    }
    return {
        x,
        y,
        width,
        height,
        draggingX,
        draggingY,
        isDragging,
        onMouseDown,
        onMouseMove,
        onMouseUp,
        selectorChange,
    }
}
