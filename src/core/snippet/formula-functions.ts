import i18n from '@/core/i18n/i18n'
import type {FormulaFunction} from 'logisheets-formula-editor'
import {getAllFormulas} from './formulas'

/**
 * The formula function list for the editor's autocomplete + signature help,
 * with the i18n description KEYS from funcs.json (e.g.
 * "functions.second.description") resolved to the current locale's text.
 *
 * The base list passed around by the formula editor stores raw keys (it has no
 * i18n); resolving them is an app concern, done here once and cached.
 */
let cache: FormulaFunction[] | null = null

const resolve = (key: string): string => (key ? String(i18n.t(key)) : '')

export function getFormulaFunctions(): FormulaFunction[] {
    if (cache) return cache
    cache = getAllFormulas().map((f) => ({
        name: f.name,
        description: resolve(f.description),
        args: f.args.map((a) => ({
            argName: a.argName,
            description: resolve(a.description),
            startRepeated: a.startRepeated,
        })),
        argCount: f.argCount,
    }))
    return cache
}
