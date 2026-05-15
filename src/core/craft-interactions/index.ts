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

function bindingKey(b: Pick<RadioBinding, 'groupId' | 'blockId' | 'row' | 'col'>): string {
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
