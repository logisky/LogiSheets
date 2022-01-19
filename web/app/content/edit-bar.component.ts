import {
    OnDestroy,
    Component,
    OnInit,
    Output,
    EventEmitter,
    Input,
    ChangeDetectionStrategy,
} from '@angular/core'
import {FormControl} from '@angular/forms'
import {Subscription} from 'rxjs'
export const enum FormulaType {
    UNSPECIFIED = 'unspecified',
    FORMULA = 'formula',
    TEXT = 'text',
}

@Component({
    selector: 'logi-edit-bar',
    templateUrl: './edit-bar.component.html',
    styleUrls: ['./edit-bar.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditBarComponent implements OnInit, OnDestroy {
    @Input() set formula(formula: string) {
        this.formCtl.setValue(formula)
    }
    @Input() formulaType = FormulaType.UNSPECIFIED
    @Output() readonly textChanged$ = new EventEmitter<string>()
    formCtl = new FormControl('')
    ngOnInit(): void {
        this._subs.add(this.formCtl.valueChanges.subscribe(res => {
            this.textChanged$.next(res)
        }))
    }

    ngOnDestroy(): void {
        this._subs.unsubscribe()
    }
    private _subs = new Subscription()
}
