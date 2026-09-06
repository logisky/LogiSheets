use crate::conditional_formatting_manager::spec::CfRuleSpec;
use gents_derives::TS;
use logisheets_base::{BlockId, CellId, ColId, EphemeralId, RowId, SheetId, async_func::Task};

pub trait Payload: Into<EditPayload> {}

/// `EditAction` represents your update behavior to the workbook.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "edit_action.ts", tag = "type")]
pub enum EditAction {
    Undo,
    Redo,
    Payloads(PayloadsAction),
    Recalc(Vec<RecalcCell>),
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "recalc_cell.ts", rename_all = "camelCase")]
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
#[derive(Debug, Default, Clone, TS)]
#[ts(file_name = "payloads_action.ts")]
pub struct PayloadsAction {
    pub payloads: Vec<EditPayload>,
    pub undoable: bool,
    // An action that is used to customize the initial status of a new workbook.
    // This action is `undoable` but its new status should be recorded to history.
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
#[derive(Debug, Clone, TS)]
#[ts(file_name = "edit_payload.ts", tag = "type")]
pub enum EditPayload {
    // Block
    BlockInput(BlockInput),
    MoveBlock(MoveBlock),
    RemoveBlock(RemoveBlock),
    CreateBlock(CreateBlock),
    ResizeBlock(ResizeBlock),
    ConvertBlock(ConvertBlock),
    CreateLink(CreateLink),
    BindFormSchema(BindFormSchema),
    UpsertFieldFormulas(UpsertFieldFormulas),
    BindRandomSchema(BindRandomSchema),
    UpsertFieldRenderInfo(UpsertFieldRenderInfo),
    MoveBlockLine(MoveBlockLine),
    ReorderBlockLines(ReorderBlockLines),

    // DiyCell
    CreateDiyCell(CreateDiyCell),
    CreateDiyCellById(CreateDiyCellById),
    RemoveDiyCell(RemoveDiyCell),
    RemoveDiyCellById(RemoveDiyCellById),

    // Appendix
    CreateAppendix(CreateAppendix),
    RemoveAppendix(RemoveAppendix),

    // Style
    CellStyleUpdate(CellStyleUpdate),
    EphemeralCellStyleUpdate(EphemeralCellStyleUpdate),
    LineStyleUpdate(LineStyleUpdate),
    BlockStyleUpdate(BlockStyleUpdate),
    BlockLineStyleUpdate(BlockLineStyleUpdate),
    BlockLineNameFieldUpdate(BlockLineNameFieldUpdate),
    SetBlockDescription(SetBlockDescription),
    SetBlockPermissions(SetBlockPermissions),

    CellFormatBrush(CellFormatBrush),
    LineFormatBrush(LineFormatBrush),

    CellInput(CellInput),
    EphemeralCellInput(EphemeralCellInput),
    EphemeralCellRemove(EphemeralCellRemove),
    CellClear(CellClear),

    // Cell images (stored as SpreadsheetDrawingML pictures on save).
    SetCellImage(SetCellImage),
    DeleteCellImage(DeleteCellImage),
    MoveChart(MoveChart),
    CreateConditionalFormattingRule(CreateConditionalFormattingRule),
    UpdateConditionalFormattingRule(UpdateConditionalFormattingRule),
    MoveConditionalFormattingRule(MoveConditionalFormattingRule),
    DeleteConditionalFormattingRule(DeleteConditionalFormattingRule),
    DeleteChart(DeleteChart),
    CreateChart(CreateChart),
    UpdateChart(UpdateChart),
    SetColWidth(SetColWidth),
    SetRowHeight(SetRowHeight),
    SetVisible(SetVisible),
    // Merge cells
    MergeCells(MergeCells),
    SplitMergedCells(SplitMergedCells),

    // Comments (threaded + @mentions). See `cell_attachments::comment`.
    AddComment(AddComment),
    EditComment(EditComment),
    DeleteComment(DeleteComment),
    ResolveComment(ResolveComment),
    UpsertPerson(UpsertPerson),

    // Sheet
    SheetRename(SheetRename),
    CreateSheet(CreateSheet),
    DeleteSheet(DeleteSheet),
    SetSheetColor(SetSheetColor),
    SetSheetVisible(SetSheetVisible),
    // Shifting
    InsertCols(InsertCols),
    DeleteCols(DeleteCols),
    InsertRows(InsertRows),
    DeleteRows(DeleteRows),
    InsertColsInBlock(InsertColsInBlock),
    DeleteColsInBlock(DeleteColsInBlock),
    InsertRowsInBlock(InsertRowsInBlock),
    DeleteRowsInBlock(DeleteRowsInBlock),

    // Reproduce
    ReproduceCells(ReproduceCells),

    // Named in-memory checkpoints. Save / delete are workbook methods
    // (they don't touch sheet state). Restore is here because it DOES
    // mutate state — replacing the live status with a previously-saved
    // snapshot — and must go through the undoable-tx pipeline so the
    // user can Ctrl-Z to reverse it.
    RestoreCheckpoint(RestoreCheckpoint),
}

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "upsert_field_render_info.ts",
    builder,
    rename_all = "camelCase"
)]
pub struct UpsertFieldRenderInfo {
    pub render_id: String,
    pub diy_render: bool,
    pub style_update: StyleUpdateType,
}

/// Replace the controller's live `Status` with a previously-saved
/// snapshot from the `CheckpointManager`. The state-swap is recorded
/// as a normal undoable transaction so the user can Ctrl-Z to reverse
/// it (which restores whatever the live status was right before the
/// restore — not the snapshot).
///
/// Fails loud (`CheckpointNotFound`) if no checkpoint exists for the
/// given label. The redo stack is cleared per standard tx semantics.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "restore_checkpoint.ts", builder, rename_all = "camelCase")]
pub struct RestoreCheckpoint {
    /// Label passed to `Workbook::save_checkpoint` earlier in this
    /// session.
    pub label: String,
}

impl From<RestoreCheckpoint> for EditPayload {
    fn from(value: RestoreCheckpoint) -> Self {
        EditPayload::RestoreCheckpoint(value)
    }
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "create_sheet.ts", builder, rename_all = "camelCase")]
pub struct CreateSheet {
    pub idx: usize,
    pub new_name: String,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "delete_sheet.ts", builder, rename_all = "camelCase")]
pub struct DeleteSheet {
    pub idx: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "set_sheet_color.ts", builder, rename_all = "camelCase")]
pub struct SetSheetColor {
    pub idx: usize,
    pub color: String,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "set_sheet_visible.ts", builder, rename_all = "camelCase")]
pub struct SetSheetVisible {
    pub idx: usize,
    pub visible: bool,
}

/// Find a sheet by its name and rename it. If no sheet is found, do nothing.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "sheet_rename.ts", builder, rename_all = "camelCase")]
pub struct SheetRename {
    pub old_name: Option<String>,
    pub idx: Option<usize>,
    pub new_name: String,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "cell_format_brush.ts", builder, rename_all = "camelCase")]
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

#[derive(Debug, Clone, TS)]
#[ts(file_name = "line_format_brush.ts", builder, rename_all = "camelCase")]
pub struct LineFormatBrush {
    pub src_sheet_idx: usize,
    pub src_row: usize,
    pub src_col: usize,
    pub dst_sheet_idx: usize,
    pub row: bool,
    pub from: usize,
    pub to: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "delete_rows.ts", builder, rename_all = "camelCase")]
pub struct DeleteRows {
    pub sheet_idx: usize,
    pub start: usize,
    pub count: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "insert_rows.ts", builder, rename_all = "camelCase")]
pub struct InsertRows {
    pub sheet_idx: usize,
    pub start: usize,
    pub count: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "delete_cols.ts", builder, rename_all = "camelCase")]
pub struct DeleteCols {
    pub sheet_idx: usize,
    pub start: usize,
    pub count: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "insert_cols.ts", builder, rename_all = "camelCase")]
pub struct InsertCols {
    pub sheet_idx: usize,
    pub start: usize,
    pub count: usize,
}

/// Place an image inside a cell. The image fills the cell and resizes with it.
/// `data` is the base64-encoded image bytes; `format` is the image format
/// (e.g. `png`, `jpeg`); `image_id` is a stable, workbook-unique identifier
/// chosen by the caller (used to name the media part on save).
#[derive(Debug, Clone, TS)]
#[ts(file_name = "set_cell_image.ts", builder, rename_all = "camelCase")]
pub struct SetCellImage {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
    pub image_id: String,
    pub format: String,
    pub data: String,
}

/// Remove the image placed in a cell, if any.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "delete_cell_image.ts", builder, rename_all = "camelCase")]
pub struct DeleteCellImage {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
}

/// Move (and/or resize) a chart to a new anchor. The chart is identified by
/// `chart_id` on the given sheet. `from`/`to` are the new top-left and
/// bottom-right anchor corners, each a cell position plus an EMU offset into
/// that cell (1px = 9525 EMU at 96 DPI). Anchoring to cells (not pixels) is how
/// the chart shifts with row/column edits.
/// Delete a chart from a sheet, identified by `chart_id`.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "delete_chart.ts", builder, rename_all = "camelCase")]
pub struct DeleteChart {
    pub sheet_idx: usize,
    pub chart_id: String,
}

/// Reconfigure an existing chart in place, keeping its anchor. Any field left
/// `None` keeps the chart's current value; an empty string clears a text field
/// (title, axis title, number format).
///
/// `chart_type` is one of `col|bar|line|area|pie|doughnut|scatter|radar|
/// bubble|stock|ofPie|barOfPie|surface|surface3d`; `legend_pos` is
/// `top|bottom|left|right|none`.
#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "update_chart.ts", builder, rename_all = "camelCase")]
pub struct UpdateChart {
    pub sheet_idx: usize,
    pub chart_id: String,
    pub chart_type: Option<String>,
    pub title: Option<String>,
    pub legend_pos: Option<String>,
    /// Stack the series (bar/column, line, area). Ignored by pie and scatter.
    pub stacked: Option<bool>,
    pub cat_axis_title: Option<String>,
    pub val_axis_title: Option<String>,
    /// Show the value next to each data point.
    pub show_data_labels: Option<bool>,
    /// Also show the category name / series name / percentage in the label.
    pub show_category_labels: Option<bool>,
    pub show_series_labels: Option<bool>,
    pub show_percent_labels: Option<bool>,
    /// Where the label sits: `ctr|inEnd|outEnd|inBase|bestFit`.
    pub data_label_position: Option<String>,
    /// Excel number-format code applied to the value axis and to data labels
    /// (e.g. `#,##0.00`, `0%`). Empty clears it, falling back to the source
    /// cells' own format.
    pub num_fmt: Option<String>,
    /// Replace the category (X) reference, e.g. `Sheet1!$A$2:$A$5`.
    pub categories_ref: Option<String>,
    /// Replace the whole series list. Colors of series that keep their position
    /// are preserved when the new entry does not name one.
    pub series: Option<Vec<CreateChartSeries>>,
    /// Replace the value axis' scale wholesale. Unlike the other fields this
    /// is all-or-nothing: sending it sets every part of the scale, so a `None`
    /// inside means "auto" rather than "keep". That is the only way to clear a
    /// fixed minimum back to automatic.
    pub val_axis_scale: Option<AxisScaleUpdate>,
    /// The same for the category (X) axis.
    pub cat_axis_scale: Option<AxisScaleUpdate>,
    /// Replace how a pie-of-pie / bar-of-pie splits its series. Like the axis
    /// scales this is all-or-nothing rather than a patch.
    pub of_pie_split: Option<OfPieSplitUpdate>,
    /// Bind the chart to a block, or rebind it to different fields. The series
    /// then come from the block and `series`/`categories_ref` are ignored.
    ///
    /// To unbind, state `series` instead: naming fixed ranges is exactly the
    /// statement that the chart no longer tracks a block.
    pub block_source: Option<ChartBlockSource>,
}

/// The division between an of-pie chart's two plots.
#[derive(Debug, Clone, Default, TS)]
#[ts(
    file_name = "of_pie_split_update.ts",
    builder,
    rename_all = "camelCase"
)]
pub struct OfPieSplitUpdate {
    /// `auto | cust | percent | pos | val`. Anything else is treated as `auto`.
    pub by: Option<String>,
    /// Read according to `by`: a count of trailing points for `pos`, a
    /// threshold for `val`, a percentage for `percent`.
    pub pos: Option<f64>,
    /// The second plot's size, as a percentage of the first (Excel: 5..=200).
    pub second_size: Option<f64>,
}

/// An axis' scale. Every field `None`/`false` is a fully automatic axis, which
/// is Excel's default.
#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "axis_scale_update.ts", builder, rename_all = "camelCase")]
pub struct AxisScaleUpdate {
    pub min: Option<f64>,
    pub max: Option<f64>,
    /// Log scale base (Excel allows 2..=1000). `None` is a linear axis.
    pub log_base: Option<f64>,
    /// Draw the axis in the opposite direction.
    pub reversed: bool,
    /// Spacing between major ticks / gridlines. `None` is automatic.
    pub major_unit: Option<f64>,
    pub minor_unit: Option<f64>,
}

/// One series for [`CreateChart`] / [`UpdateChart`]: an optional name, the
/// value reference formula (e.g. `Sheet1!$B$2:$E$2`) and an optional explicit
/// fill color as an RGB hex string (`"4472C4"`).
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "create_chart_series.ts",
    builder,
    rename_all = "camelCase"
)]
pub struct CreateChartSeries {
    pub name: Option<String>,
    pub value_ref: String,
    pub color: Option<String>,
    /// Bubble sizes for this series (`Sheet1!$D$2:$D$6`). Only a bubble chart
    /// reads it; other kinds keep it in the model but never draw it.
    pub size_ref: Option<String>,
    /// Draw this one series as a different kind — `col|bar|line|area` — which
    /// is how a combo chart is expressed. `None` follows the chart's own type.
    /// An override the chart cannot combine with is ignored.
    pub series_type: Option<String>,
}

/// Create a new chart anchored at `from`..`to`. `chart_type` is one of
/// `col|bar|line|area|pie|doughnut|scatter|radar|bubble|stock|ofPie|barOfPie|
/// surface|surface3d`. `chart_id` must be workbook-unique
/// (the caller generates it; it also names the chart part). Series values are
/// read live from the referenced ranges, so no cached values are needed here.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "create_chart.ts", builder, rename_all = "camelCase")]
pub struct CreateChart {
    pub sheet_idx: usize,
    pub chart_id: String,
    pub chart_type: String,
    pub from_row: usize,
    pub from_col: usize,
    pub from_col_off: i64,
    pub from_row_off: i64,
    pub to_row: usize,
    pub to_col: usize,
    pub to_col_off: i64,
    pub to_row_off: i64,
    pub title: Option<String>,
    pub categories_ref: Option<String>,
    pub series: Vec<CreateChartSeries>,
    /// Plot a block instead of fixed ranges. When set, `series` and
    /// `categories_ref` are ignored — the block says where its fields are, and
    /// the chart re-reads that on every render and every save, so it follows
    /// the block as records are added or columns move.
    pub block_source: Option<ChartBlockSource>,
}

/// Binds a chart to a block: which block, which of its fields to plot, and
/// which field labels the categories. Fields are named, the identity
/// `#FIELD("qty")` formulas use — a renamed field breaks the link, a moved one
/// does not. A block with a `random` schema has no field axis and cannot be
/// charted this way.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "chart_block_source.ts", builder, rename_all = "camelCase")]
pub struct ChartBlockSource {
    pub block_id: usize,
    pub category_field: Option<String>,
    pub value_fields: Vec<String>,
}

/// Add a conditional-formatting rule over `start`..`end` (corners may be given
/// in any order). The range is anchored on cell ids, so it tracks later row and
/// column edits; the rule takes the next free `priority`, applying after the
/// ones already on the sheet.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "create_conditional_formatting_rule.ts",
    builder,
    rename_all = "camelCase"
)]
pub struct CreateConditionalFormattingRule {
    pub sheet_idx: usize,
    pub start_row: usize,
    pub start_col: usize,
    pub end_row: usize,
    pub end_col: usize,
    pub rule: CfRuleSpec,
}

/// Replace a rule's condition and format, keeping its id, its range and its
/// `priority` — so editing a rule never reorders it.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "update_conditional_formatting_rule.ts",
    builder,
    rename_all = "camelCase"
)]
pub struct UpdateConditionalFormattingRule {
    pub sheet_idx: usize,
    /// From `CellInfo::conditional_format`, or `get_conditional_formatting_rules`.
    /// Session-scoped: ids are re-minted on load and must not be persisted.
    pub rule_id: u32,
    pub rule: CfRuleSpec,
}

/// Re-target an existing rule at a different range, keeping everything else.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "move_conditional_formatting_rule.ts",
    builder,
    rename_all = "camelCase"
)]
pub struct MoveConditionalFormattingRule {
    pub sheet_idx: usize,
    pub rule_id: u32,
    pub start_row: usize,
    pub start_col: usize,
    pub end_row: usize,
    pub end_col: usize,
}

/// Remove a rule. The `<conditionalFormatting>` element is dropped with it when
/// it held no other rules.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "delete_conditional_formatting_rule.ts",
    builder,
    rename_all = "camelCase"
)]
pub struct DeleteConditionalFormattingRule {
    pub sheet_idx: usize,
    pub rule_id: u32,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "move_chart.ts", builder, rename_all = "camelCase")]
pub struct MoveChart {
    pub sheet_idx: usize,
    pub chart_id: String,
    pub from_row: usize,
    pub from_col: usize,
    pub from_col_off: i64,
    pub from_row_off: i64,
    pub to_row: usize,
    pub to_col: usize,
    pub to_col_off: i64,
    pub to_row_off: i64,
}

/// Take the `content` as input to the cell. The type of the `content` can be referred automatically.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "cell_input.ts", builder, rename_all = "camelCase")]
pub struct CellInput {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
    pub content: String,
}

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "ephemeral_cell_input.ts",
    builder,
    rename_all = "camelCase"
)]
pub struct EphemeralCellInput {
    pub sheet_idx: usize,
    pub id: EphemeralId,
    pub content: String,
}

/// Remove an ephemeral cell previously written via `EphemeralCellInput`.
/// Frees the slot in the container and detaches the cell from the
/// dependency graph so it no longer participates in recompute. Safe to
/// call on an id that was never written — the operation is a no-op.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "ephemeral_cell_remove.ts",
    builder,
    rename_all = "camelCase"
)]
pub struct EphemeralCellRemove {
    pub sheet_idx: usize,
    pub id: EphemeralId,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "cell_clear.ts", builder, rename_all = "camelCase")]
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
///
/// `owner`, `modify_policy`, `permissions` and `description` are metadata the
/// host uses to gate write access at runtime — ask
/// `Workbook::may_modify_block` rather than reading them apart. The engine
/// does not enforce them itself: a payload carries no trace of who prompted
/// it, so only the host knows whether an edit came from a person or a craft.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "create_block.ts", builder, rename_all = "camelCase")]
pub struct CreateBlock {
    pub sheet_idx: usize,
    pub id: usize,
    pub master_row: usize,
    pub master_col: usize,
    pub row_cnt: usize,
    pub col_cnt: usize,
    pub owner: Option<String>,
    pub modify_policy: Option<ModifyPolicy>,
    /// Per-operation overrides of `modify_policy`. Omitted, the single policy
    /// governs every operation.
    pub permissions: Option<BlockPermissions>,
    /// What the block is for, in prose, for an AI or a person reading the
    /// sheet later. A craft creating a block should say what it is for here.
    pub description: Option<String>,
}

/// Rewrite a block's prose description, or clear it with an empty string.
///
/// Governed by `BlockOp::ModifyDescription`, which the host is expected to
/// check first: a description is how the block explains itself to whoever
/// reads the sheet next, so an owner may well want it left alone.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "set_block_description.ts",
    builder,
    rename_all = "camelCase"
)]
pub struct SetBlockDescription {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub description: String,
}

/// Replace a block's per-operation policies, and optionally its default one.
///
/// All-or-nothing on `permissions`: what is sent becomes the whole set, so an
/// operation left `None` in the payload goes back to deferring to the default
/// policy. That is the only way to clear an override, and it means the caller
/// always states the block's full stance rather than patching it blind.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "set_block_permissions.ts",
    builder,
    rename_all = "camelCase"
)]
pub struct SetBlockPermissions {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub permissions: BlockPermissions,
    /// `None` keeps the block's current default policy.
    pub modify_policy: Option<ModifyPolicy>,
}

/// Controls who is allowed to write to a block at the frontend runtime layer.
/// Reads are always allowed regardless of policy.
#[derive(Debug, Clone, Copy, PartialEq, Eq, TS)]
#[ts(file_name = "modify_policy.ts", tag = "type")]
pub enum ModifyPolicy {
    /// Anyone (any craft or the user) can write.
    All,
    /// Only the owner can write.
    OwnerOnly,
    /// The owner and the user can write; other crafts cannot.
    OwnerAndUser,
}

impl Default for ModifyPolicy {
    fn default() -> Self {
        ModifyPolicy::All
    }
}

impl ModifyPolicy {
    /// String form used for .xlsx persistence. Mirrors the camelCase wire
    /// format produced by the TypeScript binding.
    pub fn as_wire_str(&self) -> &'static str {
        match self {
            ModifyPolicy::All => "all",
            ModifyPolicy::OwnerOnly => "ownerOnly",
            ModifyPolicy::OwnerAndUser => "ownerAndUser",
        }
    }

    /// Parse the persisted string form. Unknown values fall back to `All`.
    pub fn from_wire_str(s: &str) -> Self {
        match s {
            "ownerOnly" => ModifyPolicy::OwnerOnly,
            "ownerAndUser" => ModifyPolicy::OwnerAndUser,
            _ => ModifyPolicy::All,
        }
    }
}

/// The operations a block's permissions can speak about separately.
///
/// One policy for the whole block is too blunt for the case this exists to
/// serve: a block a craft or Watson built usually wants the user to keep
/// *typing into it* while refusing to let them pull rows out from under it or
/// re-point its schema, which would take the block out of the owner's control
/// for good.
#[derive(Debug, Clone, Copy, PartialEq, Eq, TS)]
#[ts(file_name = "block_op.ts", tag = "type")]
pub enum BlockOp {
    /// Insert or delete rows/columns inside the block.
    InsertDeleteLines,
    /// Delete the whole block. Kept apart from the rest because it is the one
    /// operation there is no recovering from by editing: the records, the
    /// schema and this policy itself all go at once.
    RemoveBlock,
    /// Bind a different schema, or change the fields of the current one.
    ModifySchema,
    /// Write a value into one of the block's cells.
    CellInput,
    /// Reorder the records by one of the fields.
    SortByField,
    /// Rewrite the prose description.
    ModifyDescription,
    /// Write a value into a block cell that its field's validation rule
    /// rejects.
    ///
    /// Distinct from `CellInput` because the two answer different questions:
    /// `CellInput` is "may this actor write here at all", this one is "may
    /// this actor write something the schema says is wrong". A craft that
    /// maintains a table often has to seed a row it knows is incomplete —
    /// a required field it fills in on the next round — while a person typing
    /// into the same block should be held to the rule. Left at `All` (the
    /// default), a violating write lands and is flagged, which is what every
    /// block did before this op existed.
    OverrideValidation,
}

impl BlockOp {
    /// Every operation, so a caller can render or check the whole set without
    /// having to keep its own list in step with this one.
    pub const ALL: [BlockOp; 7] = [
        BlockOp::InsertDeleteLines,
        BlockOp::RemoveBlock,
        BlockOp::ModifySchema,
        BlockOp::CellInput,
        BlockOp::SortByField,
        BlockOp::ModifyDescription,
        BlockOp::OverrideValidation,
    ];

    /// Attribute name used for .xlsx persistence.
    pub fn as_wire_str(&self) -> &'static str {
        match self {
            BlockOp::InsertDeleteLines => "insertDeleteLines",
            BlockOp::RemoveBlock => "removeBlock",
            BlockOp::ModifySchema => "modifySchema",
            BlockOp::CellInput => "cellInput",
            BlockOp::SortByField => "sortByField",
            BlockOp::ModifyDescription => "modifyDescription",
            BlockOp::OverrideValidation => "overrideValidation",
        }
    }
}

/// Per-operation overrides of a block's [`ModifyPolicy`].
///
/// `None` on an operation defers to the block's own `modify_policy`, so a
/// block that says nothing here behaves exactly as it did when one policy
/// governed everything — which is what every block in a file written before
/// this existed says.
#[derive(Debug, Clone, Default, PartialEq, Eq, TS)]
#[ts(file_name = "block_permissions.ts", builder, rename_all = "camelCase")]
pub struct BlockPermissions {
    pub insert_delete_lines: Option<ModifyPolicy>,
    pub remove_block: Option<ModifyPolicy>,
    pub modify_schema: Option<ModifyPolicy>,
    pub cell_input: Option<ModifyPolicy>,
    pub sort_by_field: Option<ModifyPolicy>,
    pub modify_description: Option<ModifyPolicy>,
    pub override_validation: Option<ModifyPolicy>,
}

impl BlockPermissions {
    /// The policy for one operation, or `fallback` when this block does not
    /// single that operation out.
    pub fn policy_for(&self, op: BlockOp, fallback: ModifyPolicy) -> ModifyPolicy {
        self.explicit(op).unwrap_or(fallback)
    }

    pub fn set(&mut self, op: BlockOp, policy: Option<ModifyPolicy>) {
        match op {
            BlockOp::InsertDeleteLines => self.insert_delete_lines = policy,
            BlockOp::RemoveBlock => self.remove_block = policy,
            BlockOp::ModifySchema => self.modify_schema = policy,
            BlockOp::CellInput => self.cell_input = policy,
            BlockOp::SortByField => self.sort_by_field = policy,
            BlockOp::ModifyDescription => self.modify_description = policy,
            BlockOp::OverrideValidation => self.override_validation = policy,
        }
    }

    /// `true` when nothing is singled out, i.e. the block is governed by its
    /// single policy alone. Lets the writer omit the attributes entirely.
    pub fn is_empty(&self) -> bool {
        BlockOp::ALL.iter().all(|op| self.explicit(*op).is_none())
    }

    /// The policy stated for `op`, if this block states one.
    pub fn explicit(&self, op: BlockOp) -> Option<ModifyPolicy> {
        match op {
            BlockOp::InsertDeleteLines => self.insert_delete_lines,
            BlockOp::RemoveBlock => self.remove_block,
            BlockOp::ModifySchema => self.modify_schema,
            BlockOp::CellInput => self.cell_input,
            BlockOp::SortByField => self.sort_by_field,
            BlockOp::ModifyDescription => self.modify_description,
            BlockOp::OverrideValidation => self.override_validation,
        }
    }
}

/// Who is asking to change a block.
///
/// The engine cannot tell these apart on its own — every payload arrives from
/// the host process, whoever prompted it — so this is what the host states
/// when it asks whether an operation is allowed. Keeping the *decision* here
/// rather than in each host means the browser, node, the desktop app and the
/// craft runtime cannot drift apart on what a policy means.
#[derive(Debug, Clone, PartialEq, Eq, TS)]
#[ts(file_name = "block_actor.ts", tag = "type")]
pub enum BlockActor {
    /// A person editing the sheet.
    User,
    /// A craft, named by its craft id. Watson counts as one.
    Craft(String),
}

impl ModifyPolicy {
    /// Whether `actor` may write to a block owned by `owner` under this policy.
    ///
    /// A block with no owner has nobody to privilege, so `OwnerOnly` on it
    /// would lock everyone out including whoever set it; it is read as `All`
    /// instead.
    pub fn allows(&self, actor: &BlockActor, owner: &str) -> bool {
        match self {
            ModifyPolicy::All => true,
            _ if owner.is_empty() => true,
            ModifyPolicy::OwnerOnly => matches!(actor, BlockActor::Craft(id) if id == owner),
            ModifyPolicy::OwnerAndUser => match actor {
                BlockActor::User => true,
                BlockActor::Craft(id) => id == owner,
            },
        }
    }
}

/// Read-only view of a block's frontend-runtime write policy. Returned by
/// `Workbook::get_block_modify_info` so the JS validate hook can decide
/// whether a caller is allowed to write to a given block.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "block_modify_info.ts", rename_all = "camelCase")]
pub struct BlockModifyInfo {
    pub owner: String,
    /// The block's default policy — what an operation absent from
    /// `permissions` falls back to.
    pub modify_policy: ModifyPolicy,
    pub permissions: BlockPermissions,
    pub description: String,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "resize_block.ts", builder, rename_all = "camelCase")]
pub struct ResizeBlock {
    pub sheet_idx: usize,
    pub id: usize,
    pub new_row_cnt: Option<usize>,
    pub new_col_cnt: Option<usize>,
}

/// Convert a cell range to a block.
///
/// It is similar to `create_block`, but it will keep the old cells and formulas.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "convert_block.ts", builder, rename_all = "camelCase")]
pub struct ConvertBlock {
    pub sheet_idx: usize,
    pub id: usize,
    pub master_row: usize,
    pub master_col: usize,
    pub row_cnt: usize,
    pub col_cnt: usize,
}

/// Link a source cell range to an existing block, so references to the source
/// (e.g. `A1:A10`) transparently resolve to the block's cells. The source cells
/// are left untouched (a facade); the block is the real, growable backing store.
/// The source's column count must equal the block's column count.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "create_link.ts", builder, rename_all = "camelCase")]
pub struct CreateLink {
    /// Sheet holding the SOURCE range (the facade the user references).
    pub sheet_idx: usize,
    /// Top-left of the source range.
    pub master_row: usize,
    pub master_col: usize,
    /// Source range extent. `col_cnt` must match the target block's columns.
    pub row_cnt: usize,
    pub col_cnt: usize,
    /// The existing block that backs the source range.
    pub block_id: usize,
    /// Sheet holding the backing BLOCK. `None` = same sheet as the source; set it
    /// for a cross-sheet link (e.g. a hidden block backing a visible-sheet range).
    pub block_sheet_idx: Option<usize>,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "create_diy_cell.ts", builder, rename_all = "camelCase")]
pub struct CreateDiyCell {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "remove_diy_cell.ts", builder, rename_all = "camelCase")]
pub struct RemoveDiyCell {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "create_diy_cell_by_id.ts",
    builder,
    rename_all = "camelCase"
)]
pub struct CreateDiyCellById {
    pub sheet_id: SheetId,
    pub block_id: BlockId,
    pub row_idx: usize,
    pub col_idx: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "remove_diy_cell_by_id.ts",
    builder,
    rename_all = "camelCase"
)]
pub struct RemoveDiyCellById {
    pub sheet_id: SheetId,
    pub block_id: BlockId,
    pub row_idx: usize,
    pub col_idx: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "create_appendix.ts", builder, rename_all = "camelCase")]
pub struct CreateAppendix {
    pub sheet_id: Option<SheetId>,
    pub sheet_idx: Option<usize>,
    pub block_id: BlockId,
    pub row_idx: usize,
    pub col_idx: usize,
    pub craft_id: String,
    pub tag: u8,
    pub content: String,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "remove_appendix.ts", builder, rename_all = "camelCase")]
pub struct RemoveAppendix {
    pub sheet_id: Option<SheetId>,
    pub sheet_idx: Option<usize>,
    pub block_id: BlockId,
    pub row_idx: usize,
    pub col_idx: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "set_row_height.ts", builder, rename_all = "camelCase")]
pub struct SetRowHeight {
    pub sheet_idx: usize,
    pub row: usize,
    pub height: f64,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "set_col_width.ts", builder, rename_all = "camelCase")]
pub struct SetColWidth {
    pub sheet_idx: usize,
    pub col: usize,
    pub width: f64,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "move_block.ts", builder, rename_all = "camelCase")]
pub struct MoveBlock {
    pub sheet_idx: usize,
    pub id: usize,
    pub new_master_row: usize,
    pub new_master_col: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "remove_block.ts", builder, rename_all = "camelCase")]
pub struct RemoveBlock {
    pub sheet_idx: usize,
    pub id: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "block_input.ts", builder, rename_all = "camelCase")]
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

impl From<UpsertFieldRenderInfo> for EditPayload {
    fn from(value: UpsertFieldRenderInfo) -> Self {
        EditPayload::UpsertFieldRenderInfo(value)
    }
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "move_block_line.ts", builder, rename_all = "camelCase")]
pub struct MoveBlockLine {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub from: usize,
    pub to: usize,
    pub is_row: bool,
}

impl From<MoveBlockLine> for EditPayload {
    fn from(value: MoveBlockLine) -> Self {
        EditPayload::MoveBlockLine(value)
    }
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "reorder_block_lines.ts", rename_all = "camelCase")]
pub struct ReorderBlockLines {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub is_row: bool,
    pub new_order: Vec<usize>,
}

impl From<ReorderBlockLines> for EditPayload {
    fn from(value: ReorderBlockLines) -> Self {
        EditPayload::ReorderBlockLines(value)
    }
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "bind_form_schema.ts", builder, rename_all = "camelCase")]
pub struct BindFormSchema {
    pub ref_name: String,
    pub sheet_idx: usize,
    pub block_id: usize,
    // Form schema fields start from this index.
    pub field_from: usize,
    // Form schema keys start from this index.
    pub key_idx: usize,
    pub fields: Vec<String>,
    // Generated by frontend app.
    // It is used to customize the fields' render behaviors.
    // The length of this vector should be the same as `fields`.
    pub render_ids: Vec<String>,
    pub row: bool,
    /// Per-field value-formula templates. Same indexing as `fields` —
    /// entry `i` is the formula for field `fields[i]`, or `None` for
    /// free-form fields. `Some("")` is treated as `None` after trim.
    ///
    /// Templates use `#FIELD("name")` (substituted with a reference to
    /// the same row's sibling cell) and `#KEY` (substituted with this
    /// row's key value as a string literal). When a field has a
    /// template, the engine derives the cell value from it; user
    /// `blockInput` payloads targeting that field are ignored (the
    /// formula is the constraint).
    ///
    /// Callers must always send this vec (use `[]` for "no templates").
    /// The vec length, when non-empty, must equal `fields.len()` — index
    /// alignment is positional.
    pub field_formulas: Vec<Option<String>>,
    /// Per-field validation-formula templates. Same indexing as `fields`.
    /// Each template is evaluated per row as a boolean: FALSE surfaces
    /// a `ShadowKind::Validation` warning on the cell (advisory; the
    /// cell value still commits). Empty vec = all None. Supports the
    /// same placeholders as `field_formulas`, plus `#PLACEHOLDER` which
    /// expands to a reference to the cell itself.
    pub validation_formulas: Vec<Option<String>>,
    /// Per-field editability-formula templates. Same indexing as `fields`.
    /// Each template is evaluated per row as a boolean: FALSE installs
    /// a `ShadowKind::UserEditable` lock so the host permission patch
    /// refuses writes to that cell. Empty vec = all None. Same
    /// placeholder support as `validation_formulas`.
    pub editability_formulas: Vec<Option<String>>,
}

impl From<BindFormSchema> for EditPayload {
    fn from(value: BindFormSchema) -> Self {
        EditPayload::BindFormSchema(value)
    }
}

/// Replace the per-field rule templates on a block whose
/// `BindFormSchema` has already been applied. Lets callers stage
/// schema registration and templated-formula installation as two
/// separate payloads in the same transaction — useful when several
/// blocks BLOCKREF each other and the parser needs every block's
/// refName + field set to be registered before any formula is parsed.
///
/// Index alignment matches the original BindFormSchema: entry `i` is
/// the formula for the field at index `i` of the bound schema's
/// `fields` list. `None` / empty string clears the field's formula
/// (a previously-templated field becomes free-form again). The vec
/// length must equal the bound schema's field count.
///
/// Any of the three rule vecs (`field_formulas`, `validation_formulas`,
/// `editability_formulas`) may be sent as `[]` to mean "leave this rule
/// kind untouched" — the engine preserves the existing per-field values.
/// To explicitly clear all rules of a kind, send `vec![None; N]`. Any
/// non-empty vec replaces every per-field value for that kind.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "upsert_field_formulas.ts",
    builder,
    rename_all = "camelCase"
)]
pub struct UpsertFieldFormulas {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub field_formulas: Vec<Option<String>>,
    pub validation_formulas: Vec<Option<String>>,
    pub editability_formulas: Vec<Option<String>>,
}

impl From<UpsertFieldFormulas> for EditPayload {
    fn from(value: UpsertFieldFormulas) -> Self {
        EditPayload::UpsertFieldFormulas(value)
    }
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "bind_random_schema.ts", builder, rename_all = "camelCase")]
pub struct BindRandomSchema {
    pub ref_name: String,
    pub sheet_idx: usize,
    pub block_id: usize,
    pub units: Vec<RandomSchemaUnit>,
}

impl From<BindRandomSchema> for EditPayload {
    fn from(value: BindRandomSchema) -> Self {
        EditPayload::BindRandomSchema(value)
    }
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "random_schema_unit.ts", builder, rename_all = "camelCase")]
pub struct RandomSchemaUnit {
    pub key: String,
    pub render_id: String,
    pub row: usize,
    pub col: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "delete_rows_in_block.ts",
    builder,
    rename_all = "camelCase"
)]
pub struct DeleteRowsInBlock {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub start: usize,
    pub cnt: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "reproduce_cells.ts", builder, rename_all = "camelCase")]
pub struct ReproduceCells {
    pub sheet_idx: usize,
    pub start_row: usize,
    pub start_col: usize,
    // We assume that these cells are extracted sequentially,
    // and we take the first one as the anchor and it will be
    // placed to the (start_row, start_col).
    pub cells: Vec<ReproducibleCell>,
}

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "insert_rows_in_block.ts",
    builder,
    rename_all = "camelCase"
)]
pub struct InsertRowsInBlock {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub start: usize,
    pub cnt: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "insert_cols_in_block.ts",
    builder,
    rename_all = "camelCase"
)]
pub struct InsertColsInBlock {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub start: usize,
    pub cnt: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "delete_cols_in_block.ts",
    builder,
    rename_all = "camelCase"
)]
pub struct DeleteColsInBlock {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub start: usize,
    pub cnt: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "block_style_update.ts", builder, rename_all = "camelCase")]
pub struct BlockStyleUpdate {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub row: usize,
    pub col: usize,
    pub style_update: StyleUpdateType,
}

#[derive(Default, Debug, Clone, TS)]
#[ts(file_name = "set_visible.ts", builder, rename_all = "camelCase")]
pub struct SetVisible {
    pub is_row: bool,
    pub sheet_idx: usize,
    pub start: usize,
    pub visible: bool,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "sheet_cell_id.ts", builder, rename_all = "camelCase")]
pub struct SheetCellId {
    pub sheet_id: SheetId,
    pub cell_id: CellId,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "sheet_row_id.ts", builder, rename_all = "camelCase")]
pub struct SheetRowId {
    pub sheet_id: SheetId,
    pub row_id: RowId,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "sheet_col_id.ts", builder, rename_all = "camelCase")]
pub struct SheetColId {
    pub sheet_id: SheetId,
    pub col_id: ColId,
}

/// `ActionEffect` represents the result of handling an `EditAction`.
/// The `version` will be incremented if the action is successfully handled.
///
/// Additionally, since `LogiSheets` allows developers to define their own functions,
/// the engine may encounter functions it cannot compute directly. In such cases,
/// the engine will return these tasks to the JavaScript side for further processing.
#[derive(Default, Debug, Clone, TS)]
#[ts(file_name = "action_effect.ts", builder, rename_all = "camelCase")]
pub struct ActionEffect {
    /// The latest version after processing an action. 0 means latest version
    pub version: u32,
    /// Tasks should be calculated outside this engine(mainly because of network limitations and customer defined)
    pub async_tasks: Vec<Task>,
    pub status: StatusCode,

    pub value_changed: Vec<SheetCellId>,
    pub cell_removed: Vec<SheetCellId>,
    pub style_changed: Vec<SheetCellId>,

    pub row_inserted: Vec<SheetRowId>,
    pub row_removed: Vec<SheetRowId>,
    pub row_updated: Vec<SheetRowId>,

    pub col_inserted: Vec<SheetColId>,
    pub col_removed: Vec<SheetColId>,
    pub col_updated: Vec<SheetColId>,

    /// Sheet indices whose row-heights or column-widths changed. Lets the
    /// frontend re-render row/column headers (and any UI chrome whose
    /// position depends on row/column metrics) for those sheets without
    /// invalidating cell content.
    pub header_updated: Vec<u32>,

    /// Why the action failed, when `status` is `Err`.
    ///
    /// The error codes are a placeholder — every rejection is currently code 1 —
    /// so the code alone tells a caller nothing. The executor's real message was
    /// already being captured, but only to be printed: `println!` goes nowhere
    /// under wasm, and the wasm layer merely forwarded it to the browser
    /// console. Carrying it here means every host (Node, tests, an agent tool
    /// layer) gets the reason, atomically with the failure it belongs to.
    pub error_message: Option<String>,
}

impl ActionEffect {
    pub fn from_err(e: u8) -> Self {
        ActionEffect {
            status: StatusCode::Err(e),
            ..Default::default()
        }
    }

    /// A failure that carries the executor's own explanation.
    pub fn from_err_with_message(e: u8, message: Option<String>) -> Self {
        ActionEffect {
            status: StatusCode::Err(e),
            error_message: message,
            ..Default::default()
        }
    }

    pub fn from(version: u32, tasks: Vec<Task>, ty: WorkbookUpdateType) -> Self {
        ActionEffect {
            version,
            async_tasks: tasks,
            status: StatusCode::Ok(ty),
            ..Default::default()
        }
    }
}

/// The results of the tasks which are passed to JS side to calculate previously.
#[derive(Default, Debug, Clone, TS)]
#[ts(file_name = "async_func_result.ts", builder, rename_all = "camelCase")]
pub struct AsyncFuncResult {
    pub tasks: Vec<Task>,
    /// These strings can be numbers, strings and other things.
    /// Note that now error types are hardcoded, which means if the
    /// value is equal to the a specific string like `#TIMEOUT!`,
    /// it is reagarded as an error.
    pub values: Vec<String>,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "status_code.ts", tag = "type", rename_all = "camelCase")]
pub enum StatusCode {
    Ok(WorkbookUpdateType), // when there is no other history version for undo/redo, return false.
    Err(u8),
}

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "workbook_update_type.ts",
    tag = "type",
    rename_all = "camelCase"
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

use crate::{ReproducibleCell, controller::style::PatternFill};
use logisheets_workbook::prelude::*;

#[derive(Debug, Clone, TS)]
#[ts(file_name = "cell_style_update.ts", builder, rename_all = "camelCase")]
pub struct CellStyleUpdate {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
    pub ty: StyleUpdateType,
}

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "ephemeral_cell_style_update.ts",
    builder,
    rename_all = "camelCase"
)]
pub struct EphemeralCellStyleUpdate {
    pub sheet_idx: usize,
    pub id: EphemeralId,
    pub ty: StyleUpdateType,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "line_style_update.ts", builder, rename_all = "camelCase")]
pub struct LineStyleUpdate {
    pub sheet_idx: usize,
    pub from: usize,
    pub to: usize,
    pub ty: StyleUpdateType,
    pub row: bool,
}

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "block_line_style_update.ts",
    builder,
    rename_all = "camelCase"
)]
pub struct BlockLineStyleUpdate {
    pub sheet_idx: usize,
    pub block_id: BlockId,
    pub from: usize,
    pub to: usize,
    pub ty: StyleUpdateType,
    pub row: bool,
}

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "block_line_name_field_update.ts",
    builder,
    rename_all = "camelCase"
)]
pub struct BlockLineNameFieldUpdate {
    pub sheet_idx: usize,
    pub block_id: BlockId,
    pub line: usize,
    pub row: bool,
    pub name: Option<String>,
    pub field_id: String,
    // If this is set to true, the block line will skip the default render function
    // and it is the app's responsibility to render the block line
    pub diy_render: Option<bool>,
}

pub type Color = String;

#[derive(Debug, Clone, TS)]
#[ts(file_name = "alignment.ts", rename_all = "camelCase")]
pub struct Alignment {
    pub horizontal: Option<HorizontalAlignment>,
    pub vertical: Option<VerticalAlignment>,
    pub wrap_text: Option<bool>,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "vertical_alignment.ts", rename_all = "camelCase")]
pub enum VerticalAlignment {
    Center,
    Top,
    Bottom,
    Justify,
    Distributed,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "horizontal_alignment.ts", tag = "type")]
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

#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "style_update_type.ts", builder, rename_all = "camelCase")]
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
    pub set_num_fmt: Option<String>,
}

#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "merge_cells.ts", builder, rename_all = "camelCase")]
pub struct MergeCells {
    pub sheet_idx: usize,
    pub start_row: usize,
    pub start_col: usize,
    pub end_row: usize,
    pub end_col: usize,
}
#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "split_merged_cells.ts", builder, rename_all = "camelCase")]
pub struct SplitMergedCells {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
}

/// A person's identity as supplied by the host. In the open-source `src` app
/// only `display_name` is set (the author types their own name); enterprise
/// deployments fill in `user_id` + `provider_id` from their corporate
/// directory. The core dedupes these into stable persons.
#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "author_input.ts", rename_all = "camelCase")]
pub struct AuthorInput {
    pub display_name: String,
    pub user_id: Option<String>,
    pub provider_id: Option<String>,
}

/// A `@mention` span inside a comment's text. `start`/`len` are unicode-scalar
/// offsets into `content` (matching OOXML `startIndex`/`length`). `mention_id`
/// is optional; the core generates one when absent.
#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "comment_mention.ts", rename_all = "camelCase")]
pub struct CommentMention {
    pub start: usize,
    pub len: usize,
    pub author: AuthorInput,
    pub mention_id: Option<String>,
}

/// Add a root comment or a reply to a cell. `comment_id` is a client-generated
/// GUID (so the host can edit/reply/delete without a round-trip); `parent_id`
/// set makes this note a reply to that root. `dt` is a host-provided ISO-8601
/// timestamp (the host owns the clock).
#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "add_comment.ts", builder, rename_all = "camelCase")]
pub struct AddComment {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
    pub comment_id: String,
    pub parent_id: Option<String>,
    pub author: AuthorInput,
    pub dt: String,
    pub content: String,
    pub mentions: Vec<CommentMention>,
}

#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "edit_comment.ts", builder, rename_all = "camelCase")]
pub struct EditComment {
    pub sheet_idx: usize,
    pub comment_id: String,
    pub content: String,
    pub mentions: Vec<CommentMention>,
}

#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "delete_comment.ts", builder, rename_all = "camelCase")]
pub struct DeleteComment {
    pub sheet_idx: usize,
    pub comment_id: String,
}

/// Mark a comment thread as resolved / reopened (OOXML `done`).
#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "resolve_comment.ts", builder, rename_all = "camelCase")]
pub struct ResolveComment {
    pub sheet_idx: usize,
    pub comment_id: String,
    pub resolved: bool,
}

/// Register or refresh a person without authoring a comment — e.g. to
/// pre-load directory users so they can be mentioned before they've posted.
#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "upsert_person.ts", builder, rename_all = "camelCase")]
pub struct UpsertPerson {
    pub display_name: String,
    pub user_id: Option<String>,
    pub provider_id: Option<String>,
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

impl From<AddComment> for EditPayload {
    fn from(value: AddComment) -> Self {
        EditPayload::AddComment(value)
    }
}

impl From<EditComment> for EditPayload {
    fn from(value: EditComment) -> Self {
        EditPayload::EditComment(value)
    }
}

impl From<DeleteComment> for EditPayload {
    fn from(value: DeleteComment) -> Self {
        EditPayload::DeleteComment(value)
    }
}

impl From<ResolveComment> for EditPayload {
    fn from(value: ResolveComment) -> Self {
        EditPayload::ResolveComment(value)
    }
}

impl From<UpsertPerson> for EditPayload {
    fn from(value: UpsertPerson) -> Self {
        EditPayload::UpsertPerson(value)
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
impl From<SetCellImage> for EditPayload {
    fn from(value: SetCellImage) -> Self {
        EditPayload::SetCellImage(value)
    }
}
impl From<DeleteCellImage> for EditPayload {
    fn from(value: DeleteCellImage) -> Self {
        EditPayload::DeleteCellImage(value)
    }
}
impl Payload for SetCellImage {}
impl Payload for DeleteCellImage {}
impl From<MoveChart> for EditPayload {
    fn from(value: MoveChart) -> Self {
        EditPayload::MoveChart(value)
    }
}
impl Payload for MoveChart {}
impl From<CreateConditionalFormattingRule> for EditPayload {
    fn from(value: CreateConditionalFormattingRule) -> Self {
        EditPayload::CreateConditionalFormattingRule(value)
    }
}
impl Payload for CreateConditionalFormattingRule {}
impl From<UpdateConditionalFormattingRule> for EditPayload {
    fn from(value: UpdateConditionalFormattingRule) -> Self {
        EditPayload::UpdateConditionalFormattingRule(value)
    }
}
impl Payload for UpdateConditionalFormattingRule {}
impl From<MoveConditionalFormattingRule> for EditPayload {
    fn from(value: MoveConditionalFormattingRule) -> Self {
        EditPayload::MoveConditionalFormattingRule(value)
    }
}
impl Payload for MoveConditionalFormattingRule {}
impl From<DeleteConditionalFormattingRule> for EditPayload {
    fn from(value: DeleteConditionalFormattingRule) -> Self {
        EditPayload::DeleteConditionalFormattingRule(value)
    }
}
impl Payload for DeleteConditionalFormattingRule {}
impl From<DeleteChart> for EditPayload {
    fn from(value: DeleteChart) -> Self {
        EditPayload::DeleteChart(value)
    }
}
impl Payload for DeleteChart {}
impl From<CreateChart> for EditPayload {
    fn from(value: CreateChart) -> Self {
        EditPayload::CreateChart(value)
    }
}
impl Payload for CreateChart {}
impl From<UpdateChart> for EditPayload {
    fn from(value: UpdateChart) -> Self {
        EditPayload::UpdateChart(value)
    }
}
impl Payload for UpdateChart {}
impl From<CreateBlock> for EditPayload {
    fn from(value: CreateBlock) -> Self {
        EditPayload::CreateBlock(value)
    }
}
impl From<SetBlockDescription> for EditPayload {
    fn from(value: SetBlockDescription) -> Self {
        EditPayload::SetBlockDescription(value)
    }
}
impl From<SetBlockPermissions> for EditPayload {
    fn from(value: SetBlockPermissions) -> Self {
        EditPayload::SetBlockPermissions(value)
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
impl From<EphemeralCellRemove> for EditPayload {
    fn from(value: EphemeralCellRemove) -> Self {
        EditPayload::EphemeralCellRemove(value)
    }
}
impl From<ConvertBlock> for EditPayload {
    fn from(value: ConvertBlock) -> Self {
        EditPayload::ConvertBlock(value)
    }
}
impl From<CreateLink> for EditPayload {
    fn from(value: CreateLink) -> Self {
        EditPayload::CreateLink(value)
    }
}

impl Payload for CreateLink {}
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
impl Payload for EphemeralCellRemove {}
impl Payload for ConvertBlock {}
impl Payload for UpsertFieldRenderInfo {}
impl Payload for BindFormSchema {}
impl Payload for UpsertFieldFormulas {}
impl Payload for BindRandomSchema {}
impl Payload for RestoreCheckpoint {}
impl Payload for MergeCells {}
impl Payload for SplitMergedCells {}
impl Payload for AddComment {}
impl Payload for EditComment {}
impl Payload for DeleteComment {}
impl Payload for ResolveComment {}
impl Payload for UpsertPerson {}

#[cfg(test)]
mod tests {
    use super::VerticalAlignment;

    #[test]
    fn test_should_have_double_quote() {
        let s1 = "\"center\"".to_string();
        let _: VerticalAlignment = serde_json::from_str(&s1).unwrap();
    }
}
