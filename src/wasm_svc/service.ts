import { Subject, ReplaySubject } from 'rxjs'
// import { ClientSend, DisplayRequest, DisplayResponse, OpenFile, Payload, ServerSend, ShiftType, Transaction } from '../proto/message'
import { DisplayRequest, DisplayResponse, EditAction as Transaction, EditPayload as Payload } from '@/bindings'
import { ClientSend, ServerSend, OpenFile } from '@/message'
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
    col_insert,
} from '../wasms/server/pkg'
import { Calculator, Executor } from './calculator'
import { TransactionCode, TransactionEndResult } from './jsvalues'
import { hasOwnProperty } from '@/common'

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
            const r = input_async_result(res) as TransactionEndResult
            const serverSend: ServerSend = {
                $case: 'actionEffect',
                actionEffect: {sheets: r.sheetIdx, async_tasks: [], dirtys: []} // todo!()
            }
            this.output$.next(serverSend)
        })
    }

    private _execute(req: ClientSend): ServerSend {
        const clientSend = req
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
                $case: 'actionEffect',
                actionEffect: {sheets: [], async_tasks: [], dirtys: []},
            }
        }
        throw Error('read file Error!')
    }

    private _execDisplayReq(req: DisplayRequest): ServerSend {
        const displayResponse = get_patches(req.sheetIdx, req.version) as DisplayResponse
        return { $case: 'displayResponse', displayResponse}
    }

    private _execTransaction(transaction: Transaction): ServerSend {
        if (transaction === 'Undo')
            return this._execUndo()
        if (transaction === 'Redo')
            return this._execRedo()
        transaction_start()
        transaction.Payloads.payloads.forEach(p => {
            this._addPayload(p)
        })
        const undoable = transaction.Payloads.undoable
        const result: TransactionEndResult = transaction_end(undoable)
        if (result.code === TransactionCode.Err) {
            debugger
        }
        return {
            $case: 'actionEffect',
            actionEffect: {sheets: [], dirtys: [], async_tasks:[]}
        }
    }

    private _addPayload(p: Payload) {
        if (hasOwnProperty(p, 'CellInput')) {
            const cellInput = p.CellInput
            return cell_input(
                cellInput.sheetIdx,
                cellInput.row,
                cellInput.col,
                cellInput.content,
            )
        }
        if (hasOwnProperty(p, 'RowShift')) {
            const rowShift = p.RowShift
            if (rowShift.insert)
                return row_insert(rowShift.sheetIdx, rowShift.row, rowShift.count)
            return row_delete(rowShift.sheetIdx, rowShift.row, rowShift.count)
        }
        if (hasOwnProperty(p, 'ColShift')) {
            const colShift = p.ColShift
            if (colShift.insert)
                return col_insert(colShift.sheetIdx, colShift.col, colShift.count)
            return col_delete(colShift.sheetIdx, colShift.col, colShift.count)
        }
        if (hasOwnProperty(p, 'CreateBlock')) {
            const createBlock = p.CreateBlock
            return create_block(
                createBlock.sheetIdx,
                createBlock.id,
                createBlock.masterRow,
                createBlock.masterCol,
                createBlock.rowCnt,
                createBlock.colCnt,
            )
        }
        if (hasOwnProperty(p, 'MoveBlock')) {
            const moveBlock = p.MoveBlock
            return move_block(
                moveBlock.sheetIdx,
                moveBlock.id,
                moveBlock.newMasterRow,
                moveBlock.newMasterCol,
            )
        }
        if (hasOwnProperty(p, 'BlockInput')) {
            const blockInput = p.BlockInput
            return block_input(
                blockInput.sheetIdx,
                blockInput.blockId,
                blockInput.row,
                blockInput.col,
                blockInput.input,
            )
        }
        console.log('Unimplemented!')
    }

    private _execUndo(): ServerSend {
        const r = undo()
        if (!r)
            console.log('undo failed')
        return {
            $case: 'actionEffect',
            actionEffect: {sheets: [], dirtys: [], async_tasks:[]}
        }
    }

    private _execRedo(): ServerSend {
        const r = redo()
        if (!r)
            console.log('redo failed')
        return {
            $case: 'actionEffect',
            actionEffect: {sheets: [], dirtys: [], async_tasks:[]}
        }
    }

}

export class CustomFunc {
    public constructor(
        public readonly name: string,
        public readonly executor: Executor,
    ) { }
}
