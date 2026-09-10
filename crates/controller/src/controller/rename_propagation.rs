//! Carry a source field's rename into the declarations that name it.
//!
//! An analysis block says `SUM of "amt"` and a pivot says `rows = "region"`.
//! Both name a source FIELD as a runtime string, because that is how
//! `BLOCKREFS` reaches one (it filters on names, not ids). Renaming the field
//! on the source therefore leaves those declarations pointing at something
//! that no longer exists — and the failure is silent in the worst way: a
//! `BLOCKREFS` whose field filter matches nothing yields an empty matrix, so
//! every cell of the dependent block reads **0** rather than an error.
//!
//! The re-materialization trigger added with analysis blocks regenerates the
//! FORMULA from the declaration on every re-bind, which is what makes a rename
//! survivable — but only if the declaration itself is updated too. This is
//! that missing half.
//!
//! **A rename is followed, not refused.** `build__rename_field` already
//! refuses when another block's rule TEMPLATE mentions the name, because
//! rewriting a `BLOCKREF`'s third argument by text matching is not safe. A
//! declaration is not text: it is a named field on a struct, so rewriting it is
//! exact. Refusing here would be strictness with nothing behind it.
//!
//! Runs before the payload does, while the OLD schema is still in place —
//! that is the only moment both names are known.

use logisheets_base::{BlockId, SheetId};

use crate::block_manager::schema_manager::field_type::{FieldAggregate, PivotColumn};
use crate::block_manager::schema_manager::schema::Schema;
use crate::controller::status::Status;
use crate::edit_action::SchemaFieldSpec;

/// Rewrite every declaration on `sheet_id` that reads a field of `block_id`,
/// for each field the incoming bind renames.
///
/// A rename is detected by RENDER ID: a field keeps its render id across a
/// rename (the block composer's edit path depends on this, and states so), so
/// a spec whose render id matches an existing field under a different name is
/// a rename and not a new field. Matching on position instead would read a
/// reordered field list as a mass rename.
pub fn propagate_field_renames(
    status: &mut Status,
    sheet_id: SheetId,
    block_id: BlockId,
    new_fields: &[SchemaFieldSpec],
) {
    let renames = detect_renames(status, sheet_id, block_id, new_fields);
    if renames.is_empty() {
        return;
    }
    let apply = |s: &mut String| {
        if let Some((_, to)) = renames.iter().find(|(from, _)| from == s) {
            *s = to.clone();
        }
    };

    let dependents = status.navigator.analyzed_by(&sheet_id, block_id);
    for dep in dependents {
        // The block-level recipe lives on the navigator.
        if let Some(nav) = status.navigator.sheet_navs.get_mut(&sheet_id) {
            if let Some(place) = nav.data.blocks.get(&dep) {
                if let Some(pivot) = &place.pivot {
                    let mut pivot = pivot.clone();
                    apply(&mut pivot.row_dim);
                    apply(&mut pivot.measure);
                    if let Some(c) = &mut pivot.col_dim {
                        apply(c);
                    }
                    for f in &mut pivot.filters {
                        apply(&mut f.field);
                    }
                    let place = place.clone().with_pivot(Some(pivot));
                    nav.data.blocks.insert(dep, place);
                }
            }
        }
        // The per-field declarations live on the schema.
        if let Some(schema) = status
            .block_schema_manager
            .schemas
            .get_mut(&(sheet_id, dep))
        {
            // The two declarations a field can carry that name a SOURCE
            // field. Taken as `&mut Option<..>` rather than as the whole
            // entry, because `FieldEntry` is generic over its axis-id type and
            // the row and column variants are therefore different types —
            // passing only what is inspected keeps one implementation for
            // both.
            let fix = |aggregate: &mut Option<FieldAggregate>, column: &mut Option<PivotColumn>| {
                if let Some(a) = aggregate {
                    apply(&mut a.source_field);
                }
                if let Some(m) = column.as_mut().and_then(|c| c.measure.as_mut()) {
                    apply(m);
                }
            };
            match schema {
                Schema::RowSchema(s) => s
                    .fields
                    .iter_mut()
                    .for_each(|(_, e)| fix(&mut e.aggregate, &mut e.pivot_column)),
                Schema::ColSchema(s) => s
                    .fields
                    .iter_mut()
                    .for_each(|(_, e)| fix(&mut e.aggregate, &mut e.pivot_column)),
                Schema::RandomSchema(_) => {}
            }
        }
    }
}

/// `(old name, new name)` for every field the bind renames in place.
fn detect_renames(
    status: &Status,
    sheet_id: SheetId,
    block_id: BlockId,
    new_fields: &[SchemaFieldSpec],
) -> Vec<(String, String)> {
    let Some(schema) = status
        .block_schema_manager
        .schemas
        .get(&(sheet_id, block_id))
    else {
        return Vec::new();
    };
    let old: Vec<(String, String)> = match schema {
        Schema::RowSchema(s) => s
            .fields
            .iter()
            .map(|(n, e)| (e.render_id.clone(), n.clone()))
            .collect(),
        Schema::ColSchema(s) => s
            .fields
            .iter()
            .map(|(n, e)| (e.render_id.clone(), n.clone()))
            .collect(),
        Schema::RandomSchema(_) => return Vec::new(),
    };
    new_fields
        .iter()
        .filter_map(|spec| {
            let (_, was) = old.iter().find(|(rid, _)| *rid == spec.render_id)?;
            (*was != spec.name).then(|| (was.clone(), spec.name.clone()))
        })
        .collect()
}
