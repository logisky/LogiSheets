import { EventType, on } from '@/common/events'
import { ScrollbarAttr, ScrollbarType } from '@/components/scrollbar'
import {CANVAS_OFFSET, SheetService} from '@/core/data'
import { useInjection } from '@/core/ioc/provider'
import { TYPES } from '@/core/ioc/types'
import { RefObject, useEffect, useReducer } from 'react'
import { Subscription } from 'rxjs'
const reducer = (prevState: ScrollbarAttr, newState: Partial<ScrollbarAttr>) => {
    const s = { ...prevState }
    if (newState.offsetHeight !== undefined)
        s.offsetHeight = newState.offsetHeight
    if (newState.scrollHeight !== undefined)
        s.scrollHeight = newState.scrollHeight
    if (newState.scrollTop !== undefined)
        s.scrollTop = newState.scrollTop
    return s
}
interface ScrollbarProps {
    readonly canvas: RefObject<HTMLCanvasElement>
}
export const useScrollbar = ({
    canvas,
}: ScrollbarProps) => {
    const sheetSvc = useInjection<SheetService>(TYPES.Sheet)
    const [xScrollbarAttr, setXScrollbarAttr] = useReducer(reducer, {direction: 'x'})
    const [yScrollbarAttr, setYScrollbarAttr] = useReducer(reducer, {direction: 'y'})

    useEffect(() => {
        if (!canvas.current)
            return
        const {offsetHeight: height, offsetWidth: width} = canvas.current
        setXScrollbarAttr({ offsetHeight: width, scrollHeight: width + CANVAS_OFFSET })
        setYScrollbarAttr({ offsetHeight: height, scrollHeight: height + CANVAS_OFFSET })
    }, [])

    useEffect(() => {
        const subs = new Subscription()
        subs.add(on(window, EventType.RESIZE).subscribe(() => {
            if (!canvas.current)
                throw Error('not have canvas')
            const sheet = sheetSvc.getSheet()
            if (!sheet)
                throw Error('not have a sheet')
            const {offsetHeight: canvasHeight, offsetWidth: canvasWidth} = canvas.current
            const scrollWidth = sheet.maxWidth() > canvasWidth ?
                sheet.maxWidth() :
                sheet.scroll.x + canvasWidth + CANVAS_OFFSET
            const scrollHeight = sheet.maxHeight() > canvasHeight ?
                sheet.maxHeight() :
                sheet.scroll.y + canvasHeight + CANVAS_OFFSET
            setXScrollbarAttr({ offsetHeight: canvasWidth, scrollHeight: scrollWidth })
            setYScrollbarAttr({ offsetHeight: canvasHeight, scrollHeight })
        }))
        return () => {
            subs.unsubscribe()
        }
    }, [])

    const setScrollTop = (scrollTop: number, type: ScrollbarType) => {
        if (type === 'x')
            setXScrollbarAttr({ scrollTop: scrollTop })
        else if (type === 'y')
            setYScrollbarAttr({ scrollTop: scrollTop })
    }

    const mouseWheelScrolling = (
        delta: number,
        type: ScrollbarType,
    ) => {
        const sheet = sheetSvc.getSheet()
        if (!sheet || !canvas.current)
            return
        const oldScroll = type === 'x' ? sheet.scroll.x : sheet.scroll.y
        let newScroll = oldScroll + delta
        if (delta === 0)
            return
        // 不可能滚动到负数
        if (newScroll < 0)
            newScroll = 0
        if (newScroll === oldScroll)
            return
        if (type === 'y') {
            sheet.viewHeight = newScroll + canvas.current.offsetHeight + CANVAS_OFFSET
            setYScrollbarAttr({ scrollTop: newScroll, scrollHeight: sheet.maxHeight() })
        } else if (type === 'x') {
            sheet.viewWidth = newScroll + canvas.current.offsetWidth + CANVAS_OFFSET
            setXScrollbarAttr({ scrollTop: newScroll, scrollHeight: sheet.maxWidth() })
        }
        return newScroll
    }
    return {
        xScrollbarAttr,
        yScrollbarAttr,
        setScrollTop,
        mouseWheelScrolling,
    }
}
