use logisheets_base::{BlockId, BlockRange, CellId, Range, RangeId};

use super::{NewRange, RangeUpdateType};
use crate::{SheetId, range_manager::ctx::RangeExecCtx};

use super::{RangeExecutor, utils::cut_and_get_new_bound};

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
        // Either endpoint's cell may be ORPHANED at this point: a
        // BlockCellId carries a stable RowId/ColId that the navigator
        // may have already dropped (e.g. an earlier round deleted those
        // rows but no one removed the corresponding Range entry from
        // the range_manager — there's no DeleteRowsInBlock handler in
        // either range_manager or formula_manager that cleans up). The
        // surface symptom is that on the *next* DeleteRowsInBlock we
        // get here, the lookup explodes. Treat unresolvable endpoints
        // as a signal that the range itself is orphaned: mark it
        // Removed so the manager garbage-collects it, instead of
        // panicking and tearing down the whole transaction (silently,
        // since this fires from the wasm bridge with no console output
        // before the panic hook).
        let start_idx = ctx.fetch_cell_index(&sheet, &CellId::BlockCell(start.clone()));
        let end_idx = ctx.fetch_cell_index(&sheet, &CellId::BlockCell(end.clone()));
        let ((start_row, start_col), (end_row, end_col)) = match (start_idx, end_idx) {
            (Ok(s), Ok(e)) => (s, e),
            _ => return RangeUpdateType::Removed,
        };
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
