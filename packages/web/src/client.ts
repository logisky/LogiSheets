import type {
    ErrorMessage,
    SheetCoordinate,
    ActionEffect,
    SheetCellId,
    WorkbookMethods,
    HandleTransactionParams,
} from './bindings'
import type {CustomFunc} from './api'

export type Resp<T> = Promise<T | ErrorMessage>

/**
 * The client is the interface for the workbook. This is used when the workbook
 * is wrapped by a server.
 */
export interface Client extends WorkbookMethods {
    isReady(): Promise<void>
    handleTransactionWithoutEvents(
        params: HandleTransactionParams
    ): Resp<ActionEffect>

    registerCustomFunc(f: CustomFunc): void
    registerCellUpdatedCallback(f: () => void): void
    registerSheetUpdatedCallback(f: () => void): void

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

    registerCellRemovedCallback(
        sheetIdx: number,
        rowIdx: number,
        colIdx: number,
        callback: () => void
    ): Resp<void>

    registerShadowCellValueChangedCallback(
        sheetIdx: number,
        rowIdx: number,
        colIdx: number,
        callback: () => void
    ): Resp<number>
}
