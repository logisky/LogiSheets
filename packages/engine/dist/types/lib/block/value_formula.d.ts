/**
 * Field-level value-formula substitution.
 *
 * A field carries a `valueFormula` template on its FieldInfo. Templates
 * use two placeholders:
 *
 *   `#FIELD("name")` → absolute A1 reference to the same row's cell in
 *                       the sibling field named `name`.
 *   `#KEY`            → the row's key value, quoted as a string literal.
 *
 * Substitution is host-side: callers (block-composer's row-add path,
 * block-interface's +Add Row handler, or any craft programmatically
 * inserting rows) call {@link expandFieldFormula} to produce a concrete
 * Excel formula, then write it via `blockInput` / `cellInput`.
 *
 * The engine itself sees only the resulting plain formula — A1 refs and
 * BLOCKREF calls behave normally. Constraint enforcement (templated
 * fields are uneditable) is handled by FieldManager + the block-interface
 * widgets.
 */
/** 0-based column index → Excel column letters: 0→A, 25→Z, 26→AA, … */
export declare function colIdxToLetters(col: number): string;
/**
 * Substitute `#FIELD("name")` and `#KEY` placeholders in `template`
 * against a concrete row of a block.
 *
 * - `fields` is the ordered list of field names occupying the block's
 *   columns (left-to-right). The Nth entry corresponds to absolute col
 *   `colStart + N`.
 * - `sheetRowZero` is the 0-based absolute sheet row of this row.
 * - `colStart` is the 0-based absolute sheet col of the block's first
 *   field (typically `BlockInfo.colStart`).
 * - `key` is the row's key value as a string. The host substitutes it
 *   as a literal (with `"` doubled per Excel string escaping rules).
 *   Passing `""` is allowed when the key isn't known yet — `#KEY`
 *   becomes the empty string literal `""`.
 *
 * Throws if the template references a `#FIELD("X")` where `X` isn't in
 * `fields`.
 */
export declare function expandFieldFormula(params: {
    template: string;
    fields: readonly string[];
    sheetRowZero: number;
    colStart: number;
    key: string;
}): string;
