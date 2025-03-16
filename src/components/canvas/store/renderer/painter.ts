import {CellView, CellViewResponse, RenderCell} from '@/core/data'
import {CanvasStore} from '../store'
import {PainterService} from '@/core/painter/painter.service'
import {Box, CanvasAttr, TextAttr} from '@/core/painter'
import {SETTINGS} from '@/core/settings'
import {Range, StandardColor, StandardCell} from '@/core/standable'
import {StandardStyle} from '@/core/standable/style'
import {PatternFill} from 'logisheets-web'
import {BorderHelper} from './border_helper'
import {toA1notation} from '@/core'

export class Painter {
    public constructor(public readonly store: CanvasStore) {}

    public setCanvas(canvas: HTMLCanvasElement) {
        this._painter.setCanvas(canvas)
    }

    public renderLeftHeader(
        resp: CellViewResponse,
        anchorX: number,
        anchorY: number
    ) {
        const data = resp.data
        this._painter.save()
        data.rows.forEach((r) => {
            const pos = this.store.convertToCanvasPositionWithAnchor(
                r.position,
                'FixedLeftHeader',
                anchorX,
                anchorY
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

    public renderTopHeader(
        resp: CellViewResponse,
        anchorX: number,
        anchorY: number
    ) {
        const data = resp.data
        this._painter.save()
        data.cols.forEach((c) => {
            const pos = this.store.convertToCanvasPositionWithAnchor(
                c.position,
                'FixedTopHeader',
                anchorX,
                anchorY
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

    public renderMergeCells(
        resp: CellViewResponse,
        anchorX: number,
        anchorY: number
    ) {
        const data = resp.data
        data.mergeCells.forEach((c) => {
            this.renderCell(c, anchorX, anchorY, true)
        })
    }

    public renderCell(
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

    public renderContent(data: CellView, anchorX: number, anchorY: number) {
        this._painter.save()
        data.cells.forEach((cell) => {
            this.renderCell(cell, anchorX, anchorY)
        })
        this._painter.restore()
    }

    public renderGrid(data: CellView, anchorX: number, anchorY: number) {
        const borderHelper = new BorderHelper(data)
        for (let row = data.fromRow; row <= data.toRow; row++) {
            const border = borderHelper.generateRowBorder(row)
            border.forEach((b) => {
                if (!b.pr) return
                const {start, from, to} = b
                this._painter.borderLine(
                    b.pr,
                    true,
                    start - anchorY,
                    from - anchorX,
                    to - anchorX
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
                    b.start - anchorX,
                    b.from - anchorY,
                    b.to - anchorY
                )
            })
        }
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

    // private _comment(box: Box, comment: Comment | undefined) {
    //     if (!comment) return
    //     this._painter.comment(box)
    // }

    private _painter = new PainterService()
}
