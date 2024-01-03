import {
    get_cell_info,
    get_col_info,
    get_col_width,
    get_formula,
    get_row_height,
    get_row_info,
    get_style,
    get_value,
} from '../../wasm'
import {ColInfo, RowInfo, Style, Value} from '../bindings'
import {CellInfo} from '../bindings/cell_info'
import {Result} from './utils'

export class Worksheet {
    public constructor(id: number, idx: number) {
        this._id = id
        this._sheetIdx = idx
    }

    public get_row_height(row_idx: number): Result<number> {
        return get_row_height(this._id, this._sheetIdx, row_idx)
    }

    public get_col_width(col_idx: number): Result<number> {
        return get_col_width(this._id, this._sheetIdx, col_idx)
    }

    public get_row_info(row_idx: number): Result<RowInfo> {
        return get_row_info(
            this._id,
            this._sheetIdx,
            row_idx
        ) as Result<RowInfo>
    }

    public get_col_info(col_idx: number): Result<ColInfo> {
        return get_col_info(
            this._id,
            this._sheetIdx,
            col_idx
        ) as Result<ColInfo>
    }

    public get_cell_info(row_idx: number, col_idx: number): Result<CellInfo> {
        return get_cell_info(
            this._id,
            this._sheetIdx,
            row_idx,
            col_idx
        ) as Result<CellInfo>
    }

    public get_formula(row_idx: number, col_idx: number): Result<string> {
        return get_formula(this._id, this._sheetIdx, row_idx, col_idx)
    }

    public get_style(row_idx: number, col_idx: number): Result<Style> {
        return get_style(this._id, this._sheetIdx, row_idx, col_idx)
    }

    public get_value(row_idx: number, col_idx: number): Result<Value> {
        return get_value(this._id, this._sheetIdx, row_idx, col_idx)
    }

    private _id: number
    private _sheetIdx: number
}
