import { SelectedCell } from './events'
import { Subscription } from 'rxjs'
import { CellInput, Payload } from 'proto/message'
import styles from './canvas.module.scss'
import {
    MouseEvent,
    ReactElement,
    useEffect,
    useRef,
    useState,
    WheelEvent,
    FC,
} from 'react'
import { useSelector, useStartCell, useScrollbar, useDnd, useText, Render } from './managers'
import { Cell } from './defs'
import { ScrollEvent, ScrollbarComponent } from 'components/scrollbar'
import { createSyntheticEvent, EventType, on } from 'global/events'
import { DATA_SERVICE } from 'core/data'
import { ContextmenuComponent } from './contextmenu'
import { SelectorComponent } from 'components/selector'
import { BlurEvent, TextContainerComponent } from 'components/textarea'
import { DndComponent } from 'components/dnd'
import { Buttons } from 'global'
export const OFFSET = 100

export interface CanvasProps {
    selectedCell$: (e: SelectedCell) => void
}

export const CanvasComponent: FC<CanvasProps> = ({ selectedCell$ }) => {
    const [contextmenuOpen, setContextMenuOpen] = useState(false)
    const [contextMenuEl, setContextMenu] = useState<ReactElement>()

    const canvasEl = useRef<HTMLCanvasElement>(null)

    const startCellMng = useStartCell()
    const selectorMng = useSelector()
    const scrollbarMng = useScrollbar()
    const dndMng = useDnd()
    const textMng = useText()
    const renderMng = new Render()

    useEffect(() => {
        const subs = new Subscription()
        subs.add(DATA_SERVICE.backend.render$.subscribe(() => {
            renderMng.render(getCanvas())
        }))
        subs.add(on(window, EventType.RESIZE).subscribe(() => {
            const canvas = getCanvas()
            renderMng.render(canvas)
        }))
        return () => {
            subs.unsubscribe()
        }
    }, [])
    useEffect(() => {
        const e = startCellMng.startCellEvent
        selectorMng.startCellChange(e)
        textMng.startCellChange(e)
        if (e === undefined || e.same)
            return
        if (e.cell.type !== 'Cell')
            return
        const { startRow: row, startCol: col } = e.cell.coodinate
        selectedCell$({ row, col })
    }, [startCellMng.startCellEvent])
    useEffect(() => {
        selectorMng.init(canvasEl.current!)
        scrollbarMng.initScrollbar(canvasEl.current!)
        textMng.init(canvasEl.current!)
        startCellMng.canvasChange(canvasEl.current!)
        DATA_SERVICE.sendDisplayArea()
    }, [canvasEl])
    useEffect(() => {
        dndMng.selectorChange(selectorMng.selector)
    }, [selectorMng.selector])

    const onMousedown = (e: MouseEvent) => {
        if (e.buttons === Buttons.RIGHT)
            return
        const canvas = getCanvas()
        if (!dndMng.isDragging)
            startCellMng.mousedown(e)
        const sub = new Subscription()
        sub.add(on(window, EventType.MOUSE_UP).subscribe(() => {
            if (!dndMng.isDragging)
                selectorMng.onMouseUp(canvas)
            dndMng.onMouseUp()
            sub.unsubscribe()
        }))
        sub.add(on(window, EventType.MOUSE_MOVE).subscribe(mme => {
            mme.preventDefault()
            if (!dndMng.isDragging)
                selectorMng.onMouseMove(mme, canvasEl.current!)
            const mouseevent = createSyntheticEvent(mme) as MouseEvent
            dndMng.onMouseMove(mouseevent, canvas)
        }))
    }

    const blur = (e: BlurEvent<Cell>) => {
        const oldText = textMng.context?.text ?? ''
        textMng.blur()
        if (e.bindingData === undefined)
            return
        const newText = e.text.trim()
        if (oldText === newText)
            return
        const cellInput: CellInput = {
            sheetIdx: DATA_SERVICE.sheetSvc.getActiveSheet(),
            row: e.bindingData.coodinate.startRow,
            col: e.bindingData.coodinate.startCol,
            input: newText,
        }
        const payload: Payload = {
            payloadOneof: {
                $case: 'cellInput',
                cellInput,
            }
        }
        DATA_SERVICE.backend.sendTransaction([payload])
    }

    const mouseMoveScrolling = (e: ScrollEvent) => {
        scrollbarMng.mouseMove(e)
        renderMng.render(canvasEl.current!)
    }
    const mouseWheelScroll = (e: WheelEvent<HTMLCanvasElement>) => {
        scrollbarMng.mouseWheel(e)
        renderMng.render(e.currentTarget)
    }

    const onContextMenu = (e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        startCellMng.mousedown(e, selectorMng.selector)
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
    const getCanvas = () => {
        if (!canvasEl.current)
            throw Error('Not have canvas')
        return canvasEl.current
    }

    return (<div
        onContextMenu={e => onContextMenu(e)}
        onMouseDown={onMousedown}
        className={styles.host}
    >
        <canvas
            className={styles.canvas}
            ref={canvasEl}
            onWheel={mouseWheelScroll}
        >你的浏览器不支持canvas，请升级浏览器</canvas>
        {contextmenuOpen && contextMenuEl ? contextMenuEl : null}
        {selectorMng.selector ? (
            <div className={styles.selector}>
                <SelectorComponent
                    {...selectorMng.selector}
                ></SelectorComponent>
            </div>
        ) : null}
        <ScrollbarComponent {...scrollbarMng.xScrollbar} mousemove$={mouseMoveScrolling}></ScrollbarComponent>
        <ScrollbarComponent {...scrollbarMng.yScrollbar} mousemove$={mouseMoveScrolling}></ScrollbarComponent>
        {textMng.context && textMng.editing ?
            <TextContainerComponent
                context={textMng.context}
                blur={blur}
            ></TextContainerComponent>
            : null}
        {selectorMng.selector ? <DndComponent
            mousedown={dndMng.onMouseDown}
            x={dndMng.x}
            y={dndMng.y}
            width={dndMng.width}
            height={dndMng.height}
            draggingX={dndMng.draggingX}
            draggingY={dndMng.draggingY}
        ></DndComponent> : null}
    </div>
    )
}

export * from './events'
export * from './defs'