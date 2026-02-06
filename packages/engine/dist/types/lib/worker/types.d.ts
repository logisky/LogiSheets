/**
 * Worker types and constants used for communication between main thread and workers.
 */
import type { BlockInfo, CellInfo, CellPosition, DisplayWindowWithStartPoint, ErrorMessage, SheetDimension, SheetInfo, ReproducibleCell, Value, FormulaDisplayInfo } from "logisheets-web";
import type { Grid, AppropriateHeight } from "$types/index";
export type { AppropriateHeight } from "$types/index";
export declare const enum WorkerUpdate {
    Cell = 0,
    Sheet = 1,
    CellAndSheet = 2,
    Ready = 3,
    CellValueChanged = 4,
    CellRemoved = 5
}
export declare enum MethodName {
    GetSheetDimension = "getSheetDimension",
    GetFullyCoveredBlocks = "getFullyCoveredBlocks",
    GetAllSheetInfo = "getAllSheetInfo",
    GetDisplayWindow = "getDisplayWindow",
    GetBlockDisplayWindow = "getBlockDisplayWindow",
    GetCell = "getCell",
    GetCells = "getCells",
    GetCellsExceptWindow = "getCellsExceptWindow",
    GetBlockInfo = "getBlockInfo",
    GetCellPosition = "getCellPosition",
    Undo = "undo",
    Redo = "redo",
    HandleTransaction = "handleTransaction",
    HandleTransactionWithoutEvents = "handleTransactionWithoutEvents",
    LoadWorkbook = "loadWorkbook",
    IsReady = "isReady",
    GetMergedCells = "getMergedCells",
    CalcCondition = "calcCondition",
    CheckFormula = "checkFormula",
    Save = "save",
    CleanupTempStatus = "cleanupTempStatus",
    ToggleStatus = "toggleStatus",
    CommitTempStatus = "commitTempStatus",
    BatchGetCellInfoById = "batchGetCellInfoById",
    BatchGetCellCoordinateWithSheetById = "batchGetCellCoordinateWithSheetById",
    GetSheetNameByIdx = "getSheetNameByIdx",
    LookupAppendixUpward = "lookupAppendixUpward",
    GetBlockRowId = "getBlockRowId",
    GetBlockColId = "getBlockColId",
    GetSheetIdx = "getSheetIdx",
    GetSheetId = "getSheetId",
    GetBlockValues = "getBlockValues",
    GetAvailableBlockId = "getAvailableBlockId",
    GetDiyCellIdWithBlockId = "getDiyCellIdWithBlockId",
    GetReproducibleCell = "getReproducibleCell",
    GetReproducibleCells = "getReproducibleCells",
    GetCellValue = "getCellValue",
    GetShadowCellId = "getShadowCellId",
    GetShadowCellIds = "getShadowCellIds",
    GetShadowInfoById = "getShadowInfoById",
    GetCellId = "getCellId",
    GetDisplayUnitsOfFormula = "getDisplayUnitsOfFormula",
    GetNextVisibleCell = "getNextVisibleCell",
    GetAllBlockFields = "getAllBlockFields",
    GetAppData = "getAppData"
}
export declare enum OffscreenRenderName {
    Render = "render",
    Resize = "resize",
    Init = "init",
    GetAppropriateHeights = "getAppropriateHeights",
    SetLicense = "setLicense",
    ClearLicense = "clearLicense"
}
export type Result<T> = T | ErrorMessage;
export interface IWorkbookWorker {
    isReady(): Result<boolean>;
    getAllSheetInfo(): Result<readonly SheetInfo[]>;
    getDisplayWindow(params: any): Result<DisplayWindowWithStartPoint>;
    getCell(params: any): Result<CellInfo>;
    getCells(params: any): Result<readonly CellInfo[]>;
    getReproducibleCell(params: any): Result<ReproducibleCell>;
    getReproducibleCells(params: any): Result<readonly ReproducibleCell[]>;
    getValue(params: any): Result<Value>;
    getBlockInfo(params: any): Result<BlockInfo>;
    getCellPosition(params: any): Result<CellPosition>;
    getSheetDimension(sheetIdx: number): Result<SheetDimension>;
    getFullyCoveredBlocks(params: any): Result<readonly BlockInfo[]>;
    undo(): Result<void>;
    redo(): Result<void>;
    handleTransaction(params: any): Result<void>;
    loadWorkbook(params: any): Result<void>;
    getSheetIdx(params: any): Result<number>;
    getBlockValues(params: any): Result<readonly string[]>;
    getAvailableBlockId(params: any): Result<number>;
    getSheetId(params: any): Result<number>;
    getDisplayUnitsOfFormula(f: string): Result<FormulaDisplayInfo>;
    getWorkbook(): any;
}
export interface IOffscreenWorker {
    render(sheetId: number, anchorX: number, anchorY: number): Result<Grid>;
    resize(width: number, height: number, dpr: number): Result<Grid>;
    init(canvas: OffscreenCanvas, dpr: number): void;
    getAppropriateHeights(sheetId: number, anchorX: number, anchorY: number): Result<AppropriateHeight[]>;
}
export interface WorkerRequest {
    id: number;
    m: string;
    args?: any;
}
export interface WorkerResponse {
    id: number;
    result?: any;
    error?: any;
}
export interface OffscreenRequest {
    rid: number;
    m: string;
    args?: any;
}
export interface OffscreenResponse {
    rid: number;
    result?: any;
    error?: any;
}
