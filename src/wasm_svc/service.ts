import { Subject, ReplaySubject } from 'rxjs'
import { BlockInput, CellInput, ColShift, CreateBlock, DisplayRequest, DisplayResponse, EditAction as Transaction, EditPayload as Payload, MoveBlock, RowShift, SheetShift } from '@/bindings'
import { ClientRequest, ServerResponse, OpenFile } from '@/message'
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
import { Calculator, Executor, Tasks } from './calculator'
import { TransactionCode, TransactionEndResult } from './jsvalues'
import { hasOwnProperty } from '@/core'

export class Service {
    public constructor(funcs: readonly CustomFunc[]) {
        funcs.forEach((f: CustomFunc): void => {
            this._calculator.registry(f.name, f.executor)
        })
        this._init()
    }

    public input$ = new ReplaySubject<ClientRequest>(1)
    public output$: Subject<ServerResponse> = new Subject()
    private _calculator: Calculator = new Calculator()
    private async _init() {
        await initWasm()
        this.input$.subscribe((req: ClientRequest): void => {
            const response = this._execute(req)
            this.output$.next(response)
            if (response.$case == 'actionEffect' && response.actionEffect.asyncTasks.length > 0) {
                // This case means some custom functions are needed to calculate, server sends
                // tasks to the JS side.
                this._calculator.input$.next(new Tasks(response.actionEffect.asyncTasks))
            }
        })

        this._calculator.output$.subscribe(res => {
            const r = input_async_result(res) as TransactionEndResult
            const serverSend: ServerResponse = {
                $case: 'actionEffect',
                actionEffect: r.effect
            }
            this.output$.next(serverSend)

        })
    }

    private _execute(req: ClientRequest): ServerResponse {
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

    private _execOpenFile(req: OpenFile): ServerResponse {
        const r = read_file(req.name, req.content)
        if (r === ReadFileResult.Ok) {
            return {
                $case: 'actionEffect',
                actionEffect: { asyncTasks: [], version: 0},
            }
        }
        throw Error('read file Error!')
    }

    private _execDisplayReq(req: DisplayRequest): ServerResponse {
        const displayResponse = get_patches(req.sheetIdx, req.version) as DisplayResponse
        return { $case: 'displayResponse', displayResponse}
    }

    private _execTransaction(transaction: Transaction): ServerResponse {
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
            actionEffect: result.effect
        }
    }

    private _addPayload(p: Payload) {
        if (hasOwnProperty(p, 'CellInput')) {
            const cellInput = p.CellInput as CellInput
            return cell_input(
                cellInput.sheetIdx,
                cellInput.row,
                cellInput.col,
                cellInput.content,
            )
        }
        if (hasOwnProperty(p, 'RowShift')) {
            const rowShift = p.RowShift as RowShift
            if (rowShift.insert)
                return row_insert(rowShift.sheetIdx, rowShift.row, rowShift.count)
            return row_delete(rowShift.sheetIdx, rowShift.row, rowShift.count)
        }
        if (hasOwnProperty(p, 'ColShift')) {
            const colShift = p.ColShift as ColShift
            if (colShift.insert)
                return col_insert(colShift.sheetIdx, colShift.col, colShift.count)
            return col_delete(colShift.sheetIdx, colShift.col, colShift.count)
        }
        if (hasOwnProperty(p, 'CreateBlock')) {
            const createBlock = p.CreateBlock as CreateBlock
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
            const moveBlock = p.MoveBlock as MoveBlock
            return move_block(
                moveBlock.sheetIdx,
                moveBlock.id,
                moveBlock.newMasterRow,
                moveBlock.newMasterCol,
            )
        }
        if (hasOwnProperty(p, 'BlockInput')) {
            const blockInput = p.BlockInput as BlockInput
            return block_input(
                blockInput.sheetIdx,
                blockInput.blockId,
                blockInput.row,
                blockInput.col,
                blockInput.input,
            )
        }
        // if (hasOwnProperty(p, 'SheetShift')) {
        //     const sheetShift = p.SheetShift as SheetShift
        // }
        console.log('Unimplemented!')
    }

    private _execUndo(): ServerResponse {
        const r = undo()
        if (!r)
            console.log('undo failed')
        return {
            $case: 'actionEffect',
            actionEffect: {asyncTasks:[], version: 0}
        }
    }

    private _execRedo(): ServerResponse {
        const r = redo()
        if (!r)
            console.log('redo failed')
        return {
            $case: 'actionEffect',
            actionEffect: { asyncTasks:[], version: 0}
        }
    }

}

export class CustomFunc {
    public constructor(
        public readonly name: string,
        public readonly executor: Executor,
    ) { }
}
