use logisheets_base::{
    id_fetcher::IdFetcherTrait, index_fetcher::IndexFetcherTrait, CellId::NormalCell, NormalRange,
    Range, RangeId, SheetId,
};

use crate::range_manager::{NewRange, RangeUpdateType, SheetRangeExecContext};

use super::utils::{cut_and_get_new_bound, get_lower_upper_bound_of_range};

pub fn delete_line<C>(
    exec_ctx: SheetRangeExecContext,
    sheet: SheetId,
    horizontal: bool,
    idx: usize,
    cnt: u32,
    ctx: &mut C,
) -> SheetRangeExecContext
where
    C: IdFetcherTrait + IndexFetcherTrait,
{
    let mut func = |range: &NormalRange, range_id: &RangeId| -> RangeUpdateType {
        let (range_start, range_end) =
            get_lower_upper_bound_of_range(sheet, range, !horizontal, ctx);
        let delete_start = idx;
        let delete_end = (idx + cnt as usize - 1) as usize;
        if range_start > delete_end || range_end < delete_start {
            return RangeUpdateType::None;
        }
        if range_start < delete_start && range_end > delete_end {
            return RangeUpdateType::Dirty;
        }
        if range_end == usize::MAX && range_start == usize::MIN {
            return RangeUpdateType::Dirty;
        }
        if range_start >= delete_start && range_end <= delete_end {
            return RangeUpdateType::Removed;
        }
        match range {
            NormalRange::RowRange(_, _) | NormalRange::ColRange(_, _) => {
                let (new_range_start, new_range_end) =
                    cut_and_get_new_bound(range_start, range_end, delete_start, delete_end)
                        .unwrap();
                let new_range = {
                    if horizontal {
                        let start_row = ctx.fetch_row_id(&sheet, new_range_start).unwrap();
                        let end_row = ctx.fetch_row_id(&sheet, new_range_end).unwrap();
                        NewRange {
                            id: range_id.clone(),
                            range: Range::Normal(NormalRange::RowRange(start_row, end_row)),
                        }
                    } else {
                        let start_col = ctx.fetch_col_id(&sheet, new_range_start).unwrap();
                        let end_col = ctx.fetch_col_id(&sheet, new_range_end).unwrap();
                        NewRange {
                            id: range_id.clone(),
                            range: Range::Normal(NormalRange::ColRange(start_col, end_col)),
                        }
                    }
                };
                RangeUpdateType::UpdateTo(new_range)
            }
            NormalRange::AddrRange(start, end) => {
                let (start_row, start_col) = ctx.fetch_normal_cell_index(&sheet, start).unwrap();
                let (end_row, end_col) = ctx.fetch_normal_cell_index(&sheet, end).unwrap();
                let (new_range_start, new_range_end) =
                    cut_and_get_new_bound(range_start, range_end, delete_start, delete_end)
                        .unwrap();
                let (new_start_row, new_start_col, new_end_row, new_end_col) = if horizontal {
                    (new_range_start, start_col, new_range_end, end_col)
                } else {
                    (start_row, new_range_start, end_row, new_range_end)
                };
                let start_addr_id = ctx
                    .fetch_cell_id(&sheet, new_start_row, new_start_col)
                    .unwrap();
                let end_addr_id = ctx.fetch_cell_id(&sheet, new_end_row, new_end_col).unwrap();
                match (start_addr_id, end_addr_id) {
                    (NormalCell(s), NormalCell(e)) => RangeUpdateType::UpdateTo(NewRange {
                        id: *range_id,
                        range: Range::Normal(NormalRange::AddrRange(s, e)),
                    }),
                    _ => panic!("expect get normal cell range"),
                }
            }
            NormalRange::Single(cell) => {
                let (row, col) = ctx.fetch_normal_cell_index(&sheet, cell).unwrap();
                let target_idx = if horizontal { row } else { col };
                if target_idx >= idx && target_idx <= idx + cnt as usize - 1 {
                    RangeUpdateType::Removed
                } else {
                    RangeUpdateType::None
                }
            }
        }
    };
    let result = exec_ctx.normal_range_update(&mut func);
    result
}
