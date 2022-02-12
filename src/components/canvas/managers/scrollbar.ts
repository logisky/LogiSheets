import { ScrollbarType, ScrollEvent, ScrollbarProps } from 'components/scrollbar'
import { CANVAS_OFFSET, DATA_SERVICE } from 'core/data'
import { useState, WheelEvent } from 'react'
export const useScrollbar = () => {
    const [xScrollbar, setXScrollbar] = useState<ScrollbarProps>({})
    const [yScrollbar, setYScrollbar] = useState<ScrollbarProps>({})
    const [scrollEvent, setScrollEvent] = useState<ScrollEvent>()
    const initScrollbar = (canvas: HTMLCanvasElement) => {
        const scroll = DATA_SERVICE.scroll
        setXScrollbar({
            direction: 'x',
            containerLength: canvas.offsetWidth,
            containerTotalLength: DATA_SERVICE.sheetSvc.updateMaxWidth(canvas.offsetWidth),
            scrollDistance: scroll.x,
        })
        setYScrollbar({
            direction: 'y',
            containerLength: canvas.offsetHeight,
            containerTotalLength: DATA_SERVICE.sheetSvc.updateMaxHeight(_minHeight(canvas)),
            scrollDistance: scroll.y,
        })
    }

    const mouseMove = (e: ScrollEvent) => {
        if (e.delta === 0)
            return
        if (e.type === 'x') {
            DATA_SERVICE.updateScroll(e.scrollDistance)
            setXScrollbar({ ...xScrollbar, scrollDistance: e.scrollDistance })
        } else if (e.type === 'y') {
            DATA_SERVICE.updateScroll(undefined, e.scrollDistance)
            setYScrollbar({ ...yScrollbar, scrollDistance: e.scrollDistance })
        }
        setScrollEvent(e)
    }
    const mouseWheel = (e: WheelEvent<HTMLCanvasElement>) => {
        const delta = e.deltaX === 0 ? e.deltaY : e.deltaX
        const type = e.deltaX === 0 ? 'y' : 'x'
        _mouseWheelScrolling(delta, type, e.currentTarget)
    }
    const resize = (canvas: HTMLCanvasElement) => {
        setXScrollbar({
            ...xScrollbar,
            containerLength: canvas.offsetWidth,
            containerTotalLength: DATA_SERVICE.sheetSvc.maxWidth(),
        })
        setYScrollbar({
            ...yScrollbar,
            containerLength: canvas.offsetHeight,
            containerTotalLength: DATA_SERVICE.sheetSvc.maxHeight(),
        })
    }

    const _mouseWheelScrolling = (
        delta: number,
        type: ScrollbarType,
        canvas: HTMLCanvasElement,
    ) => {
        if (delta === 0)
            return
        const deltaX = type === 'x' ? delta : 0
        const deltaY = type === 'y' ? delta : 0
        const scrollEvent = new ScrollEvent()
        scrollEvent.type = type
        scrollEvent.trust = true
        if (deltaY) {
            const oldScrollY = DATA_SERVICE.scroll.y
            if (deltaY < 0 && oldScrollY === 0)
                return
            let scrollY = DATA_SERVICE.scroll.y + deltaY
            if (scrollY < 0)
                scrollY = 0
            DATA_SERVICE.updateScroll(undefined, scrollY)
            const minHeight = _minHeight(canvas)
            let height = scrollY + canvas.offsetHeight
            height = Math.max(height, minHeight)
            height = DATA_SERVICE.sheetSvc.updateMaxHeight(height)
            scrollEvent.delta = scrollY - oldScrollY
            scrollEvent.scrollDistance = scrollY
            setYScrollbar({
                ...yScrollbar,
                containerLength: canvas.offsetHeight,
                containerTotalLength: height,
                scrollDistance: scrollY,
            })
        } else if (deltaX) {
            const oldScrollX = DATA_SERVICE.scroll.x
            if (deltaX < 0 && oldScrollX === 0)
                return false
            let scrollX = oldScrollX + deltaX
            if (scrollX < 0)
                scrollX = 0
            DATA_SERVICE.updateScroll(scrollX)
            const canvasWidth = canvas.offsetWidth
            let width = scrollX + canvasWidth
            width = Math.max(width, canvasWidth)
            width = DATA_SERVICE.sheetSvc.updateMaxWidth(width)
            scrollEvent.delta = scrollX - oldScrollX
            scrollEvent.scrollDistance = scrollX
            setXScrollbar({
                ...xScrollbar,
                containerLength: canvasWidth,
                containerTotalLength: width,
                scrollDistance: scrollX,
            })
        } else
            return false
        setScrollEvent(scrollEvent)
    }
    return {
        xScrollbar,
        setXScrollbar,
        yScrollbar,
        setYScrollbar,
        scrollEvent,
        initScrollbar,
        mouseMove,
        resize,
        mouseWheel,
    }
}

const _minHeight = (canvas: HTMLCanvasElement) => {
    return canvas.offsetHeight + CANVAS_OFFSET
}
