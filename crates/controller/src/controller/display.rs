use logisheets_base::BlockId;
use logisheets_workbook::prelude::*;
use serde::Serialize;

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/display_response.ts")]
#[serde(rename_all = "camelCase")]
pub struct DisplayResponse {
    pub patches: Vec<DisplayPatch>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/display_patch.ts")]
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

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/sheet_names.ts")]
#[serde(rename_all = "camelCase")]
pub struct SheetNames {
    pub names: Vec<String>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/sheet_blocks.ts")]
#[serde(rename_all = "camelCase")]
pub struct SheetBlocks {
    pub sheet_idx: usize,
    pub blocks: Vec<BlockInfo>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/block_info.ts")]
#[serde(rename_all = "camelCase")]
pub struct BlockInfo {
    pub block_id: BlockId,
    pub row_start: usize,
    pub row_cnt: usize,
    pub col_start: usize,
    pub col_cnt: usize,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/display_request.ts")]
#[serde(rename_all = "camelCase")]
pub struct DisplayRequest {
    pub sheet_idx: usize,
    pub version: u32,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/sheet_merge_cells.ts")]
#[serde(rename_all = "camelCase")]
pub struct SheetMergeCells {
    pub sheet_idx: usize,
    pub merge_cells: Vec<MergeCell>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/sheet_comments.ts")]
#[serde(rename_all = "camelCase")]
pub struct SheetComments {
    pub sheet_idx: usize,
    pub comments: Vec<Comment>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/merge_cell.ts")]
#[serde(rename_all = "camelCase")]
pub struct MergeCell {
    pub row_start: usize,
    pub col_start: usize,
    pub row_end: usize,
    pub col_end: usize,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/comment.ts")]
#[serde(rename_all = "camelCase")]
pub struct Comment {
    pub row: usize,
    pub col: usize,
    pub author: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/sheet_row_info.ts")]
#[serde(rename_all = "camelCase")]
pub struct SheetRowInfo {
    pub sheet_idx: usize,
    pub info: Vec<RowInfo>,
    pub default_height: f64,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/row_info.ts")]
#[serde(rename_all = "camelCase")]
pub struct RowInfo {
    pub idx: usize,
    pub height: f64,
    pub hidden: bool,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../src/bindings/sheet_col_info.ts")]
pub struct SheetColInfo {
    pub sheet_idx: usize,
    pub info: Vec<ColInfo>,
    pub default_width: f64,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../src/bindings/col_info.ts")]
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

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export_to = "../../src/bindings/style.ts")]
#[serde(rename_all = "camelCase")]
pub struct Style {
    pub font: CtFont,
    pub fill: CtFill,
    pub border: CtBorder,
    pub alignment: Option<CtCellAlignment>,
    pub protection: Option<CtCellProtection>,
    pub formatter: String,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/value.ts")]
#[serde(rename_all = "camelCase")]
pub enum Value {
    Str(String),
    Bool(bool),
    Number(f64),
    Error(String),
    Empty,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/cell_formula_value.ts")]
#[serde(rename_all = "camelCase")]
pub struct CellFormulaValue {
    pub row: usize,
    pub col: usize,
    pub formula: String,
    pub value: Value,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/sheet_values.ts")]
#[serde(rename_all = "camelCase")]
pub struct SheetValues {
    pub sheet_idx: usize,
    pub values: Vec<CellFormulaValue>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/cell_style.ts")]
#[serde(rename_all = "camelCase")]
pub struct CellStyle {
    pub row: usize,
    pub col: usize,
    pub style: Style,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/sheet_styles.ts")]
#[serde(rename_all = "camelCase")]
pub struct SheetStyles {
    pub sheet_idx: usize,
    pub styles: Vec<CellStyle>,
}
