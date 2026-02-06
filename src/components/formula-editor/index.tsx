/**
 * FormulaEditorWrapper - Integrates formula-editor with LogiSheets
 *
 * This component wraps the CodeMirror-based formula editor and connects it
 * to the LogiSheets data service for tokenization and autocomplete.
 */

import {
    forwardRef,
    useImperativeHandle,
    useRef,
    useMemo,
    useEffect,
    useState,
    useCallback,
} from 'react'
import {
    FormulaEditor,
    FormulaEditorRef,
    FormulaDisplayInfo,
    FormulaFunction,
    CellRef,
} from '@logisheets/formula-editor'
import {isErrorMessage} from 'logisheets-engine'
import type {DataService} from 'logisheets-engine'
import {getAllFormulas} from '@/core/snippet'
import styles from './formula-editor.module.scss'

// Re-export types for convenience
export type {CellRef} from '@logisheets/formula-editor'

export interface FormulaEditorWrapperProps {
    /** Initial text (including leading '=' for formulas) */
    initialText: string
    /** Current sheet name for cell reference highlighting */
    sheetName: string
    /** Data service for backend API calls */
    dataService: DataService
    /** Position of the editor */
    position: {
        x: number
        y: number
        width: number
        height: number
    }
    /** Called when the editor loses focus - commit the value */
    onBlur: (value: string) => void
    /** Called when user presses Escape - cancel editing */
    onCancel: () => void
    /** Whether the editor is visible */
    visible?: boolean
    /** Initial cursor position: 'start' or 'end' */
    initialCursorPosition?: 'start' | 'end'
    /** Cell reference string to insert at cursor (e.g., "A1" or "A1:B2") */
    referenceInsertion?: string
    /** Called when cell references in formula change - for highlighting cells */
    onCellRefsChange?: (cellRefs: readonly CellRef[]) => void
    /** Called when the editor text changes */
    onChange?: (value: string) => void
}

export interface FormulaEditorWrapperRef {
    focus: () => void
    getValue: () => string
}

/**
 * Convert LogiSheets formula snippets to FormulaFunction format
 */
function convertToFormulaFunctions(): FormulaFunction[] {
    const snippets = getAllFormulas()
    return snippets.map((snippet) => ({
        name: snippet.name,
        description: snippet.description,
        args: snippet.args.map((arg) => ({
            argName: arg.argName,
            description: arg.description,
            startRepeated: arg.startRepeated,
        })),
        argCount: snippet.argCount,
    }))
}

// Cache formula functions since they don't change
let cachedFormulaFunctions: FormulaFunction[] | null = null
function getFormulaFunctions(): FormulaFunction[] {
    if (!cachedFormulaFunctions) {
        cachedFormulaFunctions = convertToFormulaFunctions()
    }
    return cachedFormulaFunctions
}

/**
 * Measure text width using canvas
 */
function measureTextWidth(text: string, fontSize: number): number {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return text.length * fontSize * 0.6
    ctx.font = `${fontSize}px Consolas, Monaco, "Courier New", monospace`
    return ctx.measureText(text).width
}

const FormulaEditorWrapperInner = forwardRef<
    FormulaEditorWrapperRef,
    FormulaEditorWrapperProps
>(function FormulaEditorWrapperInner(props, ref) {
    const {
        initialText,
        sheetName,
        dataService,
        position,
        onBlur,
        onCancel,
        visible = true,
        initialCursorPosition = 'end',
        referenceInsertion,
        onCellRefsChange,
        onChange,
    } = props

    const editorRef = useRef<FormulaEditorRef>(null)
    const formulaFunctions = useMemo(() => getFormulaFunctions(), [])

    // Track previous insertion for replacement
    const prevInsertionRef = useRef<{
        text: string
        startPos: number
    } | null>(null)
    // Track if change is from reference insertion (to avoid clearing prevInsertionRef)
    const isInsertingRef = useRef(false)

    // Track editor width for auto-expanding
    const [editorWidth, setEditorWidth] = useState(position.width)

    // Update width when text changes
    const handleChange = useCallback(
        (value: string) => {
            const textWidth = measureTextWidth(value, 13) + 20 // 20px padding
            const newWidth = Math.max(position.width, textWidth)
            setEditorWidth(newWidth)
            // If user types manually, clear the previous insertion tracking
            if (!isInsertingRef.current) {
                prevInsertionRef.current = null
            }
            isInsertingRef.current = false
            // Notify parent of text change
            onChange?.(value)
        },
        [position.width, onChange]
    )

    // Initialize width based on initial text
    useEffect(() => {
        const textWidth = measureTextWidth(initialText, 13) + 20
        setEditorWidth(Math.max(position.width, textWidth))
    }, [initialText, position.width])

    // Handle reference insertion when user selects cells during formula editing
    useEffect(() => {
        if (!referenceInsertion || !editorRef.current) return

        const editor = editorRef.current
        const cursorPos = editor.getCursorPosition()

        // Mark that we're inserting a reference (so handleChange won't clear prevInsertionRef)
        isInsertingRef.current = true

        // If we have a previous insertion, replace it; otherwise insert at cursor
        if (prevInsertionRef.current) {
            const {startPos, text: prevText} = prevInsertionRef.current
            editor.replaceRange(
                startPos,
                startPos + prevText.length,
                referenceInsertion
            )
        } else {
            editor.insertText(referenceInsertion)
        }

        // Track this insertion for potential replacement
        prevInsertionRef.current = {
            text: referenceInsertion,
            startPos: prevInsertionRef.current?.startPos ?? cursorPos,
        }
    }, [referenceInsertion])

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
        focus: () => editorRef.current?.focus(),
        getValue: () => editorRef.current?.getValue() ?? '',
    }))

    // Auto-focus on mount
    useEffect(() => {
        if (visible) {
            // Small delay to ensure the editor is mounted
            const timer = setTimeout(() => {
                editorRef.current?.focus()
            }, 10)
            return () => clearTimeout(timer)
        }
    }, [visible])

    /**
     * Fetch display units from the backend
     */
    const getDisplayUnits = useCallback(
        async (formula: string): Promise<FormulaDisplayInfo | undefined> => {
            try {
                const result = await dataService
                    .getWorkbook()
                    .getDisplayUnitsOfFormula(formula)
                if (isErrorMessage(result)) {
                    onCellRefsChange?.([])
                    return undefined
                }
                // Notify parent about cell references for highlighting
                onCellRefsChange?.(result.cellRefs)
                return result
            } catch {
                onCellRefsChange?.([])
                return undefined
            }
        },
        [dataService, onCellRefsChange]
    )

    /**
     * Handle blur - commit the value
     */
    const handleBlur = (value: string) => {
        onBlur(value)
    }

    /**
     * Handle submit (Enter key)
     */
    const handleSubmit = (value: string) => {
        onBlur(value)
    }

    /**
     * Handle cancel (Escape key)
     */
    const handleCancel = () => {
        onCancel()
    }

    if (!visible) {
        return null
    }

    return (
        <div
            className={styles.formulaEditorWrapper}
            style={{
                left: position.x,
                top: position.y,
                width: editorWidth,
                minHeight: position.height,
            }}
        >
            <FormulaEditor
                ref={editorRef}
                defaultValue={initialText}
                initialCursorPosition={initialCursorPosition}
                getDisplayUnits={getDisplayUnits}
                formulaFunctions={formulaFunctions}
                sheetName={sheetName}
                onChange={handleChange}
                onBlur={handleBlur}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                config={{
                    fontSize: 13,
                    lineHeight: position.height / 13, // Calculate line height from cell height
                    autoFocus: true,
                    placeholder: '',
                    showBorder: false,
                }}
                style={{
                    minHeight: position.height,
                    border: '2px solid #1a73e8',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                }}
            />
        </div>
    )
})

export const FormulaEditorWrapper = FormulaEditorWrapperInner

export type {FormulaEditorRef}
