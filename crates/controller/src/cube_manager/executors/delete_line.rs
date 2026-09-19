use logisheets_base::{Cube, CubeId, SheetId};

use crate::Error;

use super::{CubeExecCtx, CubeExecutor, CubeUpdateType, utils::get_lower_upper_bound_of_cross};

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
        let from_idx = old_ctx.fetch_sheet_index(&cube.from_sheet)?;
        let to_idx = old_ctx.fetch_sheet_index(&cube.to_sheet)?;
        let curr_idx = old_ctx.fetch_sheet_index(&sheet)?;
        if curr_idx < from_idx || curr_idx > to_idx {
            return Ok(CubeUpdateType::None);
        }

        let (lower, upper) = get_lower_upper_bound_of_cross(&cube.cross, is_horizontal);
        if lower > idx + cnt as usize - 1 || upper < idx {
            Ok(CubeUpdateType::None)
        } else {
            Ok(CubeUpdateType::Dirty)
        }
    };
    exec_ctx.cube_update(&mut func)
}
