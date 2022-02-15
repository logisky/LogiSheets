import { Subject } from 'rxjs'
import {ClientSend,  DisplayRequest,  DisplayResponse,  Payload,  ServerSend, ShiftType, Transaction} from '../proto/message'
import * as wasm from '../../wasm/pkg'
import { Calculator , Executor } from './calculator'
import { TransactionCode, TransactionEndResult } from './jsvalues'

export class Service {
    public constructor(funcs: readonly CustomFunc[]) {
        funcs.forEach((f: CustomFunc): void => {
            this._calculator.registry(f.name, f.executor)
        })
        this.input$.subscribe((req: ClientSend): void => {
            const response = this._execute(req)
            this.output$.next(response)
        })
        this._calculator.output$.subscribe(res => {
            const r: TransactionEndResult = wasm.input_async_result(res)
            const serverSend: ServerSend = {serverSendOneof: {$case: 'sheetUpdated', sheetUpdated: {index: r.sheetIdx}}}
            this.output$.next(serverSend)
        })
    }

    public input$: Subject<ClientSend> = new Subject()
    public output$: Subject<ServerSend> = new Subject()
    private _calculator: Calculator = new Calculator()

    private _execute(req: ClientSend): ServerSend {
        const clientSend = req.clientSendOneof
        if (clientSend === undefined)
            return {}
        if (clientSend.$case === 'transaction')
            return this._execTransaction(clientSend.transaction)
        return this._execDisplayReq(clientSend.displayRequest)
    }

    private _execDisplayReq(req: DisplayRequest): ServerSend {
        const response: DisplayResponse = wasm.get_patches(req.sheetIdx, req.version)
        return {serverSendOneof: {$case: 'displayResponse', displayResponse: response}}
    }

    private _execTransaction(transaction: Transaction): ServerSend {
        if (transaction.undo)
            return this._execUndo()
        if (transaction.redo)
            return this._execRedo()
        wasm.transaction_start()
        transaction.payloads.forEach(p => {
            this._addPayload(p)
        })
        const undoable = transaction.undoable
        const result: TransactionEndResult = wasm.transaction_end(undoable)
        if (result.code === TransactionCode.Err)
            return {}
        return {serverSendOneof: {$case: 'sheetUpdated', sheetUpdated: {index: result.sheetIdx}}}
    }

    private _addPayload(p: Payload) {
        if (p.payloadOneof === undefined)
            return
        switch (p.payloadOneof.$case) {
        case 'cellInput':
            const cellInput = p.payloadOneof.cellInput
            wasm.cell_input(
                cellInput.sheetIdx,
                cellInput.row,
                cellInput.col,
                cellInput.input,
            )
            break
        case 'rowShift':
            const rowShift = p.payloadOneof.rowShift
            if (rowShift.type === ShiftType.INSERT) {
                wasm.row_insert(
                    rowShift.sheetIdx,
                    rowShift.start,
                    rowShift.count,
                )
            } else if (rowShift.type === ShiftType.DELETE) {
                wasm.row_delete(
                    rowShift.sheetIdx,
                    rowShift.start,
                    rowShift.count,
                )
            } else {
                throw Error('')
            }
            break
        case 'columnShift':
            const colShift = p.payloadOneof.columnShift
            if (colShift.type === ShiftType.INSERT) {
                wasm.row_insert(
                    colShift.sheetIdx,
                    colShift.start,
                    colShift.count,
                )
            } else if (colShift.type === ShiftType.DELETE) {
                wasm.col_delete(
                    colShift.sheetIdx,
                    colShift.start,
                    colShift.count,
                )
            } else {
                throw Error('')
            }
            break
        case 'createBlock':
            const cb = p.payloadOneof.createBlock
            wasm.create_block(
                cb.sheetIdx,
                cb.id,
                cb.masterRow,
                cb.masterCol,
                cb.rowCnt,
                cb.colCnt,
            )
            break
        case 'moveBlock':
            const mb = p.payloadOneof.moveBlock
            wasm.move_block(
                mb.sheetIdx,
                mb.id,
                mb.newMasterRow,
                mb.newMasterCol,
            )
            break
        case 'blockInput':
            const bi = p.payloadOneof.blockInput
            wasm.block_input(
                bi.sheetIdx,
                bi.id,
                bi.row,
                bi.col,
                bi.input,
            )
            break
        case 'setColVisible':
        case 'setColWidth':
        case 'sheetShift':
        case 'sheetRename':
        }
    }

    private _execUndo(): ServerSend {
        const r = wasm.undo()
        if (r) {
            return {serverSendOneof: {$case: "sheetUpdated", sheetUpdated: {index: []}}}
        }
        return {}
    }

    private _execRedo(): ServerSend {
        const r = wasm.redo()
        if (r) {
            return {serverSendOneof: {$case: "sheetUpdated", sheetUpdated: {index: []}}}
        }
        return {}
    }

}

export class CustomFunc {
    public constructor(
        public readonly name: string,
        public readonly executor: Executor,
    ) {}
}
