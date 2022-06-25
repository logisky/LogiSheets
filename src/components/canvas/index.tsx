import { SelectedCell } from './events'
import { Subscription, Subject } from 'rxjs'
import { debounceTime } from 'rxjs/operators'
import styles from './canvas.module.scss'
import {
    MouseEvent,
    ReactElement,
    useEffect,
    useRef,
    useState,
    FC,
} from 'react'
import {
    useSelector,
    useStartCell,
    useScrollbar,
    useDnd,
    useText,
    Render,
    useHighlightCell,
    useResizers,
} from './managers'
import { Cell, match } from './defs'
import {
    ScrollbarComponent
} from '@/components/scrollbar'
import { EventType, on } from '@/common/events'
import { DATA_SERVICE } from '@/core/data'
import { ContextmenuComponent } from './contextmenu'
import { SelectorComponent } from '@/components/selector'
import { ResizerComponent } from '@/components/resize'
import { BlurEvent, TextContainerComponent } from '@/components/textarea'
import { DndComponent } from '@/components/dnd'
import { InvalidFormulaComponent } from './invalid-formula'
import { Buttons } from '@/common'
import { CellInputBuilder } from '@/api'
import { DialogComponent } from '@/ui/dialog'
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
    const highlights = useHighlightCell()
    const renderMng = useRef(new Render())
    const resizerMng = useResizers()
    const focus$ = useRef(new Subject<void>())

    useEffect(() => {
        const subs = new Subscription()
        subs.add(DATA_SERVICE.backend.render$.subscribe(() => {
            renderMng.current.render(canvasEl.current!)
        }))
        subs.add(on(window, EventType.RESIZE)
            .pipe(debounceTime(100))
            .subscribe(() => {
                renderMng.current.render(canvasEl.current!)
            }))
        subs.add(renderMng.current.rendered$.subscribe(() => {
            // resizer manager依赖viewRange
            resizerMng.init()
        }))
        // 当前单元格
        subs.add(startCellMng.startCellEvent$.current.subscribe(e => {
            selectorMng.startCellChange(e)
            textMng.startCellChange(e)
            if (e === undefined || e.same)
                return
            if (e.cell.type !== 'Cell')
                return
            const { startRow: row, startCol: col } = e.cell.coodinate
            selectedCell$({ row, col })
        }))
        return () => {
            subs.unsubscribe()
        }
    }, [renderMng.current.rendered$])
    // 这里需要获取最新的state，所以useeffect不能加参数
    useEffect(() => {
        const subs = new Subscription()
        subs.add(on(window, EventType.RESIZE)
            .pipe(debounceTime(100))
            .subscribe(() => {
                scrollbarMng.resize(canvasEl.current!)
            }))
        return () => {
            subs.unsubscribe()
        }
    })

    // 初始化
    useEffect(() => {
        selectorMng.init(canvasEl.current!)
        scrollbarMng.initScrollbar(canvasEl.current!)
        textMng.init(canvasEl.current!)
        startCellMng.canvasChange()
        DATA_SERVICE.sendDisplayArea()
    }, [canvasEl])

    useEffect(() => {
        if (selectorMng.startCell)
            dndMng.selectorChange({
                canvas: canvasEl.current!,
                start: selectorMng.startCell,
                end: selectorMng.endCell,
            })
    }, [selectorMng.selector])

    // 监听用户开始输入
    useEffect(() => {
        if (!textMng.editing)
            return
        highlights.init(textMng.currText.current)
    }, [textMng.editing])

    // 监听滚动
    useEffect(() => {
        renderMng.current.render(canvasEl.current!)
        startCellMng.scroll()
    }, [scrollbarMng.xScrollbarAttr, scrollbarMng.yScrollbarAttr])

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
            const matchCell = match(e.clientX, e.clientY, canvasEl.current!)
            const isResize = resizerMng.mousedown(e.nativeEvent, canvasEl.current!)
            if (isResize)
                return
            const isDnd = dndMng.onMouseDown(e.nativeEvent)
            if (isDnd)
                return
            startCellMng.mousedown(e, matchCell, canvasEl.current!)
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
            const startCell = match(mme.clientX, mme.clientY, canvasEl.current!)
            const isResize = resizerMng.mousemove(mme)
            if (isResize)
                return
            if (startCellMng.startCell.current?.equals(startCell) === false) {
                const isDnd = dndMng.onMouseMove(mme, canvasEl.current!, startCell, selectorMng.endCell ?? startCell)
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
            .sheetIdx(DATA_SERVICE.sheetSvc.getActiveSheet())
            .input(newText)
            .build()
        DATA_SERVICE.backend.sendTransaction([payload])
    }

    const onContextMenu = (e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const matchCell = match(e.clientX, e.clientY, canvasEl.current!)
        startCellMng.mousedown(e, matchCell, canvasEl.current!, selectorMng.selector)
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
            onWheel={scrollbarMng.mouseWheel}
        >你的浏览器不支持canvas，请升级浏览器</canvas>
        {contextmenuOpen && contextMenuEl ? contextMenuEl : null}
        {selectorMng.selector ? (
            <SelectorComponent
                {...selectorMng.selector}
            ></SelectorComponent>
        ) : null}
        <ScrollbarComponent
            {...scrollbarMng.xScrollbarAttr}
            setScrollDistance={e => scrollbarMng.setScrollDistance(e, 'x')}
        ></ScrollbarComponent>
        <ScrollbarComponent
            {...scrollbarMng.yScrollbarAttr}
            setScrollDistance={e => scrollbarMng.setScrollDistance(e, 'y')}
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
            highlights.highlightCells.map(cell => {
                const cellStyle = cell.style
                return <div className={styles['highlight-cell']} style={{
                    left: cellStyle.x,
                    top: cellStyle.y,
                    width: `${cellStyle.width}px`,
                    height: `${cellStyle.height}px`,
                    backgroundColor: cellStyle.bgColor.css(),
                }}></div>
            })
        }
        {
            resizerMng.resizers.map((resizer, i) => {
                const { startCol: x, startRow: y, width, height } = resizer.range
                const { isRow } = resizer
                return <ResizerComponent
                    hoverText={resizerMng.hoverText}
                    x={!isRow ? x : 0}
                    y={!isRow ? 0 : y}
                    width={width}
                    height={height}
                    key={i}
                    movingX={!isRow ? resizerMng.moving.x : 0}
                    movingY={isRow ? resizerMng.moving.y : 0}
                    movingHeight={!isRow ? canvasEl.current!.getBoundingClientRect().height : 0}
                    movingWidth={!isRow ? 0 : canvasEl.current!.getBoundingClientRect().width}
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