import {pxToPt} from '@/core'
import {Backend, DataService, RenderCell, SheetService} from '@/core/data'
import {Range} from '@/core/standable'
import {RefObject, useRef, useState} from 'react'
import {getOffset} from '../defs'
import {SetColWidthBuilder, SetRowHeightBuilder} from '@/api'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
interface ResizerProps {
    /**
     * Resizer的位置信息
     */
    readonly range: Range
    readonly isRow: boolean
    /**
     * resizer绑定的左边cell信息。从viewRange取，resizer只对左边的cell作用
     */
    readonly leftCell: RenderCell
}
const RESIZER_SIZE = 4
export const useResizers = (canvas: RefObject<HTMLCanvasElement>) => {
    const [resizers, setResizers] = useState<ResizerProps[]>([])
    const [active, setActive] = useState<ResizerProps>()
    const [moving, setMoving] = useState({x: 0, y: 0})
    const BACKEND_SERVICE = useInjection<Backend>(TYPES.Backend)
    const SHEET_SERVICE = useInjection<SheetService>(TYPES.Sheet)
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)
    /**
     * 拖动过程中显示的宽度信息
     */
    const [hoverText, setHoverText] = useState('')
    const movingStart = useRef<{x: number; y: number}>()
    const _active = useRef<ResizerProps>()
    const _setActive = (newActive?: ResizerProps) => {
        setActive(newActive)
        _active.current = newActive
    }
    const init = () => {
        const viewRange = DATA_SERVICE.cachedViewRange
        const rowResizers = viewRange.rows.map((cell) => {
            return {
                range: new Range()
                    .setStartRow(cell.position.endRow)
                    .setEndRow(cell.position.endRow + RESIZER_SIZE)
                    .setStartCol(cell.position.startCol)
                    .setEndCol(cell.position.endCol),
                isRow: true,
                leftCell: cell,
            }
        })
        const colResizers = viewRange.cols.map((cell) => {
            return {
                range: new Range()
                    .setStartCol(cell.position.endCol)
                    .setStartRow(cell.position.startRow)
                    .setEndCol(cell.position.endCol + RESIZER_SIZE)
                    .setEndRow(cell.position.endRow),
                isRow: false,
                leftCell: cell,
            }
        })
        setResizers(rowResizers.concat(colResizers))
    }
    const mousedown = (e: MouseEvent) => {
        if (!canvas.current) return
        const {x, y} = getOffset(e.clientX, e.clientY, canvas.current)
        const mousedownRange = new Range()
            .setStartRow(y)
            .setEndRow(y)
            .setStartCol(x)
            .setEndCol(x)
        const i = resizers.findIndex((r) => r.range.cover(mousedownRange))
        if (i === -1) return false
        const activeResizer = resizers[i]
        if (!activeResizer) return false
        movingStart.current = {x: e.clientX, y: e.clientY}
        const sheet = SHEET_SERVICE
        const {startCol, startRow} = activeResizer.leftCell.coodinate
        const info = activeResizer.isRow
            ? sheet.getRowInfo(startCol)
            : sheet.getColInfo(startRow)
        setHoverText(`${info.px}px`)
        _setActive(activeResizer)
        setMoving({x: 0, y: 0})
        return true
    }
    const mousemove = (e: MouseEvent) => {
        if (!_active.current || !movingStart.current) return false
        const {
            isRow,
            leftCell: {
                position: {startCol, startRow, endCol, endRow},
            },
        } = _active.current
        let px = 0
        if (isRow) {
            const newEndRow = endRow + e.clientY - movingStart.current.y
            if (newEndRow > startRow) px = newEndRow - startRow
        } else {
            const newEndCol = endCol + e.clientX - movingStart.current.x
            if (newEndCol > startCol) px = newEndCol - startCol
        }
        px = parseFloat(px.toFixed(2))
        setHoverText(`${px}px`)
        setMoving((old) => {
            return {
                x: isRow ? old.x : px - (endCol - startCol),
                y: !isRow ? old.y : px - (endRow - startRow),
            }
        })
        return true
    }
    const mouseup = () => {
        if (_active.current) {
            const {
                isRow,
                leftCell: {coodinate, width, height},
            } = _active.current
            const payload = !isRow
                ? new SetColWidthBuilder()
                      .sheetIdx(SHEET_SERVICE.getActiveSheet())
                      .col(coodinate.startCol)
                      .width(pxToPt(moving.x + width))
                      .build()
                : new SetRowHeightBuilder()
                      .sheetIdx(SHEET_SERVICE.getActiveSheet())
                      .row(coodinate.startRow)
                      .height(pxToPt(moving.y + height))
                      .build()
            BACKEND_SERVICE.sendTransaction([payload])
        }
        _setActive(undefined)
        setMoving({x: 0, y: 0})
        movingStart.current = undefined
    }
    return {
        resizers,
        active,
        moving,
        hoverText,
        init,
        mousedown,
        mousemove,
        mouseup,
        resizerSize: RESIZER_SIZE,
    }
}
