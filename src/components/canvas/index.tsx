import { SelectedCell } from './events'
import { Subscription, Subject } from 'rxjs'
import styles from './canvas.module.scss'
import {
    MouseEvent,
    ReactElement,
    useRef,
    useState,
    FC,
    WheelEvent,
} from 'react'
import {
    useSelector,
    useStartCell,
    useScrollbar,
    useDnd,
    useText,
    useRender,
    useHighlightCell,
    useResizers,
    useMatch,
    StartCellEvent,
    SelectorChange,
} from './widgets'
import { Cell } from './defs'
import {
    ScrollbarComponent
} from '@/components/scrollbar'
import { EventType, on } from '@/core/events'
import { ContextmenuComponent } from './contextmenu'
import { SelectorComponent } from '@/components/selector'
import { ResizerComponent } from '@/components/resize'
import { BlurEvent, TextContainerComponent } from '@/components/textarea'
import { DndComponent } from '@/components/dnd'
import { InvalidFormulaComponent } from './invalid-formula'
import { Buttons } from '@/core'
import { CellInputBuilder } from '@/api'
import { DialogComponent } from '@/ui/dialog'
import { useInjection } from '@/core/ioc/provider'
import { Backend, DataService, SheetService } from '@/core/data'
import { TYPES } from '@/core/ioc/types'
export const OFFSET = 100

export interface CanvasProps {
    selectedCell$: (e: SelectedCell) => void
}

export const CanvasComponent: FC<CanvasProps> = ({ selectedCell$ }) => {
    const [contextmenuOpen, setContextMenuOpen] = useState(false)
    const [contextMenuEl, setContextMenu] = useState<ReactElement>()
    const canvasEl = useRef<HTMLCanvasElement>(null)
    const BACKEND_SERVICE = useInjection<Backend>(TYPES.Backend)
    const SHEET_SERVICE = useInjection<SheetService>(TYPES.Sheet)
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)

    const scrollbarMng = useScrollbar({canvas: canvasEl})
    const dndMng = useDnd(canvasEl)
    const highlights = useHighlightCell()
    const resizerMng = useResizers(canvasEl)
    const matchMng = useMatch(canvasEl)

    const focus$ = useRef(new Subject<void>())

    const rendered = () => {
        resizerMng.init()
    }

    const renderMng = useRender({
        canvas: canvasEl,
        rendered,
    })

    const startCellChange = (e: StartCellEvent) => {
        selectorMng.startCellChange(e)
        textMng.startCellChange(e)
        if (e === undefined || e.same)
            return
        if (e?.cell?.type !== 'Cell')
            return
        const { startRow: row, startCol: col } = e.cell.coodinate
        selectedCell$({ row, col })
    }
    const startCellMng = useStartCell({startCellChange})

    const selectorChange: SelectorChange = selector => {
        if (!selector) {
            dndMng.clean()
            return
        }
        const {startCell: start, endCell: end} = selector
        dndMng.selectorChange({start, end})
    }
    const selectorMng = useSelector({canvas: canvasEl, selectorChange})

    const onEdit = (editing: boolean, text?: string) => {
        if (!editing)
            return
        if (text === undefined)
            return
        highlights.init(text)
    }
    const textMng = useText({canvas: canvasEl, onEdit})


    const setScrollTop = (scrollTop: number, type: 'x' | 'y') => {
        scrollbarMng.setScrollTop(scrollTop, type)
        SHEET_SERVICE.getSheet()?.scroll?.update(type, scrollTop)
        renderMng.render()
        startCellMng.scroll()
    }

    const onMouseWheel = (e: WheelEvent) => {
        // only support y scrollbar
        const delta = e.deltaY
        const newScroll = scrollbarMng.mouseWheelScrolling(delta, 'y') ?? 0
        const oldScroll = SHEET_SERVICE.getSheet()?.scroll.y
        if (oldScroll === newScroll)
            return
        SHEET_SERVICE.getSheet()?.scroll?.update('y', newScroll)
        renderMng.render()
        startCellMng.scroll()
    }

    const onMousedown = async (e: MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        const mousedown = async () => {
            const isBlur = await textMng.blur()
            if (!isBlur) {
                focus$.current.next()
                return
            }
            if (e.buttons === Buttons.RIGHT)
                return
            const matchCell = matchMng.match(e.clientX, e.clientY, DATA_SERVICE.cachedViewRange)
            if (!matchCell)
                return
            const isResize = resizerMng.mousedown(e.nativeEvent)
            if (isResize)
                return
            const isDnd = dndMng.onMouseDown(e.nativeEvent)
            if (isDnd)
                return
            startCellMng.mousedown(e, matchCell)
        }
        mousedown()
        const sub = new Subscription()
        sub.add(on(window, EventType.MOUSE_UP).subscribe(() => {
            dndMng.onMouseUp()
            resizerMng.mouseup()
            sub.unsubscribe()
        }))
        sub.add(on(window, EventType.MOUSE_MOVE).subscribe(mme => {
            mme.preventDefault()
            const startCell = matchMng.match(mme.clientX, mme.clientY, DATA_SERVICE.cachedViewRange)
            if (!startCell)
                return
            const isResize = resizerMng.mousemove(mme)
            if (isResize)
                return
            if (startCellMng.startCell.current?.equals(startCell) === false) {
                const isDnd = dndMng.onMouseMove(mme, startCell, selectorMng.endCell ?? startCell)
                if (isDnd)
                    return
            }
            selectorMng.onMouseMove(startCell)
        }))
    }

    const blur = (e: BlurEvent<Cell>) => {
        const oldText = textMng.context?.text ?? ''
        textMng.blur()
        highlights.blur()
        if (e.bindingData === undefined)
            return
        const newText = textMng.currText.current.trim()
        if (oldText === newText)
            return
        const payload = new CellInputBuilder()
            .row(e.bindingData.coodinate.startRow)
            .col(e.bindingData.coodinate.startCol)
            .sheetIdx(SHEET_SERVICE.getActiveSheet())
            .input(newText)
            .build()
        BACKEND_SERVICE.sendTransaction([payload])
    }

    const onContextMenu = (e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const matchCell = matchMng.match(e.clientX, e.clientY, DATA_SERVICE.cachedViewRange)
        if (!matchCell)
            return
        startCellMng.mousedown(e, matchCell, selectorMng.selector)
        if (!selectorMng.startCell)
            return
        setContextMenu((
            <ContextmenuComponent
                isOpen={true}
                mouseevent={e}
                setIsOpen={setContextMenuOpen}
                startCell={selectorMng.startCell}
                endCell={selectorMng.endCell}
            ></ContextmenuComponent>
        ))
        setContextMenuOpen(true)
    }
    const type = (text: string) => {
        textMng.currText.current = text
        highlights.update(text)
    }

    return (<div
        onContextMenu={e => onContextMenu(e)}
        onMouseDown={onMousedown}
        className={styles.host}
    >
        <canvas
            className={styles.canvas}
            ref={canvasEl}
            onWheel={onMouseWheel}
        >你的浏览器不支持canvas，请升级浏览器</canvas>
        {contextmenuOpen && contextMenuEl ? contextMenuEl : null}
        {selectorMng.selector ? (
            <SelectorComponent
                {...selectorMng.selector}
            ></SelectorComponent>
        ) : null}
        <ScrollbarComponent
            {...scrollbarMng.xScrollbarAttr}
            setScrollTop={e => setScrollTop(e, 'x')}
        ></ScrollbarComponent>
        <ScrollbarComponent
            {...scrollbarMng.yScrollbarAttr}
            setScrollTop={e => setScrollTop(e, 'y')}
        ></ScrollbarComponent>
        {textMng.context && textMng.editing ?
            <TextContainerComponent
                context={textMng.context}
                blur={blur}
                type={type}
                checkFormula={textMng.checkFormula}
                focus$={focus$.current}
            ></TextContainerComponent>
            : null}
        {dndMng.range ? <DndComponent
            dragging={dndMng.dragging !== undefined}
            x={dndMng.range.startCol}
            y={dndMng.range.startRow}
            width={dndMng.range.width}
            height={dndMng.range.height}
            draggingX={dndMng.dragging?.startCol}
            draggingY={dndMng.dragging?.startRow}
        ></DndComponent> : null}
        <DialogComponent
            content={<InvalidFormulaComponent
                close$={() => textMng.setValidFormulaOpen(false)}
            ></InvalidFormulaComponent>}
            close$={() => textMng.setValidFormulaOpen(false)}
            isOpen={textMng.validFormulaOpen}
        ></DialogComponent>
        {
            highlights.highlightCells.map((cell, i) => {
                const cellStyle = cell.style
                return <div
                    className={styles['highlight-cell']}
                    style={{
                        left: cellStyle.x,
                        top: cellStyle.y,
                        width: `${cellStyle.width}px`,
                        height: `${cellStyle.height}px`,
                        backgroundColor: cellStyle.bgColor.css(),
                    }}
                    key={i}
                ></div>
            })
        }
        {
            resizerMng.resizers.map((resizer, i) => {
                const { startCol: x, startRow: y, width, height } = resizer.range
                const { isRow } = resizer
                const rect = (canvasEl.current as HTMLCanvasElement).getBoundingClientRect()
                return <ResizerComponent
                    hoverText={resizerMng.hoverText}
                    x={!isRow ? x : 0}
                    y={!isRow ? 0 : y}
                    width={width}
                    height={height}
                    key={i}
                    movingX={!isRow ? resizerMng.moving.x : 0}
                    movingY={isRow ? resizerMng.moving.y : 0}
                    movingHeight={!isRow ? rect.height : 0}
                    movingWidth={!isRow ? 0 : rect.width}
                    active={resizerMng.active === resizer}
                    type={isRow ? 'row' : 'col'}
                ></ResizerComponent>
            })
        }
    </div>
    )
}

export * from './events'
export * from './defs'