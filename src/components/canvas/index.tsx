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
} from './managers'
import { Cell } from './defs'
import { 
    ScrollbarComponent } from 'components/scrollbar'
import { createSyntheticEvent, EventType, on } from 'common/events'
import { DATA_SERVICE } from 'core/data'
import { ContextmenuComponent } from './contextmenu'
import { SelectorComponent } from 'components/selector'
import { BlurEvent, TextContainerComponent } from 'components/textarea'
import { DndComponent } from 'components/dnd'
import {InvalidFormulaComponent} from './invalid-formula'
import { Buttons } from 'common'
import { CellInputBuilder } from 'api'
import { DialogComponent } from 'ui/dialog'
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
    const focus$ = useRef(new Subject<void>())

    useEffect(() => {
        const subs = new Subscription()
        subs.add(DATA_SERVICE.backend.render$.subscribe(() => {
            renderMng.current.render(getCanvas())
        }))
        subs.add(on(window, EventType.RESIZE)
            .pipe(debounceTime(100))
            .subscribe(() => {
                const canvas = getCanvas()
                renderMng.current.render(canvas)
            }))
        return () => {
            subs.unsubscribe()
        }
    }, [])
    // 这里需要获取最新的state，所以useeffect不能加参数
    useEffect(() => {
        const subs = new Subscription()
        subs.add(on(window, EventType.RESIZE)
            .pipe(debounceTime(100))
            .subscribe(() => {
                const canvas = getCanvas()
                scrollbarMng.resize(canvas)
            }))
        return () => {
            subs.unsubscribe()
        }
    })

    // 当前单元格
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

    // 初始化
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
    }, [scrollbarMng.xScrollDistance, scrollbarMng.yScrollDistance])

    const onMousedown = async (e: MouseEvent) => {
        e.stopPropagation()
        const checked = await textMng.checkFormula()
        if (!checked) {
            e.preventDefault()
            focus$.current.next()
            return
        }
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
    const type = (text: string) => {
        textMng.currText.current = text
        highlights.update(text)
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
            onWheel={scrollbarMng.mouseWheel}
        >你的浏览器不支持canvas，请升级浏览器</canvas>
        {contextmenuOpen && contextMenuEl ? contextMenuEl : null}
        {selectorMng.selector ? (
            <div className={styles.selector}>
                <SelectorComponent
                    {...selectorMng.selector}
                ></SelectorComponent>
            </div>
        ) : null}
        <ScrollbarComponent
            direction={'x'}
            scrollDistance={scrollbarMng.xScrollDistance}
            containerLength={scrollbarMng.size.width}
            containerTotalLength={scrollbarMng.totalSize.width}
            paddingLeft={20}
            paddingRight={10}
            setScrollDistance={e => scrollbarMng.setScrollDistance(e, 'x')}
        ></ScrollbarComponent>
        <ScrollbarComponent
            direction={'y'}
            scrollDistance={scrollbarMng.yScrollDistance}
            containerLength={scrollbarMng.size.height}
            containerTotalLength={scrollbarMng.totalSize.height}
            paddingTop={20}
            paddingBottom={10}
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
        {selectorMng.selector ? <DndComponent
            mousedown={dndMng.onMouseDown}
            x={dndMng.x}
            y={dndMng.y}
            width={dndMng.width}
            height={dndMng.height}
            draggingX={dndMng.draggingX}
            draggingY={dndMng.draggingY}
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
    </div>
    )
}

export * from './events'
export * from './defs'