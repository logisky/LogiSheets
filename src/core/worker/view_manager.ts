import {pxToPt, pxToWidth, widthToPx} from '../rate'
import {RenderCell} from './render'
import {CellViewData, Rect, CellView, Result} from './types'
import {ptToPx} from '@/core/rate'
import {DisplayWindowWithStartPoint, isErrorMessage, Resp} from 'logisheets-web'
import {Pool} from '../pool'
import {StandardValue} from '../standable/value'
import {StandardStyle} from '../standable/style'
import {IWorkbookWorker} from './types'
import {
    Range,
    StandardCell,
    StandardColInfo,
    StandardRowInfo,
} from '@/core/standable'

/**
 * The `ViewManager` is responsible for efficiently and seamlessly generating `CellViewData`.
 *
 * In scenarios such as scrolling, the `ViewManager` provides incremental data for the Canvas,
 * minimizing unnecessary repaints. This optimization reduces the workload for both the Canvas
 * and the WASM module, ensuring smooth performance by avoiding redundant calculations.
 */
export class ViewManager {
    constructor(
        private _workbook: IWorkbookWorker,
        private _sheetIdx: number,
        private _pool: Pool
    ) {}

    public getViewResponseWithCell(
        row: number,
        col: number,
        height: number,
        width: number
    ): Result<CellViewResponse> {
        const result = this._workbook.getCellPosition({
            sheetIdx: this._sheetIdx,
            row,
            col,
        })
        if (isErrorMessage(result)) return result
        const {x, y} = result
        return this.getViewResponse(widthToPx(x), ptToPx(y), height, width)
    }

    public getViewResponse(
        startX: number,
        startY: number,
        height: number,
        width: number
    ): Result<CellViewResponse> {
        const x = Math.max(0, startX)
        const y = Math.max(0, startY)
        const target = new Rect(x, y, width, height)
        const type = CellViewRespType.New

        const window = this._workbook.getDisplayWindow({
            sheetIdx: this._sheetIdx,
            startX: pxToWidth(target.startX),
            startY: pxToPt(target.startY),
            height: pxToPt(target.height),
            width: pxToWidth(target.width),
        })
        if (isErrorMessage(window)) return window
        const data = parseDisplayWindow(
            window,
            this._pool.getRenderCell.bind(this._pool),
            this._pool.getRange.bind(this._pool),
            this._pool.getStandardCell.bind(this._pool),
            this._pool.getStandardValue.bind(this._pool),
            this._pool.getStandardStyle.bind(this._pool)
        )

        this.dataChunks = [data]
        // make sure chunks are sorted. this matters rendering
        this.dataChunks.sort((a, b) => {
            return a.fromRow < b.fromRow || a.fromCol < b.fromCol ? -1 : 1
        })

        let anchorY = data.rows[0].position.startRow

        for (const r of data.rows) {
            if (anchorY >= startY) break
            anchorY += r.height
        }

        let anchorX = data.cols[0].position.startCol
        for (const c of data.cols) {
            if (anchorX >= startX) break
            anchorX += c.width
        }

        return {
            type,
            data: new CellView(this.dataChunks),
            request: {
                startX,
                startY,
                height,
                width,
            },
            anchorX,
            anchorY,
        }
    }

    /**
     * An array that stores a continuous sequence of `CellViewData` objects.
     * Overlap is allowed between neighboring views.
     */
    public dataChunks: CellViewData[] = []
}

export enum CellViewRespType {
    Existed,
    Incremental,
    New,
}

export interface CellViewRequest {
    readonly startX: number
    readonly startY: number
    readonly height: number
    readonly width: number
}

export interface CellViewResponse {
    readonly type: CellViewRespType
    readonly data: CellView
    readonly request: CellViewRequest
    readonly anchorX: number
    readonly anchorY: number
}

export function parseDisplayWindow(
    window: DisplayWindowWithStartPoint,
    getRenderCell: () => RenderCell,
    getRange: () => Range,
    getStandardCell: () => StandardCell,
    getStandardValue: () => StandardValue,
    getStandardStyle: () => StandardStyle
): CellViewData {
    const xStart = widthToPx(window.startX)
    const yStart = ptToPx(window.startY)

    let x = xStart
    const cols = window.window.cols.map((c) => {
        const colInfo = StandardColInfo.from(c)
        const renderCol = getRenderCell()
            .setCoordinate(
                getRange().setStartCol(colInfo.idx).setEndCol(colInfo.idx)
            )
            .setPosition(
                getRange()
                    .setStartCol(x)
                    .setEndCol(x + colInfo.px)
                    .setStartRow(0)
                    .setEndRow(0)
            )
        x += colInfo.px
        return renderCol
    })

    let y = yStart
    const rows = window.window.rows.map((r) => {
        const rowInfo = StandardRowInfo.from(r)
        const renderRow = getRenderCell()
            .setCoordinate(
                getRange().setStartRow(rowInfo.idx).setEndRow(rowInfo.idx)
            )
            .setPosition(
                getRange()
                    .setStartRow(y)
                    .setEndRow(y + rowInfo.px)
                    .setStartCol(0)
                    .setEndCol(0)
            )
        y += rowInfo.px
        return renderRow
    })

    const cells: RenderCell[] = []
    let idx = 0
    for (let r = 0; r < rows.length; r += 1) {
        for (let c = 0; c < cols.length; c += 1) {
            const row = rows[r]
            const col = cols[c]
            const corrdinate = getRange()
                .setStartRow(row.coordinate.startRow)
                .setEndRow(row.coordinate.endRow)
                .setStartCol(col.coordinate.startCol)
                .setEndCol(col.coordinate.endCol)

            const position = getRange()
                .setStartRow(row.position.startRow)
                .setEndRow(row.position.endRow)
                .setStartCol(col.position.startCol)
                .setEndCol(col.position.endCol)
            const renderCell = getRenderCell()
                .setPosition(position)
                .setCoordinate(corrdinate)
                .setInfo(
                    window.window.cells[idx],
                    getStandardCell,
                    getStandardValue,
                    getStandardStyle
                )
            cells.push(renderCell)
            idx += 1
        }
    }

    const mergeCells = window.window.mergeCells.map((m) => {
        const fromRow = rows[0].coordinate.startRow
        const toRow = rows[rows.length - 1].coordinate.endRow
        const fromCol = cols[0].coordinate.startCol
        const toCol = cols[cols.length - 1].coordinate.endCol
        const startRow = Math.min(Math.max(fromRow, m.startRow), toRow)
        const startCol = Math.min(Math.max(fromCol, m.startCol), toCol)
        const masterIdx = locate(
            fromRow,
            fromCol,
            startRow,
            startCol,
            cols.length
        )
        const masterCell = cells[masterIdx]

        const endRow = Math.min(Math.max(fromRow, m.endRow), toRow)
        const endCol = Math.min(Math.max(fromCol, m.endCol), toCol)
        const endIdx = locate(fromRow, fromCol, endRow, endCol, cols.length)
        const endCell = cells[endIdx]

        const coordinate = getRange()
            .setStartRow(masterCell.coordinate.startRow)
            .setStartCol(masterCell.coordinate.startCol)
            .setEndRow(endCell.coordinate.endRow)
            .setEndCol(endCell.coordinate.endCol)
        const position = getRange()
            .setStartRow(masterCell.position.startRow)
            .setStartCol(masterCell.position.startCol)
            .setEndRow(endCell.position.endRow)
            .setEndCol(endCell.position.endCol)

        const renderCell = getRenderCell()
            .setPosition(position)
            .setCoordinate(coordinate)
            .setStandardCell(masterCell.info)
        return renderCell
    })

    return new CellViewData(
        rows,
        cols,
        cells,
        mergeCells,
        window.window.comments,
        window.window.blocks
    )
}

function locate(
    fromRow: number,
    fromCol: number,
    row: number,
    col: number,
    colCnt: number
): number {
    const result = (row - fromRow) * colCnt + (col - fromCol)
    return result
}
