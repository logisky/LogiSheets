use logisheets_base::{
    id_fetcher::IdFetcherTrait, index_fetcher::IndexFetcherTrait, NormalRange, RangeId, SheetId,
};

use crate::range_manager::{RangeUpdateType, SheetRangeExecContext};

use super::utils::get_lower_upper_bound_of_range;

pub fn insert_line<C>(
    exec_ctx: SheetRangeExecContext,
    sheet: SheetId,
    row: bool,
    idx: usize,
    _cnt: u32,
    ctx: &mut C,
) -> SheetRangeExecContext
where
    C: IdFetcherTrait + IndexFetcherTrait,
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
    let result = exec_ctx.normal_range_update(&mut func);
    result
}
