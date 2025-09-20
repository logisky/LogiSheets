import {
    block_input,
    block_line_shift,
    calc_condition,
    cell_clear,
    cell_input,
    check_bind_block,
    check_formula,
    col_delete,
    col_insert,
    create_appendix,
    create_block,
    create_diy_cell,
    create_sheet,
    delete_sheet,
    get_all_sheet_info,
    get_available_block_id,
    get_block_col_id,
    get_block_row_id,
    get_block_values,
    get_cell_id,
    get_shadow_info_by_id,
    get_shadow_cell_id,
    get_shadow_cell_ids,
    get_sheet_count,
    get_sheet_id,
    get_sheet_idx,
    input_async_result,
    merge_cells,
    move_block,
    new_workbook,
    read_file,
    redo,
    release,
    reproduce_cells,
    resize_block,
    row_delete,
    row_insert,
    set_cell_alignment,
    set_cell_border,
    set_cell_format_brush,
    set_cell_pattern_fill,
    set_col_width,
    set_font,
    set_line_alignment,
    set_line_border,
    set_line_font,
    set_line_format_brush,
    set_line_pattern_fill,
    set_row_height,
    sheet_rename_by_idx,
    sheet_rename_by_name,
    split_merged_cells,
    transaction_end,
    transaction_start,
    undo,
    ephemeral_cell_input,
    get_display_units_of_formula,
    remove_block,
} from '../../wasm/logisheets_wasm_server'
import {
    ActionEffect,
    AsyncFuncResult,
    FormulaDisplayInfo,
    ShadowCellInfo,
    SheetCellId,
    SheetInfo,
} from '../bindings'
import {Payload} from '../payloads'
import {ColId, RowId, Transaction} from '../types'
import {Worksheet} from './worksheet'
import {Calculator, CustomFunc} from './calculator'
import {isErrorMessage, Result} from './utils'
import {BlockManager} from './block_manager'
import {
    GetAvailableBlockIdParams,
    GetBlockValuesParams,
    GetCellIdParams,
    GetShadowCellIdParams,
    GetShadowCellIdsParams,
} from '../client'

export type ReturnCode = number

export type Callback = () => void
export type CellIdCallback = (cellId: SheetCellId) => void

export class Workbook {
    public constructor() {
        this._id = new_workbook()
        this._blockManager = new BlockManager(
            (
                sheetIdx: number,
                blockId: number,
                rowCount: number,
                colCount: number
            ) => {
                return check_bind_block(
                    this._id,
                    sheetIdx,
                    blockId,
                    rowCount,
                    colCount
                )
            },
            (sheetIdx: number) => {
                return get_available_block_id(this._id, sheetIdx)
            }
        )
    }

    public getSheetIdx(sheetId: number): Result<number> {
        return get_sheet_idx(this._id, sheetId)
    }

    public getBlockValues(
        params: GetBlockValuesParams
    ): Result<readonly string[]> {
        return get_block_values(
            this._id,
            params.sheetId,
            params.blockId,
            new Uint32Array(params.rowIds),
            new Uint32Array(params.colIds)
        )
    }

    public getAvailableBlockId(
        params: GetAvailableBlockIdParams
    ): Result<number> {
        return get_available_block_id(this._id, params.sheetIdx)
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
        const effect = this.execTransaction(
            new Transaction(
                [
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
                false
            )
        )
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
        const result = undo(this._id)
        if (result) {
            this._onCellUpdate()
            this._onSheetUpdate()
        }
        return result
    }

    public redo(): boolean {
        const result = redo(this._id)
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

    public getAllSheetInfo(): Array<SheetInfo> {
        return get_all_sheet_info(this._id)
    }

    public checkFormula(f: string): boolean {
        return check_formula(this._id, f)
    }

    public calcCondition(sheetIdx: number, f: string): Result<boolean> {
        return calc_condition(this._id, sheetIdx, f)
    }

    public getSheetId(sheetIdx: number): Result<number> {
        return get_sheet_id(this._id, sheetIdx)
    }

    public getBlockRowId(
        sheetId: number,
        blockId: number,
        rowIdx: number
    ): Result<RowId> {
        return get_block_row_id(this._id, sheetId, blockId, rowIdx)
    }

    public getBlockColId(
        sheetId: number,
        blockId: number,
        colIdx: number
    ): Result<ColId> {
        return get_block_col_id(this._id, sheetId, blockId, colIdx)
    }

    public getDisplayUnitsOfFormula(f: string): Result<FormulaDisplayInfo> {
        return get_display_units_of_formula(f)
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

    public execTransaction(tx: Transaction): ActionEffect {
        transaction_start(this._id)
        tx.payloads.forEach((p: Payload) => {
            this._addPayload(p)
        })
        const result = transaction_end(this._id, tx.undoable) as ActionEffect
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
        }
        return result
    }

    public load(buf: Uint8Array, bookName: string): ReturnCode {
        return read_file(this._id, bookName, buf)
    }

    public release() {
        release(this._id)
    }

    public getSheetCount(): number {
        return get_sheet_count(this._id)
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
        return get_shadow_cell_id(
            this._id,
            params.sheetIdx,
            params.rowIdx,
            params.colIdx
        )
    }

    public getShadowCellIds(
        params: GetShadowCellIdsParams
    ): Result<readonly number[]> {
        return get_shadow_cell_ids(
            this._id,
            params.sheetIdx,
            new Uint32Array(params.rowIdx),
            new Uint32Array(params.colIdx)
        )
    }

    public getShadowInfoById(shadowId: number): Result<ShadowCellInfo> {
        return get_shadow_info_by_id(this._id, BigInt(shadowId))
    }

    public getCellId(params: GetCellIdParams): Result<SheetCellId> {
        return get_cell_id(
            this._id,
            params.sheetIdx,
            params.rowIdx,
            params.colIdx
        )
    }

    private _addPayload(p: Payload) {
        if (p.type === 'cellInput')
            return cell_input(
                this._id,
                p.value.sheetIdx,
                p.value.row,
                p.value.col,
                p.value.content
            )
        if (p.type === 'insertRows')
            return row_insert(
                this._id,
                p.value.sheetIdx,
                p.value.start,
                p.value.count
            )
        if (p.type === 'deleteRows')
            return row_delete(
                this._id,
                p.value.sheetIdx,
                p.value.start,
                p.value.count
            )
        if (p.type === 'insertCols')
            return col_insert(
                this._id,
                p.value.sheetIdx,
                p.value.start,
                p.value.count
            )
        if (p.type === 'deleteCols')
            return col_delete(
                this._id,
                p.value.sheetIdx,
                p.value.start,
                p.value.count
            )
        if (p.type === 'createBlock')
            return create_block(
                this._id,
                p.value.sheetIdx,
                p.value.id,
                p.value.masterRow,
                p.value.masterCol,
                p.value.rowCnt,
                p.value.colCnt
            )
        if (p.type === 'resizeBlock')
            return resize_block(
                this._id,
                p.value.sheetIdx,
                p.value.id,
                p.value.newRowCnt,
                p.value.newColCnt
            )

        if (p.type === 'moveBlock')
            return move_block(
                this._id,
                p.value.sheetIdx,
                p.value.id,
                p.value.newMasterRow,
                p.value.newMasterCol
            )
        if (p.type === 'setCellBorder')
            return set_cell_border(
                this._id,
                p.value.sheetIdx,
                p.value.row,
                p.value.col,
                p.value.leftColor,
                p.value.rightColor,
                p.value.topColor,
                p.value.bottomColor,
                p.value.leftBorderType,
                p.value.rightBorderType,
                p.value.topBorderType,
                p.value.bottomBorderType,
                p.value.outline,
                p.value.diagonalUp,
                p.value.diagonalDown
            )
        if (p.type === 'setLineBorder')
            return set_line_border(
                this._id,
                p.value.sheetIdx,
                p.value.row,
                p.value.line,
                p.value.leftColor,
                p.value.rightColor,
                p.value.topColor,
                p.value.bottomColor,
                p.value.leftBorderType,
                p.value.rightBorderType,
                p.value.topBorderType,
                p.value.bottomBorderType,
                p.value.outline,
                p.value.diagonalUp,
                p.value.diagonalDown
            )
        if (p.type === 'setCellFont')
            return set_font(
                this._id,
                p.value.sheetIdx,
                p.value.row,
                p.value.col,
                p.value.bold,
                p.value.italic,
                p.value.name,
                p.value.underline,
                p.value.color,
                p.value.size,
                p.value.outline,
                p.value.shadow,
                p.value.strike,
                p.value.condense
            )
        if (p.type === 'setLineFont')
            return set_line_font(
                this._id,
                p.value.sheetIdx,
                p.value.from,
                p.value.to,
                p.value.row,
                p.value.bold,
                p.value.italic,
                p.value.name,
                p.value.underline,
                p.value.color,
                p.value.size,
                p.value.outline,
                p.value.shadow,
                p.value.strike,
                p.value.condense
            )
        if (p.type === 'blockInput')
            return block_input(
                this._id,
                p.value.sheetIdx,
                p.value.blockId,
                p.value.row,
                p.value.col,
                p.value.input
            )

        if (p.type === 'insertColsInBlock')
            return block_line_shift(
                this._id,
                p.value.sheetIdx,
                p.value.blockId,
                p.value.start,
                p.value.cnt,
                false,
                true
            )
        if (p.type === 'insertRowsInBlock')
            return block_line_shift(
                this._id,
                p.value.sheetIdx,
                p.value.blockId,
                p.value.start,
                p.value.cnt,
                true,
                true
            )
        if (p.type === 'deleteRowsInBlock')
            return block_line_shift(
                this._id,
                p.value.sheetIdx,
                p.value.blockId,
                p.value.start,
                p.value.cnt,
                true,
                false
            )
        if (p.type === 'deleteColsInBlock')
            return block_line_shift(
                this._id,
                p.value.sheetIdx,
                p.value.blockId,
                p.value.start,
                p.value.cnt,
                true,
                true
            )
        if (p.type === 'sheetRename') {
            if (p.value.oldName) {
                return sheet_rename_by_name(
                    this._id,
                    p.value.oldName,
                    p.value.newName
                )
            }
            if (p.value.idx) {
                return sheet_rename_by_idx(
                    this._id,
                    p.value.idx,
                    p.value.newName
                )
            }
        }
        if (p.type === 'deleteSheet') return delete_sheet(this._id, p.value.idx)
        if (p.type === 'createSheet')
            return create_sheet(this._id, p.value.idx, p.value.newName)
        if (p.type === 'cellClear')
            return cell_clear(
                this._id,
                p.value.sheetIdx,
                p.value.row,
                p.value.col
            )
        if (p.type === 'setColWidth')
            return set_col_width(
                this._id,
                p.value.sheetIdx,
                p.value.col,
                p.value.width
            )
        if (p.type === 'setRowHeight')
            return set_row_height(
                this._id,
                p.value.sheetIdx,
                p.value.row,
                p.value.height
            )
        if (p.type === 'setLineAlignment')
            return set_line_alignment(
                this._id,
                p.value.sheetIdx,
                p.value.row,
                p.value.from,
                p.value.to,
                p.value.alignment.horizontal,
                p.value.alignment.vertical
            )
        if (p.type === 'setCellAlignment')
            return set_cell_alignment(
                this._id,
                p.value.sheetIdx,
                p.value.row,
                p.value.col,
                p.value.alignment.horizontal,
                p.value.alignment.vertical
            )
        if (p.type === 'setCellPatternFill')
            return set_cell_pattern_fill(
                this._id,
                p.value.sheetIdx,
                p.value.row,
                p.value.col,
                p.value.fgColor,
                p.value.bgColor,
                p.value.pattern
            )
        if (p.type === 'setLinePatternFill')
            return set_line_pattern_fill(
                this._id,
                p.value.sheetIdx,
                p.value.row,
                p.value.from,
                p.value.to,
                p.value.fgColor,
                p.value.bgColor,
                p.value.pattern
            )
        if (p.type === 'mergeCells')
            return merge_cells(
                this._id,
                p.value.sheetIdx,
                p.value.startRow,
                p.value.startCol,
                p.value.endRow,
                p.value.endCol
            )
        if (p.type === 'splitMergedCells')
            return split_merged_cells(
                this._id,
                p.value.sheetIdx,
                p.value.row,
                p.value.col
            )
        if (p.type === 'cellFormatBrush')
            return set_cell_format_brush(
                this._id,
                p.value.srcSheetIdx,
                p.value.srcRow,
                p.value.srcCol,
                p.value.dstSheetIdx,
                p.value.dstRowStart,
                p.value.dstColStart,
                p.value.dstRowEnd,
                p.value.dstColEnd
            )
        if (p.type === 'lineFormatBrush')
            return set_line_format_brush(
                this._id,
                p.value.srcSheetIdx,
                p.value.srcRow,
                p.value.srcCol,
                p.value.dstSheetIdx,
                p.value.row,
                p.value.from,
                p.value.to
            )
        if (p.type === 'createDiyCell')
            return create_diy_cell(
                this._id,
                p.value.sheetIdx,
                p.value.row,
                p.value.col
            )
        if (p.type === 'createAppendix')
            return create_appendix(
                this._id,
                p.value.sheetId,
                p.value.sheetIdx,
                p.value.blockId,
                p.value.rowIdx,
                p.value.colIdx,
                p.value.craftId,
                p.value.tag,
                p.value.content
            )
        if (p.type === 'ephemeralCellInput')
            return ephemeral_cell_input(
                this._id,
                p.value.sheetIdx,
                BigInt(p.value.id),
                p.value.content
            )
        if (p.type === 'reproduceCells')
            return reproduce_cells(this._id, p.value)
        if (p.type === 'removeBlock')
            return remove_block(this._id, p.value.sheetIdx, p.value.id)
        // eslint-disable-next-line no-console
        console.log(`Unimplemented!: ${p.type}`)
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

    private _cellValueChangedCallbacks: Map<SheetCellId, Callback[]> = new Map()
    private _cellRemovedCallbacks: Map<SheetCellId, Callback[]> = new Map()
    // The book id which is generated by `WASM`
    private _id: number

    private _blockManager!: BlockManager
    private _calculator = new Calculator()
}
