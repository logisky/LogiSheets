import {parseDisplayWindow} from './service'
import {CellViewData, Rect, overlap, OverlapType} from './types'
import {WorkbookService} from './workbook'

/**
 * The `ViewManager` is responsible for efficiently and seamlessly generating `CellViewData`.
 *
 * In scenarios such as scrolling, the `ViewManager` provides incremental data for the Canvas,
 * minimizing unnecessary repaints. This optimization reduces the workload for both the Canvas
 * and the WASM module, ensuring smooth performance by avoiding redundant calculations.
 */
export class ViewManager {
    constructor(
        private _workbook: WorkbookService,
        private _sheetIdx: number
    ) {}

    public getViewResponseWithCell(
        row: number,
        col: number,
        height: number,
        width: number
    ): CellViewResponse {
        const sheet = this._workbook.getSheetByIdx(this._sheetIdx)
        const {x, y} = sheet.getCellPosition(row, col)
        return this.getViewResponse(
            x - 0.5 * width,
            y - 0.5 * height,
            height,
            width
        )
    }

    public getViewResponse(
        startX: number,
        startY: number,
        height: number,
        width: number
    ): CellViewResponse {
        let targets = [new Rect(startX, startY, width, height)]
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

        let data = targets.map((t) => {
            const window = this._workbook.getDisplayWindow(
                this._sheetIdx,
                t.startX,
                t.startY,
                t.height,
                t.width
            )
            return parseDisplayWindow(window)
        })

        if (type === CellViewRespType.New) {
            this.dataChunks = data
        } else if (type === CellViewRespType.Incremental) {
            newChunks.push(...data)
            this.dataChunks = newChunks
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
