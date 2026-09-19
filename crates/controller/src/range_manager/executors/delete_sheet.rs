use logisheets_base::{NormalRange, RangeId, SheetId};

use crate::Error;
use crate::range_manager::ctx::RangeExecCtx;

use super::{RangeExecutor, RangeUpdateType};

pub fn delete_sheet<C>(
    exec_ctx: RangeExecutor,
    sheet: SheetId,
    _ctx: &C,
) -> Result<RangeExecutor, Error>
where
    C: RangeExecCtx,
{
    let mut func = |_range: &NormalRange, _range_id: &RangeId| -> Result<RangeUpdateType, Error> {
        Ok(RangeUpdateType::Removed)
    };
    exec_ctx.normal_range_update(&sheet, &mut func)
}
