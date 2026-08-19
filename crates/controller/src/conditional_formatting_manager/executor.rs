//! Applies the conditional-formatting edit payloads.
//!
//! Takes the navigator and the dxf store directly rather than going through a
//! connector trait: it is the only consumer, and what it needs is narrow —
//! sheet index → id, cell coordinates → anchors, and a slot to intern the rule's
//! differential format into.

use imbl::Vector;
use logisheets_workbook::prelude::CtDxf;

use super::spec::{CfRuleSpec, spec_to_dxf, spec_to_rule};
use super::{CfRange, ConditionalFormattingManager};
use crate::Error;
use crate::edit_action::EditPayload;
use crate::navigator::Navigator;
use crate::style_manager::dxf_manager::DxfManager;
use crate::workbook::sheet_info_manager::SheetInfoManager;
use logisheets_base::errors::BasicError;

pub struct ConditionalFormattingExecutor {
    pub manager: ConditionalFormattingManager,
}

impl ConditionalFormattingExecutor {
    pub fn new(manager: ConditionalFormattingManager) -> Self {
        Self { manager }
    }

    /// Returns `(self, changed)`; `changed` is `false` for payloads this
    /// executor does not handle.
    pub fn execute(
        mut self,
        nav: &Navigator,
        sheet_info: &SheetInfoManager,
        dxfs: &mut DxfManager,
        payload: EditPayload,
    ) -> Result<(Self, bool), Error> {
        match payload {
            EditPayload::CreateConditionalFormattingRule(p) => {
                let sheet_id = sheet_info
                    .get_sheet_id(p.sheet_idx)
                    .ok_or(BasicError::SheetIdxExceed(p.sheet_idx))?;
                let ranges = anchor_rect(
                    nav,
                    sheet_id,
                    p.start_row,
                    p.start_col,
                    p.end_row,
                    p.end_col,
                )?;
                // New rules apply last, like Excel's "New Rule".
                let priority = self.manager.max_priority(sheet_id) + 1;
                let dxf_id = intern_format(dxfs, &p.rule, None);
                let rule = spec_to_rule(&p.rule, priority, dxf_id)?;
                self.manager.add_rule(sheet_id, ranges, rule);
                Ok((self, true))
            }
            EditPayload::UpdateConditionalFormattingRule(p) => {
                let sheet_id = sheet_info
                    .get_sheet_id(p.sheet_idx)
                    .ok_or(BasicError::SheetIdxExceed(p.sheet_idx))?;
                // Keep the rule's priority so an edit doesn't reorder it, and
                // reuse its dxf slot so repeated edits don't grow the list.
                let existing = self
                    .manager
                    .get_sheet(sheet_id)
                    .and_then(|blocks| {
                        blocks
                            .iter()
                            .flat_map(|b| b.rules.iter())
                            .find(|r| r.id == p.rule_id)
                    })
                    .map(|r| (r.rule.priority, r.rule.dxf_id));
                let Some((priority, old_dxf)) = existing else {
                    return Err(Error::PayloadError(format!(
                        "no conditional formatting rule with id {}",
                        p.rule_id
                    )));
                };
                let dxf_id = intern_format(dxfs, &p.rule, old_dxf);
                let rule = spec_to_rule(&p.rule, priority, dxf_id)?;
                let changed = self.manager.replace_rule(p.rule_id, rule);
                Ok((self, changed))
            }
            EditPayload::MoveConditionalFormattingRule(p) => {
                let sheet_id = sheet_info
                    .get_sheet_id(p.sheet_idx)
                    .ok_or(BasicError::SheetIdxExceed(p.sheet_idx))?;
                let ranges = anchor_rect(
                    nav,
                    sheet_id,
                    p.start_row,
                    p.start_col,
                    p.end_row,
                    p.end_col,
                )?;
                let changed = self.manager.set_rule_ranges(p.rule_id, ranges);
                if !changed {
                    return Err(Error::PayloadError(format!(
                        "no conditional formatting rule with id {}",
                        p.rule_id
                    )));
                }
                Ok((self, true))
            }
            EditPayload::DeleteConditionalFormattingRule(p) => {
                // The orphaned dxf is intentionally left in place: dxfIds are
                // positions, so compacting the list would repoint every rule
                // after it. An unreferenced dxf is valid OOXML.
                let changed = self.manager.remove_rule(p.rule_id);
                Ok((self, changed))
            }
            _ => Ok((self, false)),
        }
    }
}

/// Anchor a rectangle of coordinates onto stable cell ids, normalizing a range
/// given corner-to-corner in any direction.
fn anchor_rect(
    nav: &Navigator,
    sheet_id: logisheets_base::SheetId,
    r0: usize,
    c0: usize,
    r1: usize,
    c1: usize,
) -> Result<Vector<CfRange>, Error> {
    let (r0, r1) = (r0.min(r1), r0.max(r1));
    let (c0, c1) = (c0.min(c1), c0.max(c1));
    let start = nav.fetch_cell_id(&sheet_id, r0, c0)?;
    let end = nav.fetch_cell_id(&sheet_id, r1, c1)?;
    Ok(Vector::from_iter([CfRange::Rect(start, end)]))
}

/// Intern the spec's format, reusing `old` when the rule already owned a slot.
/// `None` when the spec sets no format — the visual rule types carry their own
/// appearance and need no dxf.
fn intern_format(dxfs: &mut DxfManager, spec: &CfRuleSpec, old: Option<u32>) -> Option<u32> {
    let dxf: CtDxf = spec.format.as_ref().and_then(spec_to_dxf)?;
    match old {
        Some(id) if dxfs.replace(id, dxf.clone()) => Some(id),
        _ => Some(dxfs.intern(dxf)),
    }
}
