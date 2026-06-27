/**
 * Workbook worker service - handles all workbook-related operations in a Web Worker.
 */
import { Workbook } from "logisheets-web";
import type { BlockInfo, CellInfo, CellPosition, DisplayWindowWithStartPoint, MergeCell, SheetDimension, SheetInfo, CellCoordinate, FormulaDisplayInfo, ActionEffect, Value, ReproducibleCell, AppendixWithCell, SheetCellId, ShadowCellInfo, BlockField, AppData, CellCoordinateWithSheet, BlockDataRow, TempStatusDiff, CellInput, PredictFillParams } from "logisheets-web";
import type { Result, IWorkbookWorker } from "./types";
export declare class WorkbookWorkerService implements IWorkbookWorker {
    private _ctx;
    constructor(_ctx: Worker);
    private _workbookImpl;
    init(): Promise<void>;
    get workbook(): Workbook;
    getWorkbook(): Workbook;
    isReady(): Result<boolean>;
    loadWorkbook(params: {
        content: Uint8Array;
        name: string;
    }): Result<void>;
    save(params: any): Result<any>;
    getAllSheetInfo(): Result<readonly SheetInfo[]>;
    getSheetDimension(sheetIdx: number): Result<SheetDimension>;
    getSheetIdx(params: {
        sheetId: number;
    }): Result<number>;
    getSheetId(params: {
        sheetIdx: number;
    }): Result<number>;
    getSheetNameByIdx(idx: number): Result<string>;
    private getSheet;
    getCell(params: {
        sheetIdx: number;
        row: number;
        col: number;
    }): Result<CellInfo>;
    getCells(params: {
        sheetIdx: number;
        startRow: number;
        startCol: number;
        endRow: number;
        endCol: number;
    }): Result<readonly CellInfo[]>;
    predictFill(params: PredictFillParams): Result<readonly CellInput[]>;
    getCellPosition(params: {
        sheetIdx: number;
        row: number;
        col: number;
    }): Result<CellPosition>;
    getCellId(params: any): Result<SheetCellId>;
    getValue(params: {
        sheetId: number;
        row: number;
        col: number;
    }): Result<Value>;
    getReproducibleCell(params: {
        sheetIdx: number;
        row: number;
        col: number;
    }): Result<ReproducibleCell>;
    getReproducibleCells(params: {
        sheetIdx: number;
        coordinates: any;
    }): Result<readonly ReproducibleCell[]>;
    batchGetCellInfoById(params: {
        ids: readonly SheetCellId[];
    }): Result<readonly CellInfo[]>;
    batchGetCellCoordinateWithSheetById(ids: readonly SheetCellId[]): Result<readonly CellCoordinateWithSheet[]>;
    getNextVisibleCell(args: {
        sheetIdx: number;
        rowIdx: number;
        colIdx: number;
        direction: "up" | "down" | "left" | "right";
    }): Result<CellCoordinate>;
    getDataBoundary(args: {
        sheetIdx: number;
        rowIdx: number;
        colIdx: number;
        direction: "up" | "down" | "left" | "right";
    }): Result<CellCoordinate>;
    getDisplayWindow(params: {
        sheetIdx: number;
        startX: number;
        startY: number;
        height: number;
        width: number;
    }): Result<DisplayWindowWithStartPoint>;
    getMergedCells(params: {
        sheetIdx: number;
        startRow: number;
        startCol: number;
        endRow: number;
        endCol: number;
    }): Result<readonly MergeCell[]>;
    getBlockInfo(params: {
        sheetId: number;
        blockId: number;
    }): Result<BlockInfo>;
    getBlockValues(params: {
        sheetId: number;
        blockId: number;
        rowIds: any;
        colIds: any;
    }): Result<readonly string[]>;
    getAvailableBlockId(params: {
        sheetIdx: number;
    }): Result<number>;
    getDiyCellIdWithBlockId(params: {
        sheetId: number;
        blockId: number;
        row: number;
        col: number;
    }): Result<number>;
    lookupAppendixUpward(params: {
        sheetId: number;
        blockId: number;
        row: number;
        col: number;
        craftId: string;
        tag: number;
    }): Result<AppendixWithCell>;
    getAllBlockFields(): Result<readonly BlockField[]>;
    getFullyCoveredBlocks(params: {
        sheetIdx: number;
        rowIdx: number;
        colIdx: number;
        rowCnt: number;
        colCnt: number;
    }): Result<readonly BlockInfo[]>;
    getShadowCellId(params: {
        sheetIdx: number;
        rowIdx: number;
        colIdx: number;
    }): Result<number>;
    getShadowCellIds(params: any): Result<readonly number[]>;
    getShadowInfoById(params: {
        shadowId: number;
    }): Result<ShadowCellInfo>;
    handleTransaction(params: {
        transaction: any;
        temp: boolean;
    }): Result<ActionEffect>;
    handleTransactionWithoutEvents(params: {
        transaction: any;
        temp: boolean;
    }): Result<ActionEffect>;
    undo(): Result<boolean>;
    redo(): Result<boolean>;
    cleanHistory(): Result<void>;
    commitTempStatus(): Result<void>;
    cleanupTempStatus(): Result<void>;
    toggleStatus(useTemp: boolean): Result<void>;
    getDisplayUnitsOfFormula(f: string): Result<FormulaDisplayInfo>;
    calcCondition(params: {
        sheetIdx: number;
        condition: any;
    }): Result<boolean>;
    getCellIdByBlockRef(params: {
        refName: string;
        key: string;
        field: string;
    }): Result<SheetCellId>;
    exportBlockData(params: {
        refName: string;
        keyFilter?: readonly string[];
        fieldFilter?: readonly string[];
    }): Result<readonly BlockDataRow[]>;
    getTempStatusChanges(): Result<TempStatusDiff>;
    checkFormula(params: {
        formula: string;
    }): boolean;
    getAppData(): Result<readonly AppData[]>;
    getAllBlocks(params: {
        sheetIdx?: number;
        sheetId?: number;
    }): Result<readonly BlockInfo[]>;
    getBlockRowId(params: {
        sheetId: number;
        blockId: number;
        rowIdx: number;
    }): Result<number>;
    getBlockColId(params: {
        sheetId: number;
        blockId: number;
        colIdx: number;
    }): Result<number>;
    saveCheckpoint(params: {
        label: string;
        description?: string;
    }): Result<number>;
    deleteCheckpoint(params: {
        label: string;
    }): Result<boolean>;
    listCheckpoints(): Result<ReadonlyArray<{
        label: string;
        description?: string;
    }>>;
    handleRequest(request: {
        m: string;
        args: any;
        id: number;
    }): Promise<void>;
}
