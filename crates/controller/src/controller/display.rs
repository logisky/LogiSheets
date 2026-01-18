use crate::CellInfo;

use super::style::Style;
use gents_derives::TS;
use logisheets_base::{BlockId, SheetId};

use crate::block_manager::schema_manager::schema::RenderId;

#[derive(Debug, Clone, TS)]
#[ts(file_name = "cell_position.ts", rename_all = "camelCase")]
pub struct CellPosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "cell_coordinate.ts", rename_all = "camelCase")]
pub struct CellCoordinate {
    pub x: usize,
    pub y: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "cell_coordinate_with_sheet.ts", rename_all = "camelCase")]
pub struct CellCoordinateWithSheet {
    pub sheet_idx: usize,
    pub coordinate: CellCoordinate,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "shadow_cell_info.ts", rename_all = "camelCase")]
pub struct ShadowCellInfo {
    pub start_position: CellPosition,
    pub end_position: CellPosition,
    pub value: Value,
}

#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "display_window.ts", rename_all = "camelCase")]
pub struct DisplayWindow {
    pub cells: Vec<CellInfo>,
    pub rows: Vec<RowInfo>,
    pub cols: Vec<ColInfo>,
    pub comments: Vec<Comment>,
    pub merge_cells: Vec<MergeCell>,
    pub blocks: Vec<BlockDisplayInfo>,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "block_display_info.ts", rename_all = "camelCase")]
pub struct BlockDisplayInfo {
    pub info: BlockInfo,
    pub start_position: CellPosition,
    pub end_position: CellPosition,
}

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "display_window_with_start_point.ts",
    rename_all = "camelCase"
)]
pub struct DisplayWindowWithStartPoint {
    pub window: DisplayWindow,
    pub start_x: f64,
    pub start_y: f64,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "sheet_names.ts", rename_all = "camelCase")]
pub struct SheetNames {
    pub names: Vec<String>,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "sheet_info.ts", rename_all = "camelCase")]
pub struct SheetInfo {
    pub name: String,
    pub id: SheetId,
    pub hidden: bool,
    pub tab_color: String,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "sheet_blocks.ts", rename_all = "camelCase")]
pub struct SheetBlocks {
    pub sheet_idx: usize,
    pub blocks: Vec<BlockInfo>,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "block_info.ts", rename_all = "camelCase")]
pub struct BlockInfo {
    pub sheet_idx: usize,
    pub sheet_id: SheetId,
    pub block_id: BlockId,
    pub row_start: usize,
    pub row_cnt: usize,
    pub col_start: usize,
    pub col_cnt: usize,
    pub schema: Option<BlockSchema>,
    pub field_renders: Vec<FieldRenderEntry>,
    pub cells: Vec<BlockCellInfo>,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "block_schema.ts", rename_all = "camelCase")]
pub struct BlockSchema {
    pub name: String,
    pub schema_type: BlockSchemaType,
    pub keys: Vec<BlockSchemaKeyEntry>,
    pub fields: Vec<BlockSchemaFieldEntry>,
    pub random_entries: Vec<BlockSchemaRandomEntry>,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "block_schema_type.ts", rename_all = "camelCase")]
pub enum BlockSchemaType {
    Row,
    Col,
    Random,
}

#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "block_schema_key_entry.ts", rename_all = "camelCase")]
pub struct BlockSchemaKeyEntry {
    pub key: String,
    pub idx: usize,
}

#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "block_schema_field_entry.ts", rename_all = "camelCase")]
pub struct BlockSchemaFieldEntry {
    pub field: String,
    pub idx: usize,
    pub render_id: RenderId,
}

#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "block_schema_random_entry.ts", rename_all = "camelCase")]
pub struct BlockSchemaRandomEntry {
    pub key: String,
    pub field: String,
    pub row: usize,
    pub col: usize,
    pub render_id: RenderId,
}

#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "field_render_entry.ts", rename_all = "camelCase")]
pub struct FieldRenderEntry {
    pub render_id: RenderId,
    pub style: Option<Style>,
    pub diy_render: bool,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "block_cell_info.ts", rename_all = "camelCase")]
pub struct BlockCellInfo {
    pub value: Value,
    // None means that no shadow cell has been created
    pub shadow_value: Option<Value>,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "display_window_request.ts", rename_all = "camelCase")]
pub struct DisplayWindowRequest {
    pub sheet_idx: usize,
    pub height: f64,
    pub width: f64,
    pub start_x: f64,
    pub start_y: f64,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "sheet_merge_cells.ts", rename_all = "camelCase")]
pub struct SheetMergeCells {
    pub sheet_idx: usize,
    pub merge_cells: Vec<MergeCell>,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "sheet_comments.ts", rename_all = "camelCase")]
pub struct SheetComments {
    pub sheet_idx: usize,
    pub comments: Vec<Comment>,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "merge_cell.ts", rename_all = "camelCase")]
pub struct MergeCell {
    pub start_row: usize,
    pub start_col: usize,
    pub end_row: usize,
    pub end_col: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "comment.ts", rename_all = "camelCase")]
pub struct Comment {
    pub row: usize,
    pub col: usize,
    pub author: String,
    pub content: String,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "sheet_row_info.ts", rename_all = "camelCase")]
pub struct SheetRowInfo {
    pub sheet_idx: usize,
    pub info: Vec<RowInfo>,
    pub default_height: f64,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "row_info.ts", rename_all = "camelCase")]
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

#[derive(Debug, Clone, TS)]
#[ts(file_name = "sheet_col_info.ts", rename_all = "camelCase")]
pub struct SheetColInfo {
    pub sheet_idx: usize,
    pub info: Vec<ColInfo>,
    pub default_width: f64,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "col_info.ts", rename_all = "camelCase")]
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

#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "value.ts", tag = "type")]
pub enum Value {
    Str(String),
    Bool(bool),
    Number(f64),
    Error(String),
    #[default]
    Empty,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "cell_formula_value.ts", rename_all = "camelCase")]
pub struct CellFormulaValue {
    pub row: usize,
    pub col: usize,
    pub formula: String,
    pub value: Value,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "sheet_values.ts", rename_all = "camelCase")]
pub struct SheetValues {
    pub sheet_idx: usize,
    pub values: Vec<CellFormulaValue>,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "cell_style.ts", rename_all = "camelCase")]
pub struct CellStyle {
    pub row: usize,
    pub col: usize,
    pub style: Style,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "sheet_styles.ts", rename_all = "camelCase")]
pub struct SheetStyles {
    pub sheet_idx: usize,
    pub styles: Vec<CellStyle>,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "block_field.ts", rename_all = "camelCase")]
pub struct BlockField {
    pub sheet_id: SheetId,
    pub block_id: BlockId,
    pub field_id: String,
}
