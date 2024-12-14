import {makeObservable} from 'mobx'
import {CanvasStore} from './store'
import {Box, CanvasAttr, PainterService, TextAttr} from '@/core/painter'
import {simpleUuid, toA1notation} from '@/core'
import {CellViewData, CellViewRespType, RenderCell} from '@/core/data2'
import {SETTINGS} from '@/core/settings'
import {StandardColor, Range, StandardCell} from '@/core/standable'
import {StandardStyle} from '@/core/standable/style'
import {PatternFill} from 'logisheets-web'
export const CANVAS_ID = simpleUuid()
const BUFFER_SIZE = 200

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
            rect.x - BUFFER_SIZE,
            rect.y - BUFFER_SIZE,
            rect.height + BUFFER_SIZE * 3,
            rect.width + BUFFER_SIZE * 1.5
        )
        if (resp.type === CellViewRespType.New) {
            this._painterService.setupCanvas(this.canvas)
            this._painterService.clear()
        }
        if (resp.type !== CellViewRespType.Existed) {
            const data = resp.data
            this._renderGrid(data)
            this._renderContent(data)
            this._renderLeftHeader(data)
            this._renderTopHeader(data)
            this._renderLeftTop()
        }

        // rerender resizer
        this.store.resizer.init()
    }

    private _painterService = new PainterService()

    private _renderCell(renderCell: RenderCell) {
        const {coordinate: range, position, info} = renderCell
        const style = info?.style
        const box = new Box()
        box.position = position
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
    private _renderContent(data: readonly CellViewData[]) {
        this._painterService.save()
        data.forEach((d) => {
            d.cells.forEach((cell) => {
                this._renderCell(cell)
            })
        })
        this._painterService.restore()
    }

    private _renderLeftHeader(data: readonly CellViewData[]) {
        this._painterService.save()
        data.forEach((d) => {
            d.rows.forEach((r) => {
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
        })
        this._painterService.restore()
    }

    private _renderTopHeader(data: readonly CellViewData[]) {
        this._painterService.save()
        data.forEach((d) => {
            d.cols.forEach((c) => {
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

    private _renderGrid(data: readonly CellViewData[]) {
        const {grid, leftTop} = SETTINGS
        this._painterService.save()
        const attr = new CanvasAttr()
        attr.lineWidth = grid.lineWidth
        this._painterService.attr(attr)
        const rect = this.canvas.getBoundingClientRect()
        if (grid.showHorizontal)
            data.forEach((d) => {
                d.rows.forEach((r) => {
                    const y = r.position.startRow
                    this._painterService.line([
                        [leftTop.width, y],
                        [rect.width, y],
                    ])
                })
            })
        if (grid.showVertical)
            data.forEach((d) => {
                d.cols.forEach((c) => {
                    const x = c.position.startCol
                    this._painterService.line([
                        [x, leftTop.height],
                        [x, rect.height],
                    ])
                })
            })
        this._painterService.restore()
    }

    // private _comment(box: Box, comment: Comment | undefined) {
    //     if (!comment) return
    //     this._painterService.comment(box)
    // }

    private _text(box: Box, info: StandardCell) {
        const textAttr = new TextAttr()
        if (info.style) {
            textAttr.alignment = info.style.alignment
            textAttr.setFont(info.style.getFont())
        }
        this._painterService.text(info.getFormattedText(), textAttr, box)
    }
}
