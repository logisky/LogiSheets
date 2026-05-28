export interface RadioBinding {
    type: 'radio'
    groupId: string
    sheetIdx: number
    blockId: number
    row: number
    col: number
    value: string
}

const radioBindings = new Map<string, RadioBinding>()
const groupSelections = new Map<string, string>()
const storeListeners = new Set<() => void>()

function bindingKey(
    b: Pick<RadioBinding, 'groupId' | 'blockId' | 'row' | 'col'>
): string {
    return `${b.groupId}-${b.blockId}-${b.row}-${b.col}`
}

function notifyStore(): void {
    for (const l of storeListeners) l()
}

export function subscribeRadioBindings(listener: () => void): () => void {
    storeListeners.add(listener)
    return () => {
        storeListeners.delete(listener)
    }
}

export function registerRadioBinding(binding: RadioBinding): void {
    radioBindings.set(bindingKey(binding), binding)
    notifyStore()
}

export function unregisterRadioBinding(
    binding: Pick<RadioBinding, 'groupId' | 'blockId' | 'row' | 'col'>
): void {
    radioBindings.delete(bindingKey(binding))
    notifyStore()
}

export function clearRadioBindings(groupId?: string): void {
    if (groupId === undefined) {
        radioBindings.clear()
        groupSelections.clear()
    } else {
        for (const [key, b] of radioBindings) {
            if (b.groupId === groupId) radioBindings.delete(key)
        }
        groupSelections.delete(groupId)
    }
    notifyStore()
}

export function getRadioBindings(): readonly RadioBinding[] {
    return Array.from(radioBindings.values())
}

export function getRadioSelection(groupId: string): string | undefined {
    return groupSelections.get(groupId)
}

export function setRadioSelection(groupId: string, value: string): void {
    groupSelections.set(groupId, value)
    notifyStore()
}

// ---- Multi-select (k-of-n) --------------------------------------------
// Like radio, but a group allows up to `maxSelected` choices. Clicking a
// selected cell deselects it; clicking an unselected cell either selects it
// (if room remains) or is ignored when the cap is reached.

export interface MultiSelectBinding {
    type: 'multiSelect'
    groupId: string
    sheetIdx: number
    blockId: number
    row: number
    col: number
    value: string
}

const multiSelectBindings = new Map<string, MultiSelectBinding>()
const multiSelectMax = new Map<string, number>()
const multiSelectSelections = new Map<string, Set<string>>()

function multiSelectKey(
    b: Pick<MultiSelectBinding, 'groupId' | 'blockId' | 'row' | 'col'>
): string {
    return `${b.groupId}-${b.blockId}-${b.row}-${b.col}`
}

export function registerMultiSelectBinding(binding: MultiSelectBinding): void {
    multiSelectBindings.set(multiSelectKey(binding), binding)
    notifyStore()
}

export function unregisterMultiSelectBinding(
    binding: Pick<MultiSelectBinding, 'groupId' | 'blockId' | 'row' | 'col'>
): void {
    multiSelectBindings.delete(multiSelectKey(binding))
    notifyStore()
}

export function clearMultiSelectBindings(groupId?: string): void {
    if (groupId === undefined) {
        multiSelectBindings.clear()
        multiSelectMax.clear()
        multiSelectSelections.clear()
    } else {
        for (const [k, b] of multiSelectBindings) {
            if (b.groupId === groupId) multiSelectBindings.delete(k)
        }
        multiSelectMax.delete(groupId)
        multiSelectSelections.delete(groupId)
    }
    notifyStore()
}

export function getMultiSelectBindings(): readonly MultiSelectBinding[] {
    return Array.from(multiSelectBindings.values())
}

export function setMultiSelectMax(groupId: string, max: number): void {
    multiSelectMax.set(groupId, Math.max(0, max))
    notifyStore()
}

export function getMultiSelectMax(groupId: string): number {
    return multiSelectMax.get(groupId) ?? 0
}

export function getMultiSelectSelections(groupId: string): string[] {
    return Array.from(multiSelectSelections.get(groupId) ?? [])
}

export function toggleMultiSelectValue(groupId: string, value: string): void {
    let set = multiSelectSelections.get(groupId)
    if (!set) {
        set = new Set()
        multiSelectSelections.set(groupId, set)
    }
    if (set.has(value)) {
        set.delete(value)
    } else {
        const max = multiSelectMax.get(groupId) ?? Infinity
        if (set.size >= max) return
        set.add(value)
    }
    notifyStore()
}

// ---- Point allocator ----------------------------------------------------
// A pool of points (`total`) is distributed across a set of block cells in
// the same group. The overlay renders a small +N badge on each bound cell;
// left-click adds 1, right-click adds 5, shift+click subtracts.

export interface PointAllocatorBinding {
    type: 'pointAllocator'
    groupId: string
    sheetIdx: number
    blockId: number
    row: number
    col: number
}

export interface PointAllocation {
    blockId: number
    row: number
    col: number
    points: number
}

const pointBindings = new Map<string, PointAllocatorBinding>()
const pointPoolTotals = new Map<string, number>()
const pointAllocations = new Map<string, Map<string, number>>()

function pointBindingKey(
    b: Pick<PointAllocatorBinding, 'groupId' | 'blockId' | 'row' | 'col'>
): string {
    return `${b.groupId}-${b.blockId}-${b.row}-${b.col}`
}

function cellKey(blockId: number, row: number, col: number): string {
    return `${blockId}-${row}-${col}`
}

function groupTotalUsed(groupId: string): number {
    const m = pointAllocations.get(groupId)
    if (!m) return 0
    let s = 0
    for (const v of m.values()) s += v
    return s
}

export function registerPointAllocator(binding: PointAllocatorBinding): void {
    pointBindings.set(pointBindingKey(binding), binding)
    notifyStore()
}

export function unregisterPointAllocator(
    binding: Pick<PointAllocatorBinding, 'groupId' | 'blockId' | 'row' | 'col'>
): void {
    pointBindings.delete(pointBindingKey(binding))
    notifyStore()
}

export function clearPointAllocators(groupId?: string): void {
    if (groupId === undefined) {
        pointBindings.clear()
        pointPoolTotals.clear()
        pointAllocations.clear()
    } else {
        for (const [key, b] of pointBindings) {
            if (b.groupId === groupId) pointBindings.delete(key)
        }
        pointPoolTotals.delete(groupId)
        pointAllocations.delete(groupId)
    }
    notifyStore()
}

export function getPointAllocatorBindings(): readonly PointAllocatorBinding[] {
    return Array.from(pointBindings.values())
}

export function setPointPool(groupId: string, total: number): void {
    pointPoolTotals.set(groupId, Math.max(0, total))
    notifyStore()
}

export function getPointPool(groupId: string): {
    total: number
    used: number
    remaining: number
} {
    const total = pointPoolTotals.get(groupId) ?? 0
    const used = groupTotalUsed(groupId)
    return {total, used, remaining: total - used}
}

export function getPointAllocation(
    binding: Pick<PointAllocatorBinding, 'groupId' | 'blockId' | 'row' | 'col'>
): number {
    return (
        pointAllocations
            .get(binding.groupId)
            ?.get(cellKey(binding.blockId, binding.row, binding.col)) ?? 0
    )
}

export function getPointAllocations(groupId: string): PointAllocation[] {
    const m = pointAllocations.get(groupId)
    if (!m) return []
    const out: PointAllocation[] = []
    for (const [key, points] of m) {
        const [blockId, row, col] = key.split('-').map(Number)
        out.push({blockId, row, col, points})
    }
    return out
}

// ---- Number slider ------------------------------------------------------
// An overlay widget attached to a block cell. The user can scroll or type to
// set a numeric value within [min, max]. Each confirmed value is written back
// to the workbook as a transaction.

export interface NumberSliderBinding {
    type: 'numberSlider'
    groupId: string
    sheetIdx: number
    blockId: number
    row: number
    col: number
    min: number
    max: number
    step?: number       // default 1
    initialValue?: number
}

const numberSliderBindings = new Map<string, NumberSliderBinding>()

function numberSliderKey(
    b: Pick<NumberSliderBinding, 'groupId' | 'blockId' | 'row' | 'col'>
): string {
    return `${b.groupId}-${b.blockId}-${b.row}-${b.col}`
}

export function registerNumberSlider(binding: NumberSliderBinding): void {
    numberSliderBindings.set(numberSliderKey(binding), binding)
    notifyStore()
}

export function unregisterNumberSlider(
    binding: Pick<NumberSliderBinding, 'groupId' | 'blockId' | 'row' | 'col'>
): void {
    numberSliderBindings.delete(numberSliderKey(binding))
    notifyStore()
}

export function clearNumberSliders(groupId?: string): void {
    if (groupId === undefined) {
        numberSliderBindings.clear()
    } else {
        for (const [k, b] of numberSliderBindings) {
            if (b.groupId === groupId) numberSliderBindings.delete(k)
        }
    }
    notifyStore()
}

export function getNumberSliderBindings(): readonly NumberSliderBinding[] {
    return Array.from(numberSliderBindings.values())
}

export function adjustPointAllocation(
    binding: Pick<PointAllocatorBinding, 'groupId' | 'blockId' | 'row' | 'col'>,
    delta: number
): void {
    const {groupId, blockId, row, col} = binding
    let m = pointAllocations.get(groupId)
    if (!m) {
        m = new Map()
        pointAllocations.set(groupId, m)
    }
    const key = cellKey(blockId, row, col)
    const current = m.get(key) ?? 0
    const total = pointPoolTotals.get(groupId) ?? 0
    const used = groupTotalUsed(groupId)
    const remaining = total - used
    const applied =
        delta > 0 ? Math.min(delta, remaining) : Math.max(delta, -current)
    const next = current + applied
    if (next <= 0) m.delete(key)
    else m.set(key, next)
    notifyStore()
}


// ---- Percent allocator --------------------------------------------------
// Sibling of `PointAllocator`, but tailored to "sum-to-100% across a small
// set of cells" — the common case being a two-supplier split per material.
// Differences from PointAllocator:
//   * No external pool — the constraint is implicit: every binding in a
//     group must sum to 100% (stored as 0..1 fractions in the cells).
//   * State of truth is the *cells themselves*. Adjustment reads current
//     cell values, computes the new allocation, and writes ALL cells in
//     the group atomically via the host's transaction layer (see the
//     `PercentAllocatorLayer` component). This module just tracks which
//     cells participate in which group; it doesn't store percentages.

export interface PercentAllocatorBinding {
    type: 'percentAllocator'
    groupId: string
    sheetIdx: number
    blockId: number
    row: number
    col: number
}

const percentBindings = new Map<string, PercentAllocatorBinding>()

function percentBindingKey(
    b: Pick<PercentAllocatorBinding, 'groupId' | 'blockId' | 'row' | 'col'>
): string {
    return `${b.groupId}-${b.blockId}-${b.row}-${b.col}`
}

export function registerPercentAllocator(
    binding: PercentAllocatorBinding
): void {
    percentBindings.set(percentBindingKey(binding), binding)
    notifyStore()
}

export function unregisterPercentAllocator(
    binding: Pick<PercentAllocatorBinding, 'groupId' | 'blockId' | 'row' | 'col'>
): void {
    percentBindings.delete(percentBindingKey(binding))
    notifyStore()
}

export function clearPercentAllocators(groupId?: string): void {
    if (groupId === undefined) {
        percentBindings.clear()
    } else {
        for (const [k, b] of percentBindings) {
            if (b.groupId === groupId) percentBindings.delete(k)
        }
    }
    notifyStore()
}

export function getPercentAllocatorBindings(): readonly PercentAllocatorBinding[] {
    return Array.from(percentBindings.values())
}

/**
 * Pure helper: apply `deltaPct` percentage points to the `targetIdx`
 * slot of a group and rebalance the others so the group sum is always
 * exactly 1 (100%) after the call.
 *
 * Semantics:
 *  - **First-touch (group sum ≈ 0)**: auto-seed an even 1/n split as
 *    the conceptual starting point, *then* apply the delta. So
 *    `[0,0] +1 on idx 0` reads as "starting from 50/50, give idx 0
 *    +1%" → `[0.51, 0.49]`. This is what we want when a craft has
 *    bound a pair but hasn't written initial values yet — the first
 *    click both initializes and adjusts in one step.
 *  - **Any positive delta** (`+k`): bump target by k% (clamped to
 *    [0,1]), take the same total off the other slots proportionally
 *    to their pre-click share.
 *  - **Any negative delta** (`-k`): lower target by k% (clamped),
 *    give the same total back to the other slots proportionally.
 *  - **Already-at-bound clicks** (e.g. +1 on a slot at 100%): no-op.
 *  - **Manually under- or over-allocated input** (sum != 1): every
 *    click renormalizes the group back to 1.
 *
 * Examples (n=2):
 *
 *   [0, 0]      +1 on idx 0   → [0.51, 0.49]   (auto-seed + +1)
 *   [0.5, 0.5]  +1 on idx 0   → [0.51, 0.49]
 *   [0.5, 0.5]  -1 on idx 0   → [0.49, 0.51]
 *   [1.0, 0]    +1 on idx 0   → [1.0, 0]        (clamped)
 *   [1.0, 0]    +1 on idx 1   → [0.99, 0.01]
 *
 * Earlier versions had a sticky-after-first-click bug: when the group
 * was [0.01, 0], adding to idx 0 saw "others total = 0" and either
 * reverted the bump (preserve-sum branch) or just let it climb
 * (overflow-only branch) — neither was what the user wanted. Auto-
 * seeding at sum≈0 makes every subsequent click see a well-formed
 * group, so the renormalization branch always has weight to work with.
 */
export function redistributePercent(
    current: readonly number[],
    targetIdx: number,
    deltaPct: number
): number[] {
    const n = current.length
    if (n === 0) return []
    if (n === 1) return [Math.max(0, Math.min(1, current[0] + deltaPct / 100))]

    const deltaFrac = deltaPct / 100
    const preSum = current.reduce((s, v) => s + v, 0)

    // First-touch: an uninitialized group conceptually starts as an
    // even split. Build that virtual base, then proceed normally.
    const base =
        preSum > 1e-9 ? current.slice() : (new Array(n).fill(1 / n) as number[])

    // Apply delta to target (clamped). If nothing actually changed,
    // bail out — `base` is already at sum=1 (or whatever the user
    // had); no-op clicks shouldn't trigger renormalization.
    const targetNew = Math.max(0, Math.min(1, base[targetIdx] + deltaFrac))
    if (targetNew === base[targetIdx] && preSum > 1e-9) return current.slice()

    const next = base.slice()
    next[targetIdx] = targetNew

    // Renormalize the others by the same total delta — taking from
    // them on a positive click, giving back on a negative click. Share
    // is proportional to each slot's pre-click value; falls back to
    // an even split when the others are all 0.
    const targetDelta = targetNew - base[targetIdx]
    const adjust = -targetDelta // how much the others must absorb in aggregate
    if (Math.abs(adjust) > 1e-12) {
        const othersWeight = base.reduce(
            (s, v, i) => (i === targetIdx ? s : s + v),
            0
        )
        for (let i = 0; i < n; i++) {
            if (i === targetIdx) continue
            const share = othersWeight > 0 ? base[i] / othersWeight : 1 / (n - 1)
            next[i] = Math.max(0, Math.min(1, base[i] + adjust * share))
        }
    }

    // Float drift correction so sum lands on exactly 1.
    const finalTotal = next.reduce((s, v) => s + v, 0)
    if (finalTotal > 0 && Math.abs(finalTotal - 1) > 1e-9) {
        for (let i = 0; i < n; i++) next[i] = next[i] / finalTotal
    }
    return next
}
