/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    AppendixWithCell,
    BlockInfo,
    CalcConditionParams,
    Callback,
    Cell,
    CellPosition,
    ColId,
    CustomFunc,
    DisplayWindow,
    DisplayWindowWithStartPoint,
    GetAllSheetInfoParams,
    GetBlockColIdParams,
    GetBlockDisplayWindowParams,
    GetBlockRowIdParams,
    GetBlockValuesParams,
    GetCellParams,
    GetDisplayWindowParams,
    GetDiyCellIdWithBlockIdParams,
    GetFullyCoveredBlocksParams,
    GetMergedCellsParams,
    GetSheetIdParams,
    GetSheetIdxParams,
    HandleTransactionParams,
    LoadWorkbookParams,
    LookupAppendixUpwardParams,
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
    constructor() {
        window.addEventListener('message', (e) => {
            const {m, result, id} = e.data
            if (m === GetCraftStateMethodName) {
                const state = this.getCraftState()
                e.source?.postMessage({
                    m: GetCraftStateMethodName,
                    id: id,
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
    stateChanged(): void {
        window.parent.postMessage({
            m: MethodName.StateUpdated,
            fromBlock: this._blockId,
        })
    }

    getCraftState(): CraftState {
        if (!this._getCraftState) {
            throw new Error('getCraftState is not set')
        }
        return this._getCraftState()
    }

    loadCraftState(blockId: BlockId, craftState: CraftState): void {
        if (!this._loadCraftState) {
            throw new Error('loadCraftState is not set')
        }
        this._blockId = blockId
        return this._loadCraftState(blockId, craftState)
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

    getSheetIdx(params: GetSheetIdxParams): Resp<number> {
        return this._call(MethodName.GetSheetIdx, params) as Resp<number>
    }

    getBlockValues(params: GetBlockValuesParams): Resp<readonly string[]> {
        return this._call(MethodName.GetBlockValues, params) as Resp<
            readonly string[]
        >
    }

    private _getMyBlockId(): BlockId {
        if (this._blockId) return this._blockId
        throw Error('block id has not been set before being used')
    }

    private _call(method: string, params?: any) {
        const id = this._requestId++
        window.parent.postMessage({
            m: method,
            args: params,
            id,
            fromBlock: this._getMyBlockId(),
        })
        return new Promise((resolve) => {
            this._resolvers.set(id, resolve)
        })
    }

    private _requestId = 0
    private _blockId!: BlockId
    private _resolvers: Map<number, (arg: any) => unknown> = new Map()
    private _cellUpdatedCallbacks: Callback[] = []
    private _sheetUpdatedCallbacks: Callback[] = []
    private _getCraftState?: () => CraftState
    private _loadCraftState?: (blockId: BlockId, state: CraftState) => void
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
    GetSheetIdx = 'agent_getSheetIdx',
    GetSheetId = 'agent_getSheetId',
    GetBlockValues = 'agent_getBlockValues',
    StateUpdated = 'agent_stateUpdated',
    LoadCraftStateMethodName = 'agent_loadCraftState',

    GetBlockDisplayWindow = 'agent_getBlockDisplayWindow',
    GetDiyCellIdWithBlockId = 'agent_getDiyCellIdWithBlockId',
    LookupAppendixUpward = 'agent_lookupAppendixUpward',
}
