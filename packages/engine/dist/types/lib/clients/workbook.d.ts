/**
 * Workbook Client - communicates with the worker for workbook operations.
 */
import type { SheetInfo, CellInfo, CellPosition, SheetDimension, MergeCell, BlockInfo, FormulaDisplayInfo, CellCoordinate, SheetCellId, Callback, CellIdCallback, ErrorMessage, AppData, BlockField, TempStatusDiff, ShadowCellInfo } from "logisheets-web";
type Resp<T> = Promise<T | ErrorMessage>;
export declare class WorkbookClient {
    private _worker;
    private _resolvers;
    private _id;
    private _ready;
    private _cellUpdatedCallbacks;
    private _sheetUpdatedCallbacks;
    private _headerUpdatedCallbacks;
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
    batchGetCellInfoById(params: {
        ids: readonly SheetCellId[];
    }): Resp<readonly CellInfo[]>;
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
    getAvailableBlockId(params: {
        sheetIdx: number;
    }): Resp<number>;
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
    }): Resp<readonly BlockInfo[]>;
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
    }): Resp<SheetCellId>;
    /**
     * Snapshot of all cell-value differences between the active temp
     * branch and the committed (fork) status. Used by the diff layer.
     */
    getTempStatusChanges(): Resp<TempStatusDiff>;
    getMergedCells(params: {
        sheetIdx: number;
        startRow: number;
        startCol: number;
        endRow: number;
        endCol: number;
    }): Resp<readonly MergeCell[]>;
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
    private _payloadObservers;
    registerPayloadObserver(fn: (payload: any) => void): () => void;
    private _notifyPayloadObservers;
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
    commitTempStatus(): Resp<void>;
    cleanTempStatus(): Resp<void>;
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
        /**
         * Which derived computation this shadow represents. Optional for
         * backward compatibility — omitting it defaults to the
         * long-standing Validation kind. Other kinds (e.g. `'userEditable'`)
         * let widgets request their own per-cell shadow without colliding
         * with validation's slot.
         */
        kind?: "validation" | "userEditable";
    }): Resp<SheetCellId>;
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
    getShadowInfoById(params: {
        shadowId: number;
    }): Resp<ShadowCellInfo>;
    registerCellUpdatedCallback(f: Callback, _callbackId?: number): void;
    registerSheetUpdatedCallback(f: Callback): void;
    registerHeaderUpdatedCallback(f: (sheetIdxes: readonly number[]) => void): void;
    registerCellValueChangedCallback(sheetIdx: number, rowIdx: number, colIdx: number, callback: CellIdCallback): Resp<void>;
    /**
     * Like {@link registerCellValueChangedCallback} but takes a pre-resolved
     * `SheetCellId` — useful when paired with {@link getCellIdByBlockRef}
     * (subscribing by block ref) or other id-producing lookups, since it
     * skips the redundant (sheet,row,col) → id round-trip.
     */
    registerCellValueChangedByCellId(cellId: SheetCellId, callback: CellIdCallback): void;
    private _call;
}
export {};
