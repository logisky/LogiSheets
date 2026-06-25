import {type BlockDisplayInfo, type Grid} from 'logisheets-engine'
import {useOps} from '@/core/engine/provider'
import {
    getPercentAllocatorBindings,
    redistributePercent,
    type PercentAllocatorBinding,
} from 'logisheets-core'
import type {CellResolver} from './cell-rect'

// Palette for pair-identification. Cells in the same `groupId` share
// hue+saturation; the cell's lightness encodes its current allocation
// — lighter = lower %, darker = higher %. So in a pair you see both
// the shared color (== same group) and the relative weights between
// the two slots without needing any text.
const PAIR_PALETTE_HSL = [
    [210, 80], // blue
    [120, 55], // green
    [30, 90], // orange
    [280, 65], // purple
    [0, 75], // red
    [185, 70], // teal
] as const

function hsForGroup(groupId: string): readonly [number, number] {
    let h = 0
    for (let i = 0; i < groupId.length; i++) {
        h = (h * 31 + groupId.charCodeAt(i)) >>> 0
    }
    return PAIR_PALETTE_HSL[h % PAIR_PALETTE_HSL.length]
}

/** Same hue/saturation as `colorForSlot` but explicit lightness. */
function colorForLightness(groupId: string, lightness: number): string {
    const [hue, sat] = hsForGroup(groupId)
    return `hsl(${hue}, ${sat}%, ${lightness}%)`
}

/**
 * Map a 0..1 allocation to the background lightness and a contrasting
 * text color. Background lightness slides 82 → 30 as the allocation
 * climbs; text flips to white once the background passes the midpoint
 * so the percentage stays legible across the range.
 */
function colorsForSlot(
    groupId: string,
    pct: number
): {background: string; text: string} {
    const clamped = Math.max(0, Math.min(1, pct))
    const lightness = 82 - 52 * clamped
    return {
        background: colorForLightness(groupId, lightness),
        // WCAG-ish threshold: dark text on light bg, light text on dark bg.
        // Slightly biased toward dark text so mid-tone (L≈55) reads dark.
        text: lightness >= 50 ? '#1a1a1a' : '#ffffff',
    }
}

/**
 * Renders the +/- percentage badges for every {@link PercentAllocatorBinding}
 * on the active sheet. Bindings are grouped by `groupId`; clicking on one
 * cell's badge redistributes the group's 100% pool between members and
 * commits all changed cells in a single transaction.
 */
export interface PercentAllocatorLayerProps {
    activeSheet: number
    resolver: CellResolver
    grid: Grid
}

export const PercentAllocatorLayer = ({
    activeSheet,
    resolver,
    grid,
}: PercentAllocatorLayerProps) => {
    const ops = useOps()

    const bindings = getPercentAllocatorBindings().filter(
        (b) => b.sheetIdx === activeSheet
    )
    if (bindings.length === 0) return null

    // Group bindings by groupId, preserving registration order — order
    // matters because we index by position when distributing the delta.
    const groups = new Map<string, PercentAllocatorBinding[]>()
    for (const b of bindings) {
        const list = groups.get(b.groupId) ?? []
        list.push(b)
        groups.set(b.groupId, list)
    }

    // Look up a (blockId, row, col) cell's current numeric value from the
    // grid's blockInfos cache. Returns 0 when the cell is empty / non-number
    // — adequate for percent allocations.
    const cellFraction = (b: PercentAllocatorBinding): number => {
        const blockInfo = grid.blockInfos?.find(
            (bi: BlockDisplayInfo) => bi.info.blockId === b.blockId
        )
        if (!blockInfo) return 0
        const cell =
            blockInfo.info.cells[b.row * blockInfo.info.colCnt + b.col]
        if (!cell) return 0
        const v = cell.value
        if (v === 'empty') return 0
        if (v.type === 'number') return v.value
        if (v.type === 'str') {
            const n = Number(v.value)
            return Number.isFinite(n) ? n : 0
        }
        return 0
    }

    return (
        <>
            {Array.from(groups.entries()).flatMap(([groupId, group]) => {
                const currents = group.map(cellFraction)

                const adjust = async (targetIdx: number, deltaPct: number) => {
                    const next = redistributePercent(
                        currents,
                        targetIdx,
                        deltaPct
                    )
                    // Emit only the cells that actually changed — keeps the
                    // dep graph churn minimal when one slot rounds to its
                    // current value.
                    const inputs = []
                    for (let i = 0; i < group.length; i++) {
                        if (Math.abs(next[i] - currents[i]) < 1e-12) continue
                        const b = group[i]
                        inputs.push({
                            sheetIdx: b.sheetIdx,
                            blockId: b.blockId,
                            row: b.row,
                            col: b.col,
                            input: String(next[i]),
                        })
                    }
                    if (inputs.length === 0) return
                    await ops.inputBlockCells(inputs)
                }

                return group.map((b, idx) => {
                    const rect = resolver.rect(b.blockId, b.row, b.col)
                    if (!rect) return null

                    const onClick = (e: React.MouseEvent) => {
                        e.preventDefault()
                        e.stopPropagation()
                        adjust(idx, e.shiftKey ? -1 : 1)
                    }
                    const onContext = (e: React.MouseEvent) => {
                        e.preventDefault()
                        e.stopPropagation()
                        adjust(idx, e.shiftKey ? -5 : 5)
                    }

                    // Overlay owns the cell visuals: solid pair-coded
                    // background (lightness encodes allocation; lighter
                    // = lower %, darker = higher %) plus a centered
                    // percent label with contrast-aware text color. The
                    // overlay covers whatever the engine paints below.
                    const pct = currents[idx]
                    const {background, text} = colorsForSlot(groupId, pct)
                    const label = `${Math.round(pct * 100)}%`
                    return (
                        <div
                            key={`pct-${groupId}-${b.blockId}-${b.row}-${b.col}`}
                            title={`${label}  ·  Left-click +1%, right-click +5%, hold Shift to subtract`}
                            style={{
                                position: 'absolute',
                                left: rect.x,
                                top: rect.y,
                                width: rect.width,
                                height: rect.height,
                                boxSizing: 'border-box',
                                background,
                                color: text,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 12,
                                fontWeight: 600,
                                fontVariantNumeric: 'tabular-nums',
                                pointerEvents: 'auto',
                                zIndex: 100,
                                userSelect: 'none',
                                cursor: 'pointer',
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={onClick}
                            onContextMenu={onContext}
                        >
                            {label}
                        </div>
                    )
                })
            })}
        </>
    )
}
