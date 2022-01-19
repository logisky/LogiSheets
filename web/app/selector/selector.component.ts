import {
    HostListener,
    Output,
    EventEmitter,
    Input,
    OnChanges,
    HostBinding,
    ViewChild,
    Component,
    Renderer2,
    ChangeDetectorRef,
    ElementRef,
    AfterViewInit,
    ChangeDetectionStrategy,
    OnDestroy,
    SimpleChanges,
} from '@angular/core'
import {Subscription} from 'rxjs'

@Component({
    selector: 'logi-selector',
    templateUrl: './selector.component.html',
    styleUrls: ['./selector.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectorComponent implements AfterViewInit, OnDestroy, OnChanges {
    constructor(
        private readonly _cd: ChangeDetectorRef,
        private readonly _renderer2: Renderer2,
        private readonly _el: ElementRef<HTMLElement>,
    ) {}
    @Input() @HostBinding('style.display') editing = false
    @Input() x = 0
    @Input() y = 0
    @Input() width = 0
    @Input() height = 0
    @Input() borderRightWidth = 0
    @Input() borderLeftWidth = 0
    @Input() borderTopWidth = 0
    @Input() borderBottomWidth = 0
    @Output() readonly keydown$ = new EventEmitter<KeyboardEvent>()
    ngOnChanges(changes: SimpleChanges): void {
        // tslint:disable: no-type-assertion
        const {
            x,
            y,
            width,
            height,
            borderRightWidth,
            borderLeftWidth,
            borderTopWidth,
            borderBottomWidth,
        } = changes
        if ((x && !x.isFirstChange())
            || (y && !y.isFirstChange())
            || (width && !width.isFirstChange())
            || (height && !height.isFirstChange()))
            this._renderHost()
        if (borderTopWidth && !borderTopWidth.isFirstChange())
            this._renderBorderTop()
        if (borderRightWidth && !borderRightWidth.isFirstChange())
            this._renderBorderRight()
        if (borderBottomWidth && !borderBottomWidth.isFirstChange())
            this._renderBorderBottom()
        if (borderLeftWidth && !borderLeftWidth.isFirstChange())
            this._renderBorderLeft()
    }

    ngAfterViewInit(): void {
        this._renderHost()
        this._renderBorderBottom()
        this._renderBorderLeft()
        this._renderBorderRight()
        this._renderBorderTop()
    }

    ngOnDestroy(): void {
        this._subs.unsubscribe()
    }

    @HostListener('keydown', ['$event'])
    keydown(e: KeyboardEvent): void {
        this.keydown$.next(e)
    }
    private _subs = new Subscription()
    @ViewChild('border') private readonly _border!: ElementRef<HTMLDivElement>

    private _renderHost(): void {
        const host = this._el.nativeElement
        this._renderer2.setStyle(host, 'left', `${this.x}px`)
        this._renderer2.setStyle(host, 'top', `${this.y}px`)
        if (this.width >= 0)
            this._renderer2.setStyle(host, 'width', `${this.width}px`)
        if (this.height >= 0)
            this._renderer2.setStyle(host, 'height', `${this.height}px`)
        this._cd.markForCheck()
    }

    private _renderBorderRight(): void {
        if (this._border === undefined)
            return
        const border = this._border.nativeElement
        this._renderer2.setStyle(
            border,
            'borderRightWidth',
            `${this.borderRightWidth}px`
        )
        this._cd.markForCheck()
    }

    private _renderBorderLeft(): void {
        if (this._border === undefined)
            return
        const border = this._border.nativeElement
        this._renderer2.setStyle(
            border,
            'borderLeftWidth',
            `${this.borderLeftWidth}px`
        )
        this._cd.markForCheck()
    }

    private _renderBorderTop(): void {
        if (this._border === undefined)
            return
        const border = this._border.nativeElement
        this._renderer2
            .setStyle(border, 'borderTopWidth', `${this.borderTopWidth}px`)
        this._cd.markForCheck()
    }

    private _renderBorderBottom(): void {
        if (this._border === undefined)
            return
        const border = this._border.nativeElement
        this._renderer2.setStyle(
            border,
            'borderBottomWidth',
            `${this.borderBottomWidth}px`
        )
        this._cd.markForCheck()
    }
}
