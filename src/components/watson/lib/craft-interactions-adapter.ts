/**
 * Browser adapter: bridges logician's `CraftInteractionsApi` to the
 * craft-interaction functions the LogiSheets host injects onto the craft
 * iframe's `window` (see `injectCraftInteractionAPIs` in the host).
 *
 * logician is platform-agnostic and only knows the `CraftInteractionsApi`
 * interface; this adapter is the one place that touches `window.*`. It:
 *   - adds the `type` discriminator each host `register*` call expects
 *     (logician's binding args omit it),
 *   - returns `undefined` when the host predates the craft-interaction
 *     API (older host, or a non-craft embedding) so the Agent simply
 *     runs without craft-interaction tools instead of crashing.
 */

import type {
    CraftInteractionsApi,
    MultiSelectBindingArg,
    NumberSliderBindingArg,
    PercentAllocatorBindingArg,
    PointAllocatorBindingArg,
    RadioBindingArg,
} from 'logician'

/** The subset of the injected window surface we rely on. All optional —
 *  presence is feature-detected before building the adapter. */
interface CraftInteractionWindow {
    registerRadio?: (b: unknown) => void
    clearRadios?: (groupId?: string) => void
    getRadioSelection?: (groupId: string) => string | undefined

    registerMultiSelect?: (b: unknown) => void
    clearMultiSelects?: (groupId?: string) => void
    setMultiSelectMax?: (groupId: string, max: number) => void
    getMultiSelectSelections?: (groupId: string) => string[]

    registerPointAllocator?: (b: unknown) => void
    clearPointAllocators?: (groupId?: string) => void
    setPointPool?: (groupId: string, total: number) => void
    getPointPool?: (groupId: string) => {
        total: number
        used: number
        remaining: number
    }
    getPointAllocations?: (groupId: string) => Array<{
        blockId: number
        row: number
        col: number
        points: number
    }>

    registerPercentAllocator?: (b: unknown) => void
    clearPercentAllocators?: (groupId?: string) => void

    registerNumberSlider?: (b: unknown) => void
    clearNumberSliders?: (groupId?: string) => void
}

/**
 * Build a `CraftInteractionsApi` from the injected window functions, or
 * return `undefined` if the host hasn't injected them (feature-detected
 * via the always-present `registerRadio`). Pass the result to
 * `new Agent({ craftInteractions })` — omitting it disables the craft-
 * interaction tools cleanly.
 */
export function makeCraftInteractionsApi(
    win: Window = window
): CraftInteractionsApi | undefined {
    const w = win as unknown as CraftInteractionWindow
    if (typeof w.registerRadio !== 'function') {
        // Host predates the craft-interaction API (or this isn't a craft
        // embedding). No overlays available.
        return undefined
    }

    return {
        // ---- Register (build) ------------------------------------------
        registerRadio: (b: RadioBindingArg) =>
            w.registerRadio?.({type: 'radio', ...b}),
        registerMultiSelect: (b: MultiSelectBindingArg) =>
            w.registerMultiSelect?.({type: 'multiSelect', ...b}),
        setMultiSelectMax: (groupId: string, max: number) =>
            w.setMultiSelectMax?.(groupId, max),
        registerPointAllocator: (b: PointAllocatorBindingArg) =>
            w.registerPointAllocator?.({type: 'pointAllocator', ...b}),
        setPointPool: (groupId: string, total: number) =>
            w.setPointPool?.(groupId, total),
        registerPercentAllocator: (b: PercentAllocatorBindingArg) =>
            w.registerPercentAllocator?.({type: 'percentAllocator', ...b}),
        registerNumberSlider: (b: NumberSliderBindingArg) =>
            w.registerNumberSlider?.({type: 'numberSlider', ...b}),

        // ---- Clear ------------------------------------------------------
        clearRadios: (groupId?: string) => w.clearRadios?.(groupId),
        clearMultiSelects: (groupId?: string) => w.clearMultiSelects?.(groupId),
        clearPointAllocators: (groupId?: string) =>
            w.clearPointAllocators?.(groupId),
        clearPercentAllocators: (groupId?: string) =>
            w.clearPercentAllocators?.(groupId),
        clearNumberSliders: (groupId?: string) =>
            w.clearNumberSliders?.(groupId),

        // ---- Read user results -----------------------------------------
        getRadioSelection: (groupId: string) =>
            w.getRadioSelection?.(groupId),
        getMultiSelectSelections: (groupId: string) =>
            w.getMultiSelectSelections?.(groupId) ?? [],
        getPointPool: (groupId: string) =>
            w.getPointPool?.(groupId) ?? {total: 0, used: 0, remaining: 0},
        getPointAllocations: (groupId: string) =>
            w.getPointAllocations?.(groupId) ?? [],
    }
}
