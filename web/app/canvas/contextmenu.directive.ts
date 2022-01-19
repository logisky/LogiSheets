import {Directive, OnInit, OnDestroy} from '@angular/core'
import {
    ContextMenuItem,
    ContextMenuItemBuilder,
    ContextMenuService,
} from '@logi-sheets/web/app/context-menu'
import {
    RowShiftBuilder,
    ShiftTypeEnum,
    _Payload_Payload_oneof,
    TransactionBuilder,
    PayloadBuilder,
    Payload,
    CreateBlockBuilder,
} from '@logi-pb/network/src/proto/message_pb'
import {Subscription} from 'rxjs'
import {CanvasComponent} from './canvas.component'

@Directive({selector: '[logi-canvas-contextmenu]'})
export class ContextmenuDirective extends Subscription
    implements OnInit, OnDestroy {
    constructor(
        private readonly _canvas: CanvasComponent,
        private readonly _contextmenuSvc: ContextMenuService,
    ) {
        super()
    }
    ngOnInit() {
        this._init()
    }

    ngOnDestroy() {
        this.unsubscribe()
    }

    private _contextmenu(e: MouseEvent) {
        const rows = [
            new ContextMenuItemBuilder()
                .text('增加行')
                .type('text')
                .click(this._addRow)
                .build(),
            new ContextMenuItemBuilder()
                .text('删除行')
                .type('text')
                .click(this._removeRow)
                .build(),
        ]
        const cols = [
            new ContextMenuItemBuilder()
                .text('增加列')
                .type('text')
                .click(this._addCol)
                .build(),
            new ContextMenuItemBuilder()
                .text('删除列')
                .type('text')
                .click(this._removeCol)
                .build(),
        ]
        const matchCell = this._canvas.startCellMng.startCell
        const items: ContextMenuItem[] = []
        if (matchCell.type === 'FixedLeftHeader')
            items.push(...rows)
        else if (matchCell.type === 'FixedTopHeader')
            items.push(...cols)
        else if (matchCell.type === 'Cell') {
            items.push(...rows, ...cols)
            items.push(new ContextMenuItemBuilder()
                .text('新增block')
                .type('text')
                .click(this._addBlock)
                .build())
        }
        else
            return
        this._contextmenuSvc.openPanel(items, e)
    }

    private _init() {
        this.add(this._canvas.startCellMng.startCell$().subscribe(e => {
            if (e === undefined || e.from !== 'contextmenu')
                return
            // tslint:disable-next-line: no-type-assertion
            this._contextmenu(e.event as MouseEvent)
        }))
    }

    private _addCol = () => {
        const matchCell = this._canvas.startCellMng.startCell
        const sheet = this._canvas.dataSvc.sheetSvc.getActiveSheet()
        const colShift = new RowShiftBuilder()
            .sheetIdx(sheet)
            .count(1)
            .start(matchCell.coodinate.startCol)
            .type(ShiftTypeEnum.INSERT)
            .build()
        const payload = new PayloadBuilder()
            .payloadOneof(colShift, _Payload_Payload_oneof.COLUMN_SHIFT)
            .build()
        const transaction = new TransactionBuilder().payloads([payload]).build()
        this._canvas.dataSvc.backend.send(transaction)
    }

    private _removeCol = () => {
        const matchCell = this._canvas.startCellMng.startCell
        const rowShift = new RowShiftBuilder()
            .sheetIdx(this._canvas.dataSvc.sheetSvc.getActiveSheet())
            .count(1)
            .start(matchCell.coodinate.startCol)
            .type(ShiftTypeEnum.DELETE)
            .build()
        const payload = new PayloadBuilder()
            .payloadOneof(rowShift, _Payload_Payload_oneof.COLUMN_SHIFT)
            .build()
        this._send(payload)
    }

    private _addRow = () => {
        const matchCell = this._canvas.startCellMng.startCell
        const rowShift = new RowShiftBuilder()
            .sheetIdx(this._canvas.dataSvc.sheetSvc.getActiveSheet())
            .count(1)
            .start(matchCell.coodinate.startRow)
            .type(ShiftTypeEnum.INSERT)
            .build()
        const payload = new PayloadBuilder()
            .payloadOneof(rowShift, _Payload_Payload_oneof.ROW_SHIFT)
            .build()
        this._send(payload)
    }

    private _removeRow = () => {
        const matchCell = this._canvas.startCellMng.startCell
        const rowShift = new RowShiftBuilder()
            .sheetIdx(this._canvas.dataSvc.sheetSvc.getActiveSheet())
            .count(1)
            .start(matchCell.coodinate.startRow)
            .type(ShiftTypeEnum.DELETE)
            .build()
        const payload = new PayloadBuilder()
            .payloadOneof(rowShift, _Payload_Payload_oneof.ROW_SHIFT)
            .build()
        this._send(payload)
    }

    private _addBlock = () => {
        const startCell = this._canvas.selectorMng.startCell
        const endCell = this._canvas.selectorMng.endCell ?? startCell
        const start = startCell.coodinate
        const end = endCell.coodinate
        const addBlock = new CreateBlockBuilder()
            .sheetIdx(this._canvas.dataSvc.sheetSvc.getActiveSheet())
            .colCnt(Math.abs(end.endCol - start.startCol) + 1)
            .rowCnt(Math.abs(end.endRow - start.startRow) + 1)
            .masterCol(start.startCol < end.startCol ? start.startCol : end.startCol)
            .masterRow(
                start.startRow < end.startRow ? start.startRow : end.startRow
            )
            .build()
        this._send(new PayloadBuilder()
            .payloadOneof(addBlock, _Payload_Payload_oneof.CREATE_BLOCK)
            .build())
    }

    private _send(payload: Payload) {
        const transaction = new TransactionBuilder().payloads([payload]).build()
        this._canvas.dataSvc.backend.send(transaction)
    }
}
