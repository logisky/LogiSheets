use logisheets_base::{NormalRange, RangeId, SheetId};

use super::utils::get_lower_upper_bound_of_range;
use super::{RangeExecCtx, RangeExecutor, RangeUpdateType};
use crate::Error;

pub fn insert_line<C>(
    exec_ctx: RangeExecutor,
    sheet: SheetId,
    row: bool,
    idx: usize,
    _cnt: u32,
    ctx: &C,
) -> Result<RangeExecutor, Error>
where
    C: RangeExecCtx,
{
    let mut func = |range: &NormalRange, _: &RangeId| -> Result<RangeUpdateType, Error> {
        if let NormalRange::Single(_) = range {
            return Ok(RangeUpdateType::None);
        }

        let (lower, upper) = get_lower_upper_bound_of_range(sheet, range, !row, ctx)?;
        Ok(if lower >= idx || upper < idx {
            RangeUpdateType::None
        } else {
            RangeUpdateType::Dirty
        })
    };
    exec_ctx.normal_range_update(&sheet, &mut func)
}
