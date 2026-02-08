/**
 * EngineCanvas - React wrapper for logisheets-engine's Spreadsheet UI
 *
 * This component mounts the engine's built-in canvas and UI components
 * into a React container, bridging the gap between the engine and React state.
 */

import {FC, useRef, useEffect, useCallback, useState, useMemo} from 'react'
import {InvalidFormulaDialog} from './InvalidFormulaDialog'
import {useEngine} from '@/core/engine/provider'
import type {Grid, MergeCell, SelectedData, CellLayout} from 'logisheets-engine'
import {
    Transaction,
    xForColStart,
    yForRowStart,
    xForColEnd,
    yForRowEnd,
    getReferenceString,
    buildSelectedDataFromCell,
    CellInputBuilder,
    Payload,
} from 'logisheets-engine'
import {
    FormulaEditorWrapper,
    FormulaEditorWrapperRef,
    CellRef,
} from '@/components/formula-editor'
import {getHighlightColor} from '@/components/const'
import {BlockInterfaceComponent} from '@/components/block-interface'
import styles from './engine-canvas.module.scss'

// LeftTop configuration (matches engine config)
const LeftTop = {width: 32, height: 24}

export interface EditorContext {
    text: string
    sheetName: string
    row: number
    col: number
    position: {
        x: number
        y: number
        width: number
        height: number
    }
    cursorPosition: 'start' | 'end'
}

export interface EngineCanvasProps {
    selectedData: SelectedData
    selectedData$: (data: SelectedData) => void
    activeSheet: number
    activeSheet$: (sheet: number) => void
    selectedDataContentChanged$: (e: object) => void
    grid: Grid | null
    setGrid: (grid: Grid | null) => void
    cellLayouts: CellLayout[]
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
}) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const editorRef = useRef<FormulaEditorWrapperRef>(null)
    const engine = useEngine()
    const dataSvc = engine.getDataService()
    const mountedRef = useRef(false)

    // Editor state
    const [editing, setEditing] = useState(false)
    const [editorContext, setEditorContext] = useState<EditorContext | null>(
        null
    )

    // Cell reference highlighting state
    const [cellRefs, setCellRefs] = useState<readonly CellRef[]>([])

    // Reference insertion state (for clicking cells during formula editing)
    const [reference, setReference] = useState('')
    // Track last editor text to check if editing formula
    const editorTextRef = useRef('')

    // Invalid formula dialog state
    const [invalidFormulaOpen, setInvalidFormulaOpen] = useState(false)

    // Listen for engine invalidFormula event
    useEffect(() => {
        const handler = () => setInvalidFormulaOpen(true)
        engine.on('invalidFormula', handler)
        return () => {
            engine.off('invalidFormula', handler)
        }
    }, [engine])

    // Start editing handler
    const startEditing = useCallback(
        (
            row: number,
            col: number,
            initialText: string,
            cursorPosition: 'start' | 'end' = 'end'
        ) => {
            if (!grid) return

            // Calculate position based on grid
            const startX = xForColStart(col, grid) + LeftTop.width
            const startY = yForRowStart(row, grid) + LeftTop.height

            // Get cell dimensions from grid
            const colInfo = grid.columns.find(
                (c: {idx: number; width: number}) => c.idx === col
            )
            const rowInfo = grid.rows.find(
                (r: {idx: number; height: number}) => r.idx === row
            )
            const width = colInfo?.width ?? 100
            const height = rowInfo?.height ?? 25

            // Track initial text for formula detection
            editorTextRef.current = initialText

            setEditorContext({
                text: initialText,
                sheetName: dataSvc.getCurrentSheetName(),
                row,
                col,
                position: {
                    x: startX,
                    y: startY,
                    width: Math.max(width, 100),
                    height,
                },
                cursorPosition,
            })
            setEditing(true)
        },
        [grid, dataSvc]
    )

    // Handle editor text changes (for formula detection)
    const handleEditorChange = useCallback((value: string) => {
        editorTextRef.current = value
    }, [])

    // Commit edit
    const commitEdit = useCallback(
        async (value: string) => {
            if (!editorContext) return

            const newText = value.trim()

            // If it's a formula, check validity first
            if (newText.startsWith('=')) {
                const isValid = await dataSvc.checkFormula(newText)
                if (!isValid) {
                    setInvalidFormulaOpen(true)
                    return
                }
            }

            const payload: Payload = {
                type: 'cellInput',
                value: new CellInputBuilder()
                    .row(editorContext.row)
                    .col(editorContext.col)
                    .sheetIdx(dataSvc.getCurrentSheetIdx())
                    .content(newText)
                    .build(),
            }
            await dataSvc.handleTransaction(new Transaction([payload], true))

            // Restore selectedData to the cell that was edited
            const restoredSelection = buildSelectedDataFromCell(
                editorContext.row,
                editorContext.col,
                'none'
            )
            selectedData$(restoredSelection)

            setEditing(false)
            setEditorContext(null)
            setCellRefs([])
            setReference('')
            editorTextRef.current = ''
            selectedDataContentChanged$({})

            // Refocus canvas
            const canvas = containerRef.current?.querySelector('canvas')
            canvas?.focus({preventScroll: true})
        },
        [editorContext, dataSvc, selectedData$, selectedDataContentChanged$]
    )

    // Cancel edit
    const cancelEdit = useCallback(() => {
        setEditing(false)
        setEditorContext(null)
        setCellRefs([])
        setReference('')
        editorTextRef.current = ''

        // Refocus canvas
        const canvas = containerRef.current?.querySelector('canvas')
        canvas?.focus({preventScroll: true})
    }, [])

    // Calculate highlight cells from cellRefs
    const highlightCells = useMemo(() => {
        if (!grid || cellRefs.length === 0) return []

        const cells: Array<{
            x: number
            y: number
            width: number
            height: number
            bgColor: string
        }> = []

        let colorIndex = 0
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
            const currSheetName = dataSvc.getCurrentSheetName()
            if (cellRef.sheet1 && cellRef.sheet1 !== currSheetName) continue

            const color = getHighlightColor(colorIndex++)

            const clampCol = (c: number) =>
                Math.min(Math.max(c, firstCol), lastCol)
            const clampRow = (r: number) =>
                Math.min(Math.max(r, firstRow), lastRow)

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
                    cells.push({
                        x: sx,
                        y: sy,
                        width: Math.max(0, ex - sx),
                        height: Math.max(0, ey - sy),
                        bgColor: color.css(),
                    })
                } else {
                    let endRow = r1
                    let endCol = c1
                    if (grid.mergeCells) {
                        grid.mergeCells.forEach((cell: MergeCell) => {
                            if (
                                cell.startCol <= c1 &&
                                c1 <= cell.endCol &&
                                cell.startRow <= r1 &&
                                r1 <= cell.endRow
                            ) {
                                endRow = Math.max(endRow, cell.endRow)
                                endCol = Math.max(endCol, cell.endCol)
                            }
                        })
                    }
                    const sx = LeftTop.width + xForColStart(c1, grid)
                    const ex = LeftTop.width + xForColEnd(endCol, grid)
                    const sy = LeftTop.height + yForRowStart(r1, grid)
                    const ey = LeftTop.height + yForRowEnd(endRow, grid)
                    cells.push({
                        x: sx,
                        y: sy,
                        width: Math.max(0, ex - sx),
                        height: Math.max(0, ey - sy),
                        bgColor: color.css(),
                    })
                }
            }
        }

        return cells
    }, [cellRefs, grid, dataSvc])

    // Create a stable ref for isEditingFormula check
    const isEditingFormulaRef = useRef<() => boolean>(() => false)
    isEditingFormulaRef.current = () =>
        editing && editorTextRef.current.trim().startsWith('=')

    // Mount the engine UI
    useEffect(() => {
        if (!containerRef.current || mountedRef.current) return

        // Mount the engine's Spreadsheet component
        engine.mount(containerRef.current, {
            showSheetTabs: false, // We use our own SheetsTabComponent
            showScrollbars: true,
            cellLayouts,
            getIsEditingFormula: () => isEditingFormulaRef.current(),
        })
        mountedRef.current = true

        return () => {
            engine.unmount()
            mountedRef.current = false
        }
    }, [engine, cellLayouts])

    // Check if currently editing a formula (for other uses)
    const isEditingFormula = useCallback(() => {
        return editing && editorTextRef.current.trim().startsWith('=')
    }, [editing])

    // Sync selection changes from engine to React state
    useEffect(() => {
        const handleSelectionChange = (data: SelectedData) => {
            // If editing a formula, convert selection to reference string
            if (isEditingFormula()) {
                const newRef = getReferenceString(data)
                if (newRef && newRef !== reference) {
                    setReference(newRef)
                }
                // Don't update selectedData when editing formula - we're just inserting references
                return
            }

            selectedData$(data)
            selectedDataContentChanged$({})
        }

        engine.on('selectionChange', handleSelectionChange)

        return () => {
            engine.off('selectionChange', handleSelectionChange)
        }
    }, [
        engine,
        selectedData$,
        selectedDataContentChanged$,
        isEditingFormula,
        reference,
    ])

    // Sync active sheet changes from engine to React state
    useEffect(() => {
        const handleActiveSheetChange = (sheet: number) => {
            activeSheet$(sheet)
        }

        engine.on('activeSheetChange', handleActiveSheetChange)

        return () => {
            engine.off('activeSheetChange', handleActiveSheetChange)
        }
    }, [engine, activeSheet$])

    // Sync grid changes from engine to React state
    useEffect(() => {
        const handleGridChange = (g: Grid | null) => {
            setGrid(g)
        }

        engine.on('gridChange', handleGridChange)

        return () => {
            engine.off('gridChange', handleGridChange)
        }
    }, [engine, setGrid])

    // Handle startEdit events from engine
    useEffect(() => {
        const handleStartEdit = (data: {
            row: number
            col: number
            initialText: string
        }) => {
            startEditing(data.row, data.col, data.initialText)
        }

        engine.on('startEdit', handleStartEdit)

        return () => {
            engine.off('startEdit', handleStartEdit)
        }
    }, [engine, startEditing])

    // Sync React activeSheet to engine (when changed externally)
    useEffect(() => {
        if (engine.getCurrentSheetIndex() !== activeSheet) {
            engine.setCurrentSheetIndex(activeSheet)
        }
    }, [engine, activeSheet])

    // Sync React selection to engine (when changed externally)
    useEffect(() => {
        const currentSelection = engine.getSelection()
        // Only update if different to avoid loops
        if (JSON.stringify(currentSelection) !== JSON.stringify(selectedData)) {
            engine.setSelection(selectedData)
        }
    }, [engine, selectedData])

    // Update editor position when grid changes
    useEffect(() => {
        if (!editing || !editorContext || !grid) return

        const {row, col} = editorContext
        // Check if cell is still visible
        const minRow = grid.rows[0]?.idx ?? 0
        const maxRow = grid.rows[grid.rows.length - 1]?.idx ?? 0
        const minCol = grid.columns[0]?.idx ?? 0
        const maxCol = grid.columns[grid.columns.length - 1]?.idx ?? 0

        if (row < minRow || row > maxRow || col < minCol || col > maxCol) {
            // Cell is out of visible range - hide editor position
            setEditorContext((prev) =>
                prev
                    ? {
                          ...prev,
                          position: {...prev.position, x: -9999, y: -9999},
                      }
                    : null
            )
        } else {
            // Update position
            const startX = xForColStart(col, grid) + LeftTop.width
            const startY = yForRowStart(row, grid) + LeftTop.height
            setEditorContext((prev) =>
                prev
                    ? {
                          ...prev,
                          position: {...prev.position, x: startX, y: startY},
                      }
                    : null
            )
        }
    }, [grid, editing, editorContext?.row, editorContext?.col])

    // Track canvas position for BlockInterfaceComponent
    const [canvasPos, setCanvasPos] = useState({x: 0, y: 0})

    useEffect(() => {
        const updateCanvasPos = () => {
            const canvas = containerRef.current?.querySelector('canvas')
            if (canvas) {
                const rect = canvas.getBoundingClientRect()
                setCanvasPos({x: rect.left, y: rect.top})
            }
        }
        updateCanvasPos()
        window.addEventListener('resize', updateCanvasPos)
        window.addEventListener('scroll', updateCanvasPos)
        return () => {
            window.removeEventListener('resize', updateCanvasPos)
            window.removeEventListener('scroll', updateCanvasPos)
        }
    }, [grid])

    return (
        <>
            <div ref={containerRef} className={styles.host}>
                {/* Highlight cells for formula references */}
                {highlightCells.map((cell, i) => (
                    <div
                        key={`highlight-${i}`}
                        className={styles['highlight-cell']}
                        style={{
                            left: cell.x,
                            top: cell.y,
                            width: cell.width,
                            height: cell.height,
                            backgroundColor: cell.bgColor,
                        }}
                    />
                ))}
                {editing && editorContext && (
                    <FormulaEditorWrapper
                        ref={editorRef}
                        initialText={editorContext.text}
                        sheetName={editorContext.sheetName}
                        dataService={dataSvc}
                        position={editorContext.position}
                        initialCursorPosition={editorContext.cursorPosition}
                        referenceInsertion={reference}
                        onBlur={commitEdit}
                        onCancel={cancelEdit}
                        onCellRefsChange={setCellRefs}
                        onChange={handleEditorChange}
                    />
                )}
                {/* Block interface overlay */}
                {grid && grid.blockInfos && grid.blockInfos.length > 0 && (
                    <BlockInterfaceComponent
                        grid={grid}
                        canvasStartX={canvasPos.x}
                        canvasStartY={canvasPos.y}
                    />
                )}
            </div>
            <InvalidFormulaDialog
                open={invalidFormulaOpen}
                onClose={() => setInvalidFormulaOpen(false)}
            />
        </>
    )
}

export default EngineCanvas
