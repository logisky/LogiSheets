/**
 * DataService - main service for interacting with the spreadsheet engine.
 * Combines WorkbookClient and OffscreenClient functionality.
 */
import type { SheetInfo, SheetDimension, MergeCell, Transaction, ErrorMessage, CellInput } from "logisheets-web";
import { Cell } from "logisheets-web";
import { WorkbookClient } from "./workbook";
import type { Grid } from "$types/index";
type Resp<T> = Promise<T | ErrorMessage>;
export declare class DataService {
    private _workbook;
    private _offscreen;
    private _sheetInfos;
    private _sheetUpdateCallback;
    private _activeSheetIdx;
    private _activeSheetId;
    private _lastRender;
    constructor(worker: Worker);
    private _init;
    render(sheetId: number, anchorX: number, anchorY: number, canvasId?: number): Resp<Grid>;
    resize(width: number, height: number, dpr: number, canvasId?: number): Resp<Grid>;
    initOffscreen(canvas: OffscreenCanvas, canvasId?: number): Resp<void>;
    setLicense(apiKey: string): Resp<{
        valid: boolean;
        reason?: string;
    }>;
    clearLicense(): void;
    /**
     * Show/hide the default cell gridlines. The setting is worker-global; the
     * caller (Engine.setShowGridLines) re-renders the mounted views.
     */
    setShowGridLines(horizontal: boolean, vertical: boolean): void;
    loadWorkbook(buf: Uint8Array, name: string, canvasId?: number): Resp<Grid>;
    getSheetIdByIdx(idx: number): number;
    getSheetNameByIdx(idx: number): string;
    setCurrentSheetIdx(idx: number): void;
    getCurrentSheetIdx(): number;
    getCurrentSheetId(): number;
    getCurrentSheetName(): string;
    getCacheAllSheetInfo(): readonly SheetInfo[];
    getSheetDimension(sheetIdx: number): Resp<SheetDimension>;
    getCellInfo(sheetIdx: number, row: number, col: number): Resp<Cell>;
    getMergedCells(sheetIdx: number, targetStartRow: number, targetStartCol: number, targetEndRow: number, targetEndCol: number): Resp<readonly MergeCell[]>;
    getAvailableBlockId(sheetIdx: number): Resp<number>;
    checkFormula(formula: string): Promise<boolean>;
    handleTransaction(transaction: Transaction, temp?: boolean): Resp<void>;
    /**
     * Predict-only fill: ask the engine what each target cell should
     * receive, without committing. Used to render the drag preview.
     */
    predictFill(sheetIdx: number, src: {
        startRow: number;
        startCol: number;
        endRow: number;
        endCol: number;
    }, dst: {
        startRow: number;
        startCol: number;
        endRow: number;
        endCol: number;
    }): Resp<readonly CellInput[]>;
    private _fillParams;
    /**
     * Fill-handle commit: predict the contents for `dst` from source block
     * `src`, then apply them as a single undoable transaction (so the whole
     * drag is one undo step and flows through the normal event pipeline).
     */
    fill(sheetIdx: number, src: {
        startRow: number;
        startCol: number;
        endRow: number;
        endCol: number;
    }, dst: {
        startRow: number;
        startCol: number;
        endRow: number;
        endCol: number;
    }): Resp<void>;
    handleTransactionAndAdjustRowHeights(transaction: Transaction, onlyIncrease?: boolean, fromRowIdx?: number, toRowIdx?: number): Resp<void>;
    undo(): Resp<void>;
    redo(): Resp<void>;
    getWorkbook(): WorkbookClient;
    registerSheetUpdatedCallback(f: () => void): () => void;
    registerCellUpdatedCallback(f: () => void, callbackId?: number): () => void;
    registerHeaderUpdatedCallback(f: (sheetIdxes: readonly number[]) => void): () => void;
    /**
     * Release a view's OffscreenCanvas in the worker. Call when a view
     * unmounts so the worker's canvas map doesn't leak.
     */
    disposeOffscreen(canvasId: number): void;
}
export {};
