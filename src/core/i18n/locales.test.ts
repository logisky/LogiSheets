import {describe, expect, it} from 'vitest'
import en from '../../../resources/locale/en.json'
import zhCN from '../../../resources/locale/zh-CN.json'

/**
 * The two dictionaries have to stay the same shape.
 *
 * A missing key does not fail loudly — i18next falls back to English and the
 * app looks fine to whoever is testing it in English. That is exactly how the
 * Chinese file ended up four function descriptions behind without anyone
 * noticing, and how the whole `cn`-vs-`zh-CN` mismatch survived: the failure
 * mode of translation is silence.
 *
 * An untranslated VALUE is a different matter — some entries are the same word
 * in both languages on purpose ("Watson"), so identical strings are not an
 * error. What this pins is the key set and the absence of empties.
 */

type Json = {[k: string]: Json | string}

function flatten(obj: Json, prefix = ''): Map<string, string> {
    const out = new Map<string, string>()
    for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}.${k}` : k
        if (typeof v === 'string') out.set(key, v)
        else for (const [kk, vv] of flatten(v, key)) out.set(kk, vv)
    }
    return out
}

const EN = flatten(en as Json)
const ZH = flatten(zhCN as Json)

describe('locale dictionaries', () => {
    it('have exactly the same keys', () => {
        const onlyEn = [...EN.keys()].filter((k) => !ZH.has(k)).sort()
        const onlyZh = [...ZH.keys()].filter((k) => !EN.has(k)).sort()
        expect({onlyEn, onlyZh}).toEqual({onlyEn: [], onlyZh: []})
    })

    it('have no empty values', () => {
        const empty = [...EN, ...ZH]
            .filter(([, v]) => v.trim() === '')
            .map(([k]) => k)
        expect(empty).toEqual([])
    })

    it('agree on interpolation placeholders', () => {
        // `Read file {{name}}` translated without its `{{name}}` silently drops
        // the filename — a bug that only shows in the other language.
        const placeholders = (s: string) =>
            [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort()
        const mismatched: string[] = []
        for (const [k, v] of EN) {
            const zh = ZH.get(k)
            if (zh === undefined) continue
            if (
                JSON.stringify(placeholders(v)) !==
                JSON.stringify(placeholders(zh))
            ) {
                mismatched.push(k)
            }
        }
        expect(mismatched).toEqual([])
    })
})

/**
 * Every key the source asks for has to exist.
 *
 * `t('toolbar.home.blod')` does not throw — i18next returns the key itself, so
 * the UI quietly shows `toolbar.home.blod` to the user. That is the same
 * failure as a missing translation, one step earlier, and it is just as quiet.
 */
describe('translation keys referenced in source', () => {
    it('all exist in the dictionaries', async () => {
        const {readFileSync, readdirSync, statSync} = await import('node:fs')
        const {join} = await import('node:path')

        const files: string[] = []
        const walk = (dir: string) => {
            for (const e of readdirSync(dir)) {
                const p = join(dir, e)
                if (statSync(p).isDirectory()) walk(p)
                else if (/\.tsx?$/.test(p) && !p.includes('.test.'))
                    files.push(p)
            }
        }
        walk('src')

        // Plural forms live under `_one` / `_other`; the call site names the base.
        const known = new Set(
            [...EN.keys()].map((k) =>
                k.replace(/_(one|other|zero|many|few)$/, '')
            )
        )

        const missing = new Set<string>()
        for (const f of files) {
            const src = readFileSync(f, 'utf8')
            for (const m of src.matchAll(
                /\bt\(\s*['"]([a-z][\w.]*\.[\w.]+)['"]/g
            )) {
                if (!known.has(m[1])) missing.add(`${f}: ${m[1]}`)
            }
        }
        expect([...missing].sort()).toEqual([])
    })
})
