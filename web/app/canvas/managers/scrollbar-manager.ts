import {Subscription, BehaviorSubject, Observable, Subject} from 'rxjs'
import {EventType, on} from '@logi-sheets/web/core/events'
import {
    ScrollbarAttr,
    ScrollbarAttrBuilder,
    ScrollbarType,
    ScrollEvent,
    ScrollEventBuilder,
} from '@logi-sheets/web/app/scrollbar'
import {CANVAS_OFFSET, DataService} from '@logi-sheets/web/core/data'
export class ScrollbarManager extends Subscription {
    // tslint:disable-next-line: max-func-body-length
    constructor(
        public readonly canvasEl: HTMLCanvasElement,
        public readonly host: HTMLElement,
        public readonly dataSvc: DataService,
    ) {
        super()
        const width = this.dataSvc.sheetSvc.updateMaxWidth(this._minWidth)
        const scroll = this.dataSvc.scroll
        this._xScrollbar = new ScrollbarAttrBuilder()
            .containerLength(this._canvasWidth)
            .containerTotalLength(width)
            .scrollDistance(scroll.x)
            .build()
        this._xScrollbar$ = new BehaviorSubject(this._xScrollbar)
        const height = this.dataSvc.sheetSvc.updateMaxHeight(this._minHeight)
        this._yScrollbar = new ScrollbarAttrBuilder()
            .containerLength(this._canvasHeight)
            .containerTotalLength(height)
            .scrollDistance(scroll.y)
            .build()
        this._yScrollbar$ = new BehaviorSubject(this._yScrollbar)
        this._listen()
    }

    mouseMove(e: ScrollEvent): void {
        if (e.delta === 0)
            return
        if (e.type === 'x') {
            this._xScrollbar = new ScrollbarAttrBuilder(this._xScrollbar)
                .scrollDistance(e.scrollDistance)
                .build()
            this.dataSvc.updateScroll(e.scrollDistance)
            this._xScrollbar$.next(this._xScrollbar)
        }
        else if (e.type === 'y') {
            this._yScrollbar = new ScrollbarAttrBuilder(this._yScrollbar)
                .scrollDistance(e.scrollDistance)
                .build()
            this.dataSvc.updateScroll(undefined, e.scrollDistance)
            this._yScrollbar$.next(this._yScrollbar)
        }
        this._scorllEvent$.next(e)
        this._render$.next()
    }

    xScrollbar$(): Observable<ScrollbarAttr> {
        return this._xScrollbar$
    }

    yScrollbar$(): Observable<ScrollbarAttr> {
        return this._yScrollbar$
    }

    render$(): Observable<undefined> {
        return this._render$
    }

    scrollEvent$(): Observable<ScrollEvent> {
        return this._scorllEvent$
    }
    private _xScrollbar: ScrollbarAttr
    private _yScrollbar: ScrollbarAttr
    private _xScrollbar$: BehaviorSubject<ScrollbarAttr>
    private _yScrollbar$: BehaviorSubject<ScrollbarAttr>
    private _scorllEvent$ = new Subject<ScrollEvent>()
    private _render$ = new Subject<undefined>()

    private _listen(): void {
        this.add(on(this.canvasEl, EventType.MOUSE_WHEEL).subscribe(e => {
            const delta = e.deltaX === 0 ? e.deltaY : e.deltaX
            const type = e.deltaX === 0 ? 'y' : 'x'
            const changed = this._mouseWheelScrolling(delta, type)
            if (!changed)
                return
            type === 'y' ? this._yScrollbar$.next(this._yScrollbar)
                : this._xScrollbar$.next(this._xScrollbar)
            this._render$.next()
        }))
        this.add(on(window, EventType.RESIZE).subscribe(() => {
            const height = this.dataSvc.sheetSvc.maxHeight()
            const width = this.dataSvc.sheetSvc.maxWidth()
            this._xScrollbar = new ScrollbarAttrBuilder(this._xScrollbar)
                .containerLength(this._canvasWidth)
                .containerTotalLength(width)
                .build()
            this._xScrollbar$.next(this._xScrollbar)
            this._yScrollbar = new ScrollbarAttrBuilder(this._yScrollbar)
                .containerLength(this._canvasHeight)
                .containerTotalLength(height)
                .build()
            this._yScrollbar$.next(this._yScrollbar)
        }))
    }

    private _mouseWheelScrolling(delta: number, type: ScrollbarType): boolean {
        if (delta === 0)
            return false
        const deltaX = type === 'x' ? delta : 0
        const deltaY = type === 'y' ? delta : 0
        const scrollEvent = new ScrollEventBuilder().type(type).trust(true)
        if (deltaY) {
            const oldScrollY = this.dataSvc.scroll.y
            if (deltaY < 0 && oldScrollY === 0)
                return false
            let scrollY = this.dataSvc.scroll.y + deltaY
            if (scrollY < 0)
                scrollY = 0
            this.dataSvc.updateScroll(undefined, scrollY)
            let height = scrollY + this._canvasHeight
            height = height < this._minHeight ? this._minHeight : height
            height = this.dataSvc.sheetSvc.updateMaxHeight(height)
            scrollEvent.delta(scrollY - oldScrollY).scrollDistance(scrollY)
            this._yScrollbar = new ScrollbarAttrBuilder(this._yScrollbar)
                .containerLength(this._canvasHeight)
                .containerTotalLength(height)
                .scrollDistance(scrollY)
                .build()
        } else if (deltaX) {
            const oldScrollX = this.dataSvc.scroll.x
            if (deltaX < 0 && oldScrollX === 0)
                return false
            let scrollX = oldScrollX + deltaX
            if (scrollX < 0)
                scrollX = 0
            this.dataSvc.updateScroll(scrollX)
            let width = scrollX + this._canvasWidth
            width = width < this._minWidth ? this._minWidth : width
            width = this.dataSvc.sheetSvc.updateMaxWidth(width)
            scrollEvent.delta(scrollX - oldScrollX).scrollDistance(scrollX)
            this._xScrollbar = new ScrollbarAttrBuilder(this._xScrollbar)
                .containerLength(this._canvasWidth)
                .containerTotalLength(width)
                .scrollDistance(scrollX)
                .build()
        } else
            return false
        this._scorllEvent$.next(scrollEvent.build())
        this._render$.next()
        return true
    }

    private get _canvasWidth(): number {
        return this.canvasEl.offsetWidth
    }

    private get _canvasHeight(): number {
        return this.canvasEl.offsetHeight
    }

    private get _minWidth(): number {
        return this._canvasWidth
    }

    private get _minHeight(): number {
        return this._canvasHeight + CANVAS_OFFSET
    }
}
