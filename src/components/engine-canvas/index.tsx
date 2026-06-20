/**
 * EngineCanvas - React wrapper for logisheets-engine's Spreadsheet UI (the
 * MAIN view). Mounts the engine's default session, bridges its selection /
 * active-sheet / grid to React state, and layers the shared inline editor +
 * overlays on top. Secondary views use SpreadsheetView, which reuses the same
 * InlineCellEditor + ViewOverlayLayer building blocks.
 */

import {FC, useRef, useEffect, useState} from 'react'
import {useEngine} from '@/core/engine/provider'
import type {Grid, SelectedData, CellLayout} from 'logisheets-engine'
import {ViewOverlayLayer} from '@/components/spreadsheet-view/view-overlay-layer'
import {InlineCellEditor} from '@/components/spreadsheet-view/inline-cell-editor'
import {DiffLayer} from '@/components/diff-layer'
import type {DiffState} from '@/components/diff-layer'
import styles from './engine-canvas.module.scss'

export interface EngineCanvasProps {
    selectedData: SelectedData
    selectedData$: (data: SelectedData) => void
    activeSheet: number
    activeSheet$: (sheet: number) => void
    selectedDataContentChanged$: (e: object) => void
    grid: Grid | null
    setGrid: (grid: Grid | null) => void
    cellLayouts: CellLayout[]
    /** Diff state for showing uncommitted temp transaction changes */
    diffState?: DiffState
}

export const EngineCanvas: FC<EngineCanvasProps> = ({
    selectedData,
    selectedData$,
    activeSheet,
    activeSheet$,
    selectedDataContentChanged$,
    grid,
    setGrid,
    cellLayouts,
    diffState,
}) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const engine = useEngine()
    const dataSvc = engine.getDataService()
    const mountedRef = useRef(false)

    // Set by InlineCellEditor; read by the engine mount so the canvas doesn't
    // steal focus while an editor is open.
    const editingRef = useRef<() => boolean>(() => false)

    // Mount the engine UI (default session)
    useEffect(() => {
        if (!containerRef.current || mountedRef.current) return
        engine.mount(containerRef.current, {
            showSheetTabs: false, // We use our own SheetsTabComponent
            showScrollbars: true,
            cellLayouts,
            getIsEditingFormula: () => editingRef.current(),
        })
        mountedRef.current = true
        return () => {
            engine.unmount()
            mountedRef.current = false
        }
    }, [engine, cellLayouts])

    // Sync active sheet changes from engine → React state
    useEffect(() => {
        const handleActiveSheetChange = (sheet: number) => activeSheet$(sheet)
        engine.on('activeSheetChange', handleActiveSheetChange)
        return () => engine.off('activeSheetChange', handleActiveSheetChange)
    }, [engine, activeSheet$])

    // Sync grid changes from engine → React state
    useEffect(() => {
        const handleGridChange = (g: Grid | null) => setGrid(g)
        engine.on('gridChange', handleGridChange)
        return () => engine.off('gridChange', handleGridChange)
    }, [engine, setGrid])

    // Sync React activeSheet → engine (external changes, e.g. sheet tabs)
    useEffect(() => {
        if (engine.getCurrentSheetIndex() !== activeSheet) {
            engine.setCurrentSheetIndex(activeSheet)
        }
    }, [engine, activeSheet])

    // Sync React selection → engine (external changes)
    useEffect(() => {
        const current = engine.getSelection()
        if (JSON.stringify(current) !== JSON.stringify(selectedData)) {
            engine.setSelection(selectedData)
        }
    }, [engine, selectedData])

    // Track canvas position (viewport coords) for the overlay layer's hover.
    const [canvasPos, setCanvasPos] = useState({x: 0, y: 0})
    useEffect(() => {
        const updateCanvasPos = () => {
            const canvas = containerRef.current?.querySelector('canvas')
            if (!canvas) return
            const rect = canvas.getBoundingClientRect()
            setCanvasPos((prev) =>
                prev.x === rect.left && prev.y === rect.top
                    ? prev
                    : {x: rect.left, y: rect.top}
            )
        }
        updateCanvasPos()
        window.addEventListener('resize', updateCanvasPos)
        window.addEventListener('scroll', updateCanvasPos)
        return () => {
            window.removeEventListener('resize', updateCanvasPos)
            window.removeEventListener('scroll', updateCanvasPos)
        }
    }, [])

    return (
        <div ref={containerRef} className={styles.host}>
            {diffState && <DiffLayer diffState={diffState} grid={grid} />}
            <InlineCellEditor
                eventSource={engine}
                grid={grid}
                sheetIdx={activeSheet}
                sheetName={dataSvc.getSheetNameByIdx(activeSheet)}
                dataSvc={dataSvc}
                containerRef={containerRef}
                editingRef={editingRef}
                onSelectionChange={selectedData$}
                onContentChanged={() => selectedDataContentChanged$({})}
            />
            {/* Block + craft overlays (clip to this view) */}
            <ViewOverlayLayer
                grid={grid}
                activeSheet={activeSheet}
                canvasStartX={canvasPos.x}
                canvasStartY={canvasPos.y}
            />
        </div>
    )
}

export default EngineCanvas
