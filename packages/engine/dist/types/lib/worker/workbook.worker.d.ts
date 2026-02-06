/**
 * Workbook worker service - handles all workbook-related operations in a Web Worker.
 */
import { Workbook } from "logisheets-web";
import type { BlockInfo, CellInfo, CellPosition, DisplayWindowWithStartPoint, MergeCell, SheetDimension, SheetInfo, CellCoordinate, FormulaDisplayInfo, ActionEffect, Value, ReproducibleCell, AppendixWithCell, SheetCellId, ShadowCellInfo, BlockField, AppData, CellCoordinateWithSheet } from "logisheets-web";
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
    batchGetCellInfoById(ids: readonly SheetCellId[]): Result<readonly CellInfo[]>;
    batchGetCellCoordinateWithSheetById(ids: readonly SheetCellId[]): Result<readonly CellCoordinateWithSheet[]>;
    getNextVisibleCell(args: {
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
    getFullyCoveredBlocks(params: {
        sheetIdx: number;
        row: number;
        col: number;
        height: number;
        width: number;
    }): Result<readonly BlockInfo[]>;
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
    }): Result<void>;
    handleTransactionWithoutEvents(params: {
        transaction: any;
        temp: boolean;
    }): Result<ActionEffect>;
    undo(): Result<void>;
    redo(): Result<void>;
    commitTempStatus(): Result<void>;
    cleanupTempStatus(): Result<void>;
    toggleStatus(useTemp: boolean): Result<void>;
    getDisplayUnitsOfFormula(f: string): Result<FormulaDisplayInfo>;
    calcCondition(params: {
        sheetIdx: number;
        condition: any;
    }): Result<boolean>;
    checkFormula(params: {
        formula: string;
    }): boolean;
    getAppData(): Result<readonly AppData[]>;
    handleRequest(request: {
        m: string;
        args: any;
        id: number;
    }): Promise<void>;
}
