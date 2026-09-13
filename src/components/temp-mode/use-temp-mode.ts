/**
 * Ending a temp-mode session — the one implementation of commit and discard.
 *
 * The workbook has a single scratch branch (see the engine's
 * `Controller.temp_status`), so ending it is a workbook-wide act with exactly
 * two outcomes: keep the accumulated edits as one undo step, or throw them
 * away. Several surfaces offer that choice — the bar over the grid, the
 * Watson panel, the toolbar — and they must all mean the same thing, hence
 * one hook rather than a copy each.
 *
 * Discarding needs a re-render the commit path doesn't: committing leaves the
 * values on screen exactly where they were, while discarding rolls them back
 * underneath a canvas that has no idea.
 */

import {useCallback} from 'react'
import {useEngine, useOps} from '@/core/engine/provider'
import {globalStore} from '@/store'

export interface TempModeControls {
    /** Keep the branch's edits, as a single undo step, and leave temp mode. */
    commit: () => Promise<void>
    /** Throw the branch away and leave temp mode. */
    discard: () => Promise<void>
}

export function useTempModeControls(): TempModeControls {
    const engine = useEngine()
    const ops = useOps()

    const commit = useCallback(async () => {
        try {
            await ops.commitTempStatus()
        } catch {
            // commitTempStatus not available on this client
        }
        globalStore.setTempMode(false) // observers clear their diff state
    }, [ops])

    const discard = useCallback(async () => {
        try {
            await ops.cleanupTempStatus()
        } catch {
            // cleanupTempStatus not available on this client
        }
        // The rolled-back values are already the engine's truth; the canvas
        // still shows the speculative ones until it is told to paint again.
        const grid = engine.getGrid()
        if (grid) {
            await engine.render(grid.anchorX, grid.anchorY)
        }
        globalStore.setTempMode(false)
    }, [ops, engine])

    return {commit, discard}
}
