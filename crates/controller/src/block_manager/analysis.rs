//! The value formula of an analysis field, generated from its declaration.
//!
//! An analysis block is an ordinary block that declares which block it analyses
//! (`BlockPlace::analyzes`), whose fields declare how they aggregate it
//! (`FieldEntry::aggregate`). This turns the pair of declarations into the
//! formula the field's cells compute.
//!
//! **Generated, never stored.** The same reason validation rules are generated
//! from their declaration (`block_manager::derived_rules`): a stored string
//! cannot be rebuilt, so renaming the source field leaves it naming something
//! that no longer exists — and that failure is silent, because a `BLOCKREFS`
//! whose field filter matches nothing yields an empty matrix and the aggregate
//! reads zero rather than raising. Regenerating from the current names is what
//! makes a rename safe.
//!
//! **Through `BLOCKREFS`, not a resolved cell range**, also deliberately: its
//! dependency is `BlockAll(source)`, which is what makes the total track the
//! source *growing*. A resolved range would have to be rewritten on every
//! inserted row.
//!
//! The cycle question that shapes the whole feature: an analysis cell depends
//! on `BlockAll(source)`, and `BlockAll(analysis)` depends on the analysis
//! cell. Two independent barriers, no cycle — which is only true because the
//! analysis lives in its own block. See `design/block-analysis.md`.

use logisheets_base::{BlockId, SheetId};

use super::schema_manager::field_type::{AggFunc, FieldAggregate, PivotColumn, PivotSpec};

/// What an analysis block analyses, and how — everything the generation needs
/// that lives on the navigator rather than on the schema.
///
/// Borrowed rather than owned: this is resolved once per cell while a block is
/// being materialized, and a pivot recipe holds three `String`s that would
/// otherwise be cloned for every cell of the grid.
#[derive(Debug, Clone, Copy)]
pub struct AnalysisTarget<'a> {
    pub source: BlockId,
    /// The pivot recipe, when the block is a pivot. `None` is a total row,
    /// whose fields carry their own aggregates instead.
    pub pivot: Option<&'a PivotSpec>,
}

/// Escape a value for use inside an Excel string literal, where `"` doubles.
fn lit(v: &str) -> String {
    v.replace('"', "\"\"")
}

/// The formula an analysis field's cells should compute, or `None` when the
/// field declares no aggregate — an ordinary field, which is what the label
/// column of a total row is.
///
/// By numeric ids rather than the source's ref name, so renaming the *block*
/// cannot reach it either; only the field name is a runtime string, and that is
/// what §4's re-materialization trigger covers.
pub fn aggregate_formula(
    source_sheet: SheetId,
    source_block: BlockId,
    aggregate: Option<&FieldAggregate>,
) -> Option<String> {
    let agg = aggregate?;
    Some(format!(
        "{}(BLOCKREFSB({},{},\"*\",\"{}\"))",
        agg.func.as_str(),
        source_sheet,
        source_block,
        lit(&agg.source_field)
    ))
}

/// The formula a PIVOT cell should compute. Not called for the key column,
/// which holds the row's dimension value and is an ordinary cell.
///
/// The whole cross-tab reduces to one `*IFS` call over two or three
/// `BLOCKREFS` matrices, all of which the engine already has:
///
/// ```text
/// SUMIFS(BLOCKREFSB(7,3,"*","amt"),          <- the measure column
///        BLOCKREFSB(7,3,"*","region"),#KEY,  <- this ROW's dimension value
///        BLOCKREFSB(7,3,"*","quarter"),"Q1") <- this COLUMN's
/// ```
///
/// Two things carry the per-cell part, and neither is stored:
///
/// - **the row filter is `#KEY`**, substituted per row when the template is
///   materialized (`input_block_cell_template`), as an AST node — so a
///   dimension value containing a quote needs no escaping, and the pivot needs
///   no per-row generation at all.
/// - **the column filter is the FIELD'S OWN NAME**, because a pivot's field
///   names *are* the column dimension's values. Renaming a pivot column
///   therefore changes what it filters on, coherently, and nothing per-field
///   has to be persisted.
///
/// The caller decides which cell is the key column — by axis id, not by name,
/// so a schema with no field entry at the key axis cannot slip through — and
/// simply does not call this for it.
///
/// Matrices row-align because both come from the same block in the same key
/// order, and a cell that resolves to nothing reads as `Blank` rather than
/// collapsing the row — see `design/block-pivot.md` §1.
pub fn pivot_formula(
    source_sheet: SheetId,
    source_block: BlockId,
    pivot: &PivotSpec,
    field_name: &str,
    column: Option<&PivotColumn>,
) -> String {
    let col = |field: &str| {
        format!(
            "BLOCKREFSB({},{},\"*\",\"{}\")",
            source_sheet,
            source_block,
            lit(field)
        )
    };
    let (measure, func) = pivot.effective(column);
    // COUNTIFS is the one member of the family with no value range — its
    // arguments are `(range, criteria)+`, so passing the measure would make
    // the arity odd and the call fail. It therefore counts matching RECORDS,
    // which is what a count means in a cross-tab. Worth knowing that this
    // differs slightly from a total row's `COUNT`, which counts numeric values
    // in one column: a record whose measure is blank is counted here and not
    // there. Each is the right answer for its own question.
    //
    // COUNTA goes the same way and then adds one criterion of its own, below:
    // there is no `COUNTAIFS`, and naively pasting "COUNTA" in front of "IFS"
    // would emit a call to a function that does not exist.
    let counts_records = matches!(func, AggFunc::Count | AggFunc::CountA);
    let mut out = if counts_records {
        format!("COUNTIFS({},#KEY", col(&pivot.row_dim))
    } else {
        format!(
            "{}IFS({},{},#KEY",
            func.as_str(),
            col(measure),
            col(&pivot.row_dim),
        )
    };
    // The column filter. A hand-declared column says which value it is for —
    // and `None` there means EVERY value, which is exactly a row total: the
    // criteria pair is simply omitted, leaving the grouped form.
    if let Some(col_dim) = &pivot.col_dim {
        let value = match column {
            Some(c) => c.col_value.as_deref(),
            None => Some(field_name),
        };
        if let Some(value) = value {
            out.push_str(&format!(",{},\"{}\"", col(col_dim), lit(value)));
        }
    }
    // Source filters last, so the criteria pairs read in the order they were
    // declared. Applied here AND in `pivot_plan`'s distinct-value pass — a
    // filter in only one of the two would give a pivot rows whose cells all
    // read 0, or hide rows whose numbers are in the totals.
    for f in &pivot.filters {
        out.push_str(&format!(",{},\"{}\"", col(&f.field), lit(&f.criteria)));
    }
    // COUNTA's own criterion, last because it belongs to the aggregate rather
    // than to the recipe's filters. `"<>"` is the spreadsheet idiom for "not
    // blank", which is exactly what COUNTA counts — so this says "matching
    // records whose measure is present", the cross-tab reading of COUNTA in
    // the same way `COUNTIFS` alone is the cross-tab reading of COUNT.
    if matches!(func, AggFunc::CountA) {
        out.push_str(&format!(",{},\"<>\"", col(measure)));
    }
    out.push(')');
    out
}

/// The rule that keeps a pivot's key column honest: its value has to name a
/// group this pivot would actually have a row for.
///
/// A pivot's key cells are NOT templated — they hold literal dimension values
/// the refresh writes — so nothing stops a person typing into one. And because
/// `#KEY` was captured when the row was materialized, editing it does not
/// re-aim the row: it keeps reporting the old group under the new label
/// (`editing_a_key_does_not_re_aim_the_row_until_a_rebind`). A wrong number
/// that looks deliberate is the worst of the three possible behaviours, so the
/// cell gets a marker the moment it stops naming a real group.
///
/// **The filters count.** Occurring in the source is not the same question as
/// belonging in this pivot: a value every filter excludes is a real value of
/// the dimension whose row would compute 0 in every cell, because the cells
/// apply the filters and this rule used not to. That is precisely the
/// unmarked-but-empty row the rule exists to prevent, so it asks the same
/// question the cells do — same criteria pairs, in the same order, as
/// `pivot_formula` and as `pivot_plan`'s distinct-value pass.
///
/// Derived from the declaration, never stored — the same reason the `unique`
/// rule is (`block_manager::derived_rules`): a rename regenerates it.
pub fn pivot_key_validation(
    source_sheet: SheetId,
    source_block: BlockId,
    pivot: &PivotSpec,
) -> String {
    let col = |field: &str| {
        format!(
            "BLOCKREFSB({},{},\"*\",\"{}\")",
            source_sheet,
            source_block,
            lit(field)
        )
    };
    // COUNTIFS even with no filters: one criteria pair is a legal COUNTIFS,
    // and one form for both cases means the filtered case is not a separate
    // path that can rot.
    let mut out = format!("COUNTIFS({},#PLACEHOLDER", col(&pivot.row_dim));
    for f in &pivot.filters {
        out.push_str(&format!(",{},\"{}\"", col(&f.field), lit(&f.criteria)));
    }
    out.push_str(")>0");
    out
}

/// Every block that must go when `block_id` goes: the analyses of it, the
/// analyses of those, and so on — not including `block_id` itself.
///
/// An analysis block has no meaning without its source: its every field
/// aggregates a block that would no longer exist, so it would sit there
/// reading empty with nothing to say why. Removing it alongside is the honest
/// behaviour, and doing it as extra `RemoveBlock` payloads rather than as a
/// special case inside one means every manager — cells, schema, navigator —
/// sees an ordinary removal, and one undo brings the whole set back.
///
/// Walks to a fixpoint, and cannot loop: a block may not analyse itself, and
/// each step only adds ids not already collected.
pub fn remove_cascade(
    navigator: &crate::navigator::Navigator,
    sheet_id: SheetId,
    block_id: BlockId,
) -> Vec<BlockId> {
    let mut out: Vec<BlockId> = Vec::new();
    let mut frontier = vec![block_id];
    while let Some(id) = frontier.pop() {
        for dependent in navigator.analyzed_by(&sheet_id, id) {
            if dependent != block_id && !out.contains(&dependent) {
                out.push(dependent);
                frontier.push(dependent);
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::block_manager::schema_manager::field_type::{AggFunc, PivotFilter};

    fn agg(func: AggFunc, field: &str) -> FieldAggregate {
        FieldAggregate {
            func,
            source_field: field.to_string(),
        }
    }

    #[test]
    fn a_field_with_no_aggregate_gets_no_formula() {
        // The label column of a total row. It stays an ordinary cell a person
        // can type into, which is the whole reason this is per-field rather
        // than per-block.
        assert_eq!(aggregate_formula(0, 1, None), None);
    }

    #[test]
    fn each_function_lowers_to_itself_over_the_source_field() {
        for (func, name) in [
            (AggFunc::Sum, "SUM"),
            (AggFunc::Count, "COUNT"),
            // A total row has a value range, so COUNTA needs no substitution
            // here — unlike the pivot lowering, where there is no COUNTAIFS.
            (AggFunc::CountA, "COUNTA"),
            (AggFunc::Average, "AVERAGE"),
            (AggFunc::Min, "MIN"),
            (AggFunc::Max, "MAX"),
        ] {
            assert_eq!(
                aggregate_formula(7, 3, Some(&agg(func, "amt"))).unwrap(),
                format!("{name}(BLOCKREFSB(7,3,\"*\",\"amt\"))")
            );
        }
    }

    #[test]
    fn the_source_is_named_by_id_so_renaming_the_block_cannot_reach_it() {
        // `BLOCKREFSB` takes numeric ids. Only the FIELD name is a runtime
        // string, which narrows what re-materialization has to cover to one
        // thing.
        let f = aggregate_formula(2, 9, Some(&agg(AggFunc::Sum, "amt"))).unwrap();
        assert!(f.contains("BLOCKREFSB(2,9,"));
        assert!(!f.contains("orders"), "no ref name appears: {f}");
    }

    fn pivot(col_dim: Option<&str>) -> PivotSpec {
        use crate::block_manager::schema_manager::field_type::DimOrder;
        PivotSpec {
            row_dim: "region".into(),
            col_dim: col_dim.map(String::from),
            measure: "amt".into(),
            func: AggFunc::Sum,
            order: DimOrder::Ascending,
            order_values: vec![],
            filters: vec![],
        }
    }

    #[test]
    fn a_pivot_cell_filters_on_its_row_and_on_its_own_column_name() {
        // The whole cross-tab in one call over functions the engine already
        // has. `#KEY` is the row's dimension value, substituted per row when
        // the template materializes; the column's is the field's own name.
        assert_eq!(
            pivot_formula(7, 3, &pivot(Some("quarter")), "Q1", None),
            "SUMIFS(BLOCKREFSB(7,3,\"*\",\"amt\"),\
             BLOCKREFSB(7,3,\"*\",\"region\"),#KEY,\
             BLOCKREFSB(7,3,\"*\",\"quarter\"),\"Q1\")"
        );
    }

    #[test]
    fn a_grouped_pivot_filters_on_the_row_alone() {
        // `col_dim: None` — the degenerate pivot, a plain group-by. One
        // criteria pair, not two, so the column name means nothing and a
        // caller is free to name the single value column whatever it likes.
        assert_eq!(
            pivot_formula(7, 3, &pivot(None), "total", None),
            "SUMIFS(BLOCKREFSB(7,3,\"*\",\"amt\"),\
             BLOCKREFSB(7,3,\"*\",\"region\"),#KEY)"
        );
    }

    #[test]
    fn every_function_lowers_to_its_ifs_form() {
        // SUM -> SUMIFS, AVERAGE -> AVERAGEIFS, and so on: the `*IFS` family is
        // registered for all five, which is why no new built-in is needed.
        for (func, name) in [
            (AggFunc::Sum, "SUMIFS"),
            (AggFunc::Count, "COUNTIFS"),
            // NOT "COUNTAIFS" — no such function exists.
            (AggFunc::CountA, "COUNTIFS"),
            (AggFunc::Average, "AVERAGEIFS"),
            (AggFunc::Min, "MINIFS"),
            (AggFunc::Max, "MAXIFS"),
        ] {
            let spec = PivotSpec {
                func,
                ..pivot(Some("quarter"))
            };
            assert!(
                pivot_formula(7, 3, &spec, "Q1", None).starts_with(&format!("{name}(")),
                "{func:?} should lower to {name}"
            );
        }
    }

    #[test]
    fn count_omits_the_measure_because_countifs_has_no_value_range() {
        // `COUNTIFS` takes `(range, criteria)+` — an even arity. Handing it a
        // measure range would make every pivot COUNT cell fail to evaluate.
        let spec = PivotSpec {
            func: AggFunc::Count,
            ..pivot(Some("quarter"))
        };
        assert_eq!(
            pivot_formula(7, 3, &spec, "Q1", None),
            "COUNTIFS(BLOCKREFSB(7,3,\"*\",\"region\"),#KEY,\
             BLOCKREFSB(7,3,\"*\",\"quarter\"),\"Q1\")"
        );
        // And the grouped form stays even too.
        let grouped = PivotSpec {
            func: AggFunc::Count,
            ..pivot(None)
        };
        assert_eq!(
            pivot_formula(7, 3, &grouped, "total", None),
            "COUNTIFS(BLOCKREFSB(7,3,\"*\",\"region\"),#KEY)"
        );
    }

    #[test]
    fn counta_counts_records_whose_measure_is_present() {
        // There is no `COUNTAIFS`, so this lowers to `COUNTIFS` plus one
        // criterion of its own: the measure must not be blank. `"<>"` is the
        // spreadsheet idiom for that, and it goes last because it belongs to
        // the aggregate rather than to the recipe's filters.
        let spec = PivotSpec {
            func: AggFunc::CountA,
            ..pivot(Some("quarter"))
        };
        assert_eq!(
            pivot_formula(7, 3, &spec, "Q1", None),
            "COUNTIFS(BLOCKREFSB(7,3,\"*\",\"region\"),#KEY,\
             BLOCKREFSB(7,3,\"*\",\"quarter\"),\"Q1\",\
             BLOCKREFSB(7,3,\"*\",\"amt\"),\"<>\")"
        );
    }

    #[test]
    fn countas_criterion_comes_after_the_recipes_own_filters() {
        // Arity stays even either way; the order is for a reader, and it puts
        // "which records count at all" before "and the measure is present".
        let spec = PivotSpec {
            func: AggFunc::CountA,
            filters: vec![PivotFilter {
                field: "region".into(),
                criteria: "<>North".into(),
            }],
            ..pivot(None)
        };
        assert_eq!(
            pivot_formula(7, 3, &spec, "total", None),
            "COUNTIFS(BLOCKREFSB(7,3,\"*\",\"region\"),#KEY,\
             BLOCKREFSB(7,3,\"*\",\"region\"),\"<>North\",\
             BLOCKREFSB(7,3,\"*\",\"amt\"),\"<>\")"
        );
    }

    #[test]
    fn a_declared_column_can_counta_its_own_measure() {
        // The per-column override picks the measure the non-blank test applies
        // to, not just the function.
        let spec = PivotSpec {
            func: AggFunc::Sum,
            ..pivot(Some("quarter"))
        };
        let column = PivotColumn {
            col_value: None,
            measure: Some("note".into()),
            func: Some(AggFunc::CountA),
        };
        assert_eq!(
            pivot_formula(7, 3, &spec, "filled", Some(&column)),
            "COUNTIFS(BLOCKREFSB(7,3,\"*\",\"region\"),#KEY,\
             BLOCKREFSB(7,3,\"*\",\"note\"),\"<>\")"
        );
    }

    #[test]
    fn a_quote_in_a_dimension_value_is_escaped() {
        // The COLUMN value is spliced as a literal, so it needs doubling. The
        // ROW value does not: `#KEY` is substituted as an AST node.
        let f = pivot_formula(0, 1, &pivot(Some("quarter")), "say \"hi\"", None);
        assert!(
            f.contains("\"say \"\"hi\"\"\""),
            "expected doubling, got {f}"
        );
    }

    #[test]
    fn the_source_is_named_by_id_in_a_pivot_too() {
        let f = pivot_formula(2, 9, &pivot(Some("quarter")), "Q1", None);
        assert!(f.contains("BLOCKREFSB(2,9,"));
        assert!(!f.contains("orders"), "no ref name appears: {f}");
    }

    #[test]
    fn the_key_rule_asks_whether_the_value_occurs_in_the_source() {
        // Not a stored whitelist — a count over the source's own column, so a
        // group that appears later stops being flagged with no rebuild.
        assert_eq!(
            pivot_key_validation(7, 3, &pivot(Some("quarter"))),
            "COUNTIFS(BLOCKREFSB(7,3,\"*\",\"region\"),#PLACEHOLDER)>0"
        );
    }

    #[test]
    fn the_key_rule_applies_the_pivot_s_own_filters() {
        // "Occurs in the source" and "belongs in this pivot" are different
        // questions once a filter exists, and the cells answer the second one.
        // A rule that answered the first would pass a key whose row is
        // guaranteed to read 0 in every cell — an unmarked empty row, which is
        // the exact thing the rule exists to prevent.
        let spec = PivotSpec {
            filters: vec![PivotFilter {
                field: "region".into(),
                criteria: "<>North".into(),
            }],
            ..pivot(Some("quarter"))
        };
        assert_eq!(
            pivot_key_validation(7, 3, &spec),
            "COUNTIFS(BLOCKREFSB(7,3,\"*\",\"region\"),#PLACEHOLDER,\
             BLOCKREFSB(7,3,\"*\",\"region\"),\"<>North\")>0"
        );
    }

    #[test]
    fn a_quote_in_a_filter_criteria_is_escaped_in_the_key_rule() {
        // The criteria reaches the rule as a string literal, so a quote in it
        // would close that literal and produce a formula that means something
        // else entirely.
        let spec = PivotSpec {
            filters: vec![PivotFilter {
                field: "region".into(),
                criteria: "<>we\"ird".into(),
            }],
            ..pivot(None)
        };
        assert!(pivot_key_validation(0, 1, &spec).contains("\"<>we\"\"ird\""));
    }

    #[test]
    fn a_quote_in_the_row_dimension_name_is_escaped_in_the_key_rule() {
        let spec = PivotSpec {
            row_dim: "we\"ird".into(),
            ..pivot(None)
        };
        assert!(pivot_key_validation(0, 1, &spec).contains("\"we\"\"ird\""));
    }

    #[test]
    fn a_quote_in_a_field_name_is_escaped_rather_than_closing_the_literal() {
        let f = aggregate_formula(0, 1, Some(&agg(AggFunc::Sum, "say \"hi\""))).unwrap();
        assert!(
            f.contains("\"say \"\"hi\"\"\""),
            "expected a doubled quote, got {f}"
        );
    }
}
