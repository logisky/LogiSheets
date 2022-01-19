/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
// tslint:disable: limit-indent-for-method-in-class
import {Injectable} from '@angular/core'

import {MAX_COUNT, SheetService} from './sheet'
import {ScrollPositionBuilder} from './scroll'
import {Settings} from './settings'
import {ViewRangeBuilder, RenderCell, RenderCellBuilder} from './view_range'
import {Backend} from './backend'
import {WebSocketService} from '@logi-sheets/web/ws'
import {DisplayRequestBuilder} from '@logi-pb/network/src/proto/message_pb'
import {RangeBuilder} from '@logi-sheets/web/core/standable'
export const CANVAS_OFFSET = 100

@Injectable()
export class DataService {
    constructor(private readonly _wsSvc: WebSocketService) {
        this._handleBackend()
    }
    settings = new Settings()
    scroll = new ScrollPositionBuilder().build()
    sheetSvc = new SheetService(this.settings)
    backend = new Backend(this.settings, this.sheetSvc, this._wsSvc)

    get cachedViewRange() {
        return this._viewRange
    }

    sendDisplayArea(): void {
        const displayArea = new DisplayRequestBuilder()
            .sheetIdx(this.sheetSvc.getActiveSheet())
            .version(0)
            .build()
        this.backend.send(displayArea)
    }

    updateScroll(x?: number, y?: number): void {
        if ((x && x < 0) || (y && y < 0))
            // tslint:disable-next-line: no-throw-unless-asserts
            throw Error(`x'${x}' or y'${y}' should not lower than 0`)
        const builder = new ScrollPositionBuilder(this.scroll)
        if (x !== undefined)
            builder.x(x)
        if (y !== undefined)
            builder.y(y)
        this.scroll = builder.build()
    }

    /**
     * filter?, freeze, scroll, hidden
     */
    // tslint:disable-next-line: max-func-body-length
    initViewRange(maxWidth: number, maxHeight: number) {
        const scroll = this._getScrollPosition()
        const rows = this._initRows(maxHeight, scroll.row)
        const cols = this._initCols(maxWidth, scroll.col)
        const cells = this._initCells(rows, cols)
        this._viewRange = new ViewRangeBuilder()
            .rows(rows)
            .cols(cols)
            .renderCells(cells)
            .build()
        return this._viewRange
    }
    private _viewRange = new ViewRangeBuilder().build()
    private _handleBackend(): void {
        this.backend.sheetUpdated$.subscribe(() => {
            const req = new DisplayRequestBuilder()
                .sheetIdx(this.sheetSvc.getActiveSheet())
                .version(0)
                .build()
            this.backend.send(req)
        })
    }

    private _getScrollPosition() {
        const {width, height} = this.settings.defaultCellSize
        let rowIndex = 0
        let i = -1
        while(i < MAX_COUNT) {
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
        while(i < MAX_COUNT) {
            i += 1
            if (colIndex < this.scroll.x) {
                colIndex += this.sheetSvc.getColInfo(i)?.px ?? width
                continue
            }
            colIndex = i
            break
        }
        return {row: rowIndex, col: colIndex}
    }

    private _initRows(maxHeight: number, scrollY: number) {
        const rows: RenderCell[] = []
        const getHeight = (i: number) => this.sheetSvc
            .getRowInfo(i)?.px ?? this.settings.defaultCellSize.height
        const staticWidth = this.settings.leftTop.width
        for (let i = scrollY, y = this.settings.leftTop.height; i <= MAX_COUNT && y <= maxHeight; i += 1) {
            const isHidden = this.sheetSvc.getRowInfo(i)?.hidden ?? false
            if (isHidden)
                continue
            if (y > maxHeight)
                break
            const height = getHeight(i)
            rows.push(new RenderCellBuilder()
                .coordinate(new RangeBuilder()
                    .startRow(i)
                    .endRow(i)
                    .startCol(0)
                    .endCol(0)
                    .build())
                .position(new RangeBuilder()
                    .startRow(y)
                    .endRow(y + height)
                    .startCol(0)
                    .endCol(staticWidth)
                    .build())
                .build())
            y += height
        }
        return rows
    }

    private _initCols(maxWidth: number, scrollX: number) {
        const cols: RenderCell[] = []
        const getWidth = (i: number) => this.sheetSvc
            .getColInfo(i)?.px ?? this.settings.defaultCellSize.width
        const staticHeight = this.settings.leftTop.height
        for (let i = scrollX, x = this.settings.leftTop.width; i <= MAX_COUNT && x <= maxWidth; i += 1) {
            const isHidden = this.sheetSvc.getColInfo(i)?.hidden ?? false
            if (isHidden)
                continue
            if (x > maxWidth)
                break
            const width = getWidth(i)
            cols.push(new RenderCellBuilder()
                .coordinate(new RangeBuilder()
                    .startCol(i)
                    .endCol(i)
                    .startRow(0)
                    .endRow(0)
                    .build())
                .position(new RangeBuilder()
                    .startCol(x)
                    .endCol(x + width)
                    .startRow(0)
                    .endRow(staticHeight)
                    .build())
                .build())
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
                const coordinate = new RangeBuilder()
                    .startRow(startRow.coodinate.startRow)
                    .endRow(startRow.coodinate.endRow)
                    .startCol(startCol.coodinate.startCol)
                    .endCol(startCol.coodinate.endCol)
                    .build()
                const mCells = merges.filter(m => m.cover(coordinate))
                // no merge cell
                if (mCells.length === 0) {
                    const cell = new RenderCellBuilder()
                        .position(new RangeBuilder()
                            .endCol(startCol.position.endCol)
                            .endRow(startRow.position.endRow)
                            .startCol(startCol.position.startCol)
                            .startRow(startRow.position.startRow)
                            .build())
                        .coordinate(coordinate)
                        .build()
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
                    const c = new RenderCellBuilder()
                        .position(new RangeBuilder()
                            .endCol(endCol.position.endCol)
                            .endRow(endRow.position.endRow)
                            .startCol(startCol.position.startCol)
                            .startRow(startRow.position.startRow)
                            .build())
                        .coordinate(new RangeBuilder()
                            .startRow(startRow.coodinate.startRow)
                            .startCol(startCol.coodinate.startCol)
                            .endCol(endCol.coodinate.endCol)
                            .endRow(endRow.coodinate.endRow)
                            .build())
                        .build()
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
