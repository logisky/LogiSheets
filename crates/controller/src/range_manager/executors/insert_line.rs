use logisheets_base::{NormalRange, RangeId, SheetId};

use super::utils::get_lower_upper_bound_of_range;
use super::{RangeExecCtx, RangeExecutor, RangeUpdateType};

pub fn insert_line<C>(
    exec_ctx: RangeExecutor,
    sheet: SheetId,
    row: bool,
    idx: usize,
    _cnt: u32,
    ctx: &C,
) -> RangeExecutor
where
    C: RangeExecCtx,
{
    let mut func = |range: &NormalRange, _: &RangeId| -> RangeUpdateType {
        if let NormalRange::Single(_) = range {
            return RangeUpdateType::None;
        }

        let (lower, upper) = get_lower_upper_bound_of_range(sheet, range, !row, ctx);
        if lower >= idx || upper < idx {
            RangeUpdateType::None
        } else {
            RangeUpdateType::Dirty
        }
    };
    let result = exec_ctx.normal_range_update(&sheet, &mut func);
    result
}
