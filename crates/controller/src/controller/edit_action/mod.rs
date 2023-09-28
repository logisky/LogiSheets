use logisheets_base::async_func::Task;
use serde::Serialize;

use self::style_payload::{StyleUpdate, StyleUpdateType};

mod converter;
pub mod style_payload;

pub type Converter<'a> = converter::Converter<'a>;

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(feature = "gents", ts(file_name = "edit_action.ts"))]
pub enum EditAction {
    Undo,
    Redo,
    Payloads(PayloadsAction),
}

/// A `PayloadsAction` contains one or more `EditPayload`. These `EditPayload`s will be withdrawn at
/// the same time if user undo it.
/// An `EditPayload` represents an atomic update of a workbook and they will be
/// executed in sequence. That means it is a totally different result between
/// updating a cell at B4 before inserting and after inserting.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "payloads_action.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct PayloadsAction {
    pub payloads: Vec<EditPayload>,
    pub undoable: bool,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(feature = "gents", ts(file_name = "payload.ts"))]
pub enum EditPayload {
    BlockInput(BlockInput),
    BlockStyleUpdate(BlockStyleUpdate),
    CellInput(CellInput),
    ColShift(ColShift),
    CreateBlock(CreateBlock),
    LineShiftInBlock(LineShiftInBlock),
    MoveBlock(MoveBlock),
    RemoveBlock(RemoveBlock),
    RowShift(RowShift),
    SetColWidth(SetColWidth),
    SetRowHeight(SetRowHeight),
    SetVisible(SetVisible),
    SheetRename(SheetRename),
    SheetShift(SheetShift),
    StyleUpdate(StyleUpdate),
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(feature = "gents", ts(file_name = "sheet_shift.ts"))]
pub struct SheetShift {
    pub idx: usize,
    pub insert: bool,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "sheet_rename.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct SheetRename {
    pub old_name: String,
    pub new_name: String,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "row_shift.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct RowShift {
    pub sheet_idx: usize,
    pub row: usize,
    pub count: usize,
    pub insert: bool,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "col_shift.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct ColShift {
    pub sheet_idx: usize,
    pub col: usize,
    pub count: usize,
    pub insert: bool,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "cell_input.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct CellInput {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
    pub content: String,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "create_block.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct CreateBlock {
    pub sheet_idx: usize,
    pub id: usize,
    pub master_row: usize,
    pub master_col: usize,
    pub row_cnt: usize,
    pub col_cnt: usize,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "set_row_height.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct SetRowHeight {
    pub sheet_idx: usize,
    pub row: usize,
    pub height: f64,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "set_col_width.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct SetColWidth {
    pub sheet_idx: usize,
    pub col: usize,
    pub width: f64,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "move_block.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct MoveBlock {
    pub sheet_idx: usize,
    pub id: usize,
    pub new_master_row: usize,
    pub new_master_col: usize,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "remove_block.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct RemoveBlock {
    pub sheet_idx: usize,
    pub id: usize,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "block_input.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct BlockInput {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub row: usize,
    pub col: usize,
    pub input: String,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "line_shift_in_block.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct LineShiftInBlock {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub idx: usize,
    pub cnt: usize,
    pub horizontal: bool,
    pub insert: bool,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "block_style_update.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct BlockStyleUpdate {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub row: usize,
    pub col: usize,
    pub style_update: StyleUpdateType,
}

#[derive(Default, Debug, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "set_visible.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct SetVisible {
    pub is_row: bool,
    pub sheet_idx: usize,
    pub start: usize,
    pub visible: bool,
}

#[derive(Default, Debug, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "action_effect.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct ActionEffect {
    // The latest version after processing an action
    pub version: u32,
    // Tasks should be calculated outside this engine(because of async limitted)
    pub async_tasks: Vec<Task>,
}
