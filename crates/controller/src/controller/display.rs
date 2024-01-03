use super::style::Style;
use logisheets_base::BlockId;
use serde::Serialize;

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "display_response.ts")
)]
pub struct DisplayResponse {
    pub incremental: bool,
    pub patches: Vec<DisplayPatch>,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "display_patch.ts")
)]
pub enum DisplayPatch {
    Values(SheetValues),
    Styles(SheetStyles),
    RowInfo(SheetRowInfo),
    ColInfo(SheetColInfo),
    MergeCells(SheetMergeCells),
    Comments(SheetComments),
    Blocks(SheetBlocks),
    SheetNames(SheetNames),
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "sheet_names.ts")
)]
pub struct SheetNames {
    pub names: Vec<String>,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "sheet_blocks.ts")
)]
pub struct SheetBlocks {
    pub sheet_idx: usize,
    pub blocks: Vec<BlockInfo>,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "block_info.ts")
)]
pub struct BlockInfo {
    pub block_id: BlockId,
    pub row_start: usize,
    pub row_cnt: usize,
    pub col_start: usize,
    pub col_cnt: usize,
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "display_request.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct DisplayRequest {
    pub sheet_idx: usize,
    pub version: u32,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "sheet_merge_cells.ts")
)]
pub struct SheetMergeCells {
    pub sheet_idx: usize,
    pub merge_cells: Vec<MergeCell>,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "sheet_comments.ts")
)]
pub struct SheetComments {
    pub sheet_idx: usize,
    pub comments: Vec<Comment>,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "merge_cell.ts")
)]
pub struct MergeCell {
    pub row_start: usize,
    pub col_start: usize,
    pub row_end: usize,
    pub col_end: usize,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "comment.ts")
)]
pub struct Comment {
    pub row: usize,
    pub col: usize,
    pub author: String,
    pub content: String,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "sheet_row_info.ts")
)]
pub struct SheetRowInfo {
    pub sheet_idx: usize,
    pub info: Vec<RowInfo>,
    pub default_height: f64,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "row_info.ts")
)]
pub struct RowInfo {
    pub idx: usize,
    pub height: f64,
    pub hidden: bool,
}

impl RowInfo {
    pub fn default(idx: usize) -> RowInfo {
        Self {
            idx,
            height: get_default_row_height(),
            hidden: false,
        }
    }
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "sheet_col_info.ts")
)]
pub struct SheetColInfo {
    pub sheet_idx: usize,
    pub info: Vec<ColInfo>,
    pub default_width: f64,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "col_info.ts")
)]
pub struct ColInfo {
    pub idx: usize,
    pub width: f64,
    pub hidden: bool,
}

impl ColInfo {
    pub fn default(idx: usize) -> Self {
        Self {
            idx,
            width: get_default_col_width(),
            hidden: false,
        }
    }
}

pub fn get_default_row_height() -> f64 {
    15.
}

pub fn get_default_col_width() -> f64 {
    8.43
}

#[derive(Debug, Clone, Default)]
#[cfg_attr(feature = "gents", gents_derives::gents_header(file_name = "value.ts"))]
pub enum Value {
    Str(String),
    Bool(bool),
    Number(f64),
    Error(String),
    #[default]
    Empty,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "cell_formula_value.ts")
)]
pub struct CellFormulaValue {
    pub row: usize,
    pub col: usize,
    pub formula: String,
    pub value: Value,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "sheet_values.ts")
)]
pub struct SheetValues {
    pub sheet_idx: usize,
    pub values: Vec<CellFormulaValue>,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "cell_style.ts")
)]
pub struct CellStyle {
    pub row: usize,
    pub col: usize,
    pub style: Style,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "sheet_styles.ts")
)]
pub struct SheetStyles {
    pub sheet_idx: usize,
    pub styles: Vec<CellStyle>,
}
