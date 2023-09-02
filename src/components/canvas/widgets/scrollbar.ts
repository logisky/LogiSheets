import { CustomScrollEvent, ScrollbarType, xScrollbarStore, yScrollbarStore} from '@/components/scrollbar'
import {useLocalStore} from 'mobx-react'
import {autorun, runInAction} from 'mobx'
import {CANVAS_OFFSET, SheetService} from '@/core/data'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {WheelEvent, useEffect} from 'react'
import {useEventListener} from 'ahooks'
import { canvasStore } from '../store'
import { Buttons } from '@/core'
export const useScrollbar = () => {
    const xScrollbar = useLocalStore(() => xScrollbarStore)
    const yScrollbar = useLocalStore(() => yScrollbarStore)
    const canvas = useLocalStore(() => canvasStore)
    const sheetSvc = useInjection<SheetService>(TYPES.Sheet)

    useEffect(() => {
        const sub = canvas.obs().subscribe(data => {
            if (data.type === 'wheel') {
                const e = data.args as WheelEvent
                const delta = e.deltaY
                const newScroll = mouseWheelScrolling(delta, 'y') ?? 0
                const oldScroll = sheetSvc.getSheet()?.scroll.y
                if (oldScroll !== newScroll) {
                    sheetSvc.getSheet()?.scroll?.update('y', newScroll)
                }
                canvas.emit('yScroll', {e, oldScroll, newScroll})
            }
        })
        return () => {
            sub.unsubscribe()
        }
    }, [])

    useEffect(() => {
        const newScroll = xScrollbar.scrollTop
        const oldScroll = sheetSvc.getSheet()?.scroll.x
        if (oldScroll !== newScroll) sheetSvc.getSheet()?.scroll?.update('x', newScroll)
        const customEvent: CustomScrollEvent = {buttons: Buttons.UNDEFINED} 
        canvas.emit('xScroll', {e: customEvent, newScroll, oldScroll})
    }, [xScrollbar.scrollTop])

    useEffect(() => {
        const newScroll = yScrollbar.scrollTop
        const oldScroll = sheetSvc.getSheet()?.scroll.y
        if (oldScroll !== newScroll) sheetSvc.getSheet()?.scroll?.update('y', newScroll)
        const customEvent: CustomScrollEvent = {buttons: Buttons.UNDEFINED} 
        canvas.emit('yScroll', {e: customEvent, newScroll, oldScroll})
    }, [yScrollbar.scrollTop])

    useEffect(() => {
        autorun(() => {
            if (!canvas.canvas) return
            const {offsetHeight: height, offsetWidth: width} = canvas.canvas
            runInAction(() => {
                xScrollbar.offsetHeight = width
                xScrollbar.scrollHeight = width + CANVAS_OFFSET
                yScrollbar.offsetHeight = height
                yScrollbar.scrollHeight = height + CANVAS_OFFSET
            })
        })
    }, [])
    useEventListener('resize', () => {
        if (!canvas.canvas) throw Error('not have canvas')
        const sheet = sheetSvc.getSheet()
        if (!sheet) throw Error('not have a sheet')
        const {offsetHeight: canvasHeight, offsetWidth: canvasWidth} =
            canvas.canvas
        const scrollWidth =
            sheet.maxWidth() > canvasWidth
                ? sheet.maxWidth()
                : sheet.scroll.x + canvasWidth + CANVAS_OFFSET
        const scrollHeight =
            sheet.maxHeight() > canvasHeight
                ? sheet.maxHeight()
                : sheet.scroll.y + canvasHeight + CANVAS_OFFSET
        runInAction(() => {
            xScrollbar.offsetHeight = canvasWidth
            xScrollbar.scrollHeight = scrollWidth
            yScrollbar.offsetHeight = canvasHeight
            yScrollbar.scrollHeight = scrollHeight
        })
    })

    const mouseWheelScrolling = (delta: number, type: ScrollbarType) => {
        const sheet = sheetSvc.getSheet()
        if (!sheet || !canvas.canvas) return
        const oldScroll = type === 'x' ? sheet.scroll.x : sheet.scroll.y
        let newScroll = oldScroll + delta
        if (delta === 0) return
        // 不可能滚动到负数
        if (newScroll < 0) newScroll = 0
        if (newScroll === oldScroll) return
        if (type === 'y') {
            sheet.viewHeight =
                newScroll + canvas.canvas.offsetHeight + CANVAS_OFFSET
            runInAction(() => {
                yScrollbar.scrollTop = newScroll
                yScrollbar.scrollHeight = sheet.maxHeight()
            })
        } else if (type === 'x') {
            sheet.viewWidth =
                newScroll + canvas.canvas.offsetWidth + CANVAS_OFFSET
            runInAction(() => {
                xScrollbar.scrollTop = newScroll
                xScrollbar.scrollHeight = sheet.maxWidth()
            })
        }
        return newScroll
    }
    return {
        mouseWheelScrolling,
    }
}
