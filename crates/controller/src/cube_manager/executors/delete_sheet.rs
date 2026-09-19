use logisheets_base::{Cube, CubeId, SheetId};

use crate::Error;
use crate::cube_manager::ctx::CubeExecCtx;

use super::{CubeExecutor, CubeUpdateType};

pub fn delete_sheet<C>(
    exec_ctx: CubeExecutor,
    sheet: SheetId,
    _ctx: &C,
) -> Result<CubeExecutor, Error>
where
    C: CubeExecCtx,
{
    let mut func = |cube: &Cube, _: &CubeId| -> Result<CubeUpdateType, Error> {
        let from_idx = _ctx.fetch_sheet_index(&cube.from_sheet)?;
        let to_idx = _ctx.fetch_sheet_index(&cube.to_sheet)?;
        let curr_idx = _ctx.fetch_sheet_index(&sheet)?;
        if curr_idx < from_idx || curr_idx > to_idx {
            return Ok(CubeUpdateType::None);
        }

        Ok(CubeUpdateType::Dirty)
    };
    exec_ctx.cube_update(&mut func)
}
