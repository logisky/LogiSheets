import {StandardColor} from '@/core/standable'

export const ZINDEX_UI = 1000
export const ZINDEX_HEADER = 800
export const ZINDEX_MODAL = 900
// Block-interface root wrapper z-index. Must sit ABOVE the diff layer
// (z-index 1 in diff-layer.module.scss) so the block's per-cell overlays
// — validation warning marker, required marker, bool widget, enum chip,
// etc. — aren't sandwiched under diff tints. The wrapper creates its own
// stacking context, so all interior z-indices (1, 2, 1000 on
// editing-mode cells) are local to it; from the parent canvas's
// perspective the entire block-interface subtree sits at this single
// value.
export const ZINDEX_BLOCK_OUTLINER = 2

export const HIGHLIGHT_COLORS: string[] = [
    '0070C0',
    'FF0000',
    '00B050',
    '7030A0',
    '00B0F0',
    'FFC000',
]

export const EOF = '\n'

export function getHighlightColor(index: number): StandardColor {
    return StandardColor.fromRgb(
        HIGHLIGHT_COLORS[index % HIGHLIGHT_COLORS.length]
    )
}
