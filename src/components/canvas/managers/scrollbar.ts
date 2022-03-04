import { ScrollbarType } from 'components/scrollbar'
import { CANVAS_OFFSET, DATA_SERVICE } from 'core/data'
import { useState, WheelEvent } from 'react'
export const useScrollbar = () => {
    const [xScrollDistance, setXScrollDistance] = useState(0)
    const [yScrollDistance, setYScrollDistance] = useState(0)
    const [size, setSize] = useState<{width: number, height: number}>({width: 0, height: 0})
    const [totalSize, setTotalSize] = useState<{width: number, height: number}>({width: 0, height: 0})
    const initScrollbar = (canvas: HTMLCanvasElement) => {
        const scroll = DATA_SERVICE.scroll
        setSize({width: canvas.offsetWidth, height: canvas.offsetHeight})
        setTotalSize({
            width: DATA_SERVICE.sheetSvc.updateMaxWidth(canvas.offsetWidth),
            height: DATA_SERVICE.sheetSvc.updateMaxHeight(_minHeight(canvas)),
        })
        setXScrollDistance(scroll.x)
        setYScrollDistance(scroll.y)
    }
    const mouseWheel = (e: WheelEvent<HTMLCanvasElement>) => {
        const delta = e.deltaX === 0 ? e.deltaY : e.deltaX
        const type = e.deltaX === 0 ? 'y' : 'x'
        mouseWheelScrolling(delta, type, e.currentTarget)
    }
    const resize = (canvas: HTMLCanvasElement) => {
        setSize({width: canvas.offsetWidth, height: canvas.offsetHeight})
    }
    const setScrollDistance = (distance: number, type: ScrollbarType) => {
        if (type === 'x') {
            DATA_SERVICE.updateScroll(distance)
            setXScrollDistance(distance)
        } else if (type === 'y') {
            DATA_SERVICE.updateScroll(undefined, distance)
            setYScrollDistance(distance)
        }
    }

    const mouseWheelScrolling = (
        delta: number,
        type: ScrollbarType,
        canvas: HTMLCanvasElement,
    ) => {
        if (delta === 0)
            return
        const deltaX = type === 'x' ? delta : 0
        const deltaY = type === 'y' ? delta : 0
        let scrollY: number | undefined
        let scrollX: number | undefined
        setSize({width: canvas.offsetWidth, height: canvas.offsetHeight})
        if (deltaY) {
            const oldScrollY = DATA_SERVICE.scroll.y
            if (deltaY < 0 && oldScrollY === 0)
                return
            scrollY = DATA_SERVICE.scroll.y + deltaY
            if (scrollY < 0)
                scrollY = 0
            DATA_SERVICE.updateScroll(undefined, scrollY)
            const minHeight = _minHeight(canvas)
            let height = scrollY + canvas.offsetHeight
            height = Math.max(height, minHeight)
            DATA_SERVICE.sheetSvc.updateMaxHeight(height)
        } else if (deltaX) {
            const oldScrollX = DATA_SERVICE.scroll.x
            if (deltaX < 0 && oldScrollX === 0)
                return false
            scrollX = oldScrollX + deltaX
            if (scrollX < 0)
                scrollX = 0
            DATA_SERVICE.updateScroll(scrollX)
            const canvasWidth = canvas.offsetWidth
            let width = scrollX + canvasWidth
            width = Math.max(width, canvasWidth)
            DATA_SERVICE.sheetSvc.updateMaxWidth(width)
        } else
            return false
        if (scrollY !== undefined)
            setYScrollDistance(scrollY)
        else if (scrollX !== undefined)
            setXScrollDistance(scrollX)
        setTotalSize({
            width: DATA_SERVICE.sheetSvc.maxWidth(),
            height: DATA_SERVICE.sheetSvc.maxHeight(),
        })
    }
    return {
        setScrollDistance,
        size,
        xScrollDistance,
        yScrollDistance,
        totalSize,
        initScrollbar,
        resize,
        mouseWheel,
        mouseWheelScrolling,
    }
}

const _minHeight = (canvas: HTMLCanvasElement) => {
    return canvas.offsetHeight + CANVAS_OFFSET
}
