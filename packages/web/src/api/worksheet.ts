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
    get_sheet_id,
} from '../../wasm'
import {get_merged_cells} from '../../wasm/logisheets_wasm_server'
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
    MergeCell,
} from '../bindings'
import {Cell} from './cell'
import {isErrorMessage, Result} from './utils'

export class Worksheet {
    public constructor(id: number, sheetIdxOrId: number, isSheetIdx = true) {
        this._id = id
        if (isSheetIdx) {
            this._sheetId = get_sheet_id(id, sheetIdxOrId)
        } else {
            this._sheetId = sheetIdxOrId
        }
    }

    public getSheetDimension(): Result<SheetDimension> {
        return get_sheet_dimension(this._id, this._sheetId)
    }

    public getDisplayWindow(
        startRow: number,
        endRow: number,
        startCol: number,
        endCol: number
    ): Result<DisplayWindow> {
        return get_display_window(
            this._id,
            this._sheetId,
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
            this._sheetId,
            startX,
            startY,
            height,
            width
        )
    }

    public getCellPosition(row: number, col: number): CellPosition {
        const result = get_cell_position(this._id, this._sheetId, row, col)
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
            this._sheetId,
            row,
            col,
            height,
            width
        )
    }

    public getRowHeight(rowIdx: number): Result<number> {
        return get_row_height(this._id, this._sheetId, rowIdx)
    }

    public getColWidth(colIdx: number): Result<number> {
        return get_col_width(this._id, this._sheetId, colIdx)
    }

    public getRowInfo(rowIdx: number): Result<RowInfo> {
        return get_row_info(this._id, this._sheetId, rowIdx) as Result<RowInfo>
    }

    public getColInfo(colIdx: number): Result<ColInfo> {
        return get_col_info(this._id, this._sheetId, colIdx) as Result<ColInfo>
    }

    public getCellInfo(rowIdx: number, colIdx: number): Result<CellInfo> {
        const cellInfo = get_cell_info(
            this._id,
            this._sheetId,
            rowIdx,
            colIdx
        ) as Result<CellInfo>
        return cellInfo
    }

    public getMergedCells(
        startRow: number,
        startCol: number,
        endRow: number,
        endCol: number
    ): readonly MergeCell[] {
        return get_merged_cells(
            this._id,
            this._sheetId,
            startRow,
            startCol,
            endRow,
            endCol
        )
    }

    public getCell(rowIdx: number, colIdx: number): Result<Cell> {
        const cellInfo = this.getCellInfo(rowIdx, colIdx)
        if (isErrorMessage(cellInfo)) {
            return cellInfo
        }
        return new Cell(cellInfo)
    }

    public getFormula(rowIdx: number, colIdx: number): Result<string> {
        return get_formula(this._id, this._sheetId, rowIdx, colIdx)
    }

    public getStyle(rowIdx: number, colIdx: number): Result<Style> {
        return get_style(this._id, this._sheetId, rowIdx, colIdx)
    }

    public getValue(rowIdx: number, colIdx: number): Result<Value> {
        return get_value(this._id, this._sheetId, rowIdx, colIdx)
    }

    public getFullyCoveredBlocks(
        rowIdx: number,
        colIdx: number,
        rowCnt: number,
        colCnt: number
    ): Result<BlockInfo[]> {
        return get_all_fully_covered_blocks(
            this._id,
            this._sheetId,
            rowIdx,
            colIdx,
            rowCnt,
            colCnt
        )
    }

    private _id: number
    private _sheetId: number
}
