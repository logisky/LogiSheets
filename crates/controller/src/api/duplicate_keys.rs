//! Report the duplicate row keys a workbook already carries.
//!
//! The write-path guard
//! ([`check_block_key_uniqueness`](crate::controller::block_key_guard)) refuses
//! to *create* a collision, and deliberately judges only the keys a transaction
//! wrote — so a block that arrived already broken stays editable instead of
//! being locked out of its own repair.
//!
//! That leaves the other half unanswered: a file written by an older build, or
//! by something that never went through this engine, can hold duplicates that
//! nothing will ever mention. `BLOCKREF` does not error on them, it just
//! resolves the first match and counts it twice — the failure is silent by
//! construction, so it has to be *asked for*. This is the asking.
//!
//! Read-only, whole-workbook, and cheap enough to poll at a decision point;
//! callers filter by sheet or block themselves.

use gents_derives::TS;
use logisheets_base::BlockId;

use crate::controller::block_key_guard::keys_by_value;

use super::Workbook;

/// One repeated key: which block, which value, and which records hold it.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "duplicate_block_key.ts", rename_all = "camelCase")]
pub struct DuplicateBlockKey {
    pub sheet_idx: usize,
    pub block_id: BlockId,
    /// The block's ref name — `BLOCKREF`'s first argument, and how every other
    /// block-facing API names it.
    pub block_name: String,
    /// The repeated key, as `BLOCKREF` reads it (numbers and booleans
    /// stringified the same way the resolver stringifies them, which is why
    /// the number 1 and the text "1" collide).
    pub key: String,
    /// Indices along the record axis of the records sharing this key, in block
    /// order — the same index the schema's key entries report. Always holds at
    /// least two. The first one is the record `BLOCKREF` resolves to; the rest
    /// are unreachable.
    pub records: Vec<usize>,
}

impl Workbook {
    /// Every duplicated row key in the workbook, ordered by sheet, then block,
    /// then key, so two calls on an unchanged workbook read the same.
    ///
    /// Empty keys are not reported: a blank key cell is what an inserted row
    /// starts life with, and it is unaddressable rather than silently wrong.
    /// A block with no schema has no key column and is skipped.
    pub fn duplicate_block_keys(&self) -> Vec<DuplicateBlockKey> {
        let status = &self.controller.status;
        let mut out: Vec<DuplicateBlockKey> = Vec::new();

        for (sheet_id, block_id) in status.block_schema_manager.schemas.keys() {
            let Some(sheet_idx) = status.sheet_info_manager.get_sheet_idx(sheet_id) else {
                continue;
            };
            let Some(by_value) = keys_by_value(status, *sheet_id, *block_id) else {
                continue;
            };
            let block_name = status
                .block_schema_manager
                .fetch_block_ref_name(*sheet_id, *block_id)
                .unwrap_or_default();

            for (key, records) in by_value {
                if records.len() < 2 {
                    continue;
                }
                out.push(DuplicateBlockKey {
                    sheet_idx,
                    block_id: *block_id,
                    block_name: block_name.clone(),
                    key,
                    records,
                });
            }
        }

        out.sort_by(|a, b| {
            (a.sheet_idx, a.block_id, &a.key).cmp(&(b.sheet_idx, b.block_id, &b.key))
        });
        out
    }
}
