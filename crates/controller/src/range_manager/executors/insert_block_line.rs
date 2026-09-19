use crate::Error;

use super::{RangeExecutor, RangeUpdateType};
use logisheets_base::{
    BlockId, BlockRange, RangeId, SheetId, id_fetcher::IdFetcherTrait,
    index_fetcher::IndexFetcherTrait,
};

pub fn insert_block_line<C>(
    exec_ctx: RangeExecutor,
    sheet: SheetId,
    block: BlockId,
    _is_row: bool,
    _idx: u32,
    _cnt: u32,
    _ctx: &C,
) -> Result<RangeExecutor, Error>
where
    C: IdFetcherTrait + IndexFetcherTrait,
{
    let mut func = |range: &BlockRange, _: &RangeId| -> Result<RangeUpdateType, Error> {
        Ok(match range {
            BlockRange::Single(_) => RangeUpdateType::None,
            BlockRange::AddrRange(start, end) => {
                if start.block_id != block && end.block_id != block {
                    RangeUpdateType::None
                } else if start.block_id != end.block_id {
                    // TODO
                    RangeUpdateType::Dirty
                } else {
                    // TODO
                    RangeUpdateType::Dirty
                }
            }
        })
    };
    exec_ctx.block_range_update(&sheet, &mut func)
}
