// memory-grid — 24-level difficulty ladder.
//
// A round flashes `n` cells on an 8x8 board, each showing a color and/or a
// number for `showMs`, then asks the player to pick the cells matching one
// attribute. Difficulty grows along four axes: shorter display time, longer
// sequences, richer content (color → number → both), and harder questions
// (single attribute → multiple cells → combined color∧number, plus flashing
// two cells at once at the top). See README for the full table.

/** What each flashed cell displays. */
export type Mode = 'color' | 'number' | 'both'
/** Which attribute the question asks about. */
export type Question = 'color' | 'number' | 'both'

export interface LevelSpec {
    level: number
    mode: Mode
    /** Sequence length — how many cells are flashed. */
    n: number
    /** Milliseconds each cell (or simultaneous group) stays lit. */
    showMs: number
    question: Question
    /** How many cells the player must select. */
    answerCount: number
    /** Number of distinct colors in play (color/both modes). */
    paletteSize: number
    /** Numbers run 1..numberMax (number/both modes). */
    numberMax: number
    /** Cells lit at the same time per step (1, or 2 at the hardest levels). */
    simultaneous: number
}

// Named, high-contrast bead-ish colors. paletteSize picks the first N.
export interface GameColor {
    name: string
    hex: string
}
export const COLORS: GameColor[] = [
    {name: '红', hex: '#E53935'},
    {name: '橙', hex: '#FB8C00'},
    {name: '黄', hex: '#FDD835'},
    {name: '绿', hex: '#43A047'},
    {name: '青', hex: '#00ACC1'},
    {name: '蓝', hex: '#1E88E5'},
    {name: '紫', hex: '#8E24AA'},
    {name: '粉', hex: '#EC407A'},
]

// The 24 levels, four tiers of six. Kept explicit (not generated) so the
// gradient is easy to read and tweak.
export const LEVELS: LevelSpec[] = [
    // 档1 颜色入门
    l(1, 'color', 3, 1000, 'color', 1, 4, 0, 1),
    l(2, 'color', 3, 900, 'color', 1, 4, 0, 1),
    l(3, 'color', 4, 850, 'color', 1, 5, 0, 1),
    l(4, 'color', 4, 750, 'color', 2, 5, 0, 1),
    l(5, 'color', 5, 700, 'color', 1, 6, 0, 1),
    l(6, 'color', 5, 650, 'color', 2, 6, 0, 1),
    // 档2 数字进阶
    l(7, 'number', 4, 900, 'number', 1, 0, 6, 1),
    l(8, 'number', 4, 800, 'number', 1, 0, 6, 1),
    l(9, 'number', 5, 750, 'number', 1, 0, 8, 1),
    l(10, 'number', 5, 700, 'number', 2, 0, 8, 1),
    l(11, 'number', 6, 650, 'number', 1, 0, 9, 1),
    l(12, 'number', 6, 600, 'number', 2, 0, 9, 1),
    // 档3 双属性
    l(13, 'both', 5, 800, 'color', 1, 6, 8, 1),
    l(14, 'both', 5, 750, 'number', 1, 6, 8, 1),
    l(15, 'both', 6, 700, 'both', 1, 6, 8, 1),
    l(16, 'both', 6, 650, 'both', 2, 6, 8, 1),
    l(17, 'both', 7, 600, 'both', 2, 7, 9, 1),
    l(18, 'both', 7, 550, 'both', 3, 7, 9, 1),
    // 档4 大师
    l(19, 'both', 7, 550, 'both', 2, 7, 9, 1),
    l(20, 'both', 8, 500, 'both', 2, 8, 9, 2),
    l(21, 'both', 8, 450, 'both', 3, 8, 9, 2),
    l(22, 'both', 9, 450, 'both', 3, 8, 9, 2),
    l(23, 'both', 9, 400, 'both', 3, 8, 9, 2),
    l(24, 'both', 10, 350, 'both', 3, 8, 9, 2),
]

export const TOTAL_LEVELS = LEVELS.length

export function getLevel(level: number): LevelSpec {
    return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level - 1))]
}

function l(
    level: number,
    mode: Mode,
    n: number,
    showMs: number,
    question: Question,
    answerCount: number,
    paletteSize: number,
    numberMax: number,
    simultaneous: number
): LevelSpec {
    return {level, mode, n, showMs, question, answerCount, paletteSize, numberMax, simultaneous}
}
