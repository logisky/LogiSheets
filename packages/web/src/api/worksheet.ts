import {handle} from '../../wasm/logisheets_wasm_server'
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
    AppendixWithCell,
    ReproducibleCell,
    SheetCoordinate,
    CellInput,
    Comment,
    CellImageInfo,
} from '../bindings'
import {Cell} from './cell'
import {isErrorMessage, Result} from './utils'

function rpc(
    method: string,
    params?: Record<string, unknown>,
    bookId?: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
    const msg = params === undefined ? method : {method, value: params}
    return handle(msg, bookId ?? null)
}

export class Worksheet {
    public constructor(id: number, sheetIdxOrId: number, isSheetIdx = true) {
        this._id = id
        if (isSheetIdx) {
            this._sheetIdx = sheetIdxOrId
            this._sheetId = rpc(
                'getSheetId',
                {sheetIdx: sheetIdxOrId},
                id
            ) as number
        } else {
            this._sheetId = sheetIdxOrId
            this._sheetIdx = rpc(
                'getSheetIdx',
                {sheetId: sheetIdxOrId},
                id
            ) as number
        }
    }

    public getSheetDimension(): Result<SheetDimension> {
        return rpc('getSheetDimension', {sheetId: this._sheetId}, this._id)
    }

    public getDisplayWindow(
        startRow: number,
        endRow: number,
        startCol: number,
        endCol: number
    ): Result<DisplayWindow> {
        return rpc(
            'getDisplayWindow',
            {sheetIdx: this._sheetIdx, startRow, endRow, startCol, endCol},
            this._id
        )
    }

    public getDisplayWindowWithStartPoint(
        startX: number,
        startY: number,
        height: number,
        width: number
    ): DisplayWindowWithStartPoint {
        return rpc(
            'getDisplayWindowWithStartPoint',
            {sheetIdx: this._sheetIdx, startX, startY, height, width},
            this._id
        )
    }

    public getCellPosition(row: number, col: number): CellPosition {
        return rpc(
            'getCellPosition',
            {sheetIdx: this._sheetIdx, row, col},
            this._id
        )
    }

    public getNextUpwardVisibleCell(row: number, col: number): CellPosition {
        return rpc(
            'getNextVisibleCell',
            {
                sheetIdx: this._sheetIdx,
                rowIdx: row,
                colIdx: col,
                direction: 'up',
            },
            this._id
        )
    }

    public getNextDownwardVisibleCell(row: number, col: number): CellPosition {
        return rpc(
            'getNextVisibleCell',
            {
                sheetIdx: this._sheetIdx,
                rowIdx: row,
                colIdx: col,
                direction: 'down',
            },
            this._id
        )
    }

    public getNextLeftwardVisibleCell(row: number, col: number): CellPosition {
        return rpc(
            'getNextVisibleCell',
            {
                sheetIdx: this._sheetIdx,
                rowIdx: row,
                colIdx: col,
                direction: 'left',
            },
            this._id
        )
    }

    public getNextRightwardVisibleCell(row: number, col: number): CellPosition {
        return rpc(
            'getNextVisibleCell',
            {
                sheetIdx: this._sheetIdx,
                rowIdx: row,
                colIdx: col,
                direction: 'right',
            },
            this._id
        )
    }

    // Ctrl+Arrow: jump to the next data/block boundary. Returns an
    // ErrorMessage when there is no boundary ahead (caller shows a hint).
    public getUpwardDataBoundary(row: number, col: number): CellPosition {
        return rpc(
            'getDataBoundary',
            {sheetIdx: this._sheetIdx, rowIdx: row, colIdx: col, direction: 'up'},
            this._id
        )
    }

    public getDownwardDataBoundary(row: number, col: number): CellPosition {
        return rpc(
            'getDataBoundary',
            {
                sheetIdx: this._sheetIdx,
                rowIdx: row,
                colIdx: col,
                direction: 'down',
            },
            this._id
        )
    }

    public getLeftwardDataBoundary(row: number, col: number): CellPosition {
        return rpc(
            'getDataBoundary',
            {
                sheetIdx: this._sheetIdx,
                rowIdx: row,
                colIdx: col,
                direction: 'left',
            },
            this._id
        )
    }

    public getRightwardDataBoundary(row: number, col: number): CellPosition {
        return rpc(
            'getDataBoundary',
            {
                sheetIdx: this._sheetIdx,
                rowIdx: row,
                colIdx: col,
                direction: 'right',
            },
            this._id
        )
    }

    public getDisplayWindowWithCellPosition(
        row: number,
        col: number,
        height: number,
        width: number
    ): DisplayWindowWithStartPoint {
        return rpc(
            'getDisplayWindowWithinCell',
            {sheetIdx: this._sheetIdx, row, col, height, width},
            this._id
        )
    }

    public getBlockDisplayWindow(blockId: number): Result<DisplayWindow> {
        return rpc(
            'getBlockDisplayWindow',
            {sheetId: this._sheetId, blockId},
            this._id
        )
    }

    public getRowHeight(rowIdx: number): Result<number> {
        return rpc('getRowHeight', {sheetId: this._sheetId, rowIdx}, this._id)
    }

    public getColWidth(colIdx: number): Result<number> {
        return rpc('getColWidth', {sheetId: this._sheetId, colIdx}, this._id)
    }

    public getRowInfo(rowIdx: number): Result<RowInfo> {
        return rpc(
            'getRowInfo',
            {sheetIdx: this._sheetIdx, rowIdx},
            this._id
        ) as Result<RowInfo>
    }

    public getColInfo(colIdx: number): Result<ColInfo> {
        return rpc(
            'getColInfo',
            {sheetIdx: this._sheetIdx, colIdx},
            this._id
        ) as Result<ColInfo>
    }

    public getCellInfo(rowIdx: number, colIdx: number): Result<CellInfo> {
        return rpc(
            'getCell',
            {sheetIdx: this._sheetIdx, row: rowIdx, col: colIdx},
            this._id
        ) as Result<CellInfo>
    }

    public getReproducibleCell(
        rowIdx: number,
        colIdx: number
    ): Result<ReproducibleCell> {
        return rpc(
            'getReproducibleCell',
            {sheetIdx: this._sheetIdx, row: rowIdx, col: colIdx},
            this._id
        )
    }

    public getReproducibleCells(
        coordinates: readonly SheetCoordinate[]
    ): Result<readonly ReproducibleCell[]> {
        return rpc(
            'getReproducibleCells',
            {sheetIdx: this._sheetIdx, coordinates},
            this._id
        )
    }

    public getCellInfos(
        startRow: number,
        startCol: number,
        endRow: number,
        endCol: number
    ): Result<readonly CellInfo[]> {
        return rpc(
            'getCellInfos',
            {sheetIdx: this._sheetIdx, startRow, startCol, endRow, endCol},
            this._id
        )
    }

    public getCellInfosExceptWindow(
        startRow: number,
        startCol: number,
        endRow: number,
        endCol: number,
        windowStartRow: number,
        windowStartCol: number,
        windowEndRow: number,
        windowEndCol: number
    ): Result<readonly CellInfo[]> {
        return rpc(
            'getCellsExceptWindow',
            {
                sheetIdx: this._sheetIdx,
                startRow,
                startCol,
                endRow,
                endCol,
                windowStartRow,
                windowStartCol,
                windowEndRow,
                windowEndCol,
            },
            this._id
        )
    }

    /**
     * Predict the fill-handle result: given a source block and the target
     * block the user dragged over, returns one `CellInput` per target cell
     * (formula relative-reference shift, arithmetic series, or value copy).
     *
     * This is a pure read-only query — it does not mutate the workbook. The
     * caller wraps the returned inputs in a single transaction (see
     * `Workbook.fill`) so the fill is one undo step. `src` and `dst` must
     * align on a single axis (a pure vertical or horizontal drag).
     */
    public predictFill(
        src: {
            startRow: number
            startCol: number
            endRow: number
            endCol: number
        },
        dst: {
            startRow: number
            startCol: number
            endRow: number
            endCol: number
        }
    ): Result<readonly CellInput[]> {
        return rpc(
            'predictFill',
            {
                sheetIdx: this._sheetIdx,
                srcStartRow: src.startRow,
                srcStartCol: src.startCol,
                srcEndRow: src.endRow,
                srcEndCol: src.endCol,
                dstStartRow: dst.startRow,
                dstStartCol: dst.startCol,
                dstEndRow: dst.endRow,
                dstEndCol: dst.endCol,
            },
            this._id
        )
    }

    public getBlockInfo(blockId: number): BlockInfo {
        return rpc('getBlockInfo', {sheetId: this._sheetId, blockId}, this._id)
    }

    public getMergedCells(
        startRow: number,
        startCol: number,
        endRow: number,
        endCol: number
    ): readonly MergeCell[] {
        return rpc(
            'getMergedCells',
            {sheetIdx: this._sheetIdx, startRow, startCol, endRow, endCol},
            this._id
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
        return rpc(
            'getFormula',
            {sheetIdx: this._sheetIdx, row: rowIdx, col: colIdx},
            this._id
        )
    }

    public getStyle(rowIdx: number, colIdx: number): Result<Style> {
        return rpc(
            'getStyle',
            {sheetIdx: this._sheetIdx, row: rowIdx, col: colIdx},
            this._id
        )
    }

    public getValue(rowIdx: number, colIdx: number): Result<Value> {
        return rpc(
            'getValue',
            {sheetIdx: this._sheetIdx, row: rowIdx, col: colIdx},
            this._id
        )
    }

    public getDiyCellIdWithBlockId(
        blockId: number,
        row: number,
        col: number
    ): Result<number> {
        const cellId = rpc(
            'getDiyCellIdWithBlockId',
            {sheetId: this._sheetId, blockId, row, col},
            this._id
        )
        if (cellId === undefined) {
            return {msg: 'Cell not found', ty: 0}
        }
        return cellId
    }

    public lookupAppendixUpward(
        blockId: number,
        row: number,
        col: number,
        craftId: string,
        tag: number
    ): Result<AppendixWithCell> {
        return rpc(
            'lookupAppendixUpward',
            {
                sheetId: this._sheetId,
                blockId,
                row,
                col,
                craftId,
                tag,
            },
            this._id
        )
    }

    /**
     * All comment threads on this sheet. Each `Comment` is a cell-anchored
     * thread whose `notes` carry author identity, timestamp, text and resolved
     * `@mentions`. Mutations go through the workbook transaction API
     * (`addComment` / `editComment` / `deleteComment` / `resolveComment`).
     */
    public getComments(): Result<Comment[]> {
        return rpc('getComments', {sheetIdx: this._sheetIdx}, this._id)
    }

    /**
     * All images placed in this sheet's cells. Each `CellImageInfo` carries the
     * cell `(row, col)`, the image `format` (bare extension, e.g. `png`) and
     * the base64-encoded image `data`. Mutations go through the workbook
     * transaction API (`SetCellImage` / `DeleteCellImage`).
     */
    public getCellImages(): Result<CellImageInfo[]> {
        return rpc('getCellImages', {sheetIdx: this._sheetIdx}, this._id)
    }

    public getFullyCoveredBlocks(
        rowIdx: number,
        colIdx: number,
        rowCnt: number,
        colCnt: number
    ): Result<BlockInfo[]> {
        return rpc(
            'getFullyCoveredBlocks',
            {
                sheetId: this._sheetId,
                row: rowIdx,
                col: colIdx,
                rowCnt,
                colCnt,
            },
            this._id
        )
    }

    private _id: number
    private _sheetId: number
    private _sheetIdx: number
}
