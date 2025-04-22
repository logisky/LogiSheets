/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    BlockInfo,
    CalcConditionParams,
    Callback,
    Cell,
    CellPosition,
    ColId,
    CustomFunc,
    DisplayWindowWithStartPoint,
    GetAllSheetInfoParams,
    GetBlockColIdParams,
    GetBlockRowIdParams,
    GetCellParams,
    GetDisplayWindowParams,
    GetFullyCoveredBlocksParams,
    GetMergedCellsParams,
    HandleTransactionParams,
    LoadWorkbookParams,
    MergeCell,
    Resp,
    RowId,
    SheetDimension,
    SheetInfo,
    Client as WorkbookClient,
} from 'logisheets-web'
import {
    CraftSpecific,
    CraftState,
    GetCraftStateMethodName,
    BlockId,
} from './types'

export class CraftAgent implements WorkbookClient, CraftSpecific {
    constructor(private readonly _blockId: BlockId) {
        window.addEventListener('message', (e) => {
            const {m, result, id} = e.data
            if (m === GetCraftStateMethodName) {
                const state = this.getCraftState()
                e.source?.postMessage({
                    m: GetCraftStateMethodName,
                    id,
                    result: state,
                })
                return
            }

            const resolver = this._resolvers.get(id)
            if (resolver) {
                resolver(result)
            }
            this._resolvers.delete(id)
        })
    }

    getCraftState(): CraftState {
        if (!this._getCraftState) {
            throw new Error('getCraftState is not set')
        }
        return this._getCraftState()
    }

    setGetCraftState(getCraftState: () => CraftState) {
        this._getCraftState = getCraftState
    }

    isReady(): Promise<void> {
        return this._call(MethodName.IsReady) as Promise<void>
    }

    getSheetDimension(sheetIdx: number): Resp<SheetDimension> {
        return this._call(
            MethodName.GetSheetDimension,
            sheetIdx
        ) as Resp<SheetDimension>
    }

    getAllSheetInfo(params: GetAllSheetInfoParams): Resp<readonly SheetInfo[]> {
        return this._call(MethodName.GetAllSheetInfo, params) as Resp<
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

    getCell(params: GetCellParams): Resp<Cell> {
        return this._call(MethodName.GetCell, params) as Resp<Cell>
    }

    getCellPosition(params: GetCellParams): Resp<CellPosition> {
        return this._call(
            MethodName.GetCellPosition,
            params
        ) as Resp<CellPosition>
    }

    getFullyCoveredBlocks(
        params: GetFullyCoveredBlocksParams
    ): Resp<readonly BlockInfo[]> {
        return this._call(MethodName.GetFullyCoveredBlocks, params) as Resp<
            readonly BlockInfo[]
        >
    }

    undo(): Resp<void> {
        return this._call(MethodName.Undo) as Resp<void>
    }

    redo(): Resp<void> {
        return this._call(MethodName.Redo) as Resp<void>
    }

    handleTransaction(params: HandleTransactionParams): Resp<void> {
        return this._call(MethodName.HandleTransaction, params) as Resp<void>
    }

    loadWorkbook(params: LoadWorkbookParams): Resp<void> {
        return this._call(MethodName.LoadWorkbook, params) as Resp<void>
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

    getMergedCells(params: GetMergedCellsParams): Resp<readonly MergeCell[]> {
        return this._call(MethodName.GetMergedCells, params) as Resp<
            readonly MergeCell[]
        >
    }

    calcCondition(params: CalcConditionParams): Resp<boolean> {
        return this._call(MethodName.CalcCondition, params) as Resp<boolean>
    }

    getBlockRowId(params: GetBlockRowIdParams): Resp<RowId> {
        return this._call(MethodName.GetBlockRowId, params) as Resp<RowId>
    }

    getBlockColId(params: GetBlockColIdParams): Resp<ColId> {
        return this._call(MethodName.GetBlockColId, params) as Resp<ColId>
    }

    private _call(method: string, params?: any) {
        const id = this._id++
        window.parent.postMessage({
            m: method,
            args: params,
            id,
            fromBlock: this._blockId,
        })
        return new Promise((resolve) => {
            this._resolvers.set(id, resolve)
        })
    }

    private _id = 0
    private _resolvers: Map<number, (arg: any) => unknown> = new Map()
    private _cellUpdatedCallbacks: Callback[] = []
    private _sheetUpdatedCallbacks: Callback[] = []
    private _getCraftState?: () => CraftState
}

export enum MethodName {
    GetSheetDimension = 'agent_getSheetDimension',
    GetFullyCoveredBlocks = 'agent_getFullyCoveredBlocks',
    GetAllSheetInfo = 'agent_getAllSheetInfo',
    GetDisplayWindow = 'agent_getDisplayWindow',
    GetCell = 'agent_getCell',
    GetCellPosition = 'agent_getCellPosition',
    Undo = 'agent_undo',
    Redo = 'agent_redo',
    HandleTransaction = 'agent_handleTransaction',
    LoadWorkbook = 'agent_loadWorkbook',
    IsReady = 'agent_isReady',
    GetMergedCells = 'agent_getMergedCells',
    CalcCondition = 'agent_calcCondition',
    GetBlockRowId = 'agent_getBlockRowId',
    GetBlockColId = 'agent_getBlockColId',
}
