/**
 * Workbook Client - communicates with the worker for workbook operations.
 */
import type { SheetInfo, CellInfo, CellPosition, SheetDimension, MergeCell, BlockInfo, FormulaDisplayInfo, CellCoordinate, SheetCellId, Callback, CellIdCallback, ErrorMessage, AppData, BlockField } from "logisheets-web";
type Resp<T> = Promise<T | ErrorMessage>;
export declare class WorkbookClient {
    private _worker;
    private _resolvers;
    private _id;
    private _ready;
    private _cellUpdatedCallbacks;
    private _sheetUpdatedCallbacks;
    private _cellValueChangedCallbacks;
    private _cellRemovedCallbacks;
    constructor(worker: Worker);
    getAllSheetInfo(): Resp<readonly SheetInfo[]>;
    getSheetDimension(sheetIdx: number): Resp<SheetDimension>;
    getSheetIdx(params: {
        sheetId: number;
    }): Resp<number>;
    getSheetId(params: {
        sheetIdx: number;
    }): Resp<number>;
    getSheetNameByIdx(idx: number): Resp<string>;
    getCell(params: {
        sheetIdx: number;
        row: number;
        col: number;
    }): Resp<CellInfo>;
    getCells(params: {
        sheetIdx: number;
        startRow: number;
        startCol: number;
        endRow: number;
        endCol: number;
    }): Resp<readonly CellInfo[]>;
    getCellPosition(params: {
        sheetIdx: number;
        row: number;
        col: number;
    }): Resp<CellPosition>;
    getCellId(params: {
        sheetIdx: number;
        rowIdx: number;
        colIdx: number;
    }): Resp<SheetCellId>;
    getNextVisibleCell(params: {
        sheetIdx: number;
        rowIdx: number;
        colIdx: number;
        direction: "up" | "down" | "left" | "right";
    }): Resp<CellCoordinate>;
    getBlockInfo(params: {
        sheetId: number;
        blockId: number;
    }): Resp<BlockInfo>;
    getFullyCoveredBlocks(params: {
        sheetIdx: number;
        row: number;
        col: number;
        height: number;
        width: number;
    }): Resp<readonly BlockInfo[]>;
    getAvailableBlockId(params: {
        sheetIdx: number;
    }): Resp<number>;
    getMergedCells(params: {
        sheetIdx: number;
        startRow: number;
        startCol: number;
        endRow: number;
        endCol: number;
    }): Resp<readonly MergeCell[]>;
    handleTransaction(params: {
        transaction: any;
        temp: boolean;
    }): Resp<void>;
    handleTransactionWithoutEvents(params: {
        transaction: any;
        temp: boolean;
    }): Resp<any>;
    undo(): Resp<void>;
    redo(): Resp<void>;
    loadWorkbook(params: {
        content: Uint8Array;
        name: string;
    }): Resp<void>;
    save(params: {
        appData?: string;
    }): Resp<any>;
    getDisplayUnitsOfFormula(f: string): Resp<FormulaDisplayInfo>;
    checkFormula(params: {
        formula: string;
    }): Resp<boolean>;
    getAppData(): Resp<readonly AppData[]>;
    getAllBlockFields(): Resp<readonly BlockField[]>;
    getShadowCellId(params: {
        sheetIdx: number;
        rowIdx: number;
        colIdx: number;
    }): Resp<SheetCellId>;
    registerCellUpdatedCallback(f: Callback, _callbackId?: number): void;
    registerSheetUpdatedCallback(f: Callback): void;
    registerCellValueChangedCallback(sheetIdx: number, rowIdx: number, colIdx: number, callback: CellIdCallback): Resp<void>;
    private _call;
}
export {};
