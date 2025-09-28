import {action, makeObservable, observable} from 'mobx'
import {CanvasStore} from './store'
import type {ScrollbarAttr, ScrollbarType} from '@/components/scrollbar'
import {isErrorMessage} from 'logisheets-web'
import {ptToPx, widthToPx} from '@/core'

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
        this.store.dataSvc
            .getSheetDimension(this.store.currSheetIdx)
            .then((v) => {
                if (isErrorMessage(v)) {
                    throw Error(
                        `failed to get sheet dimension: ${this.store.currSheetIdx}`
                    )
                }

                this._init(ptToPx(v.height), widthToPx(v.width))
            })
    }

    @action
    _init(dimensionHeight: number, dimensionWidth: number) {
        const {height, width} = this.store.getCanvasSize()
        const h = Math.max(dimensionHeight, height)
        const w = Math.max(dimensionWidth, width)
        this.xScrollbar.scrollTop = this.store.anchorX
        this.xScrollbar.scrollHeight = w
        this.xScrollbar.offsetHeight = width
        this.yScrollbar.scrollTop = this.store.anchorY
        this.yScrollbar.scrollHeight = h
        this.yScrollbar.offsetHeight = height
        this._appropriateHeight = h
        this._appropriateWidth = w
    }

    @action
    onResize() {
        this.init()
    }

    /**
     * Make sure this happens after the anchor X or Y is updated.
     */
    @action
    update(type: ScrollbarType) {
        const {height, width} = this.store.getCanvasSize()
        if (type === 'x') {
            this.xScrollbar.scrollTop = this.store.anchorX
            const viewLength = this.store.anchorX + width
            if (this.store.anchorX + width > this.xScrollbar.scrollHeight) {
                this.xScrollbar.scrollHeight = this.store.anchorX + width
            } else if (viewLength < this._appropriateWidth) {
                this.xScrollbar.scrollHeight = this._appropriateWidth
            }
        } else {
            this.yScrollbar.scrollTop = this.store.anchorY
            const viewLength = this.store.anchorY + height
            if (viewLength > this.yScrollbar.scrollHeight) {
                this.yScrollbar.scrollHeight = viewLength
            } else if (viewLength < this._appropriateHeight) {
                this.yScrollbar.scrollHeight = this._appropriateHeight
            }
        }
    }

    @action
    setScrollTop = (scrollTop: number, type: ScrollbarType) => {
        if (type === 'x') {
            this.xScrollbar.scrollTop = scrollTop
        } else if (type === 'y') {
            this.yScrollbar.scrollTop = scrollTop
        }
        this.store.render()
    }

    private _appropriateHeight: number = 0
    private _appropriateWidth: number = 0
}
