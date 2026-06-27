/**
 * createFormulaEditor — the framework-agnostic core of the formula editor.
 *
 * This is plain CodeMirror 6 + DOM; it has NO dependency on React (or any
 * framework). Use it directly from vanilla JS / Vue / Svelte / Angular the
 * same way you mount `logisheets-engine`:
 *
 *   const editor = createFormulaEditor(el, { getDisplayUnits, ... })
 *   editor.setValue('=SUM(A1:B2)'); editor.focus()
 *   // ...later
 *   editor.destroy()
 *
 * The React `<FormulaEditor>` component is a thin wrapper over this.
 *
 * IMPORTANT: this editor does NOT tokenize formulas itself — it calls
 * `getDisplayUnits` to fetch token info from the host (e.g. the engine).
 */

import {EditorState, StateEffect, StateField} from '@codemirror/state'
import {
    EditorView,
    Decoration,
    DecorationSet,
    ViewUpdate,
    keymap,
    placeholder as placeholderExt,
    showTooltip,
    Tooltip,
} from '@codemirror/view'
import {
    autocompletion,
    CompletionContext,
    CompletionResult,
    Completion,
    acceptCompletion,
    completionStatus,
} from '@codemirror/autocomplete'
import {defaultKeymap, history, historyKeymap} from '@codemirror/commands'
import type {
    FormulaDisplayInfo,
    FormulaEditorConfig,
    FormulaFunction,
    GetDisplayUnitsFunc,
} from './types'
import {getCellRefColor} from './types'
import {isFormula, fuzzyMatch} from './utils'

/**
 * Build a lookup that translates a UTF-8 byte offset into `text` to the
 * corresponding UTF-16 code-unit (JS string) offset.
 *
 * Backend lexer (pest) emits token spans as byte offsets — fine for
 * ASCII, broken for any multi-byte content (CJK is 3 bytes, emoji is
 * 4). CodeMirror positions are UTF-16 code units. Applying byte offsets
 * directly to a JS string causes `Position N is out of range for
 * changeset of length M` errors as soon as the formula contains a
 * non-ASCII character.
 */
function makeByteToCharIdx(text: string): (byteIdx: number) => number {
    const starts: number[] = []
    const utf16s: number[] = []
    let byte = 0
    for (let i = 0; i < text.length; ) {
        const code = text.codePointAt(i)!
        starts.push(byte)
        utf16s.push(i)
        const utf16Len = code > 0xffff ? 2 : 1
        const utf8Len =
            code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4
        byte += utf8Len
        i += utf16Len
    }
    starts.push(byte)
    utf16s.push(text.length)

    return (b: number) => {
        if (b <= 0) return 0
        if (b >= byte) return text.length
        for (let k = 0; k < starts.length; k++) {
            if (starts[k] === b) return utf16s[k]
            if (starts[k] > b) return utf16s[k - 1]
        }
        return text.length
    }
}

// Default config values
const DEFAULT_CONFIG: Required<FormulaEditorConfig> = {
    fontSize: 14,
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    lineHeight: 1.4,
    textAlign: 'left',
    wordWrap: false,
    placeholder: 'Enter a formula...',
    readOnly: false,
    autoFocus: false,
    showBorder: true,
}

// State effect for updating decorations from backend
const setTokenDecorations = StateEffect.define<DecorationSet>()

// Effect to update stored token units
const setStoredTokenUnits =
    StateEffect.define<
        readonly {tokenType: string; start: number; end: number}[]
    >()

// StateField to store token units for signature hints
const storedTokenUnitsField = StateField.define<
    readonly {tokenType: string; start: number; end: number}[]
>({
    create: () => [],
    update(tokenUnits, tr) {
        for (const effect of tr.effects) {
            if (effect.is(setStoredTokenUnits)) {
                return effect.value
            }
        }
        return tokenUnits
    },
})

// State field to hold token decorations
const tokenDecorationsField = StateField.define<DecorationSet>({
    create() {
        return Decoration.none
    },
    update(decorations, tr) {
        for (const effect of tr.effects) {
            if (effect.is(setTokenDecorations)) {
                return effect.value
            }
        }
        return decorations.map(tr.changes)
    },
    provide: (field) => EditorView.decorations.from(field),
})

/**
 * Get function context from tokenUnits (from backend).
 * Returns the function name and current argument index if inside a function call.
 */
function getFunctionContextFromTokens(
    text: string,
    tokenUnits: readonly {tokenType: string; start: number; end: number}[],
    cursorPos: number
): {funcName: string; argIndex: number} | null {
    if (cursorPos === 0 || tokenUnits.length === 0) return null

    const offset = 1 // Account for leading '='

    const funcNamePositions: {start: number; end: number; name: string}[] = []
    for (const unit of tokenUnits) {
        if (unit.tokenType === 'funcName') {
            const start = unit.start + offset
            const end = unit.end + offset
            funcNamePositions.push({start, end, name: text.slice(start, end)})
        }
    }

    const funcStack: {name: string; argIdx: number}[] = []
    let pendingFuncName = ''

    for (let i = 0; i < text.length && i < cursorPos; i++) {
        const char = text[i]

        for (const fn of funcNamePositions) {
            if (fn.start === i) {
                pendingFuncName = fn.name
                break
            }
        }

        if (char === '(') {
            if (pendingFuncName) {
                funcStack.push({name: pendingFuncName, argIdx: 0})
                pendingFuncName = ''
            } else {
                funcStack.push({name: '', argIdx: -1})
            }
        } else if (char === ')') {
            if (funcStack.length > 0) {
                funcStack.pop()
            }
        } else if (char === ',' && funcStack.length > 0) {
            if (funcStack[funcStack.length - 1].argIdx >= 0) {
                funcStack[funcStack.length - 1].argIdx++
            }
        }
    }

    for (let i = funcStack.length - 1; i >= 0; i--) {
        if (funcStack[i].name && funcStack[i].argIdx >= 0) {
            return {
                funcName: funcStack[i].name.toUpperCase(),
                argIndex: funcStack[i].argIdx,
            }
        }
    }

    return null
}

/**
 * Create function signature tooltip content.
 */
function createSignatureTooltip(
    func: FormulaFunction,
    argIndex: number
): HTMLElement {
    const dom = document.createElement('div')
    dom.className = 'cm-signature-tooltip'
    dom.style.cssText =
        'padding: 6px 10px; background: #fff; border: 1px solid #ddd; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); font-size: 13px; max-width: 400px;'

    const paramStrs: string[] = []
    let targetParamIndex = argIndex < 0 ? 0 : argIndex
    const minParamCount = 3
    if (targetParamIndex < minParamCount) targetParamIndex = minParamCount

    let tmp = 0
    for (let j = 0; j < func.args.length; j++) {
        const arg = func.args[j]
        if (tmp > targetParamIndex) break
        paramStrs.push(arg.argName)
        tmp++
        if (!arg.startRepeated) continue
        let repeatCount = 1
        while (tmp <= targetParamIndex) {
            paramStrs.push(`${arg.argName}${repeatCount}`)
            repeatCount++
            tmp++
        }
        paramStrs.push('...')
    }

    const sigLine = document.createElement('div')
    sigLine.style.cssText = 'margin-bottom: 4px; font-family: monospace;'

    const funcNameSpan = document.createElement('span')
    funcNameSpan.style.cssText = 'color: #0066cc; font-weight: bold;'
    funcNameSpan.textContent = func.name
    sigLine.appendChild(funcNameSpan)

    const parenOpen = document.createElement('span')
    parenOpen.textContent = '('
    sigLine.appendChild(parenOpen)

    const actualArgIndex = argIndex < 0 ? 0 : argIndex
    paramStrs.forEach((paramStr, i) => {
        if (i > 0) {
            const comma = document.createElement('span')
            comma.textContent = ', '
            sigLine.appendChild(comma)
        }

        const argSpan = document.createElement('span')
        argSpan.textContent = paramStr
        if (i === actualArgIndex) {
            argSpan.style.cssText =
                'background: #e3f2fd; padding: 1px 4px; border-radius: 3px; font-weight: bold;'
        }
        sigLine.appendChild(argSpan)
    })

    const parenClose = document.createElement('span')
    parenClose.textContent = ')'
    sigLine.appendChild(parenClose)

    dom.appendChild(sigLine)

    const currentArg = func.args[Math.min(actualArgIndex, func.args.length - 1)]
    if (currentArg && currentArg.description) {
        const descLine = document.createElement('div')
        descLine.style.cssText =
            'color: #666; font-size: 12px; border-top: 1px solid #eee; padding-top: 4px; margin-top: 4px;'
        descLine.textContent = `${currentArg.argName}: ${currentArg.description}`
        dom.appendChild(descLine)
    }

    return dom
}

// CSS class decorations for different token types
const tokenStyles = {
    funcName: Decoration.mark({class: 'cm-formula-func'}),
    cellReference: (colorIndex: number) =>
        Decoration.mark({
            class: 'cm-formula-cellref',
            attributes: {
                style: `background-color: ${getCellRefColor(colorIndex)}`,
            },
        }),
    errorConstant: Decoration.mark({class: 'cm-formula-error'}),
    wrongSuffix: Decoration.mark({class: 'cm-formula-wrong'}),
}

// Helper to check if cell reference is local
function isLocalCellRef(
    cellRef: {workbook?: string; sheet1?: string; sheet2?: string},
    currentSheet: string
): boolean {
    if (cellRef.workbook !== undefined) return false
    if (cellRef.sheet1 !== undefined && cellRef.sheet2 !== undefined)
        return false
    if (cellRef.sheet1 !== undefined && cellRef.sheet1 !== currentSheet)
        return false
    return true
}

/**
 * Build CodeMirror decorations from FormulaDisplayInfo. Converts the backend's
 * UTF-8 byte offsets to UTF-16 indices before handing them to CodeMirror.
 */
function buildDecorations(
    displayInfo: FormulaDisplayInfo,
    currentSheet: string,
    formulaBody: string
): DecorationSet {
    const decorations: {from: number; to: number; decoration: Decoration}[] = []
    const offset = 1 // Account for leading '='
    let cellRefIndex = 0

    const byteToCharIdx = makeByteToCharIdx(formulaBody)

    for (const token of displayInfo.tokenUnits) {
        const from = byteToCharIdx(token.start) + offset
        const to = byteToCharIdx(token.end) + offset

        switch (token.tokenType) {
            case 'funcName':
                decorations.push({from, to, decoration: tokenStyles.funcName})
                break
            case 'cellReference': {
                const cellRef = displayInfo.cellRefs[cellRefIndex]
                if (cellRef && isLocalCellRef(cellRef, currentSheet)) {
                    decorations.push({
                        from,
                        to,
                        decoration: tokenStyles.cellReference(cellRefIndex),
                    })
                }
                cellRefIndex++
                break
            }
            case 'errorConstant':
                decorations.push({
                    from,
                    to,
                    decoration: tokenStyles.errorConstant,
                })
                break
            case 'wrongSuffix':
                decorations.push({
                    from,
                    to,
                    decoration: tokenStyles.wrongSuffix,
                })
                break
        }
    }

    decorations.sort((a, b) => a.from - b.from)
    return Decoration.set(
        decorations.map((d) => d.decoration.range(d.from, d.to))
    )
}

/**
 * Options for {@link createFormulaEditor}. These mirror the React component's
 * props minus the React-only bits — the React `style` prop maps to `style`
 * here (applied to the host element).
 */
export interface FormulaEditorOptions {
    /** Initial value (with leading '='). */
    value?: string
    /** Initial value when `value` is not given. */
    defaultValue?: string
    /** Where to place the cursor on creation (default: 'end'). */
    initialCursorPosition?: 'start' | 'end'
    onChange?: (value: string) => void
    onBlur?: (value: string) => void
    onSubmit?: (value: string) => void
    onCancel?: () => void
    /** Fetch token / cell-ref info from the host (required). */
    getDisplayUnits: GetDisplayUnitsFunc
    /** Functions offered by autocomplete + signature help. */
    formulaFunctions?: FormulaFunction[]
    /** Current sheet name (for local cell-ref coloring). */
    sheetName?: string
    config?: FormulaEditorConfig
    /** Extra class(es) added to the host element. */
    className?: string
    /** Extra inline styles merged onto the host element. */
    style?: Partial<CSSStyleDeclaration>
}

/** Imperative handle returned by {@link createFormulaEditor}. */
export interface FormulaEditorHandle {
    focus(): void
    blur(): void
    getValue(): string
    setValue(value: string): void
    /** Insert text at the current cursor position. */
    insertText(text: string): void
    /** Replace a range — useful for swapping a previously-inserted ref. */
    replaceRange(from: number, to: number, text: string): void
    getCursorPosition(): number
    getView(): EditorView | null
    /**
     * Update live options without recreating the editor. Callback / function-
     * list / sheet-name changes apply immediately; a changed `config` rebuilds
     * the view (preserving text + cursor); a changed controlled `value` is
     * dispatched into the document.
     */
    updateOptions(opts: Partial<FormulaEditorOptions>): void
    destroy(): void
}

const CONFIG_KEYS: (keyof FormulaEditorConfig)[] = [
    'fontSize',
    'fontFamily',
    'lineHeight',
    'textAlign',
    'wordWrap',
    'placeholder',
    'readOnly',
    'autoFocus',
    'showBorder',
]

/**
 * Create a formula editor mounted into `parent`. Returns an imperative handle;
 * call `destroy()` when done.
 */
export function createFormulaEditor(
    parent: HTMLElement,
    options: FormulaEditorOptions
): FormulaEditorHandle {
    // Live options read by CodeMirror callbacks. Mutated by updateOptions so
    // the running view always sees current values without a rebuild.
    const live = {
        onChange: options.onChange,
        onBlur: options.onBlur,
        onSubmit: options.onSubmit,
        onCancel: options.onCancel,
        getDisplayUnits: options.getDisplayUnits,
        formulaFunctions: options.formulaFunctions ?? [],
        sheetName: options.sheetName ?? '',
    }
    let config: Required<FormulaEditorConfig> = {
        ...DEFAULT_CONFIG,
        ...options.config,
    }
    let controlledValue = options.value
    const initialCursorPosition = options.initialCursorPosition ?? 'end'

    let view: EditorView | null = null
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let blurHandler: (() => void) | null = null

    function applyHostStyle() {
        parent.classList.add('formula-editor')
        if (options.className) {
            for (const c of options.className.split(/\s+/).filter(Boolean)) {
                parent.classList.add(c)
            }
        }
        parent.style.minHeight = `${config.fontSize * config.lineHeight + 8}px`
        if (config.showBorder) {
            parent.style.border = '1px solid #e0e0e0'
            parent.style.borderRadius = '4px'
        } else {
            parent.style.border = ''
            parent.style.borderRadius = ''
        }
        if (options.style) Object.assign(parent.style, options.style)
    }

    async function updateDecorations(v: EditorView) {
        const text = v.state.doc.toString()
        if (!isFormula(text)) {
            v.dispatch({
                effects: [
                    setTokenDecorations.of(Decoration.none),
                    setStoredTokenUnits.of([]),
                ],
            })
            return
        }
        try {
            const formula = text.startsWith('=') ? text.slice(1) : text
            const displayInfo = await live.getDisplayUnits(formula)
            if (!displayInfo) {
                v.dispatch({
                    effects: [
                        setTokenDecorations.of(Decoration.none),
                        setStoredTokenUnits.of([]),
                    ],
                })
                return
            }
            const decorations = buildDecorations(
                displayInfo,
                live.sheetName,
                formula
            )
            v.dispatch({
                effects: [
                    setTokenDecorations.of(decorations),
                    setStoredTokenUnits.of(displayInfo.tokenUnits),
                ],
            })
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to fetch display units:', error)
        }
    }

    async function formulaCompletion(
        context: CompletionContext
    ): Promise<CompletionResult | null> {
        const text = context.state.doc.toString()
        if (!isFormula(text)) return null

        const word = context.matchBefore(/[A-Za-z_][A-Za-z0-9_]*/)
        if (!word) return null

        const query = word.text
        const functions = live.formulaFunctions
        const completions: Completion[] = []

        for (const func of functions) {
            const match = fuzzyMatch(query, func.name)
            if (match.matched) {
                completions.push({
                    label: func.name,
                    type: 'function',
                    detail: '()',
                    info: func.description,
                    apply: (v, _completion, from, to) => {
                        const insertText = `${func.name}()`
                        v.dispatch({
                            changes: {from, to, insert: insertText},
                            selection: {anchor: from + func.name.length + 1},
                        })
                    },
                    boost: match.indices.length,
                })
            }
        }

        if (completions.length === 0) return null

        return {
            from: word.from,
            options: completions,
            validFor: /^[A-Za-z_][A-Za-z0-9_]*$/,
        }
    }

    function buildExtensions() {
        const bracketPairs: Record<string, string> = {
            '(': ')',
            '[': ']',
            '{': '}',
            '"': '"',
            "'": "'",
        }

        const updateListener = EditorView.updateListener.of(
            (update: ViewUpdate) => {
                if (update.docChanged) {
                    const newValue = update.state.doc.toString()
                    live.onChange?.(newValue)
                    if (debounceTimer) clearTimeout(debounceTimer)
                    debounceTimer = setTimeout(() => {
                        updateDecorations(update.view)
                    }, 100)
                }
            }
        )

        const customKeymap = keymap.of([
            {
                key: 'Backspace',
                run: (v) => {
                    const {state} = v
                    const {from, to} = state.selection.main
                    if (from !== to) return false
                    if (from === 0) return false
                    const doc = state.doc.toString()
                    const charBefore = doc[from - 1]
                    const charAfter = doc[from]
                    if (
                        bracketPairs[charBefore] &&
                        charAfter === bracketPairs[charBefore]
                    ) {
                        v.dispatch({
                            changes: {from: from - 1, to: from + 1},
                            selection: {anchor: from - 1},
                        })
                        return true
                    }
                    return false
                },
            },
            {
                key: 'Tab',
                run: (v) => {
                    if (completionStatus(v.state) === 'active') {
                        return acceptCompletion(v)
                    }
                    return false
                },
            },
            {
                key: 'Enter',
                run: (v) => {
                    if (completionStatus(v.state) === 'active') {
                        return acceptCompletion(v)
                    }
                    live.onSubmit?.(v.state.doc.toString())
                    return true
                },
            },
            {
                key: 'Escape',
                run: () => {
                    live.onCancel?.()
                    return true
                },
            },
            {
                key: 'Alt-Enter',
                run: (v) => {
                    v.dispatch(v.state.replaceSelection('\n'), {
                        scrollIntoView: true,
                    })
                    return true
                },
            },
        ])

        const theme = EditorView.theme({
            '&': {
                fontSize: `${config.fontSize}px`,
                fontFamily: config.fontFamily,
            },
            '.cm-scroller': {
                overflow: 'auto',
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(0,0,0,0.2) transparent',
            },
            '.cm-scroller::-webkit-scrollbar': {
                width: '4px',
                height: '4px',
            },
            '.cm-scroller::-webkit-scrollbar-track': {
                background: 'transparent',
            },
            '.cm-scroller::-webkit-scrollbar-thumb': {
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '2px',
            },
            '.cm-scroller::-webkit-scrollbar-thumb:hover': {
                background: 'rgba(0,0,0,0.3)',
            },
            '.cm-content': {
                padding: '4px',
                lineHeight: String(config.lineHeight),
                textAlign: config.textAlign,
                outline: 'none',
            },
            '.cm-line': {
                padding: '0',
            },
            '&.cm-editor.cm-focused': {
                outline: 'none',
            },
            '&.cm-editor': {
                outline: 'none',
            },
            '.cm-formula-func': {
                fontWeight: 'bold',
                color: '#0066cc',
            },
            '.cm-formula-cellref': {
                borderRadius: '3px',
                padding: '0 2px',
            },
            '.cm-formula-error': {
                color: '#cc0000',
            },
            '.cm-formula-wrong': {
                color: '#ff6b6b',
                textDecoration: 'wavy underline #ff6b6b',
            },
            '.cm-tooltip.cm-tooltip-autocomplete': {
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            },
            '.cm-tooltip.cm-tooltip-autocomplete ul': {
                fontFamily: config.fontFamily,
                fontSize: `${config.fontSize - 1}px`,
            },
            '.cm-tooltip.cm-tooltip-autocomplete li': {
                padding: '4px 8px',
            },
            '.cm-tooltip.cm-tooltip-autocomplete li[aria-selected]': {
                backgroundColor: '#e3f2fd',
            },
            '.cm-completionLabel': {
                fontWeight: '500',
            },
            '.cm-completionDetail': {
                marginLeft: '4px',
                color: '#666',
            },
        })

        const extensions = [
            history(),
            tokenDecorationsField,
            storedTokenUnitsField,
            autocompletion({
                override: [formulaCompletion],
                activateOnTyping: true,
                maxRenderedOptions: 20,
            }),
            // Function signature tooltip using tokenUnits from backend
            StateField.define<readonly Tooltip[]>({
                create: () => [],
                update(tooltips, tr) {
                    let tokenUnitsChanged = false
                    for (const effect of tr.effects) {
                        if (effect.is(setStoredTokenUnits)) {
                            tokenUnitsChanged = true
                            break
                        }
                    }

                    if (
                        !tr.docChanged &&
                        !tr.selection &&
                        !tokenUnitsChanged &&
                        tooltips.length > 0
                    ) {
                        return tooltips
                    }

                    const text = tr.state.doc.toString()
                    if (!isFormula(text)) return []

                    const pos = tr.state.selection.main.head
                    const tokenUnits = tr.state.field(storedTokenUnitsField)
                    if (tokenUnits.length === 0) return []

                    const ctx = getFunctionContextFromTokens(
                        text,
                        tokenUnits,
                        pos
                    )
                    if (!ctx) return []

                    const func = live.formulaFunctions.find(
                        (f) => f.name.toUpperCase() === ctx.funcName
                    )
                    if (!func) return []

                    return [
                        {
                            pos,
                            above: true,
                            strictSide: true,
                            arrow: false,
                            create: () => ({
                                dom: createSignatureTooltip(func, ctx.argIndex),
                            }),
                        },
                    ]
                },
                provide: (f) =>
                    showTooltip.computeN([f], (state) => state.field(f)),
            }),
            customKeymap,
            keymap.of([...defaultKeymap, ...historyKeymap]),
            updateListener,
            theme,
            ...(config.wordWrap ? [EditorView.lineWrapping] : []),
            placeholderExt(config.placeholder),
        ]

        if (config.readOnly) {
            extensions.push(EditorState.readOnly.of(true))
        }
        return extensions
    }

    function buildView(initialValue: string, cursor?: number) {
        if (view) {
            view.contentDOM.removeEventListener('blur', blurHandler!)
            view.destroy()
        }

        const anchor =
            cursor !== undefined
                ? cursor
                : initialCursorPosition === 'end'
                  ? initialValue.length
                  : 0

        const state = EditorState.create({
            doc: initialValue,
            extensions: buildExtensions(),
            selection: {anchor: Math.min(anchor, initialValue.length)},
        })

        view = new EditorView({state, parent})

        updateDecorations(view)

        if (config.autoFocus) view.focus()

        blurHandler = () => live.onBlur?.(view!.state.doc.toString())
        view.contentDOM.addEventListener('blur', blurHandler)
    }

    applyHostStyle()
    buildView(controlledValue ?? options.defaultValue ?? '')

    function configChanged(next: Required<FormulaEditorConfig>): boolean {
        return CONFIG_KEYS.some((k) => next[k] !== config[k])
    }

    return {
        focus: () => view?.focus(),
        blur: () => view?.contentDOM.blur(),
        getValue: () => view?.state.doc.toString() ?? '',
        setValue: (newValue: string) => {
            if (!view) return
            view.dispatch({
                changes: {from: 0, to: view.state.doc.length, insert: newValue},
            })
        },
        insertText: (text: string) => {
            if (!view) return
            const pos = view.state.selection.main.head
            view.dispatch({
                changes: {from: pos, insert: text},
                selection: {anchor: pos + text.length},
            })
        },
        replaceRange: (from: number, to: number, text: string) => {
            if (!view) return
            view.dispatch({
                changes: {from, to, insert: text},
                selection: {anchor: from + text.length},
            })
        },
        getCursorPosition: () => view?.state.selection.main.head ?? 0,
        getView: () => view,
        updateOptions: (opts: Partial<FormulaEditorOptions>) => {
            if ('onChange' in opts) live.onChange = opts.onChange
            if ('onBlur' in opts) live.onBlur = opts.onBlur
            if ('onSubmit' in opts) live.onSubmit = opts.onSubmit
            if ('onCancel' in opts) live.onCancel = opts.onCancel
            if (opts.getDisplayUnits) live.getDisplayUnits = opts.getDisplayUnits
            if (opts.formulaFunctions) live.formulaFunctions = opts.formulaFunctions
            if (opts.sheetName !== undefined) live.sheetName = opts.sheetName
            if (opts.className !== undefined) options.className = opts.className
            if (opts.style !== undefined) options.style = opts.style

            // A changed config rebuilds the view (preserving text + cursor).
            if (opts.config) {
                const next = {...DEFAULT_CONFIG, ...opts.config}
                if (configChanged(next)) {
                    const text = view?.state.doc.toString() ?? ''
                    const cur = view?.state.selection.main.head
                    config = next
                    applyHostStyle()
                    buildView(text, cur)
                    return
                }
                config = next
            }

            // A changed controlled value is dispatched into the document.
            if ('value' in opts) {
                controlledValue = opts.value
                if (
                    view &&
                    opts.value !== undefined &&
                    opts.value !== view.state.doc.toString()
                ) {
                    view.dispatch({
                        changes: {
                            from: 0,
                            to: view.state.doc.length,
                            insert: opts.value,
                        },
                    })
                }
            }
        },
        destroy: () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            if (view && blurHandler) {
                view.contentDOM.removeEventListener('blur', blurHandler)
            }
            view?.destroy()
            view = null
        },
    }
}
