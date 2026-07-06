/**
 * logisheets-formula-editor/inline
 *
 * Framework-agnostic in-cell editor controller — the glue that turns
 * `logisheets-engine` + the formula editor into a drop-in editable grid, with
 * no React (or any framework). Mirrors the engine's imperative model:
 *
 *   const ed = createInlineCellEditor({ container, eventSource: session, dataService, ... })
 *   session.on('gridChange', (g) => ed.setGrid(g))
 *   // ...later
 *   ed.destroy()
 *
 * It listens for the view's `startEdit` / `selectionChange` / `invalidFormula`
 * events, opens a {@link createFormulaEditor} positioned over the target cell,
 * handles commit / cancel / validation, inserts cell references as the user
 * clicks around during a formula edit, repositions on scroll, and paints
 * reference-highlight overlays. App-specific concerns (committing a value,
 * edit permissions, the invalid-formula UI) are injected as callbacks.
 *
 * This entry depends on `logisheets-engine` (peer) for the grid geometry,
 * event types, and selection helpers; the package core/root stay engine-free.
 */

import {createFormulaEditor, type FormulaEditorHandle} from './editor'
import {createEngineFormulaSource, type EngineFormulaServices} from './engine'
import {builtinFormulaFunctions} from './functions'
import {measureText} from './utils'
import {getCellRefColor, type FormulaEditorConfig, type FormulaFunction} from './types'
import {
    getCellRect,
    isCellInGridWindow,
    getReferenceHighlightRects,
    getReferenceString,
    qualifyReference,
    buildSelectedDataFromCell,
} from 'logisheets-engine'
import type {
    Grid,
    SelectedData,
    Session,
    FormulaCellRef,
} from 'logisheets-engine'

/**
 * A single in-progress formula edit, registered with a {@link FormulaCoordinator}
 * so OTHER views can feed it references (Excel "point mode" across sheets/views).
 */
export interface FormulaEditEntry {
    /** Stable id of the view that owns this edit. */
    readonly viewId: string
    /** Sheet index the cell being edited lives on. */
    getEditSheetIdx(): number
    /** Display reference of the edited cell, e.g. "Sheet1!B2". */
    getCellRef(): string
    /** Current (live) formula text. */
    getText(): string
    /** Insert a reference for a selection made in `sourceSheetIdx`. */
    insertExternalRef(sourceSheetIdx: number, data: SelectedData): void
    /** Refocus the editor (e.g. after a sheet tab grabbed focus) so Enter
     *  keeps committing. */
    focus(): void
    /** Commit / cancel the edit (for the cross-sheet reminder's buttons). */
    commit(): void
    cancel(): void
}

/**
 * App-provided coordinator that tracks the one active formula edit across all
 * views, so any view's cell click routes a reference to it instead of
 * committing, and sheet tabs / other canvases know not to steal focus.
 */
export interface FormulaCoordinator {
    setActive(entry: FormulaEditEntry): void
    clear(entry: FormulaEditEntry): void
    getActive(): FormulaEditEntry | null
    isFormulaEditing(): boolean
    /** Notify that the active entry's live text changed (for the reminder). */
    notifyChange?(entry: FormulaEditEntry): void
}

export interface InlineCellEditorOptions {
    /** Element the editor + highlight overlays mount into (the view's canvas
     *  container; also the positioning origin and refocus target). */
    container: HTMLElement
    /** Emits startEdit / selectionChange / invalidFormula for this view
     *  (an engine `Session`, or the `Engine` itself for the main view). */
    eventSource: Pick<Session, 'on' | 'off'>
    /** Engine data service — `getWorkbook()` + `checkFormula()`. */
    dataService: EngineFormulaServices
    /** Stable id of the view that owns this editor (cross-view routing). */
    viewId: string
    /** This view's CURRENT sheet index (read fresh; changes as tabs switch). */
    getViewSheetIdx: () => number
    /** Current sheet name (read fresh; used for local cell-ref coloring). */
    getSheetName: () => string
    /** Commit a cell value (the host's input/ops layer). The return value is
     *  awaited but otherwise ignored, so `void`/any Promise is fine. */
    inputCell: (
        sheetIdx: number,
        row: number,
        col: number,
        text: string
    ) => unknown
    /** Move the view's selection (e.g. after committing). */
    setSelection: (data: SelectedData) => void
    /** Switch the view to a sheet — used to return to the edited cell's sheet
     *  after committing a formula built from another sheet. */
    setViewSheet?: (sheetIdx: number) => void
    /** Cross-view formula-edit coordinator (Excel point mode across views). */
    coordinator?: FormulaCoordinator
    /** Initial grid; keep updated via {@link InlineCellEditorHandle.setGrid}. */
    grid?: Grid | null
    /** Header panel offsets (engine config leftTopWidth/Height). Default 32/24. */
    origin?: {x: number; y: number}
    /** Permission gate before opening. Default: always editable. */
    canEdit?: (sheetIdx: number, row: number, col: number, grid: Grid) => boolean
    /** Autocomplete / signature functions. Default: bundled built-ins. */
    formulaFunctions?: FormulaFunction[]
    /** Maps a reference index to a CSS color. Default: built-in palette. */
    getHighlightColor?: (index: number) => string
    /** Base editor config (merged over the in-cell defaults). */
    editorConfig?: FormulaEditorConfig
    /** Called when a committed formula fails validation. */
    onInvalidFormula?: () => void
    /** Reports whether an editor is open (so the canvas can avoid stealing focus). */
    onEditingChange?: (editing: boolean) => void
    /** Bumped after commits / selection moves so dependents re-read content. */
    onContentChanged?: () => void
}

export interface InlineCellEditorHandle {
    /** Call on every grid change/render: repositions the editor and repaints
     *  highlights (parks the editor off-screen if its cell scrolled away). */
    setGrid(grid: Grid | null): void
    isEditing(): boolean
    isEditingFormula(): boolean
    destroy(): void
}

interface EditCtx {
    sheetName: string
    /** Sheet the edited cell lives on (captured at edit start; independent of
     *  the view's current sheet, which may change while editing a formula). */
    sheetIdx: number
    row: number
    col: number
    position: {x: number; y: number; width: number; height: number}
}

const MEASURE_FONT = '13px Consolas, Monaco, "Courier New", monospace'

export function createInlineCellEditor(
    options: InlineCellEditorOptions
): InlineCellEditorHandle {
    const {
        container,
        eventSource,
        dataService,
        viewId,
        getViewSheetIdx,
        getSheetName,
        inputCell,
        setSelection,
        setViewSheet,
        coordinator,
        origin = {x: 32, y: 24},
        canEdit = () => true,
        formulaFunctions = builtinFormulaFunctions,
        getHighlightColor = getCellRefColor,
        editorConfig,
        onInvalidFormula,
        onEditingChange,
        onContentChanged,
    } = options

    let grid: Grid | null = options.grid ?? null
    let editing = false
    let ctx: EditCtx | null = null
    let editorHandle: FormulaEditorHandle | null = null
    let cellRefs: readonly FormulaCellRef[] = []
    let prevInsertion: {text: string; startPos: number} | null = null
    let inserting = false
    let editorText = ''
    let lastRef = ''
    // Whether this editor is currently registered with the coordinator as the
    // active formula edit (true only while in formula "point" mode).
    let registered = false

    let wrapperEl: HTMLDivElement | null = null
    const highlightEls: HTMLDivElement[] = []

    const source = createEngineFormulaSource(dataService, {
        formulaFunctions,
        onCellRefs: (refs) => {
            cellRefs = refs as readonly FormulaCellRef[]
            renderHighlights()
        },
    })

    function isEditingFormula(): boolean {
        return editing && editorText.trim().startsWith('=')
    }

    function focusCanvas() {
        const canvas = container.querySelector('canvas') as HTMLElement | null
        canvas?.focus({preventScroll: true})
    }

    function clearHighlights() {
        for (const el of highlightEls) el.remove()
        highlightEls.length = 0
    }

    function renderHighlights() {
        clearHighlights()
        if (!grid) return
        const rects = getReferenceHighlightRects(cellRefs, grid, getSheetName(), {
            originX: origin.x,
            originY: origin.y,
        })
        for (const r of rects) {
            const el = document.createElement('div')
            el.style.cssText = `position:absolute;pointer-events:none;opacity:0.3;z-index:0;left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px;background-color:${getHighlightColor(r.colorIndex)};`
            container.appendChild(el)
            highlightEls.push(el)
        }
    }

    function applyWrapperPosition() {
        if (!wrapperEl || !ctx) return
        wrapperEl.style.left = `${ctx.position.x}px`
        wrapperEl.style.top = `${ctx.position.y}px`
        wrapperEl.style.height = `${ctx.position.height}px`
    }

    function autoExpand(value: string) {
        if (!wrapperEl || !ctx) return
        const textWidth = measureText(value, MEASURE_FONT) + 20
        wrapperEl.style.width = `${Math.max(ctx.position.width, textWidth)}px`
    }

    function handleChange(value: string) {
        editorText = value
        autoExpand(value)
        // Manual typing clears the replace-tracking; a programmatic reference
        // insertion sets `inserting` first so this doesn't clear it.
        if (!inserting) prevInsertion = null
        inserting = false
        // Entering/leaving formula mode (toggling the leading `=`) flips
        // coordinator registration; also pushes live text to the reminder.
        updateFormulaRegistration()
    }

    function insertReference(ref: string) {
        if (!editorHandle) return
        const cursorPos = editorHandle.getCursorPosition()
        inserting = true
        if (prevInsertion) {
            editorHandle.replaceRange(
                prevInsertion.startPos,
                prevInsertion.startPos + prevInsertion.text.length,
                ref
            )
        } else {
            editorHandle.insertText(ref)
        }
        prevInsertion = {text: ref, startPos: prevInsertion?.startPos ?? cursorPos}
    }

    /**
     * Turn a selection made in `sourceSheetIdx` into a reference and insert it,
     * qualifying with the sheet name when it differs from the edited cell's
     * sheet (e.g. `Sheet2!A1`). Dedupes and replaces the previous insertion so
     * clicking around swaps a single ref rather than appending.
     */
    function applySelectionAsRef(sourceSheetIdx: number, data: SelectedData) {
        if (!ctx) return
        const body = getReferenceString(data)
        if (!body) return
        const ref =
            sourceSheetIdx === ctx.sheetIdx
                ? body
                : qualifyReference(
                      body,
                      dataService.getSheetNameByIdx(sourceSheetIdx)
                  )
        if (ref === lastRef) return
        lastRef = ref
        insertReference(ref)
    }

    // Identity handed to the coordinator so other views can feed refs to this
    // edit and the reminder can read its live target/text.
    const coordinatorEntry: FormulaEditEntry = {
        viewId,
        getEditSheetIdx: () => ctx?.sheetIdx ?? -1,
        getCellRef: () => {
            if (!ctx) return ''
            const body = getReferenceString(
                buildSelectedDataFromCell(ctx.row, ctx.col, 'none')
            )
            return qualifyReference(body, ctx.sheetName)
        },
        getText: () => editorText,
        insertExternalRef: (srcIdx, data) => applySelectionAsRef(srcIdx, data),
        focus: () => editorHandle?.focus(),
        commit: () => commitEdit(editorText, true),
        cancel: () => cancelEdit(),
    }

    /**
     * Register / unregister with the coordinator as formula "point" mode
     * toggles (text starts with `=`), and push live text while active.
     */
    function updateFormulaRegistration() {
        const nowFormula = isEditingFormula()
        if (nowFormula && !registered) {
            registered = true
            coordinator?.setActive(coordinatorEntry)
        } else if (!nowFormula && registered) {
            registered = false
            coordinator?.clear(coordinatorEntry)
        }
        if (registered) coordinator?.notifyChange?.(coordinatorEntry)
    }

    function teardownEditor() {
        editorHandle?.destroy()
        editorHandle = null
        wrapperEl?.remove()
        wrapperEl = null
    }

    function finishEditing() {
        if (registered) {
            registered = false
            coordinator?.clear(coordinatorEntry)
        }
        editing = false
        ctx = null
        cellRefs = []
        prevInsertion = null
        inserting = false
        editorText = ''
        lastRef = ''
        teardownEditor()
        clearHighlights()
        onEditingChange?.(false)
    }

    function startEditing(
        row: number,
        col: number,
        initialText: string,
        cursorPosition: 'start' | 'end' = 'end'
    ) {
        if (!grid) return
        const editSheetIdx = getViewSheetIdx()
        if (!canEdit(editSheetIdx, row, col, grid)) return
        if (editing) finishEditing()

        const position = getCellRect(grid, row, col, {
            originX: origin.x,
            originY: origin.y,
            defaultWidth: 100,
            defaultHeight: 25,
        })
        editorText = initialText
        ctx = {sheetName: getSheetName(), sheetIdx: editSheetIdx, row, col, position}
        editing = true
        onEditingChange?.(true)

        wrapperEl = document.createElement('div')
        // Explicit, opaque box so the in-cell editor clearly stands out over
        // the grid (white fill, defined border + shadow, above everything).
        wrapperEl.style.cssText =
            'position:absolute;display:flex;align-items:center;box-sizing:border-box;' +
            'z-index:1000;background:#fff;overflow:hidden;' +
            'border:1px solid #4a90d9;box-shadow:0 1px 4px rgba(0,0,0,0.18);'
        container.appendChild(wrapperEl)
        const inner = document.createElement('div')
        inner.style.width = '100%'
        inner.style.boxSizing = 'border-box'
        wrapperEl.appendChild(inner)
        applyWrapperPosition()
        autoExpand(initialText)

        editorHandle = createFormulaEditor(inner, {
            getDisplayUnits: source.getDisplayUnits,
            formulaFunctions: source.formulaFunctions,
            sheetName: ctx.sheetName,
            defaultValue: initialText,
            initialCursorPosition: cursorPosition,
            config: {
                fontSize: 12,
                lineHeight: 1.2,
                autoFocus: true,
                placeholder: '',
                showBorder: false,
                ...editorConfig,
            },
            style: {width: '100%', boxSizing: 'border-box'},
            onChange: handleChange,
            // While picking references for a formula (point mode), losing focus
            // — clicking a sheet tab, another view, the reminder — must NOT
            // commit (Excel behavior); only Enter / the reminder button do.
            // Plain-text edits still commit on blur.
            onBlur: (v) => {
                if (!isEditingFormula()) commitEdit(v, false)
            },
            onSubmit: (v) => commitEdit(v, true),
            onCancel: cancelEdit,
        })

        // The initial text may already be a formula (user typed `=` to start),
        // so register point mode immediately.
        updateFormulaRegistration()
    }

    async function commitEdit(value: string, restoreSelection = true) {
        if (!ctx) return
        const {row, col, sheetIdx: editSheetIdx} = ctx
        const newText = value.trim()
        if (newText.startsWith('=')) {
            const valid = await source.checkFormula(newText)
            if (!valid) {
                onInvalidFormula?.()
                return
            }
        }
        await inputCell(editSheetIdx, row, col, newText)
        if (restoreSelection) {
            // If the user built the formula from another sheet, return to the
            // edited cell's sheet before selecting it (Excel behavior).
            if (getViewSheetIdx() !== editSheetIdx) setViewSheet?.(editSheetIdx)
            setSelection(buildSelectedDataFromCell(row, col, 'none'))
        }
        finishEditing()
        onContentChanged?.()
        focusCanvas()
    }

    function cancelEdit() {
        finishEditing()
        focusCanvas()
    }

    // ---- Event wiring -----------------------------------------------------

    const onStartEdit = async (data: {
        row: number
        col: number
        initialText: string
    }) => {
        // Defer one microtask so the dblclick's 2nd mousedown doesn't blur the
        // freshly-opened editor (matches the app's prior behavior).
        await Promise.resolve()
        startEditing(data.row, data.col, data.initialText)
    }

    const onSelectionChange = (data: SelectedData) => {
        // This view owns the active formula edit: insert the ref, qualifying by
        // this view's CURRENT sheet (which may differ from the edited cell's).
        if (isEditingFormula()) {
            applySelectionAsRef(getViewSheetIdx(), data)
            return
        }
        // Another view owns an active formula edit and this view has nothing of
        // its own open: feed it the ref (cross-session point mode) while still
        // moving this view's own selection for visual feedback. Don't commit.
        if (!editing) {
            const active = coordinator?.getActive()
            if (active && active !== coordinatorEntry) {
                active.insertExternalRef(getViewSheetIdx(), data)
                setSelection(data)
                onContentChanged?.()
                return
            }
        }
        if (editing && ctx && data.data?.ty === 'cellRange') {
            const {startRow, startCol} = data.data.d
            if (startRow !== ctx.row || startCol !== ctx.col) {
                commitEdit(editorText, false)
            }
        }
        setSelection(data)
        onContentChanged?.()
    }

    const onInvalid = () => onInvalidFormula?.()

    eventSource.on('startEdit', onStartEdit)
    eventSource.on('selectionChange', onSelectionChange)
    eventSource.on('invalidFormula', onInvalid)

    return {
        setGrid(next: Grid | null) {
            grid = next
            if (editing && ctx && grid) {
                // Park the in-cell editor off-screen when the view is showing a
                // different sheet than the edited cell (its coordinates might
                // coincide with a real cell there) — the reminder is the cue —
                // or when the cell has scrolled out of the window.
                if (
                    getViewSheetIdx() !== ctx.sheetIdx ||
                    !isCellInGridWindow(grid, ctx.row, ctx.col)
                ) {
                    ctx.position.x = -9999
                    ctx.position.y = -9999
                } else {
                    const {x, y} = getCellRect(grid, ctx.row, ctx.col, {
                        originX: origin.x,
                        originY: origin.y,
                    })
                    ctx.position.x = x
                    ctx.position.y = y
                }
                applyWrapperPosition()
            }
            renderHighlights()
        },
        isEditing: () => editing,
        isEditingFormula,
        destroy() {
            eventSource.off('startEdit', onStartEdit)
            eventSource.off('selectionChange', onSelectionChange)
            eventSource.off('invalidFormula', onInvalid)
            finishEditing()
        },
    }
}
