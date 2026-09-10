/**
 * Synchronously resolve "is the user allowed to edit this cell?" using
 * only state that's available without RPC: the grid's `blockInfos`, whose
 * `schema` states each field's write policy.
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
 *   - Block cell whose field declares `writePolicy: 'ownerOnly'` → NOT
 *     editable.
 *   - `'anyone'` or `'inherit'` → editable here; for `'inherit'` the engine's
 *     owner-based fallback is the final word, and only matters when a block is
 *     registered to a specific caller.
 *
 * Limitations:
 *   - This handles only the field's declared policy. A per-record editability
 *     FORMULA is enforced through a shadow, which needs an async lookup;
 *     callers that must honour it route through the async permission patch.
 */

import type {BlockDisplayInfo, Grid} from 'logisheets-engine'
import type {BlockSchemaFieldEntry} from 'logisheets-web/pure'

/**
 * The schema field a sheet-absolute coordinate falls in, or `undefined` when
 * the block has no schema or the cell is outside its declared fields.
 *
 * A row schema runs its fields along columns and its records along rows; a
 * column schema flips both.
 */
export function fieldAt(
    info: BlockDisplayInfo['info'],
    row: number,
    col: number
): BlockSchemaFieldEntry | undefined {
    const schema = info.schema
    if (!schema) return undefined
    const idx =
        schema.schemaType === 'col' ? row - info.rowStart : col - info.colStart
    return schema.fields.find((f) => f.idx === idx)
}

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
            // Off the SCHEMA, which the grid already carries. This used to go
            // through the caller registry to a renderId and then into the
            // host's own field store — three hops to reach a flag the block's
            // own schema now states, and the only reason the registry had to
            // be populated at all for a cell edit to be judged.
            const field = fieldAt(info, row, col)
            if (!field) return true
            return field.writePolicy !== 'ownerOnly'
        }
    }
    return true
}
