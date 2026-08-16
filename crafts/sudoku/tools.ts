/**
 * @logicianSkill Sudoku assistant — operates the puzzle on the 数独 sheet. Use
 * when the user asks to solve, fill, finish, or check their Sudoku, or to start
 * a new game.
 * @guidance The board IS the sheet (the player types digits straight into the
 * 9x9 of cells), so these tools read and write those cells directly and stay in
 * sync with normal play. solve_sudoku reads the current grid and fills every
 * blank; new_sudoku deals a fresh puzzle; check_sudoku reports progress without
 * changing anything.
 */

import type {Client, Value} from 'logisheets-web'
import {
    BOARD_NAME,
    N,
    DIFFICULTY,
    findSheetIdx,
    solveGrid,
    isConsistent,
    applySolution,
    setupNewGame,
    type Grid,
} from './src/index'

/** Host-injected tool context; `workbook` is the live LogiSheets client. */
export interface Ctx {
    workbook: Client
    signal: AbortSignal
    confirm: (message: string, detail?: unknown) => Promise<boolean>
    log: (msg: string) => void
}

/** The workbook's monotonic write counter, or null if the host predates it. */
async function workbookVersion(wb: Client): Promise<number | null> {
    try {
        const v = await (wb as {getVersion?: () => Promise<number | unknown>})
            .getVersion?.()
        return typeof v === 'number' ? v : null
    } catch {
        return null
    }
}
async function changedSince(wb: Client, since: number | null): Promise<boolean> {
    if (since === null) return false
    const now = await workbookVersion(wb)
    return now !== null && now !== since
}

/** Read the 9x9 board straight from the sheet cells (0 = blank). */
async function readGrid(wb: Client, sheetIdx: number): Promise<Grid> {
    const reqs: Promise<{value?: Value} | unknown>[] = []
    for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++)
            reqs.push(wb.getCell({sheetIdx, row: r, col: c}))
    const cells = await Promise.all(reqs)
    return cells.map((cell) => {
        const v = (cell as {value?: Value} | undefined)?.value
        if (!v || v === 'empty') return 0
        if (typeof v === 'object' && v.type === 'number') {
            const n = Number(v.value)
            return n >= 1 && n <= 9 ? n : 0
        }
        return 0
    })
}

/**
 * @tool Solve the current Sudoku on the 数独 sheet: read the grid, compute the
 * solution, and fill every blank cell. Reports if the entries conflict or have
 * no solution.
 * @mutates true
 * @confirm always
 */
export async function solveSudoku(
    ctx: Ctx
): Promise<{solved: boolean; filled: number; reason?: string}> {
    const wb = ctx.workbook
    const idx = await findSheetIdx(wb, BOARD_NAME)
    if (idx < 0)
        return {
            solved: false,
            filled: 0,
            reason: 'No 数独 sheet yet — start a game with new_sudoku first.',
        }
    // Optimistic concurrency: the player might type a digit between our read and
    // our write, making the solution stale (and overwriting their entry). The
    // engine has no compare-and-swap, so we snapshot the workbook version and, if
    // a committed write landed before we write, re-read and recompute.
    for (let attempt = 0; attempt < 4; attempt++) {
        const v0 = await workbookVersion(wb)
        const grid = await readGrid(wb, idx)
        const solution = solveGrid(grid)
        if (!solution)
            return {
                solved: false,
                filled: 0,
                reason: isConsistent(grid)
                    ? 'The current entries admit no solution.'
                    : 'The current entries conflict — fix them before solving.',
            }
        if (await changedSince(wb, v0)) continue // state moved under us → retry
        const filled = await applySolution(wb, idx, grid, solution)
        return {solved: true, filled}
    }
    return {
        solved: false,
        filled: 0,
        reason: 'The grid kept changing while solving — try again.',
    }
}

/**
 * @tool Start a fresh Sudoku puzzle on the 数独 sheet at the given difficulty.
 * @param difficulty Puzzle difficulty (fewer clues = harder).
 * @mutates true
 * @confirm always
 */
export async function newSudoku(
    ctx: Ctx,
    difficulty: 'easy' | 'medium' | 'hard'
): Promise<{clues: number}> {
    await setupNewGame(ctx.workbook, difficulty)
    return {clues: DIFFICULTY[difficulty] ?? DIFFICULTY.medium}
}

/**
 * @tool Check the current Sudoku: how many cells are filled vs blank, whether
 * any entries conflict, and whether the puzzle is complete. Reads only.
 * @mutates none
 * @confirm never
 */
export async function checkSudoku(ctx: Ctx): Promise<{
    filled: number
    blanks: number
    hasConflicts: boolean
    complete: boolean
}> {
    const idx = await findSheetIdx(ctx.workbook, BOARD_NAME)
    if (idx < 0)
        return {filled: 0, blanks: N * N, hasConflicts: false, complete: false}
    const grid = await readGrid(ctx.workbook, idx)
    const filled = grid.filter((v) => v !== 0).length
    const blanks = N * N - filled
    const hasConflicts = !isConsistent(grid)
    return {filled, blanks, hasConflicts, complete: blanks === 0 && !hasConflicts}
}
