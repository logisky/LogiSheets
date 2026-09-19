use logisheets_base::{CellId::NormalCell, NormalRange, Range, RangeId, SheetId};

use super::{NewRange, RangeExecutor, RangeUpdateType};
use crate::{Error, range_manager::ctx::RangeExecCtx};

use super::utils::{cut_and_get_new_bound, get_lower_upper_bound_of_range};

pub fn delete_line<C>(
    exec_ctx: RangeExecutor,
    sheet: SheetId,
    horizontal: bool,
    idx: usize,
    cnt: u32,
    ctx: &C,
) -> Result<RangeExecutor, Error>
where
    C: RangeExecCtx,
{
    let mut func = |range: &NormalRange, range_id: &RangeId| -> Result<RangeUpdateType, Error> {
        let (range_start, range_end) =
            get_lower_upper_bound_of_range(sheet, range, horizontal, ctx)?;
        let delete_start = idx;
        let delete_end = idx + cnt as usize - 1;
        if range_start > delete_end || range_end < delete_start {
            return Ok(RangeUpdateType::None);
        }
        if range_start < delete_start && range_end > delete_end {
            return Ok(RangeUpdateType::Dirty);
        }
        if range_end == usize::MAX && range_start == usize::MIN {
            return Ok(RangeUpdateType::Dirty);
        }
        if range_start >= delete_start && range_end <= delete_end {
            return Ok(RangeUpdateType::Removed);
        }
        // The guards above leave only partial overlaps, which have a remainder.
        let clipped = || {
            cut_and_get_new_bound(range_start, range_end, delete_start, delete_end).ok_or_else(
                || {
                    Error::PayloadError(format!(
                        "deleting {cnt} line(s) at index {idx} leaves nothing of the range spanning {range_start}..={range_end}"
                    ))
                },
            )
        };
        match range {
            NormalRange::RowRange(_, _) | NormalRange::ColRange(_, _) => {
                let (new_range_start, new_range_end) = clipped()?;
                let new_range = if horizontal {
                    let start_row = ctx.fetch_row_id(&sheet, new_range_start)?;
                    let end_row = ctx.fetch_row_id(&sheet, new_range_end)?;
                    NewRange {
                        id: *range_id,
                        range: Range::Normal(NormalRange::RowRange(start_row, end_row)),
                    }
                } else {
                    let start_col = ctx.fetch_col_id(&sheet, new_range_start)?;
                    let end_col = ctx.fetch_col_id(&sheet, new_range_end)?;
                    NewRange {
                        id: *range_id,
                        range: Range::Normal(NormalRange::ColRange(start_col, end_col)),
                    }
                };
                Ok(RangeUpdateType::UpdateTo(new_range))
            }
            NormalRange::AddrRange(start, end) => {
                let (start_row, start_col) = ctx.fetch_normal_cell_index(&sheet, start)?;
                let (end_row, end_col) = ctx.fetch_normal_cell_index(&sheet, end)?;
                let (new_range_start, new_range_end) = clipped()?;
                let (new_start_row, new_start_col, new_end_row, new_end_col) = if horizontal {
                    (new_range_start, start_col, new_range_end, end_col)
                } else {
                    (start_row, new_range_start, end_row, new_range_end)
                };
                let start_addr_id = ctx.fetch_cell_id(&sheet, new_start_row, new_start_col)?;
                let end_addr_id = ctx.fetch_cell_id(&sheet, new_end_row, new_end_col)?;
                Ok(match (start_addr_id, end_addr_id) {
                    (NormalCell(s), NormalCell(e)) => RangeUpdateType::UpdateTo(NewRange {
                        id: *range_id,
                        range: Range::Normal(NormalRange::AddrRange(s, e)),
                    }),
                    // Deleting lines moved the range's clipped endpoints onto a
                    // block. A `Range` is wholly normal or wholly one block's,
                    // so the shrunk range has no representation — the same
                    // reason the parser rejects `PartialBlockRange`. Drop it and
                    // mark dependents dirty so they recalculate into a reference
                    // error; this used to panic, taking the engine down with it.
                    _ => RangeUpdateType::Removed,
                })
            }
            NormalRange::Single(cell) => {
                let (row, col) = ctx.fetch_normal_cell_index(&sheet, cell)?;
                let target_idx = if horizontal { row } else { col };
                Ok(
                    if target_idx >= idx && target_idx <= idx + cnt as usize - 1 {
                        RangeUpdateType::Removed
                    } else {
                        RangeUpdateType::None
                    },
                )
            }
        }
    };
    exec_ctx.normal_range_update(&sheet, &mut func)
}
