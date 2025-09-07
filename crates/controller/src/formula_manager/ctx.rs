use logisheets_base::{
    block_affect::BlockAffectTrait,
    get_book_name::GetBookNameTrait,
    id_fetcher::{IdFetcherTrait, SheetIdFetcherByIdxTrait, VertexFetcherTrait},
    index_fetcher::IndexFetcherTrait,
    CellId, CubeId, ExtRefId, RangeId, SheetId,
};
use std::collections::HashSet;

pub trait FormulaExecCtx:
    SheetIdFetcherByIdxTrait
    + IdFetcherTrait
    + IndexFetcherTrait
    + BlockAffectTrait
    + GetBookNameTrait
    + VertexFetcherTrait
    + logisheets_parser::context::ContextTrait
{
    fn remove_range_id(&mut self, sheet_id: &SheetId, range_id: &RangeId);

    fn remove_cube_id(&mut self, cube_id: &CubeId);

    fn remove_ext_ref_id(&mut self, id: &ExtRefId);

    fn get_dirty_range_ids(&self) -> HashSet<(SheetId, RangeId)>;

    fn get_dirty_cube_ids(&self) -> HashSet<CubeId>;

    fn get_cell_id_by_shadow_id(&self, shadow_id: &u64) -> Option<(SheetId, CellId)>;
}
