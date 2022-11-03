use logisheets_base::{
    id_fetcher::IdFetcherTrait, index_fetcher::IndexFetcherTrait, BlockRange, NormalRange, RangeId,
};

use crate::{
    range_manager::{RangeUpdateType, SheetRangeExecContext},
    SheetId,
};

pub fn input<C>(
    exec_ctx: SheetRangeExecContext,
    sheet: SheetId,
    row: usize,
    col: usize,
    ctx: &mut C,
) -> SheetRangeExecContext
where
    C: IdFetcherTrait + IndexFetcherTrait,
{
    let mut normal_func = |range: &NormalRange, _: &RangeId| -> RangeUpdateType {
        match range {
            NormalRange::Single(_) => RangeUpdateType::None,
            NormalRange::RowRange(start, end) => {
                let start_idx = ctx.fetch_row_index(&sheet, start).unwrap();
                let end_idx = ctx.fetch_row_index(&sheet, end).unwrap();
                if start_idx <= row && row <= end_idx {
                    RangeUpdateType::Dirty
                } else {
                    RangeUpdateType::None
                }
            }
            NormalRange::ColRange(start, end) => {
                let start_idx = ctx.fetch_col_index(&sheet, start).unwrap();
                let end_idx = ctx.fetch_col_index(&sheet, end).unwrap();
                if start_idx <= row && row <= end_idx {
                    RangeUpdateType::Dirty
                } else {
                    RangeUpdateType::None
                }
            }
            NormalRange::AddrRange(start, end) => {
                let (start_row, start_col) = ctx.fetch_normal_cell_index(&sheet, start).unwrap();
                let (end_row, end_col) = ctx.fetch_normal_cell_index(&sheet, end).unwrap();
                if start_row <= row && row <= end_row && start_col <= col && col <= end_col {
                    RangeUpdateType::Dirty
                } else {
                    RangeUpdateType::None
                }
            }
        }
    };
    let exec_ctx = exec_ctx.normal_range_update(&mut normal_func);

    let mut block_range_func = |range: &BlockRange, _: &RangeId| -> RangeUpdateType {
        match range {
            BlockRange::Single(_) => RangeUpdateType::None,
            BlockRange::AddrRange(start, end) => {
                let (start_row, start_col) = ctx.fetch_block_cell_index(&sheet, start).unwrap();
                let (end_row, end_col) = ctx.fetch_block_cell_index(&sheet, end).unwrap();
                if start_row <= row && row <= end_row && start_col <= col && col <= end_col {
                    RangeUpdateType::Dirty
                } else {
                    RangeUpdateType::None
                }
            }
        }
    };
    exec_ctx.block_range_update(&mut block_range_func)
}
