import {useEffect, useRef, useState, useCallback} from 'react'
import {observer} from 'mobx-react-lite'
import {useEngine} from '@/core/engine/provider'
import type {Session, Grid, SelectedData} from 'logisheets-engine'
import {SheetsTabComponent} from '@/components/sheets-tab'
import {globalStore} from '@/store'
import {
    CanvasContextMenu,
    type ContextMenuTrigger,
} from '@/components/engine-canvas/canvas-context-menu'
import {ViewOverlayLayer} from './view-overlay-layer'
import {InlineCellEditor} from './inline-cell-editor'
import {ActiveViewBadge} from './active-view-badge'
import {formulaEditCoordinator} from '@/core/formula-edit-coordinator'

/**
 * A self-contained, independent view of the shared workbook.
 *
 * Rendering one `<SpreadsheetView />` creates a new `engine.createSession()`,
 * mounts its canvas, and layers the app's block overlays + sheet-tab bar on
 * top — all scoped to THIS session's own grid, viewport and active sheet.
 * Destroyed on unmount (callbacks unregistered, worker canvas released).
 *
 * This is the reusable view unit: a second, third, … view is just another
 * instance. Block overlays live in {@link BlockOverlayLayer}, which clips to
 * this view, so nothing bleeds across views.
 *
 * (The main view still uses the richer EngineCanvas — it shares the same
 * BlockOverlayLayer for consistency and containment.)
 */
export const SpreadsheetView = observer(function SpreadsheetView({
    viewId,
}: {
    viewId: string
}) {
    const engine = useEngine()
    const dataSvc = engine.getDataService()
    const containerRef = useRef<HTMLDivElement | null>(null)
    const sessionRef = useRef<Session | null>(null)
    const editingRef = useRef<() => boolean>(() => false)
    const [session, setSession] = useState<Session | null>(null)
    const [activeSheet, setActiveSheet] = useState(0)
    const [grid, setGrid] = useState<Grid | null>(null)
    const [canvasPos, setCanvasPos] = useState({x: 0, y: 0})
    const [selectedData, setSelectedData] = useState<SelectedData>({
        source: 'none',
    })

    // Route live activeSheet / selection through stable callbacks for the
    // context-menu component.
    const activeSheetRef = useRef(activeSheet)
    activeSheetRef.current = activeSheet
    const getActiveSheet = useCallback(() => activeSheetRef.current, [])
    const setSelection = useCallback((d: SelectedData) => {
        sessionRef.current?.setSelection(d)
        setSelectedData(d)
    }, [])
    // Subscribe to THIS session's contextMenu event (re-binds once the session
    // is created). The engine renders no menu; the host menu below does.
    const subscribeContextMenu = useCallback(
        (cb: (e: ContextMenuTrigger) => void) => {
            const s = session
            if (!s) return () => {}
            s.on('contextMenu', cb)
            return () => s.off('contextMenu', cb)
        },
        [session]
    )

    useEffect(() => {
        if (!containerRef.current) return
        const s = engine.createSession()
        sessionRef.current = s
        setSession(s)
        const onActiveSheet = (idx: number) => setActiveSheet(idx)
        const onGrid = (g: Grid | null) => setGrid(g)
        s.on('activeSheetChange', onActiveSheet)
        s.on('gridChange', onGrid)
        s.mount(containerRef.current, {
            showSheetTabs: false,
            showScrollbars: true,
            getIsEditingFormula: () =>
                editingRef.current() ||
                formulaEditCoordinator.isFormulaEditing(),
        })
        return () => {
            s.off('activeSheetChange', onActiveSheet)
            s.off('gridChange', onGrid)
            s.destroy()
            sessionRef.current = null
            setSession(null)
            // Hand focus back to the main view if this view was active.
            if (globalStore.activeViewId === viewId) {
                globalStore.setActiveViewId('main')
            }
        }
    }, [engine, viewId])

    // While this view is the active one, publish its selection context so the
    // top edit bar reads/writes here instead of the main view.
    useEffect(() => {
        if (globalStore.activeViewId !== viewId) return
        globalStore.setActiveViewContext({
            selectedData,
            sheetIdx: activeSheet,
            setSelection: (d) => sessionRef.current?.setSelection(d),
        })
    }, [viewId, selectedData, activeSheet, globalStore.activeViewId])

    // Track this view's canvas position (viewport coords) for the block
    // overlay's hover math. Re-measure on layout shifts and grid changes.
    useEffect(() => {
        const update = () => {
            const canvas = containerRef.current?.querySelector('canvas')
            if (!canvas) return
            const rect = canvas.getBoundingClientRect()
            setCanvasPos((prev) =>
                prev.x === rect.left && prev.y === rect.top
                    ? prev
                    : {x: rect.left, y: rect.top}
            )
        }
        update()
        window.addEventListener('resize', update)
        window.addEventListener('scroll', update, true)
        return () => {
            window.removeEventListener('resize', update)
            window.removeEventListener('scroll', update, true)
        }
    }, [grid])

    const isActive = globalStore.activeViewId === viewId
    return (
        <div
            onPointerDownCapture={() => globalStore.setActiveViewId(viewId)}
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                flex: 1,
                minWidth: 0,
                height: '100%',
                borderLeft: '1px solid #ddd',
                paddingLeft: 8,
            }}
        >
            <div
                ref={containerRef}
                style={{flex: 1, minHeight: 0, position: 'relative'}}
            >
                {session && (
                    <InlineCellEditor
                        eventSource={session}
                        grid={grid}
                        viewId={viewId}
                        sheetIdx={activeSheet}
                        sheetName={dataSvc.getSheetNameByIdx(activeSheet)}
                        dataSvc={dataSvc}
                        containerRef={containerRef}
                        editingRef={editingRef}
                        onSelectionChange={setSelectedData}
                        setViewSheet={(idx) => {
                            setActiveSheet(idx)
                            sessionRef.current?.setCurrentSheetIndex(idx)
                        }}
                    />
                )}
                <ViewOverlayLayer
                    grid={grid}
                    activeSheet={activeSheet}
                    canvasStartX={canvasPos.x}
                    canvasStartY={canvasPos.y}
                />
                <ActiveViewBadge active={isActive} />
            </div>
            <CanvasContextMenu
                subscribe={subscribeContextMenu}
                dataSvc={dataSvc}
                getActiveSheet={getActiveSheet}
                setSelection={setSelection}
            />
            <SheetsTabComponent
                activeSheet={activeSheet}
                activeSheet$={(idx) => {
                    setActiveSheet(idx)
                    sessionRef.current?.setCurrentSheetIndex(idx)
                }}
                grid={grid}
            />
        </div>
    )
})
