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

/// One exported block row: the field values in schema (column) order. Wrapping
/// the row in a struct keeps the exported matrix as `BlockDataRow[]` rather
/// than a nested `Value[][]`, which the TS binding generator can't render.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "block_data_row.ts", rename_all = "camelCase")]
pub struct BlockDataRow {
    pub cells: Vec<crate::Value>,
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

/// A range that is linked to a backing block: the *source* range (the cells the
/// user references, e.g. `A1:A10`) resolved to sheet coordinates, plus the block
/// id it redirects to. The app draws an outer border around the source range.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "link_info.ts", rename_all = "camelCase")]
pub struct LinkInfo {
    pub sheet_idx: usize,
    pub block_id: BlockId,
    pub start_row: usize,
    pub start_col: usize,
    pub end_row: usize,
    pub end_col: usize,
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
    /// Raw value-formula template (e.g. `=#FIELD("qty")*#FIELD("price")`)
    /// or `None` for free-form fields. Engine-managed: writing a value
    /// to a templated cell is rejected.
    pub value_formula: Option<String>,
    /// Raw validation-formula template. Engine installs a
    /// `ShadowKind::Validation` shadow per row at bind / insert time;
    /// host UI reads the shadow to render warning markers.
    pub validation_formula: Option<String>,
    /// Raw editability-formula template. Engine installs a
    /// `ShadowKind::UserEditable` shadow per row at bind / insert time;
    /// host permission layer reads the shadow to gate writes.
    pub editability_formula: Option<String>,
}

#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "block_schema_random_entry.ts", rename_all = "camelCase")]
pub struct BlockSchemaRandomEntry {
    pub key: String,
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

/// An image placed in a cell. `data` is the base64-encoded image bytes and
/// `format` is the bare file extension (e.g. `png`). Used by the frontend to
/// render the image on the canvas at the cell's position.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "cell_image_info.ts", rename_all = "camelCase")]
pub struct CellImageInfo {
    pub row: usize,
    pub col: usize,
    pub id: String,
    pub format: String,
    pub data: String,
}

/// One data series of a chart, resolved for rendering. `values` holds the
/// cached numeric values (gaps are `null`); the frontend re-reads live values
/// from the source range and only falls back to these.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "chart_series_info.ts", rename_all = "camelCase")]
pub struct ChartSeriesInfo {
    pub name: Option<String>,
    pub values: Vec<Option<f64>>,
    /// Resolved fill color as an RGB/ARGB hex (no `#`), or `None` to use the
    /// renderer's default palette. Scheme colors are resolved against the theme.
    pub color: Option<String>,
}

/// A chart anchored on a sheet, resolved for rendering. The anchor is its
/// from/to cell positions plus EMU offsets into those cells; `chart_type` is
/// one of `col|bar|line|area|pie|doughnut|scatter`; `legend_pos` (if any) is
/// `top|bottom|left|right`.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "chart_info.ts", rename_all = "camelCase")]
pub struct ChartInfo {
    pub chart_id: String,
    pub from_row: usize,
    pub from_col: usize,
    pub from_col_off: i64,
    pub from_row_off: i64,
    pub to_row: usize,
    pub to_col: usize,
    pub to_col_off: i64,
    pub to_row_off: i64,
    pub chart_type: String,
    pub stacked: bool,
    pub title: Option<String>,
    pub legend_pos: Option<String>,
    pub categories: Vec<String>,
    pub series: Vec<ChartSeriesInfo>,
    pub cat_axis_title: Option<String>,
    pub val_axis_title: Option<String>,
}

/// A person referenced by a comment (author or mention). Enterprise builds
/// populate `user_id` + `provider_id` from their directory; the `src` app
/// leaves them `None` and only sets `display_name`.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "comment_person.ts", rename_all = "camelCase")]
pub struct CommentPerson {
    pub display_name: String,
    pub user_id: Option<String>,
    pub provider_id: Option<String>,
}

/// A resolved `@mention` span within a note's content.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "comment_mention_info.ts", rename_all = "camelCase")]
pub struct CommentMentionInfo {
    pub start: usize,
    pub len: usize,
    pub person: CommentPerson,
}

/// A single note in a comment thread (root or reply).
#[derive(Debug, Clone, TS)]
#[ts(file_name = "comment_note.ts", rename_all = "camelCase")]
pub struct CommentNote {
    pub id: String,
    pub author: CommentPerson,
    pub dt: String,
    pub content: String,
    pub parent_id: Option<String>,
    pub mentions: Vec<CommentMentionInfo>,
    pub resolved: bool,
}

/// A comment thread anchored at a cell. `notes` is ordered (root first, then
/// replies).
#[derive(Debug, Clone, TS)]
#[ts(file_name = "comment.ts", rename_all = "camelCase")]
pub struct Comment {
    pub row: usize,
    pub col: usize,
    pub notes: Vec<CommentNote>,
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

/// One cell that changed inside the active temp branch. `old_value` is
/// what's in the committed branch (the `fork_status` snapshot taken when
/// temp mode began); `new_value` is what the cell holds right now in the
/// live temp branch. Position is the *current* (post-temp) sheet row/col
/// — block inserts may shift earlier rows downward, so even cells that
/// didn't have a direct write may surface here with shifted positions.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "temp_cell_change.ts", rename_all = "camelCase")]
pub struct TempCellChange {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
    pub old_value: Value,
    pub new_value: Value,
}

/// Diff between the active temp branch and the committed branch.
/// Returned by `Workbook::get_temp_status_changes`; empty when no temp
/// branch is currently active.
#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "temp_status_diff.ts", rename_all = "camelCase")]
pub struct TempStatusDiff {
    pub cells: Vec<TempCellChange>,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "block_field.ts", rename_all = "camelCase")]
pub struct BlockField {
    pub sheet_id: SheetId,
    pub block_id: BlockId,
    pub field_id: String,
}
