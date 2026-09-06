//! Ask, before writing, whether a value would violate a block field's
//! validation rule.
//!
//! The rule itself is already live: a field with a `validation_formula` gets a
//! `ShadowKind::Validation` shadow per record, wired into the dependency graph
//! with `#PLACEHOLDER` bound to the cell it guards, and readers use its value
//! to draw the warning marker. That is a verdict on the value the cell *has*.
//!
//! [`BlockOp::OverrideValidation`](crate::edit_action::BlockOp) needs the
//! verdict on a value the cell does not have yet — the host has to know whether
//! the write it is about to allow is a violating one *before* it happens, or
//! the only way to refuse would be to write and then undo.
//!
//! So this evaluates the shadow's existing AST against a proposed value: swap
//! the value into the container, run the calculator on that one node, put the
//! old value back. Nothing is registered, nothing is dirtied, and no history
//! entry is made — the workbook is unchanged when this returns. Re-using the
//! shadow's AST (rather than re-parsing the template) also means the answer
//! cannot drift from what the marker will say once the write lands.

use std::collections::{HashMap, HashSet};

use gents_derives::TS;
use logisheets_base::{Addr, CellId, CellValue, SheetId, TextId, errors::BasicError};

// NB: do not `use crate::errors::Result` here — the local alias would shadow
// `std::result::Result` and break the serde impls the `TS` derive generates for
// `FieldValidationVerdict` (the same trap `sort_block` documents). Reference it
// fully-qualified in the signature instead.
use crate::{
    calc_engine::calculator::{calc_vertex::CalcValue, calc_vertex::Value, calculator::calc},
    cell::Cell,
    connectors::CalcConnector,
    errors::Error,
    sid_assigner::ShadowKind,
};

use super::Workbook;

/// What a proposed write would do to a cell's validation rule.
#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "field_validation_verdict.ts", rename_all = "camelCase")]
pub struct FieldValidationVerdict {
    /// `false` when the cell has no validation rule at all — the other two
    /// fields are then meaningless and the caller has nothing to gate on.
    pub has_rule: bool,
    /// `true` when the proposed value fails the rule. Only meaningful when
    /// `has_rule`.
    pub violates: bool,
    /// The rule's raw template, so a refusal can say what was expected.
    /// Empty when the field carries no rule.
    pub rule: String,
}

/// How a computed validation result is read as a verdict.
///
/// Mirrors `interpretValidation` in `logisheets-core` deliberately: a rule is
/// satisfied when it evaluates truthy, and an error (`#VALUE!`, `#NAME?`, a
/// rule that cannot resolve) counts as a violation rather than as a pass — a
/// rule nobody can evaluate is not a rule anybody has met. A blank result is
/// treated as passing, so an optional field is not flagged for being empty.
fn scalar_violates(v: &Value) -> bool {
    match v {
        Value::Boolean(b) => !*b,
        Value::Number(n) => *n == 0.0,
        Value::Error(_) => true,
        Value::Blank => false,
        Value::Text(_) => false,
    }
}

fn violates(value: &CalcValue) -> bool {
    match value {
        CalcValue::Scalar(v) => scalar_violates(v),
        // A rule that yields a range or a union is malformed for this purpose;
        // judge it on its first element rather than silently passing, which
        // would let a broken rule read as "everything is fine".
        CalcValue::Range(m) => match m.visit(0, 0) {
            Ok(v) => scalar_violates(v),
            Err(v) => scalar_violates(&v),
        },
        CalcValue::Cube(_) => true,
        CalcValue::Union(parts) => parts.first().map(|p| violates(p)).unwrap_or(false),
    }
}

impl Workbook {
    /// Whether writing `proposed` into the cell at (`row`, `col`) would break
    /// its field's validation rule.
    ///
    /// Returns `has_rule: false` — never an error — for every cell that is not
    /// a validated block cell: cells outside a block, fields with no rule, and
    /// rows whose shadow has not been installed yet. A caller gating a write
    /// wants one question answered, and "there is nothing to check here" is an
    /// answer, not a failure.
    pub fn check_field_validation(
        &mut self,
        sheet_idx: usize,
        row: usize,
        col: usize,
        proposed: String,
    ) -> std::result::Result<FieldValidationVerdict, Error> {
        let sheet_id = self
            .controller
            .status
            .sheet_info_manager
            .get_sheet_id(sheet_idx)
            .ok_or(BasicError::SheetIdxExceed(sheet_idx))?;

        let cell_id = self
            .controller
            .status
            .navigator
            .fetch_cell_id(&sheet_id, row, col)?;
        let CellId::BlockCell(bcid) = cell_id else {
            return Ok(FieldValidationVerdict::default());
        };

        let Some(rule) = self
            .controller
            .status
            .block_schema_manager
            .validation_for_block_cell(sheet_id, &bcid)
        else {
            return Ok(FieldValidationVerdict::default());
        };

        // The shadow carries the rule already substituted for this record —
        // its `#FIELD` siblings and `#KEY` resolved against this row. Without
        // one there is nothing to evaluate; that happens only in the window
        // between a bind and the calc pass, so report the rule but no verdict
        // rather than guessing at one.
        let unknown = FieldValidationVerdict {
            has_rule: true,
            violates: false,
            rule: rule.clone(),
        };
        let Some(eid) =
            self.controller
                .sid_assigner
                .find_shadow_id(sheet_id, cell_id, ShadowKind::Validation)
        else {
            return Ok(unknown);
        };
        let Some(ast) = self
            .controller
            .status
            .formula_manager
            .formulas
            .get(&(sheet_id, CellId::EphemeralCell(eid)))
            .cloned()
        else {
            return Ok(unknown);
        };

        let violated = self.eval_against(sheet_id, cell_id, proposed, &ast);
        Ok(FieldValidationVerdict {
            has_rule: true,
            violates: violated,
            rule,
        })
    }

    /// Evaluate `ast` with `cell_id` temporarily holding `proposed`, then put
    /// the cell back exactly as it was.
    ///
    /// The restore is unconditional and covers the "cell had no entry" case
    /// too: a validated-but-empty cell has nothing in the container, and
    /// leaving a blank one behind would turn a question into an edit.
    fn eval_against(
        &mut self,
        sheet_id: SheetId,
        cell_id: CellId,
        proposed: String,
        ast: &logisheets_parser::ast::Node,
    ) -> bool {
        let status = &mut self.controller.status;
        let proposed_value = {
            let text_ids = &mut status.text_id_manager;
            CellValue::from_string(proposed, &mut |t| -> TextId {
                text_ids.get_or_register_id(t)
            })
        };

        let saved: Option<Cell> = status.container.get_cell(sheet_id, &cell_id).cloned();
        status
            .container
            .update_value(sheet_id, cell_id, proposed_value);

        let (row, col) = status
            .navigator
            .fetch_cell_idx(&sheet_id, &cell_id)
            .unwrap_or((0, 0));

        let mut dirty_next: imbl::HashSet<(SheetId, CellId)> = imbl::HashSet::new();
        let mut calc_cells: HashSet<(SheetId, CellId)> = HashSet::new();
        let mut async_func_manager = crate::async_func_manager::AsyncFuncManager::default();
        let async_funcs: HashSet<String> = HashSet::new();

        let value = {
            let mut connector = CalcConnector {
                range_manager: &status.range_manager,
                cube_manager: &status.cube_manager,
                navigator: &mut status.navigator,
                container: &mut status.container,
                ext_links: &mut status.external_links_manager,
                text_id_manager: &mut status.text_id_manager,
                func_id_manager: &status.func_id_manager,
                sheet_id_manager: &status.sheet_id_manager,
                names_storage: HashMap::new(),
                cells_storage: HashMap::new(),
                sheet_pos_manager: &status.sheet_info_manager,
                async_func_manager: &mut async_func_manager,
                async_funcs: &async_funcs,
                active_sheet: sheet_id,
                curr_addr: Addr { row, col },
                dirty_cells_in_next_run: &mut dirty_next,
                calc_cells: &mut calc_cells,
                block_schema_manager: &status.block_schema_manager,
                formula_manager: &status.formula_manager,
                name_id_manager: &status.name_id_manager,
                ext_ref_manager: &status.ext_ref_manager,
            };
            calc(ast, &mut connector)
        };

        match saved {
            Some(cell) => status.container.add_cell(sheet_id, cell_id, cell),
            None => {
                status.container.remove_cell(sheet_id, &cell_id);
            }
        }

        violates(&value)
    }
}
