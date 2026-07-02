// data-gateway authoring UI — the browser face of the craft.
//
// Runs inside the craft iframe. The host injects `window.selection`,
// `window.workbook`, `window.getCraftState` / `window.setCraftState` and
// `window.notifyCraft` (see the app's craft-panel). The flow is
// selection-driven: pick a cell/range in the sheet, then press a button to
//
//   * mark the block it sits in as request-writable (input) / readable (output),
//   * attach a validation formula to the selected cell.
//
// The current declaration is always shown below the actions, and every item is
// removable. Each edit is written straight back to the workbook's AppData via
// `setCraftState`, so it round-trips with the .xlsx and the headless runtime
// (src/runtime.ts) reads the same schema on load.

import {getFirstCell, isErrorMessage, toA1notation} from 'logisheets-web'
import type {
    BlockInfo,
    CellId,
    SelectedData,
    SheetCellId,
    ErrorMessage,
    FormulaDisplayInfo,
} from 'logisheets-web'
import {
    createFormulaEditor,
    builtinFormulaFunctions,
    type FormulaEditorHandle,
    type FormulaDisplayInfo as EditorDisplayInfo,
} from 'logisheets-formula-editor/core'
import {
    parseState,
    serializeState,
    validationKey,
    cellIdKey,
    type DataGatewayState,
    type ValidationEntry,
} from './state'

/** Loose shape of the host-injected workbook (browser client — sync calls). */
interface UiWorkbook {
    getAllBlocks(params?: {
        sheetIdx?: number
        sheetId?: number
    }): readonly BlockInfo[] | ErrorMessage
    getCellId(params: {
        sheetIdx: number
        rowIdx: number
        colIdx: number
    }): SheetCellId | ErrorMessage
    getDisplayUnitsOfFormula(f: string): FormulaDisplayInfo | ErrorMessage
}

/** The subset of the injected iframe globals this UI depends on. */
export interface GatewayWindow {
    selection?: {sheetIdx: number; data?: SelectedData}
    workbook?: UiWorkbook
    getCraftState?: () => string | undefined
    setCraftState?: (json: string) => void
    notifyCraft?: (
        level: 'error' | 'warn' | 'info' | 'success',
        msg: string
    ) => void
    /**
     * Subscribe to sheet-selection changes (host-pushed). Returns a disposer.
     * Absent on older hosts, in which case the UI just resolves the selection
     * once at mount.
     */
    onSelectionChange?: (
        cb: (s: {sheetIdx: number; data?: SelectedData}) => void
    ) => () => void
}

/** What the current sheet selection resolves to, for the action buttons. */
interface SelectionInfo {
    sheetIdx: number
    row: number
    col: number
    /** refName of the block the selection sits in, if any. */
    block?: string
}

/**
 * Mount the whole UI into `root`, reading its live state from the host globals
 * on `win`. Persists itself as the user edits; polls `window.selection` so the
 * action buttons enable/disable as the sheet selection changes.
 */
export function mount(root: HTMLElement, win: GatewayWindow): void {
    let state = parseState(win.getCraftState?.())

    const persist = () => win.setCraftState?.(serializeState(state))
    const notify = (
        level: 'error' | 'warn' | 'info' | 'success',
        msg: string
    ) => {
        try {
            win.notifyCraft?.(level, msg)
        } catch {
            /* host channel is best-effort */
        }
    }

    root.innerHTML = ''
    root.appendChild(styleEl())

    // ---- Selection + actions -----------------------------------------
    const selSection = section('Selection')
    const selLabel = document.createElement('div')
    selLabel.className = 'dg-sel-label'
    selSection.body.appendChild(selLabel)

    const setInputBtn = button('Set block as input', () => {
        if (!current?.block) return
        state = withBlock(state, 'inputBlocks', current.block, true)
        persist()
        renderState()
        notify('success', `Block "${current.block}" is now an input.`)
    })
    const setOutputBtn = button('Set block as output', () => {
        if (!current?.block) return
        state = withBlock(state, 'outputBlocks', current.block, true)
        persist()
        renderState()
        notify('success', `Block "${current.block}" is now an output.`)
    })
    const blockActions = document.createElement('div')
    blockActions.className = 'dg-actions'
    blockActions.appendChild(setInputBtn)
    blockActions.appendChild(setOutputBtn)
    selSection.body.appendChild(blockActions)

    // A CodeMirror-backed formula editor (autocomplete + signature help +
    // cell-ref highlighting), the same one the app uses. `#PLACEHOLDER`
    // self-references the target cell — the way to write a rule that survives
    // row/col edits. Created once; never rebuilt on re-render.
    const editorHost = document.createElement('div')
    editorHost.className = 'dg-editor'
    const editor: FormulaEditorHandle = createFormulaEditor(editorHost, {
        defaultValue: '',
        formulaFunctions: builtinFormulaFunctions,
        getDisplayUnits: (formula: string) => getDisplayUnits(win, formula),
        config: {
            placeholder: 'e.g. #PLACEHOLDER>0',
            showBorder: true,
            fontSize: 13,
        },
    })

    const addValidationBtn = button('Add validation to cell', () => {
        const formula = stripLeadingEquals(editor.getValue())
        if (!formula) {
            notify('warn', 'Enter a validation formula first.')
            return
        }
        const target = selectedCellId(win)
        if (!target) {
            notify('warn', 'Select a cell to attach the rule to.')
            return
        }
        state = withValidation(state, {
            sheetId: target.sheetId,
            cellId: target.cellId,
            formula,
        })
        persist()
        editor.setValue('')
        renderState()
        notify('success', 'Validation rule added.')
    })

    const valActions = document.createElement('div')
    valActions.className = 'dg-adder'
    valActions.appendChild(editorHost)
    valActions.appendChild(addValidationBtn)
    selSection.body.appendChild(valActions)
    root.appendChild(selSection.wrapper)

    // ---- Current declaration (state) ---------------------------------
    const inputsSection = section('Input blocks')
    const outputsSection = section('Output blocks')
    const validationsSection = section('Validation rules')
    root.appendChild(inputsSection.wrapper)
    root.appendChild(outputsSection.wrapper)
    root.appendChild(validationsSection.wrapper)

    const renderState = () => {
        renderBlockList(inputsSection.body, state.inputBlocks, (refName) => {
            state = withBlock(state, 'inputBlocks', refName, false)
            persist()
            renderState()
        })
        renderBlockList(outputsSection.body, state.outputBlocks, (refName) => {
            state = withBlock(state, 'outputBlocks', refName, false)
            persist()
            renderState()
        })
        renderValidationList(validationsSection.body, state.validations, (v) => {
            state = withoutValidation(state, v.sheetId, v.cellId)
            persist()
            renderState()
        })
    }

    // ---- Live selection tracking -------------------------------------
    let current: SelectionInfo | undefined
    const updateSelection = () => {
        current = currentSelection(win)
        if (!current) {
            selLabel.textContent = 'No cell selected — click a cell in the sheet.'
            setInputBtn.disabled = true
            setOutputBtn.disabled = true
            addValidationBtn.disabled = true
            return
        }
        const a1 = `${toA1notation(current.col)}${current.row + 1}`
        selLabel.textContent = current.block
            ? `Sheet ${current.sheetIdx} · ${a1} · block "${current.block}"`
            : `Sheet ${current.sheetIdx} · ${a1} · (not in a block)`
        // Block actions need a block; validation only needs a cell.
        setInputBtn.disabled = !current.block
        setOutputBtn.disabled = !current.block
        addValidationBtn.disabled = false
    }

    renderState()
    updateSelection()

    // React to selection changes via the host push channel (no polling). If
    // the host doesn't provide it, the label just reflects the mount-time
    // selection.
    win.onSelectionChange?.(() => updateSelection())
}

// ---- state transitions (pure) -----------------------------------------

function withBlock(
    state: DataGatewayState,
    field: 'inputBlocks' | 'outputBlocks',
    refName: string,
    on: boolean
): DataGatewayState {
    const has = state[field].includes(refName)
    if (on === has) return state
    const next = on
        ? [...state[field], refName]
        : state[field].filter((r) => r !== refName)
    return {...state, [field]: next}
}

function withValidation(
    state: DataGatewayState,
    entry: ValidationEntry
): DataGatewayState {
    const key = validationKey(entry.sheetId, entry.cellId)
    const rest = state.validations.filter(
        (v) => validationKey(v.sheetId, v.cellId) !== key
    )
    return {...state, validations: [...rest, entry]}
}

function withoutValidation(
    state: DataGatewayState,
    sheetId: number,
    cellId: CellId
): DataGatewayState {
    const key = validationKey(sheetId, cellId)
    return {
        ...state,
        validations: state.validations.filter(
            (v) => validationKey(v.sheetId, v.cellId) !== key
        ),
    }
}

// ---- host reads -------------------------------------------------------

/** The current selection's first cell + the block it sits in, if resolvable. */
function currentSelection(win: GatewayWindow): SelectionInfo | undefined {
    const sel = win.selection
    if (!sel?.data?.data) return undefined
    let cell
    try {
        cell = getFirstCell(sel.data)
    } catch {
        return undefined
    }
    const info: SelectionInfo = {
        sheetIdx: sel.sheetIdx,
        row: cell.y,
        col: cell.x,
    }
    info.block = blockAt(win, sel.sheetIdx, cell.y, cell.x)
    return info
}

/** refName of the named block covering (row, col) on a sheet, if any. */
function blockAt(
    win: GatewayWindow,
    sheetIdx: number,
    row: number,
    col: number
): string | undefined {
    const wb = win.workbook
    if (!wb) return undefined
    const res = wb.getAllBlocks({sheetIdx})
    if (isErrorMessage(res)) return undefined
    for (const b of res) {
        const refName = b.schema?.name
        if (!refName) continue
        if (
            row >= b.rowStart &&
            row < b.rowStart + b.rowCnt &&
            col >= b.colStart &&
            col < b.colStart + b.colCnt
        ) {
            return refName
        }
    }
    return undefined
}

function selectedCellId(win: GatewayWindow): SheetCellId | undefined {
    const sel = win.selection
    const wb = win.workbook
    if (!sel?.data?.data || !wb) return undefined
    let cell
    try {
        cell = getFirstCell(sel.data)
    } catch {
        return undefined
    }
    const res = wb.getCellId({
        sheetIdx: sel.sheetIdx,
        rowIdx: cell.y,
        colIdx: cell.x,
    })
    if (isErrorMessage(res)) return undefined
    return res
}

function describeCell(sheetId: number, cellId: CellId): string {
    return `sheet#${sheetId}/${cellIdKey(cellId)}`
}

// Bridge the host workbook's synchronous `getDisplayUnitsOfFormula` into the
// async shape the formula editor expects (it fetches token/cell-ref info from
// the host on every keystroke). Returns undefined for a non-formula / error so
// the editor just skips highlighting rather than throwing.
async function getDisplayUnits(
    win: GatewayWindow,
    formula: string
): Promise<EditorDisplayInfo | undefined> {
    const wb = win.workbook
    if (!wb) return undefined
    const res = wb.getDisplayUnitsOfFormula(formula)
    if (isErrorMessage(res)) return undefined
    return res as unknown as EditorDisplayInfo
}

function stripLeadingEquals(v: string): string {
    const t = v.trim()
    return t.startsWith('=') ? t.slice(1).trim() : t
}

// ---- state-display renderers ------------------------------------------

function renderBlockList(
    body: HTMLElement,
    refNames: readonly string[],
    onRemove: (refName: string) => void
): void {
    body.innerHTML = ''
    if (refNames.length === 0) {
        body.appendChild(hint('None yet.'))
        return
    }
    for (const refName of refNames) {
        const row = document.createElement('div')
        row.className = 'dg-row'
        const name = document.createElement('span')
        name.className = 'dg-refname'
        name.textContent = refName
        row.appendChild(name)
        row.appendChild(removeButton(() => onRemove(refName)))
        body.appendChild(row)
    }
}

function renderValidationList(
    body: HTMLElement,
    validations: readonly ValidationEntry[],
    onRemove: (v: ValidationEntry) => void
): void {
    body.innerHTML = ''
    if (validations.length === 0) {
        body.appendChild(hint('None yet.'))
        return
    }
    for (const v of validations) {
        const row = document.createElement('div')
        row.className = 'dg-row'
        const label = document.createElement('span')
        label.className = 'dg-vlabel'
        label.textContent = `${describeCell(v.sheetId, v.cellId)} · ${v.formula}`
        row.appendChild(label)
        row.appendChild(removeButton(() => onRemove(v)))
        body.appendChild(row)
    }
}

// ---- tiny DOM helpers -------------------------------------------------

function section(title: string): {wrapper: HTMLElement; body: HTMLElement} {
    const wrapper = document.createElement('section')
    wrapper.className = 'dg-section'
    const h = document.createElement('h2')
    h.textContent = title
    const body = document.createElement('div')
    body.className = 'dg-body'
    wrapper.appendChild(h)
    wrapper.appendChild(body)
    return {wrapper, body}
}

function button(label: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'dg-btn'
    b.textContent = label
    b.addEventListener('click', onClick)
    return b
}

function removeButton(onClick: () => void): HTMLButtonElement {
    const b = button('✕', onClick)
    b.classList.add('dg-danger')
    b.title = 'Remove'
    return b
}

function hint(text: string): HTMLElement {
    const p = document.createElement('p')
    p.className = 'dg-hint'
    p.textContent = text
    return p
}

function styleEl(): HTMLStyleElement {
    const s = document.createElement('style')
    s.textContent = `
        .dg-section { margin-bottom: 18px; }
        .dg-section h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; margin: 0 0 8px; color: #6b7280; }
        .dg-body { display: flex; flex-direction: column; gap: 6px; }
        .dg-sel-label { font-size: 13px; color: #111827; padding: 6px 8px; background: #eef2ff; border: 1px solid #e0e7ff; border-radius: 6px; }
        .dg-actions { display: flex; gap: 6px; }
        .dg-actions .dg-btn { flex: 1; }
        .dg-row {
            display: flex; align-items: center; gap: 10px;
            padding: 6px 8px; background: #fff; border: 1px solid #e5e7eb;
            border-radius: 6px;
        }
        .dg-refname { font-weight: 600; flex: 1; word-break: break-all; }
        .dg-vlabel { flex: 1; font-family: ui-monospace, monospace; font-size: 12px; word-break: break-all; }
        .dg-btn {
            cursor: pointer; border: 1px solid #2563eb; background: #2563eb;
            color: #fff; border-radius: 6px; padding: 6px 10px; font-size: 13px;
        }
        .dg-btn:disabled { cursor: not-allowed; opacity: .45; }
        .dg-btn.dg-danger { background: #fff; color: #dc2626; border-color: #f3d4d4; padding: 2px 8px; }
        .dg-adder { display: flex; gap: 6px; align-items: flex-start; }
        .dg-editor { flex: 1; min-width: 0; background: #fff; border-radius: 6px; }
        .dg-hint { color: #9ca3af; font-size: 12px; margin: 2px 0; }
    `
    return s
}
