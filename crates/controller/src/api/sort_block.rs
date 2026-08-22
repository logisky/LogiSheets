//! Sort a block's records by one of its fields.
//!
//! The *physical* reorder is performed by the existing
//! [`EditPayload::ReorderBlockLines`](crate::edit_action::EditPayload) payload;
//! this module only **computes** the permutation (`new_order`) from a field's
//! values. Comparison uses the engine's typed [`CellValue`] so numbers sort
//! numerically and text lexicographically — something a string-only view on
//! the frontend cannot do reliably. The caller wraps the returned order in a
//! `ReorderBlockLines` transaction (see the browser SDK's `sortBlock`).
//!
//! Only Row/Col schema blocks can be sorted: a `RandomSchema` block has no
//! field axis (every cell is a standalone key/value pair), so there is no
//! field to sort by — such a request is rejected.

use std::cmp::Ordering;

use gents_derives::TS;
use logisheets_base::{BlockFieldId, BlockId, CellId, CellValue};

// NB: do not `use crate::errors::Result` here — the local alias would shadow
// `std::result::Result` and break the serde impls the `TS` derive generates for
// `BlockSortOrder`. Reference it fully-qualified in the signature instead.
use crate::{
    block_manager::schema_manager::schema::{Schema, SchemaTrait},
    errors::Error,
};

use super::Workbook;

/// The result of computing a block sort: which axis to permute and the new
/// order of the current line indices.
///
/// `new_order` is a permutation of `0..n`: `new_order[k]` is the *old* index
/// of the line that should move to position `k` — exactly the shape
/// [`ReorderBlockLines`](crate::edit_action::ReorderBlockLines) expects.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "block_sort_order.ts", rename_all = "camelCase")]
pub struct BlockSortOrder {
    /// `true` when records are rows (RowSchema, reorder rows); `false` when
    /// records are columns (ColSchema, reorder columns).
    pub is_row: bool,
    pub new_order: Vec<usize>,
}

/// A total-order-able projection of a cell value. Category order (ascending):
/// numbers < text < booleans < errors; blank always sorts last regardless of
/// direction (mirrors Excel).
#[derive(Debug, Clone)]
enum SortKey {
    Number(f64),
    Text(String),
    Bool(bool),
    Error,
    Blank,
}

impl SortKey {
    fn category(&self) -> u8 {
        match self {
            SortKey::Number(_) => 0,
            SortKey::Text(_) => 1,
            SortKey::Bool(_) => 2,
            SortKey::Error => 3,
            SortKey::Blank => 4,
        }
    }

    /// Ordering for two *non-blank* keys, ascending.
    fn cmp_non_blank(&self, other: &Self) -> Ordering {
        let (a, b) = (self.category(), other.category());
        if a != b {
            return a.cmp(&b);
        }
        match (self, other) {
            (SortKey::Number(x), SortKey::Number(y)) => x.total_cmp(y),
            (SortKey::Text(x), SortKey::Text(y)) => x.cmp(y),
            (SortKey::Bool(x), SortKey::Bool(y)) => x.cmp(y),
            _ => Ordering::Equal,
        }
    }
}

/// Compare two keys with blanks pinned last (both directions) and everything
/// else honoring `asc`.
fn cmp_keys(a: &SortKey, b: &SortKey, asc: bool) -> Ordering {
    match (matches!(a, SortKey::Blank), matches!(b, SortKey::Blank)) {
        (true, true) => Ordering::Equal,
        (true, false) => Ordering::Greater,
        (false, true) => Ordering::Less,
        (false, false) => {
            let ord = a.cmp_non_blank(b);
            if asc { ord } else { ord.reverse() }
        }
    }
}

impl Workbook {
    /// Compute the row/column order that sorts a block by the `field` named
    /// field, ascending when `asc` is true. Read-only; the caller applies the
    /// result via a `ReorderBlockLines` transaction.
    ///
    /// Errors if the block is a random-schema block (no fields), if the field
    /// name is unknown, or if the sheet/block cannot be found.
    pub fn get_block_sort_order(
        &self,
        sheet_idx: usize,
        block_id: BlockId,
        field: &str,
        asc: bool,
    ) -> crate::errors::Result<BlockSortOrder> {
        let status = self.status();
        let sheet_id = status
            .sheet_info_manager
            .get_sheet_id(sheet_idx)
            .ok_or(Error::UnavailableSheetIdx(sheet_idx))?;

        let schema = status
            .block_schema_manager
            .schemas
            .get(&(sheet_id, block_id))
            .ok_or_else(|| {
                Error::PayloadError(format!(
                    "block {block_id} on sheet {sheet_idx} has no schema to sort by"
                ))
            })?;

        let is_row = match schema {
            Schema::RowSchema(_) => true,
            Schema::ColSchema(_) => false,
            Schema::RandomSchema(_) => {
                return Err(Error::PayloadError(
                    "cannot sort a random-schema block: it has no fields".to_string(),
                ));
            }
        };

        let field_id: BlockFieldId = schema.resolve_field_id(field).ok_or_else(|| {
            Error::PayloadError(format!("unknown field \"{field}\" in block {block_id}"))
        })?;

        let bp = status.navigator.get_block_place(&sheet_id, &block_id)?;

        // Records in current axis order; index i == index into bp.rows/cols,
        // which is exactly the index ReorderBlockLines permutes.
        let key_cells = schema.get_all_key_cell_ids(block_id, bp);

        let text_fetcher = |id| status.text_id_manager.get_string(&id).unwrap_or_default();

        let mut keyed: Vec<(usize, SortKey)> = key_cells
            .iter()
            .enumerate()
            .map(|(idx, key_cell)| {
                let sort_key = schema
                    .partially_resolve_by_field_id(*key_cell, field_id)
                    .and_then(|field_cell| {
                        status
                            .container
                            .get_cell(sheet_id, &CellId::BlockCell(field_cell))
                            .map(|c| c.value.clone())
                    })
                    .map(|value| to_sort_key(value, &text_fetcher))
                    .unwrap_or(SortKey::Blank);
                (idx, sort_key)
            })
            .collect();

        // Stable sort: equal keys keep their original relative order.
        keyed.sort_by(|(_, a), (_, b)| cmp_keys(a, b, asc));

        let new_order = keyed.into_iter().map(|(idx, _)| idx).collect();
        Ok(BlockSortOrder { is_row, new_order })
    }
}

fn to_sort_key<F>(value: CellValue, text_fetcher: &F) -> SortKey
where
    F: Fn(logisheets_base::TextId) -> String,
{
    match value {
        CellValue::Blank => SortKey::Blank,
        CellValue::Number(n) => SortKey::Number(n),
        CellValue::Boolean(b) => SortKey::Bool(b),
        CellValue::Error(_) => SortKey::Error,
        CellValue::String(id) => SortKey::Text(text_fetcher(id).to_lowercase()),
        // A cached formula-result string: prefer numeric ordering when it
        // parses as a number, else compare as text.
        CellValue::FormulaStr(s) => match s.parse::<f64>() {
            Ok(n) => SortKey::Number(n),
            Err(_) => SortKey::Text(s.to_lowercase()),
        },
        // Rich inline strings are rare in block fields and carry no cheap
        // plain-text projection here; treat as empty text so they group
        // together rather than panic.
        // Sorting these as the empty string made every inline-string cell
        // compare equal to every other, so a column of them kept whatever
        // order it happened to have.
        CellValue::InlineStr(rst) => SortKey::Text(rst.plain_text()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn key_num(n: f64) -> SortKey {
        SortKey::Number(n)
    }
    fn key_text(s: &str) -> SortKey {
        SortKey::Text(s.to_string())
    }

    fn sort_indices(mut keys: Vec<SortKey>, asc: bool) -> Vec<usize> {
        let mut idx: Vec<usize> = (0..keys.len()).collect();
        // stable sort mirroring the production path
        idx.sort_by(|&a, &b| cmp_keys(&keys[a], &keys[b], asc));
        // touch keys to avoid unused warnings under some toolchains
        keys.clear();
        idx
    }

    #[test]
    fn numbers_sort_numerically_not_lexically() {
        // 2, 10, 1  → ascending indices should be [2, 0, 1] (1 < 2 < 10)
        let keys = vec![key_num(2.), key_num(10.), key_num(1.)];
        assert_eq!(sort_indices(keys, true), vec![2, 0, 1]);
    }

    #[test]
    fn descending_reverses_non_blanks() {
        let keys = vec![key_num(2.), key_num(10.), key_num(1.)];
        assert_eq!(sort_indices(keys, false), vec![1, 0, 2]);
    }

    #[test]
    fn blanks_sort_last_in_both_directions() {
        let keys = vec![SortKey::Blank, key_num(5.), key_num(1.)];
        assert_eq!(sort_indices(keys.clone(), true), vec![2, 1, 0]);
        // descending: 5 before 1, blank still last
        assert_eq!(sort_indices(keys, false), vec![1, 2, 0]);
    }

    #[test]
    fn numbers_before_text() {
        let keys = vec![key_text("apple"), key_num(3.)];
        assert_eq!(sort_indices(keys, true), vec![1, 0]);
    }

    #[test]
    fn stable_for_equal_keys() {
        let keys = vec![key_num(1.), key_num(1.), key_num(1.)];
        assert_eq!(sort_indices(keys, true), vec![0, 1, 2]);
    }
}
