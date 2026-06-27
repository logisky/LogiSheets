/**
 * Built-in formula function metadata (names, arg signatures, descriptions),
 * bundled so autocomplete + signature help (智能提示) work out-of-the-box with
 * no host wiring. Generated from the LogiSheets function set.
 *
 * Descriptions are i18n keys (e.g. "functions.abs.description"); a host with
 * its own localized strings can pass a resolved list via `formulaFunctions`
 * instead of using this default.
 */

import type {FormulaFunction} from './types'
import data from './builtin-functions.json'

export const builtinFormulaFunctions: FormulaFunction[] =
    data as FormulaFunction[]
