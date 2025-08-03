use crate::range_manager::{ctx::RangeExecCtx, executors::occupy_addr_range};

use super::{RangeExecutor, RangeUpdateType};
use logisheets_base::{BlockId, BlockRange, RangeId, SheetId};

pub fn resize_block<C>(
    exec_ctx: RangeExecutor,
    sheet_id: SheetId,
    block: BlockId,
    new_row_cnt: Option<usize>,
    new_col_cnt: Option<usize>,
    ctx: &C,
) -> RangeExecutor
where
    C: RangeExecCtx,
{
    let master_cell = ctx.get_master_cell(sheet_id, block).unwrap();
    let (old_row_cnt, old_col_cnt) = ctx.get_block_size(sheet_id, block).unwrap();

    let new_row_cnt = new_row_cnt.unwrap_or(old_row_cnt);
    let new_col_cnt = new_col_cnt.unwrap_or(old_col_cnt);

    let col_min = if new_col_cnt < old_col_cnt {
        new_col_cnt
    } else {
        old_col_cnt
    };
    let row_min = if new_row_cnt < old_row_cnt {
        new_row_cnt
    } else {
        old_row_cnt
    };
    let mut result = exec_ctx;

    if new_row_cnt > old_row_cnt || new_col_cnt > old_col_cnt {
        let (master_row, master_col) = ctx
            .fetch_normal_cell_index(&sheet_id, &master_cell)
            .unwrap();
        let end_cell = ctx
            .fetch_norm_cell_id(
                &sheet_id,
                master_row + new_row_cnt - 1,
                master_col + new_col_cnt - 1,
            )
            .unwrap();
        // If the new block is larger than the old block, we need to occupy the new block
        result = occupy_addr_range(result, sheet_id, master_cell, end_cell, ctx);
    }

    let mut func = |range: &BlockRange, _: &RangeId| -> RangeUpdateType {
        match range {
            BlockRange::Single(c) => {
                if c.block_id == block {
                    let (row, col) = ctx.fetch_block_cell_index(&sheet_id, c).unwrap();
                    if row >= row_min || col >= col_min {
                        RangeUpdateType::Removed
                    } else {
                        RangeUpdateType::None
                    }
                } else {
                    RangeUpdateType::None
                }
            }
            BlockRange::AddrRange(start, end) => {
                if start.block_id == block && end.block_id == block {
                    let (end_row, end_col) = ctx.fetch_block_cell_index(&sheet_id, end).unwrap();
                    if end_row >= row_min || end_col >= col_min {
                        RangeUpdateType::Removed
                    } else {
                        RangeUpdateType::None
                    }
                } else {
                    RangeUpdateType::None
                }
            }
        }
    };
    let result = result.block_range_update(&sheet_id, &mut func);
    result
}
