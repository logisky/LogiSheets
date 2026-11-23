//! Stores Excel data validation rules (`<dataValidation>`).
//!
//! Each rule's `sqref` is resolved at load into the engine's stable ids — the
//! same [`CfRange`] conditional formatting uses — and rendered back to A1 at
//! save, so a rule follows its cells through row/column insertion and deletion.
//! The rule body stays the parsed OOXML type, so every attribute round-trips;
//! its `sqref` field is ignored once modeled (the ranges are the truth).
//!
//! LogiSheets does not refuse a write here. Each covered, non-empty normal cell
//! gets a `ShadowKind::Validation` shadow whose formula (derived from the rule,
//! see [`translate`]) evaluates to a boolean; the frontend flags cells whose
//! shadow is `false`, and asks `check_data_validation` before a write when it
//! wants to stop one. Block cells are left alone: their `Validation` shadow
//! belongs to the block's field rules.

pub(crate) mod executor;
pub mod spec;
pub mod translate;

use imbl::{HashMap, Vector};
use logisheets_base::SheetId;
use logisheets_workbook::prelude::{CtDataValidation, CtDataValidations, StDataValidationType};

use crate::conditional_formatting_manager::CfRange;
use crate::conditional_formatting_manager::resolve::range_bounds;
use crate::navigator::Navigator;

/// The options offered by a `list`-type data validation. Douyoushu uses this to
/// turn a cell's dropdown into an `enum` input in the published manifest.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ListValidation {
    /// Inline literal options parsed from `formula1` = `"a,b,c"`. Ready to use.
    Inline(Vec<String>),
    /// A range or named-range reference (the raw `formula1`, e.g. `$D$1:$D$5`
    /// or `Lists!$A$1:$A$9`). The caller resolves it to concrete values via its
    /// own cell reads — kept out of the engine so cross-sheet / named refs stay
    /// the caller's concern.
    Reference(String),
}

/// If `dv` is a `list` validation with operands, return its options; otherwise
/// `None` (non-list types are intentionally not surfaced).
pub fn list_validation(dv: &CtDataValidation) -> Option<ListValidation> {
    if !matches!(dv.ty, StDataValidationType::List) {
        return None;
    }
    let src = dv.formula1.as_ref()?.value.trim().to_string();
    if src.len() >= 2 && src.starts_with('"') && src.ends_with('"') {
        // Inline comma-separated literals. Excel escapes an embedded quote as
        // `""`; undo that per item. Commas can't appear inside inline items
        // (comma is the separator), so a plain split is faithful.
        let inner = &src[1..src.len() - 1];
        let items = inner
            .split(',')
            .map(|s| s.trim().replace("\"\"", "\""))
            .collect();
        Some(ListValidation::Inline(items))
    } else {
        Some(ListValidation::Reference(src))
    }
}

/// One rule and the cells it covers.
#[derive(Debug, Clone)]
pub struct DvRule {
    pub ranges: Vector<CfRange>,
    pub rule: CtDataValidation,
}

/// A sheet's `<dataValidations>`: the modeled rules plus what could not be.
#[derive(Debug, Clone, Default)]
pub struct SheetValidations {
    pub rules: Vector<DvRule>,
    /// Rules whose `sqref` resolved to nothing at load. Kept verbatim so they
    /// still round-trip — modeling what we can must never lose what we can't.
    pub unmodeled: Vector<CtDataValidation>,
    pub disable_prompts: bool,
    pub x_window: Option<u32>,
    pub y_window: Option<u32>,
}

impl SheetValidations {
    fn is_empty(&self) -> bool {
        self.rules.is_empty() && self.unmodeled.is_empty()
    }
}

#[derive(Debug, Clone, Default)]
pub struct DataValidationManager {
    pub validations: HashMap<SheetId, SheetValidations>,
    /// Parsed at load, waiting for [`DataValidationManager::model_loaded`]:
    /// `sqref` can only be anchored once the navigator has settled (blocks
    /// converted from tables included).
    loaded: HashMap<SheetId, CtDataValidations>,
}

impl DataValidationManager {
    pub fn new() -> Self {
        Self::default()
    }

    /// Queue a sheet's rules as read from the file; see `model_loaded`.
    pub fn set_loaded(&mut self, sheet_id: SheetId, validations: CtDataValidations) {
        self.loaded.insert(sheet_id, validations);
    }

    /// Anchor every queued `sqref` on cell ids. Run once, after load settles.
    pub(crate) fn model_loaded(&mut self, nav: &Navigator) {
        use crate::conditional_formatting_manager::resolve::resolve_sqref;
        for (sheet_id, dvs) in std::mem::take(&mut self.loaded) {
            let mut sheet = SheetValidations {
                disable_prompts: dvs.disable_prompts,
                x_window: dvs.x_window,
                y_window: dvs.y_window,
                ..Default::default()
            };
            for dv in dvs.data_validations {
                let ranges = resolve_sqref(nav, sheet_id, &dv.sqref);
                if ranges.is_empty() {
                    sheet.unmodeled.push_back(dv);
                } else {
                    sheet.rules.push_back(DvRule { ranges, rule: dv });
                }
            }
            self.set_sheet(sheet_id, sheet);
        }
    }

    pub fn set_sheet(&mut self, sheet_id: SheetId, sheet: SheetValidations) {
        if sheet.is_empty() {
            self.validations.remove(&sheet_id);
        } else {
            self.validations.insert(sheet_id, sheet);
        }
    }

    pub fn get_sheet(&self, sheet_id: SheetId) -> Option<&SheetValidations> {
        self.validations.get(&sheet_id)
    }

    pub fn is_empty(&self) -> bool {
        self.validations.is_empty()
    }

    /// The rule covering (`row`, `col`) and the top-left of its first range —
    /// the cell its relative references are written against. Excel allows one
    /// rule per cell; should a file carry overlaps anyway, the first wins.
    pub(crate) fn rule_at(
        &self,
        nav: &Navigator,
        sheet_id: SheetId,
        row: usize,
        col: usize,
    ) -> Option<(&CtDataValidation, (usize, usize))> {
        let sheet = self.validations.get(&sheet_id)?;
        sheet.rules.iter().find_map(|r| {
            let covers = r.ranges.iter().any(|range| {
                range_bounds(nav, sheet_id, range).is_some_and(|(r0, c0, r1, c1)| {
                    row >= r0 && row <= r1 && col >= c0 && col <= c1
                })
            });
            if !covers {
                return None;
            }
            let anchor = r
                .ranges
                .iter()
                .find_map(|range| range_bounds(nav, sheet_id, range))
                .map(|(r0, c0, _, _)| (r0, c0))?;
            Some((&r.rule, anchor))
        })
    }
}

// `sqref` parsing is shared with conditional formatting; re-exported here so
// existing call sites keep working.
pub use crate::sqref::{SqrefRange, parse_sqref};
