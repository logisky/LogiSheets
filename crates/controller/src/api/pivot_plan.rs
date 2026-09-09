//! What shape a pivot *should* have, and whether it currently has it.
//!
//! A pivot's rows are `distinct(source[row_dim])` and its columns are
//! `distinct(source[col_dim])`, so its shape is **data** — and no formula adds
//! a row. This module computes the shape; a host applies it with payloads that
//! already exist (`ResizeBlock`, `BindFormSchema`, cell writes). Read-only,
//! exactly like [`super::sort_block::BlockSortOrder`], which computes a
//! permutation and lets the caller send `ReorderBlockLines`.
//!
//! The half that matters most is not the applying but the **reporting**. A
//! stale pivot is the one way a block can mislead without being wrong: every
//! number in it is correct, and a whole group is simply absent. An agent that
//! reads it and totals it under-reports with no signal at all. So the plan
//! carries what is missing, what is extra, and how many source records are not
//! represented anywhere — see `design/block-pivot.md` §8.

use gents_derives::TS;
use logisheets_base::{BlockId, CellId, CellValue, TextId};

use crate::block_manager::schema_manager::field_type::DimOrder;
use crate::block_manager::schema_manager::schema::{Schema, SchemaTrait};
use crate::calc_engine::calculator::funcs::condition::{match_condition, parse_condition};
use crate::errors::Error;

use super::Workbook;

/// A pivot over a dimension with thousands of distinct values is not a pivot,
/// it is an unreadable wall — and a block that large is slow to materialize.
/// Refusing with the count is more useful than returning a plan nobody can
/// apply.
const MAX_PIVOT_KEYS: usize = 1000;
const MAX_PIVOT_FIELDS: usize = 200;

/// Whether a pivot survives a save to `.xlsx` as a REAL Excel pivot table.
///
/// A struct rather than an `Option<String>` return: a bare `Option` generates
/// a TypeScript type that claims `string` and hands back `null`, while an
/// `Option` FIELD generates the `?:` a caller can actually rely on.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "pivot_excel_note.ts", rename_all = "camelCase")]
pub struct PivotExcelNote {
    /// True when the pivot maps exactly, so the saved file carries a pivot
    /// object Excel can recompute and re-pivot.
    pub expressible: bool,
    /// Why not, when not — naming the part that does not map and what to use
    /// instead. Absent when `expressible`, and also when the block is not a
    /// pivot at all.
    pub reason: Option<String>,
}

/// The shape a pivot should have, what it has, and the difference.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "pivot_plan.ts", rename_all = "camelCase")]
pub struct PivotPlan {
    /// The keys it should have, in the recipe's order — one per distinct value
    /// of the source's row dimension.
    pub keys: Vec<String>,
    /// The value fields it should have, in the recipe's order. Empty for a
    /// grouped pivot (`col_dim: None`), which keeps whatever single value
    /// column it was created with.
    pub fields: Vec<String>,
    /// What it has now, so a caller can show a diff without a second call.
    pub current_keys: Vec<String>,
    pub current_fields: Vec<String>,
    /// Present in the source, missing from the pivot: the groups whose numbers
    /// are currently shown *nowhere*. This is the list that makes a stale
    /// pivot legible instead of merely wrong.
    pub missing_keys: Vec<String>,
    pub missing_fields: Vec<String>,
    /// In the pivot, no longer justified by the source. Harmless to read — the
    /// cells compute 0 — but they are groups that no longer exist.
    pub extra_keys: Vec<String>,
    pub extra_fields: Vec<String>,
    /// Source records whose row dimension (or column dimension) is blank.
    ///
    /// A blank is not a group: it gets no row, so those records are in no cell
    /// of the pivot and its grand total is short by their measure. Silent
    /// otherwise, which is why it is counted here.
    pub unassigned_records: usize,
    /// `true` when the pivot is missing groups or showing groups that are
    /// gone. A pure REORDER does not count: the numbers are all present and
    /// correct, and nagging about the sequence would train a reader to ignore
    /// this flag.
    pub is_stale: bool,
}

impl Workbook {
    /// Compute the shape the pivot block `block_id` should have.
    ///
    /// Read-only. The caller applies it as one transaction — grow, write the
    /// keys, bind, shrink — in that order, for the reasons pinned by the
    /// reshape tests in `api/test.rs`; `design/block-pivot.md` §6.
    ///
    /// Errors when the block is not a pivot, when its recipe names a field the
    /// source does not have, or when a dimension has more distinct values than
    /// a pivot can usefully show.
    pub fn pivot_plan(
        &self,
        sheet_idx: usize,
        block_id: BlockId,
    ) -> crate::errors::Result<PivotPlan> {
        let status = self.status();
        let sheet_id = status
            .sheet_info_manager
            .get_sheet_id(sheet_idx)
            .ok_or(Error::UnavailableSheetIdx(sheet_idx))?;

        let place = status.navigator.get_block_place(&sheet_id, &block_id)?;
        let pivot = place.pivot.as_ref().ok_or_else(|| {
            Error::PayloadError(format!(
                "block {block_id} on sheet {sheet_idx} is not a pivot, so it has no shape to plan"
            ))
        })?;
        // The declaration cannot exist without a source (both the payload path
        // and the loader refuse that), so this is defence, not a real case.
        let source = place
            .analyzes
            .ok_or_else(|| Error::PayloadError(format!("pivot {block_id} analyses nothing")))?;

        let (current_keys, current_derived, declared, declared_measures) =
            current_shape(status, sheet_id, block_id);
        plan_from(
            status,
            sheet_id,
            source,
            pivot,
            current_keys,
            current_derived,
            declared,
            declared_measures,
        )
    }

    /// Why this pivot could NOT be saved as a real Excel pivot table, or
    /// `None` when it can.
    ///
    /// The saver already decides this every time a file is written; asking it
    /// here means a host can find out BEFORE building something, rather than
    /// discovering after the fact that the file quietly degraded to a grid of
    /// numbers. `Ok(None)` for a block that is not a pivot at all.
    pub fn pivot_excel_note(
        &self,
        sheet_idx: usize,
        block_id: BlockId,
    ) -> crate::errors::Result<PivotExcelNote> {
        let status = self.status();
        let sheet_id = status
            .sheet_info_manager
            .get_sheet_id(sheet_idx)
            .ok_or(Error::UnavailableSheetIdx(sheet_idx))?;
        Ok(
            match crate::file_saver::pivot_ooxml::expressibility(
                sheet_id,
                block_id,
                &status.navigator,
                &status.block_schema_manager,
            ) {
                Some(Err(why)) => PivotExcelNote {
                    expressible: false,
                    reason: Some(why.reason().to_string()),
                },
                // Expressible, or not a pivot at all — either way there is
                // nothing to warn about.
                _ => PivotExcelNote {
                    expressible: true,
                    reason: None,
                },
            },
        )
    }

    /// The shape a pivot over `source` WOULD have, for a recipe that no block
    /// carries yet.
    ///
    /// Exists so creating a pivot can be a single transaction — and therefore
    /// a single undo. Without it a host would have to create the block, ask
    /// what shape it should be, and reshape it, leaving an empty declared
    /// pivot as an intermediate state and two steps to undo. The distinct
    /// values depend only on the source and the recipe, never on the block, so
    /// the question is well-formed before the block exists.
    ///
    /// `current_*` come back empty, so everything the recipe implies is
    /// reported as missing.
    pub fn pivot_plan_for(
        &self,
        sheet_idx: usize,
        source_block: BlockId,
        spec: &crate::block_manager::schema_manager::field_type::PivotSpecParts,
    ) -> crate::errors::Result<PivotPlan> {
        use crate::block_manager::schema_manager::field_type::PivotSpec;
        let status = self.status();
        let sheet_id = status
            .sheet_info_manager
            .get_sheet_id(sheet_idx)
            .ok_or(Error::UnavailableSheetIdx(sheet_idx))?;
        let pivot = PivotSpec::from_parts(spec).ok_or_else(|| {
            Error::PayloadError(
                "that is not a usable pivot recipe: it needs a row dimension, a measure,                  and one of SUM / COUNT / AVERAGE / MIN / MAX"
                    .to_string(),
            )
        })?;
        plan_from(
            status,
            sheet_id,
            source_block,
            &pivot,
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
        )
    }
}

/// The shared body of both entry points: what the recipe implies, against what
/// the block (if any) currently shows.
fn plan_from(
    status: &crate::controller::status::Status,
    sheet_id: logisheets_base::SheetId,
    source: BlockId,
    pivot: &crate::block_manager::schema_manager::field_type::PivotSpec,
    current_keys: Vec<String>,
    current_fields: Vec<String>,
    // Columns the caller declared by hand. Carried through untouched: the
    // refresh owns the derived columns only.
    declared_fields: Vec<String>,
    // Measures the pivot's hand-declared columns name, if any override the
    // recipe's own.
    declared_measures: Vec<String>,
) -> crate::errors::Result<PivotPlan> {
    let distinct =
        |field: &str, limit: usize, what: &str| -> crate::errors::Result<(Vec<String>, usize)> {
            distinct_values(status, sheet_id, source, field, pivot, limit, what)
        };

    // The MEASURE, before anything else. Nothing else here needs it — the rows
    // and columns are distinct values of the DIMENSIONS — so a measure naming a
    // field the source does not have used to plan perfectly: `is_stale: false`,
    // no error, and every cell reading 0 because `BLOCKREFS` matching nothing
    // yields an empty matrix rather than a failure. A pivot reporting zeros as
    // fact is the exact thing this module exists to make impossible, so the
    // measure is checked even though the plan does not use it.
    //
    // Declared columns are checked too: one may measure something of its own.
    check_measures(status, sheet_id, source, pivot, &declared_measures)?;

    let (keys, blank_rows) = distinct(&pivot.row_dim, MAX_PIVOT_KEYS, "rows")?;
    let (fields, blank_cols) = match &pivot.col_dim {
        Some(col_dim) => distinct(col_dim, MAX_PIVOT_FIELDS, "columns")?,
        // A grouped pivot has one value column whose name means nothing,
        // so there is nothing to plan for it.
        None => (Vec::new(), 0),
    };

    let diff = |want: &[String], have: &[String]| -> Vec<String> {
        want.iter().filter(|v| !have.contains(v)).cloned().collect()
    };
    let missing_keys = diff(&keys, &current_keys);
    let extra_keys = diff(&current_keys, &keys);
    let (missing_fields, extra_fields) = match &pivot.col_dim {
        Some(_) => (
            diff(&fields, &current_fields),
            diff(&current_fields, &fields),
        ),
        None => (Vec::new(), Vec::new()),
    };

    let is_stale = !missing_keys.is_empty()
        || !extra_keys.is_empty()
        || !missing_fields.is_empty()
        || !extra_fields.is_empty();

    // Hand-declared columns come after the derived ones, which puts a row
    // total where a reader expects it and keeps the derived block contiguous.
    // Their relative order is preserved, so reordering them by hand sticks.
    let mut fields = fields;
    fields.extend(declared_fields.iter().cloned());

    Ok(PivotPlan {
        keys,
        fields,
        current_keys,
        current_fields,
        missing_keys,
        missing_fields,
        extra_keys,
        extra_fields,
        // A record missing EITHER dimension lands in no cell. Counting the
        // union would need a per-record pass; the max is the honest lower
        // bound and it is what a reader acts on ("some records are not
        // represented").
        unassigned_records: blank_rows.max(blank_cols),
        is_stale,
    })
}

/// The distinct values of one field of `block`, in `order`, plus how many
/// records had no value there.
///
/// Blanks are excluded rather than becoming a group of their own: an empty key
/// is not addressable (`BLOCKREF(name, "", field)` reaches nothing), and a row
/// whose `#KEY` is `""` would filter on the empty string. They are counted
/// instead, so the omission is reported rather than silent.
fn distinct_values(
    status: &crate::controller::status::Status,
    sheet_id: logisheets_base::SheetId,
    block: BlockId,
    field: &str,
    spec: &crate::block_manager::schema_manager::field_type::PivotSpec,
    limit: usize,
    what: &str,
) -> crate::errors::Result<(Vec<String>, usize)> {
    let schema = status
        .block_schema_manager
        .schemas
        .get(&(sheet_id, block))
        .ok_or_else(|| {
            Error::PayloadError(format!(
                "the pivot's source block {block} has no schema, so it has no fields to group by"
            ))
        })?;
    if matches!(schema, Schema::RandomSchema(_)) {
        return Err(Error::PayloadError(
            "cannot pivot a random-schema block: it has no fields".to_string(),
        ));
    }
    let field_id = schema.resolve_field_id(field).ok_or_else(|| {
        Error::PayloadError(format!(
            "the pivot groups by \"{field}\", which block {block} does not have"
        ))
    })?;
    let bp = status.navigator.get_block_place(&sheet_id, &block)?;
    let text_fetcher = |id: TextId| status.text_id_manager.get_string(&id).unwrap_or_default();

    // The pivot's own filters, resolved to (field id, parsed condition) once.
    // A filter naming a field the source does not have is an error rather than
    // a no-op: silently counting everything would make the pivot disagree with
    // its own declaration, and the cells would still filter — leaving rows
    // whose numbers are all 0.
    let filters = spec
        .filters
        .iter()
        .map(|f| {
            let fid = schema.resolve_field_id(&f.field).ok_or_else(|| {
                Error::PayloadError(format!(
                    "the pivot filters on \"{}\", which block {block} does not have",
                    f.field
                ))
            })?;
            Ok((fid, f.criteria.clone()))
        })
        .collect::<crate::errors::Result<Vec<_>>>()?;

    let mut seen: Vec<String> = Vec::new();
    let mut blank = 0usize;
    'records: for key_cell in schema.get_all_key_cell_ids(block, bp) {
        let read = |fid| {
            schema
                .partially_resolve_by_field_id(key_cell, fid)
                .and_then(|c| status.container.get_cell(sheet_id, &CellId::BlockCell(c)))
                .map(|c| c.value.clone())
                .unwrap_or(CellValue::Blank)
        };
        // Filtered-out records contribute no group AND are not counted as
        // unassigned: they are deliberately excluded, not accidentally
        // missing, and reporting them would cry wolf on every filtered pivot.
        for (fid, criteria) in &filters {
            let v = read(*fid);
            let cond = match parse_condition(criteria) {
                Some(c) => c,
                // An unparseable criteria matches nothing rather than
                // everything: a filter nobody can evaluate has not been met.
                None => continue 'records,
            };
            // Through the calc engine's OWN value conversion and matcher, so
            // "matches" means exactly what the generated `SUMIFS` will mean.
            // Two implementations of one predicate is how a pivot's rows and
            // its numbers come to disagree.
            let v = crate::calc_engine::calculator::calc_vertex::Value::from_cell_value(
                v,
                &|id: &TextId| status.text_id_manager.get_string(id),
            );
            if !match_condition(&cond, &v) {
                continue 'records;
            }
        }
        let value = read(field_id);
        // The DISPLAY string, because that is what the refresh writes into the
        // key column and therefore what `#KEY` will compare against — the plan
        // and the lowering have to agree on the same text.
        let text = value.to_string(&text_fetcher);
        if text.is_empty() {
            blank += 1;
            continue;
        }
        if !seen.contains(&text) {
            if seen.len() == limit {
                return Err(Error::PayloadError(format!(
                    "\"{field}\" has more than {limit} distinct values, which is too many \
                     for a pivot's {what}. Group it into coarser buckets first."
                )));
            }
            seen.push(text);
        }
    }

    match spec.order {
        // The same typed comparison `sort_block` uses, so "sorted" means one
        // thing across the product: numbers numerically, text
        // lexicographically, blanks last (there are none here).
        DimOrder::Ascending => seen.sort_by(|a, b| super::sort_block::cmp_display_strings(a, b)),
        DimOrder::FirstSeen => {}
        // The declared sequence first, then whatever it does not mention, in
        // ascending order. Values are never DROPPED for being unlisted: a
        // custom order that hid a new group would be exactly the silent
        // omission this whole design exists to report.
        DimOrder::Custom => {
            let rank = |v: &String| spec.order_values.iter().position(|o| o == v);
            seen.sort_by(|a, b| match (rank(a), rank(b)) {
                (Some(x), Some(y)) => x.cmp(&y),
                (Some(_), None) => std::cmp::Ordering::Less,
                (None, Some(_)) => std::cmp::Ordering::Greater,
                (None, None) => super::sort_block::cmp_display_strings(a, b),
            });
        }
    }
    Ok((seen, blank))
}

/// The keys and value fields the pivot block currently carries.
///
/// Keys come from its key column's cell values, not from anything stored: they
/// are what a reader sees and what `#KEY` resolved to.
fn current_shape(
    status: &crate::controller::status::Status,
    sheet_id: logisheets_base::SheetId,
    block_id: BlockId,
) -> (Vec<String>, Vec<String>, Vec<String>, Vec<String>) {
    let Some(schema) = status
        .block_schema_manager
        .schemas
        .get(&(sheet_id, block_id))
    else {
        return (Vec::new(), Vec::new(), Vec::new(), Vec::new());
    };
    let Ok(bp) = status.navigator.get_block_place(&sheet_id, &block_id) else {
        return (Vec::new(), Vec::new(), Vec::new(), Vec::new());
    };
    let text_fetcher = |id: TextId| status.text_id_manager.get_string(&id).unwrap_or_default();

    let keys = schema
        .get_all_key_cell_ids(block_id, bp)
        .into_iter()
        .filter_map(|c| {
            let v = status
                .container
                .get_cell(sheet_id, &CellId::BlockCell(c))?
                .value
                .clone();
            let t = v.to_string(&text_fetcher);
            (!t.is_empty()).then_some(t)
        })
        .collect();

    // Every field except the one on the key axis: that column holds the row
    // dimension, not a column of the cross-tab. Split into the DERIVED columns
    // (whose names are dimension values, and which a refresh owns) and the
    // hand-declared ones (row totals, second measures), which a refresh must
    // leave alone — they were never derived from the data, so the data cannot
    // justify removing them.
    let mut derived = Vec::new();
    let mut declared = Vec::new();
    // A declared column may measure something of its own, and that something
    // can go missing from the source just as the recipe's measure can.
    let mut declared_measures = Vec::new();
    let mut sort =
        |name: &String,
         is_key: bool,
         column: Option<&crate::block_manager::schema_manager::field_type::PivotColumn>| {
            if is_key {
                return;
            }
            match column {
                Some(c) => {
                    declared.push(name.clone());
                    if let Some(m) = &c.measure {
                        declared_measures.push(m.clone());
                    }
                }
                None => derived.push(name.clone()),
            }
        };
    match schema {
        Schema::RowSchema(s) => s
            .fields
            .iter()
            .for_each(|(n, e)| sort(n, e.field_axis_id == s.key, e.pivot_column.as_ref())),
        Schema::ColSchema(s) => s
            .fields
            .iter()
            .for_each(|(n, e)| sort(n, e.field_axis_id == s.key, e.pivot_column.as_ref())),
        Schema::RandomSchema(_) => {}
    }
    (keys, derived, declared, declared_measures)
}

/// Refuse a recipe whose MEASURE (or a declared column's own) names a field
/// the source does not have.
///
/// Separate from `distinct_values` because nothing about the plan needs the
/// measure — see the call site for why it is checked anyway.
fn check_measures(
    status: &crate::controller::status::Status,
    sheet_id: logisheets_base::SheetId,
    source: BlockId,
    pivot: &crate::block_manager::schema_manager::field_type::PivotSpec,
    declared_measures: &[String],
) -> crate::errors::Result<()> {
    use crate::block_manager::schema_manager::schema::SchemaTrait;
    let Some(schema) = status.block_schema_manager.schemas.get(&(sheet_id, source)) else {
        // `distinct_values` reports the missing schema with its own message.
        return Ok(());
    };
    for measure in std::iter::once(&pivot.measure).chain(declared_measures) {
        if schema.resolve_field_id(measure).is_none() {
            return Err(Error::PayloadError(format!(
                "the pivot measures \"{measure}\", which block {source} does not have"
            )));
        }
    }
    Ok(())
}
