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

/// A rectangular range from an `sqref`, 0-based inclusive. Missing bounds
/// (e.g. a whole-column `A:A`) default to the full extent.
#[derive(Debug, Clone, Copy)]
pub struct SqrefRange {
    pub r0: usize,
    pub c0: usize,
    pub r1: usize,
    pub c1: usize,
}

impl SqrefRange {
    pub fn contains(&self, row: usize, col: usize) -> bool {
        row >= self.r0 && row <= self.r1 && col >= self.c0 && col <= self.c1
    }
}

/// Parse an `sqref` (space-separated A1 ranges, e.g. `"A1:A10 C1 D2:E5"`) into
/// rectangular ranges. Tokens that don't parse are skipped.
pub fn parse_sqref(sqref: &str) -> Vec<SqrefRange> {
    sqref
        .split_whitespace()
        .filter_map(parse_range_token)
        .collect()
}

fn parse_range_token(tok: &str) -> Option<SqrefRange> {
    let (start, end) = match tok.split_once(':') {
        Some((a, b)) => (a, b),
        None => (tok, tok),
    };
    let (r0, c0) = parse_a1(start, false);
    let (r1, c1) = parse_a1(end, true);
    if c0 > c1 || r0 > r1 {
        return None;
    }
    Some(SqrefRange { r0, c0, r1, c1 })
}

/// Parse an A1 ref into (row, col), 0-based. A missing dimension defaults to 0
/// (`upper=false`) or the max extent (`upper=true`), so `A:A` / `1:1` work.
fn parse_a1(s: &str, upper: bool) -> (usize, usize) {
    let s = s.replace('$', "");
    let letters: String = s.chars().take_while(|c| c.is_ascii_alphabetic()).collect();
    let digits: String = s
        .chars()
        .skip_while(|c| c.is_ascii_alphabetic())
        .filter(|c| c.is_ascii_digit())
        .collect();
    let col = if letters.is_empty() {
        if upper { usize::MAX } else { 0 }
    } else {
        col_to_idx(&letters)
    };
    let row = match digits.parse::<usize>() {
        Ok(r) if r >= 1 => r - 1,
        _ => {
            if upper {
                usize::MAX
            } else {
                0
            }
        }
    };
    (row, col)
}

fn col_to_idx(letters: &str) -> usize {
    let mut idx = 0usize;
    for c in letters.chars() {
        idx = idx * 26 + (c.to_ascii_uppercase() as usize - 'A' as usize + 1);
    }
    idx - 1
}
