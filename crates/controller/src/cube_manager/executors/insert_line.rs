use logisheets_base::{
    Cube, CubeId, SheetId, id_fetcher::IdFetcherTrait, index_fetcher::IndexFetcherTrait,
};

use crate::Error;

use super::{
    CubeExecutor, CubeUpdateType,
    utils::{cube_spans_sheet, get_lower_upper_bound_of_cross},
};

pub fn insert_line<C>(
    exec_ctx: CubeExecutor,
    sheet: SheetId,
    is_horizontal: bool,
    idx: usize,
    _cnt: u32,
    old_ctx: &C,
) -> Result<CubeExecutor, Error>
where
    C: IdFetcherTrait + IndexFetcherTrait,
{
    let mut func = |cube: &Cube, _: &CubeId| -> Result<CubeUpdateType, Error> {
        if !cube_spans_sheet(old_ctx, cube, &sheet) {
            return Ok(CubeUpdateType::None);
        }

        let (lower, upper) = get_lower_upper_bound_of_cross(&cube.cross, is_horizontal);
        if lower >= idx || upper < idx {
            Ok(CubeUpdateType::None)
        } else {
            Ok(CubeUpdateType::Dirty)
        }
    };
    exec_ctx.cube_update(&mut func)
}
