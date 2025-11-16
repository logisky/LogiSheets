import type {
    SheetDimension,
    SheetInfo,
    DisplayWindowWithStartPoint,
    CellPosition,
    BlockInfo,
    MergeCell,
    ErrorMessage,
    DisplayWindow,
    AppendixWithCell,
    ReproducibleCell,
    SheetCoordinate,
    Value,
    CellInfo,
    SheetCellId,
    ShadowCellInfo,
    FormulaDisplayInfo,
    CellCoordinate,
    BlockField,
    SaveFileResult,
} from './bindings'
import type {CustomFunc} from './api'
import type {Transaction, RowId, ColId} from './types'

export type Resp<T> = Promise<T | ErrorMessage>

/**
 * The client is the interface for the workbook. This is used when the workbook
 * is wrapped by a server.
 */
export interface Client {
    isReady(): Promise<void>
    getDisplayUnitsOfFormula(f: string): Resp<FormulaDisplayInfo>
    getSheetDimension(sheetIdx: number): Resp<SheetDimension>
    getAllSheetInfo(params: GetAllSheetInfoParams): Resp<readonly SheetInfo[]>
    getDisplayWindow(
        params: GetDisplayWindowParams
    ): Resp<DisplayWindowWithStartPoint>
    getCell(params: GetCellParams): Resp<CellInfo>
    getCells(params: GetCellsParams): Resp<readonly CellInfo[]>
    getCellsExceptWindow(
        params: GetCellsExceptWindowParams
    ): Resp<readonly CellInfo[]>
    getReproducibleCell(
        params: GetReproducibleCellParams
    ): Resp<ReproducibleCell>
    getReproducibleCells(
        params: GetReproducibleCellsParams
    ): Resp<readonly ReproducibleCell[]>
    getValue(params: GetCellValueParams): Resp<Value>
    getBlockInfo(params: GetBlockInfoParams): Resp<BlockInfo>
    getCellPosition(params: GetCellParams): Resp<CellPosition>
    getFullyCoveredBlocks(
        params: GetFullyCoveredBlocksParams
    ): Resp<readonly BlockInfo[]>

    undo(): Resp<void>
    redo(): Resp<void>
    handleTransaction(params: HandleTransactionParams): Resp<void>

    loadWorkbook(params: LoadWorkbookParams): Resp<void>
    save(params: SaveParams): Resp<SaveFileResult>

    getCellId(params: GetCellIdParams): Resp<SheetCellId>

    registerCustomFunc(f: CustomFunc): void
    registerCellUpdatedCallback(f: () => void): void
    registerSheetUpdatedCallback(f: () => void): void

    registerCellValueChangedCallback(
        sheetIdx: number,
        rowIdx: number,
        colIdx: number,
        callback: () => void
    ): Resp<void>

    registerCellRemovedCallback(
        sheetIdx: number,
        rowIdx: number,
        colIdx: number,
        callback: () => void
    ): Resp<void>

    registerShadowCellValueChangedCallback(
        sheetIdx: number,
        rowIdx: number,
        colIdx: number,
        callback: () => void
    ): Resp<number>

    getMergedCells(params: GetMergedCellsParams): Resp<readonly MergeCell[]>
    calcCondition(params: CalcConditionParams): Resp<boolean>

    getBlockDisplayWindow(
        params: GetBlockDisplayWindowParams
    ): Resp<DisplayWindow>
    getBlockRowId(params: GetBlockRowIdParams): Resp<RowId>
    getBlockColId(params: GetBlockColIdParams): Resp<ColId>
    getSheetIdx(params: GetSheetIdxParams): Resp<number>
    getSheetId(params: GetSheetIdParams): Resp<number>
    getBlockValues(params: GetBlockValuesParams): Resp<readonly string[]>
    getShadowCellId(params: GetShadowCellIdParams): Resp<SheetCellId>
    getShadowCellIds(
        params: GetShadowCellIdsParams
    ): Resp<readonly SheetCellId[]>
    getShadowInfoById(params: GetShadowInfoByIdParams): Resp<ShadowCellInfo>

    getDiyCellIdWithBlockId(params: GetDiyCellIdWithBlockIdParams): Resp<number>

    lookupAppendixUpward(
        params: LookupAppendixUpwardParams
    ): Resp<AppendixWithCell>

    getNextVisibleCell(params: GetNextVisibleCellParams): Resp<CellCoordinate>
    getAllBlockFields(): Resp<readonly BlockField[]>
}

export interface GetAllSheetInfoParams {}

export interface GetDiyCellIdWithBlockIdParams {
    sheetId: number
    blockId: number
    row: number
    col: number
}

export interface CalcConditionParams {
    sheetIdx: number
    condition: string
}

export interface GetDisplayWindowParams {
    sheetIdx: number
    startX: number
    startY: number
    height: number
    width: number
}

export interface GetDisplayWindowWithPositionParams {
    sheetIdx: number
    row: number
    col: number
    height: number
    width: number
}

export interface GetCellParams {
    sheetIdx: number
    row: number
    col: number
}

export interface GetBlockInfoParams {
    sheetId: number
    blockId: number
}

export interface GetCellValueParams {
    sheetId: number
    row: number
    col: number
}

export interface GetReproducibleCellParams {
    sheetIdx: number
    row: number
    col: number
}

export interface GetReproducibleCellsParams {
    sheetIdx: number
    coordinates: readonly SheetCoordinate[]
}

export interface GetCellsParams {
    sheetIdx: number
    startRow: number
    startCol: number
    endRow: number
    endCol: number
}

export interface GetCellsExceptWindowParams {
    sheetIdx: number
    startRow: number
    startCol: number
    endRow: number
    endCol: number
    windowStartRow: number
    windowStartCol: number
    windowEndRow: number
    windowEndCol: number
}

export interface HandleTransactionParams {
    transaction: Transaction
}

export interface LoadWorkbookParams {
    content: Uint8Array
    name: string
}

export interface SaveParams {
    appData: string
}

export interface MessageResp<T> {
    result: T
    id: number
}

export interface GetFullyCoveredBlocksParams {
    sheetIdx: number
    row: number
    col: number
    height: number
    width: number
}

export const enum WorkerUpdate {
    Cell = 0,
    Sheet = 1,
    CellAndSheet = 2,
    Ready = 3,
}

export interface GetMergedCellsParams {
    sheetIdx: number
    startRow: number
    startCol: number
    endRow: number
    endCol: number
}

export interface GetBlockRowIdParams {
    sheetId: number
    blockId: number
    rowIdx: number
}

export interface GetBlockColIdParams {
    sheetId: number
    blockId: number
    colIdx: number
}

export interface GetSheetIdxParams {
    sheetId: number
}

export interface GetSheetIdParams {
    sheetIdx: number
}

export interface GetBlockValuesParams {
    sheetId: number
    blockId: number
    rowIds: readonly RowId[]
    colIds: readonly ColId[]
}

export interface GetAvailableBlockIdParams {
    sheetIdx: number
}
export interface GetBlockDisplayWindowParams {
    sheetId: number
    blockId: number
}

export interface LookupAppendixUpwardParams {
    sheetId: number
    blockId: number
    row: number
    col: number
    craftId: string
    tag: number
}

export interface GetShadowCellIdParams {
    sheetIdx: number
    rowIdx: number
    colIdx: number
}

export interface GetShadowCellIdsParams {
    sheetIdx: number
    rowIdx: readonly number[]
    colIdx: readonly number[]
}

export interface GetShadowInfoByIdParams {
    shadowId: number
}

export interface GetCellIdParams {
    sheetIdx: number
    rowIdx: number
    colIdx: number
}

export interface GetNextVisibleCellParams {
    sheetIdx: number
    rowIdx: number
    colIdx: number
    direction: 'up' | 'down' | 'left' | 'right'
}
