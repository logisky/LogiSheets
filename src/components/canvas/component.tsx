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
import {debounceTime} from 'rxjs/operators'
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
import {CellInputBuilder} from '@logisheets_bg'
import {DialogComponent} from '@/ui/dialog'
import {useInjection} from '@/core/ioc/provider'
import {
    Backend,
    DataService,
    MAX_COUNT,
    RenderCell,
    SheetService,
} from '@/core/data'
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
}
export const CanvasComponent = (props: CanvasProps) => {
    const SHEET_SERVICE = useInjection<SheetService>(TYPES.Sheet)
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)
    const BACKEND_SERVICE = useInjection<Backend>(TYPES.Backend)
    const store = useRef(
        new CanvasStore(SHEET_SERVICE, DATA_SERVICE, BACKEND_SERVICE)
    )
    return (
        <CanvasStoreContext.Provider value={store.current}>
            <Internal {...props} />
        </CanvasStoreContext.Provider>
    )
}

const Internal: FC<CanvasProps> = observer(({selectedCell, selectedCell$}) => {
    const store = useContext(CanvasStoreContext)
    const [contextmenuOpen, setContextMenuOpen] = useState(false)
    const [invalidFormulaWarning, setInvalidFormulaWarning] = useState(false)
    const [contextMenuEl, setContextMenu] = useState<ReactElement>()
    const textEl = useRef<ITextareaInstance>()

    const setCanvasSize = () => {
        store.render.canvas.width = canvasHost().getBoundingClientRect().width
        store.render.canvas.height = canvasHost().getBoundingClientRect().height
    }

    useEffect(() => {
        setCanvasSize()
        store.render.render()
        store.scrollbar.init()
        const sub = store.backendSvc.render$.subscribe(() => {
            store.render.render()
        })
        return () => {
            sub.unsubscribe()
        }
    }, [])

    // Return the render cell
    // 0: keep horizontal scroll value unchanged
    // 1: keep veritical scroll value unchanged
    // 2: don't keep any of them
    const jumpTo = (row: number, col: number, keep: 0 | 1 | 2) => {
        const result = store.dataSvc.tryJumpTo(row, col)

        if (result instanceof RenderCell) return result

        const scrollX = result[0]
        const scrollY = result[1]

        const scroll = store.sheetSvc.getSheet()?.scroll
        if (!scroll) throw Error('No active sheet')

        if (keep == 0) {
            scroll.update('y', scrollY)
        } else if (keep == 1) {
            scroll.update('x', scrollX)
        } else {
            scroll.update('x', scrollX)
            scroll.update('y', scrollY)
        }

        store.render.render()
        const newResult = store.dataSvc.jumpTo(row, col)
        if (!newResult) throw Error('jump to function error')

        return newResult
    }

    useEffect(() => {
        if (selectedCell.source != 'editbar') return

        store.render.canvas.focus()
        jumpTo(selectedCell.row, selectedCell.col, 2)
        store.selector.reset()
        store.textarea.reset()
    }, [selectedCell])

    useEffect(() => {
        const sub = on(window, EventType.MOUSE_MOVE).subscribe((mme) => {
            mme.preventDefault()
            if (store.type !== 'mousedown') return
            const startCell = store.match(mme.clientX, mme.clientY)
            if (!startCell) return
            const isResize = store.resizer.mousemove(mme)
            if (isResize) return
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
        return () => {
            sub.unsubscribe()
        }
    }, [])

    useEffect(() => {
        const sub = on(window, EventType.MOUSE_UP).subscribe(() => {
            store.type = undefined
            store.dnd.onMouseUp()
            store.resizer.mouseup()
        })
        const resizeSub = on(window, EventType.RESIZE).pipe(debounceTime(100)).subscribe(() => {
            store.reset()
            setCanvasSize()
            store.render.render()
            store.scrollbar.onResize()
        })
        return () => {
            sub.unsubscribe()
            resizeSub.unsubscribe()
        }
    }, [])

    const setScrollTop = (scrollTop: number, type: 'x' | 'y') => {
        store.scrollbar.setScrollTop(scrollTop, type)
        store.scroll()
    }

    const onMouseWheel = (e: WheelEvent) => {
        // only support y scrollbar
        const delta = e.deltaY
        const newScroll = store.scrollbar.mouseWheelScrolling(delta, 'y') ?? 0
        const oldScroll = store.sheetSvc.getSheet()?.scroll.y
        if (oldScroll === newScroll) return
        store.sheetSvc.getSheet()?.scroll?.update('y', newScroll)
        store.render.render()
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
        const matchCell = store.match(e.clientX, e.clientY)
        if (!matchCell) return
        const isResize = store.resizer.mousedown(e.nativeEvent)
        if (isResize) return
        const isDnd = store.dnd.onMouseDown(e.nativeEvent)
        if (isDnd) return
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

        let renderCell: RenderCell | null = null
        switch (e.key) {
            case KeyboardEventCode.ARROW_UP: {
                const newStartRow = Math.max(startRow - 1, 0)
                renderCell = jumpTo(newStartRow, startCol, 0)
                break
            }
            case KeyboardEventCode.ARROW_DOWN: {
                const newRow = Math.min(endRow + 1, MAX_COUNT)
                renderCell = jumpTo(newRow, endCol, 0)
                break
            }
            case KeyboardEventCode.ARROW_LEFT: {
                const newCol = Math.max(startCol - 1, 0)
                renderCell = jumpTo(startRow, newCol, 1)
                break
            }
            case KeyboardEventCode.ARROW_RIGHT: {
                const newCol = Math.min(endCol + 1, MAX_COUNT)
                renderCell = jumpTo(startRow, newCol, 1)
                break
            }
            default:
                return
        }
        if (renderCell) {
            const c = new Cell('Cell').copyByRenderCell(renderCell)
            store.keydown(e.nativeEvent, c)
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
                        x={!isRow ? x : 0}
                        y={!isRow ? 0 : y}
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
