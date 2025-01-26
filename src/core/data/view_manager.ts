import {pxToPt, pxToWidth, widthToPx} from '../rate'
import {LeftTop} from '../settings'
import {RenderCell} from './render'
import {CellViewData, Rect, CellView} from './types'
import {
    Range,
    StandardCell,
    StandardColInfo,
    StandardRowInfo,
} from '@/core/standable'
import {ptToPx, width2px} from '@/core/rate'
import {DisplayWindowWithStartPoint, isErrorMessage} from 'logisheets-web'
import {Resp, WorkbookClient} from './workbook'
import {Pool} from '../pool'
import {StandardValue} from '../standable/value'
import {StandardStyle} from '../standable/style'

/**
 * The `ViewManager` is responsible for efficiently and seamlessly generating `CellViewData`.
 *
 * In scenarios such as scrolling, the `ViewManager` provides incremental data for the Canvas,
 * minimizing unnecessary repaints. This optimization reduces the workload for both the Canvas
 * and the WASM module, ensuring smooth performance by avoiding redundant calculations.
 */
export class ViewManager {
    constructor(
        private _workbook: WorkbookClient,
        private _sheetIdx: number,
        private _pool: Pool
    ) {}

    public async getViewResponseWithCell(
        row: number,
        col: number,
        height: number,
        width: number
    ): Resp<CellViewResponse> {
        const result = await this._workbook.getCellPosition({
            sheetIdx: this._sheetIdx,
            row,
            col,
        })
        if (isErrorMessage(result)) return result
        const {x, y} = result
        return this.getViewResponse(widthToPx(x), ptToPx(y), height, width)
    }

    public async getViewResponse(
        startX: number,
        startY: number,
        height: number,
        width: number
    ): Promise<CellViewResponse> {
        const x = Math.max(0, startX)
        const y = Math.max(0, startY)
        const targets = [new Rect(x, y, width, height)]
        const newChunks: CellViewData[] = []
        const type = CellViewRespType.New

        const windowsPromise = targets.map((t) => {
            const window = this._workbook.getDisplayWindow({
                sheetIdx: this._sheetIdx,
                startX: pxToWidth(t.startX),
                startY: pxToPt(t.startY),
                height: pxToPt(t.height),
                width: pxToWidth(t.width),
            })
            return window
        })
        const windows = await Promise.all(windowsPromise)
        const data = windows
            .filter((w) => !isErrorMessage(w))
            .map((w) => {
                return parseDisplayWindow(
                    w as DisplayWindowWithStartPoint,
                    this._pool.getRenderCell.bind(this._pool),
                    this._pool.getRange.bind(this._pool),
                    this._pool.getStandardCell.bind(this._pool),
                    this._pool.getStandardValue.bind(this._pool),
                    this._pool.getStandardStyle.bind(this._pool)
                )
            })

        if (type === CellViewRespType.New) {
            this.dataChunks = data
        } else if (type === CellViewRespType.Incremental) {
            newChunks.push(...data)
            this.dataChunks = newChunks
        } else if (type === CellViewRespType.Existed) {
            this.dataChunks = newChunks
        }
        // make sure chunks are sorted. this matters rendering
        this.dataChunks.sort((a, b) => {
            return a.fromRow < b.fromRow || a.fromCol < b.fromCol ? -1 : 1
        })

        return {
            type,
            data: new CellView(this.dataChunks),
            request: {
                startX,
                startY,
                height,
                width,
            },
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
        const masterIdx = locate(cols.length, m.startRow, m.startCol)
        const masterCell = cells[masterIdx]

        const endIdx = locate(cols.length, m.endRow, m.endCol)
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
        window.window.comments
    )
}

function locate(colCnt: number, row: number, col: number): number {
    return row * colCnt + col
}
