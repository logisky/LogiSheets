import type {
    ErrorMessage,
    SheetCoordinate,
    ActionEffect,
    SheetCellId,
    WorkbookMethods,
    HandleTransactionParams,
} from './bindings'
import type {CustomFunc} from './api'

/** An async engine reply: the value, or an {@link ErrorMessage} on failure. */
export type Resp<T> = Promise<T | ErrorMessage>

/**
 * The async engine contract shared logic codes against. Every method of the
 * generated {@link WorkbookMethods} is `method(params) => Promise<T |
 * ErrorMessage>`, bound to one workbook.
 *
 * Implementations: logisheets-engine's worker-backed `WorkbookClient` in the
 * browser, and logisheets-runtime's `handle()` proxy on Node. The
 * `register*` members below are host-side subscriptions; the Node proxy does
 * not implement them, so code that must run headless should not rely on them.
 *
 * Failure contract (holds for every implementation):
 *  - Methods never reject for an engine-level failure; they resolve an
 *    `ErrorMessage` (check with `isErrorMessage`).
 *  - `handleTransaction` does NOT resolve an `ErrorMessage` when the engine
 *    refuses the edit. It resolves an `ActionEffect` whose
 *    `status.type === 'err'`, with the reason in `errorMessage`, and nothing
 *    is applied. A caller that needs the write to land must check `status`.
 */
export interface Client extends WorkbookMethods {
    /** Resolves once the engine can serve calls (the browser worker has
     *  loaded its WASM). Await it before the first call. */
    isReady(): Promise<void>
    /**
     * `handleTransaction` without the host's per-cell change notifications.
     * Same failure contract: a rejection is `status.type === 'err'`.
     */
    handleTransactionWithoutEvents(
        params: HandleTransactionParams
    ): Resp<ActionEffect>

    /** Register a custom formula function. Not implemented by the browser
     *  worker client. */
    registerCustomFunc(f: CustomFunc): void
    /** Fires after a transaction the engine reports as changing cells
     *  (status `cell` / `sheetAndCell`). */
    registerCellUpdatedCallback(f: () => void): void
    /** Fires after a transaction the engine reports as changing sheet-level
     *  state (status `sheet` / `sheetAndCell`). */
    registerSheetUpdatedCallback(f: () => void): void

    /**
     * Subscribe to value changes of the cell currently at (sheetIdx, rowIdx,
     * colIdx), all 0-based. The coordinate is resolved to a stable cell id
     * once, so the subscription follows the cell if rows/cols move. Resolves
     * an `ErrorMessage` if the coordinate cannot be resolved.
     */
    registerCellValueChangedCallback(
        sheetIdx: number,
        rowIdx: number,
        colIdx: number,
        callback: () => void
    ): Resp<void>

    /**
     * Like {@link registerCellValueChangedCallback} but takes a
     * pre-resolved {@link SheetCellId} — useful with
     * `getCellIdByBlockRef` so subscriptions can be made by
     * (refName, key, field) without the redundant (sheet,row,col)
     * round-trip.
     */
    registerCellValueChangedByCellId(
        cellId: SheetCellId,
        callback: () => void
    ): void

    /** Like {@link registerCellValueChangedCallback}, but fires when the cell
     *  is removed (its row/col deleted). */
    registerCellRemovedCallback(
        sheetIdx: number,
        rowIdx: number,
        colIdx: number,
        callback: () => void
    ): Resp<void>

    /** Subscribe to a cell's shadow (validation) cell. Not implemented by the
     *  browser worker client. */
    registerShadowCellValueChangedCallback(
        sheetIdx: number,
        rowIdx: number,
        colIdx: number,
        callback: () => void
    ): Resp<number>
}
