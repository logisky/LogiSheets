use logisheets_base::{BlockId, DiyCellId};

use crate::{Appendix, Style, Value};

#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "save_file_result.ts")
)]
pub struct SaveFileResult {
    pub data: Vec<u8>,
    pub code: u8,
}

#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "cell_info.ts")
)]
#[derive(Debug, Clone)]
pub struct CellInfo {
    pub value: Value,
    pub formula: String,
    pub style: Style,
    pub block_id: Option<BlockId>,
    pub diy_cell_id: Option<DiyCellId>,
}

#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "sheet_dimension.ts")
)]
#[derive(Debug, Clone)]
pub struct SheetDimension {
    pub max_row: usize,
    pub max_col: usize,
    pub height: f64,
    pub width: f64,
}

#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "cell_with_coordinate.ts")
)]
#[derive(Debug, Clone)]
pub struct ReproducibleCell {
    pub coordinate: SheetCoordinate,
    pub formula: String,
    pub value: Value,
    pub style: Style,
    pub appendix: Vec<Appendix>,
}

#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "sheet_coordinate.ts")
)]
#[derive(Debug, Clone)]
pub struct SheetCoordinate {
    pub row: usize,
    pub col: usize,
}
