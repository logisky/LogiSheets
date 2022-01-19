import {
    Input,
    SimpleChanges,
    OnChanges,
    OnInit,
    Component,
    Renderer2,
    ElementRef,
    OnDestroy,
    ChangeDetectionStrategy,
} from '@angular/core'
import {Subscription, interval} from 'rxjs'

@Component({
    selector: 'logi-cursor',
    templateUrl: './cursor.component.html',
    styleUrls: ['./cursor.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CursorComponent implements OnInit, OnDestroy, OnChanges {
    constructor(
      private readonly _el: ElementRef<HTMLElement>,
      private readonly _renderer2: Renderer2,
    ) {}
    @Input() height = 0
    @Input() x = 0
    @Input() y = 0
    get el(): HTMLElement {
        return this._el.nativeElement
    }

    ngOnChanges(changes: SimpleChanges): void {
        const {height, x, y} = changes
        if (height)
            this._renderer2
                .setStyle(this.el, 'height', `${height.currentValue}px`)
        if (x)
            this._renderer2.setStyle(this.el, 'left', `${x.currentValue}px`)
        if (y)
            this._renderer2.setStyle(this.el, 'top', `${y.currentValue}px`)
    }

    ngOnInit(): void {
        this._intervalSub = interval(700).subscribe(() => {
            this._isVisible ? this._hide() : this._show()
        })
    }

    ngOnDestroy(): void {
        this._subs.unsubscribe()
        this._intervalSub?.unsubscribe()
    }
    private _isVisible = false
    private _subs = new Subscription()
    private _intervalSub?: Subscription

    private _show(): void {
        if (!this._isVisible) {
            this._renderer2.setStyle(this.el, 'opacity', '1')
            this._isVisible = true
        }
    }

    private _hide(): void {
        if (this._isVisible) {
            this._renderer2.setStyle(this.el, 'opacity', '0')
            this._isVisible = false
        }
    }
}
