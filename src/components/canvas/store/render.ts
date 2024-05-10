import {makeObservable} from 'mobx'
import {CanvasStore} from './store'
import {Box, CanvasAttr, PainterService, TextAttr} from '@/core/painter'
import {simpleUuid, toA1notation} from '@/core'
import {RenderCell} from '@/core/data'
import {SETTINGS} from '@/core/settings'
import {StandardColor, Range} from '@/core/standable'
import {StandardStyle} from '@/core/standable/style'
import {PatternFill} from '@logisheets_bg'
export const CANVAS_ID = simpleUuid()

export class Render {
    constructor(public readonly store: CanvasStore) {
        makeObservable(this)
    }
    get canvas() {
        return document.getElementById(CANVAS_ID) as HTMLCanvasElement
    }

    render() {
        this._painterService.setupCanvas(this.canvas)
        this._painterService.clear()
        const rect = this.canvas.getBoundingClientRect()
        this.store.dataSvc.initViewRange(rect.width, rect.height)
        this._renderGrid()
        this._renderContent()
        this._renderLeftHeader()
        this._renderTopHeader()
        this._renderLeftTop()

        // rerender resizer
        this.store.resizer.init()
    }

    private _painterService = new PainterService()

    private _renderCell(renderCell: RenderCell) {
        const {coordinate: range, position} = renderCell
        const style = this.store.sheetSvc.getCell(
            range.startRow,
            range.startCol
        )?.style
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
        this.store.dataSvc.cachedViewRange.cells.forEach((cell) => {
            this._painterService.save()
            this._renderCell(cell)
            this._painterService.restore()
        })
    }

    private _renderLeftHeader() {
        this._painterService.save()
        this.store.dataSvc.cachedViewRange.rows.forEach((r) => {
            const {startRow, startCol, endRow, endCol} = r.position
            this._painterService.line([
                [startCol, startRow],
                [endCol, startRow],
                [endCol, endRow],
                [startCol, endRow],
            ])
            const box = new Box()
            box.position = r.position
            const attr = new TextAttr()
            attr.font = SETTINGS.fixedHeader.font
            const position = (r.coordinate.startRow + 1).toString()
            this._painterService.text(position, attr, box)
        })
        this._painterService.restore()
    }

    private _renderTopHeader() {
        this._painterService.save()
        this.store.dataSvc.cachedViewRange.cols.forEach((c) => {
            const {startRow, startCol, endRow, endCol} = c.position
            this._painterService.line([
                [endCol, startRow],
                [endCol, endRow],
                [startCol, endRow],
                [startCol, startRow],
            ])
            const a1Notation = toA1notation(c.coordinate.startCol)
            const box = new Box()
            box.position = c.position
            const attr = new TextAttr()
            attr.font = SETTINGS.fixedHeader.font
            this._painterService.text(a1Notation, attr, box)
        })
        this._painterService.restore()
    }

    private _renderLeftTop() {
        this._painterService.save()
        const leftTop = SETTINGS.leftTop
        const attr = new CanvasAttr()
        attr.strokeStyle = leftTop.strokeStyle
        this._painterService.attr(attr)
        this._painterService.strokeRect(0, 0, leftTop.width, leftTop.height)
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

    private _renderGrid() {
        const {cachedViewRange: viewRange} = this.store.dataSvc
        const {grid, leftTop} = SETTINGS
        this._painterService.save()
        const attr = new CanvasAttr()
        attr.lineWidth = grid.lineWidth
        this._painterService.attr(attr)
        const rect = this.canvas.getBoundingClientRect()
        if (grid.showHorizontal)
            viewRange.rows.forEach((r) => {
                const y = r.position.startRow
                this._painterService.line([
                    [leftTop.width, y],
                    [rect.width, y],
                ])
            })
        if (grid.showVertical)
            viewRange.cols.forEach((c) => {
                const x = c.position.startCol
                this._painterService.line([
                    [x, leftTop.height],
                    [x, rect.height],
                ])
            })
        this._painterService.restore()
    }

    private _comment(box: Box, range: Range) {
        const comment = this.store.sheetSvc
            .getSheet()
            ?.getComment(range.startRow, range.startCol)
        if (!comment) return
        this._painterService.comment(box)
    }

    private _text(box: Box, range: Range, style?: StandardStyle) {
        const info = this.store.sheetSvc.getCell(range.startRow, range.startCol)
        if (!info) return
        const textAttr = new TextAttr()
        if (style) {
            textAttr.alignment = style.alignment
            textAttr.setFont(style.getFont())
        }
        this._painterService.text(info.getFormattedText(), textAttr, box)
    }
}
