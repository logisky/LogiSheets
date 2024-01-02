import {get_col_width, get_row_height} from '../../wasm'

export class Worksheet {
    public constructor(id: number, idx: number) {
        this._id = id
        this._sheetIdx = idx
    }

    public get_row_height(row_idx: number): number {
        return get_row_height(this._id, this._sheetIdx, row_idx)
    }

    public get_col_width(col_idx: number): number {
        return get_col_width(this._id, this._sheetIdx, col_idx)
    }

    private _id: number
    private _sheetIdx: number
}
