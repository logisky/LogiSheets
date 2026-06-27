/**
 * Regenerate src/lib/builtin-functions.json — the bundled default function
 * metadata for autocomplete / signature help — from the repo's function set,
 * with i18n description KEYS resolved to English text (so consumers who don't
 * pass their own localized list get readable descriptions out-of-the-box).
 *
 * Monorepo dev tool: reads from ../../../resources. Run after the function set
 * or its English strings change:
 *
 *   node scripts/gen-builtin-functions.mjs   (or: yarn gen:functions)
 */
import {readFileSync, writeFileSync} from 'fs'
import {fileURLToPath} from 'url'
import {dirname, resolve} from 'path'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../..')

const funcs = JSON.parse(
    readFileSync(resolve(repoRoot, 'resources/funcs/out/funcs.json'), 'utf8')
)
const en = JSON.parse(
    readFileSync(resolve(repoRoot, 'resources/locale/en.json'), 'utf8')
)

const lookup = (obj, key) =>
    key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)

// Resolve an i18n key to its English string; leave the key as-is if missing.
const t = (key) => {
    if (!key) return key
    const v = lookup(en, key)
    return typeof v === 'string' ? v : key
}

const out = funcs.map((f) => ({
    ...f,
    description: t(f.description),
    args: (f.args ?? []).map((a) =>
        a.description ? {...a, description: t(a.description)} : a
    ),
}))

const dest = resolve(here, '../src/lib/builtin-functions.json')
writeFileSync(dest, JSON.stringify(out, null, 2) + '\n')

console.log(`Wrote ${out.length} functions to ${dest}`)
const stillKeys = out.filter((f) => /^functions\./.test(f.description)).length
if (stillKeys) console.warn(`  ${stillKeys} description(s) had no English string and kept their key`)
