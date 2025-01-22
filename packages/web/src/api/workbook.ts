import {Payload} from '../payloads'
import {
    block_input,
    block_line_shift,
    cell_clear,
    cell_input,
    col_delete,
    col_insert,
    create_block,
    create_sheet,
    delete_sheet,
    get_all_sheet_info,
    get_patches,
    get_sheet_count,
    input_async_result,
    move_block,
    new_workbook,
    read_file,
    redo,
    release,
    row_delete,
    row_insert,
    set_border,
    set_cell_alignment,
    set_cell_pattern_fill,
    set_col_width,
    set_font,
    set_line_alignment,
    set_line_font,
    set_line_pattern_fill,
    set_row_height,
    sheet_rename_by_idx,
    sheet_rename_by_name,
    transaction_end,
    transaction_start,
    undo,
} from '../../wasm/logisheets_wasm_server'
import {
    ActionEffect,
    AsyncFuncResult,
    DisplayResponse,
    SheetInfo,
} from '../bindings'
import {Transaction} from '../transactions'
import {Worksheet} from './worksheet'
import {Calculator, CustomFunc} from './calculator'

export type ReturnCode = number

export type Callback = () => void

export class Workbook {
    public constructor() {
        this._id = new_workbook()
    }

    public undo(): boolean {
        return undo(this._id)
    }

    public redo(): boolean {
        return redo(this._id)
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
        if ('ok' in result.status) {
            switch (result.status.ok) {
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
        }
        return result
    }

    public load(buf: Uint8Array, bookName: string): ReturnCode {
        return read_file(this._id, bookName, buf)
    }

    public release() {
        release(this._id)
    }

    public getPatches(sheet_idx: number, version: number): DisplayResponse {
        const res = get_patches(this._id, sheet_idx, version)
        return res as DisplayResponse
    }

    public getSheetCount(): number {
        return get_sheet_count(this._id)
    }

    public getWorksheet(idx: number): Worksheet {
        if (idx >= this.getSheetCount())
            throw Error(`invalid sheet index: ${idx}`)
        return new Worksheet(this._id, idx)
    }

    public registryCustomFunc(customFunc: CustomFunc) {
        this._calculator.registry(customFunc)
    }

    private _addPayload(p: Payload) {
        if (p.type === 'cellInput')
            return cell_input(this._id, p.sheetIdx, p.row, p.col, p.input)
        if (p.type === 'insertRows')
            return row_insert(this._id, p.sheetIdx, p.start, p.cnt)
        if (p.type === 'deleteRows')
            return row_delete(this._id, p.sheetIdx, p.start, p.cnt)
        if (p.type === 'insertCols')
            return col_insert(this._id, p.sheetIdx, p.start, p.cnt)
        if (p.type === 'deleteCols')
            return col_delete(this._id, p.sheetIdx, p.start, p.cnt)
        if (p.type === 'createBlock')
            return create_block(
                this._id,
                p.sheetIdx,
                p.blockId,
                p.masterRow,
                p.masterCol,
                p.rowCnt,
                p.colCnt
            )

        if (p.type === 'moveBlock')
            return move_block(
                this._id,
                p.sheetIdx,
                p.blockId,
                p.newMasterRow,
                p.newMasterCol
            )
        if (p.type === 'setBorder')
            return set_border(
                this._id,
                p.sheetIdx,
                p.row,
                p.col,
                p.leftColor,
                p.rightColor,
                p.topColor,
                p.bottomColor,
                p.leftBorderType,
                p.rightBorderType,
                p.topBorderType,
                p.bottomBorderType,
                p.outline,
                p.diagonalUp,
                p.diagonalDown
            )
        if (p.type === 'setCellFont')
            return set_font(
                this._id,
                p.sheetIdx,
                p.row,
                p.col,
                p.bold,
                p.italic,
                p.name,
                p.underline,
                p.color,
                p.size,
                p.outline,
                p.shadow,
                p.strike,
                p.condense
            )
        if (p.type === 'setLineFont')
            return set_line_font(
                this._id,
                p.sheetIdx,
                p.from,
                p.to,
                p.row,
                p.bold,
                p.italic,
                p.name,
                p.underline,
                p.color,
                p.size,
                p.outline,
                p.shadow,
                p.strike,
                p.condense
            )
        if (p.type === 'blockInput')
            return block_input(
                this._id,
                p.sheetIdx,
                p.blockId,
                p.row,
                p.col,
                p.input
            )

        if (p.type === 'insertBlockCols')
            return block_line_shift(
                this._id,
                p.sheetIdx,
                p.blockId,
                p.colIdx,
                p.cnt,
                false,
                true
            )
        if (p.type === 'insertBlockRows')
            return block_line_shift(
                this._id,
                p.sheetIdx,
                p.blockId,
                p.rowIdx,
                p.cnt,
                true,
                true
            )
        if (p.type === 'deleteBlockRows')
            return block_line_shift(
                this._id,
                p.sheetIdx,
                p.blockId,
                p.rowIdx,
                p.cnt,
                true,
                false
            )
        if (p.type === 'deleteBlockCols')
            return block_line_shift(
                this._id,
                p.sheetIdx,
                p.blockId,
                p.colIdx,
                p.cnt,
                true,
                true
            )
        if (p.type === 'sheetRename') {
            if (p.oldName) {
                return sheet_rename_by_name(this._id, p.oldName, p.newName)
            }
            if (p.idx) {
                return sheet_rename_by_idx(this._id, p.idx, p.newName)
            }
        }
        if (p.type === 'deleteSheet') return delete_sheet(this._id, p.sheetIdx)
        if (p.type === 'insertSheet')
            return create_sheet(this._id, p.sheetIdx, p.name)
        if (p.type === 'cellClear')
            return cell_clear(this._id, p.sheetIdx, p.row, p.col)
        if (p.type === 'setColWidth')
            return set_col_width(this._id, p.sheetIdx, p.col, p.width)
        if (p.type === 'setRowHeight')
            return set_row_height(this._id, p.sheetIdx, p.row, p.height)
        if (p.type === 'setLineAlignment')
            return set_line_alignment(
                this._id,
                p.sheetIdx,
                p.row,
                p.from,
                p.to,
                p.alignment.horizontal,
                p.alignment.vertical
            )
        if (p.type === 'setCellAlignment')
            return set_cell_alignment(
                this._id,
                p.sheetIdx,
                p.row,
                p.col,
                p.alignment.horizontal,
                p.alignment.vertical
            )
        if (p.type === 'setCellPatternFill')
            return set_cell_pattern_fill(
                this._id,
                p.sheetIdx,
                p.row,
                p.col,
                p.fgColor,
                p.bgColor,
                p.pattern
            )
        if (p.type === 'setLinePatternFill')
            return set_line_pattern_fill(
                this._id,
                p.sheetIdx,
                p.row,
                p.from,
                p.to,
                p.fgColor,
                p.bgColor,
                p.pattern
            )
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
    // The book id which is generated by `WASM`
    private _id: number

    private _calculator = new Calculator()
}
