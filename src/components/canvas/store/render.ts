import {makeObservable, action} from 'mobx'
import {CanvasStore} from './store'
import {Box, CanvasAttr, PainterService, TextAttr} from '@/core/painter'
import {simpleUuid, toA1notation} from '@/core'
import {CellView, RenderCell, toCanvasPosition} from '@/core/data'
import {LeftTop, SETTINGS} from '@/core/settings'
import {StandardColor, Range, StandardCell} from '@/core/standable'
import {StandardStyle} from '@/core/standable/style'
import {isErrorMessage, PatternFill} from 'logisheets-web'
import {Cell} from '../defs'
import {CONTAINER} from '@/core/ioc/config'
import {TYPES} from '@/core/ioc/types'
import {Pool} from '@/core/pool'
export const CANVAS_ID = simpleUuid()
const BUFFER_SIZE = 50

export class Render {
    constructor(public readonly store: CanvasStore) {
        makeObservable(this)
    }
    get canvas() {
        return document.getElementById(CANVAS_ID) as HTMLCanvasElement
    }

    render() {
        const rect = this.canvas.getBoundingClientRect()

        const resp = this.store.dataSvc.getCellView(
            this.store.currSheetIdx,
            this.store.anchorX - BUFFER_SIZE,
            this.store.anchorY - BUFFER_SIZE,
            rect.height + BUFFER_SIZE,
            rect.width + BUFFER_SIZE
        )
        resp.then((r) => {
            if (isErrorMessage(r)) return
            const req = r.request
            // Discard responses that are invisible now
            if (Math.abs(req.startX - this.store.anchorX) > req.width) return
            if (Math.abs(req.startY - this.store.anchorY) > req.height) {
                return
            }
            const data = r.data
            this._painterService.setupCanvas(this.canvas)
            this._painterService.clear()
            this._renderGrid(data)
            this._renderContent(data)
            this._renderLeftHeader(data)
            this._renderTopHeader(data)
            this._renderLeftTop()

            const pool = CONTAINER.get<Pool>(TYPES.Pool)
            pool.releaseCellView(data)
            // rerender resizer
            this.store.resizer.init()
        })
    }

    private _jumpToCellInCurrentView(row: number, col: number): boolean {
        const cellView = this.store.getCurrentCellView()
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
        const {height, width} = this.store.render.canvas.getBoundingClientRect()
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

    @action
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

    private _painterService = new PainterService()

    private _renderCell(renderCell: RenderCell) {
        const {coordinate: _, position, info} = renderCell
        const style = info?.style
        const box = new Box()
        box.position = toCanvasPosition(
            position,
            this.store.anchorX,
            this.store.anchorY,
            'cell'
        )
        this._fill(box, style)
        this._border(box, position, style)
        if (info) {
            this._text(box, info)
            // this._comment(box, info)
        }
    }

    /**
     * main content + freeze content.
     */
    private _renderContent(data: CellView) {
        this._painterService.save()
        data.cells.forEach((cell) => {
            this._renderCell(cell)
        })
        this._painterService.restore()
    }

    private _renderLeftHeader(data: CellView) {
        this._painterService.save()
        data.rows.forEach((r) => {
            const pos = toCanvasPosition(
                r.position,
                this.store.anchorX,
                this.store.anchorY,
                'row'
            )
            this._painterService.line([
                [pos.startCol, pos.startRow],
                [LeftTop.width, pos.startRow],
                [LeftTop.width, pos.endRow],
                [pos.startCol, pos.endRow],
            ])
            const box = new Box()
            box.position = pos
            const attr = new TextAttr()
            attr.font = SETTINGS.fixedHeader.font
            const position = (r.coordinate.startRow + 1).toString()
            this._painterService.fillFgColor('solid', '#ffffff', box)
            this._painterService.text(position, attr, box)
        })
        this._painterService.restore()
    }

    private _renderTopHeader(data: CellView) {
        this._painterService.save()
        data.cols.forEach((c) => {
            const pos = toCanvasPosition(
                c.position,
                this.store.anchorX,
                this.store.anchorY,
                'col'
            )
            this._painterService.line([
                [pos.endCol, pos.startRow],
                [pos.endCol, LeftTop.height],
                [pos.startCol, pos.endRow],
                [pos.startCol, LeftTop.height],
            ])
            const a1Notation = toA1notation(c.coordinate.startCol)
            const box = new Box()
            box.position = pos
            const attr = new TextAttr()
            attr.font = SETTINGS.fixedHeader.font
            this._painterService.fillFgColor('solid', '#ffffff', box)
            this._painterService.text(a1Notation, attr, box)
        })
        this._painterService.restore()
    }

    private _renderLeftTop() {
        this._painterService.save()
        const attr = new CanvasAttr()
        attr.strokeStyle = LeftTop.strokeStyle
        this._painterService.attr(attr)
        this._painterService.strokeRect(50, 50, LeftTop.width, LeftTop.height)
        const box = new Box()
        box.position = new Range()
            .setEndCol(LeftTop.width)
            .setEndRow(LeftTop.width)
        this._painterService.fillFgColor('solid', '#ffffff', box)
        this._painterService.restore()
    }

    private _fill(box: Box, style?: StandardStyle) {
        const fill = style?.fill
        if (!fill || !('patternFill' in fill)) return
        const patternFill = fill.patternFill as PatternFill
        if (patternFill.bgColor) {
            const color = StandardColor.fromCtColor(patternFill.bgColor)
            const fillAttr = new CanvasAttr()
            fillAttr.fillStyle = color.css()
            this._painterService.attr(fillAttr)
            const {startRow, startCol} = box.position
            this._painterService.fillRect(
                startCol,
                startRow,
                box.width,
                box.height
            )
        }
        if (patternFill.fgColor) {
            const color = StandardColor.fromCtColor(patternFill.fgColor)
            this._painterService.fillFgColor(
                patternFill?.patternType ?? 'none',
                color.css(),
                box
            )
        }
    }

    private _border(box: Box, position: Range, style?: StandardStyle) {
        const border = style?.border
        if (!border) return
        if (border.top) this._painterService.border(border.top, box, 'top')
        if (border.bottom)
            this._painterService.border(border.bottom, box, 'bottom')
        if (border.left) this._painterService.border(border.left, box, 'left')
        if (border.right)
            this._painterService.border(border.right, box, 'right')
        if (border.diagonalDown)
            this._painterService.line([
                [position.startCol, position.startRow],
                [position.endCol, position.endRow],
            ])
        if (border.diagonalUp)
            this._painterService.line([
                [position.startCol, position.endRow],
                [position.endCol, position.startRow],
            ])
    }

    private _renderGrid(data: CellView) {
        const {grid} = SETTINGS
        this._painterService.save()
        const attr = new CanvasAttr()
        attr.lineWidth = grid.lineWidth
        this._painterService.attr(attr)
        const rect = this.canvas.getBoundingClientRect()
        if (grid.showHorizontal)
            data.rows.forEach((r) => {
                const y =
                    r.position.startRow - this.store.anchorY + LeftTop.height
                this._painterService.line([
                    [LeftTop.width, y],
                    [rect.width, y],
                ])
            })
        if (grid.showVertical)
            data.cols.forEach((c) => {
                const x =
                    c.position.startCol - this.store.anchorX + LeftTop.width
                this._painterService.line([
                    [x, LeftTop.height],
                    [x, rect.height],
                ])
            })
        this._painterService.restore()
    }

    // private _comment(box: Box, comment: Comment | undefined) {
    //     if (!comment) return
    //     this._painterService.comment(box)
    // }

    private _text(box: Box, info: StandardCell) {
        const t = info.getFormattedText()
        if (!t) return
        const textAttr = new TextAttr()
        if (info.style) {
            textAttr.alignment = info.style.alignment
            textAttr.setFont(info.style.getFont())
        }
        this._painterService.text(t, textAttr, box)
    }
}
