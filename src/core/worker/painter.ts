import {PainterService} from '../painter'
import {Box, CanvasAttr, TextAttr} from '@/core/painter'
import {StandardStyle} from '@/core/standable/style'
import {PatternFill} from 'logisheets-web'
import {Range, StandardColor, StandardCell} from '@/core/standable'
import {RenderCell} from './render'
import {CellView} from './types'
import {BorderHelper} from './border_helper'

export class Painter {
    public setCanvas(canvas: OffscreenCanvas) {
        this._painter.setCanvas(canvas)
    }

    public render(resp: CellView, anchorX: number, anchorY: number) {
        // Offscreen pipeline scales the 2D context by DPR upstream (see offscreen.worker.ts),
        // so Painter renders in CSS pixel coordinates here. We still wrap in save/restore
        // to ensure any future DPR-specific transforms remain scoped.
        this._painter.save()
        // If you ever need additional per-DPR transforms, read from window.devicePixelRatio.
        // const dpr = (self as any).devicePixelRatio || 1
        this.renderContent(resp, anchorX, anchorY)
        this.renderMergeCells(resp, anchorX, anchorY)
        this.renderGrid(resp, anchorX, anchorY)
        this._painter.restore()
    }

    public renderContent(resp: CellView, anchorX: number, anchorY: number) {
        resp.cells.forEach((cell) => {
            this.renderCell(cell, anchorX, anchorY)
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

    public renderMergeCells(resp: CellView, anchorX: number, anchorY: number) {
        resp.mergeCells.forEach((c) => {
            this.renderCell(c, anchorX, anchorY, true)
        })
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
        if (!fill || !(fill.type === 'patternFill')) return
        const patternFill = fill.value as PatternFill
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

    private _painter = new PainterService()
}
