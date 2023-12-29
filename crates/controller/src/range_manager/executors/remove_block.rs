use logisheets_base::{BlockId, BlockRange, RangeId, SheetId};

use super::{RangeExecutor, RangeUpdateType};

pub fn remove_block(exec_ctx: RangeExecutor, sheet_id: SheetId, block: BlockId) -> RangeExecutor {
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
    let result = exec_ctx.block_range_update(&sheet_id, &mut func);
    result
}
