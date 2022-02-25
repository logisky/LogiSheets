use controller_base::BlockId;
use serde::Serialize;
use xlrs_workbook::styles::*;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayResponse {
    pub patches: Vec<DisplayPatch>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DisplayPatch {
    Values(SheetValues),
    Styles(SheetStyles),
    RowInfo(SheetRowInfo),
    ColInfo(SheetColInfo),
    MergeCells(SheetMergeCells),
    Comments(SheetComments),
    Blocks(SheetBlocks),
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SheetBlocks {
    pub sheet_idx: usize,
    pub blocks: Vec<BlockInfo>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockInfo {
    pub block_id: BlockId,
    pub row_start: usize,
    pub row_cnt: usize,
    pub col_start: usize,
    pub col_cnt: usize,
}

#[derive(Debug, Clone)]
pub struct DisplayRequest {
    pub sheet_idx: usize,
    pub version: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SheetMergeCells {
    pub sheet_idx: usize,
    pub merge_cells: Vec<MergeCell>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SheetComments {
    pub sheet_idx: usize,
    pub comments: Vec<Comment>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeCell {
    pub row_start: usize,
    pub col_start: usize,
    pub row_end: usize,
    pub col_end: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Comment {
    pub row: usize,
    pub col: usize,
    pub author: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SheetRowInfo {
    pub sheet_idx: usize,
    pub info: Vec<RowInfo>,
    pub default_height: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RowInfo {
    pub idx: usize,
    pub height: f64,
    pub hidden: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SheetColInfo {
    pub sheet_idx: usize,
    pub info: Vec<ColInfo>,
    pub default_width: f64,
}

#[derive(Debug, Clone, Serialize)]
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Style {
    pub font: Font,
    pub fill: Fill,
    pub border: Border,
    pub alignment: Option<CellAlignment>,
    pub protection: Option<CellProtection>,
    pub formatter: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Value {
    Str(String),
    Bool(bool),
    Number(f64),
    Error(String),
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CellFormulaValue {
    pub row: usize,
    pub col: usize,
    pub formula: String,
    pub value: Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SheetValues {
    pub sheet_idx: usize,
    pub values: Vec<CellFormulaValue>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CellStyle {
    pub row: usize,
    pub col: usize,
    pub style: Style,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SheetStyles {
    pub sheet_idx: usize,
    pub styles: Vec<CellStyle>,
}
