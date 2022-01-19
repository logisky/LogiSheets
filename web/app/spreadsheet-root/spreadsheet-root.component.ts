import {
    ElementRef,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnInit,
    OnDestroy,
} from '@angular/core'
import {DataService, Settings} from '@logi-sheets/web/core/data'
import {on, EventType} from '@logi-sheets/web/core/events'
import {WebSocketService} from '@logi-sheets/web/ws'
import {Observable, Subscription} from 'rxjs'
import {DEBUG} from '@logi-sheets/web/global'
import {SelectedCell} from '@logi-sheets/web/app/canvas'

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'logi-spreadsheet-root',
    styleUrls: ['./spreadsheet-root.component.scss'],
    templateUrl: './spreadsheet-root.component.html',
})
export class SpreadsheetRootComponent implements OnInit, OnDestroy {
    constructor(
        private readonly _el: ElementRef,
        private readonly _cd: ChangeDetectorRef,
        private readonly _dataSvc: DataService,
        private readonly _wsSvc: WebSocketService,
    ) {
        this.settings = this._dataSvc.settings
        this.open$ = this._wsSvc.open$()
    }
    debug = Boolean(DEBUG)
    opening = true
    openSuccess = false
    open$: Observable<boolean>
    selectedCell?: SelectedCell
    settings: Settings
    ngOnInit(): void {
        this._subs.add(this._wsSvc.open$().subscribe(openSuccess => {
            this.opening = false
            this.openSuccess = openSuccess
            this._cd.markForCheck()
        }))
        this._subs.add(
            on(this._el.nativeElement, EventType.CONTEXT_MENU).subscribe(e => {
                e.stopPropagation()
                e.preventDefault()
            })
        )
    }

    ngOnDestroy(): void {
        this._subs.unsubscribe()
    }
    private _subs = new Subscription()
}
