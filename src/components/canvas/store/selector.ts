import {action, makeObservable, observable} from 'mobx'
import {CanvasStore} from './store'
import {SelectorProps} from '@/components/selector'
import {Range} from '@/core/standable'
import {Cell} from '../defs'

export class Selector {
    constructor(public readonly store: CanvasStore) {
        makeObservable(this)
    }
    @observable
    selector?: SelectorProps

    @observable.ref
    startCell?: Cell

    @observable.ref
    endCell?: Cell

    @action
    reset() {
        this.selector = undefined
        this._aftetUpdateSelector()
    }

    @action
    startCellChange() {
        if (!this.store?.startCell) {
            this._aftetUpdateSelector()
            return
        }
        // if (e.from === 'scroll') this.onScroll(e.cell)
        // else if (!e.same) {
        //     if (e.from === 'mousedown') this.onMouseDown(e.cell)
        //     else if (e.from === 'contextmenu') this.onContextmenu(e.cell)
        //     else this._setSelector()
        // }
    }

    @action
    onContextmenu(startCell: Cell) {
        this.endCell = undefined
        this.startCell = startCell
    }

    @action
    onMouseUp() {
        if (!this.store.startCell) {
            this.selector = undefined
            return
        }
        this.selector = new SelectorProps()
        this.updateSelector(this.startCell, this.endCell)
    }

    @action
    onMouseDown() {
        this.endCell = undefined
        this.startCell = this.store.startCell
        if (!this.store.startCell) {
            this.selector = undefined
            return
        }
        this.selector = new SelectorProps()
        this.updateSelector(this.startCell, this.endCell)
    }

    @action
    onJumpToCell(cell: Cell) {
        this.startCell = cell
        this.endCell = undefined
        this.selector = new SelectorProps()
        this.updateSelector(this.startCell, this.endCell)
    }

    @action
    onMouseMove(matchCell: Cell) {
        this.endCell = matchCell
        this.updateSelector(this.startCell, this.endCell)
    }

    @action
    onScroll(startCell: Cell) {
        this.startCell = startCell
        this.endCell = undefined
        this.updateSelector(this.startCell, this.endCell)
    }

    @action
    private _aftetUpdateSelector() {
        if (!this.selector) {
            this.store.dnd.reset()
        } else if (!this.startCell) {
            this.store.dnd.reset()
        } else {
            this.store.dnd.selectorChange({
                start: this.startCell,
                end: this.endCell ?? this.startCell,
            })
        }
    }

    @action
    updateSelector(start?: Cell, end?: Cell) {
        if (!this.selector) return
        const selector = this.getSelector(start, end)
        this.selector = selector
        this._aftetUpdateSelector()
        return selector
    }

    getSelector(start?: Cell, end?: Cell) {
        if (!start) return
        const {type, width, height, position: sp} = start
        if (type === 'unknown') return

        const selector = new SelectorProps()
        const endCellInner = end ?? start
        const {position: ep} = endCellInner
        const startPos = this.store.convertToMainCanvasPosition(sp, type)
        const endPos = this.store.convertToMainCanvasPosition(ep, type)
        selector.width = width
        selector.height = height

        if (endPos.startRow < startPos.startRow) {
            selector.borderTopWidth = startPos.startRow - endPos.startRow
            selector.y = endPos.startRow
        } else {
            selector.borderBottomWidth = endPos.endRow - startPos.endRow
            selector.y = startPos.startRow
        }
        if (endPos.startCol < startPos.startCol) {
            selector.borderLeftWidth = startPos.startCol - endPos.startCol
            selector.x = endPos.startCol
        } else {
            selector.borderRightWidth = endPos.endCol - startPos.endCol
            selector.x = startPos.startCol
        }

        const {width: totalWidth, height: totalHeight} =
            this.store.renderer.canvas.getBoundingClientRect()
        if (type === 'LeftTop') {
            selector.x = startPos.startRow
            selector.y = startPos.startCol
            selector.borderRightWidth = totalWidth - width
            selector.borderBottomWidth = totalHeight - height
        } else if (type === 'FixedLeftHeader')
            selector.borderRightWidth = totalWidth - width
        else if (type === 'FixedTopHeader')
            selector.borderBottomWidth = totalHeight - height
        return selector
    }
}

export const getPosition = (selector: SelectorProps) => {
    return new Range()
        .setStartRow(selector.y)
        .setStartCol(selector.x)
        .setEndRow(
            selector.y +
                selector.height +
                selector.borderTopWidth +
                selector.borderBottomWidth
        )
        .setEndCol(
            selector.x +
                selector.width +
                selector.borderLeftWidth +
                selector.borderRightWidth
        )
}
