import {
    RefObject,
    MutableRefObject,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import type {Grid, MergeCell, SelectedData, DataService} from 'logisheets-engine'
import type {Session} from 'logisheets-engine'
import {
    xForColStart,
    yForRowStart,
    xForColEnd,
    yForRowEnd,
    getReferenceString,
    buildSelectedDataFromCell,
} from 'logisheets-engine'
import {useOps} from '@/core/engine/provider'
import {
    FormulaEditorWrapper,
    FormulaEditorWrapperRef,
    CellRef,
} from '@/components/formula-editor'
import {getHighlightColor} from '@/components/const'
import {isCellUserEditableSync} from '@/core/permissions/field-editable'
import {InvalidFormulaDialog} from '@/components/engine-canvas/InvalidFormulaDialog'

const LeftTop = {width: 32, height: 24}

interface EditorContext {
    text: string
    sheetName: string
    row: number
    col: number
    position: {x: number; y: number; width: number; height: number}
    cursorPosition: 'start' | 'end'
}

/** Event surface this editor needs — satisfied by both Engine and Session. */
type EditEventSource = Pick<Session, 'on' | 'off'>

export interface InlineCellEditorProps {
    /** Engine (main view) or Session (secondary view) — emits startEdit /
     *  selectionChange / invalidFormula for THIS view. */
    eventSource: EditEventSource
    grid: Grid | null
    /** This view's sheet (NOT the global pointer — keeps views independent). */
    sheetIdx: number
    sheetName: string
    dataSvc: DataService
    /** The view's canvas container; used as the positioning origin and for
     *  refocusing the canvas after a commit. */
    containerRef: RefObject<HTMLDivElement | null>
    /** Set by this editor to report "an editor is open" so the view's mount
     *  can keep the canvas from stealing focus (getIsEditingFormula). */
    editingRef: MutableRefObject<() => boolean>
    /** A real selection move (not a reference-insertion during formula edit). */
    onSelectionChange: (data: SelectedData) => void
    /** Bump so dependents (edit bar) re-read cell content. */
    onContentChanged?: () => void
}

/**
 * Inline cell editor for a single spreadsheet view — the FormulaEditor popup
 * that opens on double-click / typing, plus formula reference highlighting and
 * commit/validation. Parameterised by an event source (Engine for the main
 * view, Session for a secondary view) so every view edits in-place identically.
 */
export function InlineCellEditor({
    eventSource,
    grid,
    sheetIdx,
    sheetName,
    dataSvc,
    containerRef,
    editingRef,
    onSelectionChange,
    onContentChanged,
}: InlineCellEditorProps) {
    const ops = useOps()
    const editorRef = useRef<FormulaEditorWrapperRef>(null)
    const [editing, setEditing] = useState(false)
    const [editorContext, setEditorContext] = useState<EditorContext | null>(
        null
    )
    const [cellRefs, setCellRefs] = useState<readonly CellRef[]>([])
    const [reference, setReference] = useState('')
    const [invalidFormulaOpen, setInvalidFormulaOpen] = useState(false)
    const editorTextRef = useRef('')

    // Report "editor open" to the view's mount (so the canvas doesn't steal
    // focus and blur a freshly-opened editor on the 2nd click of a dblclick).
    editingRef.current = () => editing

    const focusCanvas = useCallback(() => {
        containerRef.current?.querySelector('canvas')?.focus({
            preventScroll: true,
        })
    }, [containerRef])

    const startEditing = useCallback(
        (
            row: number,
            col: number,
            initialText: string,
            cursorPosition: 'start' | 'end' = 'end'
        ) => {
            if (!grid) return
            // Don't open on user-uneditable field cells — fail fast instead of
            // letting the eventual commit get rejected after typing.
            if (!isCellUserEditableSync(sheetIdx, row, col, grid)) return

            const startX = xForColStart(col, grid) + LeftTop.width
            const startY = yForRowStart(row, grid) + LeftTop.height
            const colInfo = grid.columns.find(
                (c: {idx: number; width: number}) => c.idx === col
            )
            const rowInfo = grid.rows.find(
                (r: {idx: number; height: number}) => r.idx === row
            )
            const width = colInfo?.width ?? 100
            const height = rowInfo?.height ?? 25

            editorTextRef.current = initialText
            setEditorContext({
                text: initialText,
                sheetName,
                row,
                col,
                position: {x: startX, y: startY, width, height},
                cursorPosition,
            })
            setEditing(true)
        },
        [grid, sheetIdx, sheetName]
    )

    const handleEditorChange = useCallback((value: string) => {
        editorTextRef.current = value
    }, [])

    const commitEdit = useCallback(
        async (value: string, restoreSelection = true) => {
            if (!editorContext) return
            const newText = value.trim()
            if (newText.startsWith('=')) {
                const isValid = await dataSvc.checkFormula(newText)
                if (!isValid) {
                    setInvalidFormulaOpen(true)
                    return
                }
            }
            await ops.inputCell(
                sheetIdx,
                editorContext.row,
                editorContext.col,
                newText
            )

            if (restoreSelection) {
                onSelectionChange(
                    buildSelectedDataFromCell(
                        editorContext.row,
                        editorContext.col,
                        'none'
                    )
                )
            }
            setEditing(false)
            setEditorContext(null)
            setCellRefs([])
            setReference('')
            editorTextRef.current = ''
            onContentChanged?.()
            focusCanvas()
        },
        [
            editorContext,
            dataSvc,
            ops,
            sheetIdx,
            onSelectionChange,
            onContentChanged,
            focusCanvas,
        ]
    )

    const cancelEdit = useCallback(() => {
        setEditing(false)
        setEditorContext(null)
        setCellRefs([])
        setReference('')
        editorTextRef.current = ''
        focusCanvas()
    }, [focusCanvas])

    const isEditingFormula = useCallback(
        () => editing && editorTextRef.current.trim().startsWith('='),
        [editing]
    )

    // invalidFormula event
    useEffect(() => {
        const handler = () => setInvalidFormulaOpen(true)
        eventSource.on('invalidFormula', handler)
        return () => eventSource.off('invalidFormula', handler)
    }, [eventSource])

    // startEdit event
    useEffect(() => {
        const handleStartEdit = async (data: {
            row: number
            col: number
            initialText: string
        }) => {
            await Promise.resolve()
            startEditing(data.row, data.col, data.initialText)
        }
        eventSource.on('startEdit', handleStartEdit)
        return () => eventSource.off('startEdit', handleStartEdit)
    }, [eventSource, startEditing])

    // selectionChange: insert references while editing a formula, commit on
    // navigate for plain values, otherwise propagate the move to the view.
    useEffect(() => {
        const handleSelectionChange = (data: SelectedData) => {
            if (isEditingFormula()) {
                const newRef = getReferenceString(data)
                if (newRef && newRef !== reference) setReference(newRef)
                return
            }
            if (editing && editorContext && data.data?.ty === 'cellRange') {
                const {startRow, startCol} = data.data.d
                if (
                    startRow !== editorContext.row ||
                    startCol !== editorContext.col
                ) {
                    commitEdit(editorTextRef.current, false)
                }
            }
            onSelectionChange(data)
            onContentChanged?.()
        }
        eventSource.on('selectionChange', handleSelectionChange)
        return () => eventSource.off('selectionChange', handleSelectionChange)
    }, [
        eventSource,
        isEditingFormula,
        reference,
        editing,
        editorContext,
        commitEdit,
        onSelectionChange,
        onContentChanged,
    ])

    // Keep the editor glued to its cell as the grid scrolls; park it off-screen
    // when the cell scrolls out of view.
    useEffect(() => {
        if (!editing || !editorContext || !grid) return
        const {row, col} = editorContext
        const minRow = grid.rows[0]?.idx ?? 0
        const maxRow = grid.rows[grid.rows.length - 1]?.idx ?? 0
        const minCol = grid.columns[0]?.idx ?? 0
        const maxCol = grid.columns[grid.columns.length - 1]?.idx ?? 0
        if (row < minRow || row > maxRow || col < minCol || col > maxCol) {
            setEditorContext((prev) =>
                prev
                    ? {...prev, position: {...prev.position, x: -9999, y: -9999}}
                    : null
            )
        } else {
            const startX = xForColStart(col, grid) + LeftTop.width
            const startY = yForRowStart(row, grid) + LeftTop.height
            setEditorContext((prev) =>
                prev
                    ? {...prev, position: {...prev.position, x: startX, y: startY}}
                    : null
            )
        }
    }, [grid, editing, editorContext?.row, editorContext?.col])

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
            if (cellRef.workbook) continue
            if (
                cellRef.sheet1 !== undefined &&
                cellRef.sheet2 !== undefined &&
                cellRef.sheet1 !== cellRef.sheet2
            )
                continue
            if (cellRef.sheet1 && cellRef.sheet1 !== sheetName) continue
            const color = getHighlightColor(colorIndex++)
            const clampCol = (c: number) =>
                Math.min(Math.max(c, firstCol), lastCol)
            const clampRow = (r: number) =>
                Math.min(Math.max(r, firstRow), lastRow)
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
    }, [cellRefs, grid, sheetName])

    return (
        <>
            {highlightCells.map((cell, i) => (
                <div
                    key={`highlight-${i}`}
                    style={{
                        position: 'absolute',
                        pointerEvents: 'none',
                        opacity: 0.3,
                        zIndex: 0,
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
                    onBlur={(v) => commitEdit(v, false)}
                    onSubmit={(v) => commitEdit(v, true)}
                    onCancel={cancelEdit}
                    onCellRefsChange={setCellRefs}
                    onChange={handleEditorChange}
                />
            )}
            <InvalidFormulaDialog
                open={invalidFormulaOpen}
                onClose={() => setInvalidFormulaOpen(false)}
            />
        </>
    )
}
