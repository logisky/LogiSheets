import {describe, it, expect, beforeEach} from 'vitest'
import {
    registerRadioBinding,
    setRadioSelection,
    getRadioSelection,
    clearRadioBindings,
    registerMultiSelectBinding,
    setMultiSelectMax,
    toggleMultiSelectValue,
    getMultiSelectSelections,
    clearMultiSelectBindings,
    registerPointAllocator,
    setPointPool,
    adjustPointAllocation,
    getPointAllocations,
    getPointPool,
    clearPointAllocators,
    registerNumberSlider,
    clearNumberSliders,
    registerPercentAllocator,
    clearPercentAllocators,
    getPersistentInteractions,
    loadPersistentInteractions,
} from './index'

// Reset all module-level state between tests — the module is a singleton.
beforeEach(() => {
    clearRadioBindings()
    clearMultiSelectBindings()
    clearPointAllocators()
    clearNumberSliders()
    clearPercentAllocators()
})

describe('craft-interactions persistence', () => {
    it('round-trips radio selections', () => {
        registerRadioBinding({
            type: 'radio',
            groupId: 'g1',
            sheetIdx: 0,
            blockId: 1,
            row: 0,
            col: 0,
            value: 'a',
        })
        setRadioSelection('g1', 'a')
        setRadioSelection('g2', 'b')

        const snapshot = getPersistentInteractions()
        expect(snapshot.radioSelections).toEqual({g1: 'a', g2: 'b'})

        clearRadioBindings()
        expect(getRadioSelection('g1')).toBeUndefined()

        loadPersistentInteractions(snapshot)
        expect(getRadioSelection('g1')).toBe('a')
        expect(getRadioSelection('g2')).toBe('b')
    })

    it('round-trips multi-select selections', () => {
        registerMultiSelectBinding({
            type: 'multiSelect',
            groupId: 'm1',
            sheetIdx: 0,
            blockId: 1,
            row: 0,
            col: 0,
            value: 'x',
        })
        setMultiSelectMax('m1', 3)
        toggleMultiSelectValue('m1', 'x')
        toggleMultiSelectValue('m1', 'y')

        const snapshot = getPersistentInteractions()
        expect(snapshot.multiSelectSelections).toEqual({m1: ['x', 'y']})

        clearMultiSelectBindings()
        expect(getMultiSelectSelections('m1')).toEqual([])

        // Craft re-registers and re-sets the max on boot — simulate that here
        // so toggleMultiSelectValue would respect the cap if called again.
        setMultiSelectMax('m1', 3)
        loadPersistentInteractions(snapshot)
        expect(getMultiSelectSelections('m1').sort()).toEqual(['x', 'y'])
    })

    it('round-trips point allocations', () => {
        registerPointAllocator({
            type: 'pointAllocator',
            groupId: 'p1',
            sheetIdx: 0,
            blockId: 1,
            row: 0,
            col: 0,
        })
        registerPointAllocator({
            type: 'pointAllocator',
            groupId: 'p1',
            sheetIdx: 0,
            blockId: 1,
            row: 1,
            col: 0,
        })
        setPointPool('p1', 10)
        adjustPointAllocation(
            {groupId: 'p1', blockId: 1, row: 0, col: 0},
            3
        )
        adjustPointAllocation(
            {groupId: 'p1', blockId: 1, row: 1, col: 0},
            2
        )

        const snapshot = getPersistentInteractions()
        expect(snapshot.pointAllocations.p1).toEqual(
            expect.arrayContaining([
                {blockId: 1, row: 0, col: 0, points: 3},
                {blockId: 1, row: 1, col: 0, points: 2},
            ])
        )

        clearPointAllocators()
        expect(getPointAllocations('p1')).toEqual([])

        // Craft re-registers bindings and re-sets the pool on boot.
        setPointPool('p1', 10)
        loadPersistentInteractions(snapshot)

        const restored = getPointAllocations('p1').sort(
            (a, b) => a.row - b.row
        )
        expect(restored).toEqual([
            {blockId: 1, row: 0, col: 0, points: 3},
            {blockId: 1, row: 1, col: 0, points: 2},
        ])
        // Pool accounting reflects the restored allocations.
        expect(getPointPool('p1')).toEqual({total: 10, used: 5, remaining: 5})
    })

    it('does not persist bindings, pool totals, max-counts, or number-slider/percent state', () => {
        registerRadioBinding({
            type: 'radio',
            groupId: 'g1',
            sheetIdx: 0,
            blockId: 1,
            row: 0,
            col: 0,
            value: 'a',
        })
        registerMultiSelectBinding({
            type: 'multiSelect',
            groupId: 'm1',
            sheetIdx: 0,
            blockId: 1,
            row: 0,
            col: 0,
            value: 'x',
        })
        setMultiSelectMax('m1', 5)
        registerPointAllocator({
            type: 'pointAllocator',
            groupId: 'p1',
            sheetIdx: 0,
            blockId: 1,
            row: 0,
            col: 0,
        })
        setPointPool('p1', 20)
        registerNumberSlider({
            type: 'numberSlider',
            groupId: 'n1',
            sheetIdx: 0,
            blockId: 1,
            row: 0,
            col: 0,
            min: 0,
            max: 10,
        })
        registerPercentAllocator({
            type: 'percentAllocator',
            groupId: 'pct1',
            sheetIdx: 0,
            blockId: 1,
            row: 0,
            col: 0,
        })

        // Snapshot includes bindings (so the renderer can re-paint
        // overlays after load) plus user-mutated state (selections /
        // allocations). Slider values and percent allocations live in
        // cells — only their bindings are persisted, not their values.
        const snapshot = getPersistentInteractions()
        expect(snapshot.radioBindings).toHaveLength(1)
        expect(snapshot.multiSelectBindings).toHaveLength(1)
        expect(snapshot.pointBindings).toHaveLength(1)
        expect(snapshot.numberSliderBindings).toHaveLength(1)
        expect(snapshot.percentBindings).toHaveLength(1)
        expect(snapshot.multiSelectMax).toEqual({m1: 5})
        expect(snapshot.pointPoolTotals).toEqual({p1: 20})
        // No user mutation happened → selection / allocation maps empty.
        expect(snapshot.radioSelections).toEqual({})
        expect(snapshot.multiSelectSelections).toEqual({})
        expect(snapshot.pointAllocations).toEqual({})
    })

    it('survives JSON.stringify → JSON.parse (the actual save path)', () => {
        setRadioSelection('g1', 'a')
        registerMultiSelectBinding({
            type: 'multiSelect',
            groupId: 'm1',
            sheetIdx: 0,
            blockId: 1,
            row: 0,
            col: 0,
            value: 'x',
        })
        setMultiSelectMax('m1', 5)
        toggleMultiSelectValue('m1', 'x')

        const wire = JSON.parse(JSON.stringify(getPersistentInteractions()))
        clearRadioBindings()
        clearMultiSelectBindings()

        setMultiSelectMax('m1', 5)
        loadPersistentInteractions(wire)

        expect(getRadioSelection('g1')).toBe('a')
        expect(getMultiSelectSelections('m1')).toEqual(['x'])
    })

    it('resets prior state when loading empty/undefined input', () => {
        // The load path is authoritative: opening a workbook with no
        // interaction state must clear whatever the previously-open workbook
        // left in memory, not leave it behind.
        setRadioSelection('seed', 'v')
        loadPersistentInteractions(undefined)
        expect(getRadioSelection('seed')).toBeUndefined()

        setRadioSelection('seed', 'v')
        loadPersistentInteractions(null)
        expect(getRadioSelection('seed')).toBeUndefined()
    })

    it('tolerates malformed input without throwing', () => {
        setRadioSelection('seed', 'v')
        // Each of these should be a safe reset, never a throw.
        expect(() => loadPersistentInteractions(null)).not.toThrow()
        expect(() => loadPersistentInteractions(undefined)).not.toThrow()
        expect(() => loadPersistentInteractions('not an object')).not.toThrow()
        expect(() =>
            loadPersistentInteractions({radioSelections: 'bogus'})
        ).not.toThrow()
        expect(() =>
            loadPersistentInteractions({
                pointAllocations: {bad: [{blockId: 'x'}]},
            })
        ).not.toThrow()

        // An empty-but-well-formed payload clears prior state (the load
        // path is authoritative — old in-memory state shouldn't bleed
        // across a file-open).
        loadPersistentInteractions({
            radioSelections: {},
            multiSelectSelections: {},
            pointAllocations: {},
        })
        expect(getRadioSelection('seed')).toBeUndefined()
    })
})
