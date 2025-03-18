import {CanvasStore} from '../store'
import {
    CanvasImpl,
    createIncrementalCellRenderer,
    createIncrementalColsRenderer,
    createIncrementalRowsRenderer,
    DrawContentImpl,
} from './incremental_impl'
import {IncrementalRenderer} from './incremental'
import {Rect} from './types'
import {Painter} from './painter'
import {Cell} from '../../defs'
import {CellView, CellViewResponse} from '@/core/data'
import {LeftTop} from '@/core/settings'
import {simpleUuid} from '@/core'
import {isErrorMessage} from 'logisheets-web'

type IncrRenderer = IncrementalRenderer<DrawContentImpl, CanvasImpl>
export const CANVAS_ID = simpleUuid()

export interface RendererInterface {
    canvas: HTMLCanvasElement
    rendering: boolean
    render(clearBeforeRender?: boolean): Promise<void>
    concatImageToCanvas(): void
    jumpTo(row: number, col: number): void
    getCurrentData(): CellView
}

export class Renderer implements RendererInterface {
    public constructor(public readonly store: CanvasStore) {
        this._painter = new Painter(this.store)
        const drawCellsFn = (
            canvas: HTMLCanvasElement,
            resp: CellViewResponse,
            anchorX: number,
            anchorY: number
        ) => {
            this._painter.setCanvas(canvas)
            this._painter.renderContent(resp.data, anchorX, anchorY)
            this._painter.renderGrid(resp.data, anchorX, anchorY)
            this._painter.renderMergeCells(resp, anchorX, anchorY)
        }
        this._cellRenderer = createIncrementalCellRenderer(
            this.store.dataSvc,
            drawCellsFn
        )

        const drawRowsFn = (
            canvas: HTMLCanvasElement,
            resp: CellViewResponse,
            anchorX: number,
            anchorY: number
        ) => {
            this._painter.setCanvas(canvas)
            this._painter.renderLeftHeader(resp, anchorX, anchorY)
        }

        const fetchDataFromCellRenderer = async (rect: Rect) => {
            const resp = this._cellRenderer.getCurrentData()
            const x = Math.max(rect.x, 0)
            const y = Math.max(rect.y, 0)
            const data = resp.find((r) => {
                return (
                    r.dataView.request.startX <= x &&
                    r.dataView.request.width + r.dataView.request.startX >=
                        x + rect.width &&
                    r.dataView.request.startY <= y &&
                    r.dataView.request.height + r.dataView.request.startY >=
                        y + rect.height
                )
            })
            if (!data) {
                throw Error(
                    'can not find data for rect: ' + JSON.stringify(rect)
                )
            }
            return data.dataView
        }
        this._rowRenderer = createIncrementalRowsRenderer(
            fetchDataFromCellRenderer,
            drawRowsFn
        )

        const drawColsFn = (
            canvas: HTMLCanvasElement,
            resp: CellViewResponse,
            anchorX: number,
            anchorY: number
        ) => {
            this._painter.setCanvas(canvas)
            this._painter.renderTopHeader(resp, anchorX, anchorY)
        }

        this._colRenderer = createIncrementalColsRenderer(
            fetchDataFromCellRenderer,
            drawColsFn
        )
    }
    getCurrentData(): CellView {
        const data = this._cellRenderer.getCurrentData()
        const dataArray = data.map((d) => d.dataView.data.data).flat()
        return new CellView(dataArray)
    }

    public async render(clearBeforeRender = false) {
        const r = this.canvas.getBoundingClientRect()
        const target: Rect = {
            x: this.store.anchorX,
            y: this.store.anchorY,
            width: r.width,
            height: r.height,
        }

        if (clearBeforeRender) {
            this._cellRenderer.clear()
            this._rowRenderer.clear()
            this._colRenderer.clear()
        }

        const {rows, cols} = normalizeForRowsAndCols(target)

        if (this._cellRenderer.hasCovered(target)) {
            if (this._frozenUpperRenderer) {
                await this._frozenUpperRenderer.fullyRender(target)
            }
            if (this._frozenLowerRenderer) {
                await this._frozenLowerRenderer.fullyRender(target)
            }
            await this._cellRenderer.fullyRender(target)
            await this._rowRenderer.fullyRender(rows)
            await this._colRenderer.fullyRender(cols)
        } else {
            this.rendering = true
            await this._cellRenderer.fullyRender(target)
            await this._rowRenderer.fullyRender(rows)
            await this._colRenderer.fullyRender(cols)
            if (this._frozenUpperRenderer) {
                this._frozenUpperRenderer.fullyRender(target)
            }
            if (this._frozenLowerRenderer) {
                this._frozenLowerRenderer.fullyRender(target)
            }
            this.rendering = false
        }
        this.concatImageToCanvas()
    }

    public concatImageToCanvas() {
        const r = this.canvas.getBoundingClientRect()
        const ctx = this.canvas.getContext('2d')
        if (ctx === null) {
            throw new Error('Failed to get 2d context')
        }
        ctx.clearRect(0, 0, r.width, r.height)
        this._cellRenderer.drawTo(
            ctx,
            {
                x: this.store.anchorX,
                y: this.store.anchorY,
                width: r.width,
                height: r.height,
            },
            {
                x: LeftTop.width,
                y: LeftTop.height,
                width: r.width,
                height: r.height,
            }
        )
        this._rowRenderer.drawTo(
            ctx,
            {
                x: 0,
                y: this.store.anchorY,
                width: LeftTop.width,
                height: r.height,
            },
            {
                x: 0,
                y: LeftTop.height,
                width: LeftTop.width,
                height: r.height,
            }
        )
        this._colRenderer.drawTo(
            ctx,
            {
                x: this.store.anchorX,
                y: 0,
                width: r.width,
                height: LeftTop.height,
            },
            {
                x: LeftTop.width,
                y: 0,
                width: r.width,
                height: LeftTop.height,
            }
        )
    }

    public jumpTo(row: number, col: number) {
        if (this._jumpToCellInCurrentView(row, col)) {
            // The current cell is in this page. No need to render again
            return
        }
        const rect = this.canvas.getBoundingClientRect()
        const resp = this.store.dataSvc.getCellViewWithCell(
            this.store.currSheetIdx,
            row,
            col,
            rect.height,
            rect.width
        )
        resp.then((r) => {
            if (isErrorMessage(r)) return
            const data = r.data.data.find((v) => {
                return (
                    v.fromRow <= row &&
                    v.toRow >= row &&
                    v.fromCol <= col &&
                    v.toCol >= col
                )
            })
            if (!data) return
            const firstRow = data.rows[0]
            const firstCol = data.cols[0]
            this.store.setAnchor(
                firstCol.position.startCol,
                firstRow.position.startRow
            )
            this.render()
            this._jumpToCellInCurrentView(row, col)
            this.store.scrollbar.update('x')
            this.store.scrollbar.update('y')
        })
    }

    private _jumpToCellInCurrentView(row: number, col: number): boolean {
        const cellView = this.getCurrentData()
        const currCell = cellView.cells.find((v) => {
            return (
                v.coordinate.startRow <= row &&
                v.coordinate.endRow >= row &&
                v.coordinate.startCol <= col &&
                v.coordinate.endCol >= col
            )
        })

        if (!currCell) return false

        const position = this.store.convertToCanvasPosition(
            currCell.position,
            'Cell'
        )
        const {height, width} = this.canvas.getBoundingClientRect()
        if (
            position.endCol > width ||
            position.endRow > height ||
            position.startCol < LeftTop.width ||
            position.startRow < LeftTop.height
        ) {
            return false
        }

        const c = new Cell('Cell').copyByRenderCell(currCell)
        this.store.startCell = c
        this.store.selector.onJumpToCell(c)
        return true
    }

    public get canvas() {
        return document.getElementById(CANVAS_ID) as HTMLCanvasElement
    }

    public rendering = false

    private _painter!: Painter

    private _cellRenderer!: IncrRenderer

    private _rowRenderer: IncrRenderer

    private _colRenderer: IncrRenderer

    private _frozenUpperRenderer?: IncrRenderer

    private _frozenLowerRenderer?: IncrRenderer
}

function cutRectThroughFrozen(
    canvasRect: Rect,
    frozenPoint: {x: number; y: number}
): {main: Rect; leftTop?: Rect; frozenLeft?: Rect; frozenTop?: Rect} {
    const leftTop = {
        x: 0,
        y: 0,
        width: frozenPoint.x,
        height: frozenPoint.y,
    }
    const frozen = frozenPoint.x > 0 && frozenPoint.y > 0
    const frozenLeft = frozen
        ? {
              x: 0,
              y: frozenPoint.y,
              width: frozenPoint.x,
              height: canvasRect.height,
          }
        : undefined
    const frozenTop = frozen
        ? {
              x: frozenPoint.x,
              y: 0,
              width: canvasRect.width,
              height: frozenPoint.y,
          }
        : undefined
    const main = {
        x: frozenPoint.x,
        y: frozenPoint.y,
        width: canvasRect.width - frozenPoint.x,
        height: canvasRect.height - frozenPoint.y,
    }
    return {main, leftTop, frozenLeft, frozenTop}
}

function normalizeForRowsAndCols(rect: Rect): {rows: Rect; cols: Rect} {
    const rows = {
        x: 0,
        y: rect.y,
        width: LeftTop.width,
        height: rect.height,
    }
    const cols = {
        x: rect.x,
        y: 0,
        width: rect.width,
        height: LeftTop.height,
    }
    return {rows, cols}
}
