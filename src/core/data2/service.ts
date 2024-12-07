import {inject, injectable} from 'inversify'
import {getID} from '../ioc/id'
import {TYPES} from '../ioc/types'
import {WorkbookService} from './workbook'
import {RenderCell, RenderDataProvider, ViewRange} from './render'
import {ActionEffect, CustomFunc, Transaction, Comment} from '@logisheets_bg'
import {Scroll, ScrollImpl} from '../standable'
import {Range} from '@/core/standable'
import {ScrollbarType} from '@/components/scrollbar'
import {DisplayWindowWithStartPoint} from '@logisheets_bg'

export const MAX_COUNT = 100000000
export const CANVAS_OFFSET = 100

export interface DataService {
    registryCustomFunc: (f: CustomFunc) => void
    registryCellUpdatedCallback: (f: () => void) => void
    handleTransaction: (t: Transaction, undoable: boolean) => ActionEffect
    undo: () => void
    redo: () => void

    getCurrentSheet: () => number
    setCurrentSheet: (sheet: number) => void
    updateScroll: (type: ScrollbarType, top: number) => void
    getScroll: () => Scroll

    setWindowSize: (height: number, width: number) => void
    // According to the sheet scroll and the currentthe current window size,
    // fetch the cache or load data from WASM
    getCellViewData: () => CellViewData
    // Given the cell coordinate, get the cell view data
    jumpTo: (row: number, col: number) => CellViewData
}

@injectable()
export class DataServiceImpl implements DataService {
    readonly id = getID()
    constructor(
        @inject(TYPES.Data) private _workbook: WorkbookService,
        @inject(TYPES.Render) private _render: RenderDataProvider
    ) {
        this._init()
    }

    public registryCustomFunc(f: CustomFunc) {
        return this._workbook.registryCustomFunc(f)
    }

    public registryCellUpdatedCallback(f: () => void): void {
        return this._workbook.registryCellUpdatedCallback(f)
    }

    public handleTransaction(
        transaction: Transaction,
        undoable: boolean
    ): ActionEffect {
        return this._workbook.handleTransaction(transaction, undoable)
    }

    public undo(): void {
        return this._workbook.undo()
    }

    public redo(): void {
        return this._workbook.redo()
    }

    public setWindowSize(height: number, width: number): void {
        this._windowSize = {height, width}
    }

    public getCellViewData(): CellViewData {
        const sheet = this._currentSheet
        let cellView = this._cellViews.get(sheet)
        if (cellView?.data) return cellView.data
        if (!cellView) {
            cellView = new CellView()
        }
        const data = this._getCellViewData(
            sheet,
            cellView.scroll.x,
            cellView.scroll.y,
            this._windowSize.height,
            this._windowSize.width
        )
        cellView.data = data
        this._cellViews.set(sheet, cellView)
        return data
    }

    public updateScroll(type: ScrollbarType, top: number): void {
        const sheet = this._currentSheet
        let cellView = this._cellViews.get(sheet)
        if (!cellView) {
            cellView = new CellView()
        }
        cellView.scroll.update(type, top)
        this._cellViews.set(sheet, cellView)
        return
    }

    public getScroll(): Scroll {
        const sheet = this._currentSheet
        let cellView = this._cellViews.get(sheet)
        if (!cellView) {
            cellView = new CellView()
            this._cellViews.set(this._currentSheet, cellView)
        }
        return cellView.scroll
    }

    public getCurrentSheet(): number {
        return this._currentSheet
    }

    public setCurrentSheet(sheet: number): void {
        this._currentSheet = sheet
        return
    }

    public jumpTo(row: number, col: number): CellViewData {
        const window = this._workbook.getDisplayWindowWithCellPosition(
            this._currentSheet,
            row,
            col,
            this._windowSize.height,
            this._windowSize.width
        )
        const scroll = new ScrollImpl()
        scroll.update('x', window.startX)
        scroll.update('y', window.startY)

        const result = parseDisplayWindow(window)

        const cellView = new CellView(result, scroll)
        this._cellViews.set(this._currentSheet, cellView)
        return result
    }

    private _init() {
        this._workbook.registryCellUpdatedCallback((): void => {
            // Clear all the cache
            this._cellViews = new Map()
        })
    }

    private _getCellViewData(
        sheetIdx: number,
        startX: number,
        startY: number,
        height: number,
        width: number
    ): CellViewData {
        const window = this._workbook.getDisplayWindow(
            sheetIdx,
            startX,
            startY,
            height,
            width
        )
        const result = parseDisplayWindow(window)
        return result
    }

    private _windowSize: {height: number; width: number} = {height: 0, width: 0}

    private _cellViews: Map<number, CellView> = new Map()
    private _currentSheet = 0
}

export class CellView {
    public constructor(data?: CellViewData, scroll?: ScrollImpl) {
        if (data) {
            this.data = data
        }
        if (scroll) {
            this.scroll = scroll
        }
    }

    public data: CellViewData | null = null
    public scroll = new ScrollImpl()
}

export class CellViewData {
    public fromRow = 0
    public toRow = 0
    public fromCol = 0
    public toCol = 0

    constructor(
        public rows: readonly RenderCell[],
        public cols: readonly RenderCell[],
        public cells: readonly RenderCell[],
        public comments: readonly Comment[]
    ) {
        this.fromRow = rows[0].coordinate.startRow
        this.toRow = rows[-1].coordinate.endRow
        this.fromCol = cols[0].coordinate.startCol
        this.toCol = cols[-1].coordinate.endCol
    }
}

function parseDisplayWindow(window: DisplayWindowWithStartPoint): CellViewData {
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
