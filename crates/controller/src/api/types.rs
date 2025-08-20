use gents_derives::TS;
use logisheets_base::{BlockId, DiyCellId};

use crate::{Appendix, Style, Value};

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
#[ts(file_name = "cell_with_coordinate.ts", rename_all = "camelCase")]
pub struct ReproducibleCell {
    pub coordinate: SheetCoordinate,
    pub formula: String,
    pub value: Value,
    pub style: Style,
    pub appendix: Vec<Appendix>,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "sheet_coordinate.ts", rename_all = "camelCase")]
pub struct SheetCoordinate {
    pub row: usize,
    pub col: usize,
}
