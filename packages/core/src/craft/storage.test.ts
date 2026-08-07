import {describe, it, expect, beforeEach} from 'vitest'
import {
    setCraftStorageBackend,
    makeCraftStorage,
    type CraftStorageBackend,
} from './storage'

const CRAFT_A = '/watson/index.html'
const CRAFT_B = '/what-if-calculator/index.html'

// A trivial in-test backend so the contract can be exercised without a browser
// or the desktop bridge. Mirrors the fallback backend's semantics.
function makeFakeBackend(): CraftStorageBackend {
    const crafts = new Map<string, Map<string, string>>()
    const ns = (id: string) => {
        let m = crafts.get(id)
        if (!m) crafts.set(id, (m = new Map()))
        return m
    }
    return {
        async get(id, key) {
            const v = ns(id).get(key)
            return v === undefined ? null : v
        },
        async set(id, key, value) {
            ns(id).set(key, value)
        },
        async remove(id, key) {
            ns(id).delete(key)
        },
        async keys(id) {
            return [...ns(id).keys()]
        },
        async clear(id) {
            crafts.delete(id)
        },
    }
}

describe('craft-storage handle', () => {
    beforeEach(() => {
        setCraftStorageBackend(makeFakeBackend())
    })

    it('stores and reads back a value scoped to the craft', async () => {
        const s = makeCraftStorage(CRAFT_A)
        await s.set('theme', 'dark')
        expect(await s.get('theme')).toBe('dark')
    })

    it('returns null for a key that was never set', async () => {
        const s = makeCraftStorage(CRAFT_A)
        expect(await s.get('missing')).toBeNull()
    })

    it('keeps namespaces isolated between crafts', async () => {
        const a = makeCraftStorage(CRAFT_A)
        const b = makeCraftStorage(CRAFT_B)
        await a.set('k', 'a-value')
        await b.set('k', 'b-value')
        expect(await a.get('k')).toBe('a-value')
        expect(await b.get('k')).toBe('b-value')
    })

    it('overwrites on re-set', async () => {
        const s = makeCraftStorage(CRAFT_A)
        await s.set('k', 'v1')
        await s.set('k', 'v2')
        expect(await s.get('k')).toBe('v2')
    })

    it('remove deletes a single key only', async () => {
        const s = makeCraftStorage(CRAFT_A)
        await s.set('a', '1')
        await s.set('b', '2')
        await s.remove('a')
        expect(await s.get('a')).toBeNull()
        expect(await s.get('b')).toBe('2')
    })

    it('keys lists only this craft keys', async () => {
        const a = makeCraftStorage(CRAFT_A)
        const b = makeCraftStorage(CRAFT_B)
        await a.set('x', '1')
        await a.set('y', '2')
        await b.set('z', '3')
        expect((await a.keys()).sort()).toEqual(['x', 'y'])
        expect(await b.keys()).toEqual(['z'])
    })

    it('clear wipes only the calling craft namespace', async () => {
        const a = makeCraftStorage(CRAFT_A)
        const b = makeCraftStorage(CRAFT_B)
        await a.set('x', '1')
        await b.set('z', '3')
        await a.clear()
        expect(await a.keys()).toEqual([])
        expect(await b.get('z')).toBe('3')
    })

    it('routes calls to whichever backend is active at call time', async () => {
        const s = makeCraftStorage(CRAFT_A)
        await s.set('k', 'first')
        // Swap the backend out from under the existing handle.
        setCraftStorageBackend(makeFakeBackend())
        expect(await s.get('k')).toBeNull()
        await s.set('k', 'second')
        expect(await s.get('k')).toBe('second')
    })
})
