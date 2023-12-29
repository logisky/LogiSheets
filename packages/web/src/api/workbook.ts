import {Payload} from '../payloads'
import {
    new_workbook,
    undo,
    redo,
    transaction_end,
    transaction_start,
    cell_input,
    row_insert,
    row_delete,
    col_insert,
    col_delete,
    create_block,
    move_block,
    block_input,
    set_font,
    set_border,
    read_file,
    release,
    input_async_result,
    get_patches,
    block_line_shift,
    sheet_rename_by_idx,
    sheet_rename_by_name,
    create_sheet,
    delete_sheet,
} from '../../wasm/logisheets_wasm_server'
import {ActionEffect, AsyncFuncResult, DisplayResponse} from '../bindings'
import {Transaction} from '../transactions'

export type ReturnCode = number

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

    public execTransaction(tx: Transaction, undoable: boolean): ActionEffect {
        transaction_start(this._id)
        tx.payloads.forEach((p: Payload) => {
            this._addPayload(p)
        })
        return transaction_end(this._id, undoable) as ActionEffect
    }

    public load(buf: Uint8Array, book_name: string): ReturnCode {
        return read_file(this._id, book_name, buf)
    }

    public release() {
        release(this._id)
    }

    public inputAsyncResult(r: AsyncFuncResult): ActionEffect {
        return input_async_result(this._id, r) as ActionEffect
    }

    public getPatches(sheet_idx: number, version: number): DisplayResponse {
        const res = get_patches(this._id, sheet_idx, version)
        return res as DisplayResponse
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
        if (p.type === 'setFont')
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
        // eslint-disable-next-line no-console
        console.log('Unimplemented!')
    }
    private _id: number
}
