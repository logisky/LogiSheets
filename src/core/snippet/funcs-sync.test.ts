// The function list the formula editor offers (autocomplete, argument hints)
// must match the functions the engine computes.
//
// They live apart: the engine dispatches by name in
// crates/controller/src/calc_engine/calculator/funcs/mod.rs, while the editor
// reads one signature file per function from resources/funcs/*.json (merged
// into out/funcs.json, then copied into the formula-editor package). The list
// once fell 177 functions behind — IF, VLOOKUP and ROUNDUP computed fine but
// never showed up while typing.
//
// "Every engine function has a signature" is the Rust ratchet in
// tests/function_coverage.rs (cargo test). This covers the rest of the chain:
// nothing listed that the engine can't compute, a description in both
// languages, and the merged lists rebuilt from the sources.

import {readFileSync, readdirSync} from 'fs'
import {resolve} from 'path'
import {describe, expect, it} from 'vitest'

const repo = resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(resolve(repo, p), 'utf8')

/** Names that are functions to the user but not dispatched by mod.rs. */
const NOT_IN_DISPATCH = new Set([
    // Block references, resolved by the block manager before evaluation.
    'BLOCKREF',
    'BLOCKREFS',
])

/** Every name in mod.rs's dispatch `match`, minus internal `#` names. */
function engineFunctions(): Set<string> {
    const src = read(
        'crates/controller/src/calc_engine/calculator/funcs/mod.rs'
    )
    const body = src.slice(src.indexOf('match normalized {'))
    const names = new Set<string>()
    for (const arm of body.matchAll(/^\s*("[^"]+"(?:\s*\|\s*"[^"]+")*)\s*=>/gm))
        for (const [, name] of arm[1].matchAll(/"([^"]+)"/g))
            if (!name.startsWith('#')) names.add(name)
    return names
}

interface Signature {
    name: string
    description: string
}

function signatureFiles(): {file: string; sig: Signature}[] {
    return readdirSync(resolve(repo, 'resources/funcs'))
        .filter((f) => f.endsWith('.json'))
        .map((file) => ({
            file,
            sig: JSON.parse(read(`resources/funcs/${file}`)) as Signature,
        }))
}

/** `functions.norm.s.inv.description` in a locale file (dots nest). */
function lookup(locale: unknown, key: string): unknown {
    return key
        .split('.')
        .reduce<unknown>(
            (node, part) =>
                node && typeof node === 'object'
                    ? (node as Record<string, unknown>)[part]
                    : undefined,
            locale
        )
}

const sorted = (s: Iterable<string>) => [...s].sort()

describe('formula function list', () => {
    const engine = engineFunctions()
    const sigs = signatureFiles()
    const listed = new Set(sigs.map((s) => s.sig.name))

    it('reads the engine dispatch', () => {
        // Guards the parser above: a reshaped mod.rs must not pass vacuously.
        expect(engine.size).toBeGreaterThan(250)
        expect(engine).toContain('ROUNDUP')
    })

    it('lists nothing the engine cannot compute', () => {
        const extra = sorted(
            [...listed].filter((n) => !engine.has(n) && !NOT_IN_DISPATCH.has(n))
        )
        expect(extra).toEqual([])
    })

    it('names each file after its function, with its description key', () => {
        for (const {file, sig} of sigs) {
            expect(sig.name, file).toBe(sig.name.toUpperCase())
            expect(file).toBe(`${sig.name.toLowerCase()}.json`)
            expect(sig.description, file).toBe(
                `functions.${sig.name.toLowerCase()}.description`
            )
        }
    })

    it('describes every function in both languages', () => {
        const en = JSON.parse(read('resources/locale/en.json'))
        const zh = JSON.parse(read('resources/locale/zh-CN.json'))
        const missing: string[] = []
        for (const {sig} of sigs)
            for (const [lang, locale] of [
                ['en', en],
                ['zh-CN', zh],
            ] as const) {
                const text = lookup(locale, sig.description)
                if (typeof text !== 'string' || !text.trim())
                    missing.push(`${lang} ${sig.description}`)
            }
        expect(missing).toEqual([])
    })

    it('has the merged lists regenerated', () => {
        // resources/funcs/out/funcs.json: `node scripts/index.ts` (merge).
        const merged = JSON.parse(
            read('resources/funcs/out/funcs.json')
        ) as Signature[]
        expect(sorted(merged.map((f) => f.name))).toEqual(sorted(listed))
        // The formula editor's copy: packages/formula-editor
        // `node scripts/gen-builtin-functions.mjs`.
        const builtin = JSON.parse(
            read('packages/formula-editor/src/lib/builtin-functions.json')
        ) as Signature[]
        expect(sorted(builtin.map((f) => f.name))).toEqual(sorted(listed))
    })
})
