use gents_derives::TS;
use logisheets_base::{BlockId, DiyCellId};

use crate::{style_manager::RawStyle, Appendix, Style, Value};

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
