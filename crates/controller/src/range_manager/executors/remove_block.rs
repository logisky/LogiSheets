use logisheets_base::{BlockId, BlockRange, RangeId};

use crate::range_manager::{RangeUpdateType, SheetRangeExecContext};

pub fn remove_block(exec_ctx: SheetRangeExecContext, block: BlockId) -> SheetRangeExecContext {
    let mut func = |range: &BlockRange, _: &RangeId| -> RangeUpdateType {
        match range {
            BlockRange::Single(c) => {
                if c.block_id == block {
                    RangeUpdateType::Removed
                } else {
                    RangeUpdateType::None
                }
            }
            BlockRange::AddrRange(start, end) => {
                if start.block_id == block || end.block_id == block {
                    RangeUpdateType::Removed
                } else {
                    RangeUpdateType::None
                }
            }
        }
    };
    let result = exec_ctx.block_range_update(&mut func);
    result
}
