/**
 * useDiffLayer Hook — temp-mode-driven diff visualization.
 *
 * Design: passive observer of `globalStore.isTempMode`. When tempMode
 * is on, queries the engine's *authoritative* temp-vs-committed diff
 * (`Workbook::get_temp_status_changes`) on every cell-update event and
 * renders the result. No JS-side snapshotting; the engine already
 * tracks `accumulated_updated_cells` in `TempStatus`.
 *
 * Lifecycle:
 *   1. tempMode on  → re-query engine on every `cellChange`. Each query
 *                     returns the full set of cells whose value differs
 *                     from the committed branch.
 *   2. tempMode off → clear diff state. Callers (or `commit`/`discard`
 *                     helpers below) should have ended the temp branch
 *                     via the workbook API first.
 */

import {useState, useEffect, useCallback} from 'react'
import {autorun} from 'mobx'
import {useEngine, useOps} from '@/core/engine/provider'
import {globalStore} from '@/store'
import type {Payload, TempStatusDiff} from 'logisheets-engine'
import {isErrorMessage} from 'logisheets-engine'
import {DiffState, CellDiff, EMPTY_DIFF, valueToString} from './types'

/**
 * Convert the engine's `TempStatusDiff` (cells changed in temp vs main)
 * into the host's `CellDiff[]` shape. Filter out same-sheet rows on
 * sheets the layer isn't currently viewing — `diffState` carries one
 * sheet's worth of cells; the active sheet idx is passed in.
 *
 * `added` vs `valueChanged` is decided by whether the OLD value
 * (committed branch) was empty: empty → added, otherwise →
 * valueChanged. `removed` would require detecting cells that no longer
 * exist in temp; the engine's accumulated set only includes cells that
 * *changed value*, so we don't surface removals here (a later revision
 * can add structural-diff tracking — see the rust API doc).
 */
function tempDiffToCellDiffs(
    diff: TempStatusDiff,
    activeSheetIdx: number
): CellDiff[] {
    const out: CellDiff[] = []
    for (const c of diff.cells) {
        if (c.sheetIdx !== activeSheetIdx) continue
        const oldStr = valueToString(c.oldValue)
        const newStr = valueToString(c.newValue)
        if (oldStr === newStr) continue
        out.push({
            row: c.row,
            col: c.col,
            type: oldStr === '' ? 'added' : 'valueChanged',
            oldValue: oldStr,
            newValue: newStr,
        })
    }
    return out
}

export interface UseDiffLayerReturn {
    /** Current diff state to pass to DiffLayer component. Empty when
     *  not in temp mode. */
    diffState: DiffState
    /**
     * Backwards-compat helper: turn temp mode on (if needed) and submit
     * a temp transaction. New code can drop this entirely and just
     * write through `tx(payloads, true)` whenever `globalStore.isTempMode`
     * is on — the diff overlay observes tempMode and shows the change
     * automatically. Kept for the test panel and any caller that wants
     * a single-call helper.
     */
    applyTempTransaction: (payloads: readonly Payload[]) => Promise<void>
    /**
     * Convenience: commit the workbook's temp branch and turn temp
     * mode off. The diff overlay clears automatically via the
     * tempMode observer.
     */
    commit: () => Promise<void>
    /**
     * Convenience: discard the workbook's temp branch and turn temp
     * mode off.
     */
    discard: () => Promise<void>
    /** Whether the diff overlay is currently active (= temp mode on). */
    isActive: boolean
}

export function useDiffLayer(): UseDiffLayerReturn {
    const engine = useEngine()
    const dataSvc = engine.getDataService()
    const workbook = engine.getWorkbook()
    const ops = useOps()

    const [diffState, setDiffState] = useState<DiffState>(EMPTY_DIFF)

    // Query the engine for the current temp-vs-committed diff and push
    // it into state. Cheap (engine just walks its accumulated_updated_cells
    // set; no JS-side snapshot work), so we can call this on every
    // cellChange event without worrying about cost.
    const refresh = useCallback(async () => {
        if (!globalStore.isTempMode) return
        const diff = await workbook.getTempStatusChanges()
        if (isErrorMessage(diff)) return
        const cells = tempDiffToCellDiffs(diff, dataSvc.getCurrentSheetIdx())
        setDiffState({
            cells,
            rows: [],
            cols: [],
            active: true,
        })
    }, [workbook, dataSvc])

    // Observe globalStore.isTempMode. On entry: clear stale state, do
    // an initial refresh (in case payloads landed before this hook
    // mounted). On exit: clear.
    useEffect(() => {
        const dispose = autorun(() => {
            const on = globalStore.isTempMode
            if (on) {
                setDiffState({...EMPTY_DIFF, active: true})
                queueMicrotask(refresh)
            } else {
                setDiffState(EMPTY_DIFF)
            }
        })
        return dispose
    }, [refresh])

    // While tempMode is active, re-query the engine on every cell
    // update event. ANY temp-tagged transaction (PercentAllocator,
    // factory-simulator's tick, manual cell edits, future widgets)
    // surfaces here without per-caller wiring.
    useEffect(() => {
        const cb = () => {
            if (globalStore.isTempMode) queueMicrotask(refresh)
        }
        engine.on('cellChange', cb)
        return () => engine.off('cellChange', cb)
    }, [engine, refresh])

    // Switching sheets must re-filter the diff cells against the new
    // active sheet — otherwise `diffState` keeps the previous sheet's
    // cell positions and the overlays paint at those (sheet-relative)
    // row/col coordinates on whichever sheet is now showing. Without
    // this, the diff layer "leaks" between sheets. `refresh` already
    // reads `dataSvc.getCurrentSheetIdx()`, so we just trigger it on
    // every active-sheet change.
    useEffect(() => {
        const cb = () => {
            if (globalStore.isTempMode) queueMicrotask(refresh)
            else setDiffState(EMPTY_DIFF)
        }
        engine.on('activeSheetChange', cb)
        return () => engine.off('activeSheetChange', cb)
    }, [engine, refresh])

    const applyTempTransaction = useCallback(
        async (payloads: readonly Payload[]) => {
            if (!globalStore.isTempMode) {
                globalStore.setTempMode(true)
                // Give the autorun a microtask to capture the baseline
                // before we mutate.
                await Promise.resolve()
            }
            await ops.applyPayloads(payloads)
        },
        [ops]
    )

    const commit = useCallback(async () => {
        try {
            await ops.commitTempStatus()
        } catch {
            // commitTempStatus not available on this client
        }
        globalStore.setTempMode(false) // observer clears diff state
    }, [ops])

    const discard = useCallback(async () => {
        try {
            await ops.cleanupTempStatus()
        } catch {
            // cleanupTempStatus not available on this client
        }
        // Re-render to surface the rolled-back state.
        const grid = engine.getGrid()
        if (grid) {
            await engine.render(grid.anchorX, grid.anchorY)
        }
        globalStore.setTempMode(false)
    }, [ops, engine])

    return {
        diffState,
        applyTempTransaction,
        commit,
        discard,
        isActive: diffState.active,
    }
}
