import {Injectable, OnDestroy} from '@angular/core'
import {BehaviorSubject, Observable, Subscription} from 'rxjs'
import {DataService} from '@logi-sheets/web/core/data'
import {Selector, SelectorBuilder} from '@logi-sheets/web/app/selector'
import {StartCellManager} from './start-cell-manager'
import {match} from './match'
import {Cell} from './cell'
import {RangeBuilder} from '@logi-sheets/web/core/standable'

@Injectable({providedIn: 'root'})
export class SelectorManager extends Subscription implements OnDestroy {
    constructor(
        public readonly dataSvc: DataService,
        public readonly startCellMng: StartCellManager,
    ) {
        super()
        this._init()
    }
    startCell = this.startCellMng.startCell
    endCell?: Cell
    ngOnDestroy() {
        this.unsubscribe()
    }

    selector$(): Observable<Selector | undefined> {
        return this._selector$
    }

    selector() {
        return this._selector$.value
    }

    onContextmenu(e: MouseEvent, canvas: HTMLCanvasElement) {
        const startCell = this.startCellMng.startCell
        const {position: start} = startCell
        const {position: end} = this.endCell ?? startCell
        const currCell = match(e.clientX, e.clientY, this.dataSvc, canvas)
        const selectorPos = new RangeBuilder()
            .startRow(start.startRow > end.startRow ? end.startRow : start.startRow)
            .endRow(start.endRow > end.endRow ? start.endRow : start.endRow)
            .startCol(
                start.startCol > end.startCol ? end.startCol : start.startCol
            )
            .endCol(start.endCol > end.endCol ? start.endCol : end.endCol)
            .build()
        if (selectorPos.cover(currCell.position))
            return
        this.endCell = undefined
        this.startCell = startCell
        this._updateSelector(canvas)
    }

    onMouseDown(canvas: HTMLCanvasElement) {
        this.endCell = undefined
        this.startCell = this.startCellMng.startCell
        this._updateSelector(canvas)
    }

    onMouseMove(e: MouseEvent, canvas: HTMLCanvasElement) {
        const matchCell = match(e.clientX, e.clientY, this.dataSvc, canvas)
        /**
         * TODO(minglong): scroll select cell
         */
        if (matchCell.type === 'unknown')
            return
        this.endCell = matchCell
        this._updateSelector(canvas)
    }

    onMouseUp(canvas: HTMLCanvasElement) {
        this._updateSelector(canvas)
    }
    private _selector$ = new BehaviorSubject<Selector | undefined>(undefined)
    private _init() {
        this.add(this.startCellMng.startCell$().subscribe(e => {
            if (e === undefined)
                this._selector$.next(undefined)
            else if (e.from === 'render')
                this._updateSelector(e.element)
            else if (e.from === 'mousedown')
                this.onMouseDown(e.element)
            else if (e.from === 'contextmenu')
                // tslint:disable-next-line: no-type-assertion
                this.onContextmenu(e.event as MouseEvent, e.element)
            else
                this._selector$.next(undefined)
        }))
    }

    private _updateSelector(canvas: HTMLCanvasElement) {
        const startCell = this.startCell
        const {type, width, height, position: startPos} = startCell
        const endCell = this.endCell ?? startCell
        const {position: endPos} = endCell
        if (type === 'unknown') {
            this._selector$.next(undefined)
            return
        }
        const selector = new SelectorBuilder().width(width).height(height)
        // 在单元格内框选
        if (endPos.startRow < startPos.startRow)
            selector
                .borderTopWidth(startPos.startRow - endPos.startRow)
                .y(endPos.startRow)
        else
            selector
                .borderBottomWidth(endPos.endRow - startPos.endRow)
                .y(startPos.startRow)
        if (endPos.startCol < startPos.startCol)
            selector
                .borderLeftWidth(startPos.startCol - endPos.startCol)
                .x(endPos.startCol)
        else
            selector
                .borderRightWidth(endPos.endCol - startPos.endCol)
                .x(startPos.startCol)
        // 起始点在左固定栏、上固定栏、leftTop
        const {width: totalWidth, height: totalHeight} =
            canvas.getBoundingClientRect()
        if (type === 'LeftTop')
            selector
                .x(startPos.startRow)
                .y(startPos.startCol)
                .borderRightWidth(totalWidth - width)
                .borderBottomWidth(totalHeight - height)
        // 起始点在左固定栏、上固定栏时，x,y的判断和type==='cell'一致
        else if (type === 'FixedLeftHeader')
            selector.borderRightWidth(totalWidth - width)
        else if (type === 'FixedTopHeader')
            selector.borderBottomWidth(totalHeight - height)
        this._selector$.next(selector.build())
    }
}
