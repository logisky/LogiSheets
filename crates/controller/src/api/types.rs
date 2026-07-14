use gents_derives::TS;
use logisheets_base::{BlockId, DiyCellId};

use crate::{Appendix, Style, Value, style_manager::RawStyle};

#[derive(Debug, Clone, TS)]
#[ts(file_name = "save_file_result.ts", rename_all = "camelCase")]
pub struct SaveFileResult {
    pub data: Vec<u8>,
    pub code: u8,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "cell_info.ts", rename_all = "camelCase")]
pub struct CellInfo {
    pub value: Value,
    pub formula: String,
    pub style: Style,
    pub block_id: Option<BlockId>,
    pub diy_cell_id: Option<DiyCellId>,
    /// The value of this cell's data-validation shadow, if one exists. It is
    /// the boolean result of the validation rule (`false` ⇒ the cell's value
    /// violates the rule). `None` when the cell has no data-validation shadow.
    pub validation_shadow: Option<Value>,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "sheet_dimension.ts", rename_all = "camelCase")]
pub struct SheetDimension {
    pub max_row: usize,
    pub max_col: usize,
    pub height: f64,
    pub width: f64,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "reproducible_cell.ts", rename_all = "camelCase")]
// It is used to reproduce cells.
// Note that `value` or `style` is not friendly to the frontend, and reproducing cells
// don't have formula.
pub struct ReproducibleCell {
    pub coordinate: SheetCoordinate,
    pub value: Value,
    pub style: RawStyle,
    pub appendix: Vec<Appendix>,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "sheet_coordinate.ts", rename_all = "camelCase")]
pub struct SheetCoordinate {
    pub row: usize,
    pub col: usize,
}

/// A reference (a cell or range) resolved to a concrete rectangle, as used by
/// the dependency-tracking API. `start == end` with neither `all_rows` nor
/// `all_cols` set ⇒ a single-cell reference.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "cell_ref_range.ts", rename_all = "camelCase")]
pub struct CellRefRange {
    pub sheet_idx: usize,
    pub start_row: usize,
    pub start_col: usize,
    pub end_row: usize,
    pub end_col: usize,
    /// A whole-column reference (e.g. `A:A`) — spans every row. `start_row`/
    /// `end_row` are 0 placeholders; the reference grows with the sheet.
    pub all_rows: bool,
    /// A whole-row reference (e.g. `3:3`) — spans every column.
    pub all_cols: bool,
}

/// One formula cell that depends on a queried range (Excel "trace dependents"),
/// with the reference it used to reach that range.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "dependent_cell.ts", rename_all = "camelCase")]
pub struct DependentCell {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
    /// The reference this formula used that intersects the queried range.
    pub via: CellRefRange,
}
