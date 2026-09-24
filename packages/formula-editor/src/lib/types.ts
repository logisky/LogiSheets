/**
 * Types for the Formula Editor
 *
 * The wire types (`TokenType`, `TokenUnit`, `CellRef`, `FormulaDisplayInfo`)
 * mirror logisheets-web's generated bindings for the Rust
 * `lexer4fmt::FormulaDisplayInfo` (crates/controller/lexer4fmt/src/fmt.rs);
 * they are redeclared here so the package has no logisheets-web dependency.
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
    /**
     * Start offset into the formula body (the text after the leading '=').
     * 0-based UTF-8 BYTE offset, not a JS string index — it only matches the
     * string index for ASCII text; the editor converts before use.
     */
    start: number
    /** End offset, exclusive; same basis as `start`. */
    end: number
}

/**
 * Cell reference info parsed by the backend.
 * Used for highlighting cell references with colors.
 *
 * `row*` / `col*` are 0-based indices (A1 is row 0, col 0); `*2` is set only
 * for a range. A missing row or column means that part was not written (e.g.
 * a whole-column `A:A`). Sheet / workbook names are as written, without the
 * surrounding quotes; `sheet2` is set only for a 3D `Sheet1:Sheet2!` ref.
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
 *
 * Invariant: `cellRefs[i]` belongs to the i-th `cellReference` token in
 * `tokenUnits` (same order), which is how highlight colors stay paired.
 */
export interface FormulaDisplayInfo {
    cellRefs: readonly CellRef[]
    tokenUnits: readonly TokenUnit[]
}

/**
 * Function to fetch formula display info from backend.
 * The editor calls this on creation and ~100 ms after the last edit
 * (debounced), only while the text is a formula (see `isFormula`).
 *
 * A rejection is caught and logged, and the previous highlighting is kept;
 * resolving `undefined` clears it. Responses are applied in completion order,
 * so an implementation should not let a slow call outlive a newer one.
 *
 * @param formula - The formula text (with leading '=' stripped)
 * @returns Promise resolving to FormulaDisplayInfo or undefined if not a formula
 */
export type GetDisplayUnitsFunc = (
    formula: string
) => Promise<FormulaDisplayInfo | undefined>

/**
 * A formula function definition for autocomplete and signature help.
 * Names are matched case-insensitively against the typed function name.
 */
export interface FormulaFunction {
    /** Function name, e.g. "SUM" */
    name: string
    /**
     * Description of what the function does — shown verbatim, so pass
     * already-localized text (the editor does no i18n lookup).
     */
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
    /**
     * If true, this argument and the ones after it repeat (signature help
     * shows `name, name1, name2, ...`).
     */
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
    /** Show border around the editor */
    showBorder?: boolean
}

/**
 * Props for the FormulaEditor component.
 *
 * Every prop except `defaultValue`, `initialCursorPosition`, `className` and
 * `style` is re-synced on each render; those four are read once at mount.
 * Point-mode arrow handling (`onArrowKey`) is only exposed by the vanilla
 * `createFormulaEditor`.
 */
export interface FormulaEditorProps {
    /** Current value (controlled) */
    value?: string
    /** Default value (uncontrolled) */
    defaultValue?: string
    /** Initial cursor position: 'start' or 'end' (default: 'end') */
    initialCursorPosition?: 'start' | 'end'
    /**
     * Called when value changes — including programmatic `setValue` /
     * controlled `value` updates, not just typing.
     */
    onChange?: (value: string) => void
    /** Called when editor loses focus - use this to commit the value */
    onBlur?: (value: string) => void
    /**
     * Called when Enter is pressed (without modifier keys) while no
     * autocomplete list is open — Enter accepts the completion instead.
     * Alt+Enter inserts a newline.
     */
    onSubmit?: (value: string) => void
    /** Called when Escape is pressed */
    onCancel?: () => void
    /** Function to get display units from backend */
    getDisplayUnits: GetDisplayUnitsFunc
    /** List of available formula functions for autocomplete */
    formulaFunctions?: FormulaFunction[]
    /**
     * Current sheet name, compared against `CellRef.sheet1` to decide which
     * refs are local (only local refs get a colored background).
     */
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
    'rgba(0, 112, 192, 0.3)', // #0070C0 Blue
    'rgba(255, 0, 0, 0.3)', // #FF0000 Red
    'rgba(0, 176, 80, 0.3)', // #00B050 Green
    'rgba(112, 48, 160, 0.3)', // #7030A0 Purple
    'rgba(0, 176, 240, 0.3)', // #00B0F0 Cyan
    'rgba(255, 192, 0, 0.3)', // #FFC000 Orange/Yellow
]

/** Palette color for the `index`-th reference; wraps after six. */
export function getCellRefColor(index: number): string {
    return CELL_REF_COLORS[index % CELL_REF_COLORS.length]
}
