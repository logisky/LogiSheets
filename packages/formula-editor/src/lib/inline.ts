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
    buildSelectedDataFromCell,
} from 'logisheets-engine'
import type {
    Grid,
    SelectedData,
    Session,
    FormulaCellRef,
} from 'logisheets-engine'

export interface InlineCellEditorOptions {
    /** Element the editor + highlight overlays mount into (the view's canvas
     *  container; also the positioning origin and refocus target). */
    container: HTMLElement
    /** Emits startEdit / selectionChange / invalidFormula for this view
     *  (an engine `Session`, or the `Engine` itself for the main view). */
    eventSource: Pick<Session, 'on' | 'off'>
    /** Engine data service — `getWorkbook()` + `checkFormula()`. */
    dataService: EngineFormulaServices
    /** This view's sheet index. */
    sheetIdx: number
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
        sheetIdx,
        getSheetName,
        inputCell,
        setSelection,
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

    function teardownEditor() {
        editorHandle?.destroy()
        editorHandle = null
        wrapperEl?.remove()
        wrapperEl = null
    }

    function finishEditing() {
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
        if (!canEdit(sheetIdx, row, col, grid)) return
        if (editing) finishEditing()

        const position = getCellRect(grid, row, col, {
            originX: origin.x,
            originY: origin.y,
            defaultWidth: 100,
            defaultHeight: 25,
        })
        editorText = initialText
        ctx = {sheetName: getSheetName(), row, col, position}
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
            onBlur: (v) => commitEdit(v, false),
            onSubmit: (v) => commitEdit(v, true),
            onCancel: cancelEdit,
        })
    }

    async function commitEdit(value: string, restoreSelection = true) {
        if (!ctx) return
        const newText = value.trim()
        if (newText.startsWith('=')) {
            const valid = await source.checkFormula(newText)
            if (!valid) {
                onInvalidFormula?.()
                return
            }
        }
        const {row, col} = ctx
        await inputCell(sheetIdx, row, col, newText)
        if (restoreSelection) {
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
        if (isEditingFormula()) {
            const newRef = getReferenceString(data)
            if (newRef && newRef !== lastRef) {
                lastRef = newRef
                insertReference(newRef)
            }
            return
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
                if (!isCellInGridWindow(grid, ctx.row, ctx.col)) {
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
