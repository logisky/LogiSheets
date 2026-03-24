/**
 * useDiffLayer Hook
 *
 * Manages the lifecycle of temp transactions and computes the diff state
 * by comparing cell snapshots before and after a temp transaction.
 *
 * Usage:
 *   const { diffState, applyTempTransaction, commit, discard } = useDiffLayer()
 *   // Apply a temp transaction to preview changes
 *   await applyTempTransaction(payloads)
 *   // Commit or discard when done
 *   await commit()
 *   // or
 *   await discard()
 */

import {useState, useCallback, useRef} from 'react'
import {useEngine} from '@/core/engine/provider'
import {tx} from '@/core/transaction'
import type {Grid, Row, Column} from 'logisheets-engine'
import type {Payload} from 'logisheets-engine'
import type {CellInfo, Value} from 'logisheets-web'
import {isErrorMessage} from 'logisheets-engine'
import {
    DiffState,
    CellDiff,
    RowDiff,
    ColDiff,
    EMPTY_DIFF,
    valueToString,
} from './types'

/** Snapshot of visible cell values keyed by "row:col" */
type CellSnapshot = Map<string, {value: Value; formula: string}>

function cellKey(row: number, col: number): string {
    return `${row}:${col}`
}

/**
 * Read a snapshot of all visible cell values from the workbook.
 */
async function takeCellSnapshot(
    workbook: ReturnType<ReturnType<typeof useEngine>['getWorkbook']>,
    sheetIdx: number,
    grid: Grid
): Promise<CellSnapshot> {
    const snapshot: CellSnapshot = new Map()
    if (grid.rows.length === 0 || grid.columns.length === 0) return snapshot

    const startRow = grid.rows[0].idx
    const endRow = grid.rows[grid.rows.length - 1].idx
    const startCol = grid.columns[0].idx
    const endCol = grid.columns[grid.columns.length - 1].idx

    const result = await workbook.getCells({
        sheetIdx,
        startRow,
        startCol,
        endRow,
        endCol,
    })

    if (isErrorMessage(result)) return snapshot

    // getCells returns a flat array; we need to map by position
    // The cells are returned for the rectangular range [startRow..endRow] x [startCol..endCol]
    const cells = result as readonly CellInfo[]
    let idx = 0
    for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
            if (idx < cells.length) {
                const cell = cells[idx]
                snapshot.set(cellKey(r, c), {
                    value: cell.value,
                    formula: cell.formula,
                })
            }
            idx++
        }
    }

    return snapshot
}

/**
 * Compare two cell snapshots and produce cell diffs.
 */
function computeCellDiffs(
    before: CellSnapshot,
    after: CellSnapshot
): CellDiff[] {
    const diffs: CellDiff[] = []

    // Check cells that existed before
    for (const [key, oldCell] of before) {
        const [rowStr, colStr] = key.split(':')
        const row = parseInt(rowStr, 10)
        const col = parseInt(colStr, 10)
        const newCell = after.get(key)

        if (!newCell) {
            // Cell was in view before but not after (could be removed or scrolled out)
            diffs.push({
                row,
                col,
                type: 'removed',
                oldValue: valueToString(oldCell.value),
            })
        } else {
            const oldStr = valueToString(oldCell.value)
            const newStr = valueToString(newCell.value)
            if (oldStr !== newStr || oldCell.formula !== newCell.formula) {
                diffs.push({
                    row,
                    col,
                    type: 'valueChanged',
                    oldValue: oldStr,
                    newValue: newStr,
                })
            }
        }
    }

    // Check cells that are new (exist after but not before)
    for (const [key, newCell] of after) {
        if (!before.has(key)) {
            const [rowStr, colStr] = key.split(':')
            const row = parseInt(rowStr, 10)
            const col = parseInt(colStr, 10)
            const val = valueToString(newCell.value)
            if (val !== '') {
                diffs.push({
                    row,
                    col,
                    type: 'added',
                    newValue: val,
                })
            }
        }
    }

    return diffs
}

export interface UseDiffLayerReturn {
    /** Current diff state to pass to DiffLayer component */
    diffState: DiffState
    /**
     * Apply a temp transaction and compute the diff.
     * This will show the diff overlay on the canvas.
     */
    applyTempTransaction: (payloads: readonly Payload[]) => Promise<void>
    /**
     * Commit the temp transaction (make it permanent) and clear the diff.
     */
    commit: () => Promise<void>
    /**
     * Discard the temp transaction and clear the diff.
     */
    discard: () => Promise<void>
    /** Whether a temp transaction is currently active */
    isActive: boolean
}

export function useDiffLayer(): UseDiffLayerReturn {
    const engine = useEngine()
    const dataSvc = engine.getDataService()
    const workbook = engine.getWorkbook()

    const [diffState, setDiffState] = useState<DiffState>(EMPTY_DIFF)
    const snapshotRef = useRef<CellSnapshot>(new Map())

    const applyTempTransaction = useCallback(
        async (payloads: readonly Payload[]) => {
            const grid = engine.getGrid()
            if (!grid) return

            const sheetIdx = dataSvc.getCurrentSheetIdx()

            // 1. Take snapshot of current (committed) cell values
            const beforeSnapshot = await takeCellSnapshot(
                workbook,
                sheetIdx,
                grid
            )
            snapshotRef.current = beforeSnapshot

            // 2. Apply the temp transaction (triggers re-render)
            const transaction = tx(payloads, true, true)
            await dataSvc.handleTransaction(transaction, true)

            // 3. Wait a tick for the grid to update
            await new Promise((resolve) => setTimeout(resolve, 50))

            // 4. Take snapshot of new (temp) cell values
            const newGrid = engine.getGrid()
            if (!newGrid) return

            const afterSnapshot = await takeCellSnapshot(
                workbook,
                sheetIdx,
                newGrid
            )

            // 5. Compute diffs
            const cellDiffs = computeCellDiffs(beforeSnapshot, afterSnapshot)

            // 6. Compute structural diffs (row/col count changes)
            const rowDiffs: RowDiff[] = []
            const colDiffs: ColDiff[] = []

            // Detect row changes by comparing grid dimensions
            const oldRowSet = new Set(grid.rows.map((r: Row) => r.idx))
            const newRowSet = new Set(newGrid.rows.map((r: Row) => r.idx))
            for (const r of newGrid.rows) {
                if (!oldRowSet.has(r.idx)) {
                    rowDiffs.push({idx: r.idx, type: 'inserted'})
                }
            }
            for (const r of grid.rows) {
                if (!newRowSet.has(r.idx)) {
                    rowDiffs.push({idx: r.idx, type: 'removed'})
                }
            }

            const oldColSet = new Set(grid.columns.map((c: Column) => c.idx))
            const newColSet = new Set(newGrid.columns.map((c: Column) => c.idx))
            for (const c of newGrid.columns) {
                if (!oldColSet.has(c.idx)) {
                    colDiffs.push({idx: c.idx, type: 'inserted'})
                }
            }
            for (const c of grid.columns) {
                if (!newColSet.has(c.idx)) {
                    colDiffs.push({idx: c.idx, type: 'removed'})
                }
            }

            setDiffState({
                cells: cellDiffs,
                rows: rowDiffs,
                cols: colDiffs,
                active: true,
            })
        },
        [engine, dataSvc, workbook]
    )

    const commit = useCallback(async () => {
        // Commit via worker (WorkbookClient doesn't directly expose commitTempStatus,
        // so we use the underlying _call mechanism)
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const wb = workbook as unknown as Record<string, unknown>
            if (typeof wb._call === 'function') {
                const call = wb._call as (
                    m: string,
                    args: unknown
                ) => Promise<unknown>
                await call('commitTempStatus', undefined)
            }
        } catch {
            // commitTempStatus not available on WorkbookClient
        }
        snapshotRef.current = new Map()
        setDiffState(EMPTY_DIFF)
    }, [workbook])

    const discard = useCallback(async () => {
        // Cleanup temp status via worker
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const wb = workbook as unknown as Record<string, unknown>
            if (typeof wb._call === 'function') {
                const call = wb._call as (
                    m: string,
                    args: unknown
                ) => Promise<unknown>
                await call('cleanupTempStatus', undefined)
            }
        } catch {
            // cleanupTempStatus not available on WorkbookClient
        }

        // Re-render to show committed state
        const grid = engine.getGrid()
        if (grid) {
            await engine.render(grid.anchorX, grid.anchorY)
        }

        snapshotRef.current = new Map()
        setDiffState(EMPTY_DIFF)
    }, [workbook, engine])

    return {
        diffState,
        applyTempTransaction,
        commit,
        discard,
        isActive: diffState.active,
    }
}
