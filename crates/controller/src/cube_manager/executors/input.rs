use logisheets_base::{
    id_fetcher::IdFetcherTrait, index_fetcher::IndexFetcherTrait, Cube, CubeCross, CubeId,
};

use crate::{
    cube_manager::{CubeExecContext, CubeUpdateType},
    SheetId,
};

pub fn input<C>(
    exec_ctx: CubeExecContext,
    sheet: SheetId,
    row: usize,
    col: usize,
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

        match cube.cross {
            CubeCross::Single(_, _) => CubeUpdateType::None,
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
        }
    };
    exec_ctx.cube_update(&mut func)
}
