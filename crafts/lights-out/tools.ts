/**
 * @logicianSkill Lights Out assistant — operates the 5x5 关灯 puzzle. Use when the
 * user wants to start a Lights Out game, get a hint, have it solved, or check how
 * it's going.
 * @guidance The board is read straight from the sheet (the lit/dark cell fills are
 * the source of truth): solve_lights_out reads it, computes the click sequence,
 * and clears the board; start_lights_out deals a fresh puzzle; hint_lights_out
 * names one good cell to click without changing anything. If the 关灯 craft panel
 * is open, tell the user to reopen it after you change the board so its in-memory
 * view reloads from the sheet.
 */

import type {Client} from 'logisheets-web'
import {
    BOARD_NAME,
    SIZE,
    DIFFICULTY,
    findSheetIdx,
    ensureBoard,
    renderBoard,
    readBoard,
    applyMove,
    isSolved,
    generatePuzzle,
    solve,
} from './src/index'

/** Host-injected context; `workbook` is the live LogiSheets client. */
export interface Ctx {
    workbook: Client
    signal: AbortSignal
    confirm: (message: string, detail?: unknown) => Promise<boolean>
    log: (msg: string) => void
}

function rc(i: number): {row: number; col: number} {
    return {row: Math.floor(i / SIZE), col: i % SIZE}
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
/** True if a committed write landed since the `since` snapshot (⇒ our read is
 *  stale). Returns false when version tracking is unavailable (best-effort). */
async function changedSince(wb: Client, since: number | null): Promise<boolean> {
    if (since === null) return false
    const now = await workbookVersion(wb)
    return now !== null && now !== since
}

/**
 * @tool Solve the current Lights Out puzzle: turn every light off and report the
 * cells that were clicked.
 * @mutates true
 * @confirm always
 */
export async function solveLightsOut(ctx: Ctx): Promise<{
    solved: boolean
    clicks: {row: number; col: number}[]
    reason?: string
}> {
    const wb = ctx.workbook
    const idx = await findSheetIdx(wb, BOARD_NAME)
    if (idx < 0)
        return {solved: false, clicks: [], reason: 'No 关灯 board — start a game first.'}

    // Optimistic concurrency: the user could click a cell (via the craft)
    // between our read and our write, which would make the computed moves stale
    // and clobber their move. The engine has no compare-and-swap, so we snapshot
    // the workbook version, and if a committed write landed before we write, we
    // re-fetch and recompute.
    for (let attempt = 0; attempt < 4; attempt++) {
        const v0 = await workbookVersion(wb)
        const board = await readBoard(wb, idx)
        if (isSolved(board)) return {solved: true, clicks: []}
        const moves = solve(board)
        if (!moves)
            return {solved: false, clicks: [], reason: 'This board is unsolvable.'}
        const next = board.slice()
        for (const m of moves) {
            const {row, col} = rc(m)
            applyMove(next, row, col)
        }
        if (await changedSince(wb, v0)) continue // state moved under us → retry
        await renderBoard(wb, idx, next)
        return {solved: true, clicks: moves.map(rc)}
    }
    return {
        solved: false,
        clicks: [],
        reason: 'The board kept changing while solving — try again.',
    }
}

/**
 * @tool Suggest one cell to click next toward solving the current puzzle, without
 * changing the board.
 * @mutates none
 * @confirm never
 */
export async function hintLightsOut(
    ctx: Ctx
): Promise<{cell?: {row: number; col: number}; reason?: string}> {
    const idx = await findSheetIdx(ctx.workbook, BOARD_NAME)
    if (idx < 0) return {reason: 'No 关灯 board — start a game first.'}
    const board = await readBoard(ctx.workbook, idx)
    if (isSolved(board)) return {reason: 'Already solved.'}
    const moves = solve(board)
    if (!moves || moves.length === 0) return {reason: 'Unsolvable board.'}
    return {cell: rc(moves[0])}
}

/**
 * @tool Start a new Lights Out puzzle at the given difficulty.
 * @param difficulty Puzzle difficulty (more scrambling = harder).
 * @mutates true
 * @confirm always
 */
export async function startLightsOut(
    ctx: Ctx,
    difficulty: 'easy' | 'medium' | 'hard'
): Promise<{difficulty: string; litCells: number}> {
    const board = generatePuzzle(DIFFICULTY[difficulty] ?? DIFFICULTY.medium)
    const idx = await ensureBoard(ctx.workbook)
    await renderBoard(ctx.workbook, idx, board)
    return {difficulty, litCells: board.filter((v) => v).length}
}

/**
 * @tool Report the current Lights Out status: how many lights are still on and
 * whether the board is solved. Reads only.
 * @mutates none
 * @confirm never
 */
export async function lightsOutStatus(ctx: Ctx): Promise<{
    litCells: number
    solved: boolean
    hasBoard: boolean
}> {
    const idx = await findSheetIdx(ctx.workbook, BOARD_NAME)
    if (idx < 0) return {litCells: 0, solved: false, hasBoard: false}
    const board = await readBoard(ctx.workbook, idx)
    return {
        litCells: board.filter((v) => v).length,
        solved: isSolved(board),
        hasBoard: true,
    }
}
