import type {
    SheetDimension,
    SheetInfo,
    DisplayWindowWithStartPoint,
    CellPosition,
    BlockInfo,
    MergeCell,
    ErrorMessage,
} from './bindings'
import type {Cell, CustomFunc} from './api'
import type {Transaction} from './transactions'

export type Resp<T> = Promise<T | ErrorMessage>

/**
 * The client is the interface for the workbook. This is used when the workbook
 * is wrapped by a server.
 */
export interface Client {
    isReady(): Promise<void>
    getSheetDimension(sheetIdx: number): Resp<SheetDimension>
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

    getMergedCells(params: GetMergedCellsParams): Resp<readonly MergeCell[]>
    calcCondition(params: CalcConditionParams): Resp<boolean>
}

export interface GetAllSheetInfoParams {}

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

export interface HandleTransactionParams {
    transaction: Transaction
}

export interface LoadWorkbookParams {
    content: Uint8Array
    name: string
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
