use anyhow::Result;
use logisheets_base::{
    block_affect::BlockAffectTrait, id_fetcher::IdFetcherTrait, index_fetcher::IndexFetcherTrait,
};
use std::collections::HashSet;

use crate::{
    cube_manager::CubeExecContext,
    formula_manager::{FormulaExecContext, FormulaManager},
    payloads::sheet_process::{
        block::{DeleteColsPayload, DeleteRowsPayload},
        BlockPayload, SheetPayload, SheetProcess,
    },
    range_manager::RangeExecContext,
    BlockId, SheetId,
};

use super::utils::{add_dirty_vertices_from_cubes, add_dirty_vertices_from_ranges};

pub fn delete_block_line<C>(
    exec_ctx: FormulaExecContext,
    sheet_id: SheetId,
    block_id: BlockId,
    is_horizontal: bool,
    idx: usize,
    cnt: usize,
    ctx: &mut C,
) -> Result<FormulaExecContext>
where
    C: IdFetcherTrait + IndexFetcherTrait + BlockAffectTrait,
{
    let payload = if is_horizontal {
        SheetPayload::Block(BlockPayload::DeleteRows(DeleteRowsPayload {
            block_id,
            delete_cnt: cnt,
            idx: idx,
        }))
    } else {
        SheetPayload::Block(BlockPayload::DeleteCols(DeleteColsPayload {
            block_id,
            delete_cnt: cnt,
            idx: idx,
        }))
    };
    let proc = SheetProcess { sheet_id, payload };

    let FormulaManager {
        graph,
        formulas,
        range_manager,
        cube_manager,
        ext_ref_manager,
        names,
    } = exec_ctx.manager;

    let mut dirty_vertices = HashSet::new();
    let RangeExecContext {
        manager: range_manager,
        dirty_ranges,
        removed_ranges,
    } = range_manager.execute_sheet_proc(proc.clone(), ctx)?;
    add_dirty_vertices_from_ranges(&mut dirty_vertices, dirty_ranges);
    add_dirty_vertices_from_ranges(&mut dirty_vertices, removed_ranges);

    let CubeExecContext {
        manager: cube_manager,
        dirty_cubes,
        removed_cubes,
    } = cube_manager.execute_sheet_proc(proc, ctx);
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
