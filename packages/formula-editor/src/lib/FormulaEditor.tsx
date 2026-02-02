/**
 * FormulaEditor - A React component for editing spreadsheet formulas.
 *
 * Built on CodeMirror 6 for robust text editing with:
 * - Token-based syntax highlighting (from backend API)
 * - Autocomplete for formula functions
 * - Cell reference highlighting with colors
 * - Proper cursor, selection, IME support
 *
 * IMPORTANT: This editor does NOT tokenize formulas itself!
 * It calls `getDisplayUnits` to fetch token info from the backend.
 */

import {
    useRef,
    useEffect,
    useCallback,
    forwardRef,
    useImperativeHandle,
    useMemo,
} from 'react'
import {EditorState, StateEffect, StateField} from '@codemirror/state'
import {
    EditorView,
    Decoration,
    DecorationSet,
    ViewUpdate,
    keymap,
    placeholder as placeholderExt,
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
    FormulaEditorProps,
    FormulaDisplayInfo,
    FormulaEditorConfig,
} from './types'
import {getCellRefColor} from './types'
import {isFormula, fuzzyMatch} from './utils'

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
}

export interface FormulaEditorRef {
    focus: () => void
    blur: () => void
    getValue: () => string
    setValue: (value: string) => void
    getView: () => EditorView | null
}

// State effect for updating decorations from backend
const setTokenDecorations = StateEffect.define<DecorationSet>()

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
        // Map decorations through document changes
        return decorations.map(tr.changes)
    },
    provide: (field) => EditorView.decorations.from(field),
})

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

export const FormulaEditor = forwardRef<FormulaEditorRef, FormulaEditorProps>(
    (props, ref) => {
        const {
            value: controlledValue,
            defaultValue = '',
            onChange,
            onBlur,
            onSubmit,
            onCancel,
            getDisplayUnits,
            formulaFunctions = [],
            sheetName = '',
            config: userConfig,
            className,
            style,
        } = props

        const config = useMemo(
            () => ({...DEFAULT_CONFIG, ...userConfig}),
            [userConfig]
        )

        const containerRef = useRef<HTMLDivElement>(null)
        const viewRef = useRef<EditorView | null>(null)
        const isControlled = controlledValue !== undefined
        const latestValue = useRef(controlledValue ?? defaultValue)
        const latestPropsRef = useRef({
            onChange,
            onBlur,
            onSubmit,
            onCancel,
            getDisplayUnits,
            formulaFunctions,
            sheetName,
        })

        // Keep props ref updated
        useEffect(() => {
            latestPropsRef.current = {
                onChange,
                onBlur,
                onSubmit,
                onCancel,
                getDisplayUnits,
                formulaFunctions,
                sheetName,
            }
        })

        // Expose methods via ref
        useImperativeHandle(ref, () => ({
            focus: () => viewRef.current?.focus(),
            blur: () => viewRef.current?.contentDOM.blur(),
            getValue: () => viewRef.current?.state.doc.toString() ?? '',
            setValue: (newValue: string) => {
                const view = viewRef.current
                if (view) {
                    view.dispatch({
                        changes: {
                            from: 0,
                            to: view.state.doc.length,
                            insert: newValue,
                        },
                    })
                }
            },
            getView: () => viewRef.current,
        }))

        // Build CodeMirror decorations from FormulaDisplayInfo
        const buildDecorations = useCallback(
            (
                displayInfo: FormulaDisplayInfo,
                currentSheet: string
            ): DecorationSet => {
                const decorations: {
                    from: number
                    to: number
                    decoration: Decoration
                }[] = []
                const offset = 1 // Account for leading '='
                let cellRefIndex = 0

                for (const token of displayInfo.tokenUnits) {
                    const from = token.start + offset
                    const to = token.end + offset

                    switch (token.tokenType) {
                        case 'funcName':
                            decorations.push({
                                from,
                                to,
                                decoration: tokenStyles.funcName,
                            })
                            break
                        case 'cellReference': {
                            const cellRef = displayInfo.cellRefs[cellRefIndex]
                            // Only color local cell references
                            if (
                                cellRef &&
                                isLocalCellRef(cellRef, currentSheet)
                            ) {
                                decorations.push({
                                    from,
                                    to,
                                    decoration:
                                        tokenStyles.cellReference(cellRefIndex),
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

                // Sort by position and create DecorationSet
                decorations.sort((a, b) => a.from - b.from)
                return Decoration.set(
                    decorations.map((d) => d.decoration.range(d.from, d.to))
                )
            },
            []
        )

        // Fetch and apply token decorations
        const updateDecorations = useCallback(
            async (view: EditorView) => {
                const text = view.state.doc.toString()
                if (!isFormula(text)) {
                    view.dispatch({
                        effects: setTokenDecorations.of(Decoration.none),
                    })
                    return
                }

                try {
                    const formula = text.startsWith('=') ? text.slice(1) : text
                    const displayInfo =
                        await latestPropsRef.current.getDisplayUnits(formula)
                    if (!displayInfo) {
                        view.dispatch({
                            effects: setTokenDecorations.of(Decoration.none),
                        })
                        return
                    }

                    const decorations = buildDecorations(
                        displayInfo,
                        latestPropsRef.current.sheetName
                    )
                    view.dispatch({
                        effects: setTokenDecorations.of(decorations),
                    })
                } catch (error) {
                    // eslint-disable-next-line no-console
                    console.error('Failed to fetch display units:', error)
                }
            },
            [buildDecorations]
        )

        // Autocomplete source
        const formulaCompletion = useCallback(
            async (
                context: CompletionContext
            ): Promise<CompletionResult | null> => {
                const text = context.state.doc.toString()
                if (!isFormula(text)) return null

                // Find the word being typed
                const word = context.matchBefore(/[A-Za-z_][A-Za-z0-9_]*/)
                if (!word) return null

                const query = word.text
                const functions = latestPropsRef.current.formulaFunctions

                const completions: Completion[] = []

                for (const func of functions) {
                    const match = fuzzyMatch(query, func.name)
                    if (match.matched) {
                        completions.push({
                            label: func.name,
                            type: 'function',
                            detail: '()',
                            info: func.description,
                            apply: (view, _completion, from, to) => {
                                const insertText = `${func.name}()`
                                view.dispatch({
                                    changes: {from, to, insert: insertText},
                                    // Position cursor before closing paren
                                    selection: {
                                        anchor: from + func.name.length + 1,
                                    },
                                })
                            },
                            boost: match.indices.length, // Better matches rank higher
                        })
                    }
                }

                if (completions.length === 0) return null

                return {
                    from: word.from,
                    options: completions,
                    validFor: /^[A-Za-z_][A-Za-z0-9_]*$/,
                }
            },
            []
        )

        // Initialize CodeMirror
        useEffect(() => {
            if (!containerRef.current) return

            // Preserve value when recreating editor
            const initialValue = viewRef.current
                ? viewRef.current.state.doc.toString()
                : latestValue.current

            // Debounce timer for decoration updates
            let debounceTimer: ReturnType<typeof setTimeout> | null = null

            const updateListener = EditorView.updateListener.of(
                (update: ViewUpdate) => {
                    if (update.docChanged) {
                        const newValue = update.state.doc.toString()
                        latestValue.current = newValue
                        latestPropsRef.current.onChange?.(newValue)

                        // Debounced decoration update
                        if (debounceTimer) clearTimeout(debounceTimer)
                        debounceTimer = setTimeout(() => {
                            updateDecorations(update.view)
                        }, 100)
                    }
                }
            )

            // Bracket pairs for auto-delete
            const bracketPairs: Record<string, string> = {
                '(': ')',
                '[': ']',
                '{': '}',
                '"': '"',
                "'": "'",
            }

            const customKeymap = keymap.of([
                {
                    key: 'Backspace',
                    run: (view) => {
                        const {state} = view
                        const {from, to} = state.selection.main

                        // Only handle when no selection (cursor position)
                        if (from !== to) return false

                        // Check if we're not at the beginning
                        if (from === 0) return false

                        const doc = state.doc.toString()
                        const charBefore = doc[from - 1]
                        const charAfter = doc[from]

                        // Check if deleting an opening bracket with matching closing bracket after
                        if (
                            bracketPairs[charBefore] &&
                            charAfter === bracketPairs[charBefore]
                        ) {
                            // Delete both brackets
                            view.dispatch({
                                changes: {from: from - 1, to: from + 1},
                                selection: {anchor: from - 1},
                            })
                            return true
                        }

                        return false // Let default backspace handle it
                    },
                },
                {
                    key: 'Tab',
                    run: (view) => {
                        // If autocomplete is active, accept completion
                        const status = completionStatus(view.state)
                        if (status === 'active') {
                            return acceptCompletion(view)
                        }
                        return false // Let default behavior handle it
                    },
                },
                {
                    key: 'Enter',
                    run: (view) => {
                        // If autocomplete is active, let it handle Enter
                        const status = completionStatus(view.state)
                        if (status === 'active') {
                            return acceptCompletion(view)
                        }
                        latestPropsRef.current.onSubmit?.(
                            view.state.doc.toString()
                        )
                        return true
                    },
                },
                {
                    key: 'Escape',
                    run: () => {
                        latestPropsRef.current.onCancel?.()
                        return true
                    },
                },
                {
                    key: 'Alt-Enter',
                    run: (view) => {
                        // Insert newline
                        view.dispatch(view.state.replaceSelection('\n'), {
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
                '.cm-content': {
                    padding: '4px',
                    lineHeight: String(config.lineHeight),
                    textAlign: config.textAlign,
                },
                '.cm-line': {
                    padding: '0',
                },
                '.cm-focused': {
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
                autocompletion({
                    override: [formulaCompletion],
                    activateOnTyping: true,
                    maxRenderedOptions: 20,
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

            // Destroy existing view before creating new one
            if (viewRef.current) {
                viewRef.current.destroy()
            }

            const state = EditorState.create({
                doc: initialValue,
                extensions,
            })

            const view = new EditorView({
                state,
                parent: containerRef.current,
            })

            viewRef.current = view

            // Initial decoration update
            updateDecorations(view)

            // Auto focus
            if (config.autoFocus) {
                view.focus()
            }

            // Handle blur
            const handleBlur = () => {
                latestPropsRef.current.onBlur?.(view.state.doc.toString())
            }
            view.contentDOM.addEventListener('blur', handleBlur)

            return () => {
                if (debounceTimer) clearTimeout(debounceTimer)
                view.contentDOM.removeEventListener('blur', handleBlur)
                view.destroy()
                viewRef.current = null
            }
        }, [
            config.fontSize,
            config.fontFamily,
            config.lineHeight,
            config.textAlign,
            config.wordWrap,
            config.placeholder,
            config.readOnly,
            updateDecorations,
            formulaCompletion,
        ]) // Recreate editor when config changes

        // Sync controlled value
        useEffect(() => {
            if (isControlled && viewRef.current) {
                const currentValue = viewRef.current.state.doc.toString()
                if (controlledValue !== currentValue) {
                    viewRef.current.dispatch({
                        changes: {
                            from: 0,
                            to: viewRef.current.state.doc.length,
                            insert: controlledValue,
                        },
                    })
                }
            }
        }, [controlledValue, isControlled])

        return (
            <div
                ref={containerRef}
                className={`formula-editor ${className || ''}`}
                style={{
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    minHeight: `${config.fontSize * config.lineHeight + 8}px`,
                    ...style,
                }}
            />
        )
    }
)

FormulaEditor.displayName = 'FormulaEditor'

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
