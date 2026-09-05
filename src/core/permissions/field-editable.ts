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
 *   - Block cell whose field carries a value formula → NOT editable. The
 *     engine owns those cells; see `getCellFieldFormula`.
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

import type {BlockDisplayInfo, Grid} from 'logisheets-engine'
import {getEngine} from '@/core/engine'
import {callerRegistry, isFieldUserEditable} from 'logisheets-core'

/**
 * The block whose rectangle covers a sheet-absolute coordinate, or
 * `undefined` when the cell sits outside every block.
 */
function blockAt(
    grid: Grid | null,
    row: number,
    col: number
): BlockDisplayInfo | undefined {
    return grid?.blockInfos?.find((block: BlockDisplayInfo) => {
        const i = block.info
        return (
            row >= i.rowStart &&
            row < i.rowStart + i.rowCnt &&
            col >= i.colStart &&
            col < i.colStart + i.colCnt
        )
    })
}

/**
 * The raw field-formula template governing this cell (e.g.
 * `=#FIELD("qty")*#FIELD("price")`), or `undefined` when the cell isn't in a
 * block or its field is free-form.
 *
 * Read straight off `grid.blockInfos` — the engine ships each block's schema
 * with the display window, so this needs no RPC and, unlike the host-side
 * `FieldInfo`, it is present for blocks nobody in this session authored:
 * loaded from a file, created by a craft, or written by another client.
 */
export function getCellFieldFormula(
    row: number,
    col: number,
    grid: Grid | null
): string | undefined {
    const block = blockAt(grid, row, col)
    const schema = block?.info.schema
    if (!block || !schema || schema.schemaType === 'random') return undefined
    // `idx` is the field's offset along the schema's field axis: columns for
    // a row schema (one field per column), rows for a col schema.
    const axisIdx =
        schema.schemaType === 'row'
            ? col - block.info.colStart
            : row - block.info.rowStart
    const formula = schema.fields.find((f) => f.idx === axisIdx)?.valueFormula
    return formula && formula.trim() !== '' ? formula : undefined
}

/**
 * Why a write to this cell was refused, phrased for the person who just tried.
 *
 * A guard that silently swallows a keystroke is indistinguishable from a
 * broken grid, and a computed column is exactly the case where the reason is
 * both non-obvious and actionable — the value is editable, just not here.
 */
export function editRefusedMessage(
    row: number,
    col: number,
    grid: Grid | null
): string {
    const formula = getCellFieldFormula(row, col, grid)
    if (formula)
        return `This column is computed by its field formula (${formula}). Change the block’s field formula to edit it.`
    return 'This cell is read-only.'
}

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
    // A field formula owns its whole column: the engine recomputes those cells
    // from the schema and refuses writes to them, so the UI must not offer an
    // editor that would silently do nothing. This is checked first because it
    // holds for every block the engine knows about, not just ones this session
    // registered a FieldInfo for.
    if (getCellFieldFormula(row, col, grid) !== undefined) return false
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
