import {DataService} from '@logi-sheets/web/core/data'
import {BehaviorSubject, Subscription, Subject} from 'rxjs'
import {StartCellManager} from './start-cell-manager'
import {getCell} from './match'
import {SelectorManager} from './selector-manager'
import {Cell} from './cell'
export class DndManager extends Subscription {
    constructor(
        public readonly selector: SelectorManager,
        public readonly dataSvc: DataService,
        public readonly canvas: HTMLCanvasElement,
        public readonly startCellMng: StartCellManager,
    ) {
        super()
        this._init()
    }
    x$ = new BehaviorSubject<number>(-1)
    y$ = new BehaviorSubject<number>(-1)
    width$ = new BehaviorSubject<number>(-1)
    height$ = new BehaviorSubject<number>(-1)
    draggingX$ = new BehaviorSubject<number>(-1)
    draggingY$ = new BehaviorSubject<number>(-1)
    mouseup$ = new Subject<Cell>()
    isDragging = false

    onMouseDown(e: MouseEvent) {
        this.isDragging = true
        this._mousedown = {x: e.clientX, y: e.clientY}
    }

    onMouseMove(e: MouseEvent) {
        if (!this._mousedown)
            return
        const newX = this.x$.value + e.clientX - this._mousedown.x
        const newY = this.y$.value + e.clientY - this._mousedown.y
        const cell = getCell(newX, newY, this.dataSvc)
        const {width, height} = this.canvas.getBoundingClientRect()
        if (cell.type !== 'Cell')
            return
        if (newX + this.width$.value > width)
            return
        if (newY + this.height$.value > height)
            return
        this._draggingDepCell = cell
        this.draggingX$.next(cell.position.startCol)
        this.draggingY$.next(cell.position.startRow)
    }

    onMouseUp() {
        this.mouseup$.next(this._draggingDepCell)
        this._clean()
    }
    private _draggingDepCell?: Cell
    private _mousedown?: {x: number, y: number}
    private _clean() {
        this._mousedown = undefined
        this.draggingX$.next(-1)
        this.draggingY$.next(-1)
    }

    private _init() {
        this.add(this.selector.selector$().subscribe(sel => {
            if (!sel) {
                this._clean()
                return
            }
            this.x$.next(sel.x)
            this.y$.next(sel.y)
            this.width$
                .next(sel.width + sel.borderLeftWidth + sel.borderRightWidth)
            this.height$
                .next(sel.height + sel.borderBottomWidth + sel.borderTopWidth)
        }))
    }
}
