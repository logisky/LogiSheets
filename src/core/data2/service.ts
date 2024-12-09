import {inject, injectable} from 'inversify'
import {getID} from '../ioc/id'
import {TYPES} from '../ioc/types'
import {WorkbookService} from './workbook'
import {RenderCell} from './render'
import {ActionEffect, CustomFunc, Transaction, Workbook} from '@logisheets_bg'
import {Range} from '@/core/standable'
import {DisplayWindowWithStartPoint} from '@logisheets_bg'
import {CellViewResponse, ViewManager} from './view_manager'
import {CellViewData} from './types'

export const MAX_COUNT = 100000000
export const CANVAS_OFFSET = 100

export interface DataService {
    registryCustomFunc: (f: CustomFunc) => void
    registryCellUpdatedCallback: (f: () => void) => void
    handleTransaction: (t: Transaction) => ActionEffect
    undo: () => void
    redo: () => void

    getWorkbook: () => Workbook

    getCellView: (
        sheetIdx: number,
        startX: number,
        startY: number,
        height: number,
        width: number
    ) => CellViewResponse

    getCellViewWithCell: (
        sheetIdx: number,
        row: number,
        col: number,
        height: number,
        width: number
    ) => CellViewResponse

    getCurrentCellView: (sheetIdx: number) => readonly CellViewData[]
}

@injectable()
export class DataServiceImpl implements DataService {
    readonly id = getID()
    constructor(@inject(TYPES.Data) private _workbook: WorkbookService) {
        this._init()
    }
    public getWorkbook(): Workbook {
        return this._workbook.workbook
    }

    public registryCustomFunc(f: CustomFunc) {
        return this._workbook.registryCustomFunc(f)
    }

    public registryCellUpdatedCallback(f: () => void): void {
        return this._workbook.registryCellUpdatedCallback(f)
    }

    public handleTransaction(transaction: Transaction): ActionEffect {
        return this._workbook.handleTransaction(transaction, true)
    }

    public undo(): void {
        return this._workbook.undo()
    }

    public redo(): void {
        return this._workbook.redo()
    }

    public getCurrentCellView(sheetIdx: number): readonly CellViewData[] {
        const cacheManager = this._cellViews.get(sheetIdx)
        if (cacheManager) {
            return cacheManager.dataChunks
        }
        throw Error('trying to get cell view before rendering a sheet')
    }

    public getCellViewWithCell(
        sheetIdx: number,
        row: number,
        col: number,
        height: number,
        width: number
    ): CellViewResponse {
        const cacheManager = this._cellViews.get(sheetIdx)
        if (!cacheManager) {
            const manager = new ViewManager(this._workbook, sheetIdx)
            this._cellViews.set(sheetIdx, manager)
        }
        const viewManager = this._cellViews.get(sheetIdx) as ViewManager
        return viewManager.getViewResponseWithCell(row, col, height, width)
    }

    public getCellView(
        sheetIdx: number,
        startX: number,
        startY: number,
        height: number,
        width: number
    ): CellViewResponse {
        const cacheManager = this._cellViews.get(sheetIdx)
        if (!cacheManager) {
            const manager = new ViewManager(this._workbook, sheetIdx)
            this._cellViews.set(sheetIdx, manager)
        }
        const viewManager = this._cellViews.get(sheetIdx) as ViewManager
        return viewManager.getViewResponse(startX, startY, height, width)
    }

    private _init() {
        this._workbook.registryCellUpdatedCallback((): void => {
            // Clear all the cache
            this._cellViews = new Map()
        })
    }
    private _cellViews: Map<number, ViewManager> = new Map()
}

export function parseDisplayWindow(
    window: DisplayWindowWithStartPoint
): CellViewData {
    let y = window.startY
    const rows = window.window.rows.map((r) => {
        const renderRow = new RenderCell()
            .setCoordinate(new Range().setStartRow(r.idx).setEndRow(r.idx))
            .setPosition(
                new Range()
                    .setStartRow(y)
                    .setEndRow(y + r.height)
                    .setEndCol(window.startX)
            )
        y += r.height
        return renderRow
    })

    let x = window.startX
    const cols = window.window.cols.map((c) => {
        const renderCol = new RenderCell()
            .setCoordinate(new Range().setStartCol(c.idx).setEndCol(c.idx))
            .setPosition(
                new Range()
                    .setStartCol(x)
                    .setEndCol(x + c.width)
                    .setEndRow(window.startY)
            )
        x += renderCol.width
        return renderCol
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
