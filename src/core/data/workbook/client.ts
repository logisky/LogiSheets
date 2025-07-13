/* eslint-disable @typescript-eslint/no-explicit-any */
import {injectable} from 'inversify'
import {
    Cell,
    CustomFunc,
    DisplayWindowWithStartPoint,
    SheetInfo,
    CellPosition,
    BlockInfo,
    isErrorMessage,
    SheetDimension,
    MergeCell,
    Resp,
    Callback,
    GetDisplayWindowParams,
    GetCellParams,
    LoadWorkbookParams,
    HandleTransactionParams,
    GetFullyCoveredBlocksParams,
    GetMergedCellsParams,
    CellInfo,
    Client,
    CalcConditionParams,
    ColId,
    GetBlockColIdParams,
    GetBlockRowIdParams,
    RowId,
    GetBlockValuesParams,
    GetSheetIdxParams,
    GetAvailableBlockIdParams,
    DisplayWindow,
    GetBlockDisplayWindowParams,
    GetDiyCellIdWithBlockIdParams,
    GetSheetIdParams,
    AppendixWithCell,
    LookupAppendixUpwardParams,
    GetCellsParams,
    GetCellsExceptWindowParams,
    GetBlockInfoParams,
    GetReproducibleCellParams,
    GetReproducibleCellsParams,
    ReproducibleCell,
    GetCellValueParams,
    Value,
} from 'logisheets-web'
import {WorkerUpdate, MethodName} from './types'

@injectable()
export class WorkbookClient implements Client {
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
    getValue(params: GetCellValueParams): Resp<Value> {
        return this._call(MethodName.GetCellValue, params) as Resp<Value>
    }
    getReproducibleCell(
        params: GetReproducibleCellParams
    ): Resp<ReproducibleCell> {
        return this._call(
            MethodName.GetReproducibleCell,
            params
        ) as Resp<ReproducibleCell>
    }
    getReproducibleCells(
        params: GetReproducibleCellsParams
    ): Resp<readonly ReproducibleCell[]> {
        return this._call(MethodName.GetReproducibleCells, params) as Resp<
            readonly ReproducibleCell[]
        >
    }
    getBlockInfo(params: GetBlockInfoParams): Resp<BlockInfo> {
        return this._call(MethodName.GetBlockInfo, params) as Resp<BlockInfo>
    }
    getCellsExceptWindow(
        params: GetCellsExceptWindowParams
    ): Resp<readonly Cell[]> {
        return this._call(MethodName.GetCellsExceptWindow, params) as Resp<
            readonly Cell[]
        >
    }
    getCells(params: GetCellsParams): Resp<readonly Cell[]> {
        return this._call(MethodName.GetCells, params) as Resp<readonly Cell[]>
    }
    lookupAppendixUpward(
        params: LookupAppendixUpwardParams
    ): Resp<AppendixWithCell> {
        return this._call(
            MethodName.LookupAppendixUpward,
            params
        ) as Resp<AppendixWithCell>
    }
    getSheetId(params: GetSheetIdParams): Resp<number> {
        return this._call(MethodName.GetSheetId, params) as Resp<number>
    }
    getDiyCellIdWithBlockId(
        params: GetDiyCellIdWithBlockIdParams
    ): Resp<number> {
        return this._call(
            MethodName.GetDiyCellIdWithBlockId,
            params
        ) as Resp<number>
    }
    getBlockDisplayWindow(
        params: GetBlockDisplayWindowParams
    ): Resp<DisplayWindow> {
        return this._call(
            MethodName.GetBlockDisplayWindow,
            params
        ) as Resp<DisplayWindow>
    }
    getSheetIdx(params: GetSheetIdxParams): Resp<number> {
        return this._call(MethodName.GetSheetIdx, params) as Resp<number>
    }
    getBlockValues(params: GetBlockValuesParams): Resp<readonly string[]> {
        return this._call(MethodName.GetBlockValues, params) as Resp<
            readonly string[]
        >
    }
    getBlockRowId(params: GetBlockRowIdParams): Resp<RowId> {
        return this._call(MethodName.GetBlockRowId, params) as Resp<RowId>
    }
    getBlockColId(params: GetBlockColIdParams): Resp<ColId> {
        return this._call(MethodName.GetBlockColId, params) as Resp<ColId>
    }

    calcCondition(params: CalcConditionParams): Resp<boolean> {
        return this._call(MethodName.CalcCondition, params) as Resp<boolean>
    }

    getMergedCells(params: GetMergedCellsParams): Resp<readonly MergeCell[]> {
        return this._call(MethodName.GetMergedCells, params) as Resp<
            readonly MergeCell[]
        >
    }

    getAvailableBlockId(params: GetAvailableBlockIdParams): Resp<number> {
        return this._call(
            MethodName.GetAvailableBlockId,
            params
        ) as Resp<number>
    }

    public async isReady(): Promise<void> {
        if (this._ready) return
        return this._readyPromise
    }

    getSheetDimension(sheetIdx: number): Resp<SheetDimension> {
        return this._call(
            MethodName.GetSheetDimension,
            sheetIdx
        ) as Resp<SheetDimension>
    }

    getFullyCoveredBlocks(
        params: GetFullyCoveredBlocksParams
    ): Resp<readonly BlockInfo[]> {
        return this._call(MethodName.GetFullyCoveredBlocks, params) as Resp<
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
        return this._call(MethodName.GetAllSheetInfo, undefined) as Resp<
            readonly SheetInfo[]
        >
    }

    getDisplayWindow(
        params: GetDisplayWindowParams
    ): Resp<DisplayWindowWithStartPoint> {
        return this._call(
            MethodName.GetDisplayWindow,
            params
        ) as Resp<DisplayWindowWithStartPoint>
    }

    async getCell(params: GetCellParams): Resp<Cell> {
        const result = this._call(MethodName.GetCell, params) as Resp<CellInfo>
        return result.then((v) => {
            if (!isErrorMessage(v)) return new Cell(v)
            return v
        })
    }

    async getCellPosition(params: GetCellParams): Resp<CellPosition> {
        return this._call(
            MethodName.GetCellPosition,
            params
        ) as Resp<CellPosition>
    }

    async undo(): Resp<void> {
        return this._call(MethodName.Undo, undefined) as Resp<void>
    }

    async redo(): Resp<void> {
        return this._call(MethodName.Redo, undefined) as Resp<void>
    }

    async handleTransaction(params: HandleTransactionParams): Resp<void> {
        return this._call(MethodName.HandleTransaction, params) as Resp<void>
    }

    async loadWorkbook(params: LoadWorkbookParams): Resp<void> {
        return this._call(MethodName.LoadWorkbook, params) as Resp<void>
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
