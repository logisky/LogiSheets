use logisheets_base::{Cube, CubeId, SheetId};

use crate::cube_manager::ctx::CubeExecCtx;

use super::{CubeExecutor, CubeUpdateType};

pub fn delete_sheet<C>(exec_ctx: CubeExecutor, sheet: SheetId, _ctx: &C) -> CubeExecutor
where
    C: CubeExecCtx,
{
    let mut func = |cube: &Cube, _: &CubeId| -> CubeUpdateType {
        let from_idx = _ctx.fetch_sheet_index(&cube.from_sheet).unwrap();
        let to_idx = _ctx.fetch_sheet_index(&cube.to_sheet).unwrap();
        let curr_idx = _ctx.fetch_sheet_index(&sheet).unwrap();
        if curr_idx < from_idx || curr_idx > to_idx {
            return CubeUpdateType::None;
        }

        CubeUpdateType::Dirty
    };
    exec_ctx.cube_update(&mut func)
}
