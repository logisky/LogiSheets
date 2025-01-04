import {SelectedCell} from './events'
import styles from './canvas.module.scss'
import {
    MouseEvent,
    ReactElement,
    useRef,
    useState,
    FC,
    WheelEvent,
    KeyboardEvent,
    useEffect,
    useContext,
} from 'react'
import {debounceTime, take, takeUntil} from 'rxjs/operators'
import {Cell} from './defs'
import {ScrollbarComponent} from '@/components/scrollbar'
import {EventType, KeyboardEventCode, on} from '@/core/events'
import {ContextmenuComponent} from './contextmenu'
import {SelectorComponent} from '@/components/selector'
import {ResizerComponent} from '@/components/resize'
import {ITextareaInstance, TextContainerComponent} from '@/components/textarea'
import {DndComponent} from '@/components/dnd'
import {InvalidFormulaComponent} from './invalid-formula'
import {Buttons, simpleUuid} from '@/core'
import {DialogComponent} from '@/ui/dialog'
import {useInjection} from '@/core/ioc/provider'
import {DataServiceImpl, MAX_COUNT, RenderCell} from '@/core/data'
import {TYPES} from '@/core/ioc/types'
import {CANVAS_ID, CanvasStore, CanvasStoreContext} from './store'
import {observer} from 'mobx-react'
const CANVAS_HOST_ID = simpleUuid()
const canvasHost = () => {
    return document.getElementById(CANVAS_HOST_ID) as HTMLDivElement
}

export interface CanvasProps {
    selectedCell: SelectedCell
    selectedCell$: (e: SelectedCell) => void
    activeSheet: number
    activeSheet$: (s: number) => void
}
export const CanvasComponent = (props: CanvasProps) => {
    const DATA_SERVICE = useInjection<DataServiceImpl>(TYPES.Data)
    const store = useRef(new CanvasStore(DATA_SERVICE))
    return (
        <CanvasStoreContext.Provider value={store.current}>
            <Internal {...props} />
        </CanvasStoreContext.Provider>
    )
}

const Internal: FC<CanvasProps> = observer((props: CanvasProps) => {
    const {selectedCell, selectedCell$, activeSheet, activeSheet$} = props
    const store = useContext(CanvasStoreContext)
    const [contextmenuOpen, setContextMenuOpen] = useState(false)
    const [invalidFormulaWarning, setInvalidFormulaWarning] = useState(false)
    const [contextMenuEl, setContextMenu] = useState<ReactElement>()
    const textEl = useRef<ITextareaInstance>(null)

    const setCanvasSize = () => {
        store.render.canvas.width = canvasHost().getBoundingClientRect().width
        store.render.canvas.height = canvasHost().getBoundingClientRect().height
    }

    useEffect(() => {
        setCanvasSize()
        store.render.render()
        store.scrollbar.init()
        store.dataSvc.registryCellUpdatedCallback(() => {
            store.render.render()
        })
    }, [])

    useEffect(() => {
        if (selectedCell.source != 'editbar') return

        store.render.canvas.focus()
        store.render.jumpTo(selectedCell.row, selectedCell.col)
        // store.selector.reset()
        store.textarea.reset()
    }, [selectedCell])

    useEffect(() => {
        store.render.canvas.focus()
        store.dataSvc.setCurrentSheetIdx(activeSheet)
        store.render.render()
    }, [activeSheet])

    useEffect(() => {
        const resizeSub = on(window, EventType.RESIZE)
            .pipe(debounceTime(100))
            .subscribe(() => {
                store.reset()
                setCanvasSize()
                store.render.render()
                store.scrollbar.onResize()
            })
        return () => {
            resizeSub.unsubscribe()
        }
    }, [])

    const setScrollTop = (scrollTop: number, type: 'x' | 'y') => {
        store.scrollbar.setScrollTop(scrollTop, type)
        store.scroll()
    }

    let lastScrollTime = 0
    const onMouseWheel = (e: WheelEvent) => {
        // only support y scrollbar currently
        let delta = e.deltaY
        if (store.anchorY + delta < 0) {
            delta = -store.anchorY
        }

        const now = Date.now()
        if (now - lastScrollTime < 150) return

        lastScrollTime = now
        store.setAnchor(store.anchorX, store.anchorY + delta)
        store.render.render()
        store.scrollbar.update('y')
        store.scroll()
    }

    const onMouseDown = async (e: MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        const isBlur = await onBlur()
        if (!isBlur) {
            textEl.current?.focus()
            return
        }
        store.render.canvas.focus()
        if (e.buttons !== Buttons.LEFT) return

        const mouseMove$ = on(window, EventType.MOUSE_MOVE)
        const mouseUp$ = on(window, EventType.MOUSE_UP)

        const sub = mouseMove$.pipe(takeUntil(mouseUp$)).subscribe((mme) => {
            mme.preventDefault()
            const isResize = store.resizer.mousemove(mme)
            if (isResize) return
            const startCell = store.match(mme.clientX, mme.clientY)
            if (!startCell) return
            if (store.startCell?.equals(startCell) === false) {
                const isDnd = store.dnd.onMouseMove(
                    mme,
                    startCell,
                    store.selector.endCell ?? startCell
                )
                if (isDnd) return
            }
            store.selector.onMouseMove(startCell)
        })
        mouseUp$.pipe(take(1)).subscribe(() => {
            store.type = undefined
            store.dnd.onMouseUp()
            store.resizer.mouseup()
            sub.unsubscribe()
        })

        const isResize = store.resizer.mousedown(e.nativeEvent)
        if (isResize) return

        const isDnd = store.dnd.onMouseDown(e.nativeEvent)
        if (isDnd) return

        const matchCell = store.match(e.clientX, e.clientY)
        if (!matchCell) return
        store.mousedown(e, matchCell)
        if (matchCell?.type !== 'Cell') return
        const {startRow: row, startCol: col} = matchCell.coordinate
        selectedCell$({row, col, source: 'none'})
    }

    const onKeyDown = async (e: KeyboardEvent) => {
        e.stopPropagation()
        e.preventDefault()

        if (e.metaKey || e.altKey || e.shiftKey || e.ctrlKey) return

        const currSelected = store.selector.startCell

        if (!currSelected || currSelected.type != 'Cell') return

        const startRow = currSelected.coordinate.startRow
        const startCol = currSelected.coordinate.startCol
        const endRow = currSelected.coordinate.endRow
        const endCol = currSelected.coordinate.endCol

        switch (e.key) {
            case KeyboardEventCode.ARROW_UP: {
                const newStartRow = Math.max(startRow - 1, 0)
                store.render.jumpTo(newStartRow, startCol)
                break
            }
            case KeyboardEventCode.ARROW_DOWN: {
                const newRow = Math.min(endRow + 1, MAX_COUNT)
                store.render.jumpTo(newRow, endCol)
                break
            }
            case KeyboardEventCode.ARROW_LEFT: {
                const newCol = Math.max(startCol - 1, 0)
                store.render.jumpTo(startRow, newCol)
                break
            }
            case KeyboardEventCode.ARROW_RIGHT: {
                const newCol = Math.min(endCol + 1, MAX_COUNT)
                store.render.jumpTo(startRow, newCol)
                break
            }
            default:
                return
        }
    }

    const onBlur = async () => {
        const isBlur = await store.textarea.blur()
        if (!isBlur) {
            setInvalidFormulaWarning(true)
            return false
        }
        store.highlights.reset()
        return true
    }
    const onCloseInvalidFormulaWarning = () => {
        setInvalidFormulaWarning(false)
        textEl.current?.focus()
    }

    const onContextMenu = (e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const matchCell = store.match(e.clientX, e.clientY)
        if (!matchCell) return
        store.contextmenu(e, matchCell)
        if (!store.selector.startCell) return
        setContextMenu(
            <ContextmenuComponent
                isOpen={true}
                mouseevent={e}
                setIsOpen={setContextMenuOpen}
                startCell={store.selector.startCell}
                endCell={store.selector.endCell}
            />
        )
        setContextMenuOpen(true)
    }
    const type = (text: string) => {
        store.textarea.currText = text
        store.highlights.update(text)
    }

    return (
        <div
            onContextMenu={(e) => onContextMenu(e)}
            onMouseDown={onMouseDown}
            className={styles.host}
        >
            <div id={CANVAS_HOST_ID} style={{width: '100%', height: '100%'}}>
                <canvas
                    tabIndex={0}
                    className={styles.canvas}
                    id={CANVAS_ID}
                    onWheel={onMouseWheel}
                    onKeyDown={onKeyDown}
                >
                    你的浏览器不支持canvas，请升级浏览器
                </canvas>
            </div>
            {contextmenuOpen && contextMenuEl ? contextMenuEl : null}
            {store.selector.selector && (
                <SelectorComponent selector={store.selector.selector} />
            )}
            <ScrollbarComponent
                {...store.scrollbar.xScrollbar}
                setScrollTop={(e) => setScrollTop(e, 'x')}
            />
            <ScrollbarComponent
                {...store.scrollbar.yScrollbar}
                setScrollTop={(e) => setScrollTop(e, 'y')}
            />
            {store.textarea.context && store.textarea.editing && (
                <TextContainerComponent
                    ref={textEl}
                    context={store.textarea.context}
                    blur={onBlur}
                    type={type}
                />
            )}
            {store.dnd.range && (
                <DndComponent
                    dragging={store.dnd.dragging !== undefined}
                    x={store.dnd.range.startCol}
                    y={store.dnd.range.startRow}
                    width={store.dnd.range.width}
                    height={store.dnd.range.height}
                    draggingX={store.dnd.dragging?.startCol}
                    draggingY={store.dnd.dragging?.startRow}
                />
            )}
            <DialogComponent isOpen={invalidFormulaWarning}>
                <InvalidFormulaComponent
                    close$={onCloseInvalidFormulaWarning}
                />
            </DialogComponent>
            {store.highlights.highlightCells.map((cell, i) => {
                const cellStyle = cell.style
                return (
                    <div
                        className={styles['highlight-cell']}
                        style={{
                            left: cellStyle.x,
                            top: cellStyle.y,
                            width: `${cellStyle.width}px`,
                            height: `${cellStyle.height}px`,
                            backgroundColor: cellStyle.bgColor.css(),
                        }}
                        key={i}
                    />
                )
            })}
            {store.resizer.resizers.map((resizer, i) => {
                const {startCol: x, startRow: y, width, height} = resizer.range
                const {isRow} = resizer
                const rect = store.render.canvas.getBoundingClientRect()
                return (
                    <ResizerComponent
                        hoverText={store.resizer.hoverText}
                        x={!isRow ? x + width / 2 : 0}
                        y={!isRow ? 0 : y + height / 2}
                        width={width}
                        height={height}
                        key={i}
                        movingX={!isRow ? store.resizer.moving.x : 0}
                        movingY={isRow ? store.resizer.moving.y : 0}
                        movingHeight={!isRow ? rect.height : 0}
                        movingWidth={!isRow ? 0 : rect.width}
                        active={store.resizer.active === resizer}
                        type={isRow ? 'row' : 'col'}
                    />
                )
            })}
        </div>
    )
})
