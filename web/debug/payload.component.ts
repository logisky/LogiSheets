import {Component, ChangeDetectionStrategy, Inject} from '@angular/core'
import {MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog'
import {FormControl} from '@angular/forms'

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'logi-payload',
    template: `
        <textarea [formControl]='formControl' mat-input></textarea>
        <button (click)='close()' logi-button>close</button>
    `,
})
export class PayloadComponent {
    constructor(
        private readonly _dialog: MatDialogRef<PayloadComponent>,
        @Inject(MAT_DIALOG_DATA) private readonly _obj: string,
    ) {
        this.formControl = new FormControl(this._obj)
    }
    formControl: FormControl
    close() {
        this._dialog.close(this.formControl.value)
    }
}
