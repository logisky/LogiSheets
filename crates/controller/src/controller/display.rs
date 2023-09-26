use super::style::Style;
use logisheets_base::BlockId;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "display_response.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct DisplayResponse {
    pub incremental: bool,
    pub patches: Vec<DisplayPatch>,
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "display_patch.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
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

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "sheet_names.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct SheetNames {
    pub names: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "sheet_blocks.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct SheetBlocks {
    pub sheet_idx: usize,
    pub blocks: Vec<BlockInfo>,
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "block_info.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
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

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "sheet_merge_cells.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct SheetMergeCells {
    pub sheet_idx: usize,
    pub merge_cells: Vec<MergeCell>,
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "sheet_comments.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct SheetComments {
    pub sheet_idx: usize,
    pub comments: Vec<Comment>,
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "merge_cell.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct MergeCell {
    pub row_start: usize,
    pub col_start: usize,
    pub row_end: usize,
    pub col_end: usize,
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "comment.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct Comment {
    pub row: usize,
    pub col: usize,
    pub author: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "sheet_row_info.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct SheetRowInfo {
    pub sheet_idx: usize,
    pub info: Vec<RowInfo>,
    pub default_height: f64,
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "row_info.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct RowInfo {
    pub idx: usize,
    pub height: f64,
    pub hidden: bool,
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "sheet_col_info.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct SheetColInfo {
    pub sheet_idx: usize,
    pub info: Vec<ColInfo>,
    pub default_width: f64,
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "col_info.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct ColInfo {
    pub idx: usize,
    pub width: f64,
    pub hidden: bool,
}

pub fn get_default_row_height() -> f64 {
    14.25
}

pub fn get_default_col_width() -> f64 {
    8.38
}

#[derive(Debug, Clone, Serialize, Default)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "value.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub enum Value {
    Str(String),
    Bool(bool),
    Number(f64),
    Error(String),
    #[default]
    Empty,
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "cell_formula_value.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct CellFormulaValue {
    pub row: usize,
    pub col: usize,
    pub formula: String,
    pub value: Value,
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "sheet_values.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct SheetValues {
    pub sheet_idx: usize,
    pub values: Vec<CellFormulaValue>,
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "cell_style.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct CellStyle {
    pub row: usize,
    pub col: usize,
    pub style: Style,
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "sheet_styles.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct SheetStyles {
    pub sheet_idx: usize,
    pub styles: Vec<CellStyle>,
}
