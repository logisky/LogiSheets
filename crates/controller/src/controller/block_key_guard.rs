//! Row keys are unique, and the engine is where that is decided.
//!
//! `(block, key, field)` is how a block addresses a cell — `BLOCKREF` and
//! `BLOCKREFS` resolve a key by scanning the key column and taking the first
//! cell whose value matches. Two records carrying the same key therefore do not
//! produce an error: one of them becomes unreachable, and every aggregate over
//! the block counts the reachable one twice. A block holding 1, 2 and 99 with a
//! repeated key sums to 4, silently.
//!
//! The tool layer already refused duplicates at two doors (`create_block` and
//! `add_block_rows` in logician), but every other write path — a person typing
//! into the key column, `set_block_cells` aimed at the key field, a craft, a
//! fill, a raw `CellInput` — went straight past them. This runs on the
//! transaction's final state instead, so it covers all of them at once.
//!
//! Two deliberate limits:
//!
//!   - **Only keys this transaction wrote are judged.** A workbook loaded from
//!     an `.xlsx` that already carries duplicates stays editable; refusing
//!     every later write to that block would make the very edits that fix it
//!     impossible. The guard asks "did *you* just create a collision", not "is
//!     this block clean".
//!   - **Empty keys are exempt.** Inserting rows mints blank key cells, so the
//!     natural insert-then-fill sequence would otherwise fail on the insert.
//!     An empty key is already unaddressable rather than silently wrong.

use std::collections::{HashMap, HashSet};

use logisheets_base::{BlockCellId, BlockId, CellId, SheetId, TextId};

use crate::{block_manager::schema_manager::schema::BlockCellRole, errors::Error};

use super::status::Status;

/// The key column's value for one block cell, as `BLOCKREF` would read it.
/// Mirrors `CalcConnector::get_all_keys_by_block` so a key that passes here is
/// the same string the resolver will later match on.
fn key_text(status: &Status, sheet_id: SheetId, id: &BlockCellId) -> String {
    let fetcher = |t: TextId| status.text_id_manager.get_string(&t).unwrap_or_default();
    match status.container.get_cell(sheet_id, &CellId::BlockCell(*id)) {
        Some(cell) => cell.value.to_string(&fetcher),
        None => String::new(),
    }
}

/// A block's key cells grouped by the string `BLOCKREF` would match on, each
/// value carrying the record indices that hold it. Record index is the
/// position along the record axis (the same `idx` the schema's key entries
/// report), so a group with more than one entry names the colliding records.
///
/// Empty keys are dropped rather than grouped — see the module docs. `None`
/// when the block has no schema, and so no key column to speak of.
///
/// One function so the refusal on the write path and the report on the read
/// path can never disagree about what a duplicate is.
pub(crate) fn keys_by_value(
    status: &Status,
    sheet_id: SheetId,
    block_id: BlockId,
) -> Option<HashMap<String, Vec<usize>>> {
    let bp = status
        .navigator
        .get_block_place(&sheet_id, &block_id)
        .ok()?;
    let all_key_cells = status
        .block_schema_manager
        .get_all_key_cell_ids_by_block(sheet_id, block_id, bp)?;

    let mut by_value: HashMap<String, Vec<usize>> = HashMap::new();
    for (record_idx, id) in all_key_cells.iter().enumerate() {
        let v = key_text(status, sheet_id, id);
        if v.is_empty() {
            continue;
        }
        by_value.entry(v).or_default().push(record_idx);
    }
    Some(by_value)
}

/// Refuse the transaction if one of the key cells it wrote now repeats another
/// record's key. Returns on the first collision; the caller aborts before the
/// new status is adopted, so nothing partial lands.
pub fn check_block_key_uniqueness(
    status: &Status,
    written: &HashSet<(SheetId, CellId)>,
) -> Result<(), Error> {
    // Which key cells did this transaction write? Non-key block cells and
    // cells outside every block are none of this guard's business.
    let mut touched: HashMap<(SheetId, BlockId), Vec<BlockCellId>> = HashMap::new();
    for (sheet_id, cell_id) in written {
        let CellId::BlockCell(bcid) = cell_id else {
            continue;
        };
        if !matches!(
            status.block_schema_manager.cell_role(*sheet_id, bcid),
            BlockCellRole::Key
        ) {
            continue;
        }
        touched
            .entry((*sheet_id, bcid.block_id))
            .or_default()
            .push(*bcid);
    }
    if touched.is_empty() {
        return Ok(());
    }

    // Iterate in a fixed order so a transaction that collides in two blocks at
    // once always names the same one — an error message that changes between
    // runs is worse than a less precise one.
    let mut blocks: Vec<((SheetId, BlockId), Vec<BlockCellId>)> = touched.into_iter().collect();
    blocks.sort_by_key(|((sheet_id, block_id), _)| (*sheet_id, *block_id));

    for ((sheet_id, block_id), mut written_keys) in blocks {
        // Group the block's FINAL keys by value. Reading the end state (rather
        // than each write as it happens) is what lets two records swap keys
        // inside one transaction without tripping the guard.
        let Some(by_value) = keys_by_value(status, sheet_id, block_id) else {
            // No schema bound — the block has no key column to police.
            continue;
        };

        written_keys.sort_by_key(|id| (id.row, id.col));
        for id in written_keys {
            let v = key_text(status, sheet_id, &id);
            if v.is_empty() {
                continue;
            }
            if by_value.get(&v).map_or(0, |g| g.len()) > 1 {
                let block = status
                    .block_schema_manager
                    .fetch_block_ref_name(sheet_id, block_id)
                    .unwrap_or_else(|| format!("#{}", block_id));
                return Err(Error::DuplicateBlockKey { block, key: v });
            }
        }
    }

    Ok(())
}
