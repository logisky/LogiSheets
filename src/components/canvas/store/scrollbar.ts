import {action, makeObservable, observable} from 'mobx'
import {CanvasStore} from './store'
import {ScrollbarAttr, ScrollbarType} from '@/components/scrollbar'
import {CANVAS_OFFSET} from '@/core/data'

export class ScrollBar {
    constructor(public readonly store: CanvasStore) {
        makeObservable(this)
    }

    @observable
    xScrollbar = {direction: 'x'} as ScrollbarAttr

    @observable
    yScrollbar = {direction: 'y'} as ScrollbarAttr

    @action
    init() {
        const {offsetHeight: height, offsetWidth: width} =
            this.store.render.canvas
        this.xScrollbar.offsetHeight = width
        this.xScrollbar.scrollHeight = width + CANVAS_OFFSET
        this.yScrollbar.offsetHeight = height
        this.yScrollbar.scrollHeight = height + CANVAS_OFFSET
    }

    @action
    onResize() {
        const sheet = this.store.sheetSvc.getSheet()
        if (!sheet) throw Error('not have a sheet')
        const {offsetHeight: canvasHeight, offsetWidth: canvasWidth} =
            this.store.render.canvas
        const scrollWidth =
            sheet.maxWidth() > canvasWidth
                ? sheet.maxWidth()
                : sheet.scroll.x + canvasWidth + CANVAS_OFFSET
        const scrollHeight =
            sheet.maxHeight() > canvasHeight
                ? sheet.maxHeight()
                : sheet.scroll.y + canvasHeight + CANVAS_OFFSET

        this.xScrollbar.offsetHeight = canvasWidth
        this.xScrollbar.scrollHeight = scrollWidth
        this.yScrollbar.offsetHeight = canvasHeight
        this.yScrollbar.scrollHeight = scrollHeight
    }

    @action
    setScrollTop = (scrollTop: number, type: ScrollbarType) => {
        if (type === 'x') {
            this.xScrollbar.scrollTop = scrollTop
        } else if (type === 'y') {
            this.yScrollbar.scrollTop = scrollTop
        }
        this.store.sheetSvc.getSheet()?.scroll.update(type, scrollTop)
        this.store.render.render()
    }

    @action
    mouseWheelScrolling = (delta: number, type: ScrollbarType) => {
        const sheet = this.store.sheetSvc.getSheet()
        if (!sheet) return
        const oldScroll = type === 'x' ? sheet.scroll.x : sheet.scroll.y
        let newScroll = oldScroll + delta
        const canvas = this.store.render.canvas
        if (delta === 0) return
        // 不可能滚动到负数
        if (newScroll < 0) newScroll = 0
        if (newScroll === oldScroll) return
        if (type === 'y') {
            sheet.viewHeight = newScroll + canvas.offsetHeight + CANVAS_OFFSET
            this.yScrollbar.scrollTop = newScroll
            this.yScrollbar.scrollHeight = sheet.maxHeight()
        } else if (type === 'x') {
            sheet.viewWidth = newScroll + canvas.offsetWidth + CANVAS_OFFSET
            this.xScrollbar.scrollTop = newScroll
            this.xScrollbar.scrollHeight = sheet.maxWidth()
        }
        return newScroll
    }
}
