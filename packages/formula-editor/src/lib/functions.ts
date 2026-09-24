/**
 * Built-in formula function metadata (names, arg signatures, descriptions),
 * bundled so autocomplete + signature help work out-of-the-box with
 * no host wiring. Generated from the LogiSheets function set by
 * scripts/gen-builtin-functions.mjs (`yarn gen:functions`) — do not edit the
 * JSON by hand.
 *
 * Descriptions are English text (the generator resolves the i18n keys against
 * resources/locale/en.json); most args carry no description. A host with its
 * own localized strings passes a resolved list via `formulaFunctions` instead
 * — the root app does, from src/core/snippet.
 */

import type {FormulaFunction} from './types'
import data from './builtin-functions.json'

export const builtinFormulaFunctions: FormulaFunction[] =
    data as FormulaFunction[]
