use super::super::Result;
use logisheets_base::{
    block_affect::BlockAffectTrait, id_fetcher::IdFetcherTrait, index_fetcher::IndexFetcherTrait,
    BlockId,
};
use std::collections::HashSet;

use crate::{
    cube_manager::CubeExecContext,
    formula_manager::{FormulaExecContext, FormulaManager},
    payloads::sheet_process::{
        block::{BlockPayload, CreateBlockPayload},
        SheetPayload, SheetProcess,
    },
    range_manager::RangeExecContext,
    SheetId,
};

use super::utils::{add_dirty_vertices_from_cubes, add_dirty_vertices_from_ranges};

pub fn create_block<C>(
    exec_ctx: FormulaExecContext,
    sheet_id: SheetId,
    block_id: BlockId,
    master_row: usize,
    master_col: usize,
    row_cnt: usize,
    col_cnt: usize,
    old_ctx: &mut C,
) -> Result<FormulaExecContext>
where
    C: IdFetcherTrait + IndexFetcherTrait + BlockAffectTrait,
{
    let sp = SheetProcess {
        sheet_id,
        payload: SheetPayload::Block(BlockPayload::Create(CreateBlockPayload {
            block_id,
            master_row,
            master_col,
            row_cnt,
            col_cnt,
        })),
    };

    let mut dirty_vertices = HashSet::new();

    let FormulaManager {
        graph,
        formulas,
        range_manager,
        cube_manager,
        ext_ref_manager,
        names,
    } = exec_ctx.manager;

    let RangeExecContext {
        manager: range_manager,
        dirty_ranges,
        removed_ranges,
    } = range_manager.execute_sheet_proc(sp.clone(), old_ctx)?;
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

    Ok(FormulaExecContext {
        manager: new_manager,
        dirty_vertices,
    })
}
