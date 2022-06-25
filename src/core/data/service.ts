import { MAX_COUNT, SheetService } from './sheet'
import { ScrollPosition } from './scroll'
import { SETTINGS } from '../../common/settings'
import { RenderCell, ViewRange } from './view_range'
import { Backend } from './backend'
import { DisplayRequest } from '@/bindings'
import { Range } from '@/core/standable'
import { debugWeb } from '@/common'
export const CANVAS_OFFSET = 100


class DataService {
    constructor() {
        this._handleBackend()
    }
    scroll = new ScrollPosition()
    sheetSvc = new SheetService()
    backend = new Backend(this.sheetSvc)

    get cachedViewRange() {
        return this._viewRange
    }

    sendDisplayArea(version = 0): void {
        const req: DisplayRequest = {
            sheetIdx: this.sheetSvc.getActiveSheet(),
            version: version,
        }
        this.backend.send({ $case: 'displayRequest', displayRequest: req })
    }

    updateScroll(x?: number, y?: number): void {
        if ((x && x < 0) || (y && y < 0))
            // tslint:disable-next-line: no-throw-unless-asserts
            throw Error(`x'${x}' or y'${y}' should not lower than 0`)
        const scroll = ScrollPosition.copy(this.scroll)
        if (x !== undefined)
            scroll.x = x
        if (y !== undefined)
            scroll.y = y
        this.scroll = scroll
    }

    /**
     * filter?, freeze, scroll, hidden
     */
    initViewRange(maxWidth: number, maxHeight: number) {
        const scroll = this._getScrollPosition()
        const rows = this._initRows(maxHeight, scroll.row)
        const cols = this._initCols(maxWidth, scroll.col)
        const cells = this._initCells(rows, cols)
        const viewRange = new ViewRange()
        viewRange.rows = rows
        viewRange.cols = cols
        viewRange.cells = cells
        this._viewRange = viewRange
        debugWeb('init view range', viewRange)
        return this._viewRange
    }
    private _viewRange = new ViewRange()
    private _handleBackend(): void {
        this.backend.sheetUpdated$.subscribe(() => {
            this.sendDisplayArea()
        })
    }

    private _getScrollPosition() {
        let rowIndex = 0
        let i = -1
        while (i < MAX_COUNT) {
            i += 1
            if (rowIndex < this.scroll.y) {
                rowIndex += this.sheetSvc.getRowInfo(i).px
                continue
            }
            rowIndex = i
            break
        }
        i = -1
        let colIndex = 0
        while (i < MAX_COUNT) {
            i += 1
            if (colIndex < this.scroll.x) {
                colIndex += this.sheetSvc.getColInfo(i).px
                continue
            }
            colIndex = i
            break
        }
        return { row: rowIndex, col: colIndex }
    }

    private _initRows(maxHeight: number, scrollY: number) {
        const rows: RenderCell[] = []
        const getHeight = (i: number) => this.sheetSvc.getRowInfo(i).px
        const staticWidth = SETTINGS.leftTop.width
        for (let i = scrollY, y = SETTINGS.leftTop.height; i <= MAX_COUNT && y <= maxHeight; i += 1) {
            const isHidden = this.sheetSvc.getRowInfo(i).hidden
            if (isHidden)
                continue
            if (y > maxHeight)
                break
            const height = getHeight(i)
            const cell = new RenderCell()
                .setCoordinate(new Range().setStartRow(i).setEndRow(i))
                .setPosition(new Range()
                    .setStartRow(y)
                    .setEndRow(y + height)
                    .setEndCol(staticWidth))
            rows.push(cell)
            y += height
        }
        return rows
    }

    private _initCols(maxWidth: number, scrollX: number) {
        const cols: RenderCell[] = []
        const getWidth = (i: number) => this.sheetSvc.getColInfo(i).px
        const staticHeight = SETTINGS.leftTop.height
        for (let i = scrollX, x = SETTINGS.leftTop.width; i <= MAX_COUNT && x <= maxWidth; i += 1) {
            const isHidden = this.sheetSvc.getColInfo(i).hidden
            if (isHidden)
                continue
            if (x > maxWidth)
                break
            const width = getWidth(i)
            const cell = new RenderCell()
                .setPosition(new Range().setStartCol(x).setEndCol(x + width).setEndRow(staticHeight))
                .setCoordinate(new Range().setStartCol(i).setEndCol(i))
            cols.push(cell)
            x += width
        }
        return cols
    }

    private _initCells(
        rows: readonly RenderCell[],
        cols: readonly RenderCell[]
    ) {
        const renderedCells = new Set<string>()
        const merges = this.sheetSvc.getSheet()?.merges ?? []
        const cells: RenderCell[] = []
        rows.forEach(startRow => {
            // tslint:disable-next-line: max-func-body-length
            cols.forEach(startCol => {
                const key = `${startRow.coodinate.startRow}-${startCol.coodinate.startCol}`
                if (renderedCells.has(key))
                    return
                const coordinate = new Range()
                    .setStartRow(startRow.coodinate.startRow)
                    .setEndRow(startRow.coodinate.endRow)
                    .setStartCol(startCol.coodinate.startCol)
                    .setEndCol(startCol.coodinate.endCol)
                const mCells = merges.filter(m => m.cover(coordinate))
                // no merge cell
                if (mCells.length === 0) {
                    const cell = new RenderCell()
                        .setPosition(new Range()
                            .setStartRow(startRow.position.startRow)
                            .setEndRow(startRow.position.endRow)
                            .setStartCol(startCol.position.startCol)
                            .setEndCol(startCol.position.endCol))
                        .setCoordinate(coordinate)
                    renderedCells.add(key)
                    cells.push(cell)
                    return
                }
                mCells.forEach(cell => {
                    let endRow = startRow
                    let endCol = startCol
                    for (let mr = startRow.coodinate.startRow; mr <= cell.endRow; mr += 1) {
                        const tmpRow = rows
                            .find(r => r.coodinate.startRow === mr)
                        if (!tmpRow)
                            continue
                        endRow = tmpRow
                    }
                    for (let mc = startCol.coodinate.startCol; mc <= cell.endCol; mc += 1) {
                        const tmpCol = cols
                            .find(c => c.coodinate.startCol === mc)
                        if (!tmpCol)
                            continue
                        endCol = tmpCol
                    }
                    const c = new RenderCell()
                        .setPosition(new Range()
                            .setStartCol(startCol.position.startCol)
                            .setStartRow(startRow.position.startRow)
                            .setEndCol(endCol.position.endCol)
                            .setEndRow(endRow.position.endRow))
                        .setCoordinate(new Range()
                            .setStartRow(startRow.coodinate.startRow)
                            .setStartCol(startCol.coodinate.startCol)
                            .setEndCol(endCol.coodinate.endCol)
                            .setEndRow(endRow.coodinate.endRow))
                    cells.push(c)
                    for (let i = c.coodinate.startRow; i <= c.coodinate.endRow; i += 1)
                        for (let j = c.coodinate.startCol; j <= c.coodinate.endCol; j += 1)
                            renderedCells.add(`${i}-${j}`)
                })
            })
        })
        return cells
    }
}
export const DATA_SERVICE = new DataService()
