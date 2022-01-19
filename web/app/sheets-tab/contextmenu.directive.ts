import {
    ContextMenuItemBuilder,
    ContextMenuService,
} from '@logi-sheets/web/app/context-menu'
import {MatDialog} from '@angular/material/dialog'
import {Directive, HostListener, Input} from '@angular/core'
import {SheetsTabComponent} from './sheets-tab.component'
import {RenameComponent} from './rename.component'
import {
    PayloadBuilder,
    SheetRenameBuilder,
    SheetShiftBuilder,
    ShiftTypeEnum,
    TransactionBuilder,
    _Payload_Payload_oneof,
} from '@logi-pb/network/src/proto/message_pb'

@Directive({selector: '[logi-sheet-tab-contextmenu]'})
export class SheetTabContextMenuDirective {
    constructor(
        private readonly _contextmenuSvc: ContextMenuService,
        private readonly _dialog: MatDialog,
        private readonly _sheetTabs: SheetsTabComponent,
    ) {}
    @Input() index = -1
    @HostListener('contextmenu', ['$event'])
    contextmenu(e: MouseEvent) {
        const data = [
            new ContextMenuItemBuilder()
                .text('重命名')
                .type('text')
                .click(this._rename.bind(this))
                .build(),
            new ContextMenuItemBuilder()
                .text('删除')
                .type('text')
                .click(this._delete.bind(this))
                .build(),
        ]
        this._contextmenuSvc.openPanel(data, e)
    }

    private _rename() {
        const sheetname = this._sheetTabs.tabs$.value[this.index]
        this._dialog
            .open(RenameComponent, {data: sheetname})
            .afterClosed()
            .subscribe((e?: string) => {
                if (!e)
                    return
                const rename = new SheetRenameBuilder()
                    .oldName(sheetname)
                    .newName(e)
                    .build()
                const payload = new PayloadBuilder()
                    .payloadOneof(rename, _Payload_Payload_oneof.SHEET_RENAME)
                    .build()
                const transaction = new TransactionBuilder()
                    .payloads([payload])
                    .build()
                this._sheetTabs.dataSvc.backend.send(transaction)
            })
    }

    private _delete() {
        const shift = new SheetShiftBuilder()
            .sheetIdx(this.index)
            .type(ShiftTypeEnum.DELETE)
            .build()
        const payload = new PayloadBuilder()
            .payloadOneof(shift, _Payload_Payload_oneof.SHEET_SHIFT)
            .build()
        const transaction = new TransactionBuilder().payloads([payload]).build()
        this._sheetTabs.dataSvc.backend.send(transaction)
    }
}
