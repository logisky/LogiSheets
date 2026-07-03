/**
 * Workbook worker service - handles all workbook-related operations in a Web Worker.
 */

import { initWasm, Workbook, Worksheet } from "logisheets-web";

import type {
  BlockInfo,
  CellInfo,
  CellPosition,
  DisplayWindowWithStartPoint,
  MergeCell,
  Comment,
  SheetDimension,
  SheetInfo,
  CellCoordinate,
  FormulaDisplayInfo,
  ActionEffect,
  Value,
  ReproducibleCell,
  AppendixWithCell,
  SheetCellId,
  ShadowCellInfo,
  BlockField,
  AppData,
  CellCoordinateWithSheet,
  BlockDataRow,
  TempStatusDiff,
  CellInput,
  PredictFillParams,
} from "logisheets-web";

import { WorkerUpdate, MethodName } from "./types";
import type { Result, IWorkbookWorker } from "./types";

export class WorkbookWorkerService implements IWorkbookWorker {
  constructor(private _ctx: Worker) {}

  private _workbookImpl: Workbook | undefined;

  // ========================================================================
  // Initialization
  // ========================================================================

  public async init(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (initWasm as any)();
    this._workbookImpl = new Workbook();
    this._workbookImpl.registerCellUpdatedCallback(() => {
      this._ctx.postMessage({ id: WorkerUpdate.Cell });
    });
    this._workbookImpl.registerSheetInfoUpdateCallback(() => {
      this._ctx.postMessage({ id: WorkerUpdate.Sheet });
    });
    this._workbookImpl.registerHeaderUpdatedCallback((sheetIdxes) => {
      this._ctx.postMessage({
        id: WorkerUpdate.HeaderUpdated,
        result: sheetIdxes,
      });
    });
    // Inform the client that service is ready
    this._ctx.postMessage({ id: WorkerUpdate.Ready });
  }

  public get workbook(): Workbook {
    if (!this._workbookImpl) throw Error("haven't been initialized");
    return this._workbookImpl;
  }

  public getWorkbook(): Workbook {
    return this.workbook;
  }

  // ========================================================================
  // Basic Operations
  // ========================================================================

  public isReady(): Result<boolean> {
    return this._workbookImpl !== undefined;
  }

  public loadWorkbook(params: {
    content: Uint8Array;
    name: string;
  }): Result<void> {
    this._workbookImpl?.load(params.content, params.name);
    return;
  }

  public save(params: any): Result<any> {
    return this._workbookImpl!.save(params.appData);
  }

  // ========================================================================
  // Sheet Operations
  // ========================================================================

  public getAllSheetInfo(): Result<readonly SheetInfo[]> {
    return this.workbook.getAllSheetInfo();
  }

  public getSheetDimension(sheetIdx: number): Result<SheetDimension> {
    const ws = this.getSheet(sheetIdx);
    return ws.getSheetDimension();
  }

  public getSheetIdx(params: { sheetId: number }): Result<number> {
    return this.workbook.getSheetIdx(params.sheetId);
  }

  public getSheetId(params: { sheetIdx: number }): Result<number> {
    return this.workbook.getSheetId(params.sheetIdx);
  }

  public getSheetNameByIdx(idx: number): Result<string> {
    return this.workbook.getSheetNameByIdx(idx);
  }

  private getSheet(idx: number): Worksheet {
    return this.workbook.getWorksheet(idx);
  }

  // ========================================================================
  // Cell Operations
  // ========================================================================

  public getCell(params: {
    sheetIdx: number;
    row: number;
    col: number;
  }): Result<CellInfo> {
    const ws = this.getSheet(params.sheetIdx);
    return ws.getCellInfo(params.row, params.col);
  }

  public getCells(params: {
    sheetIdx: number;
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  }): Result<readonly CellInfo[]> {
    const ws = this.getSheet(params.sheetIdx);
    return ws.getCellInfos(
      params.startRow,
      params.startCol,
      params.endRow,
      params.endCol,
    );
  }

  public predictFill(params: PredictFillParams): Result<readonly CellInput[]> {
    const ws = this.getSheet(params.sheetIdx);
    return ws.predictFill(
      {
        startRow: params.srcStartRow,
        startCol: params.srcStartCol,
        endRow: params.srcEndRow,
        endCol: params.srcEndCol,
      },
      {
        startRow: params.dstStartRow,
        startCol: params.dstStartCol,
        endRow: params.dstEndRow,
        endCol: params.dstEndCol,
      },
    );
  }

  public getCellPosition(params: {
    sheetIdx: number;
    row: number;
    col: number;
  }): Result<CellPosition> {
    const ws = this.getSheet(params.sheetIdx);
    return ws.getCellPosition(params.row, params.col);
  }

  public getCellId(params: any): Result<SheetCellId> {
    return this.workbook.getCellId(params);
  }

  public getValue(params: {
    sheetId: number;
    row: number;
    col: number;
  }): Result<Value> {
    const ws = this._workbookImpl!.getWorksheetById(params.sheetId);
    return ws.getValue(params.row, params.col);
  }

  public getReproducibleCell(params: {
    sheetIdx: number;
    row: number;
    col: number;
  }): Result<ReproducibleCell> {
    const ws = this.getSheet(params.sheetIdx);
    return ws.getReproducibleCell(params.row, params.col);
  }

  public getReproducibleCells(params: {
    sheetIdx: number;
    coordinates: any;
  }): Result<readonly ReproducibleCell[]> {
    const ws = this.getSheet(params.sheetIdx);
    return ws.getReproducibleCells(params.coordinates);
  }

  public batchGetCellInfoById(params: {
    ids: readonly SheetCellId[];
  }): Result<readonly CellInfo[]> {
    return this.workbook.batchGetCellInfoById(params.ids);
  }

  public batchGetCellCoordinateWithSheetById(
    ids: readonly SheetCellId[],
  ): Result<readonly CellCoordinateWithSheet[]> {
    return this.workbook.batchGetCellCoordinateWithSheetById(ids);
  }

  public getNextVisibleCell(args: {
    sheetIdx: number;
    rowIdx: number;
    colIdx: number;
    direction: "up" | "down" | "left" | "right";
  }): Result<CellCoordinate> {
    const ws = this.workbook.getWorksheet(args.sheetIdx);
    switch (args.direction) {
      case "up":
        return ws.getNextUpwardVisibleCell(args.rowIdx, args.colIdx);
      case "down":
        return ws.getNextDownwardVisibleCell(args.rowIdx, args.colIdx);
      case "left":
        return ws.getNextLeftwardVisibleCell(args.rowIdx, args.colIdx);
      case "right":
        return ws.getNextRightwardVisibleCell(args.rowIdx, args.colIdx);
    }
  }

  public getDataBoundary(args: {
    sheetIdx: number;
    rowIdx: number;
    colIdx: number;
    direction: "up" | "down" | "left" | "right";
  }): Result<CellCoordinate> {
    const ws = this.workbook.getWorksheet(args.sheetIdx);
    switch (args.direction) {
      case "up":
        return ws.getUpwardDataBoundary(args.rowIdx, args.colIdx);
      case "down":
        return ws.getDownwardDataBoundary(args.rowIdx, args.colIdx);
      case "left":
        return ws.getLeftwardDataBoundary(args.rowIdx, args.colIdx);
      case "right":
        return ws.getRightwardDataBoundary(args.rowIdx, args.colIdx);
    }
  }

  // ========================================================================
  // Display Window Operations
  // ========================================================================

  public getDisplayWindow(params: {
    sheetIdx: number;
    startX: number;
    startY: number;
    height: number;
    width: number;
  }): Result<DisplayWindowWithStartPoint> {
    const ws = this.workbook.getWorksheet(params.sheetIdx);
    return ws.getDisplayWindowWithStartPoint(
      params.startX,
      params.startY,
      params.height,
      params.width,
    );
  }

  public getMergedCells(params: {
    sheetIdx: number;
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  }): Result<readonly MergeCell[]> {
    const ws = this.getSheet(params.sheetIdx);
    return ws.getMergedCells(
      params.startRow,
      params.startCol,
      params.endRow,
      params.endCol,
    );
  }

  public getComments(params: {
    sheetIdx: number;
  }): Result<readonly Comment[]> {
    return this.getSheet(params.sheetIdx).getComments();
  }

  // ========================================================================
  // Block Operations
  // ========================================================================

  public getBlockInfo(params: {
    sheetId: number;
    blockId: number;
  }): Result<BlockInfo> {
    const ws = this.workbook.getWorksheetById(params.sheetId);
    return ws.getBlockInfo(params.blockId);
  }

  public getBlockValues(params: {
    sheetId: number;
    blockId: number;
    rowIds: any;
    colIds: any;
  }): Result<readonly string[]> {
    return this.workbook.getBlockValues(params);
  }

  public getAvailableBlockId(params: { sheetIdx: number }): Result<number> {
    return this.workbook.getAvailableBlockId(params);
  }

  public getDiyCellIdWithBlockId(params: {
    sheetId: number;
    blockId: number;
    row: number;
    col: number;
  }): Result<number> {
    const ws = this.workbook.getWorksheetById(params.sheetId);
    return ws.getDiyCellIdWithBlockId(params.blockId, params.row, params.col);
  }

  public lookupAppendixUpward(params: {
    sheetId: number;
    blockId: number;
    row: number;
    col: number;
    craftId: string;
    tag: number;
  }): Result<AppendixWithCell> {
    const ws = this.workbook.getWorksheetById(params.sheetId);
    return ws.lookupAppendixUpward(
      params.blockId,
      params.row,
      params.col,
      params.craftId,
      params.tag,
    );
  }

  public getAllBlockFields(): Result<readonly BlockField[]> {
    return this.workbook.getAllBlockFields();
  }

  public getFullyCoveredBlocks(params: {
    sheetIdx: number;
    rowIdx: number;
    colIdx: number;
    rowCnt: number;
    colCnt: number;
  }): Result<readonly BlockInfo[]> {
    const ws = this.workbook.getWorksheet(params.sheetIdx);
    return ws.getFullyCoveredBlocks(
      params.rowIdx,
      params.colIdx,
      params.rowCnt,
      params.colCnt,
    );
  }

  // ========================================================================
  // Shadow Cell Operations
  // ========================================================================

  public getShadowCellId(params: {
    sheetIdx: number;
    rowIdx: number;
    colIdx: number;
  }): Result<number> {
    return this.workbook.getShadowCellId(params);
  }

  public getShadowCellIds(params: any): Result<readonly number[]> {
    return this.workbook.getShadowCellIds(params);
  }

  public getShadowInfoById(params: {
    shadowId: number;
  }): Result<ShadowCellInfo> {
    return this.workbook.getShadowInfoById(params);
  }

  // ========================================================================
  // Transaction Operations
  // ========================================================================

  public handleTransaction(params: {
    transaction: any;
    temp: boolean;
  }): Result<ActionEffect> {
    const result = this.workbook.execTransaction(params.transaction);
    result.valueChanged.forEach((cellId: any) => {
      this._ctx.postMessage({
        id: WorkerUpdate.CellValueChanged,
        result: cellId,
      });
    });
    result.cellRemoved.forEach((cellId: any) => {
      this._ctx.postMessage({
        id: WorkerUpdate.CellRemoved,
        result: cellId,
      });
    });
    // Return the ActionEffect so callers can inspect `.status` — the old
    // `return;` dropped it, which broke any client that followed the
    // generated Client contract (e.g. `result.status.type`).
    return result;
  }

  public handleTransactionWithoutEvents(params: {
    transaction: any;
    temp: boolean;
  }): Result<ActionEffect> {
    return this.workbook.execTransaction(params.transaction);
  }

  public undo(): Result<boolean> {
    return this.workbook.undo();
  }

  public redo(): Result<boolean> {
    return this.workbook.redo();
  }

  // Clear the undo/redo history. The bundled logisheets-web may predate this
  // workbook method; optional-chain so it's a safe no-op until the dependency
  // is bumped and the web wasm rebuilt.
  public cleanHistory(): Result<void> {
    return (this.workbook as any).cleanHistory?.();
  }

  // ========================================================================
  // Status Operations
  // ========================================================================

  public commitTempStatus(): Result<void> {
    this.workbook.commitTempStatus();
    this._ctx.postMessage({ id: WorkerUpdate.CellAndSheet });
  }

  public cleanupTempStatus(): Result<void> {
    this.workbook.cleanupTempStatus();
    this._ctx.postMessage({ id: WorkerUpdate.CellAndSheet });
  }

  public toggleStatus(useTemp: boolean): Result<void> {
    return this.workbook.toggleStatus(useTemp);
  }

  // ========================================================================
  // Formula Operations
  // ========================================================================

  public getDisplayUnitsOfFormula(f: string): Result<FormulaDisplayInfo> {
    return this.workbook.getDisplayUnitsOfFormula(f);
  }

  public calcCondition(params: {
    sheetIdx: number;
    condition: any;
  }): Result<boolean> {
    return this.workbook.calcCondition(params.sheetIdx, params.condition);
  }

  public getCellIdByBlockRef(params: {
    refName: string;
    key: string;
    field: string;
  }): Result<SheetCellId> {
    return this.workbook.getCellIdByBlockRef(
      params.refName,
      params.key,
      params.field,
    );
  }

  public exportBlockData(params: {
    refName: string;
    keyFilter?: readonly string[];
    fieldFilter?: readonly string[];
  }): Result<readonly BlockDataRow[]> {
    return this.workbook.exportBlockData(
      params.refName,
      params.keyFilter,
      params.fieldFilter,
    );
  }

  public getTempStatusChanges(): Result<TempStatusDiff> {
    return this.workbook.getTempStatusChanges();
  }

  public checkFormula(params: { formula: string }): boolean {
    return this.workbook.checkFormula(params.formula);
  }

  // ========================================================================
  // App Data Operations
  // ========================================================================

  public getAppData(): Result<readonly AppData[]> {
    return this._workbookImpl!.getAppData();
  }

  // ========================================================================
  // Block / Checkpoint Operations (Client conformance)
  // ========================================================================

  public getAllBlocks(params: {
    sheetIdx?: number;
    sheetId?: number;
  }): Result<readonly BlockInfo[]> {
    return this.workbook.getAllBlocks(params);
  }

  public getBlockRowId(params: {
    sheetId: number;
    blockId: number;
    rowIdx: number;
  }): Result<number> {
    return this.workbook.getBlockRowId(
      params.sheetId,
      params.blockId,
      params.rowIdx,
    );
  }

  public getBlockColId(params: {
    sheetId: number;
    blockId: number;
    colIdx: number;
  }): Result<number> {
    return this.workbook.getBlockColId(
      params.sheetId,
      params.blockId,
      params.colIdx,
    );
  }

  public saveCheckpoint(params: {
    label: string;
    description?: string;
  }): Result<number> {
    return this.workbook.saveCheckpoint(params.label, params.description);
  }

  public deleteCheckpoint(params: { label: string }): Result<boolean> {
    return this.workbook.deleteCheckpoint(params.label);
  }

  public listCheckpoints(): Result<
    ReadonlyArray<{ label: string; description?: string }>
  > {
    return this.workbook.listCheckpoints();
  }

  // ========================================================================
  // Request Handler
  // ========================================================================

  public async handleRequest(request: {
    m: string;
    args: any;
    id: number;
  }): Promise<void> {
    const { m, args, id } = request;

    if (!this._workbookImpl) {
      this._ctx.postMessage({
        error: "WorkbookService not initialized",
        id,
      });
      return;
    }

    // Skip internal update IDs
    if (
      id === WorkerUpdate.Ready ||
      id === WorkerUpdate.Cell ||
      id === WorkerUpdate.CellAndSheet ||
      id === WorkerUpdate.Sheet
    ) {
      return;
    }

    let result;
    try {
      switch (m) {
        case MethodName.IsReady:
          result = this.isReady();
          break;
        case MethodName.HandleTransaction:
          result = this.handleTransaction(args);
          break;
        case MethodName.HandleTransactionWithoutEvents:
          result = this.handleTransactionWithoutEvents(args);
          break;
        case MethodName.GetAllSheetInfo:
          result = this.getAllSheetInfo();
          break;
        case MethodName.Undo:
          result = this.undo();
          break;
        case MethodName.Redo:
          result = this.redo();
          break;
        case MethodName.CleanHistory:
          result = this.cleanHistory();
          break;
        case MethodName.GetDisplayWindow:
          result = this.getDisplayWindow(args);
          break;
        case MethodName.GetCellPosition:
          result = this.getCellPosition(args);
          break;
        case MethodName.GetCell:
          result = this.getCell(args);
          break;
        case MethodName.GetCells:
          result = this.getCells(args);
          break;
        case MethodName.PredictFill:
          result = this.predictFill(args);
          break;
        case MethodName.LoadWorkbook:
          result = this.loadWorkbook(args);
          break;
        case MethodName.GetSheetDimension:
          result = this.getSheetDimension(args);
          break;
        case MethodName.GetMergedCells:
          result = this.getMergedCells(args);
          break;
        case MethodName.GetComments:
          result = this.getComments(args);
          break;
        case MethodName.CalcCondition:
          result = this.calcCondition(args);
          break;
        case MethodName.GetCellIdByBlockRef:
          result = this.getCellIdByBlockRef(args);
          break;
        case MethodName.ExportBlockData:
          result = this.exportBlockData(args);
          break;
        case MethodName.GetTempStatusChanges:
          result = this.getTempStatusChanges();
          break;
        case MethodName.CheckFormula:
          result = this.checkFormula(args);
          break;
        case MethodName.GetBlockValues:
          result = this.getBlockValues(args);
          break;
        case MethodName.GetAvailableBlockId:
          result = this.getAvailableBlockId(args);
          break;
        case MethodName.GetSheetId:
          result = this.getSheetId(args);
          break;
        case MethodName.GetSheetIdx:
          result = this.getSheetIdx(args);
          break;
        case MethodName.GetBlockInfo:
          result = this.getBlockInfo(args);
          break;
        case MethodName.GetReproducibleCell:
          result = this.getReproducibleCell(args);
          break;
        case MethodName.GetReproducibleCells:
          result = this.getReproducibleCells(args);
          break;
        case MethodName.LookupAppendixUpward:
          result = this.lookupAppendixUpward(args);
          break;
        case MethodName.GetCellValue:
          result = this.getValue(args);
          break;
        case MethodName.GetShadowCellId:
          result = this.getShadowCellId(args);
          break;
        case MethodName.GetShadowCellIds:
          result = this.getShadowCellIds(args);
          break;
        case MethodName.GetShadowInfoById:
          result = this.getShadowInfoById(args);
          break;
        case MethodName.GetCellId:
          result = this.getCellId(args);
          break;
        case MethodName.GetDisplayUnitsOfFormula:
          result = this.getDisplayUnitsOfFormula(args);
          break;
        case MethodName.GetNextVisibleCell:
          result = this.getNextVisibleCell(args);
          break;
        case MethodName.GetDataBoundary:
          result = this.getDataBoundary(args);
          break;
        case MethodName.Save:
          result = this.save(args);
          break;
        case MethodName.GetAllBlockFields:
          result = this.getAllBlockFields();
          break;
        case MethodName.GetFullyCoveredBlocks:
          result = this.getFullyCoveredBlocks(args);
          break;
        case MethodName.GetAppData:
          result = this.getAppData();
          break;
        case MethodName.BatchGetCellInfoById:
          result = this.batchGetCellInfoById(args);
          break;
        case MethodName.ToggleStatus:
          result = this.toggleStatus(args);
          break;
        case MethodName.CommitTempStatus:
          result = this.commitTempStatus();
          break;
        case MethodName.CleanupTempStatus:
          result = this.cleanupTempStatus();
          break;
        case MethodName.GetSheetNameByIdx:
          result = this.getSheetNameByIdx(args);
          break;
        case MethodName.BatchGetCellCoordinateWithSheetById:
          result = this.batchGetCellCoordinateWithSheetById(args);
          break;
        case MethodName.GetDiyCellIdWithBlockId:
          result = this.getDiyCellIdWithBlockId(args);
          break;
        case MethodName.GetAllBlocks:
          result = this.getAllBlocks(args);
          break;
        case MethodName.GetBlockRowId:
          result = this.getBlockRowId(args);
          break;
        case MethodName.GetBlockColId:
          result = this.getBlockColId(args);
          break;
        case MethodName.SaveCheckpoint:
          result = this.saveCheckpoint(args);
          break;
        case MethodName.DeleteCheckpoint:
          result = this.deleteCheckpoint(args);
          break;
        case MethodName.ListCheckpoints:
          result = this.listCheckpoints();
          break;
        default:
          throw new Error(`Unknown method: ${m}`);
      }
    } catch (error) {
      this._ctx.postMessage({ error: String(error), id });
      return;
    }

    this._ctx.postMessage({ result, id });
  }
}
