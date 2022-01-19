// tslint:disable: limit-indent-for-method-in-class
import {
    OnDestroy,
    AfterViewInit,
    ElementRef,
    ViewChild,
    Input,
    Renderer2,
    Component,
    Output,
    EventEmitter,
    ChangeDetectionStrategy,
    HostBinding,
    OnChanges,
    SimpleChanges,
} from '@angular/core'
import {on, EventType} from '@logi-sheets/web/core/events'
import {ScrollbarType} from './scrollbar'
import {Subscription, merge} from 'rxjs'
import {ScrollEvent} from './scroll_event'
import {ScrollEventBuilder} from '.'

@Component({
    selector: 'logi-scrollbar',
    templateUrl: './scrollbar.component.html',
    styleUrls: ['./scrollbar.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScrollbarComponent implements AfterViewInit, OnDestroy, OnChanges {
    constructor(
        private readonly _renderer2: Renderer2,
    ) {}
    @Input() containerLength = 0
    @Input() scrollDistance = 0
    @Input() containerTotalLength = 0
    /**
     * y-scrollbar padding-top, pixel
     */
    @Input() public paddingTop = 0
    /**
     * x-scrollbar padding-left, pixel
     */
    @Input() public paddingLeft = 0
    @Input() public minThumbLength = 20
    @Input() public maxThumbRadio = 80
    @Input() public direction: ScrollbarType = 'x'
    @Output() public readonly mouseWheelMove$ = new EventEmitter<ScrollEvent>()
    @Output() public readonly mousemove$ = new EventEmitter<ScrollEvent>()

    @HostBinding('class.moving') public moving = false
    @HostBinding('class.x-scrollbar') public get xScrollbar(): boolean {
        return this.direction === 'x'
    }

    @HostBinding('class.y-scrollbar') public get yScrollbar(): boolean {
        return this.direction === 'y'
    }

    ngOnChanges(changes: SimpleChanges): void {
        const {
            containerLength,
            scrollDistance,
            containerTotalLength,
        } = changes
        if (containerLength && !containerLength.isFirstChange())
            this.containerLength = containerLength.currentValue
        else if (scrollDistance && !scrollDistance.isFirstChange())
            this.scrollDistance = scrollDistance.currentValue
        else if (containerTotalLength && !containerTotalLength.isFirstChange())
            this.containerTotalLength = containerTotalLength.currentValue
        else
            return
        if (this.moving)
            return
        this._render()
    }

    // tslint:disable-next-line: max-func-body-length
    ngAfterViewInit(): void {
        const thumbHost = this._thumbContainer.nativeElement
        const thumb = this._thumb.nativeElement
        // tslint:disable-next-line: max-func-body-length
        this._subs.add(on(thumb, EventType.MOUSE_DOWN).subscribe(mde => {
            mde.stopPropagation()
            const totalLength = this._containerLength
            const thumbLength = this._thumbLength
            let startPosition = this.xScrollbar ? mde.clientX : mde.clientY
            this.moving = true
            const sub = new Subscription()
            const mousemove = merge(
                on(thumb, EventType.MOUSE_MOVE),
                on(window, EventType.MOUSE_MOVE),
            )
            sub.add(mousemove.subscribe(mme => {
                mme.preventDefault()
                mme.stopPropagation()
                const endPosition = this.xScrollbar ? mme.clientX : mme.clientY
                let moved = endPosition - startPosition
                const oldScrollRadio = this.scrollDistance / this.containerTotalLength
                const oldStart = totalLength * oldScrollRadio
                if (moved + totalLength * oldScrollRadio + thumbLength >= totalLength)
                    if (moved > 0)
                        moved = totalLength - thumbLength - oldStart
                    else
                        return
                if ((moved + totalLength * oldScrollRadio) <= 0)
                    if (moved < 0)
                        moved = -oldStart
                    else
                        return
                if (moved === 0)
                    return
                if (this.scrollDistance + this.containerTotalLength * (moved / totalLength) < 0) {
                    this.scrollDistance = 0
                    startPosition = this.xScrollbar ? mde.clientX : mde.clientY
                }
                else {
                    this.scrollDistance += this.containerTotalLength * (moved / totalLength)
                    startPosition += moved
                }
                this._render()
                this.mousemove$.next(new ScrollEventBuilder()
                    .delta(this.containerTotalLength * (moved / totalLength))
                    .scrollDistance(this.scrollDistance)
                    .trust(true)
                    .type(this.direction)
                    .build())
            }))
            sub.add(on(window, EventType.MOUSE_UP).subscribe(() => {
                this.moving = false
                sub.unsubscribe()
            }))
        }))
        this._subs.add(on(thumbHost, EventType.MOUSE_WHEEL).subscribe(e => {
            e.preventDefault()
            const totalLength = this._containerLength
            const thumbLength = this._thumbLength
            let moved = this.xScrollbar ? e.deltaX : e.deltaY
            const oldScrollRadio = this.scrollDistance / this.containerTotalLength
            const startPosition = totalLength * oldScrollRadio
            if (moved + totalLength * oldScrollRadio + thumbLength >= totalLength)
                if (moved > 0)
                    moved = totalLength - thumbLength - startPosition
                else
                    return
            if ((moved + totalLength * oldScrollRadio) <= 0)
                if (moved < 0)
                    moved = -startPosition
                else
                    return
            if (moved === 0)
                return
            const newScrollRadio = Math.abs(moved / totalLength)
            const scrollDistance = this.containerTotalLength * newScrollRadio
            const scrollEvent = new ScrollEventBuilder()
                .delta(this.scrollDistance - scrollDistance)
                .scrollDistance(scrollDistance)
                .trust(true)
                .type(this.direction)
                .build()
            this.mouseWheelMove$.next(scrollEvent)
        }))
        this._render()
    }

    ngOnDestroy(): void {
        this._subs.unsubscribe()
    }
    private _subs = new Subscription()
    @ViewChild('thumb') private readonly _thumb!: ElementRef<HTMLSpanElement>
    @ViewChild('container')
    private readonly _container!: ElementRef<HTMLSpanElement>
    @ViewChild('thumb_container')
    private readonly _thumbContainer!: ElementRef<HTMLSpanElement>
    private get _containerLength(): number {
        return this.xScrollbar ?
            this._thumbContainer.nativeElement.offsetWidth :
            this._thumbContainer.nativeElement.offsetHeight
    }

    private get _thumbLength(): number {
        return this.xScrollbar ?
            this._thumb.nativeElement.offsetWidth :
            this._thumb.nativeElement.offsetHeight
    }

    // tslint:disable-next-line: max-func-body-length
    private _render(): void {
        /**
         * TODO(minglong): need show scrollbar when hover?
         */
        const thumb = this._thumb.nativeElement
        const host = this._container.nativeElement
        const thumbContainer = this._thumbContainer.nativeElement
        const pt = toPx(this.paddingTop)
        const pl = toPx(this.paddingLeft)
        this._renderer2.setStyle(host, 'paddingTop', pt)
        this._renderer2.setStyle(host, 'height', `calc(100% - ${pt})`)
        this._renderer2.setStyle(host, 'paddingLeft', pl)
        this._renderer2.setStyle(host, 'width', `calc(100% - ${pl})`)
        /**
         * The difference between clientHeight, offsetHeight, scrollHeight, offsetTop, and scrollTop
         * https://www.programmersought.com/article/76801676023/
         */
        const scrollRadio = this.scrollDistance / this.containerTotalLength
        const thumbRadio = this.containerLength / this.containerTotalLength
        if (this.xScrollbar) {
            const containerLength = thumbContainer.offsetWidth
            const thumbWidth = containerLength * thumbRadio
            const thumbLength = Math.max(thumbWidth, this.minThumbLength)
            this._renderer2.setStyle(thumb, 'width', toPx(thumbLength))
            const left = scrollRadio * containerLength
            if (left + thumbLength > containerLength) {
                this._renderer2.setStyle(thumb, 'right', 0)
                this._renderer2.removeStyle(thumb, 'left')
                return
            }
            this._renderer2.removeStyle(thumb, 'right')
            this._renderer2.setStyle(thumb, 'left', toPx(left))
        }
        else if (this.yScrollbar) {
            const containerLength = thumbContainer.offsetHeight
            const thumbHeight = thumbContainer.offsetHeight * thumbRadio
            const thumbLength = Math.max(thumbHeight, this.minThumbLength)
            this._renderer2.setStyle(thumb, 'height', toPx(thumbLength))
            const top = scrollRadio * containerLength
            if (top + thumbLength > containerLength) {
                this._renderer2.removeStyle(thumb, 'top')
                this._renderer2.setStyle(thumb, 'bottom', 0)
                return
            }
            this._renderer2.removeStyle(thumb, 'bottom')
            this._renderer2.setStyle(thumb, 'top', toPx(top))
        }
    }
}
function toPx(num: number): string {
    return `${num}px`
}
