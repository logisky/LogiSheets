//! Turning a [`ChartBlockSource`] into the A1 ranges it currently covers.
//!
//! Everything here is derived, never stored: the block's own extent and field
//! layout are the truth, so a chart bound to a block is re-resolved on every
//! read and every save. That is what makes such a chart follow the block —
//! records appended to it are plotted without the chart being touched, and rows
//! inserted above it do not leave the chart pointing at the wrong cells.

use logisheets_base::{SheetId, index_to_column_label};

use crate::block_manager::schema_manager::{SchemaManager, schema::Schema};
use crate::navigator::Navigator;

use super::ChartBlockSource;

/// The ranges a block source resolves to right now.
pub struct ResolvedBlockRefs {
    /// Category labels, `None` when the source names no category field.
    pub cat_ref: Option<String>,
    /// `(field name, value ref)` for each plotted field, in source order.
    /// A field the schema no longer has is dropped rather than faked.
    pub series: Vec<(String, String)>,
}

/// One field's range across every record of the block, plus the category range.
///
/// Returns `None` when the block or its schema is gone, or when the schema is
/// `random` — a random schema has no field axis, so there is no column to plot.
pub fn resolve_block_refs(
    navigator: &Navigator,
    schemas: &SchemaManager,
    sheet_id: SheetId,
    sheet_name: &str,
    source: &ChartBlockSource,
) -> Option<ResolvedBlockRefs> {
    let bp = navigator
        .get_block_place(&sheet_id, &source.block_id)
        .ok()?;
    let (row_start, col_start) = navigator
        .fetch_normal_cell_idx(&sheet_id, &bp.master)
        .ok()?;
    let schema = schemas.schemas.get(&(sheet_id, source.block_id))?;

    // Which way the block runs. A row schema puts fields on columns and one
    // record per row; a col schema is the transpose. `random` has neither.
    let fields_are_columns = match schema {
        Schema::RowSchema(_) => true,
        Schema::ColSchema(_) => false,
        Schema::RandomSchema(_) => return None,
    };

    // Every line of the block is a record: a block covers the data only, and
    // the header that named its fields sits outside it.
    let record_cnt = if fields_are_columns {
        bp.rows.len()
    } else {
        bp.cols.len()
    };
    if record_cnt == 0 {
        return None;
    }

    // Where a field sits *now*: its axis id is stable, its position is not, so
    // the position is looked up on each resolution.
    let field_offset = |name: &str| -> Option<usize> {
        let id = schema_resolve_field_id(schema, name)?;
        if fields_are_columns {
            bp.cols.iter().position(|c| *c == id)
        } else {
            bp.rows.iter().position(|r| *r == id)
        }
    };

    let range_for = |field_offset: usize| -> String {
        let (sr, er, sc, ec) = if fields_are_columns {
            (
                row_start,
                row_start + record_cnt - 1,
                col_start + field_offset,
                col_start + field_offset,
            )
        } else {
            (
                row_start + field_offset,
                row_start + field_offset,
                col_start,
                col_start + record_cnt - 1,
            )
        };
        format!(
            "{}!${}${}:${}${}",
            quote_sheet(sheet_name),
            index_to_column_label(sc),
            sr + 1,
            index_to_column_label(ec),
            er + 1,
        )
    };

    let cat_ref = source
        .category_field
        .as_deref()
        .and_then(field_offset)
        .map(range_for);
    let series = source
        .value_fields
        .iter()
        .filter_map(|name| field_offset(name).map(|o| (name.clone(), range_for(o))))
        .collect::<Vec<_>>();
    if series.is_empty() {
        return None;
    }
    Some(ResolvedBlockRefs { cat_ref, series })
}

/// `Schema` does not expose `resolve_field_id` on the enum itself, and a
/// `random` schema has no fields to resolve.
fn schema_resolve_field_id(schema: &Schema, name: &str) -> Option<u32> {
    match schema {
        Schema::RowSchema(s) => s.field_axis_by_name(name),
        Schema::ColSchema(s) => s.field_axis_by_name(name),
        Schema::RandomSchema(_) => None,
    }
}

/// A sheet name goes into a ref quoted only when it has to be, matching what
/// Excel writes — an unnecessary quote would still parse, but every stored ref
/// would then differ from the one the user sees in the formula bar.
fn quote_sheet(name: &str) -> String {
    let needs = name.is_empty()
        || name
            .chars()
            .any(|c| !(c.is_alphanumeric() || c == '_' || c == '.'))
        || name.chars().next().is_some_and(|c| c.is_ascii_digit());
    if needs {
        format!("'{}'", name.replace('\'', "''"))
    } else {
        name.to_string()
    }
}
