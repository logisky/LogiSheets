import { Observable, from, ReplaySubject, Subject } from 'rxjs'
import { ClientSend, DisplayPatch, Payload, ServerSend, SheetUpdated, Transaction } from 'proto/message'
import { debugWeb } from 'global'
import { SheetService } from 'core/data/sheet'
export class Backend {
    constructor(
        public readonly sheetSvc: SheetService,
    ) { }
    get render$(): Observable<void> {
        return this._render$
    }

    get sheetUpdated$(): Observable<SheetUpdated> {
        return this._sheetUpdated$
    }
    send$ = new ReplaySubject<Blob>(5)
    _handleResponse(msg: unknown) {
        if (!(msg instanceof Blob))
            return
        from(msg.arrayBuffer()).subscribe(ab => {
            const data = ServerSend.decode(new Uint8Array(ab))
            debugWeb('server send ', data)
            const type = data.serverSendOneof
            if (type?.$case === 'displayResponse') {
                const e = type.displayResponse
                debugWeb('ws: display response', e)
                this.sheetSvc.clear()
                e.patches.forEach(p => {
                    this._handleDisplayArea(p)
                })
                this._render$.next()
            } else if (type?.$case === 'sheetUpdated') {
                const e = type.sheetUpdated
                debugWeb('ws: sheet updated', e)
                this._sheetUpdated$.next(e)
            }
        })
    }
    sendTransaction(payloads: Payload[], undoable = true) {
        if (payloads.length === 0)
            return
        const transaction: Transaction = {
            undoable,
            payloads,
            undo: false,
            redo: false,
        }
        this.send({ transaction, $case: 'transaction' })
    }

    send(msg: ClientSend['clientSendOneof']) {
        const clientSend: ClientSend = {
            user: 'minglong',
            fileId: '4',
            clientSendOneof: msg,
        }
        debugWeb('client send', clientSend)
        const ab = ClientSend.encode(clientSend).finish()
        this.send$.next(new Blob([ab]))
    }
    private _render$ = new Subject<void>()
    private _sheetUpdated$ = new Subject<SheetUpdated>()

    private _handleDisplayArea(p: DisplayPatch) {
        const displayArea = p.displayPatchOneof
        if (displayArea?.$case === 'values') {
            const sheet = displayArea.values.sheetIdx
            displayArea.values.values.forEach(v => {
                const { row, col, formula, value } = v
                this.sheetSvc.setCell(row, col, sheet, { value, formula })
            })
        } else if (displayArea?.$case === 'styles') {
            const sheet = displayArea.styles.sheetIdx
            displayArea.styles.styles.forEach(s => {
                const { row, col, style } = s
                if (style)
                    this.sheetSvc.setCell(row, col, sheet, { style })
            })
        } else if (displayArea?.$case === 'rowInfo') {
            const sheet = displayArea.rowInfo.sheetIdx
            displayArea.rowInfo.info.forEach(i => {
                this.sheetSvc.setRowInfo(i.idx, i, sheet)
            })
        } else if (displayArea?.$case === 'colInfo') {
            const sheet = displayArea.colInfo.sheetIdx
            displayArea.colInfo.info.forEach(i => {
                this.sheetSvc.setColInfo(i.idx, i, sheet)
            })
        } else if (displayArea?.$case === 'sheetNames')
            displayArea.sheetNames.sheetNames.forEach((name, i) => {
                this.sheetSvc.setSheet(i, { name })
            })
        else if (displayArea?.$case === 'mergeCells') {
            const merges = displayArea.mergeCells.mergeCells
            this.sheetSvc.setSheet(displayArea.mergeCells.idx, { merges })
        } else if (displayArea?.$case === 'comments') {
            const sheet = displayArea.comments.idx
            this.sheetSvc.setSheet(sheet, { comments: displayArea.comments.comment })
        } else if (displayArea?.$case === 'blocks') {
            const { sheetIdx, blockInfo } = displayArea.blocks
            this.sheetSvc.setBlocks(sheetIdx, blockInfo)
        }
    }
}
