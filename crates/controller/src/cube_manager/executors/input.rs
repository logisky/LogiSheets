use logisheets_base::{Cube, CubeCross, CubeId};

use crate::{Error, SheetId, cube_manager::ctx::CubeExecCtx};

use super::{CubeExecutor, CubeUpdateType, utils::cube_spans_sheet};

pub fn input<C>(
    exec_ctx: CubeExecutor,
    sheet: SheetId,
    row: usize,
    col: usize,
    old_ctx: &C,
) -> Result<CubeExecutor, Error>
where
    C: CubeExecCtx,
{
    let mut func = |cube: &Cube, _: &CubeId| -> Result<CubeUpdateType, Error> {
        if !cube_spans_sheet(old_ctx, cube, &sheet) {
            return Ok(CubeUpdateType::None);
        }

        Ok(match cube.cross {
            CubeCross::Single(r, c) => {
                if row == r && col == c {
                    CubeUpdateType::Dirty
                } else {
                    CubeUpdateType::None
                }
            }
            CubeCross::RowRange(start, end) => {
                if row >= start && row <= end {
                    CubeUpdateType::Dirty
                } else {
                    CubeUpdateType::None
                }
            }
            CubeCross::ColRange(start, end) => {
                if col >= start && col <= end {
                    CubeUpdateType::Dirty
                } else {
                    CubeUpdateType::None
                }
            }
            CubeCross::AddrRange(start, end) => {
                if row >= start.row && col >= start.col && row <= end.row && col <= end.col {
                    CubeUpdateType::Dirty
                } else {
                    CubeUpdateType::None
                }
            }
        })
    };
    exec_ctx.cube_update(&mut func)
}
