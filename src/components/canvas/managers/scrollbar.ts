import { ScrollbarAttr, ScrollbarType } from '@/components/scrollbar'
import { CANVAS_OFFSET, DATA_SERVICE } from '@/core/data'
import { useReducer, WheelEvent } from 'react'
const reducer = (prevState: ScrollbarAttr, newState: Partial<ScrollbarAttr>) => {
    const s = { ...prevState }
    if (newState.containerLength !== undefined)
        s.containerLength = newState.containerLength
    if (newState.containerTotalLength !== undefined)
        s.containerTotalLength = newState.containerTotalLength
    if (newState.scrollDistance !== undefined)
        s.scrollDistance = newState.scrollDistance
    return s
}
const _initXScrollbar = (canvas?: HTMLCanvasElement): ScrollbarAttr => {
    return {
        direction: 'x',
        paddingLeft: 20,
        paddingRight: 10,
        containerLength: canvas?.offsetWidth ?? 0,
        scrollDistance: DATA_SERVICE.scroll.x,
        containerTotalLength: canvas ? DATA_SERVICE.sheetSvc.updateMaxWidth(canvas.offsetWidth) : 0,
    }
}
const _initYScrollbar = (canvas?: HTMLCanvasElement): ScrollbarAttr => {
    return {
        direction: 'y',
        paddingTop: 20,
        paddingBottom: 10,
        containerLength: canvas?.offsetHeight ?? 0,
        scrollDistance: DATA_SERVICE.scroll.y,
        containerTotalLength: canvas ? DATA_SERVICE.sheetSvc.updateMaxHeight(_minHeight(canvas)) : 0,
    }
}
export const useScrollbar = () => {
    const [xScrollbarAttr, setXScrollbarAttr] = useReducer(reducer, undefined, _initXScrollbar)
    const [yScrollbarAttr, setYScrollbarAttr] = useReducer(reducer, undefined, _initYScrollbar)
    const initScrollbar = (canvas: HTMLCanvasElement) => {
        setXScrollbarAttr(_initXScrollbar(canvas))
        setYScrollbarAttr(_initYScrollbar(canvas))
    }
    const mouseWheel = (e: WheelEvent<HTMLCanvasElement>) => {
        const delta = e.deltaX === 0 ? e.deltaY : e.deltaX
        const type = e.deltaX === 0 ? 'y' : 'x'
        mouseWheelScrolling(delta, type, e.currentTarget)
    }
    const resize = (canvas: HTMLCanvasElement) => {
        setXScrollbarAttr({ containerLength: canvas.offsetWidth })
        setYScrollbarAttr({ containerLength: canvas.offsetHeight })
    }
    const setScrollDistance = (distance: number, type: ScrollbarType) => {
        if (type === 'x') {
            DATA_SERVICE.updateScroll(distance)
            setXScrollbarAttr({ scrollDistance: distance })
        } else if (type === 'y') {
            DATA_SERVICE.updateScroll(undefined, distance)
            setYScrollbarAttr({ scrollDistance: distance })
        }
    }

    const mouseWheelScrolling = (
        delta: number,
        type: ScrollbarType,
        canvas: HTMLCanvasElement,
    ) => {
        const oldScroll = type === 'x' ? DATA_SERVICE.scroll.x : DATA_SERVICE.scroll.y
        let newScroll = oldScroll + delta
        // 不可能滚动到负数
        if (newScroll < 0)
            newScroll = 0
        // 滚动无变化，不触发渲染
        if (newScroll === oldScroll)
            return
        if (type === 'y') {
            DATA_SERVICE.updateScroll(undefined, newScroll)
            const height = Math.max(newScroll + canvas.offsetHeight, _minHeight(canvas))
            const maxHeight = DATA_SERVICE.sheetSvc.updateMaxHeight(height)
            setYScrollbarAttr({ scrollDistance: newScroll, containerTotalLength: maxHeight })
        } else if (type === 'x') {
            DATA_SERVICE.updateScroll(newScroll)
            const width = newScroll + canvas.offsetWidth
            const maxWidth = DATA_SERVICE.sheetSvc.updateMaxWidth(width)
            setXScrollbarAttr({ scrollDistance: newScroll, containerTotalLength: maxWidth })
        }
    }
    return {
        xScrollbarAttr,
        yScrollbarAttr,
        setScrollDistance,
        initScrollbar,
        resize,
        mouseWheel,
        mouseWheelScrolling,
    }
}

const _minHeight = (canvas: HTMLCanvasElement) => {
    return canvas.offsetHeight + CANVAS_OFFSET
}
