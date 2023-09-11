use super::super::Result;
use logisheets_base::{
    block_affect::BlockAffectTrait, id_fetcher::IdFetcherTrait, index_fetcher::IndexFetcherTrait,
};
use std::collections::HashSet;

use crate::{
    cube_manager::CubeExecContext,
    formula_manager::{FormulaExecContext, FormulaManager},
    payloads::sheet_process::{
        shift::ShiftType, BlockPayload, CreateBlock, Direction, LineShift, SheetPayload,
        SheetProcess, ShiftPayload,
    },
    range_manager::RangeExecContext,
    SheetId,
};

use super::utils::{add_dirty_vertices_from_cubes, add_dirty_vertices_from_ranges};

pub fn delete_line<C>(
    exec_ctx: FormulaExecContext,
    sheet_id: SheetId,
    is_horizontal: bool,
    idx: usize,
    cnt: u32,
    ctx: &mut C,
) -> Result<FormulaExecContext>
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

    let blocks = ctx.get_blocks_across_line(sheet_id, idx, cnt as usize, is_horizontal)?;
    let mut range_exec_ctx = RangeExecContext::new(range_manager);
    let mut cube_exec_ctx = CubeExecContext::new(cube_manager);

    for block_id in blocks {
        let master_id = ctx.get_master_cell(sheet_id, block_id)?;
        let (row_cnt, col_cnt) = ctx.get_block_size(sheet_id, block_id)?;
        let (master_row, master_col) = ctx.fetch_cell_index(&sheet_id, &master_id).unwrap();

        let (occupied_master_row, occupied_master_col, occupied_row_cnt, occupied_col_cnt) =
            if is_horizontal {
                (master_row + row_cnt, master_col, cnt as usize, col_cnt)
            } else {
                (master_row, master_col + col_cnt, row_cnt, cnt as usize)
            };
        // We use a create block payload to tell range/cube manager to occupy the area.
        // but there is no new block is created.
        // TODO: use an elegant way to handle this.
        let removed_payload = SheetProcess {
            sheet_id,
            payload: SheetPayload::Block(BlockPayload::Create(CreateBlock {
                block_id,
                master_row: occupied_master_row,
                master_col: occupied_master_col,
                row_cnt: occupied_row_cnt,
                col_cnt: occupied_col_cnt,
            })),
        };
        let new_range_exec_ctx = range_exec_ctx.execute_sheet_proc(removed_payload.clone(), ctx)?;
        let new_cube_exec_ctx = cube_exec_ctx.execute_sheet_proc(removed_payload, ctx);
        range_exec_ctx = new_range_exec_ctx;
        cube_exec_ctx = new_cube_exec_ctx;
    }

    let delete_line_proc = SheetProcess {
        sheet_id,
        payload: SheetPayload::Shift(ShiftPayload::Line(LineShift {
            start: idx,
            cnt,
            ty: ShiftType::Delete,
            direction: if is_horizontal {
                Direction::Horizontal
            } else {
                Direction::Vertical
            },
        })),
    };

    let mut dirty_vertices = HashSet::new();
    let RangeExecContext {
        manager: range_manager,
        dirty_ranges,
        removed_ranges,
    } = range_exec_ctx.execute_sheet_proc(delete_line_proc.clone(), ctx)?;
    add_dirty_vertices_from_ranges(&mut dirty_vertices, dirty_ranges);
    add_dirty_vertices_from_ranges(&mut dirty_vertices, removed_ranges);

    let CubeExecContext {
        manager: cube_manager,
        dirty_cubes,
        removed_cubes,
    } = cube_exec_ctx.execute_sheet_proc(delete_line_proc, ctx);
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
