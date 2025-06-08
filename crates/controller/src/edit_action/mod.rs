use logisheets_base::{async_func::Task, BlockId, CellId, EphemeralId, SheetId};

pub trait Payload: Into<EditPayload> {}

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
    Recalc(Vec<RecalcCell>),
}

#[derive(Debug)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "recalc_cell.ts")
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
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "payloads_action.ts")
)]
pub struct PayloadsAction {
    pub payloads: Vec<EditPayload>,
    pub undoable: bool,
    // An action that is used to customize the initial status of a new workbook.
    // This action is `undoable` but its new status should be recorded to hiistory.
    pub init: bool,
}

impl PayloadsAction {
    pub fn new() -> Self {
        PayloadsAction {
            payloads: vec![],
            undoable: false,
            init: false,
        }
    }

    pub fn set_undoable(mut self, v: bool) -> Self {
        self.undoable = v;
        self
    }

    pub fn set_init(mut self, v: bool) -> Self {
        self.init = v;
        self.undoable = false;
        self
    }

    pub fn add_payload<P: Payload>(mut self, payload: P) -> Self {
        self.payloads.push(payload.into());
        self
    }
}

/// `EditPayload` is the basic update unit of the Workbook. Developers can config their own
/// `EditAction` (e.g. setting a button to create a table) to facilitate their users.
#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "edit_payload.ts")
)]
pub enum EditPayload {
    // Block
    BlockInput(BlockInput),
    MoveBlock(MoveBlock),
    RemoveBlock(RemoveBlock),
    CreateBlock(CreateBlock),

    // DiyCell
    CreateDiyCell(CreateDiyCell),
    CreateDiyCellById(CreatDiyCellById),

    // Style
    CellStyleUpdate(CellStyleUpdate),
    EphemeralCellStyleUpdate(EphemeralCellStyleUpdate),
    LineStyleUpdate(LineStyleUpdate),
    BlockStyleUpdate(BlockStyleUpdate),

    CellFormatBrush(CellFormatBrush),
    LineFormatBrush(LineFormatBrush),

    CellInput(CellInput),
    EphemeralCellInput(EphemeralCellInput),
    CellClear(CellClear),
    SetColWidth(SetColWidth),
    SetRowHeight(SetRowHeight),
    SetVisible(SetVisible),
    // Merge cells
    MergeCells(MergeCells),
    SplitMergedCells(SplitMergedCells),
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
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "create_sheet.ts")
)]
pub struct CreateSheet {
    pub idx: usize,
    pub new_name: String,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "delete_sheet.ts")
)]
pub struct DeleteSheet {
    pub idx: usize,
}

/// Find a sheet by its name and rename it. If no sheet is found, do nothing.
#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "sheet_rename.ts")
)]
pub struct SheetRename {
    pub old_name: Option<String>,
    pub idx: Option<usize>,
    pub new_name: String,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "cell_format_brush.ts")
)]
pub struct CellFormatBrush {
    pub src_sheet_idx: usize,
    pub src_row: usize,
    pub src_col: usize,
    pub dst_sheet_idx: usize,
    pub dst_row_start: usize,
    pub dst_col_start: usize,
    pub dst_row_end: usize,
    pub dst_col_end: usize,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "line_format_brush.ts")
)]
pub struct LineFormatBrush {
    pub src_sheet_idx: usize,
    pub src_row: usize,
    pub src_col: usize,
    pub dst_sheet_idx: usize,
    pub row: bool,
    pub from: usize,
    pub to: usize,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "delete_rows.ts")
)]
pub struct DeleteRows {
    pub sheet_idx: usize,
    pub start: usize,
    pub count: usize,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "insert_rows.ts")
)]
pub struct InsertRows {
    pub sheet_idx: usize,
    pub start: usize,
    pub count: usize,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "delete_cols.ts")
)]
pub struct DeleteCols {
    pub sheet_idx: usize,
    pub start: usize,
    pub count: usize,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "insert_cols.ts")
)]
pub struct InsertCols {
    pub sheet_idx: usize,
    pub start: usize,
    pub count: usize,
}

/// Take the `content` as input to the cell. The type of the `content` can be referred automatically.
#[derive(Debug, Clone)]
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

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "ephemeral_cell_input.ts")
)]
pub struct EphemeralCellInput {
    pub sheet_idx: usize,
    pub id: EphemeralId,
    pub content: String,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "cell_clear.ts")
)]
pub struct CellClear {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
}

/// Create a new block.
///
/// Note that the block id is assigned by you. You are supposed to
/// manage all your blocks. If the `block id` is already existed, engines
/// will remove the old one.
#[derive(Debug, Clone)]
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

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "create_diy_cell.ts")
)]
pub struct CreateDiyCell {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "create_diy_cell_by_id.ts")
)]
pub struct CreatDiyCellById {
    pub sheet_id: SheetId,
    pub block_id: BlockId,
    pub row_idx: usize,
    pub col_idx: usize,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "set_row_height.ts")
)]
pub struct SetRowHeight {
    pub sheet_idx: usize,
    pub row: usize,
    pub height: f64,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "set_col_width.ts")
)]
pub struct SetColWidth {
    pub sheet_idx: usize,
    pub col: usize,
    pub width: f64,
}

#[derive(Debug, Clone)]
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

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "remove_block.ts")
)]
pub struct RemoveBlock {
    pub sheet_idx: usize,
    pub id: usize,
}

#[derive(Debug, Clone)]
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

impl From<BlockInput> for EditPayload {
    fn from(value: BlockInput) -> Self {
        EditPayload::BlockInput(value)
    }
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "delete_rows_in_block.ts")
)]
pub struct DeleteRowsInBlock {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub start: usize,
    pub cnt: usize,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "insert_rows_in_block.ts")
)]
pub struct InsertRowsInBlock {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub start: usize,
    pub cnt: usize,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "insert_cols_in_block.ts")
)]
pub struct InsertColsInBlock {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub start: usize,
    pub cnt: usize,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "delete_cols_in_block.ts")
)]
pub struct DeleteColsInBlock {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub start: usize,
    pub cnt: usize,
}

#[derive(Debug, Clone)]
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

#[derive(Default, Debug, Clone)]
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
    /// The latest version after processing an action. 0 means latest version
    pub version: u32,
    /// Tasks should be calculated outside this engine(mainly because of network limitations and customer defined)
    pub async_tasks: Vec<Task>,
    pub status: StatusCode,
}

impl ActionEffect {
    pub fn from_err(e: u8) -> Self {
        ActionEffect {
            status: StatusCode::Err(e),
            ..Default::default()
        }
    }

    pub fn from(version: u32, tasks: Vec<Task>, ty: WorkbookUpdateType) -> Self {
        ActionEffect {
            version,
            async_tasks: tasks,
            status: StatusCode::Ok(ty),
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
    Ok(WorkbookUpdateType), // when there is no other history version for undo/redo, return false.
    Err(u8),
}

#[derive(Debug)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "workbook_update_type.ts")
)]
pub enum WorkbookUpdateType {
    DoNothing,
    Cell,
    Sheet,
    SheetAndCell,
    UndoNothing,
    RedoNothing,
    Undo,
    Redo,
    EphemeralCells,
}

impl Default for StatusCode {
    fn default() -> Self {
        Self::Ok(WorkbookUpdateType::Cell)
    }
}

use crate::controller::style::PatternFill;
use logisheets_workbook::prelude::*;

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "cell_style_update.ts")
)]
pub struct CellStyleUpdate {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
    pub ty: StyleUpdateType,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "ephemeral_cell_style_update.ts")
)]
pub struct EphemeralCellStyleUpdate {
    pub sheet_idx: usize,
    pub id: EphemeralId,
    pub ty: StyleUpdateType,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "line_style_update.ts")
)]
pub struct LineStyleUpdate {
    pub sheet_idx: usize,
    pub from: usize,
    pub to: usize,
    pub ty: StyleUpdateType,
    pub row: bool,
}

pub type Color = String;

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "alignment.ts")
)]
pub struct Alignment {
    pub horizontal: Option<HorizontalAlignment>,
    pub vertical: Option<VerticalAlignment>,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "vertical_alignment.ts")
)]
pub enum VerticalAlignment {
    Center,
    Top,
    Bottom,
    Justify,
    Distributed,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "horizontal_alignment.ts")
)]
pub enum HorizontalAlignment {
    General,
    Left,
    Center,
    Right,
    Fill,
    Justify,
    CenterContinuous,
    Distributed,
}

#[derive(Debug, Clone, Default)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "style_update_type.ts")
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
    pub set_alignment: Option<Alignment>,
}

#[derive(Debug, Clone, Default)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "merge_cells.ts")
)]
pub struct MergeCells {
    pub sheet_idx: usize,
    pub start_row: usize,
    pub start_col: usize,
    pub end_row: usize,
    pub end_col: usize,
}
#[derive(Debug, Clone, Default)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "split_merged_cells.ts")
)]
pub struct SplitMergedCells {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
}

impl From<MergeCells> for EditPayload {
    fn from(value: MergeCells) -> Self {
        EditPayload::MergeCells(value)
    }
}

impl From<SplitMergedCells> for EditPayload {
    fn from(value: SplitMergedCells) -> Self {
        EditPayload::SplitMergedCells(value)
    }
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
impl From<CellStyleUpdate> for EditPayload {
    fn from(value: CellStyleUpdate) -> Self {
        EditPayload::CellStyleUpdate(value)
    }
}
impl From<LineStyleUpdate> for EditPayload {
    fn from(value: LineStyleUpdate) -> Self {
        EditPayload::LineStyleUpdate(value)
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

impl From<CellFormatBrush> for EditPayload {
    fn from(value: CellFormatBrush) -> Self {
        EditPayload::CellFormatBrush(value)
    }
}

impl From<LineFormatBrush> for EditPayload {
    fn from(value: LineFormatBrush) -> Self {
        EditPayload::LineFormatBrush(value)
    }
}

impl From<EphemeralCellInput> for EditPayload {
    fn from(value: EphemeralCellInput) -> Self {
        EditPayload::EphemeralCellInput(value)
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
impl Payload for CellStyleUpdate {}
impl Payload for LineStyleUpdate {}
impl Payload for InsertCols {}
impl Payload for InsertRows {}
impl Payload for DeleteCols {}
impl Payload for DeleteRows {}
impl Payload for InsertColsInBlock {}
impl Payload for InsertRowsInBlock {}
impl Payload for DeleteColsInBlock {}
impl Payload for DeleteRowsInBlock {}
impl Payload for CellFormatBrush {}
impl Payload for LineFormatBrush {}
impl Payload for EphemeralCellInput {}

#[cfg(test)]
mod tests {
    use super::VerticalAlignment;

    #[test]
    fn test_should_have_double_quote() {
        let s1 = "\"center\"".to_string();
        let _: VerticalAlignment = serde_json::from_str(&s1).unwrap();
    }
}
