//! Applies `SetDataValidation`.
//!
//! Excel keeps one rule per cell, and applying a rule to a range replaces what
//! the cells had: so the target rectangle is first cut out of every rule on the
//! sheet (a rule left covering nothing is dropped), then the new rule, if any,
//! is added over it. Cutting a rectangle out of a range leaves up to four
//! pieces; each is re-anchored on cell ids like any other range.

use imbl::Vector;
use logisheets_base::SheetId;
use logisheets_base::errors::BasicError;

use super::spec::spec_to_rule;
use super::{DataValidationManager, DvRule, SheetValidations};
use crate::Error;
use crate::conditional_formatting_manager::CfRange;
use crate::conditional_formatting_manager::resolve::range_bounds;
use crate::edit_action::EditPayload;
use crate::navigator::Navigator;
use crate::navigator::sheet_nav::{MAX_COL_CNT, MAX_ROW_CNT};
use crate::workbook::sheet_info_manager::SheetInfoManager;

const LAST_ROW: usize = MAX_ROW_CNT as usize - 1;
const LAST_COL: usize = MAX_COL_CNT as usize - 1;

type Rect = (usize, usize, usize, usize);

pub struct DataValidationExecutor {
    pub manager: DataValidationManager,
}

impl DataValidationExecutor {
    pub fn new(manager: DataValidationManager) -> Self {
        Self { manager }
    }

    /// Returns `(self, changed)`; `changed` is `false` for payloads this
    /// executor does not handle.
    pub fn execute(
        mut self,
        nav: &Navigator,
        sheet_info: &SheetInfoManager,
        payload: EditPayload,
    ) -> Result<(Self, bool), Error> {
        let EditPayload::SetDataValidation(p) = payload else {
            return Ok((self, false));
        };
        let sheet_id = sheet_info
            .get_sheet_id(p.sheet_idx)
            .ok_or(BasicError::SheetIdxExceed(p.sheet_idx))?;
        // Validate before touching anything, so a bad spec changes nothing.
        let rule = p.rule.as_ref().map(spec_to_rule).transpose()?;
        let target: Rect = (
            p.start_row.min(p.end_row).min(LAST_ROW),
            p.start_col.min(p.end_col).min(LAST_COL),
            p.start_row.max(p.end_row).min(LAST_ROW),
            p.start_col.max(p.end_col).min(LAST_COL),
        );

        let mut sheet = self
            .manager
            .get_sheet(sheet_id)
            .cloned()
            .unwrap_or_default();
        let mut rules = Vector::new();
        for r in sheet.rules.iter() {
            let mut ranges = Vector::new();
            for range in r.ranges.iter() {
                ranges.append(subtract(nav, sheet_id, range, target)?);
            }
            if !ranges.is_empty() {
                rules.push_back(DvRule {
                    ranges,
                    rule: r.rule.clone(),
                });
            }
        }
        if let Some(rule) = rule {
            let ranges = Vector::from_iter([anchor(nav, sheet_id, target)?]);
            rules.push_back(DvRule { ranges, rule });
        }
        sheet = SheetValidations { rules, ..sheet };
        self.manager.set_sheet(sheet_id, sheet);
        Ok((self, true))
    }
}

/// `range` with `t` cut out of it, re-anchored. Untouched ranges come back as
/// they were; a range whose anchors are gone (its rows were deleted) is dropped.
fn subtract(
    nav: &Navigator,
    sheet_id: SheetId,
    range: &CfRange,
    t: Rect,
) -> Result<Vector<CfRange>, Error> {
    let Some((r0, c0, r1, c1)) = range_bounds(nav, sheet_id, range) else {
        return Ok(Vector::new());
    };
    let (r1, c1) = (r1.min(LAST_ROW), c1.min(LAST_COL));
    let (tr0, tc0, tr1, tc1) = t;
    if tr0 > r1 || tr1 < r0 || tc0 > c1 || tc1 < c0 {
        return Ok(Vector::from_iter([*range]));
    }
    let (ir0, ir1) = (r0.max(tr0), r1.min(tr1));
    let mut pieces: Vec<Rect> = Vec::new();
    if tr0 > r0 {
        pieces.push((r0, c0, tr0 - 1, c1));
    }
    if tr1 < r1 {
        pieces.push((tr1 + 1, c0, r1, c1));
    }
    if tc0 > c0 {
        pieces.push((ir0, c0, ir1, tc0 - 1));
    }
    if tc1 < c1 {
        pieces.push((ir0, tc1 + 1, ir1, c1));
    }
    pieces
        .into_iter()
        .map(|p| anchor(nav, sheet_id, p))
        .collect()
}

/// Anchor a rectangle on ids. One that spans every row becomes a column range
/// (and every column, a row range), so a rule on whole columns keeps covering
/// whatever rows are inserted later — the same shape Excel writes as `A:A`.
fn anchor(nav: &Navigator, sheet_id: SheetId, (r0, c0, r1, c1): Rect) -> Result<CfRange, Error> {
    if r0 == 0 && r1 >= LAST_ROW {
        let a = nav.fetch_col_id(&sheet_id, c0)?;
        let b = nav.fetch_col_id(&sheet_id, c1)?;
        return Ok(CfRange::ColRange(a, b));
    }
    if c0 == 0 && c1 >= LAST_COL {
        let a = nav.fetch_row_id(&sheet_id, r0)?;
        let b = nav.fetch_row_id(&sheet_id, r1)?;
        return Ok(CfRange::RowRange(a, b));
    }
    let start = nav.fetch_cell_id(&sheet_id, r0, c0)?;
    let end = nav.fetch_cell_id(&sheet_id, r1, c1)?;
    Ok(CfRange::Rect(start, end))
}
