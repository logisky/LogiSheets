import {MAT_DIALOG_DATA} from '@angular/material/dialog'
import {Component, ChangeDetectionStrategy, Inject} from '@angular/core'
import {StandardBlock} from '@logi-sheets/web/core/standable'
import {SelectionModel} from '@angular/cdk/collections'

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'logi-select-block',
    template: `
    <h2 mat-dialog-title>{{data.message}}</h2>
    <mat-dialog-content *ngIf="data.blocks.length > 1" style="display: flex;flex-direction:column;">
        <mat-checkbox *ngFor="let block of data.blocks;let i=index" (change)="checkedChange(block)">block{{i}}</mat-checkbox>
    </mat-dialog-content>
    <mat-dialog-actions align='end'>
        <button [mat-dialog-close]='[]' mat-button>取消</button>
        <button [mat-dialog-close]='selectModel.selected' mat-button cdkFocusInitial>确认</button>
    </mat-dialog-actions>
    `,
})
export class SelectBlockComponent {
    constructor(
        @Inject(MAT_DIALOG_DATA) public readonly data: Data,
    ) {
        if (this.data.blocks.length === 1)
            this.selectModel.select(this.data.blocks[0])
    }
    selectModel = new SelectionModel<StandardBlock>()
    checkedChange(block: StandardBlock) {
        this.selectModel.toggle(block)
    }
}
export interface Data {
    readonly message: string
    readonly blocks: readonly StandardBlock[]
}
