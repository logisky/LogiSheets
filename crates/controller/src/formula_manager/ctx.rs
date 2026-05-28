use logisheets_base::{
    block_affect::BlockAffectTrait,
    get_book_name::GetBookNameTrait,
    id_fetcher::{IdFetcherTrait, SheetIdFetcherByIdxTrait, VertexFetcherTrait},
    index_fetcher::IndexFetcherTrait,
    BlockCellId, CellId, Range, RangeId, SheetId,
};

use crate::block_manager::schema_manager::schema::BlockCellRole;
use crate::formula_manager::Vertex;

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
