//! Stores Excel data validation rules (`<dataValidation>`).
//!
//! Read-only for now: rules are parsed from the xlsx on load, kept verbatim
//! (the whole `CtDataValidations` per sheet, so nothing is lost on round-trip),
//! and written back on save. Users cannot add/remove rules yet.
//!
//! LogiSheets does not enforce validation at input time. Instead each covered,
//! non-empty cell gets a `ShadowKind::Validation` shadow whose formula (derived
//! from the rule) evaluates to a boolean; the frontend flags cells whose shadow
//! is `false`. Shadow materialization and rule→formula translation live
//! elsewhere; this manager is just the rule store.

pub mod translate;

use imbl::HashMap;
use logisheets_base::SheetId;
use logisheets_workbook::prelude::{CtDataValidation, CtDataValidations, StDataValidationType};

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

#[derive(Debug, Clone, Default)]
pub struct DataValidationManager {
    /// Per-sheet data validation, kept verbatim for faithful round-trip.
    pub validations: HashMap<SheetId, CtDataValidations>,
}

impl DataValidationManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_sheet(&mut self, sheet_id: SheetId, validations: CtDataValidations) {
        self.validations.insert(sheet_id, validations);
    }

    pub fn get_sheet(&self, sheet_id: SheetId) -> Option<&CtDataValidations> {
        self.validations.get(&sheet_id)
    }

    pub fn is_empty(&self) -> bool {
        self.validations.is_empty()
    }
}

// `sqref` parsing is shared with conditional formatting; re-exported here so
// existing call sites keep working.
pub use crate::sqref::{SqrefRange, parse_sqref};
