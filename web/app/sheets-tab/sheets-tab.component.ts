import {
    Component,
    OnInit,
    OnDestroy,
    ChangeDetectionStrategy,
} from '@angular/core'
import {
    PayloadBuilder,
    SheetShiftBuilder,
    ShiftTypeEnum,
    TransactionBuilder,
    _Payload_Payload_oneof,
} from '@logi-pb/network/src/proto/message_pb'
import {DataService} from '@logi-sheets/web/core/data'
import {Subscription, BehaviorSubject} from 'rxjs'

@Component({
    selector: 'logi-sheets-tab',
    templateUrl: './sheets-tab.component.html',
    styleUrls: ['./sheets-tab.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetsTabComponent implements OnInit, OnDestroy {
    public constructor(
        public readonly dataSvc: DataService,
    ) {}
    tabs$ = new BehaviorSubject<readonly string[]>([])
    active = 0

    ngOnInit() {
        this._updateSheets()
        this._subs.add(this.dataSvc.backend.render$.subscribe(() => {
            this._updateSheets()
        }))
    }

    ngOnDestroy() {
        this._subs.unsubscribe()
    }

    onTabChange(i: number) {
        this.active = i
        this.dataSvc.sheetSvc.setActiveSheet(i)
    }

    add() {
        const shift = new SheetShiftBuilder()
            .sheetIdx(this.active)
            .type(ShiftTypeEnum.INSERT)
            .build()
        const payload = new PayloadBuilder()
            .payloadOneof(shift, _Payload_Payload_oneof.SHEET_SHIFT)
            .build()
        const transaction = new TransactionBuilder().payloads([payload]).build()
        this.dataSvc.backend.send(transaction)
    }

    private _subs = new Subscription()
    private _updateSheets() {
        const sheets = this.dataSvc.sheetSvc.getSheets().map(s => s.name)
        this.tabs$.next(sheets)
    }
}
