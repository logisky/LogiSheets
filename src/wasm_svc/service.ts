import { Subject, ReplaySubject } from 'rxjs'
import { ClientSend, DisplayRequest, DisplayResponse, OpenFile, Payload, ServerSend, ShiftType, Transaction } from '../proto/message'
import initWasm, {
    read_file,
    block_input,
    cell_input,
    col_delete,
    create_block,
    get_patches,
    input_async_result,
    move_block,
    redo,
    row_delete,
    row_insert,
    transaction_end,
    transaction_start,
    undo,
    ReadFileResult,
} from 'logisheets-server'
import { Calculator, Executor } from './calculator'
import { TransactionCode, TransactionEndResult } from './jsvalues'

export class Service {
    public constructor(funcs: readonly CustomFunc[]) {
        funcs.forEach((f: CustomFunc): void => {
            this._calculator.registry(f.name, f.executor)
        })
        this._init()
    }

    public input$ = new ReplaySubject<ClientSend>(1)
    public output$: Subject<ServerSend> = new Subject()
    private _calculator: Calculator = new Calculator()
    private async _init() {
        await initWasm()
        this.input$.subscribe((req: ClientSend): void => {
            const response = this._execute(req)
            this.output$.next(response)
        })
        this._calculator.output$.subscribe(res => {
            const r = input_async_result(res)
            const serverSend: ServerSend = {
                serverSendOneof: {
                    $case: 'sheetUpdated',
                    sheetUpdated: {
                        eventSource: {
                            actionId: '1',
                            userId: '1'
                        },
                        index: r.sheetIdx,
                    }
                }
            }
            this.output$.next(serverSend)
        })
    }

    private _execute(req: ClientSend): ServerSend {
        const clientSend = req.clientSendOneof
        if (clientSend === undefined)
            return {}
        if (clientSend.$case === 'transaction')
            return this._execTransaction(clientSend.transaction)
        else if (clientSend.$case === 'displayRequest')
            return this._execDisplayReq(clientSend.displayRequest)
        else if (clientSend.$case === 'openFile')
            return this._execOpenFile(clientSend.openFile)
        else
            throw Error(`Not support ${clientSend}`)
    }

    private _execOpenFile(req: OpenFile): ServerSend {
        const r = read_file(req.name, req.content)
        if (r === ReadFileResult.Ok) {
            return {
                serverSendOneof: {
                    $case: "sheetUpdated",
                    sheetUpdated: {
                        index: [], eventSource: {
                            userId: "1",
                            actionId: "1",
                        }
                    },
                }
            }
        }
        throw Error('read file Error!')
    }

    private _execDisplayReq(req: DisplayRequest): ServerSend {
        const jsonRes = get_patches(req.sheetIdx, req.version)
        const response = DisplayResponse.fromJSON(jsonRes)
        return { serverSendOneof: { $case: 'displayResponse', displayResponse: response } }
    }

    private _execTransaction(transaction: Transaction): ServerSend {
        if (transaction.undo)
            return this._execUndo()
        if (transaction.redo)
            return this._execRedo()
        transaction_start()
        transaction.payloads.forEach(p => {
            this._addPayload(p)
        })
        const undoable = transaction.undoable
        const result: TransactionEndResult = transaction_end(undoable)
        if (result.code === TransactionCode.Err)
            return {}
        return {
            serverSendOneof: {
                $case: 'sheetUpdated',
                sheetUpdated: {
                    eventSource: {
                        actionId: '1',
                        userId: '1',
                    },
                    index: result.sheetIdx
                }
            }
        }
    }

    private _addPayload(p: Payload) {
        if (p.payloadOneof === undefined)
            return
        switch (p.payloadOneof.$case) {
            case 'cellInput':
                const cellInput = p.payloadOneof.cellInput
                cell_input(
                    cellInput.sheetIdx,
                    cellInput.row,
                    cellInput.col,
                    cellInput.input,
                )
                break
            case 'rowShift':
                const rowShift = p.payloadOneof.rowShift
                if (rowShift.type === ShiftType.INSERT) {
                    row_insert(
                        rowShift.sheetIdx,
                        rowShift.start,
                        rowShift.count,
                    )
                } else if (rowShift.type === ShiftType.DELETE) {
                    row_delete(
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
                    row_insert(
                        colShift.sheetIdx,
                        colShift.start,
                        colShift.count,
                    )
                } else if (colShift.type === ShiftType.DELETE) {
                    col_delete(
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
                create_block(
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
                move_block(
                    mb.sheetIdx,
                    mb.id,
                    mb.newMasterRow,
                    mb.newMasterCol,
                )
                break
            case 'blockInput':
                const bi = p.payloadOneof.blockInput
                block_input(
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
        const r = undo()
        if (r) {
            return {
                serverSendOneof: {
                    $case: "sheetUpdated", sheetUpdated: {
                        eventSource: {
                            actionId: '1',
                            userId: '1',
                        },
                        index: []
                    }
                }
            }
        }
        return {}
    }

    private _execRedo(): ServerSend {
        const r = redo()
        if (r) {
            return {
                serverSendOneof: {
                    $case: "sheetUpdated", sheetUpdated: {
                        eventSource: {
                            actionId: '1',
                            userId: '1',
                        },
                        index: []
                    }
                }
            }
        }
        return {}
    }

}

export class CustomFunc {
    public constructor(
        public readonly name: string,
        public readonly executor: Executor,
    ) { }
}
