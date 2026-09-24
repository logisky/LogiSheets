use logisheets_base::{Cube, CubeId, SheetId};

use crate::Error;

use super::{
    CubeExecCtx, CubeExecutor, CubeUpdateType, utils::cube_spans_sheet,
    utils::get_lower_upper_bound_of_cross,
};

pub fn delete_line<C>(
    exec_ctx: CubeExecutor,
    sheet: SheetId,
    is_horizontal: bool,
    idx: usize,
    cnt: u32,
    old_ctx: &C,
) -> Result<CubeExecutor, Error>
where
    C: CubeExecCtx,
{
    let mut func = |cube: &Cube, _: &CubeId| -> Result<CubeUpdateType, Error> {
        if !cube_spans_sheet(old_ctx, cube, &sheet) {
            return Ok(CubeUpdateType::None);
        }

        let (lower, upper) = get_lower_upper_bound_of_cross(&cube.cross, is_horizontal);
        if cnt == 0 || lower > idx + cnt as usize - 1 || upper < idx {
            Ok(CubeUpdateType::None)
        } else {
            Ok(CubeUpdateType::Dirty)
        }
    };
    exec_ctx.cube_update(&mut func)
}
