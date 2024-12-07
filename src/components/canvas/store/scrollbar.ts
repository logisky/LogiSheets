import {action, makeObservable, observable} from 'mobx'
import {CanvasStore} from './store'
import {ScrollbarAttr, ScrollbarType} from '@/components/scrollbar'
import {CANVAS_OFFSET} from '@/core/data2'

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
        const scroll = this.store.dataSvc.getScroll()
        const {offsetHeight: canvasHeight, offsetWidth: canvasWidth} =
            this.store.render.canvas
        const scrollWidth = scroll.x + canvasWidth + CANVAS_OFFSET
        const scrollHeight = scroll.y + canvasHeight + CANVAS_OFFSET

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
        this.store.dataSvc.updateScroll(type, scrollTop)
        this.store.render.render()
    }

    @action
    mouseWheelScrolling = (delta: number, type: ScrollbarType) => {
        const scroll = this.store.dataSvc.getScroll()
        const oldScroll = type === 'x' ? scroll.x : scroll.y
        let newScroll = oldScroll + delta
        const canvas = this.store.render.canvas
        if (delta === 0) return
        if (newScroll < 0) newScroll = 0
        if (newScroll === oldScroll) return
        if (type === 'y') {
            const max = newScroll + canvas.offsetHeight + CANVAS_OFFSET
            this.yScrollbar.scrollTop = newScroll
            this.yScrollbar.scrollHeight = max
        } else if (type === 'x') {
            const max = newScroll + canvas.offsetWidth + CANVAS_OFFSET
            this.xScrollbar.scrollTop = newScroll
            this.xScrollbar.scrollHeight = max
        }
        return newScroll
    }
}
