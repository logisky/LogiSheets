import {SelectorProps, selectorStore} from '@/components/selector'
import {useInjection} from '@/core/ioc/provider'
import {DataService, RenderCell} from '@/core/data'
import {TYPES} from '@/core/ioc/types'
import {useLocalStore} from 'mobx-react'
import {Cell} from '../defs'
import {MouseEvent, WheelEvent, useEffect, useRef} from 'react'
import {Range} from '@/core/standable'
import { canvasStore as _canvasStore, canvasStore } from '../store'
import { Buttons } from '@/core'
import { CustomScrollEvent } from '@/components/scrollbar'

export const getPosition = (selector: SelectorProps) => {
    return new Range()
        .setStartRow(selector.y)
        .setStartCol(selector.x)
        .setEndRow(
            selector.y +
                selector.height +
                selector.borderTopWidth +
                selector.borderBottomWidth
        )
        .setEndCol(
            selector.x +
                selector.width +
                selector.borderLeftWidth +
                selector.borderRightWidth
        )
}
export const getSelector = (
    canvas: HTMLCanvasElement,
    start: Cell,
    end?: Cell
) => {
    const {type, width, height, position: startPos} = start
    const endCellInner = end ?? start
    const {position: endPos} = endCellInner
    if (type === 'unknown') return
    const selector = new SelectorProps()
    selector.width = width
    selector.height = height
    // 在单元格内框选
    if (endPos.startRow < startPos.startRow) {
        selector.borderTopWidth = startPos.startRow - endPos.startRow
        selector.y = endPos.startRow
    } else {
        selector.borderBottomWidth = endPos.endRow - startPos.endRow
        selector.y = startPos.startRow
    }
    if (endPos.startCol < startPos.startCol) {
        selector.borderLeftWidth = startPos.startCol - endPos.startCol
        selector.x = endPos.startCol
    } else {
        selector.borderRightWidth = endPos.endCol - startPos.endCol
        selector.x = startPos.startCol
    }
    // 起始点在左固定栏、上固定栏、leftTop
    const {width: totalWidth, height: totalHeight} =
        canvas.getBoundingClientRect()
    if (type === 'LeftTop') {
        selector.x = startPos.startRow
        selector.y = startPos.startCol
        selector.borderRightWidth = totalWidth - width
        selector.borderBottomWidth = totalHeight - height
    }
    // 起始点在左固定栏、上固定栏时，x,y的判断和type==='cell'一致
    else if (type === 'FixedLeftHeader')
        selector.borderRightWidth = totalWidth - width
    else if (type === 'FixedTopHeader')
        selector.borderBottomWidth = totalHeight - height
    return selector
}

export const useSelector = () => {
    const moving = useRef(false)
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)
    const selector = useLocalStore(() => selectorStore)
    const canvas = useLocalStore(() => canvasStore)

    useEffect(() => {
        const sub = canvas.obs().subscribe(data => {
            if (data.type === 'yScroll') {
                const {e, newScroll, oldScroll} = data.args
                if (newScroll !== oldScroll) scroll(e)
            } else if (data.type === 'xScroll') {
                const {e, newScroll, oldScroll} = data.args
                if (newScroll !== oldScroll) scroll(e)
            } else if (data.type === 'mouseup') onMouseUp()
            else if (data.type === 'mousemove') {
                const {e, startCell} = data.args
                if (!canvas.resizing && !canvas.dnding) onMouseMove(startCell)
            } else if (data.type === 'mousedown') {
                const {e, cell} = data.args
                onMouseDown(e, cell)
            } else if (data.type === 'contextmenu') {
                const {e, cell} = data.args
                onMouseDown(e, cell)
            }
        })
        return () => {
            sub.unsubscribe()
        }
    }, [])

    const onContextmenu = (e: MouseEvent, startCell: Cell) => {
        selector.setCells(startCell, {e, changed: true}, startCell)
    }

    const onMouseMove = (endCell: Cell) => {
        if (!selector.startCell || !selector.startCellInfo || !moving.current) return
        selector.setCells(selector.startCell, selector.startCellInfo, endCell)
    }
    const onMouseDown = (e: MouseEvent, matchCell: Cell) => {
        const buttons = e.buttons
        if (buttons !== Buttons.LEFT) return
        moving.current = true
        selector.setCells(matchCell, {
            e,
            changed: !!(selector.startCell && matchCell.equals(selector.startCell))
        }, matchCell)
    }

    const scroll = (e: WheelEvent | CustomScrollEvent) => {
        const oldStartCell = selector.startCell
        if (
            !oldStartCell ||
            oldStartCell.type === 'LeftTop' ||
            oldStartCell.type === 'unknown'
        )
            return
        let renderCell: RenderCell | undefined
        const viewRange = DATA_SERVICE.cachedViewRange
        if (oldStartCell.type === 'FixedLeftHeader')
            renderCell = viewRange.rows.find((r) =>
                r.coodinate.cover(oldStartCell.coodinate)
            )
        else if (oldStartCell.type === 'FixedTopHeader')
            renderCell = viewRange.cols.find((c) =>
                c.coodinate.cover(oldStartCell.coodinate)
            )
        else if (oldStartCell.type === 'Cell')
            renderCell = viewRange.cells.find((c) =>
                c.coodinate.cover(oldStartCell.coodinate)
            )
        else return
        if (!renderCell) {
            selector.reset()
            return
        }
        const newStartCell = new Cell(oldStartCell.type).copyByRenderCell(
            renderCell
        )
        selector.setCells(newStartCell, {
            e,
            changed: false,
            scroll: true,
        }, newStartCell)
    }
    const onMouseUp = () => {
        moving.current = false
    }

    return {
        onContextmenu,
        onMouseMove,
        onMouseDown,
        onMouseUp,
        scroll,
    }
}
