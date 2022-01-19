/* eslint-disable no-console */
// tslint:disable: no-throw-unless-asserts
import {Component, OnInit, ChangeDetectionStrategy} from '@angular/core'
import {WebSocketService} from '@logi-sheets/web/ws'
import {FormControl} from '@angular/forms'
import {
    PayloadBuilder,
    Payload,
    ClientSendBuilder,
    isTransaction,
    TransactionBuilder,
    _ClientSend_Client_send_oneof,
    ColumnShiftBuilder,
    _Payload_Payload_oneof,
    RowShiftBuilder,
    CellInputBuilder,
    SheetRenameBuilder,
    SheetShiftBuilder,
    StyleUpdateBuilder,
    CreateBlockBuilder,
    MoveBlockBuilder,
    BlockInputBuilder,
    BlockStyleUpdateBuilder,
    LineShiftInBlockBuilder,
    isDisplayRequest,
} from '@logi-pb/network/src/proto/message_pb'
import {MatDialog} from '@angular/material/dialog'
import {isException} from '@logi-base/src/ts/common/exception'
import {PayloadComponent} from './payload.component'
function payload() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Map<_Payload_Payload_oneof, any>([
        [_Payload_Payload_oneof.CELL_INPUT, new CellInputBuilder()],
        [_Payload_Payload_oneof.ROW_SHIFT, new RowShiftBuilder()],
        [_Payload_Payload_oneof.COLUMN_SHIFT, new ColumnShiftBuilder()],
        [_Payload_Payload_oneof.SHEET_RENAME, new SheetRenameBuilder()],
        [_Payload_Payload_oneof.SHEET_SHIFT, new SheetShiftBuilder()],
        [_Payload_Payload_oneof.STYLE_UPDATE, new StyleUpdateBuilder()],
        [_Payload_Payload_oneof.CREATE_BLOCK, new CreateBlockBuilder()],
        [_Payload_Payload_oneof.MOVE_BLOCK, new MoveBlockBuilder()],
        [_Payload_Payload_oneof.BLOCK_INPUT, new BlockInputBuilder()],
        [_Payload_Payload_oneof.BLOCK_STYLE_UPDATE, new BlockStyleUpdateBuilder()],
        [_Payload_Payload_oneof.LINE_SHIFT_IN_BLOCK, new LineShiftInBlockBuilder()],
    ])
}

@Component({
    selector: 'logi-debug',
    templateUrl: './debug.component.html',
    styleUrls: ['./debug.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DebugComponent implements OnInit {
    constructor(
        private readonly _webSocketSvc: WebSocketService,
        private readonly _dialog: MatDialog,
    ) { }
    userIdCtl = new FormControl('minglong')
    fileIdCtl = new FormControl('4')
    operate = _Payload_Payload_oneof.BLOCK_INPUT
    operateCtl = new FormControl()
    operatePosCtl = new FormControl(0)
    operateCountCtl = new FormControl(0)
    scriptCtl = new FormControl('')
    allOperateOptions = Array.from(payload().keys())
    ngOnInit(): void {
        this._webSocketSvc.open$().subscribe(ok => {
            if (!ok)
                return
            this.join()
        })
    }

    change(): void {
        const builder = payload().get(this.operateCtl.value)
        if (!builder)
            return
        this._obj = builder.build().toJson(4, false)
        this._dialog
            .open(PayloadComponent, {data: this._obj})
            .afterClosed()
            .subscribe((v?: string) => {
                if (!v)
                    return
                this._obj = v
            })
    }

    customScript(): void {
        this._webSocketSvc.send(this.scriptCtl.value)
    }

    join(): void {
        const uid = this.userIdCtl.value
        const fileId = this.fileIdCtl.value
        this._webSocketSvc.send(`join:${uid}:${fileId}`)
    }

    execute(): void {
        const op = this.operateCtl.value
        const payloads: Payload[] = []
        const builder = payload().get(op)
        if (!builder)
            throw Error(`Not support ${op}`)
        payloads.push(new PayloadBuilder()
            .payloadOneof(builder.fromJson(this._obj).build(), op)
            .build())
        if (payloads.length === 0)
            return
        const transaction = new TransactionBuilder().payloads(payloads).build()
        this._send(transaction)
    }

    undo(): void {
        const transaction = new TransactionBuilder().undo(true).build()
        this._send(transaction)
    }

    redo(): void {
        const transaction = new TransactionBuilder().redo(true).build()
        this._send(transaction)
    }
    private _obj = ''

    private _send(msg: unknown): void {
        const clientSendBuilder = new ClientSendBuilder()
            .user(this.userIdCtl.value)
            .fileId(this.fileIdCtl.value)
        if (isTransaction(msg))
            clientSendBuilder
                .clientSendOneof(msg, _ClientSend_Client_send_oneof.TRANSACTION)
        else if (isDisplayRequest(msg))
            clientSendBuilder.clientSendOneof(
                msg,
                _ClientSend_Client_send_oneof.DISPLAY_REQUEST
            )
        else
            throw Error(`Invalid message, ${msg}`)
        const clientSend = clientSendBuilder.build()
        console.log(clientSend)
        const ab = clientSend.encode()
        if (isException(ab))
            throw Error(`clientSend encode error ${ab.message}`)
        this._webSocketSvc.send(new Blob([ab.buffer]))
    }
}
