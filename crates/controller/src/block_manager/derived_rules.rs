//! The rule that actually guards a field's cells: what its declaration
//! implies, ANDed with what its author wrote.
//!
//! Until now the host composed these strings itself and stored the result as
//! the field's validation formula (`src/components/block-composer/index.tsx`) —
//! `unique` became a `COUNTIF(BLOCKREFSB(…), #PLACEHOLDER) = 1`, a `fieldRef`
//! became the same shape with `>= 1`, and Watson wrote out an
//! `OR(EXACT(…), …)` whitelist for an enum. Three consequences followed from
//! that, and generating the rule here instead removes all three:
//!
//!   - **A headless host had none of it.** The declaration lived in an opaque
//!     AppData blob only the browser read, so `unique` and enum membership
//!     meant nothing through the MCP server or the Node runtime.
//!   - **`required` had no formula form at all**, so a required-but-empty cell
//!     never raised a marker, never reached `list_violations`, and was
//!     invisible to an agent.
//!   - **A baked-in rule cannot be regenerated.** The composed `unique` check
//!     spells the field's name inside a string literal, and `rename_field`
//!     rewrote only the `#FIELD("…")` shape — so renaming a unique field left a
//!     rule naming a field that no longer existed, which evaluates FALSE for
//!     every record forever (pinned by
//!     `a_blockrefs_naming_a_field_that_does_not_exist_matches_nothing`).
//!     Derived from the schema, the rule is rebuilt from the current name every
//!     time the schema is bound.
//!
//! See `design/block-field-semantics.md`.

use logisheets_base::{BlockCellId, SheetId};

use super::enum_manager::EnumSetManager;
use super::schema_manager::SchemaManager;
use super::schema_manager::field_type::FieldType;
use super::schema_manager::manager::BlockFieldView;

/// Escape a value for use inside an Excel string literal, where `"` doubles.
fn lit(v: &str) -> String {
    v.replace('"', "\"\"")
}

/// `#PLACEHOLDER` is empty. Every derived rule that constrains a value exempts
/// the empty cell, and `required` is what makes emptiness itself a violation —
/// otherwise an optional field could never be left blank without lighting up.
///
/// `ISBLANK` rather than `#PLACEHOLDER=""`: an empty input is stored as a blank
/// cell, not as the empty string, and the two do not compare equal here. The
/// `required` rule is then this exact negation, which is the symmetry you want
/// between "may be empty" and "must not be".
const IS_EMPTY: &str = "ISBLANK(#PLACEHOLDER)";

/// Non-blank. The one derived rule that is *about* emptiness.
fn required_rule() -> String {
    format!("NOT({IS_EMPTY})")
}

/// No other record of this block carries the same value in this field.
///
/// Counts through `BLOCKREFSB` on the block's own field, by numeric ids rather
/// than by ref name, so renaming the block does not reach it either. Empty is
/// exempt: `unique` without `required` has to allow a blank.
///
/// Equality is `COUNTIF`'s — the stringified value — which is deliberately the
/// same notion `BLOCKREF` uses to resolve a key and the same one the row-key
/// guard enforces (`controller::block_key_guard`). One workbook with two
/// definitions of "the same value" would be worse than either.
fn unique_rule(sheet_id: SheetId, block_id: usize, field: &str) -> String {
    format!(
        "OR({IS_EMPTY},COUNTIF(BLOCKREFSB({sheet_id},{block_id},\"*\",\"{}\"),#PLACEHOLDER)=1)",
        lit(field)
    )
}

/// The value is one of the set's options. Empty is exempt — clearing a
/// selection is not a violation.
///
/// `EXACT` rather than `=` so membership is case-sensitive: variant ids are
/// what cells store, and `Open` and `open` are different options.
fn membership_rule(variant_ids: &[&str]) -> Option<String> {
    if variant_ids.is_empty() {
        return None;
    }
    let clauses: Vec<String> = variant_ids
        .iter()
        .map(|v| format!("EXACT(#PLACEHOLDER,\"{}\")", lit(v)))
        .collect();
    Some(format!("OR({IS_EMPTY},{})", clauses.join(",")))
}

/// The value appears in the field this one points at. Empty is exempt.
fn reference_rule(sheet_id: SheetId, block_id: usize, field: &str) -> String {
    format!(
        "OR({IS_EMPTY},COUNTIF(BLOCKREFSB({sheet_id},{block_id},\"*\",\"{}\"),#PLACEHOLDER)>=1)",
        lit(field)
    )
}

/// Every rule a field's declaration implies, in a stable order.
///
/// A declaration whose backing data is missing yields nothing rather than a
/// rule that rejects everything: an `enum` naming a set the workbook no longer
/// has would otherwise flag every value, including the ones that were valid
/// when the set existed. The field keeps its declaration and the missing set is
/// the thing to fix.
pub fn derived_rules(
    enums: &EnumSetManager,
    sheet_id: SheetId,
    block_id: usize,
    field: &BlockFieldView<'_>,
) -> Vec<String> {
    let mut out = Vec::new();
    if field.required {
        out.push(required_rule());
    }
    if field.unique {
        out.push(unique_rule(sheet_id, block_id, field.name));
    }
    match field.field_type {
        FieldType::Enum { set_id } | FieldType::MultiSelect { set_id } => {
            // MultiSelect stores a comma-separated list in one cell, so a
            // per-value membership check does not apply to it — the whole cell
            // would have to match one option. Only the single-valued form gets
            // the rule; splitting the list is a job for a function the formula
            // language does not have yet.
            if matches!(field.field_type, FieldType::Enum { .. }) {
                if let Some(set) = enums.get(set_id) {
                    if let Some(rule) = membership_rule(&set.variant_ids()) {
                        out.push(rule);
                    }
                }
            }
        }
        FieldType::FieldRef {
            sheet_id: target_sheet,
            block_id: target_block,
            field_name,
        } => {
            out.push(reference_rule(*target_sheet, *target_block, field_name));
        }
        // MultiSelectRef is the comma-separated form, same limitation as
        // MultiSelect.
        FieldType::MultiSelectRef { .. } => {}
        FieldType::Unspecified
        | FieldType::Text
        | FieldType::Number
        | FieldType::Boolean
        | FieldType::Datetime
        | FieldType::Image => {}
    }
    out
}

/// The rule a cell's validation shadow should evaluate: the derived rules and
/// the author's own, all of them, ANDed.
///
/// `None` when there is nothing to check — no shadow is installed and no marker
/// can appear, which is what a plain free-form column means.
/// `analysis` is what the cell's block analyses and how, when it is an
/// analysis block — the same value `formula_for_block_cell` takes, and needed
/// for the same reason: it lives on the navigator, not on the schema.
pub fn effective_validation(
    schema: &SchemaManager,
    enums: &EnumSetManager,
    sheet_id: SheetId,
    cell: &BlockCellId,
    analysis: Option<crate::block_manager::analysis::AnalysisTarget<'_>>,
) -> Option<String> {
    // A pivot's KEY cell is the one cell of the block a person can type into
    // (every other cell is generated, and the engine already drops writes to
    // templated cells). It holds a row-dimension value, so it has to name a
    // group that occurs in the source — and it gets a marker the moment it
    // does not, because editing it does NOT re-aim the row: `#KEY` was
    // captured when the row materialized, so the row goes on reporting the old
    // group under the new label. See `design/block-pivot.md` §4.3.
    if let Some(target) = analysis {
        if let Some(pivot) = target.pivot {
            if schema.is_key_cell(sheet_id, cell) {
                return Some(crate::block_manager::analysis::pivot_key_validation(
                    sheet_id,
                    target.source,
                    pivot,
                ));
            }
        }
    }
    let field = schema.field_view_for_block_cell(sheet_id, cell)?;
    let mut parts = derived_rules(enums, sheet_id, cell.block_id, &field);
    if let Some(own) = field.validation_formula {
        let own = own.trim();
        if !own.is_empty() {
            // The author's rule goes last so a reader of the composed string
            // sees the declared constraints first, in declaration order.
            parts.push(own.to_string());
        }
    }
    match parts.len() {
        0 => None,
        1 => Some(parts.pop().unwrap()),
        _ => Some(format!("AND({})", parts.join(","))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::block_manager::enum_manager::{EnumSet, EnumVariant};

    fn enums_with(id: &str, ids: &[&str]) -> EnumSetManager {
        let mut m = EnumSetManager::new();
        m.upsert(EnumSet {
            id: id.to_string(),
            name: String::new(),
            variants: ids
                .iter()
                .map(|v| EnumVariant {
                    id: v.to_string(),
                    label: v.to_string(),
                })
                .collect(),
        });
        m
    }

    fn field<'a>(
        name: &'a str,
        ty: &'a FieldType,
        required: bool,
        unique: bool,
    ) -> BlockFieldView<'a> {
        BlockFieldView {
            pivot_column: None,
            name,
            field_type: ty,
            required,
            unique,
            validation_formula: None,
            aggregate: None,
        }
    }

    #[test]
    fn a_field_that_declares_nothing_derives_nothing() {
        let ty = FieldType::Text;
        let rules = derived_rules(&EnumSetManager::new(), 0, 1, &field("a", &ty, false, false));
        assert!(rules.is_empty());
    }

    #[test]
    fn required_is_the_only_rule_that_is_about_emptiness() {
        let ty = FieldType::Text;
        let rules = derived_rules(&EnumSetManager::new(), 0, 1, &field("a", &ty, true, false));
        assert_eq!(rules, vec!["NOT(ISBLANK(#PLACEHOLDER))"]);
    }

    #[test]
    fn unique_counts_by_id_and_exempts_the_empty_cell() {
        // By numeric ids, not by ref name, so renaming the block cannot reach
        // it; and the field name is spelled from the schema, so renaming the
        // FIELD regenerates it rather than leaving a dead name behind.
        let ty = FieldType::Text;
        let rules = derived_rules(
            &EnumSetManager::new(),
            7,
            3,
            &field("email", &ty, false, true),
        );
        assert_eq!(
            rules,
            vec![
                "OR(ISBLANK(#PLACEHOLDER),COUNTIF(BLOCKREFSB(7,3,\"*\",\"email\"),#PLACEHOLDER)=1)"
            ]
        );
    }

    #[test]
    fn a_quote_in_a_name_is_escaped_rather_than_closing_the_literal() {
        let ty = FieldType::Text;
        let rules = derived_rules(
            &EnumSetManager::new(),
            0,
            1,
            &field("say \"hi\"", &ty, false, true),
        );
        assert!(
            rules[0].contains("\"say \"\"hi\"\"\""),
            "expected a doubled quote, got {}",
            rules[0]
        );
    }

    #[test]
    fn an_enum_whitelists_its_options_case_sensitively() {
        let ty = FieldType::Enum {
            set_id: "status".into(),
        };
        let rules = derived_rules(
            &enums_with("status", &["open", "done"]),
            0,
            1,
            &field("s", &ty, false, false),
        );
        assert_eq!(
            rules,
            vec![
                "OR(ISBLANK(#PLACEHOLDER),EXACT(#PLACEHOLDER,\"open\"),EXACT(#PLACEHOLDER,\"done\"))"
            ]
        );
    }

    #[test]
    fn an_enum_whose_set_is_gone_derives_nothing_rather_than_rejecting_everything() {
        // The set was removed but the field still declares it. Flagging every
        // value — including the ones that were valid — is worse than flagging
        // none; the missing set is the thing to fix.
        let ty = FieldType::Enum {
            set_id: "status".into(),
        };
        let rules = derived_rules(&EnumSetManager::new(), 0, 1, &field("s", &ty, false, false));
        assert!(rules.is_empty());
    }

    #[test]
    fn a_reference_checks_existence_in_the_target_field() {
        let ty = FieldType::FieldRef {
            sheet_id: 2,
            block_id: 9,
            field_name: "code".into(),
        };
        let rules = derived_rules(&EnumSetManager::new(), 0, 1, &field("c", &ty, false, false));
        assert_eq!(
            rules,
            vec![
                "OR(ISBLANK(#PLACEHOLDER),COUNTIF(BLOCKREFSB(2,9,\"*\",\"code\"),#PLACEHOLDER)>=1)"
            ]
        );
    }

    #[test]
    fn the_multi_valued_forms_derive_nothing_yet() {
        // Both store a comma-separated list in one cell, so a whole-cell
        // membership test would reject every multi-selection.
        for ty in [
            FieldType::MultiSelect {
                set_id: "status".into(),
            },
            FieldType::MultiSelectRef {
                sheet_id: 0,
                block_id: 1,
                field_name: "code".into(),
            },
        ] {
            let rules = derived_rules(
                &enums_with("status", &["open"]),
                0,
                1,
                &field("s", &ty, false, false),
            );
            assert!(rules.is_empty(), "{:?} should derive nothing yet", ty);
        }
    }

    #[test]
    fn several_constraints_are_anded_with_the_authors_own_rule_last() {
        let ty = FieldType::Enum {
            set_id: "status".into(),
        };
        let mut f = field("s", &ty, true, true);
        f.validation_formula = Some("LEN(#PLACEHOLDER)<10");
        let mut parts = derived_rules(&enums_with("status", &["open"]), 0, 1, &f);
        parts.push("LEN(#PLACEHOLDER)<10".into());
        let composed = format!("AND({})", parts.join(","));
        assert!(composed.starts_with("AND(NOT(ISBLANK(#PLACEHOLDER)),OR("));
        assert!(composed.ends_with("LEN(#PLACEHOLDER)<10)"));
    }
}
