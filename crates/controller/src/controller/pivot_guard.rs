//! Refuse a block whose pivot recipe and whose field declarations disagree.
//!
//! A pivot's value cells are generated from the block-level recipe: a field's
//! name is the column-dimension value and `#KEY` is the row-dimension value
//! (see `design/block-pivot.md` §4.1). A field carrying its own
//! `aggregate` — the total-row declaration — asks for something else: a
//! whole-column aggregate over the source, ignoring both dimensions.
//!
//! One of them has to win, and whichever we picked would be a rule nobody can
//! see from the sheet: the same column would mean "SUM of amt where region =
//! this row" or "SUM of amt over everything" depending on a precedence rule
//! written down nowhere. Refusing at the point the two are declared together
//! is the only outcome a reader can predict.
//!
//! Checked on the transaction's finished state, like
//! [`super::block_key_guard`], because a `SetBlockAnalyzes` and a
//! `BindFormSchema` in the same transaction can each be individually fine and
//! only conflict once both have landed.

use crate::block_manager::schema_manager::field_type::{FieldAggregate, PivotColumn};
use crate::block_manager::schema_manager::schema::Schema;
use crate::controller::status::Status;
use crate::errors::{Error, Result};

/// Error out when any pivot block has a field that also declares its own
/// aggregate.
pub fn check_pivot_field_conflicts(status: &Status) -> Result<()> {
    for (sheet_id, sheet_nav) in status.navigator.sheet_navs.iter() {
        for (block_id, place) in sheet_nav.data.blocks.iter() {
            let Some(schema_for_check) = status
                .block_schema_manager
                .schemas
                .get(&(*sheet_id, *block_id))
            else {
                continue;
            };
            if place.pivot.is_none() {
                // The mirror case: a column declaring how it slices a pivot,
                // on a block that is not one. It would be silently inert, and
                // a declaration that does nothing is worse than a refusal —
                // the author believes it took effect.
                if let Some(field) = first_field(schema_for_check, |_, pivot| pivot.is_some()) {
                    return Err(Error::PayloadError(format!(
                        "block {block_id} is not a pivot, so its field \"{field}\" cannot \
                         declare a pivot column. Make the block a pivot or drop the \
                         declaration."
                    )));
                }
                continue;
            }
            let Some(schema) = status
                .block_schema_manager
                .schemas
                .get(&(*sheet_id, *block_id))
            else {
                continue;
            };
            if let Some(field) = first_field(schema, |agg, _| agg.is_some()) {
                return Err(Error::PayloadError(format!(
                    "block {block_id} is a pivot, so its field \"{field}\" is a \
                     column of the pivot and computes from the pivot recipe — \
                     it cannot also declare its own aggregate. Drop one of the \
                     two."
                )));
            }
        }
    }
    Ok(())
}

/// The first field of either a row- or column-oriented schema whose
/// declarations satisfy `pred`.
///
/// The predicate takes the two declarations rather than the entry, because
/// `FieldEntry` is generic over its axis-id type and the row and column
/// variants are therefore different types. Passing only what is actually
/// inspected keeps one implementation for both — a check added to one arm and
/// not the other would pass on half the blocks in a workbook.
fn first_field<P>(schema: &Schema, pred: P) -> Option<String>
where
    P: Fn(Option<&FieldAggregate>, Option<&PivotColumn>) -> bool,
{
    match schema {
        Schema::RowSchema(s) => s
            .fields
            .iter()
            .find(|(_, e)| pred(e.aggregate.as_ref(), e.pivot_column.as_ref()))
            .map(|(n, _)| n.clone()),
        Schema::ColSchema(s) => s
            .fields
            .iter()
            .find(|(_, e)| pred(e.aggregate.as_ref(), e.pivot_column.as_ref()))
            .map(|(n, _)| n.clone()),
        Schema::RandomSchema(_) => None,
    }
}
