use serde::Serialize;
use xlrs_workbook::styles::*;

#[derive(Debug, Clone, Serialize)]
pub struct DisplayResponse {
    pub patches: Vec<DisplayPatch>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum DisplayPatch {
    Values(SheetValues),
    Styles(SheetStyles),
    RowInfo(SheetRowInfo),
    ColInfo(SheetColInfo),
    MergeCells(SheetMergeCells),
    Comments(SheetComments),
}

#[derive(Debug, Clone)]
pub struct DisplayRequest {
    pub sheet_idx: usize,
    pub version: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct SheetMergeCells {
    pub sheet_idx: usize,
    pub merge_cells: Vec<MergeCell>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SheetComments {
    pub sheet_idx: usize,
    pub comments: Vec<Comment>,
}

#[derive(Debug, Clone, Serialize)]
pub struct MergeCell {
    pub row_start: usize,
    pub col_start: usize,
    pub row_end: usize,
    pub col_end: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct Comment {
    pub row: usize,
    pub col: usize,
    pub author: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SheetRowInfo {
    pub sheet_idx: usize,
    pub info: Vec<RowInfo>,
    pub default_height: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct RowInfo {
    pub idx: usize,
    pub height: f64,
    pub hidden: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct SheetColInfo {
    pub sheet_idx: usize,
    pub info: Vec<ColInfo>,
    pub default_width: f64,
}

#[derive(Debug, Clone, Serialize)]
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
pub struct Style {
    pub font: Font,
    pub fill: Fill,
    pub border: Border,
    pub alignment: Option<CellAlignment>,
    pub protection: Option<CellProtection>,
    pub formatter: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "vt")]
pub enum Value {
    Text(String),
    Boolean(bool),
    Number(f64),
    Error(String),
}

#[derive(Debug, Clone, Serialize)]
pub struct CellFormulaValue {
    pub row: usize,
    pub col: usize,
    pub formula: String,
    pub value: Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct SheetValues {
    pub sheet_idx: usize,
    pub values: Vec<CellFormulaValue>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CellStyle {
    pub row: usize,
    pub col: usize,
    pub style: Style,
}

#[derive(Debug, Clone, Serialize)]
pub struct SheetStyles {
    pub sheet_idx: usize,
    pub styles: Vec<CellStyle>,
}
