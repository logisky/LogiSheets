use logisheets_base::{BlockId, BlockRange, CellId, Range, RangeId};

use super::{NewRange, RangeUpdateType};
use crate::{range_manager::ctx::RangeExecCtx, SheetId};

use super::{utils::cut_and_get_new_bound, RangeExecutor};

pub fn delete_block_line<C>(
    exec_ctx: RangeExecutor,
    sheet: SheetId,
    block: BlockId,
    horizontal: bool,
    idx: u32,
    cnt: u32,
    ctx: &C,
) -> RangeExecutor
where
    C: RangeExecCtx,
{
    let delete_start = idx as usize;
    let delete_end = (idx + cnt - 1) as usize;
    let mut func = |range: &BlockRange, range_id: &RangeId| -> RangeUpdateType {
        let (start, end) = match range {
            BlockRange::Single(s) => (s, s),
            BlockRange::AddrRange(s, e) => (s, e),
        };
        if start.block_id != block && end.block_id != block {
            return RangeUpdateType::None;
        }
        if start.block_id != end.block_id {
            // This should not be reachable
            return RangeUpdateType::Dirty;
        }
        let (start_row, start_col) = ctx
            .fetch_cell_index(&sheet, &CellId::BlockCell(start.clone()))
            .unwrap();
        let (end_row, end_col) = ctx
            .fetch_cell_index(&sheet, &CellId::BlockCell(end.clone()))
            .unwrap();
        let (range_start, range_end) = if horizontal {
            (start_row, end_row)
        } else {
            (start_col, end_col)
        };
        match cut_and_get_new_bound(range_start, range_end, delete_start, delete_end) {
            Some((new_start, new_end)) => {
                let (new_start_row, new_start_col, new_end_row, new_end_col) = if horizontal {
                    (new_start, start_col, new_end, end_col)
                } else {
                    (start_row, new_start, end_row, new_end)
                };
                let new_range_start = ctx
                    .fetch_cell_id(&sheet, new_start_row, new_start_col)
                    .unwrap();

                if new_start_row == new_end_row && new_start_col == new_end_col {
                    if let CellId::BlockCell(bc) = new_range_start {
                        return RangeUpdateType::UpdateTo(NewRange {
                            id: range_id.clone(),
                            range: Range::Block(BlockRange::Single(bc)),
                        });
                    } else {
                        unreachable!()
                    }
                }
                let new_range_end = ctx.fetch_cell_id(&sheet, new_end_row, new_end_col).unwrap();
                match (new_range_start, new_range_end) {
                    (CellId::BlockCell(s), CellId::BlockCell(e)) => {
                        RangeUpdateType::UpdateTo(NewRange {
                            id: range_id.clone(),
                            range: Range::Block(BlockRange::AddrRange(s, e)),
                        })
                    }
                    _ => unreachable!(),
                }
            }
            None => RangeUpdateType::None,
        }
    };
    let result = exec_ctx.block_range_update(&sheet, &mut func);
    result
}
