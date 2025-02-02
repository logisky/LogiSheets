import {Box, CanvasAttr, PainterService, TextAttr} from '@/core/painter'
import {CanvasStore} from '../store'
import {OffscreenCanvas} from './offscreen'
import {CellView, CellViewResponse, RenderCell} from '@/core/data'
import {simpleUuid, toA1notation} from '@/core'
import {Range, StandardCell, StandardColor} from '@/core/standable'
import {isFullyCovered, Rect} from './types'
import {LeftTop, SETTINGS} from '@/core/settings'
import {StandardStyle} from '@/core/standable/style'
import {isErrorMessage, PatternFill} from 'logisheets-web'
import {Cell} from '../../defs'
import {BorderHelper} from './border_helper'

export const CANVAS_ID = simpleUuid()
const BUFFER_SIZE = 50

export class Renderer {
    public constructor(public readonly store: CanvasStore) {}

    get canvas() {
        return document.getElementById(CANVAS_ID) as HTMLCanvasElement
    }

    /**
     * Note that this `CellView` is a bit larger than what users see
     */
    public getCurrentData(): CellView {
        return this._offscreen.currentData()
    }

    /**
     * Based on the canvas size and its anchor, update the canvas
     * content.
     *
     * Make sure everything is set before calling this function
     */
    public render() {
        const r = this.canvas.getBoundingClientRect()
        const target: Rect = {
            x: this.store.anchorX,
            y: this.store.anchorY,
            width: r.width,
            height: r.height,
        }
        const draw = () => {
            const ctx = this.canvas.getContext('2d')
            if (!ctx) {
                throw Error('canvas context should not be undefined')
            }
            ctx.clearRect(0, 0, r.width + BUFFER_SIZE, r.height + BUFFER_SIZE)
            this._painter.setCanvas(this.canvas)
            const data = this.getCurrentData()
            // draw headers
            this._renderLeftHeader(data)
            this._renderTopHeader(data)
            this._renderLeftTop()
            // draw cells
            this._offscreen.drawCellsToMain(this.canvas, target)
            this.store.resizer.init()
        }

        let hasDrawn = false
        if (isFullyCovered(target, this._dataRect)) {
            draw()
            hasDrawn = true
        }

        const drawCellsFn = (
            canvas: HTMLCanvasElement,
            resp: CellViewResponse
        ) => {
            this._painter.setCanvas(canvas)
            this._painter.clear()
            const anchorX = Math.max(resp.request.startX, 0)
            const anchorY = Math.max(resp.request.startY, 0)
            this._renderContent(resp.data, anchorX, anchorY)
            this._renderGrid(resp.data)
            this._renderMergeCells(resp.data, anchorX, anchorY)
            this._painter.setCanvas(this.canvas)
        }
        const cacheTarget: Rect = {
            x: Math.max(this.store.anchorX - BUFFER_SIZE, 0),
            y: Math.max(this.store.anchorY - BUFFER_SIZE, 0),
            height: r.height * 2,
            width: r.width * 1.5,
        }
        this.store.dataSvc
            .getCellView(
                this.store.currSheetIdx,
                cacheTarget.x,
                cacheTarget.y,
                cacheTarget.height,
                cacheTarget.width
            )
            .then((v) => {
                if (isErrorMessage(v)) return
                // draw cells to offscreen canvas
                this._offscreen.drawCells(v, drawCellsFn)

                if (!hasDrawn) draw()
                this.store.updateStartAndEndCells(v.data)
            })
    }

    jumpTo(row: number, col: number) {
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

    private _painter = new PainterService()
    /**
     *
     */
    private _offscreen = new OffscreenCanvas()

    private _dataRect: Rect = {x: 0, y: 0, width: 0, height: 0}

    private _renderLeftHeader(data: CellView) {
        this._painter.save()
        data.rows.forEach((r) => {
            const pos = this.store.convertToCanvasPosition(
                r.position,
                'FixedLeftHeader'
            )
            if (pos.endRow < 0) return // invisible
            this._painter.line([
                [pos.startCol, pos.startRow],
                [pos.endCol, pos.startRow],
                [pos.endCol, pos.endRow],
                [pos.startCol, pos.endRow],
            ])
            const box = new Box()
            box.position = pos
            const attr = new TextAttr()
            attr.font = SETTINGS.fixedHeader.font
            const position = (r.coordinate.startRow + 1).toString()
            this._painter.fillFgColor('solid', '#ffffff', box)
            this._painter.text(position, attr, box)
        })
        this._painter.restore()
    }

    private _renderTopHeader(data: CellView) {
        this._painter.save()
        data.cols.forEach((c) => {
            const pos = this.store.convertToCanvasPosition(
                c.position,
                'FixedTopHeader'
            )
            this._painter.line([
                [pos.endCol, pos.startRow],
                [pos.endCol, pos.endRow],
                [pos.startCol, pos.endRow],
                [pos.startCol, pos.startRow],
            ])
            const a1Notation = toA1notation(c.coordinate.startCol)
            const box = new Box()
            box.position = pos
            const attr = new TextAttr()
            attr.font = SETTINGS.fixedHeader.font
            this._painter.fillFgColor('solid', '#ffffff', box)
            this._painter.text(a1Notation, attr, box)
        })
        this._painter.restore()
    }

    private _renderLeftTop() {
        this._painter.save()
        const attr = new CanvasAttr()
        attr.strokeStyle = LeftTop.strokeStyle
        this._painter.attr(attr)
        this._painter.strokeRect(50, 50, LeftTop.width, LeftTop.height)
        const box = new Box()
        box.position = new Range()
            .setEndCol(LeftTop.width)
            .setEndRow(LeftTop.width)
        this._painter.fillFgColor('solid', '#ffffff', box)
        this._painter.restore()
    }

    private _fill(box: Box, style?: StandardStyle) {
        const fill = style?.fill
        if (!fill || !('patternFill' in fill)) return
        const patternFill = fill.patternFill as PatternFill
        if (patternFill.bgColor) {
            const color = StandardColor.fromCtColor(patternFill.bgColor)
            const fillAttr = new CanvasAttr()
            fillAttr.fillStyle = color.css()
            this._painter.attr(fillAttr)
            const {startRow, startCol} = box.position
            this._painter.fillRect(startCol, startRow, box.width, box.height)
        }
        if (patternFill.fgColor) {
            const color = StandardColor.fromCtColor(patternFill.fgColor)
            this._painter.fillFgColor(
                patternFill?.patternType ?? 'none',
                color.css(),
                box
            )
        }
    }

    private _renderMergeCells(
        data: CellView,
        anchorX: number,
        anchorY: number
    ) {
        data.mergeCells.forEach((c) => {
            this._renderCell(c, anchorX, anchorY, true)
        })
    }

    private _renderGrid(data: CellView) {
        const borderHelper = new BorderHelper(data)
        for (let row = data.fromRow; row <= data.toRow; row++) {
            const border = borderHelper.generateRowBorder(row)
            border.forEach((b) => {
                if (!b.pr) return
                const {start, from, to} = b
                this._painter.borderLine(
                    b.pr,
                    true,
                    start - this.store.anchorY,
                    from - this.store.anchorX,
                    to - this.store.anchorX
                )
            })
        }
        for (let col = data.fromCol; col <= data.toCol; col++) {
            const border = borderHelper.generateColBorder(col)
            border.forEach((b) => {
                if (!b.pr) return
                this._painter.borderLine(
                    b.pr,
                    false,
                    b.start - this.store.anchorX,
                    b.from - this.store.anchorY,
                    b.to - this.store.anchorY
                )
            })
        }
    }

    // private _comment(box: Box, comment: Comment | undefined) {
    //     if (!comment) return
    //     this._painter.comment(box)
    // }

    private _text(box: Box, info: StandardCell) {
        const t = info.getFormattedText()
        if (!t) return
        const textAttr = new TextAttr()
        if (info.style) {
            textAttr.alignment = info.style.alignment
            textAttr.setFont(info.style.getFont())
        }
        this._painter.text(t, textAttr, box)
    }

    /**
     * main content + freeze content.
     */
    private _renderContent(data: CellView, anchorX: number, anchorY: number) {
        this._painter.save()
        data.cells.forEach((cell) => {
            this._renderCell(cell, anchorX, anchorY)
        })
        this._painter.restore()
    }

    private _renderCell(
        renderCell: RenderCell,
        anchorX: number,
        anchorY: number,
        clearBeforeRender = false
    ) {
        const {coordinate: _, position, info} = renderCell
        const style = info?.style
        const box = new Box()
        box.position = new Range()
            .setEndRow(position.endRow - anchorY)
            .setStartRow(position.startRow - anchorY)
            .setEndCol(position.endCol - anchorX)
            .setStartCol(position.startCol - anchorX)
        if (clearBeforeRender) {
            this._painter.clearRect(
                box.position.startCol,
                box.position.startRow,
                box.position.width,
                box.position.height
            )
        }
        this._fill(box, style)
        if (info) {
            this._text(box, info)
            // this._comment(box, info)
        }
    }
}
