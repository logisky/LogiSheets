import {describe, expect, it} from 'vitest'
import type {Client} from 'logisheets-web/pure'
import type {EnumVariant} from 'logisheets-engine'
import {hydrateEnumSetsFromWorkbook, type EnumRegistry} from './enum-hydrate'

/**
 * The workbook decides which sets exist and what options each has; the host
 * contributes only colour. Without this merge, a workbook authored headless
 * opens in the browser with its enum fields validated correctly by the engine
 * and yet showing an empty dropdown.
 */

function client(
    sets: Array<{
        id: string
        name: string
        variants: Array<{id: string; label: string}>
    }>
): Client {
    return {getEnumSets: async () => sets} as unknown as Client
}

function registry(initial: Record<string, EnumVariant[]> = {}) {
    const store = new Map<string, {variants: EnumVariant[]; name: string}>()
    for (const [id, variants] of Object.entries(initial)) {
        store.set(id, {variants, name: id})
    }
    const reg: EnumRegistry & {
        dump(): Record<string, EnumVariant[]>
    } = {
        get: (id) => store.get(id),
        set: (id, name, variants) => store.set(id, {name, variants}),
        dump: () =>
            Object.fromEntries(
                [...store.entries()].map(([k, v]) => [k, v.variants])
            ),
    }
    return reg
}

describe('hydrateEnumSetsFromWorkbook', () => {
    it('adopts a set the host had never heard of, colouring it from a palette', () => {
        const reg = registry()
        return hydrateEnumSetsFromWorkbook(
            client([
                {
                    id: 'status',
                    name: 'Order status',
                    variants: [
                        {id: 'open', label: 'Open'},
                        {id: 'done', label: 'Done'},
                    ],
                },
            ]),
            reg
        ).then((r) => {
            expect(r).toEqual({sets: 1, coloured: 2})
            const status = reg.dump()['status']
            expect(status.map((v) => [v.id, v.value])).toEqual([
                ['open', 'Open'],
                ['done', 'Done'],
            ])
            expect(status.every((v) => /^#[0-9a-f]{6}$/i.test(v.color))).toBe(
                true
            )
        })
    })

    it('keeps a colour the host already held for that variant', async () => {
        // A colour is a preference. Re-rolling it on every open would change
        // the sheet's appearance for no reason.
        const reg = registry({
            status: [{id: 'open', value: 'stale label', color: '#123456'}],
        })
        const r = await hydrateEnumSetsFromWorkbook(
            client([
                {
                    id: 'status',
                    name: '',
                    variants: [
                        {id: 'open', label: 'Open'},
                        {id: 'done', label: 'Done'},
                    ],
                },
            ]),
            reg
        )
        expect(r.coloured).toBe(1)
        const status = reg.dump()['status']
        expect(status[0].color).toBe('#123456')
        // But the LABEL comes from the workbook — that half is not the host's.
        expect(status[0].value).toBe('Open')
    })

    it('drops an option the workbook no longer has', async () => {
        const reg = registry({
            status: [
                {id: 'open', value: 'Open', color: '#111111'},
                {id: 'gone', value: 'Gone', color: '#222222'},
            ],
        })
        await hydrateEnumSetsFromWorkbook(
            client([
                {
                    id: 'status',
                    name: '',
                    variants: [{id: 'open', label: 'Open'}],
                },
            ]),
            reg
        )
        expect(reg.dump()['status'].map((v) => v.id)).toEqual(['open'])
    })

    it('leaves the registry alone when the client cannot answer', async () => {
        const reg = registry({keep: [{id: 'a', value: 'A', color: '#000000'}]})
        const broken = {
            getEnumSets: async () => ({msg: 'nope', ty: 0}),
        } as unknown as Client
        const r = await hydrateEnumSetsFromWorkbook(broken, reg)
        expect(r).toEqual({sets: 0, coloured: 0})
        expect(reg.dump()['keep']).toHaveLength(1)
    })
})
