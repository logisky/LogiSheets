// tslint:disable: limit-indent-for-method-in-class
import {WebSocketService} from '@logi-sheets/web/ws'
import {Subject, Observable} from 'rxjs'
import {
    ClientSendBuilder,
    DisplayPatch,
    DisplayRequest,
    isDisplayRequest,
    isSheetBlocks,
    isSheetColInfo,
    isSheetComments,
    isSheetMergeCells,
    isSheetNames,
    isSheetRowInfo,
    isSheetStyles,
    isSheetValues,
    isTransaction,
    SheetUpdated,
    Transaction,
    _ClientSend_Client_send_oneof,
} from '@logi-pb/network/src/proto/message_pb'
import {debugWeb} from '@logi-sheets/web/global'
import {isException} from '@logi-base/src/ts/common/exception'
import {Settings} from '@logi-sheets/web/core/data/settings'
import {SheetService} from '@logi-sheets/web/core/data/sheet'
export class Backend {
    constructor(
        public readonly settings: Settings,
        private readonly _sheetSvc: SheetService,
        private readonly _wsSvc: WebSocketService,
    ) {
        this._handleResponse()
    }
    get render$(): Observable<void> {
        return this._render$
    }

    get sheetUpdated$(): Observable<SheetUpdated> {
        return this._sheetUpdated$
    }

    send(msg: Transaction | DisplayRequest): void {
        const clientSendBuilder = new ClientSendBuilder()
            .user('minglong')
            .fileId('4')
        if (isTransaction(msg))
            clientSendBuilder
                .clientSendOneof(msg, _ClientSend_Client_send_oneof.TRANSACTION)
        else if (isDisplayRequest(msg))
            clientSendBuilder.clientSendOneof(
                msg,
                _ClientSend_Client_send_oneof.DISPLAY_REQUEST
            )
        else
            // tslint:disable-next-line: no-throw-unless-asserts
            throw Error(`Invalid message, ${msg}`)
        const clientSend = clientSendBuilder.build()
        debugWeb('client send', clientSend)
        const ab = clientSend.encode()
        if (isException(ab))
            // tslint:disable-next-line: no-throw-unless-asserts
            throw Error(`clientSend encode error ${ab.message}`)
        this._wsSvc.send(new Blob([ab.buffer]))
    }
    private _render$ = new Subject<void>()
    private _sheetUpdated$ = new Subject<SheetUpdated>()
    // tslint:disable-next-line: max-func-body-length
    private _handleResponse(): void {
        this._wsSvc.displayResponse$().subscribe(e => {
            debugWeb('ws: display response', e)
            this._sheetSvc.clear()
            e.patches.forEach(p => {
                this._handleDisplayArea(p)
            })
            this._render$.next()
        })
        this._wsSvc.sheetUpdated$().subscribe(e => {
            debugWeb('ws: sheet updated', e)
            this._sheetUpdated$.next(e)
        })
    }

    private _handleDisplayArea(p: DisplayPatch) {
        const patch = p.getDisplayPatchOneof()
        if (!patch)
            return
        const type = patch[0]
        if (isSheetValues(type) && p.values) {
            const sheet = p.values.sheetIdx
            p.values.values.forEach(v => {
                const {row, col, formula, value} = v
                this._sheetSvc.setCell(row, col, sheet, {value, formula})
            })
        } else if (isSheetStyles(type) && p.styles) {
            const sheet = p.styles.sheetIdx
            p.styles.styles.forEach(s => {
                const {row, col, style} = s
                if (style)
                    this._sheetSvc.setCell(row, col, sheet, {style})
            })
        } else if (isSheetRowInfo(type) && p.rowInfo) {
            const sheet = p.rowInfo.sheetIdx
            p.rowInfo.info.forEach(i => {
                this._sheetSvc.setRowInfo(i.idx, i, sheet)
            })
        } else if (isSheetColInfo(type) && p.colInfo) {
            const sheet = p.colInfo.sheetIdx
            p.colInfo.info.forEach(i => {
                this._sheetSvc.setColInfo(i.idx, i, sheet)
            })
        } else if (isSheetNames(type) && p.sheetNames)
            p.sheetNames.sheetNames.forEach((name, i) => {
                this._sheetSvc.setSheet(i, {name})
            })
        else if (isSheetMergeCells(type) && p.mergeCells) {
            const merges = p.mergeCells.mergeCells
            this._sheetSvc.setSheet(p.mergeCells.idx, {merges})
        } else if (isSheetComments(type) && p.comments) {
            const sheet = p.comments.idx
            this._sheetSvc.setSheet(sheet, {comments: p.comments.comment})
        } else if (isSheetBlocks(type) && p.blocks)
            this._sheetSvc.setBlocks(p.blocks.sheetIdx, p.blocks.blockInfo)
    }
}
