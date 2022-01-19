import {Injectable, OnDestroy} from '@angular/core'
import {
    PainterService,
    CanvasAttrBuilder,
    BoxBuilder,
    TextAttrBuilder,
    Box,
} from '@logi-sheets/web/core/painter'
import {DataService, RenderCell} from '@logi-sheets/web/core/data'
import {StandardColor, Range} from '@logi-sheets/web/core/standable'
import {toA1notation} from '@logi-base/src/ts/common/index_notation'
import {Subscription, Observable, Subject} from 'rxjs'
import {Style} from '@logi-pb/network/src/proto/message_pb'

@Injectable({providedIn: 'root'})
export class Render extends Subscription implements OnDestroy {
    constructor(
        public readonly dataSvc: DataService,
    ) {
        super()
    }
    ngOnDestroy() {
        this.unsubscribe()
    }

    rendered$(): Observable<void> {
        return this._rendered$
    }

    render(canvas: HTMLCanvasElement): void {
        this._painterSvc.setupCanvas(canvas)
        const rect = canvas.getBoundingClientRect()
        this.dataSvc.initViewRange(rect.width, rect.height)
        this._renderGrid(canvas)
        this._renderContent()
        this._renderLeftHeader()
        this._renderTopHeader()
        this._renderLeftTop()
        this._rendered$.next()
    }

    private _painterSvc = new PainterService()
    private _rendered$ = new Subject<void>()

    private _renderCell(renderCell: RenderCell): void {
        const {coodinate: range, position} = renderCell
        const sheetSvc = this.dataSvc.sheetSvc
        const style = sheetSvc.getCell(range.startRow, range.startCol)?.style
        if (!style)
            return
        const box = new BoxBuilder().position(position).build()
        this._fill(box, style)
        this._border(box, position, style)
        this._text(box, range, style)
        this._comment(box, range)
    }

    /**
     * main content + freeze content.
     */
    private _renderContent(): void {
        this.dataSvc.cachedViewRange.cells.forEach(cell => {
            this._painterSvc.save()
            this._renderCell(cell)
            this._painterSvc.restore()
        })
    }

    private _renderLeftHeader(): void {
        this._painterSvc.save()
        const settings = this.dataSvc.settings
        this.dataSvc.cachedViewRange.rows.forEach(r => {
            const {startRow, startCol, endRow, endCol} = r.position
            this._painterSvc.line([[startCol, startRow],
                [endCol, startRow],
                [endCol, endRow],
                [startCol, endRow]],)
            const box = new BoxBuilder().position(r.position).build()
            const attr = new TextAttrBuilder()
                .font(settings.fixedHeader.font)
                .build()
            const position = (r.coodinate.startRow + 1).toString()
            this._painterSvc.text(position, attr, box)
        })
        this._painterSvc.restore()
    }

    private _renderTopHeader(): void {
        this._painterSvc.save()
        const settings = this.dataSvc.settings
        this.dataSvc.cachedViewRange.cols.forEach(c => {
            const {startRow, startCol, endRow, endCol} = c.position
            this._painterSvc.line([[endCol, startRow],
                [endCol, endRow],
                [startCol, endRow],
                [startCol, startRow],
            ])
            const a1Notation = toA1notation(c.coodinate.startCol)
            const box = new BoxBuilder().position(c.position).build()
            const attr = new TextAttrBuilder()
                .font(settings.fixedHeader.font)
                .build()
            this._painterSvc.text(a1Notation, attr, box)
        })
        this._painterSvc.restore()
    }

    private _renderLeftTop(): void {
        this._painterSvc.save()
        const leftTop = this.dataSvc.settings.leftTop
        const attr = new CanvasAttrBuilder()
            .strokeStyle(leftTop.strokeStyle)
            .build()
        this._painterSvc.attr(attr)
        this._painterSvc.strokeRect(0, 0, leftTop.width, leftTop.height)
        this._painterSvc.restore()
    }

    private _fill(box: Box, style: Style) {
        const fill = style.fill
        if (!fill)
            return
        if (fill.bgColor !== '') {
            const color = StandardColor.fromArgb(fill.bgColor)
            const fillAttr = new CanvasAttrBuilder()
                .fillStyle(color.css())
                .build()
            this._painterSvc.attr(fillAttr)
            const {startRow, startCol} = box.position
            this._painterSvc.fillRect(startCol, startRow, box.width, box.height)
        }
        if (fill.fgColor !== '') {
            const color = StandardColor.fromArgb(fill.fgColor)
            this._painterSvc.fillFgColor(fill.type, color.css(), box)
        }
    }

    private _border(box: Box, position: Range, style: Style) {
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

    private _renderGrid(canvas: HTMLCanvasElement): void {
        const viewRange = this.dataSvc.cachedViewRange
        const grid = this.dataSvc.settings.grid
        const leftTop = this.dataSvc.settings.leftTop
        this._painterSvc.save()
        const attr = new CanvasAttrBuilder().lineWidth(grid.lineWidth).build()
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
        const comment = this.dataSvc.sheetSvc
            .getSheet()
            ?.getComment(range.startRow, range.startCol)
        if (!comment)
            return
        this._painterSvc.comment(box)
    }

    private _text(box: Box, range: Range, style: Style) {
        const info = this.dataSvc.sheetSvc
            .getCell(range.startRow, range.startCol)
        if (!info)
            return
        const textAttr = new TextAttrBuilder()
            .alignment(style.alignment)
            .font(style.font)
            .build()
        this._painterSvc.text(info.getFormattedText(), textAttr, box)
    }
}
