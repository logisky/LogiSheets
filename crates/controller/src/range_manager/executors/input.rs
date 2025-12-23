use super::{RangeExecCtx, RangeExecutor, RangeUpdateType};
use logisheets_base::{
    errors::BasicError, BlockRange, EphemeralId, NormalRange, Range, RangeId, SheetId,
};

pub fn input<C>(
    exec_ctx: RangeExecutor,
    sheet: SheetId,
    row: usize,
    col: usize,
    ctx: &C,
) -> Result<RangeExecutor, BasicError>
where
    C: RangeExecCtx,
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
    let exec_ctx = exec_ctx.normal_range_update(&sheet, &mut normal_func);

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
    let mut result = exec_ctx.block_range_update(&sheet, &mut block_range_func);
    let this_cell_id = ctx.fetch_cell_id(&sheet, row, col)?;
    let range_id = result
        .manager
        .get_range_id(&sheet, &Range::from(this_cell_id));
    result.trigger = Some((sheet, range_id));
    // result.dirty_ranges.insert((sheet, range_id));
    Ok(result)
}

pub fn input_ephemeral(
    exec_ctx: RangeExecutor,
    sheet: SheetId,
    id: EphemeralId,
) -> Result<RangeExecutor, BasicError> {
    let mut result = exec_ctx;
    let range_id = result.manager.get_range_id(&sheet, &Range::Ephemeral(id));
    result.trigger = Some((sheet, range_id));
    // result.dirty_ranges.insert((sheet, range_id));
    Ok(result)
}
