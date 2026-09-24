use logisheets_base::{Cube, CubeId, SheetId};

use crate::Error;
use crate::cube_manager::ctx::CubeExecCtx;

use super::{CubeExecutor, CubeUpdateType, utils::cube_spans_sheet};

pub fn delete_sheet<C>(
    exec_ctx: CubeExecutor,
    sheet: SheetId,
    _ctx: &C,
) -> Result<CubeExecutor, Error>
where
    C: CubeExecCtx,
{
    let mut func = |cube: &Cube, _: &CubeId| -> Result<CubeUpdateType, Error> {
        if !cube_spans_sheet(_ctx, cube, &sheet) {
            return Ok(CubeUpdateType::None);
        }

        Ok(CubeUpdateType::Dirty)
    };
    exec_ctx.cube_update(&mut func)
}
