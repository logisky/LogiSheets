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

use super::schema_manager::field_type::FieldAggregate;

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
    use crate::block_manager::schema_manager::field_type::AggFunc;

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

    #[test]
    fn a_quote_in_a_field_name_is_escaped_rather_than_closing_the_literal() {
        let f = aggregate_formula(0, 1, Some(&agg(AggFunc::Sum, "say \"hi\""))).unwrap();
        assert!(
            f.contains("\"say \"\"hi\"\"\""),
            "expected a doubled quote, got {f}"
        );
    }
}
