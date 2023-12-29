use logisheets_base::{async_func::Task, CellId, SheetId};
use serde::{Deserialize, Serialize};

pub trait Payload: Into<EditPayload> {}

/// `EditAction` represents your update behavior to the workbook.
#[derive(Debug)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "edit_action.ts", rename_all = "camelCase")
)]
pub enum EditAction {
    Undo,
    Redo,
    Payloads(PayloadsAction),
    Recalc(Vec<RecalcCell>),
}

#[derive(Debug)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "recalc_cell.ts", rename_all = "camelCase")
)]
pub struct RecalcCell {
    pub sheet_id: SheetId,
    pub cell_id: CellId,
}

impl EditAction {
    pub fn undo() -> Self {
        Self::Undo
    }

    pub fn redo() -> Self {
        Self::Redo
    }
}

impl From<PayloadsAction> for EditAction {
    fn from(value: PayloadsAction) -> Self {
        EditAction::Payloads(value)
    }
}

/// A `PayloadsAction` contains one or more `EditPayload`.
/// These `EditPayload`s will be withdrawn at the same time if user undo it.
/// And if one of the payload is failed to be executed, this `EditAction` will
/// not do anything at all.
///
/// An `EditPayload` represents an atomic update of a workbook and they will be
/// executed in sequence. That means it is a totally different result between
/// updating a cell at B4 before inserting and after inserting.
#[derive(Debug, Clone)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "payloads_action.ts", rename_all = "camelCase")
)]
pub struct PayloadsAction {
    pub payloads: Vec<EditPayload>,
    pub undoable: bool,
}

impl PayloadsAction {
    pub fn new(undoable: bool) -> Self {
        PayloadsAction {
            payloads: vec![],
            undoable,
        }
    }

    pub fn add_payload<P: Payload>(mut self, payload: P) -> Self {
        self.payloads.push(payload.into());
        self
    }
}

/// `EditPayload` is the basic update unit of the Workbook. Developers can config their own
/// `EditAction` (e.g. setting a button to create a table) to facilitate their users.
#[derive(Debug, Clone)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "edit_payload.ts", rename_all = "camelCase")
)]
pub enum EditPayload {
    // Block
    BlockInput(BlockInput),
    MoveBlock(MoveBlock),
    RemoveBlock(RemoveBlock),
    CreateBlock(CreateBlock),

    // Style
    StyleUpdate(StyleUpdate),
    BlockStyleUpdate(BlockStyleUpdate),

    CellInput(CellInput),
    SetColWidth(SetColWidth),
    SetRowHeight(SetRowHeight),
    SetVisible(SetVisible),
    // Sheet
    SheetRename(SheetRename),
    CreateSheet(CreateSheet),
    DeleteSheet(DeleteSheet),
    // Shifting
    InsertCols(InsertCols),
    DeleteCols(DeleteCols),
    InsertRows(InsertRows),
    DeleteRows(DeleteRows),
    InsertColsInBlock(InsertColsInBlock),
    DeleteColsInBlock(DeleteColsInBlock),
    InsertRowsInBlock(InsertRowsInBlock),
    DeleteRowsInBlock(DeleteRowsInBlock),
}

#[derive(Debug, Clone)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "create_sheet.ts", rename_all = "camelCase")
)]
pub struct CreateSheet {
    pub idx: usize,
    pub new_name: String,
}

#[derive(Debug, Clone)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "delete_sheet.ts", rename_all = "camelCase")
)]
pub struct DeleteSheet {
    pub idx: usize,
}

/// Find a sheet by its name and rename it. If no sheet is found, do nothing.
#[derive(Debug, Clone)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "sheet_rename.ts", rename_all = "camelCase")
)]
pub struct SheetRename {
    pub old_name: Option<String>,
    pub idx: Option<usize>,
    pub new_name: String,
}

#[derive(Debug, Clone)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "delete_rows.ts", rename_all = "camelCase")
)]
pub struct DeleteRows {
    pub sheet_idx: usize,
    pub start: usize,
    pub count: usize,
}

#[derive(Debug, Clone)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "insert_rows.ts", rename_all = "camelCase")
)]
pub struct InsertRows {
    pub sheet_idx: usize,
    pub start: usize,
    pub count: usize,
}

#[derive(Debug, Clone)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "delete_cols.ts", rename_all = "camelCase")
)]
pub struct DeleteCols {
    pub sheet_idx: usize,
    pub start: usize,
    pub count: usize,
}

#[derive(Debug, Clone)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "insert_cols.ts", rename_all = "camelCase")
)]
pub struct InsertCols {
    pub sheet_idx: usize,
    pub start: usize,
    pub count: usize,
}

/// Take the `content` as input to the cell. The type of the `content` can be referred automatically.
#[derive(Debug, Clone)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "cell_input.ts", rename_all = "camelCase")
)]
pub struct CellInput {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
    pub content: String,
}

/// Create a new block.
///
/// Note that the block id is assigned by you. You are supposed to
/// manage all your blocks. If the `block id` is already existed, engines
/// will remove the old one.
#[derive(Debug, Clone)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "create_block.ts", rename_all = "camelCase")
)]
pub struct CreateBlock {
    pub sheet_idx: usize,
    pub id: usize,
    pub master_row: usize,
    pub master_col: usize,
    pub row_cnt: usize,
    pub col_cnt: usize,
}

#[derive(Debug, Clone)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "set_row_height.ts", rename_all = "camelCase")
)]
pub struct SetRowHeight {
    pub sheet_idx: usize,
    pub row: usize,
    pub height: f64,
}

#[derive(Debug, Clone)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "set_col_width.ts", rename_all = "camelCase")
)]
pub struct SetColWidth {
    pub sheet_idx: usize,
    pub col: usize,
    pub width: f64,
}

#[derive(Debug, Clone)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "move_block.ts", rename_all = "camelCase")
)]
pub struct MoveBlock {
    pub sheet_idx: usize,
    pub id: usize,
    pub new_master_row: usize,
    pub new_master_col: usize,
}

#[derive(Debug, Clone)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "remove_block.ts", rename_all = "camelCase")
)]
pub struct RemoveBlock {
    pub sheet_idx: usize,
    pub id: usize,
}

#[derive(Debug, Clone)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "block_input.ts", rename_all = "camelCase")
)]
pub struct BlockInput {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub row: usize,
    pub col: usize,
    pub input: String,
}

impl From<BlockInput> for EditPayload {
    fn from(value: BlockInput) -> Self {
        EditPayload::BlockInput(value)
    }
}

#[derive(Debug, Clone)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "delete_rows_in_block.ts", rename_all = "camelCase")
)]
pub struct DeleteRowsInBlock {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub start: usize,
    pub cnt: usize,
}

#[derive(Debug, Clone)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "insert_rows_in_block.ts", rename_all = "camelCase")
)]
pub struct InsertRowsInBlock {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub start: usize,
    pub cnt: usize,
}

#[derive(Debug, Clone)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "insert_cols_in_block.ts", rename_all = "camelCase")
)]
pub struct InsertColsInBlock {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub start: usize,
    pub cnt: usize,
}

#[derive(Debug, Clone)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "delete_cols_in_block.ts", rename_all = "camelCase")
)]
pub struct DeleteColsInBlock {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub start: usize,
    pub cnt: usize,
}

#[derive(Debug, Clone)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "block_style_update.ts", rename_all = "camelCase")
)]
pub struct BlockStyleUpdate {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub row: usize,
    pub col: usize,
    pub style_update: StyleUpdateType,
}

#[derive(Default, Debug, Clone)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "set_visible.ts", rename_all = "camelCase")
)]
pub struct SetVisible {
    pub is_row: bool,
    pub sheet_idx: usize,
    pub start: usize,
    pub visible: bool,
}

/// `ActionEffect` represents the result of handling `EditAction`.
/// `version` would be increased if the action is successfully handled.
///
/// What's more, since `LogiSheets` provides developers with the ability
/// of developing their own functions, in these cases, `engine` will not know
/// how to compute them and just return it the JS side.
#[derive(Default, Debug, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "action_effect.ts", rename_all = "camelCase")
)]
pub struct ActionEffect {
    /// The latest version after processing an action
    pub version: u32,
    /// Tasks should be calculated outside this engine(mainly because of network limitations and customer defined)
    pub async_tasks: Vec<Task>,
    pub status: StatusCode,
}

impl ActionEffect {
    pub fn from_bool(b: bool) -> Self {
        ActionEffect {
            status: StatusCode::Ok(b),
            ..Default::default()
        }
    }

    pub fn from_err(e: u8) -> Self {
        ActionEffect {
            status: StatusCode::Err(e),
            ..Default::default()
        }
    }

    pub fn from(version: u32, tasks: Vec<Task>) -> Self {
        ActionEffect {
            version,
            async_tasks: tasks,
            status: StatusCode::Ok(true),
        }
    }
}

/// The results of the tasks which are passed to JS side to calculate previously.
#[derive(Default, Debug, Deserialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "async_func_result.ts", rename_all = "camelCase")
)]
pub struct AsyncFuncResult {
    pub tasks: Vec<Task>,
    /// These strings can be numbers, strings and other things.
    /// Note that now error types are hardcoded, which means if the
    /// value is equal to the a specific string like `#TIMEOUT!`,
    /// it is reagarded as an error.
    pub values: Vec<String>,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "status_code.ts", rename_all = "camelCase")
)]
pub enum StatusCode {
    Ok(bool), // when there is no other history version for undo/redo, return false.
    Err(u8),
}

impl Default for StatusCode {
    fn default() -> Self {
        Self::Ok(true)
    }
}

use crate::controller::style::PatternFill;
use logisheets_workbook::prelude::*;

#[derive(Debug, Clone)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "style_update.ts", rename_all = "camelCase")
)]
pub struct StyleUpdate {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
    pub ty: StyleUpdateType,
}

pub type Color = String;

#[derive(Debug, Clone)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "style_update_type.ts", rename_all = "camelCase")
)]
pub struct StyleUpdateType {
    pub set_font_bold: Option<bool>,
    pub set_font_italic: Option<bool>,
    pub set_font_underline: Option<StUnderlineValues>,
    pub set_font_color: Option<Color>,
    pub set_font_size: Option<f64>,
    pub set_font_name: Option<String>,
    pub set_font_outline: Option<bool>,
    pub set_font_shadow: Option<bool>,
    pub set_font_strike: Option<bool>,
    pub set_font_condense: Option<bool>,
    pub set_left_border_color: Option<Color>,
    pub set_right_border_color: Option<Color>,
    pub set_top_border_color: Option<Color>,
    pub set_bottom_border_color: Option<Color>,
    pub set_left_border_style: Option<StBorderStyle>,
    pub set_right_border_style: Option<StBorderStyle>,
    pub set_top_border_style: Option<StBorderStyle>,
    pub set_bottom_border_style: Option<StBorderStyle>,
    pub set_border_giagonal_up: Option<bool>,
    pub set_border_giagonal_down: Option<bool>,
    pub set_border_outline: Option<bool>,
    pub set_pattern_fill: Option<PatternFill>,
}

impl From<BlockStyleUpdate> for EditPayload {
    fn from(value: BlockStyleUpdate) -> Self {
        EditPayload::BlockStyleUpdate(value)
    }
}
impl From<CellInput> for EditPayload {
    fn from(value: CellInput) -> Self {
        EditPayload::CellInput(value)
    }
}
impl From<CreateBlock> for EditPayload {
    fn from(value: CreateBlock) -> Self {
        EditPayload::CreateBlock(value)
    }
}
impl From<MoveBlock> for EditPayload {
    fn from(value: MoveBlock) -> Self {
        EditPayload::MoveBlock(value)
    }
}
impl From<RemoveBlock> for EditPayload {
    fn from(value: RemoveBlock) -> Self {
        EditPayload::RemoveBlock(value)
    }
}
impl From<SetColWidth> for EditPayload {
    fn from(value: SetColWidth) -> Self {
        EditPayload::SetColWidth(value)
    }
}
impl From<SetRowHeight> for EditPayload {
    fn from(value: SetRowHeight) -> Self {
        EditPayload::SetRowHeight(value)
    }
}
impl From<SetVisible> for EditPayload {
    fn from(value: SetVisible) -> Self {
        EditPayload::SetVisible(value)
    }
}
impl From<SheetRename> for EditPayload {
    fn from(value: SheetRename) -> Self {
        EditPayload::SheetRename(value)
    }
}
impl From<StyleUpdate> for EditPayload {
    fn from(value: StyleUpdate) -> Self {
        EditPayload::StyleUpdate(value)
    }
}
impl From<InsertCols> for EditPayload {
    fn from(value: InsertCols) -> Self {
        EditPayload::InsertCols(value)
    }
}
impl From<InsertRows> for EditPayload {
    fn from(value: InsertRows) -> Self {
        EditPayload::InsertRows(value)
    }
}
impl From<DeleteRows> for EditPayload {
    fn from(value: DeleteRows) -> Self {
        EditPayload::DeleteRows(value)
    }
}
impl From<DeleteCols> for EditPayload {
    fn from(value: DeleteCols) -> Self {
        EditPayload::DeleteCols(value)
    }
}

impl From<InsertColsInBlock> for EditPayload {
    fn from(value: InsertColsInBlock) -> Self {
        EditPayload::InsertColsInBlock(value)
    }
}
impl From<InsertRowsInBlock> for EditPayload {
    fn from(value: InsertRowsInBlock) -> Self {
        EditPayload::InsertRowsInBlock(value)
    }
}

impl From<DeleteRowsInBlock> for EditPayload {
    fn from(value: DeleteRowsInBlock) -> Self {
        EditPayload::DeleteRowsInBlock(value)
    }
}

impl From<DeleteColsInBlock> for EditPayload {
    fn from(value: DeleteColsInBlock) -> Self {
        EditPayload::DeleteColsInBlock(value)
    }
}

impl From<CreateSheet> for EditPayload {
    fn from(value: CreateSheet) -> Self {
        EditPayload::CreateSheet(value)
    }
}

impl From<DeleteSheet> for EditPayload {
    fn from(value: DeleteSheet) -> Self {
        EditPayload::DeleteSheet(value)
    }
}

impl Payload for BlockInput {}
impl Payload for BlockStyleUpdate {}
impl Payload for CellInput {}
impl Payload for CreateBlock {}
impl Payload for MoveBlock {}
impl Payload for RemoveBlock {}
impl Payload for SetColWidth {}
impl Payload for SetRowHeight {}
impl Payload for SetVisible {}
impl Payload for SheetRename {}
impl Payload for CreateSheet {}
impl Payload for DeleteSheet {}
impl Payload for StyleUpdate {}
impl Payload for InsertCols {}
impl Payload for InsertRows {}
impl Payload for DeleteCols {}
impl Payload for DeleteRows {}
impl Payload for InsertColsInBlock {}
impl Payload for InsertRowsInBlock {}
impl Payload for DeleteColsInBlock {}
impl Payload for DeleteRowsInBlock {}
