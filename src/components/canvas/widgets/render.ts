import {PainterService, Box, TextAttr, CanvasAttr} from '@/core/painter'
import {Backend, DataService, RenderCell, SheetService} from '@/core/data'
import {StandardColor, Range} from '@/core/standable'
import {SETTINGS} from '@/core/settings'
import {hasOwnProperty, toA1notation} from '@/core'
import {StandardStyle} from '@/core/standable/style'
import {TYPES} from '@/core/ioc/types'
import {useInjection} from '@/core/ioc/provider'
import {RefObject, useEffect, useRef} from 'react'
import {Subscription} from 'rxjs'
import {EventType, on} from '@/core/events'

interface RenderProps {
    readonly canvas: RefObject<HTMLCanvasElement>
    readonly rendered: () => void
}

export const useRender = ({canvas, rendered}: RenderProps) => {
    const dataSvc = useInjection<DataService>(TYPES.Data)
    const sheetSvc = useInjection<SheetService>(TYPES.Sheet)
    const backendSvc = useInjection<Backend>(TYPES.Backend)

    const painterSvc = useRef(new PainterService())

    useEffect(() => {
        const subs = new Subscription()
        render()
        subs.add(
            backendSvc.render$.subscribe(() => {
                render()
            })
        )
        subs.add(
            on(window, EventType.RESIZE).subscribe(() => {
                render()
            })
        )
        dataSvc.sendDisplayArea()
        return () => {
            subs.unsubscribe()
        }
    }, [])

    const render = () => {
        if (!canvas.current) throw Error('canvas not found')
        painterSvc.current.setupCanvas(canvas.current)
        const rect = canvas.current.getBoundingClientRect()
        dataSvc.initViewRange(rect.width, rect.height)
        _renderGrid(canvas.current)
        _renderContent()
        _renderLeftHeader()
        _renderTopHeader()
        _renderLeftTop()
        rendered()
    }
    const _renderCell = (renderCell: RenderCell) => {
        const {coodinate: range, position} = renderCell
        const style = sheetSvc.getCell(range.startRow, range.startCol)?.style
        const box = new Box()
        box.position = position
        _fill(box, style)
        _border(box, position, style)
        _text(box, range, style)
        _comment(box, range)
    }

    /**
     * main content + freeze content.
     */
    const _renderContent = () => {
        dataSvc.cachedViewRange.cells.forEach((cell) => {
            painterSvc.current.save()
            _renderCell(cell)
            painterSvc.current.restore()
        })
    }

    const _renderLeftHeader = () => {
        painterSvc.current.save()
        dataSvc.cachedViewRange.rows.forEach((r) => {
            const {startRow, startCol, endRow, endCol} = r.position
            painterSvc.current.line([
                [startCol, startRow],
                [endCol, startRow],
                [endCol, endRow],
                [startCol, endRow],
            ])
            const box = new Box()
            box.position = r.position
            const attr = new TextAttr()
            attr.font = SETTINGS.fixedHeader.font
            const position = (r.coodinate.startRow + 1).toString()
            painterSvc.current.text(position, attr, box)
        })
        painterSvc.current.restore()
    }

    const _renderTopHeader = () => {
        painterSvc.current.save()
        dataSvc.cachedViewRange.cols.forEach((c) => {
            const {startRow, startCol, endRow, endCol} = c.position
            painterSvc.current.line([
                [endCol, startRow],
                [endCol, endRow],
                [startCol, endRow],
                [startCol, startRow],
            ])
            const a1Notation = toA1notation(c.coodinate.startCol)
            const box = new Box()
            box.position = c.position
            const attr = new TextAttr()
            attr.font = SETTINGS.fixedHeader.font
            painterSvc.current.text(a1Notation, attr, box)
        })
        painterSvc.current.restore()
    }

    const _renderLeftTop = () => {
        painterSvc.current.save()
        const leftTop = SETTINGS.leftTop
        const attr = new CanvasAttr()
        attr.strokeStyle = leftTop.strokeStyle
        painterSvc.current.attr(attr)
        painterSvc.current.strokeRect(0, 0, leftTop.width, leftTop.height)
        painterSvc.current.restore()
    }

    const _fill = (box: Box, style?: StandardStyle) => {
        const fill = style?.fill
        if (!fill || !hasOwnProperty(fill, 'patternFill')) return
        const patternFill = fill.patternFill
        if (patternFill.bgColor) {
            const color = StandardColor.fromCtColor(patternFill.bgColor)
            const fillAttr = new CanvasAttr()
            fillAttr.fillStyle = color.css()
            painterSvc.current.attr(fillAttr)
            const {startRow, startCol} = box.position
            painterSvc.current.fillRect(
                startCol,
                startRow,
                box.width,
                box.height
            )
        }
        if (patternFill.fgColor) {
            const color = StandardColor.fromCtColor(patternFill.fgColor)
            painterSvc.current.fillFgColor(
                patternFill?.patternType ?? 'None',
                color.css(),
                box
            )
        }
    }

    const _border = (box: Box, position: Range, style?: StandardStyle) => {
        const border = style?.border
        if (!border) return
        if (border.top) painterSvc.current.border(border.top, box, 'top')
        if (border.bottom)
            painterSvc.current.border(border.bottom, box, 'bottom')
        if (border.left) painterSvc.current.border(border.left, box, 'left')
        if (border.right) painterSvc.current.border(border.right, box, 'right')
        if (border.diagonalDown)
            painterSvc.current.line([
                [position.startCol, position.startRow],
                [position.endCol, position.endRow],
            ])
        if (border.diagonalUp)
            painterSvc.current.line([
                [position.startCol, position.endRow],
                [position.endCol, position.startRow],
            ])
    }

    const _renderGrid = (canvas: HTMLCanvasElement) => {
        const {cachedViewRange: viewRange} = dataSvc
        const {grid, leftTop} = SETTINGS
        painterSvc.current.save()
        const attr = new CanvasAttr()
        attr.lineWidth = grid.lineWidth
        painterSvc.current.attr(attr)
        const rect = canvas.getBoundingClientRect()
        if (grid.showHorizontal)
            viewRange.rows.forEach((r) => {
                const y = r.position.startRow
                painterSvc.current.line([
                    [leftTop.width, y],
                    [rect.width, y],
                ])
            })
        if (grid.showVertical)
            viewRange.cols.forEach((c) => {
                const x = c.position.startCol
                painterSvc.current.line([
                    [x, leftTop.height],
                    [x, rect.height],
                ])
            })
        painterSvc.current.restore()
    }

    const _comment = (box: Box, range: Range) => {
        const comment = sheetSvc
            .getSheet()
            ?.getComment(range.startRow, range.startCol)
        if (!comment) return
        painterSvc.current.comment(box)
    }

    const _text = (box: Box, range: Range, style?: StandardStyle) => {
        const info = sheetSvc.getCell(range.startRow, range.startCol)
        if (!info) return
        const textAttr = new TextAttr()
        if (style) {
            textAttr.alignment = style.alignment
            textAttr.setFont(style.getFont())
        }
        painterSvc.current.text(info.getFormattedText(), textAttr, box)
    }
    return {
        render,
    }
}
