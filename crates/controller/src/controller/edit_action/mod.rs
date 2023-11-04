use logisheets_base::async_func::Task;

use self::style_payload::{StyleUpdate, StyleUpdateType};

mod converter;
pub mod style_payload;

pub type Converter<'a> = converter::Converter<'a>;

/// `EditAction` represents your update behavior to the workbook.
#[derive(Debug)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "edit_action.ts")
)]
pub enum EditAction {
    Undo,
    Redo,
    Payloads(PayloadsAction),
}

/// A `PayloadsAction` contains one or more `EditPayload`.
/// These `EditPayload`s will be withdrawn at the same time if user undo it.
/// And if one of the payload is failed to be executed, this `EditAction` will
/// not do anything at all.
///
/// An `EditPayload` represents an atomic update of a workbook and they will be
/// executed in sequence. That means it is a totally different result between
/// updating a cell at B4 before inserting and after inserting.
#[derive(Debug)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "payloads_action.ts")
)]
pub struct PayloadsAction {
    pub payloads: Vec<EditPayload>,
    pub undoable: bool,
}

/// `EditPayload` is the basic update unit of the Workbook. Developers can config their own
/// `EditAction` (e.g. setting a button to create a table) to facilitate their users.
#[derive(Debug)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "payload.ts")
)]
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

/// Insert a new sheet or delele an existed sheet.
#[derive(Debug)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "sheet_shift.ts")
)]
pub struct SheetShift {
    pub idx: usize,
    pub insert: bool,
}

/// Find a sheet by its name and rename it. If no sheet is found, do nothing.
#[derive(Debug)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "sheet_rename.ts")
)]
pub struct SheetRename {
    pub old_name: String,
    pub new_name: String,
}

#[derive(Debug)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "row_shift.ts")
)]
pub struct RowShift {
    pub sheet_idx: usize,
    pub row: usize,
    pub count: usize,
    pub insert: bool,
}

#[derive(Debug)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "col_shift.ts")
)]
pub struct ColShift {
    pub sheet_idx: usize,
    pub col: usize,
    pub count: usize,
    pub insert: bool,
}

/// Take the `content` as input to the cell. The type of the `content` can be referred automatically.
#[derive(Debug)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "cell_input.ts")
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
#[derive(Debug)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "create_block.ts")
)]
pub struct CreateBlock {
    pub sheet_idx: usize,
    pub id: usize,
    pub master_row: usize,
    pub master_col: usize,
    pub row_cnt: usize,
    pub col_cnt: usize,
}

#[derive(Debug)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "set_row_height.ts")
)]
pub struct SetRowHeight {
    pub sheet_idx: usize,
    pub row: usize,
    pub height: f64,
}

#[derive(Debug)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "set_col_width.ts")
)]
pub struct SetColWidth {
    pub sheet_idx: usize,
    pub col: usize,
    pub width: f64,
}

#[derive(Debug)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "move_block.ts")
)]
pub struct MoveBlock {
    pub sheet_idx: usize,
    pub id: usize,
    pub new_master_row: usize,
    pub new_master_col: usize,
}

#[derive(Debug)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "remove_block.ts")
)]
pub struct RemoveBlock {
    pub sheet_idx: usize,
    pub id: usize,
}

#[derive(Debug)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "block_input.ts")
)]
pub struct BlockInput {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub row: usize,
    pub col: usize,
    pub input: String,
}

#[derive(Debug)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "line_shift_in_block.ts")
)]
pub struct LineShiftInBlock {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub idx: usize,
    pub cnt: usize,
    pub horizontal: bool,
    pub insert: bool,
}

#[derive(Debug)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "block_style_update.ts")
)]
pub struct BlockStyleUpdate {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub row: usize,
    pub col: usize,
    pub style_update: StyleUpdateType,
}

#[derive(Default, Debug)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "set_visible.ts")
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
#[derive(Default, Debug)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "action_effect.ts")
)]
pub struct ActionEffect {
    /// The latest version after processing an action
    pub version: u32,
    /// Tasks should be calculated outside this engine(because of async limitted)
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
#[derive(Default, Debug)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "async_func_result.ts")
)]
pub struct AsyncFuncResult {
    pub tasks: Vec<Task>,
    /// These strings can be numbers, strings and other things.
    /// Note that now error types are hardcoded, which means if the
    /// value is equal to the a specific string like `#TIMEOUT!`,
    /// it is reagarded as an error.
    pub values: Vec<String>,
}

#[derive(Debug)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "status_code.ts")
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
