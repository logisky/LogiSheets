/**
 * logisheets-formula-editor
 *
 * A spreadsheet formula editor with token-based syntax highlighting (via a
 * host callback), function autocomplete, signature help, and cell-reference
 * coloring. Built on CodeMirror 6.
 *
 * This root entry includes the React `<FormulaEditor>` component. For a
 * framework-agnostic (vanilla / Vue / Svelte / Angular) build with no React
 * dependency, import from `logisheets-formula-editor/core` instead.
 */

// React component (thin wrapper over the vanilla core)
export {FormulaEditor} from './FormulaEditor'
export type {FormulaEditorRef} from './FormulaEditor'

// Framework-agnostic core + types + utils
export * from './core'

// Engine binding (one-call wiring from a DataService to editor props)
export * from './engine'
