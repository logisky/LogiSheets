use logisheets_base::{
    block_affect::BlockAffectTrait, id_fetcher::IdFetcherTrait, index_fetcher::IndexFetcherTrait,
};
use std::collections::HashSet;

use crate::{
    cube_manager::CubeExecContext,
    formula_manager::{FormulaExecContext, FormulaManager},
    payloads::sheet_process::{
        block::{InsertColsPayload, InsertRowsPayload},
        BlockPayload, CreateBlock, SheetPayload, SheetProcess,
    },
    range_manager::RangeExecContext,
    BlockId, SheetId,
};

use super::utils::{add_dirty_vertices_from_cubes, add_dirty_vertices_from_ranges};

pub fn insert_block_line<C>(
    exec_ctx: FormulaExecContext,
    sheet_id: SheetId,
    block_id: BlockId,
    is_horizontal: bool,
    idx: usize,
    cnt: usize,
    ctx: &mut C,
) -> FormulaExecContext
where
    C: IdFetcherTrait + IndexFetcherTrait + BlockAffectTrait,
{
    let master_id = ctx.get_master_cell(sheet_id, block_id);
    let (row_cnt, col_cnt) = ctx.get_block_size(sheet_id, block_id).unwrap();
    let (master_row, master_col) = ctx.fetch_cell_index(&sheet_id, &master_id).unwrap();

    let (occupied_master_row, occupied_master_col, occupied_row_cnt, occupied_col_cnt) =
        if is_horizontal {
            (master_row + row_cnt, master_col, cnt, col_cnt)
        } else {
            (master_row, master_col + col_cnt, row_cnt, cnt)
        };

    // We use a create block payload to tell range/cube manager to occupy the area.
    // but there is no new block is created.
    // TODO: use an elegant way to handle this.
    let removed_proc = SheetProcess {
        sheet_id,
        payload: SheetPayload::Block(BlockPayload::Create(CreateBlock {
            block_id,
            master_row: occupied_master_row,
            master_col: occupied_master_col,
            row_cnt: occupied_row_cnt,
            col_cnt: occupied_col_cnt,
        })),
    };
    let FormulaManager {
        graph,
        formulas,
        range_manager,
        cube_manager,
        ext_ref_manager,
        names,
    } = exec_ctx.manager;

    let range_exec_ctx = range_manager.execute_sheet_proc(removed_proc.clone(), ctx);
    let cube_exec_ctx = cube_manager.execute_sheet_proc(removed_proc, ctx);

    let payload = if is_horizontal {
        SheetPayload::Block(BlockPayload::InsertRows(InsertRowsPayload {
            block_id,
            insert_cnt: cnt as usize,
            idx: idx as usize,
        }))
    } else {
        SheetPayload::Block(BlockPayload::InsertCols(InsertColsPayload {
            block_id,
            insert_cnt: cnt as usize,
            idx: idx as usize,
        }))
    };

    let proc = SheetProcess { sheet_id, payload };
    let mut dirty_vertices = HashSet::new();
    let RangeExecContext {
        manager: range_manager,
        dirty_ranges,
        removed_ranges,
    } = range_exec_ctx.execute_sheet_proc(proc.clone(), ctx);
    let cube_exec_ctx = cube_exec_ctx.execute_sheet_proc(proc.clone(), ctx);
    add_dirty_vertices_from_ranges(&mut dirty_vertices, dirty_ranges);
    add_dirty_vertices_from_ranges(&mut dirty_vertices, removed_ranges);

    let CubeExecContext {
        manager: cube_manager,
        dirty_cubes,
        removed_cubes,
    } = cube_exec_ctx.execute_sheet_proc(proc, ctx);
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
