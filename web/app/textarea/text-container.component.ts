// tslint:disable: limit-indent-for-method-in-class
import {
    ChangeDetectorRef,
    ElementRef,
    Component,
    ViewChild,
    AfterViewInit,
    OnDestroy,
    ChangeDetectionStrategy,
    Renderer2,
    Input,
    OnChanges,
    SimpleChanges,
    Output,
    EventEmitter,
} from '@angular/core'
import {Subscription, timer} from 'rxjs'
import {on, EventType} from '@logi-sheets/web/core/events'
import {
    TextManager,
    SelectionManager,
    Context,
    CursorManager,
    TextareaInputManager,
} from './managers'
import {BlurEvent, BlurEventBuilder, CursorEventBuilder} from './events'

@Component({
    selector: 'logi-text-container',
    templateUrl: './text-container.component.html',
    styleUrls: ['./text-container.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextContainerComponent implements AfterViewInit, OnDestroy, OnChanges {
    constructor(
        private readonly _renderer2: Renderer2,
        private readonly _cd: ChangeDetectorRef,
        private readonly _el: ElementRef<HTMLElement>,
    ) { }
    showCursor = false
    triggerText = ''
    cursorX = 0
    cursorY = 0
    cursorEvent = new CursorEventBuilder().build()
    @Input() context!: Context
    @Output() readonly blur$ = new EventEmitter<BlurEvent>()
    @Output() readonly type$ = new EventEmitter<string>()
    @Output() readonly triggerText$ = new EventEmitter<string>()
    get el(): HTMLElement {
        return this._el.nativeElement
    }

    get textCanvas(): HTMLCanvasElement {
        return this._textCanvas.nativeElement
    }

    get selectionCanvas(): HTMLCanvasElement {
        return this._selectionCanvas.nativeElement
    }

    ngOnChanges(changes: SimpleChanges): void {
        const {context} = changes
        if (context && !context.isFirstChange())
            this._init(context.currentValue)
    }

    // tslint:disable-next-line: max-func-body-length
    ngAfterViewInit(): void {
        this._init(this.context)
        this._subs.add(on(this.el, EventType.MOUSE_DOWN).subscribe(mde => {
            /**
             * 当前组件应该在最底层，对于鼠标事件应仅限在该层中，不允许向上抛
             */
            mde.stopPropagation()
            mde.preventDefault()
            this._cursorManager?.mousedown(mde)
            this._selectionManager?.mousedown(mde)
            const sub = new Subscription()
            sub.add(on(window, EventType.MOUSE_MOVE).subscribe(mme => {
                mme.preventDefault()
                this._selectionManager?.mousemove(mme)
            }))
            sub.add(on(window, EventType.MOUSE_UP).subscribe(mue => {
                mue.preventDefault()
                sub.unsubscribe()
            }))
        }))
    }

    ngOnDestroy(): void {
        if (this._textareaInputManager?.hasFocus()) {
            this._onBlur()
            this._textareaInputManager.unsubscribe()
        }
        this._subs.unsubscribe()
    }

    private _selectionManager?: SelectionManager
    private _textManager?: TextManager
    private _cursorManager?: CursorManager
    private _textareaInputManager?: TextareaInputManager
    private _subs = new Subscription()
    @ViewChild('textCanvas')
    private readonly _textCanvas!: ElementRef<HTMLCanvasElement>
    @ViewChild('selectionCanvas')
    private readonly _selectionCanvas!: ElementRef<HTMLCanvasElement>
    @ViewChild('textarea')
    private readonly _textarea!: ElementRef<HTMLTextAreaElement>

    private _init(context: Context): void {
        this._cd.markForCheck()
        this.context = context
        this._initHost()
        const text = this._initTextManager()
        const cursor = this._initCursorManager(text)
        const selection = this._initSelectionManager(cursor, text)
        this._initTextAreaInputManager(text, selection, cursor)
    }

    private _initHost(): void {
        const context = this.context
        this._renderer2.setStyle(this.el, 'left', `${context.canvasOffsetX}px`)
        this._renderer2.setStyle(this.el, 'top', `${context.canvasOffsetY}px`)
        this._renderer2.setStyle(this.el, 'width', `${context.cellWidth}px`)
        this._renderer2.setStyle(this.el, 'height', `${context.cellHeight}px`)
    }

    private _initSelectionManager(
        cursorManager: CursorManager,
        textManager: TextManager
    ): SelectionManager {
        this._selectionManager = new SelectionManager(
            cursorManager,
            this.selectionCanvas,
            this.context,
            textManager,
        )
        return this._selectionManager
    }

    private _initTextManager(): TextManager {
        this._textManager = new TextManager(this.textCanvas, this.context)
        return this._textManager
    }

    private _initCursorManager(textManager: TextManager): CursorManager {
        this._cursorManager = new CursorManager(textManager, this.context)
        this._subs.add(this._cursorManager.cursorX$.subscribe(e => {
            this._cd.markForCheck()
            this.cursorX = e
        }))
        this._subs.add(this._cursorManager.cursorY$.subscribe(e => {
            this._cd.markForCheck()
            this.cursorY = e
        }))
        this._subs.add(this._cursorManager.show$.subscribe(e => {
            this._cd.markForCheck()
            this.showCursor = e
        }))
        this._subs.add(this._cursorManager.cursorEvent$.subscribe(e => {
            this.cursorEvent = e
            this._cd.markForCheck()
        }))
        return this._cursorManager
    }

    private _initTextAreaInputManager(
        textManager: TextManager,
        selectionManager: SelectionManager,
        cursorManager: CursorManager,
    ): void {
        this._textareaInputManager?.unsubscribe()
        const textarea = this._textarea.nativeElement
        this._textareaInputManager = new TextareaInputManager(
            textManager,
            selectionManager,
            textarea,
            this.context,
            cursorManager,
        )
        const manager = this._textareaInputManager
        this._subs.add(manager.blur$.subscribe(() => {
            this._onBlur()
        }))
        this._subs.add(manager.type$.subscribe(() => {
            this._cd.markForCheck()
            const x = cursorManager.cursorX
            const y = cursorManager.cursorY
            const textarea = this._textarea.nativeElement
            this._renderer2.setStyle(textarea, 'left', `${x}px`)
            this._renderer2.setStyle(textarea, 'top', `${y}px`)
            this.type$.next(textManager.getPlainText())
        }))
        timer().subscribe(() => {
            textarea.focus()
        })
    }

    private _onBlur(): void {
        const event = new BlurEventBuilder()
            .text(this._textManager?.getPlainText() ?? '')
        if (this.context.bindingData !== undefined)
            event.bindingData(this.context.bindingData)
        this.blur$.next(event.build())
    }
}
