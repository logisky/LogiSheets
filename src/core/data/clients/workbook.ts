/* eslint-disable @typescript-eslint/no-explicit-any */
import {injectable} from 'inversify'
import {
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
    GetShadowCellIdParams,
    GetShadowCellIdsParams,
    GetShadowInfoByIdParams,
    SheetCellId,
    GetCellIdParams,
    CellIdCallback,
    ShadowCellInfo,
    FormulaDisplayInfo,
    GetNextVisibleCellParams,
    CellCoordinate,
    ActionEffect,
    BlockField,
    SaveFileResult,
    SaveParams,
    AppData,
} from 'logisheets-web'
import {WorkerUpdate, MethodName} from '../../worker/types'

@injectable()
export class WorkbookClient implements Client {
    constructor(private _worker: Worker) {
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
            } else if (id == WorkerUpdate.CellValueChanged) {
                const id = sheetCellIdToString(result)
                this._cellValueChangedCallbacks.get(id)?.forEach((f) => {
                    f(result)
                })
            } else if (id == WorkerUpdate.CellRemoved) {
                const id = sheetCellIdToString(result)
                this._cellRemovedCallbacks.get(id)?.forEach((f) => {
                    f(result)
                })
            }

            const resolver = this._resolvers.get(id)
            if (resolver) {
                resolver(result)
            }
            this._resolvers.delete(id)
        }
    }
    save(params: SaveParams): Resp<SaveFileResult> {
        return this._call(MethodName.Save, params) as Resp<SaveFileResult>
    }
    getAllBlockFields(): Resp<readonly BlockField[]> {
        return this._call(MethodName.GetAllBlockFields) as Resp<
            readonly BlockField[]
        >
    }
    getDisplayUnitsOfFormula(f: string): Resp<FormulaDisplayInfo> {
        return this._call(
            MethodName.GetDisplayUnitsOfFormula,
            f
        ) as Resp<FormulaDisplayInfo>
    }

    getCellId(params: GetCellIdParams): Resp<SheetCellId> {
        return this._call(MethodName.GetCellId, params) as Resp<SheetCellId>
    }

    registerCustomFunc(_: CustomFunc): Resp<void> {
        throw new Error('Method not implemented.')
    }

    async registerCellValueChangedCallback(
        sheetIdx: number,
        rowIdx: number,
        colIdx: number,
        callback: CellIdCallback
    ): Resp<void> {
        return this.getCellId({sheetIdx, rowIdx, colIdx}).then((cellId) => {
            if (isErrorMessage(cellId)) {
                return cellId
            }
            const cellIdStr = sheetCellIdToString(cellId)
            if (!this._cellValueChangedCallbacks.has(cellIdStr)) {
                this._cellValueChangedCallbacks.set(cellIdStr, [callback])
            } else {
                this._cellValueChangedCallbacks.get(cellIdStr)?.push(callback)
            }
            return
        })
    }

    registerCellRemovedCallback(
        sheetIdx: number,
        rowIdx: number,
        colIdx: number,
        callback: CellIdCallback
    ): Resp<void> {
        const result = this.getCellId({sheetIdx, rowIdx, colIdx}).then(
            (cellId) => {
                if (isErrorMessage(cellId)) {
                    return cellId
                }

                const cellIdStr = sheetCellIdToString(cellId)
                if (!this._cellRemovedCallbacks.has(cellIdStr)) {
                    this._cellRemovedCallbacks.set(cellIdStr, [callback])
                } else {
                    this._cellRemovedCallbacks.get(cellIdStr)?.push(callback)
                }
                return
            }
        )
        return result
    }

    async registerShadowCellValueChangedCallback(
        sheetIdx: number,
        rowIdx: number,
        colIdx: number,
        callback: CellIdCallback
    ): Resp<number> {
        return this.getShadowCellId({sheetIdx, rowIdx, colIdx}).then(
            (shadowCellId) => {
                if (isErrorMessage(shadowCellId)) {
                    return shadowCellId
                }
                const cellIdStr = sheetCellIdToString(shadowCellId)
                if (!this._cellValueChangedCallbacks.has(cellIdStr)) {
                    this._cellValueChangedCallbacks.set(cellIdStr, [callback])
                } else {
                    this._cellValueChangedCallbacks
                        .get(cellIdStr)
                        ?.push(callback)
                }

                if (shadowCellId.cellId.type !== 'ephemeralCell') {
                    throw new Error('shadow cell id is not ephemeral')
                }
                return shadowCellId.cellId.value
            }
        )
    }

    getShadowInfoById(params: GetShadowInfoByIdParams): Resp<ShadowCellInfo> {
        return this._call(
            MethodName.GetShadowInfoById,
            params
        ) as Resp<ShadowCellInfo>
    }
    getShadowCellId(params: GetShadowCellIdParams): Resp<SheetCellId> {
        return this._call(
            MethodName.GetShadowCellId,
            params
        ) as Resp<SheetCellId>
    }
    getShadowCellIds(
        params: GetShadowCellIdsParams
    ): Resp<readonly SheetCellId[]> {
        return this._call(MethodName.GetShadowCellIds, params) as Resp<
            readonly SheetCellId[]
        >
    }
    getValue(params: GetCellValueParams): Resp<Value> {
        return this._call(MethodName.GetCellValue, params) as Resp<Value>
    }
    getAppData(): Resp<readonly AppData[]> {
        return this._call(MethodName.GetAppData) as Resp<readonly AppData[]>
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
    ): Resp<readonly CellInfo[]> {
        return this._call(MethodName.GetCellsExceptWindow, params) as Resp<
            readonly CellInfo[]
        >
    }
    getCells(params: GetCellsParams): Resp<readonly CellInfo[]> {
        return this._call(MethodName.GetCells, params) as Resp<
            readonly CellInfo[]
        >
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

    registerCellUpdatedCallback(f: () => void, id?: number): void {
        if (id && this._callbackIdSet.has(id)) {
            return
        } else if (id) {
            this._callbackIdSet.add(id)
        }
        this._cellUpdatedCallbacks.add(f)
        return
    }
    registerSheetUpdatedCallback(f: () => void): void {
        this._sheetUpdatedCallbacks.add(f)
        return
    }

    getAllSheetInfo(): Resp<readonly SheetInfo[]> {
        return this._call(MethodName.GetAllSheetInfo, undefined) as Resp<
            readonly SheetInfo[]
        >
    }

    getNextVisibleCell(params: GetNextVisibleCellParams): Resp<CellCoordinate> {
        return this._call(
            MethodName.GetNextVisibleCell,
            params
        ) as Resp<CellCoordinate>
    }

    getDisplayWindow(
        params: GetDisplayWindowParams
    ): Resp<DisplayWindowWithStartPoint> {
        return this._call(
            MethodName.GetDisplayWindow,
            params
        ) as Resp<DisplayWindowWithStartPoint>
    }

    async getCell(params: GetCellParams): Resp<CellInfo> {
        return this._call(MethodName.GetCell, params) as Resp<CellInfo>
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

    async handleTransactionWithoutEvents(
        params: HandleTransactionParams
    ): Resp<ActionEffect> {
        return this._call(
            MethodName.HandleTransactionWithoutEvents,
            params
        ) as Resp<ActionEffect>
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

    // Normal id starts with 10
    private _id = 10

    private _resolvers: Map<number, (arg: any) => unknown> = new Map()
    private _cellUpdatedCallbacks: Set<Callback> = new Set()
    private _sheetUpdatedCallbacks: Set<Callback> = new Set()

    private _cellValueChangedCallbacks: Map<string, CellIdCallback[]> =
        new Map()
    private _cellRemovedCallbacks: Map<string, CellIdCallback[]> = new Map()

    private _ready = false
    private _readyPromise: Promise<void> = new Promise((r) => {
        this._resolvers.set(WorkerUpdate.Ready, r)
    })

    private _callbackIdSet: Set<number> = new Set()
}

export function sheetCellIdToString(sheetCellId: SheetCellId): string {
    const cellId = sheetCellId.cellId
    if (cellId.type === 'ephemeralCell') {
        return `e-${cellId.value}-${sheetCellId.sheetId}`
    }
    if (cellId.type === 'blockCell') {
        return `b-${cellId.value.blockId}-${cellId.value.row}-${cellId.value.col}-${sheetCellId.sheetId}`
    }
    return `n-${cellId.value.row}-${cellId.value.col}-${sheetCellId.sheetId}`
}
