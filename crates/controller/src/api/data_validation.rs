//! Reading a cell's data-validation rule, and asking — before writing — whether
//! a value would break it.
//!
//! The rule is already live as the cell's `Validation` shadow, which marks a
//! value the cell HAS. Excel's "Stop" alert refuses a value the cell does not
//! have yet, so the host needs the verdict first; this evaluates the shadow's
//! AST against the proposed value exactly as `check_field_validation` does for
//! block fields, and leaves the workbook as it found it apart from the shadow
//! itself, which the write would have installed anyway.

use gents_derives::TS;
use logisheets_base::{CellId, errors::BasicError};
use xmlserde::XmlValue;

// NB: not `crate::errors::Result` — the alias would shadow the std one the
// `TS` derive's serde impls use (see field_validation.rs).
use crate::{
    data_validation_manager::spec::{DataValidationSpec, rule_to_spec},
    errors::Error,
    sid_assigner::ShadowKind,
};

use super::Workbook;

/// A cell's data-validation rule, for prefilling the Data validation dialog.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "data_validation_info.ts", rename_all = "camelCase")]
pub struct DataValidationInfo {
    pub spec: DataValidationSpec,
    /// Every range the rule covers, in A1 (`A2:A100 C2:C100`), so the dialog
    /// can say that changing it changes more than the selection.
    pub sqref: String,
}

/// What a proposed write would do to a cell's data-validation rule.
#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "data_validation_verdict.ts", rename_all = "camelCase")]
pub struct DataValidationVerdict {
    /// `false` when no rule covers the cell (or it is a block cell, whose
    /// field rules are checked by `checkFieldValidation` instead).
    pub has_rule: bool,
    /// `true` when the value fails the rule. A formula is never judged here —
    /// its result is not known until it runs; the marker judges it after.
    pub violates: bool,
    /// The rule's `errorStyle`: `stop`, `warning` or `information`.
    pub error_style: String,
    pub error_title: String,
    /// The rule's own message; empty means the host words a generic one.
    pub error: String,
}

impl Workbook {
    /// The data-validation rule covering (`row`, `col`), if any.
    pub fn get_data_validation(
        &self,
        sheet_idx: usize,
        row: usize,
        col: usize,
    ) -> std::result::Result<Option<DataValidationInfo>, Error> {
        use crate::conditional_formatting_manager::resolve::ranges_to_sqref;
        let status = &self.controller.status;
        let sheet_id = status
            .sheet_info_manager
            .get_sheet_id(sheet_idx)
            .ok_or(BasicError::SheetIdxExceed(sheet_idx))?;
        let Some(sheet) = status.data_validation_manager.get_sheet(sheet_id) else {
            return Ok(None);
        };
        let Some((rule, _)) =
            status
                .data_validation_manager
                .rule_at(&status.navigator, sheet_id, row, col)
        else {
            return Ok(None);
        };
        let sqref = sheet
            .rules
            .iter()
            .find(|r| std::ptr::eq(&r.rule, rule))
            .map(|r| ranges_to_sqref(&status.navigator, sheet_id, &r.ranges))
            .unwrap_or_default();
        Ok(Some(DataValidationInfo {
            spec: rule_to_spec(rule),
            sqref,
        }))
    }

    /// Whether writing `proposed` into (`row`, `col`) would break the cell's
    /// data-validation rule. `has_rule: false`, never an error, when there is
    /// nothing to check.
    pub fn check_data_validation(
        &mut self,
        sheet_idx: usize,
        row: usize,
        col: usize,
        proposed: String,
    ) -> std::result::Result<DataValidationVerdict, Error> {
        use crate::data_validation_manager::translate::shadow_formula;
        use crate::edit_action::{EditAction, EditPayload, EphemeralCellInput, PayloadsAction};

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
        if !matches!(cell_id, CellId::NormalCell(_)) {
            return Ok(DataValidationVerdict::default());
        }
        let status = &self.controller.status;
        let Some((rule, anchor)) =
            status
                .data_validation_manager
                .rule_at(&status.navigator, sheet_id, row, col)
        else {
            return Ok(DataValidationVerdict::default());
        };
        let mut verdict = DataValidationVerdict {
            has_rule: true,
            violates: false,
            error_style: rule.error_style.serialize(),
            error_title: rule.error_title.clone().unwrap_or_default(),
            error: rule.error.clone().unwrap_or_default(),
        };
        let Some(formula) = shadow_formula(rule, (row, col), anchor) else {
            return Ok(verdict);
        };
        if proposed.trim_start().starts_with('=') {
            return Ok(verdict);
        }

        // An empty cell has no shadow yet (they are only materialized for
        // values). Install it now — the write would have done so a moment
        // later — and evaluate the AST that install produced.
        let eid = match self.controller.sid_assigner.find_shadow_id(
            sheet_id,
            cell_id,
            ShadowKind::Validation,
        ) {
            Some(eid) => eid,
            None => {
                let eid = self.controller.sid_assigner.get_shawdow_id(
                    sheet_id,
                    cell_id,
                    ShadowKind::Validation,
                );
                self.controller
                    .handle_action(EditAction::Payloads(PayloadsAction {
                        payloads: vec![EditPayload::EphemeralCellInput(EphemeralCellInput {
                            sheet_idx,
                            id: eid,
                            content: format!("={formula}"),
                        })],
                        undoable: false,
                        init: false,
                    }));
                eid
            }
        };
        let Some(ast) = self
            .controller
            .status
            .formula_manager
            .formulas
            .get(&(sheet_id, CellId::EphemeralCell(eid)))
            .cloned()
        else {
            return Ok(verdict);
        };
        verdict.violates = self.eval_against(sheet_id, cell_id, proposed, &ast);
        Ok(verdict)
    }
}
