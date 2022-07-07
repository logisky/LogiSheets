import { Observable, ReplaySubject, Subject } from 'rxjs'
import { DisplayPatch } from '@/bindings'
import { ClientSend, ServerSend } from '@/message'
import { Payload, PayloadsTransaction, adaptTransaction } from '@/api'
import { hasOwnProperty } from '@/common'
import { SheetService } from '@/core/data/sheet'
import { Service as StandAloneService } from '@/wasm_svc/service'
import {injectable, inject} from 'inversify'
import {TYPES} from '@/core/ioc/types'
import {getID} from '@/core/ioc/id'

@injectable()
export class Backend {
    readonly id = getID()
    constructor(
        @inject(TYPES.Sheet) private readonly sheetSvc: SheetService,
    ) {
        this._wasmSvc.output$.subscribe(e => {
            this.handleResponse(e)
        })
    }
    get render$(): Observable<void> {
        return this._render$
    }

    get sheetUpdated$(): Observable<number[]> {
        return this._sheetUpdated$
    }
    send$ = new ReplaySubject<Blob>(5)
    handleResponse(msg: ServerSend) {
        console.log(`standalone: ${STAND_ALONE}, response`, msg)
        this._handleServerSend(msg)
    }
    sendTransaction(payloads: Payload[], undoable = true) {
        if (payloads.length === 0)
            return
        const t = new PayloadsTransaction(payloads, undoable)
        const msg = adaptTransaction(t)
        this.send({ $case: 'transaction', transaction: msg })
    }

    send(msg: ClientSend) {
        console.log('send:', msg)
        this._wasmSvc.input$.next(msg)
        return
    }
    private _render$ = new Subject<void>()
    // Sever tolds the client that these sheets are dirty.
    private _sheetUpdated$ = new Subject<number[]>()
    private _wasmSvc = new StandAloneService([])
    private _handleServerSend(serverSend: ServerSend) {
        if (serverSend.$case === 'displayResponse') {
            const e = serverSend.displayResponse
            console.log('ws: display response', e)
            this.sheetSvc.clear()
            e.patches.forEach(p => {
                this._handleDisplayArea(p)
            })
            this._render$.next()
        } else if (serverSend.$case === 'actionEffect') {
            const sheetUpdated = serverSend.actionEffect.sheets
            console.log('ws: sheet updated', sheetUpdated)
            this._sheetUpdated$.next(sheetUpdated)
        }
    }

    private _handleDisplayArea(patches: DisplayPatch) {
        const displayArea = patches
        if (hasOwnProperty(displayArea, 'values')) {
            const sheet = displayArea.values.sheetIdx
            displayArea.values.values.forEach(v => {
                const { row, col, formula, value } = v
                this.sheetSvc.setCell(row, col, sheet, { value, formula })
            })
        } else if (hasOwnProperty(displayArea, 'styles')) {
            const sheet = displayArea.styles.sheetIdx
            displayArea.styles.styles.forEach(s => {
                const { row, col, style } = s
                if (style)
                    this.sheetSvc.setCell(row, col, sheet, { style })
            })
        } else if (hasOwnProperty(displayArea, 'rowInfo')) {
            const sheet = displayArea.rowInfo.sheetIdx
            displayArea.rowInfo.info.forEach(i => {
                this.sheetSvc.setRowInfo(i.idx, i, sheet)
            })
        } else if (hasOwnProperty(displayArea, 'colInfo')) {
            const sheet = displayArea.colInfo.sheetIdx
            displayArea.colInfo.info.forEach(i => {
                this.sheetSvc.setColInfo(i.idx, i, sheet)
            })
        } else if (hasOwnProperty(displayArea, 'sheetNames'))
            displayArea.sheetNames.names.forEach((name, i) => {
                this.sheetSvc.setSheet(i, { name })
            })
        else if (hasOwnProperty(displayArea, 'mergeCells')) {
            const merges = displayArea.mergeCells.mergeCells
            this.sheetSvc.setSheet(displayArea.mergeCells.sheetIdx, { merges })
        } else if (hasOwnProperty(displayArea, 'comments')) {
            const sheet = displayArea.comments.sheetIdx
            this.sheetSvc.setSheet(sheet, { comments: displayArea.comments.comments })
        } else if (hasOwnProperty(displayArea, 'blocks')) {
            const { sheetIdx, blocks } = displayArea.blocks
            this.sheetSvc.setBlocks(sheetIdx, blocks)
        }
    }
}
