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
 *
 * Main exports: `FormulaEditor` / `FormulaEditorRef` (React), everything from
 * `./core` (`createFormulaEditor`, types, utils, `builtinFormulaFunctions`)
 * and from `./engine` (`createEngineFormulaSource`). The in-cell editor
 * controller is NOT re-exported here — it needs the `logisheets-engine` peer
 * at runtime, so it lives only at the `logisheets-formula-editor/inline`
 * subpath.
 *
 * Consumers in this repo: the root app's edit bar
 * (src/components/content/edit-bar.tsx) mounts `<FormulaEditor>` wired with
 * `createEngineFormulaSource`; the app's grid uses `/inline` for in-cell
 * editing (src/components/spreadsheet-view/inline-cell-editor.tsx).
 */

// React component (thin wrapper over the vanilla core)
export {FormulaEditor} from './FormulaEditor'
export type {FormulaEditorRef} from './FormulaEditor'

// Framework-agnostic core + types + utils
export * from './core'

// Engine binding (one-call wiring from a DataService to editor props). Type-
// only against the engine, so it adds no runtime dependency.
export * from './engine'
