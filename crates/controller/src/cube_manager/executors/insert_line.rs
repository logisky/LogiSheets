use logisheets_base::{
    id_fetcher::IdFetcherTrait, index_fetcher::IndexFetcherTrait, Cube, CubeId, SheetId,
};

use crate::cube_manager::{CubeExecContext, CubeUpdateType};

use super::utils::get_lower_upper_bound_of_cross;

pub fn insert_line<C>(
    exec_ctx: CubeExecContext,
    sheet: SheetId,
    is_horizontal: bool,
    idx: usize,
    _cnt: u32,
    old_ctx: &mut C,
) -> CubeExecContext
where
    C: IdFetcherTrait + IndexFetcherTrait,
{
    let mut func = |cube: &Cube, _: &CubeId| -> CubeUpdateType {
        let from_idx = old_ctx.fetch_sheet_index(&cube.from_sheet).unwrap();
        let to_idx = old_ctx.fetch_sheet_index(&cube.to_sheet).unwrap();
        let curr_idx = old_ctx.fetch_sheet_index(&sheet).unwrap();
        if curr_idx < from_idx || curr_idx > to_idx {
            return CubeUpdateType::None;
        }

        let (lower, upper) = get_lower_upper_bound_of_cross(&cube.cross, is_horizontal);
        if lower >= idx || upper < idx {
            CubeUpdateType::None
        } else {
            CubeUpdateType::Dirty
        }
    };
    exec_ctx.cube_update(&mut func)
}
