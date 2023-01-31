use logisheets_base::{
    block_affect::BlockAffectTrait, id_fetcher::IdFetcherTrait, index_fetcher::IndexFetcherTrait,
};

use crate::{
    cube_manager::CubeExecContext,
    formula_manager::{FormulaExecContext, FormulaManager},
    payloads::sheet_process::{
        shift::ShiftType, Direction, LineShift, SheetPayload, SheetProcess, ShiftPayload,
    },
    range_manager::RangeExecContext,
    SheetId,
};

use super::utils::{add_dirty_vertices_from_cubes, add_dirty_vertices_from_ranges};

pub fn insert_line<C>(
    exec_ctx: FormulaExecContext,
    sheet_id: SheetId,
    is_horizontal: bool,
    idx: usize,
    cnt: u32,
    old_ctx: &mut C,
) -> FormulaExecContext
where
    C: IdFetcherTrait + IndexFetcherTrait + BlockAffectTrait,
{
    let FormulaManager {
        graph,
        formulas,
        range_manager,
        cube_manager,
        ext_ref_manager,
        names,
    } = exec_ctx.manager;
    let mut dirty_vertices = exec_ctx.dirty_vertices;

    let sp = SheetProcess {
        sheet_id,
        payload: SheetPayload::Shift(ShiftPayload::Line(LineShift {
            start: idx,
            cnt,
            ty: ShiftType::Insert,
            direction: if is_horizontal {
                Direction::Horizontal
            } else {
                Direction::Vertical
            },
        })),
    };

    let RangeExecContext {
        manager: range_manager,
        dirty_ranges,
        removed_ranges,
    } = range_manager.execute_sheet_proc(sp.clone(), old_ctx);
    add_dirty_vertices_from_ranges(&mut dirty_vertices, dirty_ranges);
    add_dirty_vertices_from_ranges(&mut dirty_vertices, removed_ranges);

    let CubeExecContext {
        manager: cube_manager,
        dirty_cubes,
        removed_cubes,
    } = cube_manager.execute_sheet_proc(sp, old_ctx);
    add_dirty_vertices_from_cubes(&mut dirty_vertices, dirty_cubes);
    add_dirty_vertices_from_cubes(&mut dirty_vertices, removed_cubes);

    let new_manager = FormulaManager {
        graph,
        formulas,
        range_manager,
        cube_manager,
        ext_ref_manager,
        names,
    };

    FormulaExecContext {
        manager: new_manager,
        dirty_vertices,
    }
}
