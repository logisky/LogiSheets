import { PainterService, Box, TextAttr, CanvasAttr } from 'core/painter'
import { DATA_SERVICE, RenderCell } from 'core/data'
import { StandardColor, Range } from 'core/standable'
import { SETTINGS } from 'common/settings'
import { toA1notation } from 'common'
import { StandardStyle } from 'core/standable/style'

export class Render {
    render(canvas: HTMLCanvasElement) {
        this._painterSvc.setupCanvas(canvas)
        const rect = canvas.getBoundingClientRect()
        DATA_SERVICE.initViewRange(rect.width, rect.height)
        this._renderGrid(canvas)
        this._renderContent()
        this._renderLeftHeader()
        this._renderTopHeader()
        this._renderLeftTop()
    }

    private _painterSvc = new PainterService()

    private _renderCell(renderCell: RenderCell) {
        const { coodinate: range, position } = renderCell
        const sheetSvc = DATA_SERVICE.sheetSvc
        const style = sheetSvc.getCell(range.startRow, range.startCol)?.style
        if (!style)
            return
        const box = new Box()
        box.position = position
        this._fill(box, style)
        this._border(box, position, style)
        this._text(box, range, style)
        this._comment(box, range)
    }

    /**
     * main content + freeze content.
     */
    private _renderContent() {
        DATA_SERVICE.cachedViewRange.cells.forEach(cell => {
            this._painterSvc.save()
            this._renderCell(cell)
            this._painterSvc.restore()
        })
    }

    private _renderLeftHeader() {
        this._painterSvc.save()
        DATA_SERVICE.cachedViewRange.rows.forEach(r => {
            const { startRow, startCol, endRow, endCol } = r.position
            this._painterSvc.line([[startCol, startRow],
            [endCol, startRow],
            [endCol, endRow],
            [startCol, endRow]])
            const box = new Box()
            box.position = r.position
            const attr = new TextAttr()
            attr.font = SETTINGS.fixedHeader.font
            const position = (r.coodinate.startRow + 1).toString()
            this._painterSvc.text(position, attr, box)
        })
        this._painterSvc.restore()
    }

    private _renderTopHeader() {
        this._painterSvc.save()
        DATA_SERVICE.cachedViewRange.cols.forEach(c => {
            const { startRow, startCol, endRow, endCol } = c.position
            this._painterSvc.line([[endCol, startRow],
            [endCol, endRow],
            [startCol, endRow],
            [startCol, startRow],
            ])
            const a1Notation = toA1notation(c.coodinate.startCol)
            const box = new Box()
            box.position = c.position
            const attr = new TextAttr()
            attr.font = SETTINGS.fixedHeader.font
            this._painterSvc.text(a1Notation, attr, box)
        })
        this._painterSvc.restore()
    }

    private _renderLeftTop() {
        this._painterSvc.save()
        const leftTop = SETTINGS.leftTop
        const attr = new CanvasAttr()
        attr.strokeStyle = leftTop.strokeStyle
        this._painterSvc.attr(attr)
        this._painterSvc.strokeRect(0, 0, leftTop.width, leftTop.height)
        this._painterSvc.restore()
    }

    private _fill(box: Box, style: StandardStyle) {
        const fill = style.fill
        if (!fill)
            return
        if (fill.bgColor !== '') {
            const color = StandardColor.fromArgb(fill.bgColor)
            const fillAttr = new CanvasAttr()
            fillAttr.fillStyle = color.css()
            this._painterSvc.attr(fillAttr)
            const { startRow, startCol } = box.position
            this._painterSvc.fillRect(startCol, startRow, box.width, box.height)
        }
        if (fill.fgColor !== '') {
            const color = StandardColor.fromArgb(fill.fgColor)
            this._painterSvc.fillFgColor(fill.type, color.css(), box)
        }
    }

    private _border(box: Box, position: Range, style: StandardStyle) {
        const border = style.border
        if (!border)
            return
        if (border.top)
            this._painterSvc.border(border.top, box, 'top')
        if (border.bottom)
            this._painterSvc.border(border.bottom, box, 'bottom')
        if (border.left)
            this._painterSvc.border(border.left, box, 'left')
        if (border.right)
            this._painterSvc.border(border.right, box, 'right')
        if (border.diagonalDown)
            this._painterSvc.line(
                [[position.startCol, position.startRow], [position.endCol, position.endRow]]
            )
        if (border.diagonalUp)
            this._painterSvc.line(
                [[position.startCol, position.endRow], [position.endCol, position.startRow]]
            )
    }

    private _renderGrid(canvas: HTMLCanvasElement) {
        const { cachedViewRange: viewRange } = DATA_SERVICE
        const { grid, leftTop } = SETTINGS
        this._painterSvc.save()
        const attr = new CanvasAttr()
        attr.lineWidth = grid.lineWidth
        this._painterSvc.attr(attr)
        const rect = canvas.getBoundingClientRect()
        if (grid.showHorizontal)
            viewRange.rows.forEach(r => {
                const y = r.position.startRow
                this._painterSvc.line([[leftTop.width, y], [rect.width, y]])
            })
        if (grid.showVertical)
            viewRange.cols.forEach(c => {
                const x = c.position.startCol
                this._painterSvc.line([[x, leftTop.height], [x, rect.height]])
            })
        this._painterSvc.restore()
    }

    private _comment(box: Box, range: Range) {
        const comment = DATA_SERVICE.sheetSvc
            .getSheet()
            ?.getComment(range.startRow, range.startCol)
        if (!comment)
            return
        this._painterSvc.comment(box)
    }

    private _text(box: Box, range: Range, style: StandardStyle) {
        const info = DATA_SERVICE.sheetSvc
            .getCell(range.startRow, range.startCol)
        if (!info)
            return
        const textAttr = new TextAttr()
        textAttr.alignment = style.alignment
        textAttr.setFont(style.getFont())
        this._painterSvc.text(info.getFormattedText(), textAttr, box)
    }
}
