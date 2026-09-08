//! Answer the policy questions a host has to ask before it enforces anything.
//!
//! The engine holds a block's owner and its per-operation policies, and
//! `may_modify_block` is the decision. But two smaller questions were being
//! re-implemented in the app instead, and both are the engine's to answer:
//!
//!   - **Which operation does this payload count as?** The engine defines the
//!     operations, so it should say. Every host that enforces a policy needs
//!     the mapping — the app, the craft runtime, Watson — and each keeping its
//!     own table is how the same payload comes to be governed differently in
//!     different hosts.
//!   - **Does the block state a policy for this operation at all?** Not a
//!     permission decision — the difference between a block that says "anyone
//!     may" and one that says nothing. A host needs it because a block created
//!     with an owner but no policy still wants the owner check, and reading an
//!     unstated policy as `all` would make such a block *less* protected than
//!     before the engine knew about policies.
//!
//! See `design/block-field-semantics.md`.

use gents_derives::TS;
use logisheets_base::BlockId;

use crate::edit_action::{BLOCK_OP_BY_PAYLOAD, BlockOp};

use super::Workbook;

/// One entry of the payload → operation table.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "block_op_for_payload.ts", rename_all = "camelCase")]
pub struct BlockOpForPayload {
    /// `EditPayload`'s `type` tag.
    pub payload_type: String,
    pub op: BlockOp,
}

/// What a block declares for one operation, beyond whether a given actor is
/// allowed.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "block_op_policy.ts", rename_all = "camelCase")]
pub struct BlockOpPolicy {
    pub op: BlockOp,
    /// The policy in force: the block's per-operation override if it has one,
    /// otherwise its default.
    pub policy: String,
    /// Whether the block says anything at all about this operation — an
    /// explicit override, or a default that is not simply "anyone".
    ///
    /// A host uses this to decide whether to fall back to its own owner check.
    /// It is deliberately not folded into `policy`: "anyone may, because nobody
    /// said" and "anyone may, because someone said so" are different facts, and
    /// only the first leaves room for a fallback.
    pub stated: bool,
}

impl Workbook {
    /// The payload → operation table. Static; fetch once and cache.
    pub fn get_block_op_for_payloads(&self) -> Vec<BlockOpForPayload> {
        BLOCK_OP_BY_PAYLOAD
            .iter()
            .map(|(payload_type, op)| BlockOpForPayload {
                payload_type: payload_type.to_string(),
                op: *op,
            })
            .collect()
    }

    /// What a block declares for every operation, in a fixed order.
    pub fn get_block_op_policies(
        &self,
        sheet_idx: usize,
        block_id: BlockId,
    ) -> std::result::Result<Vec<BlockOpPolicy>, crate::errors::Error> {
        let info = self.get_block_modify_info(sheet_idx, block_id)?;
        Ok(BlockOp::ALL
            .iter()
            .map(|op| {
                let explicit = info.permissions.explicit(*op);
                BlockOpPolicy {
                    op: *op,
                    policy: info
                        .permissions
                        .policy_for(*op, info.modify_policy)
                        .as_wire_str()
                        .to_string(),
                    stated: explicit.is_some()
                        || info.modify_policy != crate::edit_action::ModifyPolicy::All,
                }
            })
            .collect())
    }
}
