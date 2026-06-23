/**
 * Synchronously resolve "is the user allowed to edit this cell?" using
 * only state that's available without RPC: the grid's `blockInfos`,
 * the host's caller-registry (which maps block cells to renderIds when
 * a schema binds), and the engine's in-process FieldManager.
 *
 * Used by host UI commit paths (cell editor, edit-bar) and by every
 * block-interface widget to short-circuit interaction BEFORE a
 * transaction reaches the engine. The permission patch in
 * `core/permissions/patch.ts` remains as defense-in-depth — it catches
 * any path that slipped past the UI guard (RPC clients, future widgets
 * that forget the check, etc.).
 *
 * Decision:
 *   - Non-block cell → editable (cells outside any block have no field
 *     constraint).
 *   - Block cell with field `userEditable: true` → editable.
 *   - Block cell with field `userEditable: false` → NOT editable.
 *   - Block cell with field `userEditable: undefined` → editable
 *     (permissive default; the engine's owner-based fallback is the
 *     final word and only matters when a block is registered to a
 *     specific caller).
 *
 * Limitations:
 *   - This only handles the *static* boolean form of `userEditable`.
 *     The dynamic string form (per-cell shadow formula) requires
 *     async shadow lookup; callers that need to honour it must route
 *     through the async permission patch instead.
 */

import type {Grid} from 'logisheets-engine'
import {getEngine} from '@/core/engine'
import {callerRegistry, isFieldUserEditable} from 'logisheets-core'

/**
 * Resolve editability for a sheet-absolute (row, col) coordinate.
 * Returns `true` when the cell is permitted to be edited by the user;
 * `false` only when the cell sits in a block and the bound field
 * explicitly carries `userEditable: false`.
 */
export function isCellUserEditableSync(
    sheetIdx: number,
    row: number,
    col: number,
    grid: Grid | null
): boolean {
    if (!grid?.blockInfos) return true
    for (const block of grid.blockInfos) {
        const info = block.info
        if (
            row >= info.rowStart &&
            row < info.rowStart + info.rowCnt &&
            col >= info.colStart &&
            col < info.colStart + info.colCnt
        ) {
            const blockRow = row - info.rowStart
            const blockCol = col - info.colStart
            const renderId = callerRegistry.getFieldRenderId(
                sheetIdx,
                info.blockId,
                blockRow,
                blockCol
            )
            if (!renderId) return true
            try {
                const fi = getEngine()
                    .getBlockManager()
                    .fieldManager.get(renderId)
                return isFieldUserEditable(fi)
            } catch {
                return true
            }
        }
    }
    return true
}
