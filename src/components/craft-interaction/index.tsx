import {useEffect, useState} from 'react'
import type {Grid} from 'logisheets-engine'
import {
    subscribeRadioBindings,
    registerRadioBinding,
    unregisterRadioBinding,
    clearRadioBindings,
    getRadioSelection,
    type RadioBinding,
    registerMultiSelectBinding,
    unregisterMultiSelectBinding,
    clearMultiSelectBindings,
    setMultiSelectMax,
    getMultiSelectSelections,
    type MultiSelectBinding,
    registerPointAllocator,
    unregisterPointAllocator,
    clearPointAllocators,
    setPointPool,
    getPointPool,
    getPointAllocations,
    type PointAllocatorBinding,
    registerNumberSlider,
    unregisterNumberSlider,
    clearNumberSliders,
    type NumberSliderBinding,
    registerPercentAllocator,
    unregisterPercentAllocator,
    clearPercentAllocators,
    type PercentAllocatorBinding,
} from 'logisheets-core'
import {makeCellResolver} from './cell-rect'
import {RadioLayer} from './radio'
import {MultiSelectLayer} from './multi-select'
import {PointAllocatorLayer} from './point-allocator'
import {NumberSliderLayer} from './number-slider'
import {PercentAllocatorLayer} from './percent-allocator'

export interface CraftInteractionProps {
    grid: Grid
    activeSheet: number
}

export const CraftInteractionComponent = ({
    grid,
    activeSheet,
}: CraftInteractionProps) => {
    const [, forceRender] = useState(0)
    useEffect(() => {
        return subscribeRadioBindings(() => forceRender((v) => v + 1))
    }, [])

    const resolver = makeCellResolver(grid)

    return (
        <>
            <RadioLayer activeSheet={activeSheet} resolver={resolver} />
            <MultiSelectLayer activeSheet={activeSheet} resolver={resolver} />
            <PointAllocatorLayer
                activeSheet={activeSheet}
                resolver={resolver}
            />
            <NumberSliderLayer
                activeSheet={activeSheet}
                resolver={resolver}
                grid={grid}
            />
            <PercentAllocatorLayer
                activeSheet={activeSheet}
                resolver={resolver}
                grid={grid}
            />
        </>
    )
}

// APIs injected into the craft iframe. This layer never mutates blocks — the
// craft drives interaction lifecycle and queries the result on demand.
export function injectCraftInteractionAPIs(win: Window): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = win as any

    w.registerRadio = (binding: RadioBinding) => registerRadioBinding(binding)
    w.unregisterRadio = (
        binding: Pick<RadioBinding, 'groupId' | 'blockId' | 'row' | 'col'>
    ) => unregisterRadioBinding(binding)
    w.clearRadios = (groupId?: string) => clearRadioBindings(groupId)
    w.getRadioSelection = (groupId: string) => getRadioSelection(groupId)

    w.registerMultiSelect = (binding: MultiSelectBinding) =>
        registerMultiSelectBinding(binding)
    w.unregisterMultiSelect = (
        binding: Pick<MultiSelectBinding, 'groupId' | 'blockId' | 'row' | 'col'>
    ) => unregisterMultiSelectBinding(binding)
    w.clearMultiSelects = (groupId?: string) =>
        clearMultiSelectBindings(groupId)
    w.setMultiSelectMax = (groupId: string, max: number) =>
        setMultiSelectMax(groupId, max)
    w.getMultiSelectSelections = (groupId: string) =>
        getMultiSelectSelections(groupId)

    w.registerPointAllocator = (binding: PointAllocatorBinding) =>
        registerPointAllocator(binding)
    w.unregisterPointAllocator = (
        binding: Pick<
            PointAllocatorBinding,
            'groupId' | 'blockId' | 'row' | 'col'
        >
    ) => unregisterPointAllocator(binding)
    w.clearPointAllocators = (groupId?: string) => clearPointAllocators(groupId)
    w.setPointPool = (groupId: string, total: number) =>
        setPointPool(groupId, total)
    w.getPointPool = (groupId: string) => getPointPool(groupId)
    w.getPointAllocations = (groupId: string) => getPointAllocations(groupId)

    w.registerNumberSlider = (binding: NumberSliderBinding) =>
        registerNumberSlider(binding)
    w.unregisterNumberSlider = (
        binding: Pick<
            NumberSliderBinding,
            'groupId' | 'blockId' | 'row' | 'col'
        >
    ) => unregisterNumberSlider(binding)
    w.clearNumberSliders = (groupId?: string) => clearNumberSliders(groupId)

    w.registerPercentAllocator = (binding: PercentAllocatorBinding) =>
        registerPercentAllocator(binding)
    w.unregisterPercentAllocator = (
        binding: Pick<
            PercentAllocatorBinding,
            'groupId' | 'blockId' | 'row' | 'col'
        >
    ) => unregisterPercentAllocator(binding)
    w.clearPercentAllocators = (groupId?: string) =>
        clearPercentAllocators(groupId)
}
