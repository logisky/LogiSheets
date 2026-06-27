/**
 * logisheets-formula-editor/core
 *
 * Framework-agnostic entry point — the formula editor with zero React (or any
 * framework) dependency. Use this from vanilla JS, Vue, Svelte, Angular, etc.,
 * the same way you mount `logisheets-engine`:
 *
 *   import { createFormulaEditor } from 'logisheets-formula-editor/core'
 *   const editor = createFormulaEditor(el, { getDisplayUnits, ... })
 *
 * The React `<FormulaEditor>` (the package root) is a thin wrapper over this.
 */

export {createFormulaEditor} from './editor'
export type {FormulaEditorHandle, FormulaEditorOptions} from './editor'

// Bundled default function metadata (autocomplete + signature help out-of-the-box)
export {builtinFormulaFunctions} from './functions'

export * from './types'
export * from './utils'
