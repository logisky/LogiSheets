import {StandardColor} from '@/core/standable'

export const ZINDEX_UI = 1000
export const ZINDEX_MODAL = 900
export const ZINDEX_BLOCK_OUTLINER = 0

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
