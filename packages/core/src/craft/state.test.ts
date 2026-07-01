import {describe, it, expect, beforeEach} from 'vitest'
import {
    setCraftState,
    getCraftState,
    clearCraftState,
    getPersistentCraftStates,
    loadPersistentCraftStates,
} from './state'

const CRAFT_A = '/data-gateway/index.html'
const CRAFT_B = '/what-if-calculator/index.html'

describe('craft-state store', () => {
    // The store is module-level singleton state; reset it between tests.
    beforeEach(() => {
        loadPersistentCraftStates(undefined)
    })

    it('stores and reads back a craft state by id', () => {
        setCraftState(CRAFT_A, '{"rules":3}')
        expect(getCraftState(CRAFT_A)).toBe('{"rules":3}')
    })

    it('returns undefined for a craft that never stored state', () => {
        expect(getCraftState(CRAFT_B)).toBeUndefined()
    })

    it('ignores an empty craftId', () => {
        setCraftState('', '{"x":1}')
        expect(getPersistentCraftStates()).toEqual({})
    })

    it('keeps per-craft states isolated and overwrites on re-set', () => {
        setCraftState(CRAFT_A, 'a1')
        setCraftState(CRAFT_B, 'b1')
        setCraftState(CRAFT_A, 'a2')
        expect(getCraftState(CRAFT_A)).toBe('a2')
        expect(getCraftState(CRAFT_B)).toBe('b1')
    })

    it('clearCraftState removes only the targeted craft', () => {
        setCraftState(CRAFT_A, 'a')
        setCraftState(CRAFT_B, 'b')
        clearCraftState(CRAFT_A)
        expect(getCraftState(CRAFT_A)).toBeUndefined()
        expect(getCraftState(CRAFT_B)).toBe('b')
    })

    it('round-trips through persist/load (treating data as opaque)', () => {
        setCraftState(CRAFT_A, '{"validations":[{"cell":"A1","rule":">0"}]}')
        setCraftState(CRAFT_B, 'not-even-json-just-a-string')

        const snapshot = getPersistentCraftStates()
        expect(snapshot).toEqual({
            [CRAFT_A]: '{"validations":[{"cell":"A1","rule":">0"}]}',
            [CRAFT_B]: 'not-even-json-just-a-string',
        })

        // Simulate save → reload into a fresh store.
        loadPersistentCraftStates(undefined)
        expect(getPersistentCraftStates()).toEqual({})

        loadPersistentCraftStates(snapshot)
        expect(getCraftState(CRAFT_A)).toBe(
            '{"validations":[{"cell":"A1","rule":">0"}]}'
        )
        expect(getCraftState(CRAFT_B)).toBe('not-even-json-just-a-string')
    })

    // The bug this guards: loading a workbook whose state lacks a given craft
    // (or has no craft state at all) must NOT leave the previously-open
    // workbook's state behind.
    it('replaces existing state on load instead of merging', () => {
        setCraftState(CRAFT_A, 'stale')
        loadPersistentCraftStates({[CRAFT_B]: 'fresh'})
        expect(getCraftState(CRAFT_A)).toBeUndefined()
        expect(getCraftState(CRAFT_B)).toBe('fresh')
    })

    it('clears everything when loading undefined/empty', () => {
        setCraftState(CRAFT_A, 'stale')
        loadPersistentCraftStates(undefined)
        expect(getPersistentCraftStates()).toEqual({})
    })

    it('ignores non-string entries when loading', () => {
        loadPersistentCraftStates({
            [CRAFT_A]: 'ok',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            [CRAFT_B]: {nested: true} as any,
        })
        expect(getCraftState(CRAFT_A)).toBe('ok')
        expect(getCraftState(CRAFT_B)).toBeUndefined()
    })
})
