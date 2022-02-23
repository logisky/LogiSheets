import { Observable, from, ReplaySubject, Subject } from 'rxjs'
import { ClientSend, DisplayPatch, ServerSend, SheetUpdated } from 'proto/message'
import { Payload, PayloadsTransaction, adaptTransaction} from 'api'
import { debugWeb } from 'common'
import { SheetService } from 'core/data/sheet'
import { Service as StandAloneService } from 'wasm_svc/service'
export class Backend {
    constructor(
        public readonly sheetSvc: SheetService,
    ) {
        this._wasmSvc.output$.subscribe(e => {
            this.handleResponse(e)
        })
    }
    get render$(): Observable<void> {
        return this._render$
    }

    get sheetUpdated$(): Observable<SheetUpdated> {
        return this._sheetUpdated$
    }
    send$ = new ReplaySubject<Blob>(5)
    handleResponse(msg: Blob | ServerSend) {
        debugWeb(`standalone: ${STAND_ALONE}, response`, msg)
        if (!(msg instanceof Blob)) {
            if (!STAND_ALONE)
                return
            this._handleServerSend(msg)
            return
        }
        from(msg.arrayBuffer()).subscribe(ab => {
            const e = ServerSend.decode(new Uint8Array(ab))
            debugWeb('server send ', e)
            this._handleServerSend(e)
        })
    }
    sendTransaction(payloads: Payload[], undoable = true) {
        if (payloads.length === 0)
            return
        const t = new PayloadsTransaction(payloads, undoable)
        const msg = adaptTransaction(t)
        this.send({$case:'transaction', transaction: msg})
    }

    send(msg: ClientSend['clientSendOneof']) {
        const clientSend: ClientSend = {
            user: 'minglong',
            fileId: '4',
            clientSendOneof: msg,
        }
        debugWeb('client send', clientSend)
        if (STAND_ALONE) {
            this._wasmSvc.input$.next(clientSend)
            return
        }
        const ab = ClientSend.encode(clientSend).finish()
        this.send$.next(new Blob([ab]))
    }
    private _render$ = new Subject<void>()
    private _sheetUpdated$ = new Subject<SheetUpdated>()
    private _wasmSvc = new StandAloneService([])
    private _handleServerSend(e: ServerSend) {
        const type = e.serverSendOneof
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
    }

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
