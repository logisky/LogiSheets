use logisheets_base::{NormalRange, RangeId, SheetId};

use crate::range_manager::ctx::RangeExecCtx;

use super::{RangeExecutor, RangeUpdateType};

pub fn delete_sheet<C>(exec_ctx: RangeExecutor, sheet: SheetId, _ctx: &C) -> RangeExecutor
where
    C: RangeExecCtx,
{
    let mut func =
        |_range: &NormalRange, _range_id: &RangeId| -> RangeUpdateType { RangeUpdateType::Removed };
    let result = exec_ctx.normal_range_update(&sheet, &mut func);
    result
}
