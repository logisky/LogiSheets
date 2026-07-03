/**
 * DataService - main service for interacting with the spreadsheet engine.
 * Combines WorkbookClient and OffscreenClient functionality.
 */

import type {
  SheetInfo,
  SheetDimension,
  MergeCell,
  BlockInfo,
  CellInfo,
  Callback,
  Transaction,
  Payload,
  SetRowHeightBuilder,
  ErrorMessage,
  CellInput,
} from "logisheets-web";
import { isErrorMessage, Cell } from "logisheets-web";
import { WorkbookClient } from "./workbook";
import { OffscreenClient } from "./offscreen";
import type { Grid } from "$types/index";

type Resp<T> = Promise<T | ErrorMessage>;
type SheetId = number;

/**
 * Host-provided gate invoked before a workbook load replaces the one currently
 * open. Return `false` to abort the load (e.g. the user declined an overwrite
 * confirmation). When no gate is registered the load always proceeds, so
 * headless callers (the Node runtime) are unaffected.
 */
export type BeforeLoadWorkbook = () => boolean | Promise<boolean>;

/**
 * Sentinel `ErrorMessage.msg` returned by {@link DataService.loadWorkbook} when
 * a registered {@link BeforeLoadWorkbook} gate vetoes the load. It is a
 * user-initiated cancellation, not a failure — surface it as a silent no-op
 * (use {@link isLoadCancelled}) rather than an error.
 */
export const WORKBOOK_LOAD_CANCELLED = "__workbook_load_cancelled__";

/** Whether `v` is the {@link WORKBOOK_LOAD_CANCELLED} sentinel. */
export function isLoadCancelled(v: unknown): boolean {
  return isErrorMessage(v) && v.msg === WORKBOOK_LOAD_CANCELLED;
}

export class DataService {
  private _workbook: WorkbookClient;
  private _offscreen: OffscreenClient;
  private _sheetInfos: readonly SheetInfo[] = [];
  private _sheetUpdateCallback: Callback[] = [];
  private _beforeLoad?: BeforeLoadWorkbook;

  // Legacy "active view" sheet pointer. Rendering is per-canvas (each view
  // passes its own sheetId), so this is NOT on the render path — it's a
  // convenience for app-level consumers (toolbar, edit bar, …) that act on
  // "the sheet the user is currently looking at". The mounted view keeps it
  // updated as the user switches sheets.
  private _activeSheetIdx = 0;
  private _activeSheetId = 0;

  // Last render across any canvas (last-write-wins). Used only by the
  // app-level handleTransactionAndAdjustRowHeights helper to know which
  // sheet/anchor/canvas to repaint after an event-less transaction.
  private _lastRender = {
    sheetId: 0,
    anchorX: 0,
    anchorY: 0,
    canvasId: 0,
  };

  constructor(worker: Worker) {
    this._workbook = new WorkbookClient(worker);
    this._offscreen = new OffscreenClient(worker);
    this._init();
  }

  // ========================================================================
  // Initialization
  // ========================================================================

  private _init(): void {
    this._workbook.getAllSheetInfo().then((v) => {
      if (!isErrorMessage(v)) this._sheetInfos = v;
    });
    this._workbook.registerSheetUpdatedCallback(() => {
      this._workbook.getAllSheetInfo().then((v) => {
        if (!isErrorMessage(v)) this._sheetInfos = v;
        this._sheetUpdateCallback.forEach((f) => f());
      });
    });
  }

  // ========================================================================
  // Rendering
  // ========================================================================

  public async render(
    sheetId: number,
    anchorX: number,
    anchorY: number,
    canvasId = 0,
  ): Resp<Grid> {
    return this._offscreen.render(canvasId, sheetId, anchorX, anchorY).then((v) => {
      if (!isErrorMessage(v)) {
        this._lastRender = {sheetId, anchorX, anchorY, canvasId};
      }
      return v;
    });
  }

  public async resize(
    width: number,
    height: number,
    dpr: number,
    canvasId = 0,
  ): Resp<Grid> {
    return this._offscreen.resize(canvasId, width, height, dpr);
  }

  public initOffscreen(canvas: OffscreenCanvas, canvasId = 0): Resp<void> {
    return this._offscreen.init(canvasId, canvas, window.devicePixelRatio);
  }

  /**
   * Show/hide the default cell gridlines. The setting is worker-global; the
   * caller (Engine.setShowGridLines) re-renders the mounted views.
   */
  public setShowGridLines(horizontal: boolean, vertical: boolean): void {
    this._offscreen.setGridLines(horizontal, vertical);
  }

  // ========================================================================
  // File Operations
  // ========================================================================

  /**
   * Register a gate invoked before every {@link loadWorkbook}. Loading a
   * workbook discards the one currently open, so the host can use this to
   * confirm the overwrite with the user. Pass `undefined` to clear it. Every
   * load path (UI file-open, the engine demo, crafts) funnels through
   * `loadWorkbook`, so a single gate here covers them all.
   */
  public setBeforeLoadWorkbook(handler?: BeforeLoadWorkbook): void {
    this._beforeLoad = handler;
  }

  public async loadWorkbook(
    buf: Uint8Array,
    name: string,
    canvasId = 0,
  ): Resp<Grid> {
    if (this._beforeLoad) {
      const proceed = await this._beforeLoad();
      if (!proceed) return { msg: WORKBOOK_LOAD_CANCELLED, ty: 0 };
    }
    await this._workbook.loadWorkbook({ content: buf, name });
    // The previous workbook's _sheetInfos cache is now stale. The
    // worker-side sheetUpdated event isn't guaranteed to fire on load, so
    // re-pull the sheet list ourselves before anyone (the render call
    // below, the cellUpdated clamp in Spreadsheet.svelte, or any view's
    // getSheetIdByIdx) reads the cache. Without this, switching to a
    // sheet that exists in the new workbook but not in the stale cache
    // silently no-ops, and the next cell edit clamps activeSheet back
    // to 0.
    const sheets = await this._workbook.getAllSheetInfo();
    if (!isErrorMessage(sheets)) {
      this._sheetInfos = sheets;
    }
    // Notify host-side subscribers (mounted Spreadsheet, SheetsTab) so
    // their sheet lists rehydrate against the new workbook.
    this._activeSheetIdx = 0;
    this._activeSheetId = this._sheetInfos[0]?.id ?? 0;
    this._sheetUpdateCallback.forEach((f) => f());
    return this._offscreen.render(canvasId, this._sheetInfos[0]?.id ?? 0, 0, 0);
  }

  // ========================================================================
  // Sheet Operations (stateless lookups over the shared sheet-info cache)
  //
  // "Current sheet" is a per-view concept and lives on the Session / mounted
  // component, NOT here — multiple views share one DataService. These helpers
  // only translate a view's sheet index into the shared id/name.
  // ========================================================================

  public getSheetIdByIdx(idx: number): number {
    return this._sheetInfos[idx]?.id ?? 0;
  }

  public getSheetNameByIdx(idx: number): string {
    return this._sheetInfos[idx]?.name ?? "";
  }

  // --- Legacy active-view pointer (see _activeSheetIdx above) -------------

  public setCurrentSheetIdx(idx: number): void {
    if (idx >= this._sheetInfos.length) return;
    this._activeSheetIdx = idx;
    this._activeSheetId = this._sheetInfos[idx].id;
  }

  public getCurrentSheetIdx(): number {
    return this._activeSheetIdx;
  }

  public getCurrentSheetId(): number {
    return this._activeSheetId;
  }

  public getCurrentSheetName(): string {
    return this._sheetInfos[this._activeSheetIdx]?.name ?? "";
  }

  public getCacheAllSheetInfo(): readonly SheetInfo[] {
    return this._sheetInfos;
  }

  public getSheetDimension(sheetIdx: number): Resp<SheetDimension> {
    return this._workbook.getSheetDimension(sheetIdx);
  }

  // ========================================================================
  // Cell Operations
  // ========================================================================

  public getCellInfo(sheetIdx: number, row: number, col: number): Resp<Cell> {
    return this._workbook.getCell({ sheetIdx, row, col }).then((v) => {
      if (!isErrorMessage(v)) return new Cell(v);
      return v;
    });
  }

  public getMergedCells(
    sheetIdx: number,
    targetStartRow: number,
    targetStartCol: number,
    targetEndRow: number,
    targetEndCol: number,
  ): Resp<readonly MergeCell[]> {
    return this._workbook.getMergedCells({
      startRow: targetStartRow,
      endRow: targetEndRow,
      startCol: targetStartCol,
      endCol: targetEndCol,
      sheetIdx,
    });
  }

  // ========================================================================
  // Block Operations
  // ========================================================================

  public getAvailableBlockId(sheetIdx: number): Resp<number> {
    return this._workbook.getAvailableBlockId({ sheetIdx });
  }

  // ========================================================================
  // Formula Operations
  // ========================================================================

  public async checkFormula(formula: string): Promise<boolean> {
    const result = await this._workbook.checkFormula({ formula });
    if (typeof result === "boolean") {
      return result;
    }
    return false;
  }

  // ========================================================================
  // Transaction Operations
  // ========================================================================

  public async handleTransaction(
    transaction: Transaction,
    temp = false,
  ): Resp<void> {
    const r = await this._workbook.handleTransaction({ transaction, temp });
    if (isErrorMessage(r)) return r;
    return;
  }

  /**
   * Predict-only fill: ask the engine what each target cell should
   * receive, without committing. Used to render the drag preview.
   */
  public async predictFill(
    sheetIdx: number,
    src: { startRow: number; startCol: number; endRow: number; endCol: number },
    dst: { startRow: number; startCol: number; endRow: number; endCol: number },
  ): Resp<readonly CellInput[]> {
    return this._workbook.predictFill(this._fillParams(sheetIdx, src, dst));
  }

  private _fillParams(
    sheetIdx: number,
    src: { startRow: number; startCol: number; endRow: number; endCol: number },
    dst: { startRow: number; startCol: number; endRow: number; endCol: number },
  ) {
    return {
      sheetIdx,
      srcStartRow: src.startRow,
      srcStartCol: src.startCol,
      srcEndRow: src.endRow,
      srcEndCol: src.endCol,
      dstStartRow: dst.startRow,
      dstStartCol: dst.startCol,
      dstEndRow: dst.endRow,
      dstEndCol: dst.endCol,
    };
  }

  /**
   * Fill-handle commit: predict the contents for `dst` from source block
   * `src`, then apply them as a single undoable transaction (so the whole
   * drag is one undo step and flows through the normal event pipeline).
   */
  public async fill(
    sheetIdx: number,
    src: { startRow: number; startCol: number; endRow: number; endCol: number },
    dst: { startRow: number; startCol: number; endRow: number; endCol: number },
  ): Resp<void> {
    const inputs = await this._workbook.predictFill(
      this._fillParams(sheetIdx, src, dst),
    );
    if (isErrorMessage(inputs)) return inputs;
    const payloads: Payload[] = inputs.map((value) => ({
      type: "cellInput",
      value,
    }));
    return this.handleTransaction({ payloads, undoable: true, temp: false });
  }

  public async handleTransactionAndAdjustRowHeights(
    transaction: Transaction,
    onlyIncrease = false,
    fromRowIdx?: number,
    toRowIdx?: number,
  ): Resp<void> {
    const {sheetId, anchorX, anchorY, canvasId} = this._lastRender;
    const affectResult = await this._workbook.handleTransactionWithoutEvents({
      transaction,
      temp: false,
    });
    if (isErrorMessage(affectResult)) {
      await this._offscreen.render(canvasId, sheetId, anchorX, anchorY);
      return;
    }
    const heights = await this._offscreen.getAppropriateHeights(
      canvasId,
      sheetId,
      anchorX,
      anchorY,
    );
    if (isErrorMessage(heights)) {
      await this._offscreen.render(canvasId, sheetId, anchorX, anchorY);
      return;
    }
    // Note: SetRowHeightBuilder would need to be imported from logisheets-web
    // This is simplified for the migration
    return;
  }

  public async undo(): Resp<void> {
    const r = await this._workbook.undo();
    if (isErrorMessage(r)) return r;
    return;
  }

  public async redo(): Resp<void> {
    const r = await this._workbook.redo();
    if (isErrorMessage(r)) return r;
    return;
  }

  // ========================================================================
  // Workbook Access
  // ========================================================================

  public getWorkbook(): WorkbookClient {
    return this._workbook;
  }

  // ========================================================================
  // Callbacks
  // ========================================================================

  // All register* methods return a disposer that unregisters the callback.
  // Views must call it on unmount, otherwise a torn-down view keeps being
  // notified (and re-rendering into a released canvas).

  public registerSheetUpdatedCallback(f: () => void): () => void {
    this._sheetUpdateCallback.push(f);
    return () => {
      const i = this._sheetUpdateCallback.indexOf(f);
      if (i >= 0) this._sheetUpdateCallback.splice(i, 1);
    };
  }

  public registerCellUpdatedCallback(
    f: () => void,
    callbackId?: number,
  ): () => void {
    return this._workbook.registerCellUpdatedCallback(f, callbackId);
  }

  public registerHeaderUpdatedCallback(
    f: (sheetIdxes: readonly number[]) => void,
  ): () => void {
    return this._workbook.registerHeaderUpdatedCallback(f);
  }

  /**
   * Release a view's OffscreenCanvas in the worker. Call when a view
   * unmounts so the worker's canvas map doesn't leak.
   */
  public disposeOffscreen(canvasId: number): void {
    this._offscreen.dispose(canvasId);
  }
}
