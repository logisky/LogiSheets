// tslint:disable: max-func-body-length
import {
    OnDestroy,
    OnInit,
    ChangeDetectionStrategy,
    AfterViewInit,
    Component,
    ChangeDetectorRef,
    Output,
    EventEmitter,
} from '@angular/core'
import {Subscription} from 'rxjs'
import {DataService} from '@logi-sheets/web/core/data'
import {
    MouseDownEvent,
    MouseDownType,
    SelectedCell,
} from '@logi-sheets/web/app/canvas'
import {FormulaType} from './edit-bar.component'

@Component({
    selector: 'logi-content',
    templateUrl: './content.component.html',
    styleUrls: ['./content.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentComponent implements AfterViewInit, OnInit, OnDestroy {
    constructor(
        private readonly _dataSvc: DataService,
        private readonly _cd: ChangeDetectorRef,
    ) {}
    @Output() readonly selectedCell$ = new EventEmitter<SelectedCell>()
    settings = this._dataSvc.settings
    cellText = ''
    formulaType = FormulaType.UNSPECIFIED

    ngOnInit(): void {
    }

    ngAfterViewInit(): void {
        this._cd.detectChanges()
    }

    ngOnDestroy(): void {
        this._subs.unsubscribe()
    }

    selectedCell(selectedCell: SelectedCell): void {
        this.selectedCell$.next(selectedCell)
    }

    mousedown(e: MouseDownEvent): void {
        this.cellText = e.cellText
        const map = new Map([
            [MouseDownType.FORMULA, FormulaType.FORMULA],
            [MouseDownType.TEXT, FormulaType.TEXT],
            [MouseDownType.UNKNOWN, FormulaType.UNSPECIFIED],
        ])
        this.formulaType = map.get(e.type) ?? FormulaType.UNSPECIFIED
    }
    private _subs = new Subscription()
}
