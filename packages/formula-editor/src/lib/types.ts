/**
 * Types for the Formula Editor
 *
 * These match the backend API types from logisheets-web
 */

/**
 * Token types returned by the backend lexer.
 * The editor does NOT tokenize formulas itself - it calls a backend API.
 */
export type TokenType =
    | 'funcName'
    | 'funcArg'
    | 'cellReference'
    | 'errorConstant'
    | 'wrongSuffix'
    | 'other'

/**
 * A token unit representing a slice of the formula.
 * The backend returns an array of these for syntax highlighting.
 */
export interface TokenUnit {
    tokenType: TokenType
    /** Start index in the formula string (0-based, excludes leading '=') */
    start: number
    /** End index in the formula string (exclusive) */
    end: number
}

/**
 * Cell reference info parsed by the backend.
 * Used for highlighting cell references with colors.
 */
export interface CellRef {
    workbook?: string
    sheet1?: string
    sheet2?: string
    row1?: number
    col1?: number
    row2?: number
    col2?: number
}

/**
 * The complete display info returned by the backend for a formula.
 * This is what the editor receives from `getDisplayUnitsOfFormula`.
 */
export interface FormulaDisplayInfo {
    cellRefs: readonly CellRef[]
    tokenUnits: readonly TokenUnit[]
}

/**
 * Function to fetch formula display info from backend.
 * The editor calls this whenever the text changes.
 *
 * @param formula - The formula text (with leading '=' stripped)
 * @returns Promise resolving to FormulaDisplayInfo or undefined if not a formula
 */
export type GetDisplayUnitsFunc = (
    formula: string
) => Promise<FormulaDisplayInfo | undefined>

/**
 * A formula function definition for autocomplete.
 */
export interface FormulaFunction {
    /** Function name, e.g. "SUM" */
    name: string
    /** Description of what the function does */
    description: string
    /** Function arguments */
    args: FormulaArg[]
    /** Argument count constraints */
    argCount: {
        eq?: number
        ge?: number
        le?: number
    }
}

/**
 * A function argument definition.
 */
export interface FormulaArg {
    argName: string
    description: string
    /** If true, this argument can repeat */
    startRepeated?: boolean
}

/**
 * An autocomplete candidate.
 */
export interface Candidate {
    /** Plain text to insert when selected */
    text: string
    /** Display spans with optional highlighting */
    spans: CandidateSpan[]
    /** Description shown in the dropdown */
    description?: string
    /** If true, pressing Enter won't insert this candidate */
    isInfoOnly?: boolean
    /** Position where cursor should be placed after insertion (for adding between parentheses) */
    cursorOffset?: number
}

/**
 * A span within a candidate's display text.
 */
export interface CandidateSpan {
    text: string
    highlight?: boolean
}

/**
 * Editor configuration options.
 */
export interface FormulaEditorConfig {
    /** Font size in pixels */
    fontSize?: number
    /** Font family */
    fontFamily?: string
    /** Line height multiplier */
    lineHeight?: number
    /** Text alignment: 'left' | 'center' | 'right' */
    textAlign?: 'left' | 'center' | 'right'
    /** Enable word wrap */
    wordWrap?: boolean
    /** Placeholder text when empty */
    placeholder?: string
    /** Read-only mode */
    readOnly?: boolean
    /** Auto-focus on mount */
    autoFocus?: boolean
}

/**
 * Props for the FormulaEditor component.
 */
export interface FormulaEditorProps {
    /** Current value (controlled) */
    value?: string
    /** Default value (uncontrolled) */
    defaultValue?: string
    /** Called when value changes */
    onChange?: (value: string) => void
    /** Called when editor loses focus - use this to commit the value */
    onBlur?: (value: string) => void
    /** Called when Enter is pressed (without modifier keys) */
    onSubmit?: (value: string) => void
    /** Called when Escape is pressed */
    onCancel?: () => void
    /** Function to get display units from backend */
    getDisplayUnits: GetDisplayUnitsFunc
    /** List of available formula functions for autocomplete */
    formulaFunctions?: FormulaFunction[]
    /** Current sheet name (for determining if cell refs are local) */
    sheetName?: string
    /** Configuration options */
    config?: FormulaEditorConfig
    /** Custom class name */
    className?: string
    /** Custom style */
    style?: React.CSSProperties
}

/**
 * Colors for cell reference highlighting.
 * Returns a different color for each reference index to distinguish them.
 */
export const CELL_REF_COLORS = [
    'rgba(66, 133, 244, 0.3)', // Blue
    'rgba(219, 68, 55, 0.3)', // Red
    'rgba(244, 180, 0, 0.3)', // Yellow
    'rgba(15, 157, 88, 0.3)', // Green
    'rgba(171, 71, 188, 0.3)', // Purple
    'rgba(255, 112, 67, 0.3)', // Orange
    'rgba(0, 172, 193, 0.3)', // Cyan
    'rgba(124, 77, 255, 0.3)', // Indigo
]

export function getCellRefColor(index: number): string {
    return CELL_REF_COLORS[index % CELL_REF_COLORS.length]
}
