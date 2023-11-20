/* eslint-disable no-console */
import {Subject, ReplaySubject} from 'rxjs'
import {ClientRequest, ServerResponse, OpenFile} from '@/message'
import {Calculator, Executor, Tasks} from './calculator'
import {
    initWasm,
    Workbook,
    ActionEffect,
    Transaction,
    DisplayRequest,
} from '@logisheets_bg'

export class Service {
    public constructor(funcs: readonly CustomFunc[]) {
        funcs.forEach((f: CustomFunc): void => {
            this._calculator.registry(f.name, f.executor)
        })
        this._init()
    }

    public input$ = new ReplaySubject<ClientRequest>(1)
    public output$: Subject<ServerResponse> = new Subject()
    private async _init() {
        await initWasm()
        this._workbookImpl = new Workbook()
        this.input$.subscribe((req: ClientRequest): void => {
            const response = this._execute(req)
            this.output$.next(response)
            if (
                response.$case == 'actionEffect' &&
                response.actionEffect.asyncTasks.length > 0
            ) {
                // This case means some custom functions are needed to calculate, server sends
                // tasks to the JS side.
                this._calculator.input$.next(
                    new Tasks(response.actionEffect.asyncTasks)
                )
            }
        })

        this._calculator.output$.subscribe((res) => {
            const r = this._workbook.inputAsyncResult(res) as ActionEffect
            const serverSend: ServerResponse = {
                $case: 'actionEffect',
                actionEffect: r,
            }
            this.output$.next(serverSend)
        })
    }

    private _execute(req: ClientRequest): ServerResponse {
        const clientSend = req
        if (clientSend.$case === 'transaction')
            return this._execTransaction(clientSend.transaction)
        if (clientSend.$case === 'history')
            return this._execHistory(clientSend.undo)
        else if (clientSend.$case === 'displayRequest')
            return this._execDisplayReq(clientSend.displayRequest)
        else if (clientSend.$case === 'openFile')
            return this._execOpenFile(clientSend.openFile)
        else throw Error(`Not support ${clientSend}`)
    }

    private _execHistory(undo: boolean): ServerResponse {
        let isDone = false
        if (undo) {
            isDone = this._workbook.undo()
        } else {
            isDone = this._workbook.redo()
        }
        const status = {ok: isDone}
        return {
            $case: 'actionEffect',
            actionEffect: {asyncTasks: [], version: 0, status: status},
        }
    }

    private _execOpenFile(req: OpenFile): ServerResponse {
        const ret = this._workbook.load(req.content, req.name)
        if (ret === 0) {
            return {
                $case: 'actionEffect',
                actionEffect: {asyncTasks: [], version: 0, status: {ok: false}},
            }
        }
        throw Error('read file Error!')
    }

    private _execDisplayReq(req: DisplayRequest): ServerResponse {
        // TODO
        const resp = this._workbook.getPatches(req.sheetIdx, req.version)
        return {$case: 'displayResponse', displayResponse: resp}
    }

    private _execTransaction(transaction: Transaction): ServerResponse {
        const actionEffect = this._workbook.execTransaction(transaction, true)
        return {
            $case: 'actionEffect',
            actionEffect: actionEffect,
        }
    }

    private get _workbook(): Workbook {
        if (this._workbookImpl) return this._workbookImpl
        throw Error('get workbook without initializing')
    }
    private _workbookImpl: Workbook | undefined
    private _calculator: Calculator = new Calculator()
}

export class CustomFunc {
    public constructor(
        public readonly name: string,
        public readonly executor: Executor
    ) {}
}
