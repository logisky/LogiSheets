import {
    get_cell_info,
    get_col_info,
    get_col_width,
    get_formula,
    get_row_height,
    get_row_info,
    get_style,
    get_value,
    get_display_window,
    get_display_window_with_start_point,
    get_display_window_within_cell,
    get_cell_position,
    get_all_fully_covered_blocks,
    get_sheet_dimension,
} from '../../wasm'
import {
    BlockInfo,
    CellPosition,
    ColInfo,
    DisplayWindow,
    DisplayWindowWithStartPoint,
    RowInfo,
    Style,
    Value,
    CellInfo,
    SheetDimension,
} from '../bindings'
import {Cell} from './cell'
import {isErrorMessage, Result} from './utils'

export class Worksheet {
    public constructor(id: number, idx: number) {
        this._id = id
        this._sheetIdx = idx
    }

    public getSheetDimension(): Result<SheetDimension> {
        return get_sheet_dimension(this._id, this._sheetIdx)
    }

    public getDisplayWindow(
        startRow: number,
        endRow: number,
        startCol: number,
        endCol: number
    ): Result<DisplayWindow> {
        return get_display_window(
            this._id,
            this._sheetIdx,
            startRow,
            endRow,
            startCol,
            endCol
        )
    }

    public getDisplayWindowWithStartPoint(
        startX: number,
        startY: number,
        height: number,
        width: number
    ): DisplayWindowWithStartPoint {
        return get_display_window_with_start_point(
            this._id,
            this._sheetIdx,
            startX,
            startY,
            height,
            width
        )
    }

    public getCellPosition(row: number, col: number): CellPosition {
        const result = get_cell_position(this._id, this._sheetIdx, row, col)
        return result
    }

    public getDisplayWindowWithCellPosition(
        row: number,
        col: number,
        height: number,
        width: number
    ): DisplayWindowWithStartPoint {
        return get_display_window_within_cell(
            this._id,
            this._sheetIdx,
            row,
            col,
            height,
            width
        )
    }

    public getRowHeight(rowIdx: number): Result<number> {
        return get_row_height(this._id, this._sheetIdx, rowIdx)
    }

    public getColWidth(colIdx: number): Result<number> {
        return get_col_width(this._id, this._sheetIdx, colIdx)
    }

    public getRowInfo(rowIdx: number): Result<RowInfo> {
        return get_row_info(this._id, this._sheetIdx, rowIdx) as Result<RowInfo>
    }

    public getColInfo(colIdx: number): Result<ColInfo> {
        return get_col_info(this._id, this._sheetIdx, colIdx) as Result<ColInfo>
    }

    public getCellInfo(rowIdx: number, colIdx: number): Result<CellInfo> {
        const cellInfo = get_cell_info(
            this._id,
            this._sheetIdx,
            rowIdx,
            colIdx
        ) as Result<CellInfo>
        return cellInfo
    }

    public getCell(rowIdx: number, colIdx: number): Result<Cell> {
        const cellInfo = this.getCellInfo(rowIdx, colIdx)
        if (isErrorMessage(cellInfo)) {
            return cellInfo
        }
        return new Cell(cellInfo)
    }

    public getFormula(rowIdx: number, colIdx: number): Result<string> {
        return get_formula(this._id, this._sheetIdx, rowIdx, colIdx)
    }

    public getStyle(rowIdx: number, colIdx: number): Result<Style> {
        return get_style(this._id, this._sheetIdx, rowIdx, colIdx)
    }

    public getValue(rowIdx: number, colIdx: number): Result<Value> {
        return get_value(this._id, this._sheetIdx, rowIdx, colIdx)
    }

    public getFullyCoveredBlocks(
        rowIdx: number,
        colIdx: number,
        rowCnt: number,
        colCnt: number
    ): Result<BlockInfo[]> {
        return get_all_fully_covered_blocks(
            this._id,
            this._sheetIdx,
            rowIdx,
            colIdx,
            rowCnt,
            colCnt
        )
    }

    private _id: number
    private _sheetIdx: number
}
