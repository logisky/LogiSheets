/**
 * A {@link CraftInteractionsApi} implementation backed directly by
 * logisheets-core's craft-interactions singletons.
 *
 * Use this when logician runs IN-PROCESS with the engine logic — i.e. a Node
 * runtime (logisheets-runtime), or any non-iframe host. The browser/Watson
 * path still uses the window-global adapter, because a craft iframe has its
 * own module instances and must bridge to the *host page's* singletons across
 * the iframe boundary; importing core there would yield a fresh, isolated
 * store. In-process (Node), there is no boundary, so delegating straight to
 * core is correct and removes the window dependency entirely.
 */

import {
    registerRadioBinding,
    clearRadioBindings,
    getRadioSelection,
    registerMultiSelectBinding,
    setMultiSelectMax,
    clearMultiSelectBindings,
    getMultiSelectSelections,
    registerPointAllocator,
    setPointPool,
    clearPointAllocators,
    getPointPool,
    getPointAllocations,
    registerPercentAllocator,
    clearPercentAllocators,
    registerNumberSlider,
    clearNumberSliders,
} from 'logisheets-core'
import type {CraftInteractionsApi} from './craft-interactions-api.js'

export function createCoreCraftInteractions(): CraftInteractionsApi {
    return {
        registerRadio: (b) =>
            registerRadioBinding({type: 'radio', ...b}),
        registerMultiSelect: (b) =>
            registerMultiSelectBinding({type: 'multiSelect', ...b}),
        setMultiSelectMax: (groupId, max) => setMultiSelectMax(groupId, max),
        registerPointAllocator: (b) =>
            registerPointAllocator({type: 'pointAllocator', ...b}),
        setPointPool: (groupId, total) => setPointPool(groupId, total),
        registerPercentAllocator: (b) =>
            registerPercentAllocator({type: 'percentAllocator', ...b}),
        registerNumberSlider: (b) =>
            registerNumberSlider({type: 'numberSlider', ...b}),

        clearRadios: (groupId) => clearRadioBindings(groupId),
        clearMultiSelects: (groupId) => clearMultiSelectBindings(groupId),
        clearPointAllocators: (groupId) => clearPointAllocators(groupId),
        clearPercentAllocators: (groupId) => clearPercentAllocators(groupId),
        clearNumberSliders: (groupId) => clearNumberSliders(groupId),

        getRadioSelection: (groupId) => getRadioSelection(groupId),
        getMultiSelectSelections: (groupId) =>
            getMultiSelectSelections(groupId),
        getPointPool: (groupId) => getPointPool(groupId),
        getPointAllocations: (groupId) => getPointAllocations(groupId),
    }
}
