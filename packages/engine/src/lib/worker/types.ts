/**
 * Worker types and constants used for communication between main thread and workers.
 */

import type {
    BlockInfo,
    CellInfo,
    CellPosition,
    DisplayWindowWithStartPoint,
    ErrorMessage,
    SheetDimension,
    SheetInfo,
    MergeCell,
    ReproducibleCell,
    Value,
    FormulaDisplayInfo,
    BlockDisplayInfo,
    ActionEffect,
    CellCoordinate,
} from 'logisheets-web'

import type {Grid, AppropriateHeight} from '$types/index'
export type {AppropriateHeight} from '$types/index'

// ============================================================================
// Worker Update Events - Posted from worker to main thread
// ============================================================================

export const enum WorkerUpdate {
    Cell = 0,
    Sheet = 1,
    CellAndSheet = 2,
    Ready = 3,
    CellValueChanged = 4,
    CellRemoved = 5,
    /// Posted after a transaction whose payloads changed row/column
    /// dimensions on one or more sheets. `result` carries the affected
    /// sheet indices (readonly number[]).
    HeaderUpdated = 6,
}

// ============================================================================
// Workbook Worker Method Names
// ============================================================================

export enum MethodName {
    GetSheetDimension = 'getSheetDimension',
    GetDependents = 'getDependents',
    GetPrecedents = 'getPrecedents',
    GetAllSheetInfo = 'getAllSheetInfo',
    GetFormulaFunctionNames = 'getFormulaFunctionNames',
    GetDisplayWindow = 'getDisplayWindow',
    GetBlockDisplayWindow = 'getBlockDisplayWindow',
    GetCell = 'getCell',
    GetCellListValidation = 'getCellListValidation',
    GetCells = 'getCells',
    GetCellsExceptWindow = 'getCellsExceptWindow',
    PredictFill = 'predictFill',
    GetBlockInfo = 'getBlockInfo',
    GetCellPosition = 'getCellPosition',
    Undo = 'undo',
    Redo = 'redo',
    CleanHistory = 'cleanHistory',
    HandleTransaction = 'handleTransaction',
    HandleTransactionWithoutEvents = 'handleTransactionWithoutEvents',
    LoadWorkbook = 'loadWorkbook',
    IsReady = 'isReady',
    GetMergedCells = 'getMergedCells',
    GetComments = 'getComments',
    GetCellImages = 'getCellImages',
    CalcCondition = 'calcCondition',
    GetCellIdByBlockRef = 'getCellIdByBlockRef',

    ExportBlockData = 'exportBlockData',
    GetTempStatusChanges = 'getTempStatusChanges',
    CheckFormula = 'checkFormula',
    Save = 'save',

    CleanupTempStatus = 'cleanupTempStatus',
    ToggleStatus = 'toggleStatus',
    CommitTempStatus = 'commitTempStatus',
    BatchGetCellInfoById = 'batchGetCellInfoById',
    BatchGetCellCoordinateWithSheetById = 'batchGetCellCoordinateWithSheetById',
    GetSheetNameByIdx = 'getSheetNameByIdx',

    LookupAppendixUpward = 'lookupAppendixUpward',

    GetBlockRowId = 'getBlockRowId',
    GetBlockColId = 'getBlockColId',

    GetSheetIdx = 'getSheetIdx',
    GetSheetId = 'getSheetId',
    GetBlockValues = 'getBlockValues',
    GetAvailableBlockId = 'getAvailableBlockId',

    GetDiyCellIdWithBlockId = 'getDiyCellIdWithBlockId',

    GetReproducibleCell = 'getReproducibleCell',
    GetReproducibleCells = 'getReproducibleCells',
    GetCellValue = 'getCellValue',

    GetShadowCellId = 'getShadowCellId',
    GetShadowCellIds = 'getShadowCellIds',
    GetShadowInfoById = 'getShadowInfoById',
    GetCellId = 'getCellId',

    GetDisplayUnitsOfFormula = 'getDisplayUnitsOfFormula',

    GetNextVisibleCell = 'getNextVisibleCell',

    GetDataBoundary = 'getDataBoundary',

    GetAllBlockFields = 'getAllBlockFields',
    GetAppData = 'getAppData',
    GetFullyCoveredBlocks = 'getFullyCoveredBlocks',
    GetAllBlocks = 'getAllBlocks',
    SaveCheckpoint = 'saveCheckpoint',
    DeleteCheckpoint = 'deleteCheckpoint',
    ListCheckpoints = 'listCheckpoints',
}

// ============================================================================
// Offscreen Worker Method Names
// ============================================================================

export enum OffscreenRenderName {
    Render = 'render',
    Resize = 'resize',
    Init = 'init',
    Dispose = 'dispose',
    GetAppropriateHeights = 'getAppropriateHeights',
    SetGridLines = 'setGridLines',
}

// ============================================================================
// Worker Result Type
// ============================================================================

export type Result<T> = T | ErrorMessage

// ============================================================================
// Workbook Worker Interface
// ============================================================================

export interface IWorkbookWorker {
    isReady(): Result<boolean>
    getAllSheetInfo(): Result<readonly SheetInfo[]>
    getFormulaFunctionNames(): Result<readonly string[]>
    getDisplayWindow(params: any): Result<DisplayWindowWithStartPoint>
    getCell(params: any): Result<CellInfo>
    getCells(params: any): Result<readonly CellInfo[]>
    getReproducibleCell(params: any): Result<ReproducibleCell>
    getReproducibleCells(params: any): Result<readonly ReproducibleCell[]>
    getValue(params: any): Result<Value>
    getBlockInfo(params: any): Result<BlockInfo>
    getCellPosition(params: any): Result<CellPosition>
    getSheetDimension(sheetIdx: number): Result<SheetDimension>
    undo(): Result<boolean>
    redo(): Result<boolean>
    handleTransaction(params: any): Result<ActionEffect>
    loadWorkbook(params: any): Result<void>
    getSheetIdx(params: any): Result<number>
    getBlockValues(params: any): Result<readonly string[]>
    getAvailableBlockId(params: any): Result<number>
    getSheetId(params: any): Result<number>
    getDisplayUnitsOfFormula(f: string): Result<FormulaDisplayInfo>
    getWorkbook(): any
}

// ============================================================================
// Offscreen Worker Interface
// ============================================================================

export interface IOffscreenWorker {
    render(
        canvasId: number,
        sheetId: number,
        anchorX: number,
        anchorY: number
    ): Result<Grid>
    resize(
        canvasId: number,
        width: number,
        height: number,
        dpr: number
    ): Result<Grid>
    init(canvasId: number, canvas: OffscreenCanvas, dpr: number): void
    getAppropriateHeights(
        canvasId: number,
        sheetId: number,
        anchorX: number,
        anchorY: number
    ): Result<AppropriateHeight[]>
}

// ============================================================================
// Worker Request/Response Types
// ============================================================================

export interface WorkerRequest {
    id: number
    m: string
    args?: any
}

export interface WorkerResponse {
    id: number
    result?: any
    error?: any
}

export interface OffscreenRequest {
    rid: number
    m: string
    args?: any
}

export interface OffscreenResponse {
    rid: number
    result?: any
    error?: any
}
