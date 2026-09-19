use logisheets_base::{BlockId, BlockRange, CellId, Range, RangeId};

use crate::{Error, SheetId, range_manager::ctx::RangeExecCtx};

use super::{NewRange, RangeUpdateType};

use super::{RangeExecutor, utils::cut_and_get_new_bound};

pub fn delete_block_line<C>(
    exec_ctx: RangeExecutor,
    sheet: SheetId,
    block: BlockId,
    horizontal: bool,
    idx: u32,
    cnt: u32,
    ctx: &C,
) -> Result<RangeExecutor, Error>
where
    C: RangeExecCtx,
{
    let delete_start = idx as usize;
    let delete_end = (idx + cnt - 1) as usize;
    let mut func = |range: &BlockRange, range_id: &RangeId| -> Result<RangeUpdateType, Error> {
        let (start, end) = match range {
            BlockRange::Single(s) => (s, s),
            BlockRange::AddrRange(s, e) => (s, e),
        };
        if start.block_id != block && end.block_id != block {
            return Ok(RangeUpdateType::None);
        }
        if start.block_id != end.block_id {
            // This should not be reachable
            return Ok(RangeUpdateType::Dirty);
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
            _ => return Ok(RangeUpdateType::Removed),
        };
        let (range_start, range_end) = if horizontal {
            (start_row, end_row)
        } else {
            (start_col, end_col)
        };
        Ok(
            match cut_and_get_new_bound(range_start, range_end, delete_start, delete_end) {
                Some((new_start, new_end)) => {
                    let (new_start_row, new_start_col, new_end_row, new_end_col) = if horizontal {
                        (new_start, start_col, new_end, end_col)
                    } else {
                        (start_row, new_start, end_row, new_end)
                    };
                    let new_range_start =
                        ctx.fetch_cell_id(&sheet, new_start_row, new_start_col)?;

                    if new_start_row == new_end_row && new_start_col == new_end_col {
                        return Ok(match new_range_start {
                            CellId::BlockCell(bc) => RangeUpdateType::UpdateTo(NewRange {
                                id: *range_id,
                                range: Range::Block(BlockRange::Single(bc)),
                            }),
                            // No longer inside the block, so it has no
                            // block-range form; drop it.
                            _ => RangeUpdateType::Removed,
                        });
                    }
                    let new_range_end = ctx.fetch_cell_id(&sheet, new_end_row, new_end_col)?;
                    match (new_range_start, new_range_end) {
                        (CellId::BlockCell(s), CellId::BlockCell(e)) => {
                            RangeUpdateType::UpdateTo(NewRange {
                                id: *range_id,
                                range: Range::Block(BlockRange::AddrRange(s, e)),
                            })
                        }
                        _ => RangeUpdateType::Removed,
                    }
                }
                None => RangeUpdateType::None,
            },
        )
    };
    exec_ctx.block_range_update(&sheet, &mut func)
}
