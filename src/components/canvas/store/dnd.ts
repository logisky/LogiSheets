import {action, makeObservable, observable} from 'mobx'
import {Range} from '@/core/standable'
import {CanvasStore} from './store'
import {Cell, match} from '../defs'
import {getPosition, getSelector} from './selector'
import {AttributeName} from '@/core'

export class Dnd {
    constructor(public readonly store: CanvasStore) {
        makeObservable(this)
    }

    @observable
    dragging?: Range

    @observable.ref
    range?: Range

    @action
    reset() {
        this.dragging = undefined
        this.range = undefined
    }

    @action
    selectorChange(selector?: _Selector) {
        if (!selector) {
            this.reset()
        } else {
            this._setRange(selector)
        }
    }

    @action
    onMouseDown(e: MouseEvent) {
        const target = e.target as HTMLDivElement
        const isHandle = target.getAttribute(AttributeName.SELECTOR_DND_HANDLE)
        if (isHandle === null) {
            this._mousedownStart = undefined
            return false
        }
        this._mousedownStart = {x: e.clientX, y: e.clientY}
        return true
    }

    @action
    onMouseMove = (e: MouseEvent, startCell: Cell, oldEnd: Cell) => {
        if (!this._mousedownStart) return false
        const moved = {
            x: e.clientX - this._mousedownStart.x,
            y: e.clientY - this._mousedownStart.y,
        }
        if (startCell.type !== 'Cell') return true
        const endCell = match(
            oldEnd.position.startCol + moved.x,
            oldEnd.position.startRow + moved.y,
            this.store.render.canvas,
            this.store.dataSvc.cachedViewRange
        )
        if (endCell.type !== 'Cell') return true
        this._setEnd({start: startCell, end: endCell})
        return true
    }

    @action
    onMouseUp() {
        this._setEnd(undefined)
    }

    @action
    private _setRange(selector?: _Selector) {
        this._selector = selector
        const sel = selector
            ? getSelector(
                  this.store.render.canvas,
                  selector.start,
                  selector.end
              )
            : undefined
        const newRange = sel ? getPosition(sel) : undefined
        this.range = newRange
    }
    private _selector?: _Selector
    private _endSelector?: _Selector

    private _mousedownStart?: {x: number; y: number}

    @action
    private _setEnd = (selector?: _Selector) => {
        this._endSelector = selector
        const sel = selector
            ? getSelector(
                  this.store.render.canvas,
                  selector.start,
                  selector.end
              )
            : undefined
        const draggingRange = sel ? getPosition(sel) : undefined
        this.dragging = draggingRange
    }
}

interface _Selector {
    readonly start: Cell
    readonly end?: Cell
}
