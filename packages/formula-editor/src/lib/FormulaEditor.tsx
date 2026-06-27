/**
 * FormulaEditor — thin React wrapper over the framework-agnostic core
 * (`createFormulaEditor`, see ./editor).
 *
 * All editor behavior — token highlighting, autocomplete, signature help,
 * cell-ref coloring, keymap — lives in the vanilla core. This component only
 * handles the React lifecycle: create on mount, sync props, destroy on unmount,
 * and expose the imperative ref API.
 */

import {useRef, useEffect, forwardRef, useImperativeHandle} from 'react'
import type {EditorView} from '@codemirror/view'
import {createFormulaEditor, type FormulaEditorHandle} from './editor'
import type {FormulaEditorProps} from './types'

export interface FormulaEditorRef {
    focus: () => void
    blur: () => void
    getValue: () => string
    setValue: (value: string) => void
    /** Insert text at current cursor position */
    insertText: (text: string) => void
    /** Replace text in a range, useful for replacing previous insertion */
    replaceRange: (from: number, to: number, text: string) => void
    /** Get current cursor position */
    getCursorPosition: () => number
    getView: () => EditorView | null
}

export const FormulaEditor = forwardRef<FormulaEditorRef, FormulaEditorProps>(
    (props, ref) => {
        const containerRef = useRef<HTMLDivElement>(null)
        const handleRef = useRef<FormulaEditorHandle | null>(null)

        // Create the editor once on mount. Live props (callbacks, function
        // list, sheet name, config, controlled value) are synced via the
        // effect below.
        useEffect(() => {
            if (!containerRef.current) return
            const handle = createFormulaEditor(containerRef.current, {
                value: props.value,
                defaultValue: props.defaultValue,
                initialCursorPosition: props.initialCursorPosition,
                onChange: props.onChange,
                onBlur: props.onBlur,
                onSubmit: props.onSubmit,
                onCancel: props.onCancel,
                getDisplayUnits: props.getDisplayUnits,
                formulaFunctions: props.formulaFunctions,
                sheetName: props.sheetName,
                config: props.config,
                className: props.className,
                style: props.style as Partial<CSSStyleDeclaration>,
            })
            handleRef.current = handle
            return () => {
                handle.destroy()
                handleRef.current = null
            }
            // Created once; prop changes flow through updateOptions below.
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [])

        // Sync changing props into the running editor every render.
        useEffect(() => {
            handleRef.current?.updateOptions({
                value: props.value,
                onChange: props.onChange,
                onBlur: props.onBlur,
                onSubmit: props.onSubmit,
                onCancel: props.onCancel,
                getDisplayUnits: props.getDisplayUnits,
                formulaFunctions: props.formulaFunctions,
                sheetName: props.sheetName,
                config: props.config,
            })
        })

        useImperativeHandle(ref, () => ({
            focus: () => handleRef.current?.focus(),
            blur: () => handleRef.current?.blur(),
            getValue: () => handleRef.current?.getValue() ?? '',
            setValue: (v: string) => handleRef.current?.setValue(v),
            insertText: (t: string) => handleRef.current?.insertText(t),
            replaceRange: (from: number, to: number, t: string) =>
                handleRef.current?.replaceRange(from, to, t),
            getCursorPosition: () =>
                handleRef.current?.getCursorPosition() ?? 0,
            getView: () => handleRef.current?.getView() ?? null,
        }))

        return <div ref={containerRef} />
    }
)

FormulaEditor.displayName = 'FormulaEditor'
