import { MAX_COUNT, SheetService } from './sheet'
import { ScrollPosition } from './scroll'
import { SETTINGS } from '../../common/settings'
import { RenderCell, ViewRange } from './view_range'
import { Backend } from './backend'
import { DisplayRequest } from 'proto/message'
import { Range } from 'core/standable'
import { debugWeb } from 'common'
export const CANVAS_OFFSET = 100


export class DataService {
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
        const { width, height } = SETTINGS.defaultCellSize
        let rowIndex = 0
        let i = -1
        while (i < MAX_COUNT) {
            i += 1
            if (rowIndex < this.scroll.y) {
                rowIndex += this.sheetSvc.getRowInfo(i)?.px ?? height
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
                colIndex += this.sheetSvc.getColInfo(i)?.px ?? width
                continue
            }
            colIndex = i
            break
        }
        return { row: rowIndex, col: colIndex }
    }

    private _initRows(maxHeight: number, scrollY: number) {
        const rows: RenderCell[] = []
        const getHeight = (i: number) => this.sheetSvc
            .getRowInfo(i)?.px ?? SETTINGS.defaultCellSize.height
        const staticWidth = SETTINGS.leftTop.width
        for (let i = scrollY, y = SETTINGS.leftTop.height; i <= MAX_COUNT && y <= maxHeight; i += 1) {
            const isHidden = this.sheetSvc.getRowInfo(i)?.hidden ?? false
            if (isHidden)
                continue
            if (y > maxHeight)
                break
            const height = getHeight(i)
            const cell = new RenderCell()
            cell.coodinate = new Range()
            cell.coodinate.startRow = i
            cell.coodinate.endRow = i
            cell.coodinate.startCol = 0
            cell.coodinate.endCol = 0
            cell.position = new Range()
            cell.position.startRow = y
            cell.position.endRow = y + height
            cell.position.startCol = 0
            cell.position.endCol = staticWidth
            rows.push(cell)
            y += height
        }
        return rows
    }

    private _initCols(maxWidth: number, scrollX: number) {
        const cols: RenderCell[] = []
        const getWidth = (i: number) => this.sheetSvc
            .getColInfo(i)?.px ?? SETTINGS.defaultCellSize.width
        const staticHeight = SETTINGS.leftTop.height
        for (let i = scrollX, x = SETTINGS.leftTop.width; i <= MAX_COUNT && x <= maxWidth; i += 1) {
            const isHidden = this.sheetSvc.getColInfo(i)?.hidden ?? false
            if (isHidden)
                continue
            if (x > maxWidth)
                break
            const width = getWidth(i)
            const cell = new RenderCell()
            cell.position = new Range()
            cell.position.startCol = x
            cell.position.endCol = x + width
            cell.position.startRow = 0
            cell.position.endRow = staticHeight
            cell.coodinate = new Range()
            cell.coodinate.startCol = i
            cell.coodinate.endCol = i
            cell.coodinate.startRow = 0
            cell.coodinate.endRow = 0
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
                coordinate.startRow = startRow.coodinate.startRow
                coordinate.endRow = startRow.coodinate.endRow
                coordinate.startCol = startCol.coodinate.startCol
                coordinate.endCol = startCol.coodinate.endCol
                const mCells = merges.filter(m => m.cover(coordinate))
                // no merge cell
                if (mCells.length === 0) {
                    const cell = new RenderCell()
                    cell.position = new Range()
                    cell.position.endCol = startCol.position.endCol
                    cell.position.endRow = startRow.position.endRow
                    cell.position.startCol = startCol.position.startCol
                    cell.position.startRow = startRow.position.startRow
                    cell.coodinate = coordinate
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
                    c.position = new Range()
                    c.position.endCol = endCol.position.endCol
                    c.position.endRow = endRow.position.endRow
                    c.position.startCol = startCol.position.startCol
                    c.position.startRow = startRow.position.startRow
                    c.coodinate = new Range()
                    c.coodinate.startRow = startRow.coodinate.startRow
                    c.coodinate.startCol = startCol.coodinate.startCol
                    c.coodinate.endCol = endCol.coodinate.endCol
                    c.coodinate.endRow = endRow.coodinate.endRow
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
