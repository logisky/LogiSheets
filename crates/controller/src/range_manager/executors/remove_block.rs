use logisheets_base::{BlockId, BlockRange, RangeId, SheetId};

use crate::Error;

use super::{RangeExecutor, RangeUpdateType};

pub fn remove_block(
    exec_ctx: RangeExecutor,
    sheet_id: SheetId,
    block: BlockId,
) -> Result<RangeExecutor, Error> {
    let mut func = |range: &BlockRange, _: &RangeId| -> Result<RangeUpdateType, Error> {
        let touches_block = match range {
            BlockRange::Single(c) => c.block_id == block,
            BlockRange::AddrRange(start, end) => start.block_id == block || end.block_id == block,
        };
        Ok(if touches_block {
            RangeUpdateType::Removed
        } else {
            RangeUpdateType::None
        })
    };
    exec_ctx.block_range_update(&sheet_id, &mut func)
}
