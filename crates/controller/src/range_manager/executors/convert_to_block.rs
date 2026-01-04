use logisheets_base::{BlockCellId, BlockId, BlockRange, NormalRange, Range, RangeId, SheetId};

use crate::range_manager::{
    ctx::RangeExecCtx,
    executors::{NewRange, RangeUpdateType},
    RangeExecutor,
};

pub fn convert_to_block<C>(
    exec_ctx: RangeExecutor,
    sheet_id: SheetId,
    block_id: BlockId,
    master_row: usize,
    master_col: usize,
    row_cnt: usize,
    col_cnt: usize,
    ctx: &C,
) -> RangeExecutor
where
    C: RangeExecCtx,
{
    // This block has not been created literally at this point.
    // Since this is a new block, we can get the cell id by row and col.
    let get_block_cell_id = |block_id: &BlockId, row: usize, col: usize| BlockCellId {
        block_id: block_id.clone(),
        row: row as u32,
        col: col as u32,
    };
    let mut func = |range: &NormalRange, range_id: &RangeId| -> RangeUpdateType {
        match range {
            NormalRange::Single(normal_cell_id) => {
                if let Ok((row, col)) = ctx.fetch_normal_cell_index(&sheet_id, normal_cell_id) {
                    if (row >= master_row && row < master_row + row_cnt)
                        && (col >= master_col && col < master_col + col_cnt)
                    {
                        let block_cell_id =
                            get_block_cell_id(&block_id, row - master_row, col - master_col);
                        return RangeUpdateType::UpdateToBlock(
                            range.clone(),
                            BlockRange::Single(block_cell_id),
                        );
                    }
                }
                RangeUpdateType::None
            }
            NormalRange::RowRange(s, e) => {
                if *s >= master_row as u32 && *e < (master_row + row_cnt) as u32 {
                    RangeUpdateType::Dirty
                } else {
                    RangeUpdateType::None
                }
            }
            NormalRange::ColRange(s, e) => {
                if *s >= master_col as u32 && *e < (master_col + col_cnt) as u32 {
                    RangeUpdateType::Dirty
                } else {
                    RangeUpdateType::None
                }
            }
            NormalRange::AddrRange(start, end) => {
                let start_idx = ctx.fetch_normal_cell_index(&sheet_id, start);
                let end_idx = ctx.fetch_normal_cell_index(&sheet_id, end);
                let ((start_row, start_col), (end_row, end_col)) = match (start_idx, end_idx) {
                    (Ok(s), Ok(e)) => (s, e),
                    _ => return RangeUpdateType::None,
                };
                let start_in = start_row >= master_row
                    && start_row < master_row + row_cnt
                    && start_col >= master_col
                    && start_col < master_col + col_cnt;
                let end_in = end_row >= master_row
                    && end_row < master_row + row_cnt
                    && end_col >= master_col
                    && end_col < master_col + col_cnt;
                match (start_in, end_in) {
                    (true, true) => {
                        let start_block_id = get_block_cell_id(
                            &block_id,
                            start_row - master_row,
                            start_col - master_col,
                        );
                        let end_block_id = get_block_cell_id(
                            &block_id,
                            end_row - master_row,
                            end_col - master_col,
                        );
                        RangeUpdateType::UpdateToBlock(
                            range.clone(),
                            BlockRange::AddrRange(start_block_id, end_block_id),
                        )
                    }
                    (true, false) => {
                        let new_start_row = master_row + row_cnt as usize;
                        let new_start_col = master_col + col_cnt as usize;
                        let new_start_id =
                            ctx.fetch_norm_cell_id(&sheet_id, new_start_row, new_start_col);
                        match new_start_id {
                            Ok(id) => RangeUpdateType::UpdateTo(NewRange {
                                id: *range_id,
                                range: Range::Normal(NormalRange::AddrRange(id, *end)),
                            }),
                            _ => RangeUpdateType::None,
                        }
                    }
                    (false, true) => {
                        let new_end_row = master_row - 1;
                        let new_end_col = master_col - 1;
                        let new_end_id =
                            ctx.fetch_norm_cell_id(&sheet_id, new_end_row, new_end_col);
                        match new_end_id {
                            Ok(id) => RangeUpdateType::UpdateTo(NewRange {
                                id: *range_id,
                                range: Range::Normal(NormalRange::AddrRange(*start, id)),
                            }),
                            Err(_) => RangeUpdateType::None,
                        }
                    }
                    (false, false) => {
                        if start_row > master_row + row_cnt as usize || end_row < master_row {
                            RangeUpdateType::None
                        } else if start_col > master_col + col_cnt as usize || end_col < master_col
                        {
                            RangeUpdateType::None
                        } else {
                            RangeUpdateType::Dirty
                        }
                    }
                }
            }
        }
    };
    exec_ctx.normal_range_update(&sheet_id, &mut func)
}
