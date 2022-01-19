import {
    ChangeDetectorRef,
    Output,
    EventEmitter,
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    ViewChild,
    OnDestroy,
} from '@angular/core'
import {DataService} from '@logi-sheets/web/core/data'
import {
    MouseDownEvent,
    MouseDownEventBuilder,
    MouseDownType,
    SelectedCell,
    SelectedCellBuilder,
} from './events'
import {EventType, on} from '@logi-sheets/web/core/events'
import {Selector} from '@logi-sheets/web/app/selector'
import {Subscription, merge} from 'rxjs'
import {ScrollbarAttr, ScrollEvent} from '@logi-sheets/web/app/scrollbar'
import {
    CellInputBuilder,
    PayloadBuilder,
    TransactionBuilder,
    _Payload_Payload_oneof,
} from '@logi-pb/network/src/proto/message_pb'
import {BlurEvent, Context} from '@logi-sheets/web/app/textarea'
import {Render} from './render'
import * as Mng from './managers'
export const OFFSET = 100

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'logi-canvas',
    styleUrls: ['./canvas.component.scss'],
    templateUrl: './canvas.component.html',
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
    public constructor(
        private readonly _cd: ChangeDetectorRef,
        private readonly _el: ElementRef<HTMLElement>,
        public readonly dataSvc: DataService,
        public readonly startCellMng: Mng.StartCellManager,
        public readonly commentMng: Mng.CommentManager,
        public readonly renderMng: Render,
        public readonly selectorMng: Mng.SelectorManager,
    ) {}
    @Output() readonly scrollEvent$ = new EventEmitter<ScrollEvent>()
    @Output() readonly mousedown$ = new EventEmitter<MouseDownEvent>()
    @Output() readonly selectedCell$ = new EventEmitter<SelectedCell>()
    scrollbarMng?: Mng.ScrollbarManager
    dndMng?: Mng.DndManager
    textMng?: Mng.TextManager
    editing = false
    xScrollbar?: ScrollbarAttr
    yScrollbar?: ScrollbarAttr
    textContext?: Context
    selector?: Selector
    settings = this.dataSvc.settings
    get el(): HTMLElement {
        return this._el.nativeElement
    }

    toPx(px: number | string): string {
        return `${px}px`
    }

    ngAfterViewInit(): void {
        this._subs.add(on(this.el, EventType.MOUSE_DOWN).subscribe(e => {
            if (e.button === 2)
                return
            if (!this.dndMng?.isDragging)
                this.startCellMng.mousedown(e, this._canvasEl)
            const sub = new Subscription()
            sub.add(on(window, EventType.MOUSE_UP).subscribe(() => {
                if (!this.dndMng?.isDragging)
                    this.selectorMng.onMouseUp(this._canvasEl)
                this.dndMng?.onMouseUp()
                sub.unsubscribe()
            }))
            sub.add(on(window, EventType.MOUSE_MOVE).subscribe(mme => {
                mme.preventDefault()
                if (!this.dndMng?.isDragging)
                    this.selectorMng.onMouseMove(mme, this._canvasEl)
                this.dndMng?.onMouseMove(mme)
            }))
        }))
        this._init()
    }

    ngOnDestroy(): void {
        this._subs.unsubscribe()
        this.scrollbarMng?.unsubscribe()
        this.textMng?.unsubscribe()
        this._commentMng?.unsubscribe()
        this.dndMng?.unsubscribe()
    }

    blur(e: BlurEvent): void {
        const oldText = this.textContext?.text ?? ''
        this.textMng?.blur()
        if (e.bindingData === undefined)
            return
        if (!Mng.isCell(e.bindingData))
            return
        const newText = e.text.trim()
        if (oldText === newText)
            return
        const input = new CellInputBuilder()
            .sheetIdx(this.dataSvc.sheetSvc.getActiveSheet())
            .row(e.bindingData.coodinate.startRow)
            .col(e.bindingData.coodinate.startCol)
            .input(newText)
            .build()
        const payload = new PayloadBuilder()
            .payloadOneof(input, _Payload_Payload_oneof.CELL_INPUT)
            .build()
        const transaction = new TransactionBuilder().payloads([payload]).build()
        this.dataSvc.backend.send(transaction)
    }

    mouseMoveScrolling(e: ScrollEvent): void {
        this.scrollbarMng?.mouseMove(e)
    }

    @ViewChild('logi_sheet_canvas')
    private readonly _canvas!: ElementRef<HTMLCanvasElement>
    private _commentMng?: Mng.CommentManager
    private _subs = new Subscription()
    private _initDndMng(dataSvc: DataService) {
        const mng = new Mng.DndManager(this.selectorMng, dataSvc, this._canvasEl, this.startCellMng)
        this.dndMng = mng
        this._subs.add(mng.mouseup$.subscribe(e => {
            if (!e)
                return
        }))
        return mng
    }

    private _initStartCellMng() {
        this._subs.add(this.startCellMng.startCell$().subscribe(e => {
            if (e === undefined || e.same)
                return
            if (e.cell.type !== 'Cell')
                return
            const {startRow: row, startCol: col} = e.cell.coodinate
            const info = this.dataSvc.sheetSvc.getCell(row, col)
            const me = new MouseDownEventBuilder().cellText('')
            if (info) {
                const text = info.formula ? info.getFormular() : info.getText()
                const type = info.formula ? MouseDownType.FORMULA : MouseDownType.TEXT
                me.cellText(text).type(type)
            }
            this.mousedown$.next(me.build())
            const selectedCell = new SelectedCellBuilder()
                .row(row)
                .col(col)
                .build()
            this.selectedCell$.next(selectedCell)
        }))
    }

    private _initScrollbarMng(): void {
        const scrollbar = new Mng.ScrollbarManager(this._canvasEl, this.el, this.dataSvc)
        this.scrollbarMng = scrollbar
        this._subs.add(scrollbar.scrollEvent$().subscribe(e => {
            this.scrollEvent$.next(e)
        }))
        this._subs.add(scrollbar.xScrollbar$().subscribe(e => {
            this.xScrollbar = e
            this._cd.markForCheck()
        }))
        this._subs.add(scrollbar.yScrollbar$().subscribe(e => {
            this.yScrollbar = e
            this._cd.markForCheck()
        }))
        this._subs.add(scrollbar.render$().subscribe(() => {
            this.renderMng.render(this._canvasEl)
        }))
    }

    private _init(): void {
        this._initRenderMng()
        this._initStartCellMng()
        this._initScrollbarMng()
        this._initTextMng()
        this._initSelectorMng()
        this._initDndMng(this.dataSvc)
        const contextmenuEvent = [
            on(this.el, EventType.CONTEXT_MENU),
            on(this._canvasEl, EventType.CONTEXT_MENU),
        ]
        this._subs.add(merge(...contextmenuEvent).subscribe(e => {
            this._onContextMenu(e)
        }))
        this.renderMng.render(this._canvasEl)
        this.dataSvc.sendDisplayArea()
    }

    private _initRenderMng() {
        this._subs.add(this.renderMng.rendered$().subscribe(() => {
            this.startCellMng.rendered(this._canvasEl)
        }))
        this._subs.add(on(window, EventType.RESIZE).subscribe(() => {
            this.renderMng.render(this._canvasEl)
        }))
        this._subs.add(this.dataSvc.backend.render$.subscribe(() => {
            this.renderMng.render(this._canvasEl)
        }))
    }

    private _initSelectorMng() {
        this._subs.add(this.selectorMng.selector$().subscribe(selector => {
            this.selector = selector
            this._cd.detectChanges()
        }))
    }

    private _initTextMng() {
        this.textMng = new Mng.TextManager(this.dataSvc, this.startCellMng, this._canvasEl)
        this._subs.add(this.textMng.editing$().subscribe(e => {
            this._cd.markForCheck()
            this.editing = e
        }))
        this._subs.add(this.textMng.context$().subscribe(e => {
            this.textContext = e
            this._cd.detectChanges()
        }))
    }

    private _onContextMenu(e: MouseEvent): void {
        e.preventDefault()
        e.stopImmediatePropagation()
        this.startCellMng.contextmenu(e, this._canvasEl)
    }

    private get _canvasEl(): HTMLCanvasElement {
        return this._canvas.nativeElement
    }
}
