use logisheets_base::{CellId, NormalCellId, NormalRange, Range, RangeId, SheetId};

use super::{NewRange, RangeExecCtx, RangeExecutor, RangeUpdateType};
use crate::Error;

use super::utils::cut_and_get_new_bound;

// A normal addr range would be occupied by a block and therefore some
// ranges will be cut or removed.
pub fn occupy_addr_range<C>(
    exec_ctx: RangeExecutor,
    sheet: SheetId,
    start: NormalCellId,
    end: NormalCellId,
    ctx: &C,
) -> Result<RangeExecutor, Error>
where
    C: RangeExecCtx,
{
    let (occupy_start_row, occupy_start_col) = ctx.fetch_normal_cell_index(&sheet, &start)?;
    let (occupy_end_row, occupy_end_col) = ctx.fetch_normal_cell_index(&sheet, &end)?;
    let mut func = |range: &NormalRange, range_id: &RangeId| -> Result<RangeUpdateType, Error> {
        Ok(match range {
            NormalRange::Single(cell) => {
                let (row, col) = ctx.fetch_normal_cell_index(&sheet, cell)?;
                if occupy_start_row <= row
                    && occupy_start_col <= col
                    && occupy_end_row >= row
                    && occupy_end_col >= col
                {
                    RangeUpdateType::Removed
                } else {
                    RangeUpdateType::None
                }
            }
            NormalRange::RowRange(start, end) => {
                let start_idx = ctx.fetch_row_index(&sheet, start)?;
                let end_idx = ctx.fetch_row_index(&sheet, end)?;
                if start_idx > occupy_end_row || end_idx < occupy_start_row {
                    RangeUpdateType::None
                } else {
                    RangeUpdateType::Dirty
                }
            }
            NormalRange::ColRange(start, end) => {
                let start_idx = ctx.fetch_col_index(&sheet, start)?;
                let end_idx = ctx.fetch_col_index(&sheet, end)?;
                if start_idx > occupy_end_col || end_idx < occupy_start_col {
                    RangeUpdateType::None
                } else {
                    RangeUpdateType::Dirty
                }
            }
            NormalRange::AddrRange(s, e) => {
                let (range_start_row, range_start_col) = ctx.fetch_normal_cell_index(&sheet, s)?;
                let (range_end_row, range_end_col) = ctx.fetch_normal_cell_index(&sheet, e)?;
                if occupy_start_row <= range_start_row
                    && occupy_start_col <= range_start_col
                    && occupy_end_row >= range_end_row
                    && occupy_end_col >= range_end_col
                {
                    RangeUpdateType::Removed
                } else if occupy_start_row > range_start_row
                    && occupy_start_col > range_start_col
                    && occupy_end_row < range_end_row
                    && occupy_end_col < range_end_col
                {
                    RangeUpdateType::Dirty
                } else if occupy_start_row > range_end_row
                    || occupy_end_row < range_start_row
                    || occupy_start_col > range_end_col
                    || occupy_end_col < range_start_col
                {
                    RangeUpdateType::None
                } else {
                    let (start_row, start_col, end_row, end_col) = match (
                        cut_and_get_new_bound(
                            range_start_row,
                            range_end_row,
                            occupy_start_row,
                            occupy_end_row,
                        ),
                        cut_and_get_new_bound(
                            range_start_col,
                            range_end_col,
                            occupy_start_col,
                            occupy_end_col,
                        ),
                    ) {
                        (None, None) => {
                            return Ok(RangeUpdateType::None);
                        }
                        (None, Some((new_start_col, new_end_col))) => {
                            (range_start_row, new_start_col, range_start_col, new_end_col)
                        }
                        (Some((new_start_row, new_end_row)), None) => {
                            (new_start_row, range_start_col, new_end_row, range_end_col)
                        }
                        (
                            Some((new_start_row, new_end_row)),
                            Some((new_start_col, new_end_col)),
                        ) => (new_start_row, new_start_col, new_end_row, new_end_col),
                    };
                    let new_start_id = ctx.fetch_cell_id(&sheet, start_row, start_col)?;
                    let new_end_id = ctx.fetch_cell_id(&sheet, end_row, end_col)?;
                    match (new_start_id, new_end_id) {
                        (CellId::NormalCell(s), CellId::NormalCell(e)) => {
                            let range = Range::Normal(NormalRange::AddrRange(s, e));
                            RangeUpdateType::UpdateTo(NewRange {
                                id: range_id.clone(),
                                range,
                            })
                        }
                        // Clipped onto a block: a range is wholly normal or
                        // wholly one block's, so this has no representation.
                        _ => RangeUpdateType::None,
                    }
                }
            }
        })
    };
    exec_ctx.normal_range_update(&sheet, &mut func)
}
