import {pxToPt, pxToWidth} from '../rate'
import {LeftTop} from '../settings'
import {RenderCell} from './render'
import {CellViewData, Rect, overlap, OverlapType} from './types'
import {Range, StandardColInfo, StandardRowInfo} from '@/core/standable'
import {ptToPx, width2px} from '@/core/rate'
import {DisplayWindowWithStartPoint, isErrorMessage} from 'logisheets-web'
import {Resp, WorkbookClient} from './workbook'

/**
 * The `ViewManager` is responsible for efficiently and seamlessly generating `CellViewData`.
 *
 * In scenarios such as scrolling, the `ViewManager` provides incremental data for the Canvas,
 * minimizing unnecessary repaints. This optimization reduces the workload for both the Canvas
 * and the WASM module, ensuring smooth performance by avoiding redundant calculations.
 */
export class ViewManager {
    constructor(private _workbook: WorkbookClient, private _sheetIdx: number) {}

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
        return this.getViewResponse(x, y, height, width)
    }

    public async getViewResponse(
        startX: number,
        startY: number,
        height: number,
        width: number
    ): Promise<CellViewResponse> {
        const x = Math.max(0, startX)
        const y = Math.max(0, startY)
        let targets = [new Rect(x, y, width, height)]
        const newChunks: CellViewData[] = []
        let uncovered = true
        let fullCovered = false
        for (let i = 0; i < this.dataChunks.length; i += 1) {
            const v = this.dataChunks[i]
            const rect = Rect.fromCellViewData(v)
            const result = overlap(targets, rect)
            if (result.ty === OverlapType.Uncovered) {
                continue
            }

            uncovered = false

            newChunks.push(v)
            targets = result.targets

            if (result.ty === OverlapType.FullyCovered) {
                fullCovered = true
                break
            }
        }
        const type = uncovered
            ? CellViewRespType.New
            : fullCovered
            ? CellViewRespType.Existed
            : CellViewRespType.Incremental

        const windowsPromise = targets.map((t) => {
            const window = this._workbook.getDisplayWindow({
                sheetIdx: this._sheetIdx,
                startX: pxToWidth(t.startX),
                startY: pxToPt(t.startY),
                height: pxToPt(t.height),
                width: pxToWidth(t.width),
            })
            return window
            // return parseDisplayWindow(window)
        })
        const windows = await Promise.all(windowsPromise)
        let data = windows
            .filter((w) => {
                if (isErrorMessage(w)) {
                    //
                    return false
                }
                return true
            })
            .map((w) => parseDisplayWindow(w as DisplayWindowWithStartPoint))

        if (type === CellViewRespType.New) {
            this.dataChunks = data
        } else if (type === CellViewRespType.Incremental) {
            newChunks.push(...data)
            this.dataChunks = newChunks
            data = this.dataChunks
        } else if (type === CellViewRespType.Existed) {
            data = newChunks
            this.dataChunks = newChunks
        }

        return {type, data}
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

export interface CellViewResponse {
    readonly type: CellViewRespType
    readonly data: CellViewData[]
}

export function parseDisplayWindow(
    window: DisplayWindowWithStartPoint
): CellViewData {
    const xStart = width2px(window.startX)
    const yStart = ptToPx(window.startY)

    let x = xStart
    const cols = window.window.cols.map((c) => {
        const colInfo = StandardColInfo.from(c)
        const renderCol = new RenderCell()
            .setCoordinate(
                new Range().setStartCol(colInfo.idx).setEndCol(colInfo.idx)
            )
            .setPosition(
                new Range()
                    .setStartCol(x)
                    .setEndCol(x + colInfo.px)
                    .setStartRow(0)
                    .setEndRow(LeftTop.height)
            )
        x += colInfo.px
        return renderCol
    })

    let y = yStart
    const rows = window.window.rows.map((r) => {
        const rowInfo = StandardRowInfo.from(r)
        const renderRow = new RenderCell()
            .setCoordinate(
                new Range().setStartRow(rowInfo.idx).setEndRow(rowInfo.idx)
            )
            .setPosition(
                new Range()
                    .setStartRow(y)
                    .setEndRow(y + rowInfo.px)
                    .setStartCol(0)
                    .setEndCol(LeftTop.width)
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
            const corrdinate = new Range()
                .setStartRow(row.coordinate.startRow)
                .setEndRow(row.coordinate.endRow)
                .setStartCol(col.coordinate.startCol)
                .setEndCol(col.coordinate.endCol)

            const position = new Range()
                .setStartRow(row.position.startRow)
                .setEndRow(row.position.endRow)
                .setStartCol(col.position.startCol)
                .setEndCol(col.position.endCol)
            const renderCell = new RenderCell()
                .setPosition(position)
                .setCoordinate(corrdinate)
                .setInfo(window.window.cells[idx])
            cells.push(renderCell)
            idx += 1
        }
    }

    window.window.mergeCells.forEach((m) => {
        let s: RenderCell | undefined
        for (const i in cells) {
            const cell = cells[i]
            if (
                cell.coordinate.startRow == m.rowStart &&
                cell.coordinate.startCol == m.colStart
            ) {
                s = cell
            } else if (
                cell.coordinate.endRow == m.rowEnd &&
                cell.coordinate.endCol == m.colEnd
            ) {
                if (s) s.setPosition(cell.position)
                return
            } else if (
                cell.coordinate.endRow < m.rowEnd &&
                cell.coordinate.endCol < m.colEnd &&
                cell.coordinate.startRow > m.rowStart &&
                cell.coordinate.startCol > m.colStart
            ) {
                cell.skipRender = true
            }
        }
    })

    return new CellViewData(rows, cols, cells, window.window.comments)
}
