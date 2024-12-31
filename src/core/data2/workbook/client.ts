/* eslint-disable @typescript-eslint/no-explicit-any */
import {injectable} from 'inversify'
import {
    ActionEffect,
    Cell,
    CustomFunc,
    DisplayWindowWithStartPoint,
    SheetInfo,
    CellPosition,
    ErrorMessage,
    BlockInfo,
    isErrorMessage,
} from 'logisheets-web'
import {
    Callback,
    WorkerUpdate,
    GetAllSheetInfoParams,
    GetDisplayWindowParams,
    GetCellParams,
    LoadWorkbookParams,
    HandleTransactionParams,
    GetFullyCoveredBlocksParams,
} from './types'
import {CellInfo} from 'packages/web'

export type Resp<T> = Promise<T | ErrorMessage>

export interface IWorkbookClient {
    getAllSheetInfo(params: GetAllSheetInfoParams): Resp<readonly SheetInfo[]>
    getDisplayWindow(
        params: GetDisplayWindowParams
    ): Resp<DisplayWindowWithStartPoint>
    getCell(params: GetCellParams): Resp<Cell>
    getCellPosition(params: GetCellParams): Resp<CellPosition>
    getFullyCoveredBlocks(
        params: GetFullyCoveredBlocksParams
    ): Resp<readonly BlockInfo[]>

    undo(): Resp<void>
    redo(): Resp<void>
    handleTransaction(params: HandleTransactionParams): Resp<void>

    loadWorkbook(params: LoadWorkbookParams): Resp<void>

    registryCustomFunc(f: CustomFunc): void
    registryCellUpdatedCallback(f: () => void): void
    registrySheetUpdatedCallback(f: () => void): void
}

@injectable()
export class WorkbookClient implements IWorkbookClient {
    constructor() {
        const worker = new Worker(
            new URL('./workbook.worker.ts', import.meta.url)
        )
        this._worker = worker
        this._worker.onmessage = (e) => {
            const data = e.data
            const {result, id} = data
            if (id == WorkerUpdate.Cell) {
                this._cellUpdatedCallbacks.forEach((f: Callback) => {
                    f()
                })
            } else if (id == WorkerUpdate.Sheet) {
                this._sheetUpdatedCallbacks.forEach((f: Callback) => {
                    f()
                })
            } else if (id == WorkerUpdate.CellAndSheet) {
                this._sheetUpdatedCallbacks.forEach((f: Callback) => {
                    f()
                })
                this._cellUpdatedCallbacks.forEach((f: Callback) => {
                    f()
                })
            } else if (id == WorkerUpdate.Ready) {
                if (!this._ready) {
                    this._ready = true
                    const r = this._resolvers.get(id)
                    if (r) r(result)
                }
            }

            const resolver = this._resolvers.get(id)
            if (resolver) {
                resolver(result)
            }
            this._resolvers.delete(id)
        }
    }

    public async isReady(): Promise<void> {
        if (this._ready) return
        return this._readyPromise
    }

    getFullyCoveredBlocks(
        params: GetFullyCoveredBlocksParams
    ): Resp<readonly BlockInfo[]> {
        return this._call('getFullyCoveredBlocks', params) as Resp<
            readonly BlockInfo[]
        >
    }

    registryCustomFunc(f: CustomFunc): void {
        // TODO
        return
    }

    registryCellUpdatedCallback(f: () => void): void {
        this._cellUpdatedCallbacks.push(f)
        return
    }
    registrySheetUpdatedCallback(f: () => void): void {
        this._sheetUpdatedCallbacks.push(f)
        return
    }

    getAllSheetInfo(): Resp<readonly SheetInfo[]> {
        return this._call('getAllSheetInfo', undefined) as Resp<
            readonly SheetInfo[]
        >
    }

    getDisplayWindow(
        params: GetDisplayWindowParams
    ): Resp<DisplayWindowWithStartPoint> {
        return this._call(
            'getDisplayWindow',
            params
        ) as Resp<DisplayWindowWithStartPoint>
    }

    async getCell(params: GetCellParams): Resp<Cell> {
        const result = this._call('getCell', params) as Resp<CellInfo>
        return result.then((v) => {
            if (!isErrorMessage(v)) return new Cell(v)
            return v
        })
    }

    async getCellPosition(params: GetCellParams): Resp<CellPosition> {
        return this._call('getCellPosition', params) as Resp<CellPosition>
    }

    async undo(): Resp<void> {
        return this._call('undo', undefined) as Resp<void>
    }

    redo(): Resp<void> {
        return this._call('redo', undefined) as Resp<void>
    }

    async handleTransaction(params: HandleTransactionParams): Resp<void> {
        return this._call('handleTransaction', params) as Resp<void>
    }

    loadWorkbook(params: LoadWorkbookParams): Resp<void> {
        return this._call('loadWorkbook', params) as Resp<void>
    }

    private _call(method: string, params?: any) {
        const id = this._id++
        this._worker.postMessage({m: method, args: params, id})
        return new Promise((resolve) => {
            this._resolvers.set(id, resolve)
        })
    }

    private _worker!: Worker
    // Normal id starts with 10
    private _id = 10

    private _resolvers: Map<number, (arg: any) => unknown> = new Map()
    private _cellUpdatedCallbacks: Callback[] = []
    private _sheetUpdatedCallbacks: Callback[] = []

    private _ready = false
    private _readyPromise: Promise<void> = new Promise((r) => {
        this._resolvers.set(WorkerUpdate.Ready, r)
    })
}
