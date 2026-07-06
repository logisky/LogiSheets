import {RefObject, MutableRefObject, useEffect, useRef, useState} from 'react'
import type {Grid, SelectedData, DataService, Session} from 'logisheets-engine'
import {useOps} from '@/core/engine/provider'
import {
    createInlineCellEditor,
    type InlineCellEditorHandle,
} from 'logisheets-formula-editor/inline'
import {getHighlightColor} from '@/components/const'
import {getFormulaFunctions} from '@/core/snippet'
import {isCellUserEditableSync} from '@/core/permissions/field-editable'
import {InvalidFormulaDialog} from '@/components/engine-canvas/InvalidFormulaDialog'
import {formulaEditCoordinator} from '@/core/formula-edit-coordinator'

/** Event surface this editor needs — satisfied by both Engine and Session. */
type EditEventSource = Pick<Session, 'on' | 'off'>

export interface InlineCellEditorProps {
    /** Engine (main view) or Session (secondary view) — emits startEdit /
     *  selectionChange / invalidFormula for THIS view. */
    eventSource: EditEventSource
    grid: Grid | null
    /** Stable id of the owning view ('main', 'view-2', …) — cross-view routing. */
    viewId: string
    /** This view's sheet (NOT the global pointer — keeps views independent). */
    sheetIdx: number
    sheetName: string
    dataSvc: DataService
    /** The view's canvas container; the editor + highlight overlays mount here
     *  (positioning origin) and the canvas is refocused after a commit. */
    containerRef: RefObject<HTMLDivElement | null>
    /** Set by this editor to report "an editor is open" so the view's mount
     *  can keep the canvas from stealing focus. */
    editingRef: MutableRefObject<() => boolean>
    /** A real selection move (not a reference-insertion during formula edit). */
    onSelectionChange: (data: SelectedData) => void
    /** Switch the owning view to a sheet (to return to the edited cell's sheet
     *  after committing a formula built from another sheet). */
    setViewSheet: (sheetIdx: number) => void
    /** Bump so dependents (edit bar) re-read cell content. */
    onContentChanged?: () => void
}

/**
 * Inline cell editor for a single spreadsheet view — a thin React wrapper over
 * the framework-agnostic `createInlineCellEditor` controller (in
 * `logisheets-formula-editor/inline`). All editing behavior — positioning,
 * commit/cancel/validation, reference insertion, highlight overlays, scroll
 * repositioning — lives in the controller; this wrapper just owns the React
 * lifecycle and injects the app-specific bits (commit via ops, edit
 * permissions, the invalid-formula dialog, the highlight palette).
 */
export function InlineCellEditor({
    eventSource,
    grid,
    viewId,
    sheetIdx,
    sheetName,
    dataSvc,
    containerRef,
    editingRef,
    onSelectionChange,
    setViewSheet,
    onContentChanged,
}: InlineCellEditorProps) {
    const ops = useOps()
    const [invalidOpen, setInvalidOpen] = useState(false)
    const ctrlRef = useRef<InlineCellEditorHandle | null>(null)

    // Latest reactive values, read by the (stable) controller's callbacks.
    const latest = useRef({
        sheetName,
        sheetIdx,
        onSelectionChange,
        setViewSheet,
        onContentChanged,
        ops,
    })
    latest.current = {
        sheetName,
        sheetIdx,
        onSelectionChange,
        setViewSheet,
        onContentChanged,
        ops,
    }

    useEffect(() => {
        const container = containerRef.current
        if (!container) return
        const ctrl = createInlineCellEditor({
            container,
            eventSource,
            dataService: dataSvc,
            viewId,
            // Read fresh so switching the view's sheet mid-edit is reflected
            // without recreating the controller (which would drop the edit).
            getViewSheetIdx: () => latest.current.sheetIdx,
            grid,
            getSheetName: () => latest.current.sheetName,
            formulaFunctions: getFormulaFunctions(),
            inputCell: (s, r, c, t) => latest.current.ops.inputCell(s, r, c, t),
            setSelection: (d) => latest.current.onSelectionChange(d),
            setViewSheet: (i) => latest.current.setViewSheet(i),
            coordinator: formulaEditCoordinator,
            canEdit: (s, r, c, g) => isCellUserEditableSync(s, r, c, g),
            getHighlightColor: (i) => getHighlightColor(i).css(),
            onInvalidFormula: () => setInvalidOpen(true),
            onContentChanged: () => latest.current.onContentChanged?.(),
        })
        ctrlRef.current = ctrl
        editingRef.current = () => ctrl.isEditing()
        return () => {
            ctrl.destroy()
            ctrlRef.current = null
        }
        // Created once per (view, service); sheet + grid changes flow via the
        // `latest` ref and setGrid, so switching sheets keeps the edit alive.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eventSource, dataSvc, viewId, containerRef])

    // Reposition + repaint highlights on every grid change/render.
    useEffect(() => {
        ctrlRef.current?.setGrid(grid)
    }, [grid])

    return (
        <InvalidFormulaDialog
            open={invalidOpen}
            onClose={() => setInvalidOpen(false)}
        />
    )
}
