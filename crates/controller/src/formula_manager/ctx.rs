use logisheets_base::{
    block_affect::BlockAffectTrait,
    get_book_name::GetBookNameTrait,
    id_fetcher::{IdFetcherTrait, SheetIdFetcherByIdxTrait, VertexFetcherTrait},
    index_fetcher::IndexFetcherTrait,
    BlockCellId, CellId, Range, RangeId, SheetId,
};

use crate::block_manager::schema_manager::schema::BlockCellRole;
use crate::formula_manager::Vertex;
use crate::sid_assigner::ShadowKind;

pub trait FormulaExecCtx:
    SheetIdFetcherByIdxTrait
    + IdFetcherTrait
    + IndexFetcherTrait
    + BlockAffectTrait
    + GetBookNameTrait
    + VertexFetcherTrait
    + logisheets_parser::context::ContextTrait
{
    fn get_cell_id_by_shadow_id(&self, shadow_id: &u64) -> Option<(SheetId, CellId)>;

    fn get_range_deps(&self, vertex: &Vertex) -> Vec<Vertex>;

    /// Translate a single-cell range id back to its underlying `Range`. Used
    /// by the formula executor to detect when a trigger is actually a
    /// block-cell write and translate it into the right virtual node dirty.
    fn lookup_range(&self, sheet_id: SheetId, range_id: RangeId) -> Option<Range>;

    /// Classify a block-cell against the schema bound to its block, so the
    /// caller can dirty the right virtual node.
    fn block_cell_role(&self, sheet_id: SheetId, cell: &BlockCellId) -> BlockCellRole;

    /// If this block cell sits in a field with a value-formula template,
    /// return everything the executor needs to substitute and parse it:
    ///   1. the raw template (still including `=` if the author wrote one)
    ///   2. (field name → sibling BlockCellId in this row) — for `#FIELD`
    ///   3. the key cell's current string value — for `#KEY`
    /// Returns `None` if the cell isn't templated (or schema doesn't
    /// support templates, e.g. RandomSchema).
    fn block_cell_template(
        &self,
        sheet_id: SheetId,
        cell: &BlockCellId,
    ) -> Option<BlockCellTemplate>;

    /// Like {@link block_cell_template} but without requiring the cell to
    /// have a value-formula template. Returns the per-row `#FIELD` /
    /// `#KEY` substitutes whenever the cell lives in a schema-bound
    /// block — used by validation-formula substitution where the cell
    /// being validated may itself be a plain (non-templated) field.
    fn block_cell_row_substitutes(
        &self,
        sheet_id: SheetId,
        cell: &BlockCellId,
    ) -> Option<BlockCellRowContext>;

    /// Read the validation- or editability-formula template that the
    /// schema has registered for this cell's field, if any. Returns the
    /// raw template string (may or may not include a leading `=`).
    fn block_cell_shadow_template(
        &self,
        sheet_id: SheetId,
        cell: &BlockCellId,
        kind: ShadowKind,
    ) -> Option<String>;

    /// Get-or-allocate the shadow id used for (sheet, cell, kind). Used
    /// by the engine-internal shadow auto-install path so it can write
    /// the rule formula without the caller having to mint ids.
    fn allocate_block_cell_shadow_id(
        &mut self,
        sheet_id: SheetId,
        cell: &BlockCellId,
        kind: ShadowKind,
    ) -> u64;

    /// Look up a previously-allocated shadow id without allocating a
    /// fresh one. Returns `None` if the (cell, kind) pair has never had
    /// a shadow. Used by the remove-rule path so we can clear a shadow
    /// that's no longer wanted.
    fn find_block_cell_shadow_id(
        &self,
        sheet_id: SheetId,
        cell: &BlockCellId,
        kind: ShadowKind,
    ) -> Option<u64>;
}

/// Substitution context returned by
/// {@link FormulaExecCtx::block_cell_template}. Borrowed strings would
/// require lifetime gymnastics through the trait; we hand back owned
/// data since this path is only hit on cell input (not hot).
pub struct BlockCellTemplate {
    pub template: String,
    pub siblings: Vec<(String, BlockCellId)>,
    pub key_value: String,
}

/// Per-row substitution context for `#FIELD("name")` / `#KEY` resolution.
/// Returned by {@link FormulaExecCtx::block_cell_row_substitutes}
/// regardless of whether the cell itself carries a value-formula template.
pub struct BlockCellRowContext {
    pub siblings: Vec<(String, BlockCellId)>,
    pub key_value: String,
}
