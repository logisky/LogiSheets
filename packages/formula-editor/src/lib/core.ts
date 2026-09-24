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
 *
 * Main exports: `createFormulaEditor` + its option / handle types, the
 * bundled `builtinFormulaFunctions`, the wire types shared with the engine
 * (`FormulaDisplayInfo`, `TokenUnit`, `CellRef`, ...) and small utils.
 *
 * The editor never tokenizes on its own: the host must supply
 * `getDisplayUnits` (usually via `createEngineFormulaSource` from `./engine`).
 * Without a `formulaFunctions` list, autocomplete and signature help are
 * silent — pass `builtinFormulaFunctions` for the default set. Hosts in this
 * repo: the root app's edit bar (via the React root) and the `/inline`
 * in-cell controller used alongside `logisheets-engine`.
 */

export {createFormulaEditor} from './editor'
export type {FormulaEditorHandle, FormulaEditorOptions} from './editor'

// Bundled default function metadata (autocomplete + signature help out-of-the-box)
export {builtinFormulaFunctions} from './functions'

export * from './types'
export * from './utils'
