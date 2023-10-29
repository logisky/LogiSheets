import {MAX_COUNT, SheetService} from './sheet'
import {SETTINGS} from '@/core/settings'
import {RenderCell, RenderCellSegment, ViewRange} from './view_range'
import {Backend} from './backend'
import {DisplayRequest} from '@/bindings'
import {Range} from '@/core/standable'
import {injectable, inject} from 'inversify'
import {TYPES} from '@/core/ioc/types'
import {getID} from '@/core/ioc/id'
export const CANVAS_OFFSET = 100

@injectable()
export class DataService {
    readonly id = getID()
    constructor(
        @inject(TYPES.Sheet) private readonly sheetSvc: SheetService,
        @inject(TYPES.Backend) private readonly backend: Backend
    ) {
        this._handleBackend()
    }

    get cachedViewRange() {
        return this._viewRange
    }

    sendDisplayArea(version = 0): void {
        const req: DisplayRequest = {
            sheetIdx: this.sheetSvc.getActiveSheet(),
            version: version,
        }
        this.backend.send({$case: 'displayRequest', displayRequest: req})
    }

    /**
     * Try to jump to the given cell. If the render cell is already in the view range, return it.
     * If not, return the scroll where we can find this cell.
     */
    tryJumpTo(
        row: number,
        col: number
    ): RenderCell | readonly [number, number] {
        const result = this.jumpTo(row, col)
        if (result) return result

        const sheet = this.sheetSvc.getSheet()

        // This case should not happen.
        if (!sheet) return this._viewRange.cells[0]

        // compute the new scroll
        let scrollY = 0
        for (let i = 0; i < row - 1; i += 1)
            scrollY += this.sheetSvc.getRowInfo(i).px ?? 0

        let scrollX = 0
        for (let j = 0; j < col - 1; j += 1)
            scrollX += this.sheetSvc.getColInfo(j).px ?? 0

        return [scrollX, scrollY]
    }

    jumpTo(row: number, col: number): RenderCell | null {
        for (let i = 0; i < this._viewRange.cells.length; i += 1) {
            const c = this._viewRange.cells[i]
            if (
                c.cover(
                    new RenderCell().setCoordinate(
                        new Range()
                            .setStartRow(row)
                            .setEndRow(row)
                            .setStartCol(col)
                            .setEndCol(col)
                    )
                )
            ) {
                return c
            }
        }
        return null
    }

    /**
     * filter?, freeze, scroll, hidden
     */
    initViewRange(maxWidth: number, maxHeight: number) {
        const scroll = this._getScrollPosition()
        const rows = this._initRows(maxHeight, scroll.row)
        const cols = this._initCols(maxWidth, scroll.col)
        const cells = this._initCells(rows.cells, cols.cells)
        const viewRange = new ViewRange()
        viewRange.rows = rows.cells
        viewRange.cols = cols.cells
        viewRange.cells = cells
        viewRange.fromRow = rows.from
        viewRange.toRow = rows.to
        viewRange.fromCol = cols.from
        viewRange.toCol = cols.to
        this._viewRange = viewRange
        // console.log('init view range', viewRange)
        return this._viewRange
    }
    private _viewRange = new ViewRange()
    private _handleBackend(): void {
        this.backend.version$.subscribe(() => {
            this.sendDisplayArea()
        })
    }

    private _getScrollPosition() {
        const scroll = this.sheetSvc.getSheet()?.scroll
        if (!scroll) return {row: 0, col: 0}
        let rowIndex = 0
        let i = -1
        while (i < MAX_COUNT) {
            i += 1
            if (rowIndex < scroll.y) {
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
            if (colIndex < scroll.x) {
                colIndex += this.sheetSvc.getColInfo(i).px
                continue
            }
            colIndex = i
            break
        }
        return {row: rowIndex, col: colIndex}
    }

    private _initRows(maxHeight: number, scrollY: number) {
        const rows: RenderCell[] = []
        const getHeight = (i: number) => this.sheetSvc.getRowInfo(i).px
        const staticWidth = SETTINGS.leftTop.width
        let i = scrollY
        for (
            let y = SETTINGS.leftTop.height;
            i <= MAX_COUNT && y <= maxHeight;
            i += 1
        ) {
            const isHidden = this.sheetSvc.getRowInfo(i).hidden
            if (isHidden) continue
            if (y > maxHeight) break
            const height = getHeight(i)
            const cell = new RenderCell()
                .setCoordinate(new Range().setStartRow(i).setEndRow(i))
                .setPosition(
                    new Range()
                        .setStartRow(y)
                        .setEndRow(y + height)
                        .setEndCol(staticWidth)
                )
            rows.push(cell)
            y += height
        }
        return new RenderCellSegment(scrollY, i, rows)
    }

    private _initCols(maxWidth: number, scrollX: number) {
        const cols: RenderCell[] = []
        const getWidth = (i: number) => this.sheetSvc.getColInfo(i).px
        const staticHeight = SETTINGS.leftTop.height
        let i = scrollX
        for (
            let x = SETTINGS.leftTop.width;
            i <= MAX_COUNT && x <= maxWidth;
            i += 1
        ) {
            const isHidden = this.sheetSvc.getColInfo(i).hidden
            if (isHidden) continue
            if (x > maxWidth) break
            const width = getWidth(i)
            const cell = new RenderCell()
                .setPosition(
                    new Range()
                        .setStartCol(x)
                        .setEndCol(x + width)
                        .setEndRow(staticHeight)
                )
                .setCoordinate(new Range().setStartCol(i).setEndCol(i))
            cols.push(cell)
            x += width
        }
        return new RenderCellSegment(scrollX, i, cols)
    }

    private _initCells(
        rows: readonly RenderCell[],
        cols: readonly RenderCell[]
    ) {
        const renderedCells = new Set<string>()
        const merges = this.sheetSvc.getSheet()?.merges ?? []
        const cells: RenderCell[] = []
        rows.forEach((startRow) => {
            // tslint:disable-next-line: max-func-body-length
            cols.forEach((startCol) => {
                const key = `${startRow.coordinate.startRow}-${startCol.coordinate.startCol}`
                if (renderedCells.has(key)) return
                const coordinate = new Range()
                    .setStartRow(startRow.coordinate.startRow)
                    .setEndRow(startRow.coordinate.endRow)
                    .setStartCol(startCol.coordinate.startCol)
                    .setEndCol(startCol.coordinate.endCol)
                const mCells = merges.filter((m) => m.cover(coordinate))
                // no merge cell
                if (mCells.length === 0) {
                    const cell = new RenderCell()
                        .setPosition(
                            new Range()
                                .setStartRow(startRow.position.startRow)
                                .setEndRow(startRow.position.endRow)
                                .setStartCol(startCol.position.startCol)
                                .setEndCol(startCol.position.endCol)
                        )
                        .setCoordinate(coordinate)
                    renderedCells.add(key)
                    cells.push(cell)
                    return
                }
                mCells.forEach((cell) => {
                    let endRow = startRow
                    let endCol = startCol
                    for (
                        let mr = startRow.coordinate.startRow;
                        mr <= cell.endRow;
                        mr += 1
                    ) {
                        const tmpRow = rows.find(
                            (r) => r.coordinate.startRow === mr
                        )
                        if (!tmpRow) continue
                        endRow = tmpRow
                    }
                    for (
                        let mc = startCol.coordinate.startCol;
                        mc <= cell.endCol;
                        mc += 1
                    ) {
                        const tmpCol = cols.find(
                            (c) => c.coordinate.startCol === mc
                        )
                        if (!tmpCol) continue
                        endCol = tmpCol
                    }
                    const c = new RenderCell()
                        .setPosition(
                            new Range()
                                .setStartCol(startCol.position.startCol)
                                .setStartRow(startRow.position.startRow)
                                .setEndCol(endCol.position.endCol)
                                .setEndRow(endRow.position.endRow)
                        )
                        .setCoordinate(
                            new Range()
                                .setStartRow(startRow.coordinate.startRow)
                                .setStartCol(startCol.coordinate.startCol)
                                .setEndCol(endCol.coordinate.endCol)
                                .setEndRow(endRow.coordinate.endRow)
                        )
                    cells.push(c)
                    for (
                        let i = c.coordinate.startRow;
                        i <= c.coordinate.endRow;
                        i += 1
                    )
                        for (
                            let j = c.coordinate.startCol;
                            j <= c.coordinate.endCol;
                            j += 1
                        )
                            renderedCells.add(`${i}-${j}`)
                })
            })
        })
        return cells
    }
}
