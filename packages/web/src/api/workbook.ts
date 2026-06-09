import {handle, input_async_result} from '../../wasm/logisheets_wasm_server'
import {
    ActionEffect,
    AsyncFuncResult,
    BlockField,
    FormulaDisplayInfo,
    ShadowCellInfo,
    SheetCellId,
    SheetInfo,
    SaveFileResult,
    AppData,
    CellInfo,
    CellCoordinateWithSheet,
    Transaction,
    GetBlockValuesParams,
    GetCellIdParams,
    GetShadowCellIdParams,
    GetShadowCellIdsParams,
    GetAvailableBlockIdParams,
    TempStatusDiff,
} from '../bindings'
import {ColId, RowId} from '../types'
import {Worksheet} from './worksheet'
import {Calculator, CustomFunc} from './calculator'
import {isErrorMessage, Result} from './utils'
import {BlockManager} from './block_manager'

function rpc(
    method: string,
    params?: Record<string, unknown>,
    bookId?: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
    const msg = params === undefined ? method : {method, value: params}
    return handle(msg, bookId ?? null)
}

export type ReturnCode = number

export type Callback = () => void
export type CellIdCallback = (cellId: SheetCellId) => void

export class Workbook {
    public constructor() {
        this._id = rpc('newWorkbook') as number
        this._blockManager = new BlockManager(
            (
                sheetIdx: number,
                blockId: number,
                rowCount: number,
                colCount: number
            ) => {
                return rpc(
                    'checkBindBlock',
                    {sheetIdx, blockId, rowCount, colCount},
                    this._id
                ) as boolean
            },
            (sheetIdx: number) => {
                return rpc(
                    'getAvailableBlockId',
                    {sheetIdx},
                    this._id
                ) as number
            }
        )
    }

    public getSheetIdx(sheetId: number): Result<number> {
        return rpc('getSheetIdx', {sheetId}, this._id)
    }

    public getBlockValues(
        params: GetBlockValuesParams
    ): Result<readonly string[]> {
        return rpc(
            'getBlockValues',
            params as unknown as Record<string, unknown>,
            this._id
        )
    }

    public getAvailableBlockId(
        params: GetAvailableBlockIdParams
    ): Result<number> {
        return rpc(
            'getAvailableBlockId',
            params as unknown as Record<string, unknown>,
            this._id
        )
    }

    /**
     * @returns the block id if success, otherwise the error message
     *
     * It is caller's responsibility to store the block id.
     */
    public createBlockForNewCraft(
        sheetIdx: number,
        masterRow: number,
        masterCol: number,
        rowCnt: number,
        colCnt: number
    ): Result<number> {
        const id = this._blockManager.getAvailableBlockId(sheetIdx)
        const effect = this.execTransaction({
            payloads: [
                {
                    type: 'createBlock',
                    value: {
                        sheetIdx,
                        id,
                        masterRow,
                        masterCol,
                        rowCnt,
                        colCnt,
                    },
                },
            ],
            undoable: false,
            temp: false,
        })
        if (effect.status.type === 'err') {
            return {
                msg: 'failed to create block',
                ty: effect.status.value,
            }
        }
        const bind = this._blockManager.bindBlock(sheetIdx, id, rowCnt, colCnt)
        if (!bind) {
            return {
                msg: 'failed to bind block',
                ty: 1,
            }
        }
        return id
    }

    public undo(): boolean {
        const result = rpc('undo', undefined, this._id) as boolean
        if (result) {
            this._onCellUpdate()
            this._onSheetUpdate()
        }
        return result
    }

    public redo(): boolean {
        const result = rpc('redo', undefined, this._id) as boolean
        if (result) {
            this._onCellUpdate()
            this._onSheetUpdate()
        }
        return result
    }

    public registerCellUpdatedCallback(callback: Callback) {
        this._cellUpdatedCallbacks.push(callback)
    }

    public registerSheetInfoUpdateCallback(callback: Callback) {
        this._sheetInfoUpdatedCallbacks.push(callback)
    }

    /**
     * Fires after a transaction with sheet indices whose row/column headers
     * changed (i.e. SetRowHeight / SetColWidth payloads). Useful for the UI
     * to know which sheets need their header strip re-rendered.
     */
    public registerHeaderUpdatedCallback(
        callback: (sheetIdxes: readonly number[]) => void
    ) {
        this._headerUpdatedCallbacks.push(callback)
    }

    public getSheetNameByIdx(idx: number): Result<string> {
        return rpc('getSheetNameByIdx', {idx}, this._id)
    }

    public getAllSheetInfo(): Array<SheetInfo> {
        return rpc('getAllSheetInfo', undefined, this._id)
    }

    public checkFormula(f: string): boolean {
        return rpc('checkFormula', {formula: f}, this._id)
    }

    public calcCondition(sheetIdx: number, f: string): Result<boolean> {
        return rpc('calcCondition', {sheetIdx, condition: f}, this._id)
    }

    /**
     * Resolve a (refName, key, field) triple to a concrete cell, the same
     * way the BLOCKREF formula resolves at evaluation time. Useful for
     * subscribing to block cells without threading sheet/block/row/col
     * coordinates.
     */
    public getCellIdByBlockRef(
        refName: string,
        key: string,
        field: string
    ): Result<SheetCellId> {
        return rpc('getCellIdByBlockRef', {refName, key, field}, this._id)
    }

    /**
     * Snapshot of all cell-value differences between the active temp
     * branch and the committed (fork) status. Returns an empty diff
     * when no temp branch is active. Used by the host's diff layer to
     * drive its overlay without needing JS-side snapshot/compare.
     */
    public getTempStatusChanges(): Result<TempStatusDiff> {
        return rpc('getTempStatusChanges', undefined, this._id)
    }

    public getSheetId(sheetIdx: number): Result<number> {
        return rpc('getSheetId', {sheetIdx}, this._id)
    }

    public getBlockRowId(
        sheetId: number,
        blockId: number,
        rowIdx: number
    ): Result<RowId> {
        return rpc('getBlockRowId', {sheetId, blockId, rowIdx}, this._id)
    }

    public getBlockColId(
        sheetId: number,
        blockId: number,
        colIdx: number
    ): Result<ColId> {
        return rpc('getBlockColId', {sheetId, blockId, colIdx}, this._id)
    }

    public getDisplayUnitsOfFormula(f: string): Result<FormulaDisplayInfo> {
        return rpc('getDisplayUnitsOfFormula', {formula: f}, this._id)
    }

    public onCellValueChanged(
        sheetIdx: number,
        rowIdx: number,
        colIdx: number,
        callback: Callback
    ): Result<void> {
        const cellId = this.getCellId({sheetIdx, rowIdx, colIdx})
        if (isErrorMessage(cellId)) {
            return cellId
        }
        this._registerCellValueChangedCallback(cellId, callback)
    }

    public onCellRemoved(
        sheetIdx: number,
        rowIdx: number,
        colIdx: number,
        callback: Callback
    ): Result<void> {
        const cellId = this.getCellId({sheetIdx, rowIdx, colIdx})
        if (isErrorMessage(cellId)) {
            return cellId
        }
        this._registerCellRemovedCallback(cellId, callback)
    }

    public onShadowCellValueChanged(
        sheetIdx: number,
        rowIdx: number,
        colIdx: number,
        callback: Callback
    ): Result<void> {
        const shadowId = this.getShadowCellId({
            sheetIdx,
            rowIdx,
            colIdx,
        }) as Result<SheetCellId>
        if (isErrorMessage(shadowId)) {
            return shadowId
        }

        this._registerCellValueChangedCallback(shadowId, callback)
    }

    private _registerCellRemovedCallback(
        cellId: SheetCellId,
        callback: Callback
    ) {
        if (!this._cellRemovedCallbacks.has(cellId)) {
            this._cellRemovedCallbacks.set(cellId, [])
        }
        this._cellRemovedCallbacks.get(cellId)?.push(callback)
    }

    private _registerCellValueChangedCallback(
        id: SheetCellId,
        callback: Callback
    ) {
        if (!this._cellValueChangedCallbacks.has(id)) {
            this._cellValueChangedCallbacks.set(id, [])
        }
        this._cellValueChangedCallbacks.get(id)?.push(callback)
    }

    public registerCellValueChangedByCellId(
        cellId: SheetCellId,
        callback: Callback
    ): void {
        this._registerCellValueChangedCallback(cellId, callback)
    }

    public commitTempStatus() {
        rpc('commitTempStatus', undefined, this._id)
    }

    public cleanupTempStatus() {
        rpc('cleanTempStatus', undefined, this._id)
    }

    public toggleStatus(useTemp: boolean) {
        rpc('toggleStatus', {useTemp}, this._id)
    }

    public batchGetCellInfoById(
        ids: readonly SheetCellId[]
    ): Result<readonly CellInfo[]> {
        return rpc('batchGetCellInfoById', {ids}, this._id)
    }

    public batchGetCellCoordinateWithSheetById(
        ids: readonly SheetCellId[]
    ): Result<readonly CellCoordinateWithSheet[]> {
        return rpc('batchGetCellCoordinateWithSheetById', {ids}, this._id)
    }

    public execTransaction(tx: Transaction): ActionEffect {
        const result = rpc(
            'handleTransaction',
            {transaction: tx},
            this._id
        ) as ActionEffect

        if (result.asyncTasks.length > 0) {
            const asyncResult = this._calculator.calc(result.asyncTasks)
            asyncResult.then((result) => {
                this._inputAsyncResult(result)
                this._onCellUpdate()
            })
        }
        if (result.status.type === 'ok') {
            switch (result.status.value) {
                case 'cell':
                    this._onCellUpdate()
                    break
                case 'sheet':
                    this._onSheetUpdate()
                    break
                case 'sheetAndCell':
                    this._onCellUpdate()
                    this._onSheetUpdate()
                    break
                case 'undoNothing':
                case 'redoNothing':
                case 'doNothing':
                    break
                default:
                    this._onCellUpdate()
                    this._onSheetUpdate()
            }
            result.valueChanged.forEach((cellId) => {
                this._cellValueChangedCallbacks
                    .get(cellId)
                    ?.forEach((callback) => {
                        callback()
                    })
            })
            result.cellRemoved.forEach((cellId) => {
                this._cellRemovedCallbacks.get(cellId)?.forEach((callback) => {
                    callback()
                })
                this._cellRemovedCallbacks.delete(cellId)
                this._cellValueChangedCallbacks.delete(cellId)
            })
            if (result.headerUpdated.length > 0) {
                this._headerUpdatedCallbacks.forEach((cb) =>
                    cb(result.headerUpdated)
                )
            }
        }
        return result
    }

    public load(buf: Uint8Array, bookName: string): ReturnCode {
        return rpc(
            'loadWorkbook',
            {content: Array.from(buf), name: bookName},
            this._id
        ) as ReturnCode
    }

    public save(data: string): SaveFileResult {
        return rpc('saveWorkbook', {appData: data}, this._id)
    }

    public getAppData(): readonly AppData[] {
        return rpc('getAppData', undefined, this._id)
    }

    public release() {
        rpc('release', undefined, this._id)
    }

    public getSheetCount(): number {
        return rpc('getSheetCount', undefined, this._id)
    }

    public getWorksheet(idx: number): Worksheet {
        if (idx >= this.getSheetCount())
            throw Error(`invalid sheet index: ${idx}`)
        return new Worksheet(this._id, idx)
    }

    public getWorksheetById(id: number): Worksheet {
        return new Worksheet(this._id, id, false)
    }

    public registryCustomFunc(customFunc: CustomFunc) {
        this._calculator.registry(customFunc)
    }

    public getShadowCellId(params: GetShadowCellIdParams): Result<number> {
        return rpc(
            'getShadowCellId',
            params as unknown as Record<string, unknown>,
            this._id
        )
    }

    public getShadowCellIds(
        params: GetShadowCellIdsParams
    ): Result<readonly number[]> {
        return rpc(
            'getShadowCellIds',
            params as unknown as Record<string, unknown>,
            this._id
        )
    }

    public getShadowInfoById(params: {
        shadowId: number
    }): Result<ShadowCellInfo> {
        return rpc(
            'getShadowInfoById',
            params as unknown as Record<string, unknown>,
            this._id
        )
    }

    public getCellId(params: GetCellIdParams): Result<SheetCellId> {
        return rpc(
            'getCellId',
            params as unknown as Record<string, unknown>,
            this._id
        )
    }

    public getAllBlockFields(): Result<readonly BlockField[]> {
        return rpc('getAllBlockFields', undefined, this._id)
    }

    private _inputAsyncResult(r: AsyncFuncResult): ActionEffect {
        return input_async_result(this._id, r) as ActionEffect
    }

    private _onCellUpdate() {
        this._cellUpdatedCallbacks.forEach((exec) => {
            exec()
        })
    }

    private _onSheetUpdate() {
        this._sheetInfoUpdatedCallbacks.forEach((exec) => {
            exec()
        })
    }

    private _cellUpdatedCallbacks: Callback[] = []
    private _sheetInfoUpdatedCallbacks: Callback[] = []
    private _headerUpdatedCallbacks: Array<
        (sheetIdxes: readonly number[]) => void
    > = []

    private _cellValueChangedCallbacks: Map<SheetCellId, Callback[]> = new Map()
    private _cellRemovedCallbacks: Map<SheetCellId, Callback[]> = new Map()
    // The book id which is generated by `WASM`
    private _id: number

    private _blockManager!: BlockManager
    private _calculator = new Calculator()
}
