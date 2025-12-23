use logisheets_base::{
    block_affect::BlockAffectTrait,
    get_book_name::GetBookNameTrait,
    id_fetcher::{IdFetcherTrait, SheetIdFetcherByIdxTrait, VertexFetcherTrait},
    index_fetcher::IndexFetcherTrait,
    CellId, SheetId,
};

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
}
