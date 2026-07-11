/**
 * Workbook Client - communicates with the worker for workbook operations.
 */

import type {
  SheetInfo,
  CellInfo,
  CellPosition,
  SheetDimension,
  MergeCell,
  BlockInfo,
  Comment,
  FormulaDisplayInfo,
  CellCoordinate,
  SheetCellId,
  Callback,
  CellIdCallback,
  ErrorMessage,
  AppData,
  BlockField,
  TempStatusDiff,
  ShadowCellInfo,
  Client,
  CellImageInfo,
  ActionEffect,
  CellInput,
  PredictFillParams,
  BlockDataRow,
} from "logisheets-web";
import { isErrorMessage } from "logisheets-web";
import { WorkerUpdate, MethodName } from "../worker/types";
import type { Grid } from "$types/index";

type Resp<T> = Promise<T | ErrorMessage>;

function sheetCellIdToString(id: SheetCellId | number): string {
  if (typeof id === "number") return String(id);
  return `${id.sheetId}-${JSON.stringify(id.cellId)}`;
}

function removeFromArray<T>(arr: T[], item: T): void {
  const i = arr.indexOf(item);
  if (i >= 0) arr.splice(i, 1);
}

export class WorkbookClient implements Client {
  private _worker: Worker;
  private _resolvers: Map<number, (arg: any) => void> = new Map();
  private _id = 100;
  private _ready = false;

  private _cellUpdatedCallbacks: Callback[] = [];
  private _sheetUpdatedCallbacks: Callback[] = [];
  private _headerUpdatedCallbacks: Array<
    (sheetIdxes: readonly number[]) => void
  > = [];
  private _cellValueChangedCallbacks: Map<string, CellIdCallback[]> = new Map();
  private _cellRemovedCallbacks: Map<string, CellIdCallback[]> = new Map();

  constructor(worker: Worker) {
    this._worker = worker;
    this._worker.onmessage = (e) => {
      const data = e.data;
      const { result, id } = data;

      if (id === WorkerUpdate.Cell) {
        this._cellUpdatedCallbacks.forEach((f) => f());
      } else if (id === WorkerUpdate.Sheet) {
        this._sheetUpdatedCallbacks.forEach((f) => f());
      } else if (id === WorkerUpdate.CellAndSheet) {
        this._sheetUpdatedCallbacks.forEach((f) => f());
        this._cellUpdatedCallbacks.forEach((f) => f());
      } else if (id === WorkerUpdate.HeaderUpdated) {
        const sheetIdxes = (result ?? []) as readonly number[];
        this._headerUpdatedCallbacks.forEach((f) => f(sheetIdxes));
      } else if (id === WorkerUpdate.Ready) {
        if (!this._ready) {
          this._ready = true;
          const r = this._resolvers.get(id);
          if (r) r(result);
        }
      } else if (id === WorkerUpdate.CellValueChanged) {
        const cellIdStr = sheetCellIdToString(result);
        this._cellValueChangedCallbacks.get(cellIdStr)?.forEach((f) => {
          f(result);
        });
      } else if (id === WorkerUpdate.CellRemoved) {
        const cellIdStr = sheetCellIdToString(result);
        this._cellRemovedCallbacks.get(cellIdStr)?.forEach((f) => {
          f(result);
        });
      }

      const resolver = this._resolvers.get(id);
      if (resolver) {
        resolver(result);
      }
      this._resolvers.delete(id);
    };
  }

  // ========================================================================
  // Sheet Operations
  // ========================================================================

  getAllSheetInfo(): Resp<readonly SheetInfo[]> {
    return this._call(MethodName.GetAllSheetInfo) as Resp<readonly SheetInfo[]>;
  }

  getFormulaFunctionNames(): Resp<readonly string[]> {
    return this._call(MethodName.GetFormulaFunctionNames) as Resp<
      readonly string[]
    >;
  }

  // Accepts the generated params-object (contract) or the raw sheet index
  // (legacy in-app callers). Normalized to the index the worker expects.
  getSheetDimension(
    params: Parameters<Client["getSheetDimension"]>[0] | number,
  ): Resp<SheetDimension> {
    const idx = typeof params === "number" ? params : params.sheetId;
    return this._call(MethodName.GetSheetDimension, idx) as Resp<SheetDimension>;
  }

  getSheetIdx(params: { sheetId: number }): Resp<number> {
    return this._call(MethodName.GetSheetIdx, params) as Resp<number>;
  }

  getSheetId(params: { sheetIdx: number }): Resp<number> {
    return this._call(MethodName.GetSheetId, params) as Resp<number>;
  }

  getSheetNameByIdx(
    params: Parameters<Client["getSheetNameByIdx"]>[0] | number,
  ): Resp<string> {
    const idx = typeof params === "number" ? params : params.idx;
    return this._call(MethodName.GetSheetNameByIdx, idx) as Resp<string>;
  }

  // ========================================================================
  // Cell Operations
  // ========================================================================

  getCell(params: {
    sheetIdx: number;
    row: number;
    col: number;
  }): Resp<CellInfo> {
    return this._call(MethodName.GetCell, params) as Resp<CellInfo>;
  }

  getCellListValidation(params: {
    sheetIdx: number;
    row: number;
    col: number;
  }): Resp<readonly string[] | undefined> {
    return this._call(MethodName.GetCellListValidation, params) as Resp<
      readonly string[] | undefined
    >;
  }

  getCells(params: {
    sheetIdx: number;
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  }): Resp<readonly CellInfo[]> {
    return this._call(MethodName.GetCells, params) as Resp<readonly CellInfo[]>;
  }

  getCellPosition(params: {
    sheetIdx: number;
    row: number;
    col: number;
  }): Resp<CellPosition> {
    return this._call(MethodName.GetCellPosition, params) as Resp<CellPosition>;
  }

  predictFill(params: PredictFillParams): Resp<readonly CellInput[]> {
    return this._call(MethodName.PredictFill, params) as Resp<
      readonly CellInput[]
    >;
  }

  getCellId(params: {
    sheetIdx: number;
    rowIdx: number;
    colIdx: number;
  }): Resp<SheetCellId> {
    return this._call(MethodName.GetCellId, params) as Resp<SheetCellId>;
  }

  batchGetCellInfoById(params: {
    ids: readonly SheetCellId[];
  }): Resp<readonly CellInfo[]> {
    return this._call(MethodName.BatchGetCellInfoById, params) as Resp<
      readonly CellInfo[]
    >;
  }

  getNextVisibleCell(params: {
    sheetIdx: number;
    rowIdx: number;
    colIdx: number;
    direction: "up" | "down" | "left" | "right";
  }): Resp<CellCoordinate> {
    return this._call(
      MethodName.GetNextVisibleCell,
      params,
    ) as Resp<CellCoordinate>;
  }

  // Ctrl+Arrow: jump to the next data/block boundary. Resolves to an
  // ErrorMessage when there is no boundary ahead (caller shows a hint).
  getDataBoundary(params: {
    sheetIdx: number;
    rowIdx: number;
    colIdx: number;
    direction: "up" | "down" | "left" | "right";
  }): Resp<CellCoordinate> {
    return this._call(
      MethodName.GetDataBoundary,
      params,
    ) as Resp<CellCoordinate>;
  }

  // ========================================================================
  // Block Operations
  // ========================================================================

  getBlockInfo(params: { sheetId: number; blockId: number }): Resp<BlockInfo> {
    return this._call(MethodName.GetBlockInfo, params) as Resp<BlockInfo>;
  }

  getAvailableBlockId(params: { sheetIdx: number }): Resp<number> {
    return this._call(MethodName.GetAvailableBlockId, params) as Resp<number>;
  }

  /**
   * Enumerate blocks fully contained in a row/col range. Use a large
   * range (e.g. derived from `getSheetDimension`) to enumerate every
   * block on the sheet — useful for "jump to" lookups that need block
   * schemas before any rendering has populated them into a Grid.
   */
  getFullyCoveredBlocks(params: {
    sheetIdx: number;
    rowIdx: number;
    colIdx: number;
    rowCnt: number;
    colCnt: number;
  }): Resp<readonly BlockInfo[]> {
    return this._call(MethodName.GetFullyCoveredBlocks, params) as Resp<
      readonly BlockInfo[]
    >;
  }

  /**
   * Resolve a (refName, key, field) triple to a concrete cell id — same
   * lookup the BLOCKREF formula does at evaluation time. Pair with
   * `registerCellValueChangedCallback` to subscribe by block ref instead
   * of (sheet, row, col).
   */
  getCellIdByBlockRef(params: {
    refName: string;
    key: string;
    field: string;
  }): Resp<SheetCellId> {
    return this._call(
      MethodName.GetCellIdByBlockRef,
      params,
    ) as Resp<SheetCellId>;
  }

  // Export a block's data as a row-per-key, column-per-field value matrix.
  // Columns follow the schema's field order (filtered); pair with field
  // metadata from the field manager on the caller side.
  exportBlockData(params: {
    refName: string;
    keyFilter?: readonly string[];
    fieldFilter?: readonly string[];
  }): Resp<readonly BlockDataRow[]> {
    return this._call(
      MethodName.ExportBlockData,
      params,
    ) as Resp<readonly BlockDataRow[]>;
  }

  /**
   * Snapshot of all cell-value differences between the active temp
   * branch and the committed (fork) status. Used by the diff layer.
   */
  getTempStatusChanges(): Resp<TempStatusDiff> {
    return this._call(MethodName.GetTempStatusChanges) as Resp<TempStatusDiff>;
  }

  // ========================================================================
  // Merged Cells
  // ========================================================================

  getMergedCells(params: {
    sheetIdx: number;
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  }): Resp<readonly MergeCell[]> {
    return this._call(MethodName.GetMergedCells, params) as Resp<
      readonly MergeCell[]
    >;
  }

  getComments(params: { sheetIdx: number }): Resp<readonly Comment[]> {
    return this._call(MethodName.GetComments, params) as Resp<
      readonly Comment[]
    >;
  }

  getCellImages(params: {
    sheetIdx: number;
  }): Resp<readonly CellImageInfo[]> {
    return this._call(MethodName.GetCellImages, params) as Resp<
      readonly CellImageInfo[]
    >;
  }

  // ========================================================================
  // Transaction Operations
  // ========================================================================

  /**
   * Host-side observers that get every payload flowing through
   * {@link handleTransaction} (or its no-events sibling). Used so the
   * host can react to schema-shaping payloads — e.g. auto-stamping
   * `bindFormSchema.refName` onto FieldManager — without crafts having
   * to call a second API.
   *
   * Observers run synchronously *before* the payload is forwarded to the
   * worker. They must not throw (errors are caught & logged) and should
   * stay fast — they sit on the critical path of every transaction.
   */
  private _payloadObservers: Set<(payload: any) => void> = new Set();
  registerPayloadObserver(fn: (payload: any) => void): () => void {
    this._payloadObservers.add(fn);
    return () => {
      this._payloadObservers.delete(fn);
    };
  }
  private _notifyPayloadObservers(params: {
    transaction?: { payloads?: readonly any[] };
  }): void {
    const payloads = params.transaction?.payloads;
    if (!payloads || this._payloadObservers.size === 0) return;
    for (const p of payloads) {
      for (const obs of this._payloadObservers) {
        try {
          obs(p);
        } catch (e) {
          console.warn("payload observer threw:", e);
        }
      }
    }
  }

  handleTransaction(params: {
    transaction: any;
    temp: boolean;
  }): Resp<ActionEffect> {
    this._notifyPayloadObservers(params);
    return this._call(
      MethodName.HandleTransaction,
      params,
    ) as Resp<ActionEffect>;
  }

  handleTransactionWithoutEvents(params: {
    transaction: any;
    temp: boolean;
  }): Resp<any> {
    this._notifyPayloadObservers(params);
    return this._call(
      MethodName.HandleTransactionWithoutEvents,
      params,
    ) as Resp<any>;
  }

  undo(): Resp<boolean> {
    return this._call(MethodName.Undo) as Resp<boolean>;
  }

  redo(): Resp<boolean> {
    return this._call(MethodName.Redo) as Resp<boolean>;
  }

  cleanHistory(): Resp<void> {
    return this._call(MethodName.CleanHistory) as Resp<void>;
  }

  // The underlying worker (mirroring logisheets-web's Workbook) does not
  // surface the ActionEffect for a commit; the promise resolves with no
  // payload. Typed per the Client contract; callers must not depend on the
  // resolved value here.
  commitTempStatus(): Resp<ActionEffect> {
    return this._call(MethodName.CommitTempStatus) as Resp<ActionEffect>;
  }

  cleanupTempStatus(): Resp<void> {
    return this._call(MethodName.CleanupTempStatus) as Resp<void>;
  }

  // ========================================================================
  // File Operations
  // ========================================================================

  loadWorkbook(params: { content: Uint8Array; name: string }): Resp<void> {
    return this._call(MethodName.LoadWorkbook, params) as Resp<void>;
  }

  save(params: { appData?: string }): Resp<any> {
    return this._call(MethodName.Save, params) as Resp<any>;
  }

  // ========================================================================
  // Formula Operations
  // ========================================================================

  getDisplayUnitsOfFormula(
    params: Parameters<Client["getDisplayUnitsOfFormula"]>[0] | string,
  ): Resp<FormulaDisplayInfo> {
    const formula = typeof params === "string" ? params : params.formula;
    return this._call(
      MethodName.GetDisplayUnitsOfFormula,
      formula,
    ) as Resp<FormulaDisplayInfo>;
  }

  checkFormula(params: { formula: string }): Resp<boolean> {
    return this._call(MethodName.CheckFormula, params) as Resp<boolean>;
  }

  // ========================================================================
  // App Data & Block Fields
  // ========================================================================

  getAppData(): Resp<readonly AppData[]> {
    return this._call(MethodName.GetAppData) as Resp<readonly AppData[]>;
  }

  getAllBlockFields(): Resp<readonly BlockField[]> {
    return this._call(MethodName.GetAllBlockFields) as Resp<
      readonly BlockField[]
    >;
  }

  getShadowCellId(params: {
    sheetIdx: number;
    rowIdx: number;
    colIdx: number;
    /**
     * Which derived computation this shadow represents. Optional for
     * backward compatibility — omitting it defaults to the
     * long-standing Validation kind. Other kinds (e.g. `'userEditable'`)
     * let widgets request their own per-cell shadow without colliding
     * with validation's slot.
     */
    kind?: "validation" | "userEditable";
  }): Resp<SheetCellId> {
    return this._call(MethodName.GetShadowCellId, params) as Resp<SheetCellId>;
  }

  /**
   * Read the current value of a shadow ephemeral cell by its id.
   * Used by widgets that install a per-cell formula (validation /
   * userEditable / future kinds) and need to read the computed bool
   * back. Subscribe to changes via
   * {@link registerCellValueChangedByCellId} against the shadow's
   * `SheetCellId`.
   *
   * Param shape matches the autogenerated `Client` interface from
   * `logisheets-web` (params object, not raw `number`) — divergence
   * here used to crash crafts that imported `Client` but ran against
   * a `WorkbookClient` instance: the raw-number form re-wrapped the
   * passed object into another `{shadowId}` envelope, serde failed
   * to populate `GetShadowInfoByIdParams { shadow_id: u32 }`, and
   * the call returned `undefined` silently.
   */
  getShadowInfoById(params: { shadowId: number }): Resp<ShadowCellInfo> {
    return this._call(
      MethodName.GetShadowInfoById,
      params,
    ) as Resp<ShadowCellInfo>;
  }

  // ========================================================================
  // Callbacks
  // ========================================================================

  /**
   * Register a cell-updated callback. Returns a disposer that unregisters
   * it — call it on unmount so a torn-down view stops being notified (and
   * the callback can be garbage-collected). Multiple views may subscribe.
   */
  registerCellUpdatedCallback(f: Callback, _callbackId?: number): () => void {
    this._cellUpdatedCallbacks.push(f);
    return () => removeFromArray(this._cellUpdatedCallbacks, f);
  }

  registerSheetUpdatedCallback(f: Callback): () => void {
    this._sheetUpdatedCallbacks.push(f);
    return () => removeFromArray(this._sheetUpdatedCallbacks, f);
  }

  registerHeaderUpdatedCallback(
    f: (sheetIdxes: readonly number[]) => void,
  ): () => void {
    this._headerUpdatedCallbacks.push(f);
    return () => removeFromArray(this._headerUpdatedCallbacks, f);
  }

  registerCellValueChangedCallback(
    sheetIdx: number,
    rowIdx: number,
    colIdx: number,
    callback: CellIdCallback,
  ): Resp<void> {
    return this.getCellId({ sheetIdx, rowIdx, colIdx }).then((cellId) => {
      if (isErrorMessage(cellId)) {
        return cellId;
      }
      this.registerCellValueChangedByCellId(cellId, callback);
      return;
    });
  }

  /**
   * Like {@link registerCellValueChangedCallback} but takes a pre-resolved
   * `SheetCellId` — useful when paired with {@link getCellIdByBlockRef}
   * (subscribing by block ref) or other id-producing lookups, since it
   * skips the redundant (sheet,row,col) → id round-trip.
   */
  registerCellValueChangedByCellId(
    cellId: SheetCellId,
    callback: CellIdCallback,
  ): void {
    const cellIdStr = sheetCellIdToString(cellId);
    if (!this._cellValueChangedCallbacks.has(cellIdStr)) {
      this._cellValueChangedCallbacks.set(cellIdStr, [callback]);
    } else {
      this._cellValueChangedCallbacks.get(cellIdStr)?.push(callback);
    }
  }

  // ========================================================================
  // Client conformance — methods forwarded to existing worker handlers
  // ========================================================================
  //
  // Typed directly off the `Client` interface (`Client["x"]`) so the
  // signatures stay locked to the generated contract. The class declares
  // `implements Client`, so any future drift between these and the
  // bindings is a compile error rather than a silent runtime gap.

  getDisplayWindow: Client["getDisplayWindow"] = (params) =>
    this._call(MethodName.GetDisplayWindow, params) as ReturnType<
      Client["getDisplayWindow"]
    >;

  getValue: Client["getValue"] = (params) =>
    this._call(MethodName.GetCellValue, params) as ReturnType<
      Client["getValue"]
    >;

  getReproducibleCell: Client["getReproducibleCell"] = (params) =>
    this._call(MethodName.GetReproducibleCell, params) as ReturnType<
      Client["getReproducibleCell"]
    >;

  getReproducibleCells: Client["getReproducibleCells"] = (params) =>
    this._call(MethodName.GetReproducibleCells, params) as ReturnType<
      Client["getReproducibleCells"]
    >;

  batchGetCellCoordinateWithSheetById: Client["batchGetCellCoordinateWithSheetById"] =
    (params) =>
      this._call(
        MethodName.BatchGetCellCoordinateWithSheetById,
        params.ids,
      ) as ReturnType<Client["batchGetCellCoordinateWithSheetById"]>;

  getBlockValues: Client["getBlockValues"] = (params) =>
    this._call(MethodName.GetBlockValues, params) as ReturnType<
      Client["getBlockValues"]
    >;

  getDiyCellIdWithBlockId: Client["getDiyCellIdWithBlockId"] = (params) =>
    this._call(MethodName.GetDiyCellIdWithBlockId, params) as ReturnType<
      Client["getDiyCellIdWithBlockId"]
    >;

  lookupAppendixUpward: Client["lookupAppendixUpward"] = (params) =>
    this._call(MethodName.LookupAppendixUpward, params) as ReturnType<
      Client["lookupAppendixUpward"]
    >;

  getShadowCellIds: Client["getShadowCellIds"] = (params) =>
    this._call(MethodName.GetShadowCellIds, params) as ReturnType<
      Client["getShadowCellIds"]
    >;

  toggleStatus: Client["toggleStatus"] = (params) =>
    this._call(MethodName.ToggleStatus, params.useTemp) as ReturnType<
      Client["toggleStatus"]
    >;

  calcCondition: Client["calcCondition"] = (params) =>
    this._call(MethodName.CalcCondition, params) as ReturnType<
      Client["calcCondition"]
    >;

  isReady: Client["isReady"] = async () => {
    await this._call(MethodName.IsReady);
  };

  // ========================================================================
  // Client conformance — methods backed by new worker handlers
  // ========================================================================

  getAllBlocks: Client["getAllBlocks"] = (params) =>
    this._call(MethodName.GetAllBlocks, params) as ReturnType<
      Client["getAllBlocks"]
    >;

  getBlockRowId: Client["getBlockRowId"] = (params) =>
    this._call(MethodName.GetBlockRowId, params) as ReturnType<
      Client["getBlockRowId"]
    >;

  getBlockColId: Client["getBlockColId"] = (params) =>
    this._call(MethodName.GetBlockColId, params) as ReturnType<
      Client["getBlockColId"]
    >;

  saveCheckpoint: Client["saveCheckpoint"] = (params) =>
    this._call(MethodName.SaveCheckpoint, params) as ReturnType<
      Client["saveCheckpoint"]
    >;

  deleteCheckpoint: Client["deleteCheckpoint"] = (params) =>
    this._call(MethodName.DeleteCheckpoint, params) as ReturnType<
      Client["deleteCheckpoint"]
    >;

  listCheckpoints: Client["listCheckpoints"] = () =>
    this._call(MethodName.ListCheckpoints) as ReturnType<
      Client["listCheckpoints"]
    >;

  // ========================================================================
  // Client conformance — extra callback registrations
  // ========================================================================

  registerCellRemovedCallback: Client["registerCellRemovedCallback"] = (
    sheetIdx,
    rowIdx,
    colIdx,
    callback,
  ) =>
    this.getCellId({ sheetIdx, rowIdx, colIdx }).then((cellId) => {
      if (isErrorMessage(cellId)) return cellId;
      const key = sheetCellIdToString(cellId);
      const arr = this._cellRemovedCallbacks.get(key);
      if (arr) arr.push(callback as CellIdCallback);
      else this._cellRemovedCallbacks.set(key, [callback as CellIdCallback]);
      return;
    });

  // ========================================================================
  // Client conformance — not supported by the worker (explicit failures)
  // ========================================================================
  //
  // These have no worker handler / no Rust-side backend reachable across
  // the worker boundary. They satisfy the contract's type surface but fail
  // loudly if actually invoked, instead of silently returning undefined.

  private _notImplemented(name: string): never {
    throw new Error(
      `WorkbookClient.${name} is not implemented in the engine worker`,
    );
  }

  getRowHeight: Client["getRowHeight"] = () => this._notImplemented("getRowHeight");
  getColWidth: Client["getColWidth"] = () => this._notImplemented("getColWidth");
  getDisplayWindowWithinCell: Client["getDisplayWindowWithinCell"] = () =>
    this._notImplemented("getDisplayWindowWithinCell");
  getCellInfos: Client["getCellInfos"] = () => this._notImplemented("getCellInfos");
  getFormula: Client["getFormula"] = () => this._notImplemented("getFormula");
  getStyle: Client["getStyle"] = () => this._notImplemented("getStyle");
  getCellsExceptWindow: Client["getCellsExceptWindow"] = () =>
    this._notImplemented("getCellsExceptWindow");
  getBlockDisplayWindow: Client["getBlockDisplayWindow"] = () =>
    this._notImplemented("getBlockDisplayWindow");
  getRowInfo: Client["getRowInfo"] = () => this._notImplemented("getRowInfo");
  getAllBlockRefNames: Client["getAllBlockRefNames"] = () =>
    this._notImplemented("getAllBlockRefNames");
  registerCustomFunc: Client["registerCustomFunc"] = () =>
    this._notImplemented("registerCustomFunc");
  registerShadowCellValueChangedCallback: Client["registerShadowCellValueChangedCallback"] =
    () => this._notImplemented("registerShadowCellValueChangedCallback");

  // ========================================================================
  // Internal
  // ========================================================================

  private _call(method: MethodName, params?: any): Promise<any> {
    const id = this._id++;
    this._worker.postMessage({ m: method, args: params, id });
    return new Promise((resolve) => {
      this._resolvers.set(id, resolve);
    });
  }
}
