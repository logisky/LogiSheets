//! Types shared by every LogiSheets engine crate: the stable id types
//! ([`CellId`], `SheetId`, `RowId`, ...), references and ranges built from
//! them, [`CellValue`] and formula [`Error`] values, the `errors::BasicError`
//! every layer reports, and the traits (`traits`) through which the parser
//! and calculator reach the controller's managers without depending on it.
//!
//! The core idea: a cell is addressed by ids that never change when rows or
//! columns are inserted or deleted, and only the controller's navigator maps
//! ids to 0-based `(row, col)` positions.

pub mod async_func;
pub mod traits;
pub mod types;
pub use traits::*;
pub use types::cube_value;
pub use types::datetime;
pub use types::id::*;
pub use types::matrix_value;
pub mod errors;

use gents_derives::TS;
use logisheets_workbook::prelude::*;
use std::hash::Hash;

/// A cell's stable identity. It does not change when rows or columns are
/// inserted or deleted around the cell; ask the worksheet for its current
/// position.
#[derive(Clone, Hash, Debug, Eq, PartialEq, Copy, TS)]
#[ts(file_name = "cell_id.ts", tag = "type")]
pub enum CellId {
    /// An ordinary grid cell, keyed by its sheet-scoped row and column ids.
    NormalCell(NormalCellId),
    /// A cell inside a block, keyed by the block and the block's own line ids.
    BlockCell(BlockCellId),
    /// A cell with no grid position. It is never saved to the workbook and
    /// cannot be referenced by other formulas, but it can hold a formula and
    /// a style, so a host can use the engine to compute values of its own
    /// (the engine does this for validation and conditional-formatting
    /// "shadow" cells). Persisting it is the host's job. The id space is
    /// shared by everyone using the workbook, so do not assume an id is
    /// yours alone.
    EphemeralCell(EphemeralId),
}

#[derive(Clone, Hash, Debug, Eq, PartialEq, Copy, TS)]
/// Row and column ids of a grid cell. Both are scoped to one sheet.
#[ts(file_name = "normal_cell_id.ts")]
pub struct NormalCellId {
    pub row: RowId,
    pub col: ColId,
}

#[derive(Debug, Clone, Copy, Hash, PartialEq, Eq, Default)]
pub struct RefAbs {
    pub start_row: bool,
    pub start_col: bool,
    pub end_row: bool,
    pub end_col: bool,
}

impl RefAbs {
    pub fn from_col_range(start: bool, end: bool) -> Self {
        RefAbs {
            start_row: false,
            start_col: start,
            end_row: false,
            end_col: end,
        }
    }

    pub fn from_row_range(start: bool, end: bool) -> Self {
        RefAbs {
            start_row: start,
            start_col: false,
            end_row: end,
            end_col: false,
        }
    }

    pub fn from_addr(row: bool, col: bool) -> Self {
        RefAbs {
            start_row: row,
            start_col: col,
            end_row: false,
            end_col: false,
        }
    }

    pub fn from_addr_range(start_row: bool, end_row: bool, start_col: bool, end_col: bool) -> Self {
        RefAbs {
            start_row,
            start_col,
            end_row,
            end_col,
        }
    }
}

#[derive(Debug, Clone, Copy, Hash, PartialEq, Eq)]
pub enum NormalRange {
    Single(NormalCellId),
    RowRange(RowId, RowId),
    ColRange(ColId, ColId),
    AddrRange(NormalCellId, NormalCellId),
}

impl NormalRange {
    pub fn is_single(&self) -> bool {
        matches!(self, NormalRange::Single(_))
    }
}

#[derive(Debug, Clone, Copy, Hash, PartialEq, Eq)]
pub enum BlockRange {
    Single(BlockCellId),
    AddrRange(BlockCellId, BlockCellId),
}

impl BlockRange {
    pub fn is_single(&self) -> bool {
        matches!(self, BlockRange::Single(_))
    }

    pub fn block_id(&self) -> BlockId {
        match self {
            BlockRange::Single(c) => c.block_id,
            BlockRange::AddrRange(c, _) => c.block_id,
        }
    }
}

#[derive(Debug, Clone, Copy, Hash, PartialEq, Eq)]
pub enum Range {
    Normal(NormalRange),
    Block(BlockRange),
    Ephemeral(EphemeralId),
}

impl From<CellId> for Range {
    fn from(value: CellId) -> Self {
        match value {
            CellId::NormalCell(n) => Range::Normal(NormalRange::Single(n)),
            CellId::BlockCell(b) => Range::Block(BlockRange::Single(b)),
            CellId::EphemeralCell(e) => Range::Ephemeral(e),
        }
    }
}

#[derive(Debug, Clone, Copy, Hash, PartialEq, Eq)]
pub struct Cube {
    pub from_sheet: SheetId,
    pub to_sheet: SheetId,
    pub cross: CubeCross,
}

#[derive(Debug, Clone, Copy, Hash, PartialEq, Eq)]
pub enum CubeCross {
    // (row_idx, col_idx) pair
    Single(usize, usize),
    // (start_row_idx, end_row_idx)
    RowRange(usize, usize),
    // (start_col_idx, end_col_idx)
    ColRange(usize, usize),
    AddrRange(Addr, Addr),
}

#[derive(Debug, Clone, Copy, Hash, PartialEq, Eq)]
pub struct ExtRef {
    pub ext_book: ExtBookId,
    pub from_sheet: Option<SheetId>,
    pub to_sheet: SheetId,
    pub cross: CubeCross,
}

#[derive(Clone, Hash, Debug, Eq, PartialEq, Copy, TS)]
/// A cell inside a block. `row`/`col` are the BLOCK's own line ids, not the
/// sheet's, so they stay valid when the block moves or its lines reorder.
#[ts(file_name = "block_cell_id.ts", rename_all = "camelCase")]
pub struct BlockCellId {
    /// Unique within a sheet only.
    pub block_id: BlockId,
    pub row: RowId,
    pub col: ColId,
}

#[derive(Debug, Clone, Default, Hash, PartialEq, Eq, Copy)]
pub struct Addr {
    pub row: usize,
    pub col: usize,
}

/// A formula error value. `to_string` / `from_string` convert to and from the
/// Excel spelling; an unknown spelling reads as `Unspecified` (`#UNKNOWN!`).
#[derive(Debug, Clone)]
pub enum Error {
    Unspecified,
    Div0,        // #DIV/0!
    NA,          // #N/A
    Name,        // #NAME?
    Null,        // #NULL!
    Num,         // #NUM!
    Ref,         // #REF!
    Value,       // #VALUE!
    GettingData, // #GETTING_DATA
    // A special error that is used to indicate that
    // the cell is a placeholder
    Placeholder, // #PLACEHOLDER
}

impl Error {
    pub fn to_string(&self) -> String {
        let s = match &self {
            Error::Div0 => "#DIV/0!",
            Error::NA => "#N/A",
            Error::Name => "#NAME?",
            Error::Null => "#NULL!",
            Error::Num => "#NUM!",
            Error::Ref => "#REF!",
            Error::Value => "#VALUE!",
            Error::GettingData => "#GETTING_DATA",
            Error::Unspecified => "#UNKNOWN!",
            Error::Placeholder => "#PLACEHOLDER",
        };
        String::from(s)
    }

    pub fn from_string(s: String) -> Self {
        match s.as_str() {
            "#DIV/0!" => Error::Div0,
            "#N/A" => Error::NA,
            "#NAME?" => Error::Name,
            "#NULL!" => Error::Null,
            "#NUM!" => Error::Num,
            "#REF!" => Error::Ref,
            "#VALUE!" => Error::Value,
            "#GETTING_DATA" => Error::GettingData,
            "#UNKNOWN!" => Error::Unspecified,
            "#PLACEHOLDER" => Error::Placeholder,
            _ => Error::Unspecified,
        }
    }
}

/// A cell's stored value.
///
/// `String` is an id into the workbook's shared-text table, so reading it
/// needs a text fetcher. `InlineStr` is rich text carried inline (files
/// written without a shared-string table). `FormulaStr` is the text result of
/// a formula.
#[derive(Debug, Clone)]
pub enum CellValue {
    Blank,
    Boolean(bool),
    Error(Error),
    String(TextId),
    Number(f64),
    InlineStr(CtRst),
    FormulaStr(String),
}

impl Default for CellValue {
    fn default() -> Self {
        CellValue::Blank
    }
}

impl CellValue {
    /// Plain-text rendering, with no number formatting applied. Booleans
    /// come out as `"1"`/`"0"`, not `TRUE`/`FALSE`; blank is `""`.
    pub fn to_string<F>(&self, text_id_fetcher: &F) -> String
    where
        F: Fn(TextId) -> String,
    {
        match self {
            CellValue::Blank => String::new(),
            CellValue::Boolean(b) => {
                if *b {
                    String::from("1")
                } else {
                    String::from("0")
                }
            }
            CellValue::Error(e) => e.to_string(),
            CellValue::String(id) => text_id_fetcher(*id),
            CellValue::Number(n) => n.to_string(),
            // The last of these. It survived the sweep that fixed the others
            // because the grep that found them excluded this line range —
            // which is why the sweep should have been `grep` with no filter at
            // all, and now is.
            CellValue::InlineStr(rst) => rst.plain_text(),
            CellValue::FormulaStr(s) => s.clone(),
        }
    }

    /// Classify typed input the way Excel does: empty is `Blank`,
    /// `true`/`false` (any case) is a boolean, a leading `'` forces text (and
    /// is dropped), anything `f64` parses is a number, the rest is text. Only
    /// the classification trims whitespace; stored text keeps it. Formulas
    /// are not handled here.
    pub fn from_string<F>(text: String, text_id_fetcher: &mut F) -> Self
    where
        F: FnMut(&str) -> TextId,
    {
        // Whitespace at the ends decides nothing about WHICH kind this is —
        // ` 12 ` is the number 12 and ` true ` is TRUE, the way Excel reads
        // them — so the classification below looks at the trimmed text. But a
        // string keeps what was typed. Trimming it here used to lose the space
        // for good, several layers before anything could have made it
        // significant again.
        let trimmed = text.trim();
        if trimmed.is_empty() {
            CellValue::Blank
        } else if trimmed.eq_ignore_ascii_case("TRUE") {
            CellValue::Boolean(true)
        } else if trimmed.eq_ignore_ascii_case("FALSE") {
            CellValue::Boolean(false)
        } else if let Some(rest) = text.strip_prefix('\'') {
            // A leading apostrophe forces text, and is not part of it.
            let text_id = text_id_fetcher(rest);
            CellValue::String(text_id)
        } else if let Ok(n) = trimmed.parse::<f64>() {
            CellValue::Number(n)
        } else {
            let tid = text_id_fetcher(&text);
            CellValue::String(tid)
        }
    }

    pub fn to_ct_value(self) -> (Option<PlainTextString>, StCellType) {
        match self {
            CellValue::Blank => (None, StCellType::N),
            CellValue::Boolean(b) => (
                Some(PlainTextString {
                    value: if b {
                        String::from("1")
                    } else {
                        String::from("0")
                    },
                    space: None,
                }),
                StCellType::B,
            ),
            CellValue::Error(e) => (
                Some(PlainTextString {
                    value: e.to_string(),
                    space: None,
                }),
                StCellType::E,
            ),
            CellValue::String(id) => {
                let plain_text_string = PlainTextString {
                    value: id.to_string(),
                    space: None,
                };
                (Some(plain_text_string), StCellType::S)
            }
            CellValue::Number(num) => (
                Some(PlainTextString {
                    value: num.to_string(),
                    space: None,
                }),
                StCellType::N,
            ),
            // A formula whose cached result is a string → xlsx `t="str"` with
            // the string in `<v>`. Inverse of the read path
            // (`StCellType::Str => FormulaStr`). Previously `todo!()`, which
            // panicked when saving any workbook containing formula cells.
            CellValue::FormulaStr(s) => (
                Some(PlainTextString {
                    value: s,
                    space: None,
                }),
                StCellType::Str,
            ),
            // Best-effort: flatten an inline rich string to its plain text and
            // write it as a string value. Rich-run formatting is not preserved
            // on save yet — but this no longer panics.
            CellValue::InlineStr(rst) => (
                Some(PlainTextString {
                    value: rst.t.map(|p| p.value).unwrap_or_default(),
                    space: None,
                }),
                StCellType::Str,
            ),
        }
    }

    fn get_value<F>(
        t: &StCellType,
        value: Option<&PlainTextString>,
        is: Option<&CtRst>,
        mut f: F,
    ) -> CellValue
    where
        F: FnMut(usize) -> TextId,
    {
        // An inline string keeps its text in `<is>`, never in `<v>`, so it has
        // to be handled before everything below — all of which is gated on a
        // `<v>` being present. openpyxl writes every string this way when the
        // file has no shared-string table, and such cells were loading as
        // blank: every label in the workbook silently lost, leaving only
        // numbers and formulas. The `StCellType::InlineStr` arm further down
        // was unreachable for exactly this reason.
        if matches!(t, StCellType::InlineStr) {
            return match is {
                Some(rst) => CellValue::InlineStr(rst.clone()),
                None => CellValue::Blank,
            };
        }
        if let Some(text) = value {
            match t {
                StCellType::N => match text.value.parse::<f64>() {
                    Ok(num) => CellValue::Number(num),
                    // A tool that writes formulas without computing them
                    // leaves the value element empty — `<f>B20/$B$8</f><v/>`
                    // is what openpyxl produces for every formula it writes,
                    // and openpyxl is how most non-Excel tooling emits .xlsx.
                    // An empty or malformed number is a blank cell; the
                    // formula next to it is what matters, and it gets
                    // evaluated on load. Panicking here took down the entire
                    // workbook over one absent cached result.
                    Err(_) => CellValue::Blank,
                },
                StCellType::B => {
                    if text.value == "1" {
                        CellValue::Boolean(true)
                    } else if text.value == "0" {
                        CellValue::Boolean(false)
                    } else {
                        let res = text.value.to_lowercase().parse::<bool>();
                        let v = match res {
                            Ok(b) => b,
                            Err(_) => false,
                        };
                        CellValue::Boolean(v)
                    }
                }
                StCellType::S => {
                    // The index into the shared-string table is text in the
                    // file like everything else, so it can be negative, or not
                    // a number at all. It used to be unwrapped.
                    match text.value.parse::<usize>() {
                        Ok(idx) => CellValue::String(f(idx)),
                        Err(_) => CellValue::Blank,
                    }
                }
                StCellType::InlineStr => {
                    if let Some(is) = is {
                        CellValue::InlineStr(is.clone())
                    } else {
                        CellValue::Blank
                    }
                }
                StCellType::Str => CellValue::FormulaStr(text.value.clone()),
                // ISO-8601 in the file; the engine stores dates as serial
                // numbers like any other number. An unreadable one loads blank
                // rather than failing the whole workbook.
                StCellType::D => match types::datetime::parse_iso8601_serial(&text.value) {
                    Some(n) => CellValue::Number(n),
                    None => CellValue::Blank,
                },
                // An error code the engine doesn't know loads as #VALUE!.
                StCellType::E => match Error::from_string(text.value.clone()) {
                    Error::Unspecified | Error::Placeholder => CellValue::Error(Error::Value),
                    e => CellValue::Error(e),
                },
            }
        } else {
            CellValue::Blank
        }
    }

    pub fn from_cell<F>(c: &CtCell, f: F) -> CellValue
    where
        F: FnMut(usize) -> TextId,
    {
        CellValue::get_value(&c.t, c.v.as_ref(), c.is.as_ref(), f)
    }

    /// Truthiness for conditions. Errors, blanks and formula text are false.
    pub fn bool_value(&self) -> bool {
        match self {
            CellValue::Boolean(b) => *b,
            CellValue::Number(n) => *n != 0.0,
            CellValue::Blank => false,
            CellValue::String(s) => *s > 0,
            // Non-empty text is true, matching the shared-string case above.
            CellValue::InlineStr(rst) => !rst.plain_text().is_empty(),
            CellValue::FormulaStr(_) => false,
            CellValue::Error(_) => false,
        }
    }

    pub fn is_error(&self) -> bool {
        matches!(self, CellValue::Error(_))
    }
}

/// `"A"` -> 0, `"AA"` -> 26. The label must be non-empty UPPERCASE ASCII
/// letters; anything else underflows (panics in debug builds).
pub fn column_label_to_index(label: &str) -> usize {
    let mut result: usize = 0;
    for (i, c) in label.chars().rev().enumerate() {
        result += (c as usize - 64) * 26_usize.pow(i as u32);
    }
    result - 1
}

/// 0-based column index to its letters: 0 -> `"A"`, 26 -> `"AA"`.
pub fn index_to_column_label(index: usize) -> String {
    let mut result: Vec<char> = vec![];
    let mut left = index as i32;
    while left >= 0_i32 {
        let ch = (left % 26_i32 + 97_i32) as u8;
        result.insert(0, ch.to_ascii_uppercase() as char);
        left = ((left / 26_i32) as i32) - 1_i32;
    }
    result.iter().collect()
}

/// A zero-based `(row, col)` as the A1 address a person reads: `(0, 0)` -> `A1`.
pub fn a1_notation(row: usize, col: usize) -> String {
    format!("{}{}", index_to_column_label(col), row + 1)
}

// An id shown to a person says what kind of id it is and whose it is.
impl std::fmt::Display for NormalCellId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "the cell with row id {} and column id {}",
            self.row, self.col
        )
    }
}

impl std::fmt::Display for BlockCellId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "the cell with row id {} and column id {} inside block {}",
            self.row, self.col, self.block_id
        )
    }
}

impl std::fmt::Display for CellId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CellId::NormalCell(c) => write!(f, "{c}"),
            CellId::BlockCell(c) => write!(f, "{c}"),
            CellId::EphemeralCell(e) => write!(f, "the ephemeral cell with id {e}"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{column_label_to_index, index_to_column_label};
    #[test]
    fn label_to_index() {
        let label = String::from("AA");
        let result = column_label_to_index(&label);
        assert_eq!(result, 26);
        let label = String::from("A");
        let result = column_label_to_index(&label);
        assert_eq!(result, 0);
    }

    #[test]
    fn index_to_label() {
        let idx = 26;
        let result = index_to_column_label(idx);
        assert_eq!(result, String::from("AA"));
        let idx = 29;
        let result = index_to_column_label(idx);
        assert_eq!(result, String::from("AD"));
        let idx = 0;
        let result = index_to_column_label(idx);
        assert_eq!(result, String::from("A"));
    }
}
