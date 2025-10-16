import {
    buildSelectedDataFromCell,
    buildSelectedDataFromCellRange,
    getSelectedCellRange,
    SelectedData,
} from './events'
import styles from './canvas.module.scss'
import {
    findVisibleRowIdxRange,
    findVisibleColIdxRange,
    xForColEnd,
    xForColStart,
    yForRowEnd,
    yForRowStart,
} from './grid_helper'
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
import {take, takeUntil} from 'rxjs/operators'
import {EventType, KeyboardEventCode, on} from '@/core/events'
import {SelectorComponent, SelectorProps} from '@/components/selector'
import {ITextareaInstance, TextContainerComponent} from '@/components/textarea'
import {DndComponent} from '@/components/dnd'
import {
    BlockOutlinerComponent,
    BlockOutlinerProps,
} from '@/components/block-outliner'
import {InvalidFormulaComponent} from './invalid-formula'
import {Buttons, simpleUuid} from '@/core'
import {DialogComponent} from '@/ui/dialog'
import {useInjection} from '@/core/ioc/provider'
import {CraftManager, DataServiceImpl, MAX_COUNT} from '@/core/data'
import {TYPES} from '@/core/ioc/types'
import {CANVAS_ID, CanvasStore, CanvasStoreContext} from './store'
import {observer} from 'mobx-react'
import {DiyButtonComponent} from '../diy-button'
import {ShadowCellComponent} from '../shadow-cell'
import {
    FormulaDisplayInfo,
    Transaction,
    SetColWidthBuilder,
    SetRowHeightBuilder,
    CellRef,
    isErrorMessage,
} from 'logisheets-web'
import {getHighlightColor} from '@/components/const'
import {Range, StandardColor} from '@/core/standable'
import {pxToPt, pxToWidth, ptToPx, widthToPx} from '@/core'
import type {Grid} from '@/core/worker/types'
import {LeftTop} from '@/core/settings'
import {match} from './defs'
import ColumnHeaders from './headers/column'
import RowHeaders from './headers/row'
import {Scrollbar} from '../scrollbar'
import {ContextmenuComponent} from './contextmenu'

const CANVAS_HOST_ID = simpleUuid()
const canvas = (): HTMLCanvasElement => {
    return document.getElementById(CANVAS_ID) as HTMLCanvasElement
}

export interface CanvasProps {
    selectedData: SelectedData
    selectedData$: (e: SelectedData) => void
    activeSheet: number
    activeSheet$: (s: number) => void
}
export const CanvasComponent = (props: CanvasProps) => {
    const DATA_SERVICE = useInjection<DataServiceImpl>(TYPES.Data)
    const craftManager = useInjection<CraftManager>(TYPES.CraftManager)
    const store = useRef(new CanvasStore(DATA_SERVICE, craftManager))
    return (
        <CanvasStoreContext.Provider value={store.current}>
            <Internal {...props} />
        </CanvasStoreContext.Provider>
    )
}

const Internal: FC<CanvasProps> = observer((props: CanvasProps) => {
    const {selectedData, selectedData$, activeSheet} = props
    const store = useContext(CanvasStoreContext)
    const [contextmenuOpen, setContextMenuOpen] = useState(false)
    const [invalidFormulaWarning, setInvalidFormulaWarning] = useState(false)
    const [contextMenuLeft, setContextMenuLeft] = useState(0)
    const [contextMenuTop, setContextMenuTop] = useState(0)
    const [selector, setSelector] = useState<SelectorProps | undefined>(
        undefined
    )
    const [cellRefs, setCellRefs] = useState<readonly CellRef[]>([])
    const [highlightCells, setHighlightCells] = useState(
        [] as {
            style: {
                bgColor: StandardColor
                x: number
                y: number
                width: number
                height: number
            }
        }[]
    )

    const render = () => {
        return store.render().then((g) => {
            if (isErrorMessage(g)) return
            setGrid(g)
        })
    }

    const renderWithAnchor = (anchorX: number, anchorY: number) => {
        return store.renderWithAnchor(anchorX, anchorY).then((g) => {
            if (isErrorMessage(g)) return
            setGrid(g)
        })
    }
    const textEl = useRef<ITextareaInstance>(null)
    const [grid, setGrid] = useState<Grid | undefined>(undefined)
    // Accumulate wheel deltas and apply once per animation frame to avoid jitter
    const wheelAccumRef = useRef(0)
    const wheelRafIdRef = useRef<number | null>(null)
    // Coalesce renders: allow at most one in-flight render and queue at most one follow-up
    const renderInFlightRef = useRef(false)
    const rerenderScheduledRef = useRef(false)
    // OffscreenCanvas can only be transferred once per HTMLCanvasElement.
    // Cache the transferred OffscreenCanvas to avoid InvalidStateError in StrictMode/dev.
    const offscreenCanvasRef = useRef<OffscreenCanvas | null>(null)

    // Scrollbar states
    const [docPositionX, setDocPositionX] = useState(0)
    const [docPositionY, setDocPositionY] = useState(0)
    const [documentHeight, setDocumentHeight] = useState(0)
    const [documentWidth, setDocumentWidth] = useState(0)
    const [visibleHeight, setVisibleHeight] = useState(0)
    const [visibleWidth, setVisibleWidth] = useState(0)
    const [scrollbarRendering, setScrollbarRendering] = useState(false)

    const [invalidCells, setInvalidCells] = useState<
        {x: number; y: number; width: number; height: number}[]
    >([])

    const setCanvasSize = () => {
        const c = canvas()
        const size = c.getBoundingClientRect()
        c.width = size.width * window.devicePixelRatio || 1
        c.height = size.height * window.devicePixelRatio || 1
        setVisibleHeight(size.height)
        setVisibleWidth(size.width)
    }

    useEffect(() => {
        const el = canvas()
        if (!el) return
        // Only transfer control once. In React 18 StrictMode, effects run twice in dev.
        if (!offscreenCanvasRef.current && !el.dataset?.offscreenInitialized) {
            // Guard older browsers by narrowing the API shape without using `any`
            type OffscreenCapable = HTMLCanvasElement & {
                transferControlToOffscreen?: () => OffscreenCanvas
            }
            const oc = el as OffscreenCapable
            const canTransfer =
                typeof oc.transferControlToOffscreen === 'function'
            if (canTransfer && oc.transferControlToOffscreen) {
                setCanvasSize()
                offscreenCanvasRef.current = oc.transferControlToOffscreen()
                // mark the DOM node so future mounts won't try to transfer again
                el.dataset.offscreenInitialized = '1'
                store.getCanvasSize = () => {
                    return canvas().getBoundingClientRect()
                }
                store.dataSvc
                    .initOffscreen(offscreenCanvasRef.current)
                    .then(() => {
                        render()
                    })
            }
        }
        store.dataSvc.setCurrentSheetIdx(activeSheet)
    }, [])

    // Subscribe to offscreen render results so we can draw HTML headers using Grid metadata
    useEffect(() => {
        store.dataSvc.registerCellUpdatedCallback(() => {
            render().then(() => {
                const currentIdx = store.currSheetIdx
                store.dataSvc.getSheetDimension(currentIdx).then((v) => {
                    if (!isErrorMessage(v)) {
                        setDocumentHeight(v.height)
                        setDocumentWidth(v.width)
                    }
                    const size = canvas().getBoundingClientRect()
                    setVisibleHeight(size.height * window.devicePixelRatio)
                    setVisibleWidth(size.width * window.devicePixelRatio)
                })
            })
        })
    }, [store])

    useEffect(() => {
        if (!grid) return
        store.blockOutliner.updateBlockInfos(grid)
        if (!scrollbarRendering) {
            setDocPositionX(grid.anchorX)
            setDocPositionY(grid.anchorY)
        }
        const result = store.dataSvc.getInvalidCells().map((v) => {
            return {
                x: widthToPx(v[0].x - grid.anchorX) + LeftTop.width,
                y: ptToPx(v[0].y - grid.anchorY) + LeftTop.height,
                width: widthToPx(v[1].x - v[0].x),
                height: ptToPx(v[1].y - v[0].y),
            }
        })
        setInvalidCells(result)
        store.textarea.updateGrid(grid)
    }, [grid])

    useEffect(() => {
        if (!scrollbarRendering) return
        renderWithAnchor(docPositionX, docPositionY)
    }, [docPositionX, docPositionY, scrollbarRendering])

    // Watch DPR and canvas size changes; call provided handler with latest values
    useEffect(() => {
        const el = canvas()
        if (!el) return

        const onCanvasEnvChange = ({
            dpr,
            width,
            height,
        }: {
            dpr: number
            width: number
            height: number
        }) => {
            store.dataSvc.resize(width, height, dpr)
            setVisibleHeight(height)
            setVisibleWidth(width)
        }
        let prevDpr = window.devicePixelRatio || 1

        const emit = () => {
            const rect = el.getBoundingClientRect()
            const dpr = window.devicePixelRatio || 1
            onCanvasEnvChange({
                dpr,
                width: rect.width,
                height: rect.height,
            })
        }

        const onWindowResize = () => {
            const curr = window.devicePixelRatio || 1
            if (Math.abs(curr - prevDpr) > 1e-6) {
                prevDpr = curr
                emit()
            }
        }

        const ro = new ResizeObserver(() => emit())
        ro.observe(el)
        window.addEventListener('resize', onWindowResize)

        // initial fire once so consumer has values immediately
        emit()

        return () => {
            ro.disconnect()
            window.removeEventListener('resize', onWindowResize)
        }
    }, [])

    useEffect(() => {
        if (selectedData.source != 'editbar') return
        const selectedCell = getSelectedCellRange(selectedData)
        if (!selectedCell) return

        store.dataSvc
            .getWorkbook()
            .getCellPosition({
                sheetIdx: store.currSheetIdx,
                row: selectedCell.startRow,
                col: selectedCell.startCol,
            })
            .then((pos) => {
                if (!pos || isErrorMessage(pos)) return

                const size = canvas().getBoundingClientRect()
                const anchorX = Math.max(0, pos.x - size.width / 2)
                const anchorY = Math.max(0, pos.y - size.height / 2)
                renderWithAnchor(anchorX, anchorY).then(() => {
                    canvas().focus({preventScroll: true})
                    store.textarea.reset()
                })
            })
    }, [selectedData])

    useEffect(() => {
        if (!grid) {
            setSelector(undefined)
            return
        }
        const sel = selectedData.data
        if (!sel) {
            setSelector(undefined)
            return
        }

        if (selectedData.source === 'editbar') return

        const firstCol = grid.columns[0]?.idx ?? 0
        const lastCol = grid.columns[grid.columns.length - 1]?.idx ?? firstCol
        const firstRow = grid.rows[0]?.idx ?? 0
        const lastRow = grid.rows[grid.rows.length - 1]?.idx ?? firstRow

        const s = new SelectorProps()

        if (sel.ty === 'cellRange') {
            const {
                startRow: row1,
                endRow: row2,
                startCol: col1,
                endCol: col2,
            } = sel.d
            const startCol = Math.min(col1, col2)
            const endCol = Math.max(col1, col2)
            const startRow = Math.min(row1, row2)
            const endRow = Math.max(row1, row2)
            const visStartCol = Math.max(startCol, firstCol)
            const visEndCol = Math.min(endCol, lastCol)
            const visStartRow = Math.max(startRow, firstRow)
            const visEndRow = Math.min(endRow, lastRow)
            if (visStartCol > visEndCol || visStartRow > visEndRow) {
                setSelector(undefined)
                return
            }
            const startX = xForColStart(visStartCol, grid)
            const endX = xForColEnd(visEndCol, grid)
            const startY = yForRowStart(visStartRow, grid)
            const endY = yForRowEnd(visEndRow, grid)

            s.x = LeftTop.width + startX - 1
            s.y = LeftTop.height + startY - 1
            s.width = Math.max(0, endX - startX)
            s.height = Math.max(0, endY - startY)
            s.borderTopWidth = 2
            s.borderBottomWidth = 2
            s.borderLeftWidth = 2
            s.borderRightWidth = 2
            setSelector(s)
            return
        }

        if (sel.ty === 'line') {
            if (sel.d.type === 'col') {
                const visStartCol = Math.max(sel.d.start, firstCol)
                const visEndCol = Math.min(sel.d.end, lastCol)
                if (visStartCol > visEndCol) {
                    setSelector(undefined)
                    return
                }
                const startX = xForColStart(visStartCol, grid)
                const endX = xForColEnd(visEndCol, grid)
                const totalH = grid.rows.reduce((sum, r) => sum + r.height, 0)

                s.x = LeftTop.width + startX - 1
                s.y = 0
                s.width = Math.max(0, endX - startX)
                s.height = totalH
                s.borderTopWidth = 2
                s.borderBottomWidth = 2
                s.borderLeftWidth = 2
                s.borderRightWidth = 2
                setSelector(s)
                return
            }
            if (sel.d.type === 'row') {
                const visStartRow = Math.max(sel.d.start, firstRow)
                const visEndRow = Math.min(sel.d.end, lastRow)
                if (visStartRow > visEndRow) {
                    setSelector(undefined)
                    return
                }
                const startY = yForRowStart(visStartRow, grid)
                const endY = yForRowEnd(visEndRow, grid)
                const totalW = grid.columns.reduce((sum, c) => sum + c.width, 0)

                s.x = 0
                s.y = LeftTop.height + startY - 1
                s.width = totalW
                s.height = Math.max(0, endY - startY)
                s.borderTopWidth = 2
                s.borderBottomWidth = 2
                s.borderLeftWidth = 2
                s.borderRightWidth = 2
                setSelector(s)
                return
            }
        }

        setSelector(undefined)
    }, [selectedData, grid])

    useEffect(() => {
        if (!grid) {
            setHighlightCells([])
            return
        }
        let i = 0
        const totalW = grid.columns.reduce((sum, c) => sum + c.width, 0)
        const totalH = grid.rows.reduce((sum, r) => sum + r.height, 0)
        const newCells: {
            style: {
                bgColor: StandardColor
                x: number
                y: number
                width: number
                height: number
            }
        }[] = []

        const firstCol = grid.columns[0]?.idx ?? 0
        const lastCol = grid.columns[grid.columns.length - 1]?.idx ?? firstCol
        const firstRow = grid.rows[0]?.idx ?? 0
        const lastRow = grid.rows[grid.rows.length - 1]?.idx ?? firstRow

        for (const cellRef of cellRefs) {
            // Skip unsupported workbook-level refs and cross-sheet ranges
            if (cellRef.workbook) continue
            if (
                cellRef.sheet1 !== undefined &&
                cellRef.sheet2 !== undefined &&
                cellRef.sheet1 !== cellRef.sheet2
            )
                continue
            // If a sheet is specified and it's not current, skip
            const currSheetName = store.dataSvc.getCurrentSheetName()
            if (cellRef.sheet1 && cellRef.sheet1 !== currSheetName) continue

            const color = getHighlightColor(i++)

            const clampCol = (c: number) =>
                Math.min(Math.max(c, firstCol), lastCol)
            const clampRow = (r: number) =>
                Math.min(Math.max(r, firstRow), lastRow)

            const makeCell = (x: number, y: number, w: number, h: number) => ({
                style: {
                    bgColor: color,
                    x,
                    y,
                    width: w,
                    height: h,
                },
            })

            // Cell ranges
            if (cellRef.row1 !== undefined && cellRef.col1 !== undefined) {
                const r1 = clampRow(cellRef.row1)
                const c1 = clampCol(cellRef.col1)
                if (cellRef.row2 !== undefined && cellRef.col2 !== undefined) {
                    const r2 = clampRow(cellRef.row2)
                    const c2 = clampCol(cellRef.col2)
                    const startRow = Math.min(r1, r2)
                    const endRow = Math.max(r1, r2)
                    const startCol = Math.min(c1, c2)
                    const endCol = Math.max(c1, c2)
                    const sx = LeftTop.width + xForColStart(startCol, grid)
                    const ex = LeftTop.width + xForColEnd(endCol, grid)
                    const sy = LeftTop.height + yForRowStart(startRow, grid)
                    const ey = LeftTop.height + yForRowEnd(endRow, grid)
                    newCells.push(
                        makeCell(
                            sx,
                            sy,
                            Math.max(0, ex - sx),
                            Math.max(0, ey - sy)
                        )
                    )
                } else {
                    const sx = LeftTop.width + xForColStart(c1, grid)
                    const ex = LeftTop.width + xForColEnd(c1, grid)
                    const sy = LeftTop.height + yForRowStart(r1, grid)
                    const ey = LeftTop.height + yForRowEnd(r1, grid)
                    newCells.push(
                        makeCell(
                            sx,
                            sy,
                            Math.max(0, ex - sx),
                            Math.max(0, ey - sy)
                        )
                    )
                }
                continue
            }

            // Full rows
            if (cellRef.row1 !== undefined) {
                const r1 = clampRow(cellRef.row1)
                if (cellRef.row2 !== undefined) {
                    const r2 = clampRow(cellRef.row2)
                    const startRow = Math.min(r1, r2)
                    const endRow = Math.max(r1, r2)
                    const sy = LeftTop.height + yForRowStart(startRow, grid)
                    const ey = LeftTop.height + yForRowEnd(endRow, grid)
                    newCells.push(
                        makeCell(
                            LeftTop.width,
                            sy,
                            totalW,
                            Math.max(0, ey - sy)
                        )
                    )
                } else {
                    const sy = LeftTop.height + yForRowStart(r1, grid)
                    const ey = LeftTop.height + yForRowEnd(r1, grid)
                    newCells.push(
                        makeCell(
                            LeftTop.width,
                            sy,
                            totalW,
                            Math.max(0, ey - sy)
                        )
                    )
                }
                continue
            }

            // Full columns
            if (cellRef.col1 !== undefined) {
                const c1 = clampCol(cellRef.col1)
                if (cellRef.col2 !== undefined) {
                    const c2 = clampCol(cellRef.col2)
                    const startCol = Math.min(c1, c2)
                    const endCol = Math.max(c1, c2)
                    const sx = LeftTop.width + xForColStart(startCol, grid)
                    const ex = LeftTop.width + xForColEnd(endCol, grid)
                    newCells.push(
                        makeCell(
                            sx,
                            LeftTop.height,
                            Math.max(0, ex - sx),
                            totalH
                        )
                    )
                } else {
                    const sx = LeftTop.width + xForColStart(c1, grid)
                    const ex = LeftTop.width + xForColEnd(c1, grid)
                    newCells.push(
                        makeCell(
                            sx,
                            LeftTop.height,
                            Math.max(0, ex - sx),
                            totalH
                        )
                    )
                }
                continue
            }
        }
        setHighlightCells(newCells)
    }, [cellRefs, grid])

    useEffect(() => {
        // store.renderer.canvas.focus()
        store.dataSvc.setCurrentSheetIdx(activeSheet)
        render()
    }, [activeSheet])

    const onMouseWheel = (e: WheelEvent) => {
        // Accumulate deltas and process at most once per animation frame
        wheelAccumRef.current += e.deltaY
        if (wheelRafIdRef.current !== null) return

        const processFrame = () => {
            const MIN_SCROLL_PIXELS = 24 // dead-zone to avoid tiny scrolls causing renders
            const applyDelta = wheelAccumRef.current
            wheelAccumRef.current = 0
            wheelRafIdRef.current = null

            if (Math.abs(applyDelta) < MIN_SCROLL_PIXELS) {
                // If we still have a queued RAF later and more deltas arrive, they'll be processed
                return
            }

            const newY = Math.max(0, store.anchorY + pxToPt(applyDelta))
            if (newY === store.anchorY) return

            // Coalesce renders: if one is in flight, just mark for another frame
            if (!renderInFlightRef.current) {
                renderInFlightRef.current = true
                renderWithAnchor(store.anchorX, newY).finally(() => {
                    renderInFlightRef.current = false
                    // After render, use returned anchor to keep headers and cells aligned
                    if (
                        wheelAccumRef.current !== 0 ||
                        rerenderScheduledRef.current
                    ) {
                        rerenderScheduledRef.current = false
                        if (wheelRafIdRef.current === null) {
                            wheelRafIdRef.current =
                                window.requestAnimationFrame(processFrame)
                        }
                    }
                })
            } else {
                rerenderScheduledRef.current = true
            }
        }

        wheelRafIdRef.current = window.requestAnimationFrame(processFrame)
    }

    const onMouseDown = async (e: MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        const isBlur = await onBlur()
        if (!isBlur) {
            textEl.current?.focus()
            return
        }
        if (e.buttons !== Buttons.LEFT) return
        if (!grid) return

        canvas().focus({preventScroll: true})
        const mouseMove$ = on(window, EventType.MOUSE_MOVE)
        const mouseUp$ = on(window, EventType.MOUSE_UP)

        const sub = mouseMove$.pipe(takeUntil(mouseUp$)).subscribe((mme) => {
            mme.preventDefault()
            if (!grid) return
            const canvasSize = canvas().getBoundingClientRect()
            const cell = match(
                mme.clientX - canvasSize.left,
                mme.clientY - canvasSize.top,
                store.anchorX,
                store.anchorY,
                grid
            )
            if (!cell) return
            if (!store.startCell) return
            store.endCell = cell
            const {startRow, startCol} = store.startCell.coordinate
            const {endRow, endCol} =
                store.endCell?.coordinate ?? store.startCell.coordinate
            if (startRow === endRow && startCol === endCol) return
            const data = buildSelectedDataFromCellRange(
                startRow,
                startCol,
                endRow,
                endCol,
                'none'
            )
            selectedData$(data)
        })
        mouseUp$.pipe(take(1)).subscribe(() => {
            store.type = undefined
            sub.unsubscribe()
            if (!store.startCell) return
            if (store.startCell?.type !== store.endCell?.type && store.endCell)
                return

            const {startRow, startCol} = store.startCell.coordinate
            const {endRow, endCol} =
                store.endCell?.coordinate ?? store.startCell.coordinate
            const data = buildSelectedDataFromCellRange(
                startRow,
                startCol,
                endRow,
                endCol,
                'none'
            )
            selectedData$(data)
        })

        const canvasSize = canvas().getBoundingClientRect()

        const matchCell = match(
            e.clientX - canvasSize.left,
            e.clientY - canvasSize.top,
            store.anchorX,
            store.anchorY,
            grid
        )
        if (!matchCell) return
        store.mousedown(e, matchCell)
        const {startRow: row, startCol: col} = matchCell.coordinate
        const data = buildSelectedDataFromCell(row, col, 'none')
        selectedData$(data)
    }

    const onKeyDown = async (e: KeyboardEvent) => {
        e.stopPropagation()
        e.preventDefault()

        if (e.metaKey || e.altKey || e.shiftKey || e.ctrlKey) return
        if (!grid) return

        const selectedCells = getSelectedCellRange(selectedData)
        if (!selectedCells) return
        if (selectedCells.startCol !== selectedCells.endCol) return
        if (selectedCells.startRow !== selectedCells.endRow) return

        const row = selectedCells.startRow
        const col = selectedCells.startCol
        const size = canvas().getBoundingClientRect()

        switch (e.key) {
            case KeyboardEventCode.ARROW_UP: {
                if (row === 0) return
                const [startIdx, _endIdx] = findVisibleRowIdxRange(
                    store.anchorY,
                    size.height - 50,
                    grid
                )
                const idx = grid.rows.findIndex((v) => v.idx === row)
                if (idx >= 0 && idx - 1 >= startIdx) {
                    const newData = buildSelectedDataFromCellRange(
                        grid.rows[idx - 1].idx,
                        col,
                        grid.rows[idx - 1].idx,
                        col,
                        'none'
                    )
                    selectedData$(newData)
                    return
                }
                const nextVisibleCell = await store.dataSvc
                    .getWorkbook()
                    .getNextVisibleCell({
                        sheetIdx: store.dataSvc.getCurrentSheetIdx(),
                        rowIdx: row,
                        colIdx: col,
                        direction: 'up',
                    })
                if (isErrorMessage(nextVisibleCell)) return
                const cellPosition = await store.dataSvc
                    .getWorkbook()
                    .getCellPosition({
                        sheetIdx: store.dataSvc.getCurrentSheetIdx(),
                        row: nextVisibleCell.y,
                        col: nextVisibleCell.x,
                    })
                if (isErrorMessage(cellPosition)) return
                await renderWithAnchor(store.anchorX, ptToPx(cellPosition.y))
                const newData = buildSelectedDataFromCellRange(
                    nextVisibleCell.y,
                    col,
                    nextVisibleCell.y,
                    col,
                    'none'
                )
                selectedData$(newData)
                return
            }
            case KeyboardEventCode.ARROW_DOWN: {
                const [_startIdx, endIdx] = findVisibleRowIdxRange(
                    store.anchorY,
                    size.height - 50,
                    grid
                )
                const idx = grid.rows.findIndex((v) => v.idx === row)
                if (idx >= 0 && idx + 1 <= endIdx) {
                    const newData = buildSelectedDataFromCellRange(
                        grid.rows[idx + 1].idx,
                        col,
                        grid.rows[idx + 1].idx,
                        col,
                        'none'
                    )
                    selectedData$(newData)
                    return
                }
                const nextVisibleCell = await store.dataSvc
                    .getWorkbook()
                    .getNextVisibleCell({
                        sheetIdx: store.dataSvc.getCurrentSheetIdx(),
                        rowIdx: row,
                        colIdx: col,
                        direction: 'down',
                    })
                if (isErrorMessage(nextVisibleCell)) return
                const cellPosition = await store.dataSvc
                    .getWorkbook()
                    .getCellPosition({
                        sheetIdx: store.dataSvc.getCurrentSheetIdx(),
                        row: nextVisibleCell.y,
                        col: nextVisibleCell.x,
                    })
                if (isErrorMessage(cellPosition)) return
                await renderWithAnchor(
                    store.anchorX,
                    ptToPx(cellPosition.y) - size.height
                )
                const newData = buildSelectedDataFromCellRange(
                    nextVisibleCell.y,
                    col,
                    nextVisibleCell.y,
                    col,
                    'none'
                )
                selectedData$(newData)
                return
            }
            case KeyboardEventCode.ARROW_LEFT: {
                if (col === 0) return
                const [startIdx, endIdx] = findVisibleColIdxRange(
                    store.anchorX,
                    size.width,
                    grid
                )
                const idx = grid.columns.findIndex((v) => v.idx === col)
                if (idx > 0 && idx - 1 >= startIdx) {
                    const newData = buildSelectedDataFromCellRange(
                        row,
                        grid.columns[idx - 1].idx,
                        row,
                        grid.columns[idx - 1].idx,
                        'none'
                    )
                    selectedData$(newData)
                    return
                }
                const nextVisibleCell = await store.dataSvc
                    .getWorkbook()
                    .getNextVisibleCell({
                        sheetIdx: store.dataSvc.getCurrentSheetIdx(),
                        rowIdx: row,
                        colIdx: col,
                        direction: 'left',
                    })
                if (isErrorMessage(nextVisibleCell)) return
                const cellPosition = await store.dataSvc
                    .getWorkbook()
                    .getCellPosition({
                        sheetIdx: store.dataSvc.getCurrentSheetIdx(),
                        row: nextVisibleCell.y,
                        col: nextVisibleCell.x,
                    })
                if (isErrorMessage(cellPosition)) return
                await renderWithAnchor(widthToPx(cellPosition.x), store.anchorY)
                const newData = buildSelectedDataFromCellRange(
                    row,
                    nextVisibleCell.x,
                    row,
                    nextVisibleCell.x,
                    'none'
                )
                selectedData$(newData)
                return
            }
            case KeyboardEventCode.ARROW_RIGHT: {
                const [startIdx, endIdx] = findVisibleColIdxRange(
                    store.anchorX,
                    size.width,
                    grid
                )
                const idx = grid.columns.findIndex((v) => v.idx === col)
                if (idx >= 0 && idx + 1 <= endIdx) {
                    const newData = buildSelectedDataFromCellRange(
                        row,
                        grid.columns[idx + 1].idx,
                        row,
                        grid.columns[idx + 1].idx,
                        'none'
                    )
                    selectedData$(newData)
                    return
                }
                const nextVisibleCell = await store.dataSvc
                    .getWorkbook()
                    .getNextVisibleCell({
                        sheetIdx: store.dataSvc.getCurrentSheetIdx(),
                        rowIdx: row,
                        colIdx: col,
                        direction: 'right',
                    })
                if (isErrorMessage(nextVisibleCell)) return
                const cellPosition = await store.dataSvc
                    .getWorkbook()
                    .getCellPosition({
                        sheetIdx: store.dataSvc.getCurrentSheetIdx(),
                        row: nextVisibleCell.y,
                        col: nextVisibleCell.x,
                    })
                if (isErrorMessage(cellPosition)) return
                await renderWithAnchor(
                    widthToPx(cellPosition.x) - size.width,
                    store.anchorY
                )
                const newData = buildSelectedDataFromCellRange(
                    row,
                    nextVisibleCell.x,
                    row,
                    nextVisibleCell.x,
                    'none'
                )
                selectedData$(newData)
                return
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
        setCellRefs([])
        return true
    }
    const onCloseInvalidFormulaWarning = () => {
        setInvalidFormulaWarning(false)
        textEl.current?.focus()
    }

    const onContextMenu = (e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        // Prevent aria-hidden focus conflicts by blurring current focus
        const activeEl = document.activeElement as HTMLElement | null
        if (activeEl && typeof activeEl.blur === 'function') activeEl.blur()
        setContextMenuLeft(e.clientX)
        setContextMenuTop(e.clientY)
        setContextMenuOpen(true)
    }
    const type = (text: string): Promise<FormulaDisplayInfo | undefined> => {
        return store.textarea.updateText(text).then((v) => {
            if (v) {
                setCellRefs(v.cellRefs)
            }
            return v
        })
    }

    return (
        <div className={styles.host}>
            <div
                id={CANVAS_HOST_ID}
                style={{
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                }}
            >
                {/* Corner cell */}
                <div
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: LeftTop.width,
                        height: LeftTop.height,
                        background: '#f5f5f5',
                        borderRight: '1px solid #e0e0e0',
                        borderBottom: '1px solid #e0e0e0',
                        pointerEvents: 'none',
                    }}
                />

                <ColumnHeaders
                    grid={grid}
                    setSelectedData={selectedData$}
                    sheetIdx={activeSheet}
                    onResizeCol={(colIdx, dx) => {
                        if (!grid) return
                        const col = grid.columns.find((c) => c.idx === colIdx)
                        if (!col) return
                        const newWidthPx = Math.max(1, col.width + dx)
                        store.dataSvc.handleTransaction(
                            new Transaction(
                                [
                                    {
                                        type: 'setColWidth',
                                        value: new SetColWidthBuilder()
                                            .sheetIdx(store.currSheetIdx)
                                            .col(colIdx)
                                            .width(pxToWidth(newWidthPx))
                                            .build(),
                                    },
                                ],
                                true
                            )
                        )
                    }}
                />

                <RowHeaders
                    grid={grid}
                    setSelectedData={selectedData$}
                    sheetIdx={activeSheet}
                    onResizeRow={(rowIdx, dy) => {
                        if (!grid) return
                        const row = grid.rows.find((r) => r.idx === rowIdx)
                        if (!row) return
                        const newHeightPx = Math.max(1, row.height + dy)
                        store.dataSvc.handleTransaction(
                            new Transaction(
                                [
                                    {
                                        type: 'setRowHeight',
                                        value: new SetRowHeightBuilder()
                                            .sheetIdx(store.currSheetIdx)
                                            .row(rowIdx)
                                            .height(pxToPt(newHeightPx))
                                            .build(),
                                    },
                                ],
                                true
                            )
                        )
                    }}
                />
                <canvas
                    tabIndex={0}
                    className={styles.canvas}
                    id={CANVAS_ID}
                    onMouseDown={onMouseDown}
                    onWheel={onMouseWheel}
                    onKeyDown={onKeyDown}
                    onContextMenu={onContextMenu}
                    style={{
                        position: 'absolute',
                        left: LeftTop.width,
                        top: LeftTop.height,
                        right: 0,
                        bottom: 0,
                        display: 'block',
                        zIndex: 0,
                    }}
                >
                    Your browser does not support canvas. Please upgrade your
                    browser.
                </canvas>
            </div>
            {selectedData && selectedData.data?.ty === 'cellRange' && (
                <ContextmenuComponent
                    isOpen={contextmenuOpen}
                    setIsOpen={setContextMenuOpen}
                    selectedCellRange={selectedData.data.d}
                    left={contextMenuLeft}
                    top={contextMenuTop}
                />
            )}
            {selector && <SelectorComponent selector={selector} />}
            {store.blockOutliner.props.map((props, i) => (
                <BlockOutlinerComponent blockOutliner={props} key={i} />
            ))}
            {store.diyButton.props.map((props, i) => (
                <DiyButtonComponent key={i} props={props} />
            ))}
            {invalidCells.map((props, i) => (
                <ShadowCellComponent key={i} shadowCell={props} />
            ))}

            <Scrollbar
                totalLength={documentHeight}
                position={docPositionY}
                visibleLength={visibleHeight}
                orientation="y"
                onChange={(e) => {
                    setScrollbarRendering(true)
                    setDocPositionY(e)
                }}
                onBlur={() => {
                    setScrollbarRendering(false)
                }}
            />
            <Scrollbar
                totalLength={documentWidth}
                position={docPositionX}
                visibleLength={visibleWidth}
                orientation="x"
                onChange={(e) => {
                    setScrollbarRendering(true)
                    setDocPositionX(e)
                }}
                onBlur={() => {
                    setScrollbarRendering(false)
                }}
            />
            {store.textarea.context && store.textarea.editing && (
                <TextContainerComponent
                    ref={textEl}
                    context={store.textarea.context}
                    blur={onBlur}
                    type={type}
                />
            )}
            <DialogComponent isOpen={invalidFormulaWarning}>
                <InvalidFormulaComponent
                    close$={onCloseInvalidFormulaWarning}
                />
            </DialogComponent>
            {highlightCells.map((cell, i) => {
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
        </div>
    )
})
