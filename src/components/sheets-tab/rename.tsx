// @Component({
//     changeDetection: ChangeDetectionStrategy.OnPush,
//     selector: 'logi-sheet-rename',
//     template: `
//     <h2 mat-dialog-title>重命名</h2>
//     <mat-dialog-content>
//         <input type="text" matInput [(ngModel)]="sheetname">
//     </mat-dialog-content>
//     <mat-dialog-actions>
//         <button mat-button mat-dialog-close="">取消</button>
//         <button mat-button [mat-dialog-close]="sheetname">确认</button>
//     </mat-dialog-actions>
//     `,
// })
export const RenameComponent = () => {
    // constructor(
    //     @Inject(MAT_DIALOG_DATA) private readonly _sheetname: string,
    // ) {
    //     this.sheetname = this._sheetname
    // }
    // sheetname = ''
    return <div>rename component</div>
}
