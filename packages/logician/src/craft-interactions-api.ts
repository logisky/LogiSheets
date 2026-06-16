/**
 * CraftInteractionsApi — the host capability surface for craft-defined
 * cell-overlay widgets (radio groups, multi-select, point allocators,
 * percent allocators, number sliders).
 *
 * Scope: BUILD + READ. This mirrors what the host injects into a craft
 * iframe (`injectCraftInteractionAPIs`): a craft *registers* overlays onto
 * block cells and *reads* what the user selected — it does NOT
 * programmatically set selections (the user operates the overlay by
 * clicking). Watson, being a craft that builds factory-simulator-like
 * apps, needs exactly this build+read surface.
 *
 * Why an interface in logician (not an import of the host module):
 * craft-interaction state is module singletons in the browser host
 * (`src/core/craft-interactions`), which logician must not depend on —
 * logician is platform-agnostic and reusable from a Node CLI / MCP server.
 * The host implements this interface and passes it via
 * `ToolContext.craftInteractions`; tools program against the interface
 * only and report "not available" when it's absent.
 *
 * Method names and binding shapes mirror the injected window API 1:1, so
 * the Watson host adapter is a thin pass-through:
 *   { registerRadio: window.registerRadio, ... }
 */

/** A cell an overlay binds to. `row`/`col` are block-relative offsets —
 *  the same coordinates the host singletons use. Tools resolve these from
 *  (block ref, field, row_key) via the block schema before calling. */
export interface InteractionCell {
    groupId: string
    sheetIdx: number
    blockId: number
    row: number
    col: number
}

export interface RadioBindingArg extends InteractionCell {
    value: string
}

export interface MultiSelectBindingArg extends InteractionCell {
    value: string
}

export type PointAllocatorBindingArg = InteractionCell

export type PercentAllocatorBindingArg = InteractionCell

export interface NumberSliderBindingArg extends InteractionCell {
    min: number
    max: number
    step?: number
    initialValue?: number
}

export interface PointAllocationInfo {
    blockId: number
    row: number
    col: number
    points: number
}

/**
 * Register + read surface. All methods are synchronous: the host holds
 * overlay bindings and the user's selections in memory, and registration
 * does not touch the workbook transaction/undo stack.
 */
export interface CraftInteractionsApi {
    // ---- Register (build) ----------------------------------------------
    registerRadio(binding: RadioBindingArg): void
    registerMultiSelect(binding: MultiSelectBindingArg): void
    setMultiSelectMax(groupId: string, max: number): void
    registerPointAllocator(binding: PointAllocatorBindingArg): void
    setPointPool(groupId: string, total: number): void
    registerPercentAllocator(binding: PercentAllocatorBindingArg): void
    registerNumberSlider(binding: NumberSliderBindingArg): void

    // ---- Clear ----------------------------------------------------------
    // Each clears one group when given a groupId. Passing undefined wipes
    // every group of that kind — tools require an explicit groupId to
    // avoid an accidental "clear all".
    clearRadios(groupId?: string): void
    clearMultiSelects(groupId?: string): void
    clearPointAllocators(groupId?: string): void
    clearPercentAllocators(groupId?: string): void
    clearNumberSliders(groupId?: string): void

    // ---- Read user results ---------------------------------------------
    getRadioSelection(groupId: string): string | undefined
    getMultiSelectSelections(groupId: string): readonly string[]
    getPointPool(groupId: string): {
        total: number
        used: number
        remaining: number
    }
    getPointAllocations(groupId: string): readonly PointAllocationInfo[]
}
