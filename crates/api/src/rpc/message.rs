//! The RPC wire protocol: [`Message`] (one variant per method), its params
//! structs, and [`WorkbookMethods`], the typed method table the TS client is
//! generated from (`buildtools` walks it; `Message` itself is not emitted).
//!
//! Conventions every params struct follows unless its own doc says otherwise:
//!
//! - Rows and columns are 0-based (`row: 0, col: 0` is `A1`), and a
//!   `start*`/`end*` pair is an inclusive range.
//! - `sheetIdx` is the sheet's current position in the tab order and shifts
//!   when sheets are added or removed; `sheetId` is a stable internal
//!   id. Convert with `getSheetId` / `getSheetIdx`.
//! - Coordinates on block-scoped methods (`getBlockRowId`,
//!   `getDiyCellIdWithBlockId`, `lookupAppendixUpward`, ...) are relative to
//!   the block's top-left cell.
//! - A failure comes back as an `ErrorMessage`, not a panic or a throw. The
//!   exception is `handleTransaction`, whose engine rejections arrive inside
//!   the `ActionEffect` (see [`HandleTransactionParams`]).
//! - Struct and field `///` docs are copied into the generated TS by
//!   `yarn gen-bindings`; docs on [`WorkbookMethods`] fields are not.

use gents_derives::{Interface, TS};

use crate::BlockId;
use crate::{
    ActionEffect, AppData, AppendixWithCell, BlockActor, BlockDataRow, BlockField, BlockInfo,
    BlockModifyInfo, BlockOp, BlockOpForPayload, BlockOpPolicy, BlockSortOrder,
    CellCoordinateWithSheet, CellImageInfo, CellInfo, CellInput, CellPosition, CellRefRange,
    CfRuleInfo, ChartInfo, ColId, Comment, DefinedNameInfo, DependentCell, DisplayWindow,
    DisplayWindowWithStartPoint, DuplicateBlockKey, EditPayload, EnumSetInfo, ErrorMessage,
    FieldValidationVerdict, FormulaDisplayInfo, LinkInfo, MergeCell, PivotExcelNote, PivotPlan,
    PivotSpecParts, ReproducibleCell, RowId, RowInfo, SaveFileResult, ShadowCellInfo, SheetCellId,
    SheetCoordinate, SheetDimension, SheetId, SheetInfo, Style, TempStatusDiff, Value,
};

// ============================================================================
// Params structs. Each derives TS and is emitted to its own `file_name` under
// packages/web/src/bindings when `WorkbookMethods` references it.
// ============================================================================

/// One RPC request: a variant per method, carrying that method's params.
///
/// On the wire a unit variant is its bare camelCase name (`"undo"`) and every
/// other variant is `{method, value}`, `value` being the params struct with
/// camelCase fields. The transport pairs each message with a book id, which
/// every method except `NewWorkbook` requires. This enum only decodes requests;
/// the generated TS client is built from [`WorkbookMethods`].
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_message.ts", tag = "method", rename_all = "camelCase")]
pub enum Message {
    GetSheetDimension(GetSheetDimensionParams),
    GetDependents(GetDependentsParams),
    GetPrecedents(GetPrecedentsParams),
    GetLinkableBlocks(GetLinkableBlocksParams),
    GetLinks(GetLinksParams),
    GetDisplayWindow(GetDisplayWindowParams),
    GetCell(GetCellParams),
    GetCellListValidation(GetCellParams),
    GetValue(GetCellParams),
    GetFormula(GetCellParams),
    GetStyle(GetCellParams),
    GetCells(GetCellsParams),
    GetCellsExceptWindow(GetCellsExceptWindowParams),
    PredictFill(PredictFillParams),
    GetReproducibleCells(GetReproducibleCellsParams),
    GetReproducibleCell(GetReproducibleCellParams),
    GetCellPosition(GetCellPositionParams),
    GetRowHeight(GetRowHeightParams),
    GetColWidth(GetColWidthParams),
    HandleTransaction(HandleTransactionParams),
    ToggleStatus(ToggleStatusParams),
    BatchGetCellInfoById(BatchGetCellInfoByIdParams),
    BatchGetCellCoordinateWithSheetById(BatchGetCellCoordinateWithSheetByIdParams),
    GetSheetNameByIdx(GetSheetNameByIdxParams),
    LoadWorkbook(LoadWorkbookParams),
    SaveWorkbook(SaveParams),
    GetCellId(GetCellIdParams),
    GetMergedCells(GetMergedCellsParams),
    GetComments(GetCommentsParams),
    GetCellImages(GetCellImagesParams),
    GetCharts(GetChartsParams),
    GetConditionalFormattingRules(GetConditionalFormattingRulesParams),
    CalcCondition(CalcConditionParams),
    GetCellIdByBlockRef(GetCellIdByBlockRefParams),
    ExportBlockData(ExportBlockDataParams),
    GetTempStatusChanges,
    IsInTempMode,
    GetBlockDisplayWindow(GetBlockDisplayWindowParams),
    GetBlockRowId(GetBlockRowIdParams),
    GetBlockColId(GetBlockColIdParams),
    GetSheetIdx(GetSheetIdxParams),
    GetSheetId(GetSheetIdParams),
    GetBlockValues(GetBlockValuesParams),
    GetBlockSortOrder(GetBlockSortOrderParams),
    PivotPlan(PivotPlanParams),
    PivotExcelNote(PivotPlanParams),
    PivotPlanFor(PivotPlanForParams),
    MayModifyBlock(MayModifyBlockParams),
    CheckFieldValidation(CheckFieldValidationParams),
    GetBlockModifyInfo(GetBlockModifyInfoParams),
    GetShadowCellId(GetShadowCellIdParams),
    GetShadowCellIds(GetShadowCellIdsParams),
    GetShadowInfoById(GetShadowInfoByIdParams),
    GetDiyCellIdWithBlockId(GetDiyCellIdWithBlockIdParams),
    LookupAppendixUpward(LookupAppendixUpwardParams),
    GetNextVisibleCell(GetNextVisibleCellParams),
    GetDataBoundary(GetDataBoundaryParams),
    GetDisplayUnitsOfFormula(GetDisplayUnitsOfFormulaParams),
    GetRowInfo(GetRowInfoParams),
    GetAvailableBlockId(GetAvailableBlockIdParams),
    CheckFormula(CheckFormulaParams),

    GetBlockInfo(GetBlockInfoParams),
    GetCellInfos(GetCellInfosParams),
    GetAllBlockFields,
    DuplicateBlockKeys,
    GetEnumSets,
    GetDefinedNames,
    GetBlockOpForPayloads,
    GetBlockOpPolicies(GetBlockOpPoliciesParams),
    Undo,
    Redo,
    CleanHistory,
    NewWorkbook,
    Release,
    GetSheetCount,
    GetVersion,
    GetAllSheetInfo,
    GetFormulaFunctionNames,
    GetAppData,
    // Named to match `cleanup_temp_status` on the methods interface below.
    // They disagreed — `CleanTempStatus` on the wire, `cleanupTempStatus` in the
    // generated TS — and a client that forwards method names verbatim (the
    // runtime's Proxy) therefore called something the engine did not recognize.
    CleanupTempStatus,
    CommitTempStatus,
    CheckBindBlock(CheckBindBlockParams),
    GetDisplayWindowWithStartPoint(GetDisplayWindowWithStartPointParams),
    GetDisplayWindowWithinCell(GetDisplayWindowWithinCellParams),
    GetColInfo(GetColInfoParams),
    GetFullyCoveredBlocks(GetFullyCoveredBlocksParams),

    GetAllBlocks(GetAllBlocksParams),

    SaveCheckpoint(SaveCheckpointParams),
    DeleteCheckpoint(DeleteCheckpointParams),
    ListCheckpoints,
}

/// An inclusive rectangle of cells, row-major. Same contract as [`GetCellsParams`].
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_cell_infos_params.ts", rename_all = "camelCase")]
pub struct GetCellInfosParams {
    pub sheet_idx: usize,
    pub start_row: usize,
    pub start_col: usize,
    pub end_row: usize,
    pub end_col: usize,
}

/// The used extent of a sheet: `maxRow`/`maxCol` are the 0-based
/// coordinates of the furthest non-empty cell, `height`/`width` the position
/// of that cell's top-left corner (see [`GetCellPositionParams`] for units).
/// An empty sheet answers all zeros.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_sheet_dimension_params.ts",
    rename_all = "camelCase"
)]
pub struct GetSheetDimensionParams {
    pub sheet_id: SheetId,
}

/// Cells whose formulas read any cell in this inclusive rectangle (Excel
/// "trace dependents"). The corners may be given in either order. Dependents
/// can live on other sheets; each carries its own `sheetIdx`.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_dependents_params.ts", rename_all = "camelCase")]
pub struct GetDependentsParams {
    pub sheet_idx: usize,
    pub start_row: usize,
    pub start_col: usize,
    pub end_row: usize,
    pub end_col: usize,
}

/// The cells and ranges one cell's formula references (Excel "trace precedents").
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_precedents_params.ts", rename_all = "camelCase")]
pub struct GetPrecedentsParams {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
}

/// Blocks on this sheet a `colCnt`-wide range could be linked to: same column count, and not already a link target.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_linkable_blocks_params.ts",
    rename_all = "camelCase"
)]
pub struct GetLinkableBlocksParams {
    pub sheet_idx: usize,
    pub col_cnt: usize,
}

/// Every range on this sheet that is linked to a block, resolved to sheet coordinates.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_links_params.ts", rename_all = "camelCase")]
pub struct GetLinksParams {
    pub sheet_idx: usize,
}

/// Height of one row, in points. Rows with no explicit height answer the
/// sheet's default (15 unless the file says otherwise).
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_row_height_params.ts", rename_all = "camelCase")]
pub struct GetRowHeightParams {
    pub sheet_id: SheetId,
    pub row_idx: usize,
}

/// Width of one column, in Excel character-width units (not pixels or
/// points). Columns with no explicit width answer the sheet's default (8.43
/// unless the file says otherwise).
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_col_width_params.ts", rename_all = "camelCase")]
pub struct GetColWidthParams {
    pub sheet_id: SheetId,
    pub col_idx: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_cell_info_params.ts", rename_all = "camelCase")]
pub struct GetCellInfoParams {
    pub sheet_id: SheetId,
    pub row: usize,
    pub col: usize,
}

/// Everything needed to paint an inclusive rectangle: cells, row and column
/// infos, comments, merges and blocks. Hidden rows and columns are left out.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_display_window_params.ts",
    rename_all = "camelCase"
)]
pub struct GetDisplayWindowParams {
    pub sheet_idx: usize,
    pub start_row: usize,
    pub start_col: usize,
    pub end_row: usize,
    pub end_col: usize,
}

/// A display window chosen by position rather than index: the rows and
/// columns covering `height` x `width` from (`startX`, `startY`), plus one
/// extra row and column before the start. The answer's `startX`/`startY` is
/// where its first row and column begin. Units as in [`GetCellPositionParams`].
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_display_window_with_start_point_params.ts",
    rename_all = "camelCase"
)]
pub struct GetDisplayWindowWithStartPointParams {
    pub sheet_idx: usize,
    pub start_x: f64,
    pub start_y: f64,
    pub height: f64,
    pub width: f64,
}

/// A display window of `height` x `width` placed around a cell, so a caller
/// can jump the viewport to it. Units as in [`GetCellPositionParams`].
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_display_window_within_cell_params.ts",
    rename_all = "camelCase"
)]
pub struct GetDisplayWindowWithinCellParams {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
    pub height: f64,
    pub width: f64,
}

/// One cell by position. Shared by `getCell`, `getValue`, `getFormula`, `getStyle` and `getCellListValidation`.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_cell_params.ts", rename_all = "camelCase")]
pub struct GetCellParams {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
}

/// An inclusive rectangle of cells, returned row-major.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_cells_params.ts", rename_all = "camelCase")]
pub struct GetCellsParams {
    pub sheet_idx: usize,
    pub start_row: usize,
    pub start_col: usize,
    pub end_row: usize,
    pub end_col: usize,
}

/// Predict a fill-handle drag: `src` is the selected range, `dst` the
/// disjoint range dragged over. Returns one `CellInput` per `dst` cell and
/// writes nothing; send them back as one transaction to apply them.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_predict_fill_params.ts", rename_all = "camelCase")]
pub struct PredictFillParams {
    pub sheet_idx: usize,
    pub src_start_row: usize,
    pub src_start_col: usize,
    pub src_end_row: usize,
    pub src_end_col: usize,
    pub dst_start_row: usize,
    pub dst_start_col: usize,
    pub dst_end_row: usize,
    pub dst_end_col: usize,
}

/// Cells in the outer rectangle minus those in the inner `window*`
/// rectangle, row-major. For fetching only what a scrolled viewport newly
/// exposes.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_cells_except_window_params.ts",
    rename_all = "camelCase"
)]
pub struct GetCellsExceptWindowParams {
    pub sheet_idx: usize,
    pub start_row: usize,
    pub start_col: usize,
    pub end_row: usize,
    pub end_col: usize,
    pub window_start_row: usize,
    pub window_start_col: usize,
    pub window_end_row: usize,
    pub window_end_col: usize,
}

/// A cell's value, raw style and appendices, in a form that can be written back elsewhere (copy/paste).
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_reproducible_cell_params.ts",
    rename_all = "camelCase"
)]
pub struct GetReproducibleCellParams {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
}

/// Batch form of [`GetReproducibleCellParams`]: one answer per coordinate, in order.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_reproducible_cells_params.ts",
    rename_all = "camelCase"
)]
pub struct GetReproducibleCellsParams {
    pub sheet_idx: usize,
    pub coordinates: Vec<SheetCoordinate>,
}

/// A block's layout, schema and governance, with its cells.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_block_info_params.ts", rename_all = "camelCase")]
pub struct GetBlockInfoParams {
    pub sheet_id: SheetId,
    pub block_id: u32,
}

/// The top-left corner of a cell, measured from the sheet origin. `y` sums row
/// heights (points) and `x` sums column widths (character units), so the two
/// axes are in different units; convert before mixing them.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_cell_position_params.ts",
    rename_all = "camelCase"
)]
pub struct GetCellPositionParams {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
}

/// Apply a `Transaction` to the workbook.
///
/// An engine rejection does NOT surface as an `ErrorMessage` or a thrown
/// error: the call resolves with an `ActionEffect` whose `status` is `Err`
/// and whose `error_message` names the payload it stopped at. Nothing in the
/// transaction is applied in that case. Check `status` whenever a failed write
/// matters, or the failure passes silently.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_handle_transaction_params.ts",
    rename_all = "camelCase"
)]
pub struct HandleTransactionParams {
    pub transaction: Transaction,
}

/// Does nothing. The temp branch is entered by sending a transaction with
/// `temp: true` and left with `commitTempStatus` / `cleanupTempStatus`; this
/// method is kept only so old callers do not fail.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_toggle_status_params.ts", rename_all = "camelCase")]
pub struct ToggleStatusParams {
    pub use_temp: bool,
}

/// Resolve cells by id rather than position. Fails on the first id that no longer exists.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_batch_get_cell_info_by_id_params.ts",
    rename_all = "camelCase"
)]
pub struct BatchGetCellInfoByIdParams {
    pub ids: Vec<SheetCellId>,
}

/// The current sheet index and coordinate of each cell id, in order. Fails on the first id that no longer exists.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_batch_get_cell_coordinate_with_sheet_by_id_params.ts",
    rename_all = "camelCase"
)]
pub struct BatchGetCellCoordinateWithSheetByIdParams {
    pub ids: Vec<SheetCellId>,
}

/// The name of the sheet at this index.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_sheet_name_by_idx_params.ts",
    rename_all = "camelCase"
)]
pub struct GetSheetNameByIdxParams {
    pub idx: usize,
}

/// Replace the workbook behind this book id with one parsed from an .xlsx
/// file. Undo history starts empty.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_load_workbook_params.ts", rename_all = "camelCase")]
pub struct LoadWorkbookParams {
    /// The raw .xlsx file bytes.
    pub content: Vec<u8>,
    /// The workbook's name, used as its book name inside the engine.
    pub name: String,
}

/// Serialize the workbook to .xlsx bytes.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_save_params.ts", rename_all = "camelCase")]
pub struct SaveParams {
    /// Opaque host state to store in the file. It becomes the workbook's only
    /// app-data entry, named `logisheets`: any other entry is dropped. Read it
    /// back with `getAppData`.
    pub app_data: String,
    /// Write block formulas as `A1` references instead of `BLOCKREF(...)`.
    ///
    /// Off by default: the named form is the readable one and reopens here
    /// intact. Turn it on for a file another spreadsheet has to recalculate —
    /// no one else knows the BLOCKREF functions. See `FormulaFormat`.
    pub resolve_block_refs: Option<bool>,
}

/// The stable id of the cell at this position. The id survives row and column
/// inserts and deletes, where the position does not.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_cell_id_params.ts", rename_all = "camelCase")]
pub struct GetCellIdParams {
    pub sheet_idx: usize,
    pub row_idx: usize,
    pub col_idx: usize,
}

/// Merged ranges that overlap this inclusive rectangle.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_merged_cells_params.ts", rename_all = "camelCase")]
pub struct GetMergedCellsParams {
    pub sheet_idx: usize,
    pub start_row: usize,
    pub start_col: usize,
    pub end_row: usize,
    pub end_col: usize,
}

/// Every comment thread on a sheet.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_comments_params.ts", rename_all = "camelCase")]
pub struct GetCommentsParams {
    pub sheet_idx: usize,
}

/// Every in-cell image on a sheet.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_cell_images_params.ts", rename_all = "camelCase")]
pub struct GetCellImagesParams {
    pub sheet_idx: usize,
}

/// Every chart on a sheet.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_charts_params.ts", rename_all = "camelCase")]
pub struct GetChartsParams {
    pub sheet_idx: usize,
}

/// Every conditional-formatting rule on a sheet, with the spec needed to edit it.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_conditional_formatting_rules_params.ts",
    rename_all = "camelCase"
)]
pub struct GetConditionalFormattingRulesParams {
    pub sheet_idx: usize,
}

/// Evaluate a formula for its truth value.
///
/// Read-only for the caller: the formula is evaluated in a scratch cell and
/// the workbook is restored afterwards, so the version does not move and an
/// open temp branch survives. It errors when the formula is invalid, evaluates
/// to an error, or `sheet_idx` is out of range.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_calc_condition_params.ts", rename_all = "camelCase")]
pub struct CalcConditionParams {
    pub sheet_idx: usize,
    pub condition: String,
}

/// Resolve a `BLOCKREF(refName, key, field)` triple to the cell it names,
/// the same way the formula does at evaluation time. Errors on an unknown
/// ref name, key or field.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_cell_id_by_block_ref_params.ts",
    rename_all = "camelCase"
)]
pub struct GetCellIdByBlockRefParams {
    pub ref_name: String,
    pub key: String,
    pub field: String,
}

/// A bound block's rows as display values. Columns follow the schema's field
/// order, narrowed by `fieldFilter`; rows follow the block's key order.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_export_block_data_params.ts",
    rename_all = "camelCase"
)]
pub struct ExportBlockDataParams {
    pub ref_name: String,
    /// Keep only rows whose key value is in this list; `null`/omitted = all.
    pub key_filter: Option<Vec<String>>,
    /// Keep only these fields (schema order preserved); `null`/omitted = all.
    pub field_filter: Option<Vec<String>>,
}

/// A display window covering one block.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_block_display_window_params.ts",
    rename_all = "camelCase"
)]
pub struct GetBlockDisplayWindowParams {
    pub sheet_id: SheetId,
    pub block_id: BlockId,
}

/// The stable row id at a block-relative row index (0 = the block's first row).
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_block_row_id_params.ts", rename_all = "camelCase")]
pub struct GetBlockRowIdParams {
    pub sheet_id: SheetId,
    pub block_id: BlockId,
    pub row_idx: usize,
}

/// The stable column id at a block-relative column index (0 = the block's first column).
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_block_col_id_params.ts", rename_all = "camelCase")]
pub struct GetBlockColIdParams {
    pub sheet_id: SheetId,
    pub block_id: BlockId,
    pub col_idx: usize,
}

/// The current index of the sheet with this id.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_sheet_idx_params.ts", rename_all = "camelCase")]
pub struct GetSheetIdxParams {
    pub sheet_id: SheetId,
}

/// The stable id of the sheet at this index.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_sheet_id_params.ts", rename_all = "camelCase")]
pub struct GetSheetIdParams {
    pub sheet_idx: usize,
}

/// Display strings of block cells addressed by id. `rowIds` and `colIds` are
/// zipped pairwise, not crossed: the answer has one string per pair, and an
/// empty cell answers `""`.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_block_values_params.ts", rename_all = "camelCase")]
pub struct GetBlockValuesParams {
    pub sheet_id: SheetId,
    pub block_id: BlockId,
    pub row_ids: Vec<RowId>,
    pub col_ids: Vec<ColId>,
}

/// The line order (rows or columns, per the block's schema) that would sort a
/// block by one field. Read-only: apply it with a `ReorderBlockLines`
/// transaction. Errors on a random-schema block or an unknown field.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_block_sort_order_params.ts",
    rename_all = "camelCase"
)]
pub struct GetBlockSortOrderParams {
    pub sheet_idx: usize,
    pub block_id: BlockId,
    /// The name of the field to sort by.
    pub field: String,
    /// Ascending when true, descending when false.
    pub asc: bool,
}

/// The shape a pivot block should have now, and whether it has it. Read-only.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_pivot_plan_params.ts", rename_all = "camelCase")]
pub struct PivotPlanParams {
    pub sheet_idx: usize,
    /// The PIVOT block — not its source. Errors when the block is not a pivot.
    pub block_id: BlockId,
}

/// The shape a pivot WOULD have for a recipe no block carries yet. Read-only.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_pivot_plan_for_params.ts", rename_all = "camelCase")]
pub struct PivotPlanForParams {
    pub sheet_idx: usize,
    /// The block to be analysed — the SOURCE, since the pivot block does not
    /// exist yet. Used to create a pivot at its right size in one transaction.
    pub source_block: BlockId,
    pub spec: PivotSpecParts,
}

/// Ask whether an actor may perform one operation on a block.
///
/// The engine cannot enforce a block's write policy — a payload carries no
/// trace of who prompted it — so the host gates the edit and asks this first.
/// Answering it in the core keeps the browser, node, the desktop app and the
/// craft runtime from drifting apart on what a policy means.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "may_modify_block_params.ts", rename_all = "camelCase")]
pub struct MayModifyBlockParams {
    pub sheet_idx: usize,
    pub block_id: BlockId,
    pub op: BlockOp,
    pub actor: BlockActor,
}

/// Which policies a block declares, per operation — beyond whether a given
/// actor is allowed, which is [`MayModifyBlockParams`].
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "get_block_op_policies_params.ts",
    rename_all = "camelCase"
)]
pub struct GetBlockOpPoliciesParams {
    pub sheet_idx: usize,
    pub block_id: BlockId,
}

/// Ask whether a value would break a block field's validation rule, before
/// writing it.
///
/// The pairing with [`MayModifyBlockParams`] is the whole point: a host that
/// wants to enforce `BlockOp::OverrideValidation` needs both halves — is this
/// write a violation, and is this actor allowed to make one.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "check_field_validation_params.ts",
    rename_all = "camelCase"
)]
pub struct CheckFieldValidationParams {
    pub sheet_idx: usize,
    /// Sheet-absolute coordinates, not block-relative — this is asked from the
    /// grid's write path, which speaks in sheet coordinates.
    pub row: usize,
    pub col: usize,
    /// The value the caller is about to write, exactly as the user typed it.
    pub proposed: String,
}

/// A block's governance metadata on its own — owner, default policy,
/// per-operation overrides, description — without its cells.
///
/// `getBlockInfo` carries the same fields but drags every cell along with
/// them, which is the wrong shape for a permission check running once per
/// payload in a transaction.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "get_block_modify_info_params.ts",
    rename_all = "camelCase"
)]
pub struct GetBlockModifyInfoParams {
    pub sheet_idx: usize,
    pub block_id: BlockId,
}

/// The id of a shadow cell: a hidden ephemeral cell the engine keeps beside a
/// real one to hold a derived result (a validation verdict, a conditional
/// format). Read its value through the returned id.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_shadow_cell_id_params.ts",
    rename_all = "camelCase"
)]
pub struct GetShadowCellIdParams {
    pub sheet_idx: usize,
    pub row_idx: usize,
    pub col_idx: usize,
    /// Which derived computation this shadow represents. Optional for
    /// backward compatibility — omitted requests are treated as the
    /// long-standing Validation shadow so existing callers (the
    /// ValidationCell widget chiefly) keep working.
    pub kind: Option<crate::ShadowKind>,
}

/// Batch form of [`GetShadowCellIdParams`]. `rowIdx` and `colIdx` are zipped
/// pairwise and must have the same length.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_shadow_cell_ids_params.ts",
    rename_all = "camelCase"
)]
pub struct GetShadowCellIdsParams {
    pub sheet_idx: usize,
    pub row_idx: Vec<usize>,
    pub col_idx: Vec<usize>,
    /// As in [`GetShadowCellIdParams::kind`].
    pub kind: Option<crate::ShadowKind>,
}

/// Where a shadow cell's host cell sits on screen, and the shadow's value.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_shadow_info_by_id_params.ts",
    rename_all = "camelCase"
)]
pub struct GetShadowInfoByIdParams {
    pub shadow_id: u64,
}

/// The craft-owned (DIY) cell id at a block-relative position, or `null` when
/// that cell is not a DIY cell.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_diy_cell_id_with_block_id_params.ts",
    rename_all = "camelCase"
)]
pub struct GetDiyCellIdWithBlockIdParams {
    pub sheet_id: SheetId,
    pub block_id: BlockId,
    pub row: usize,
    pub col: usize,
}

/// Find the nearest appendix a craft attached, searching upward from a
/// block-relative cell through the rows above it in the same column. Errors
/// when none is found.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_lookup_appendix_upward_params.ts",
    rename_all = "camelCase"
)]
pub struct LookupAppendixUpwardParams {
    pub sheet_id: SheetId,
    pub block_id: BlockId,
    pub row: usize,
    pub col: usize,
    pub craft_id: String,
    pub tag: u8,
}

/// The next cell in `direction` that is not in a hidden row or column (arrow
/// key navigation).
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_next_visible_cell_params.ts",
    rename_all = "camelCase"
)]
pub struct GetNextVisibleCellParams {
    pub sheet_idx: usize,
    pub row_idx: usize,
    pub col_idx: usize,
    pub direction: Direction,
}

/// Where Ctrl+Arrow lands from this cell: the next data or block boundary in `direction`.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_data_boundary_params.ts",
    rename_all = "camelCase"
)]
pub struct GetDataBoundaryParams {
    pub sheet_idx: usize,
    pub row_idx: usize,
    pub col_idx: usize,
    pub direction: Direction,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_direction.ts", rename_all = "camelCase")]
pub enum Direction {
    Up,
    Down,
    Left,
    Right,
}

/// Tokenize a formula for syntax highlighting. Needs no workbook state.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_display_units_of_formula_params.ts",
    rename_all = "camelCase"
)]
pub struct GetDisplayUnitsOfFormulaParams {
    pub formula: String,
}

/// A row's height and visibility. A row with nothing set answers defaults.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_row_info_params.ts", rename_all = "camelCase")]
pub struct GetRowInfoParams {
    pub sheet_idx: usize,
    pub row_idx: usize,
}

/// A block id not yet used on this sheet, for a `CreateBlock` payload.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_available_block_id_params.ts",
    rename_all = "camelCase"
)]
pub struct GetAvailableBlockIdParams {
    pub sheet_idx: usize,
}

/// Whether a string lexes as a formula. It must start with `=`; the check is
/// lexical only and says nothing about whether names or functions exist.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_check_formula_params.ts", rename_all = "camelCase")]
pub struct CheckFormulaParams {
    pub formula: String,
}

/// Whether a `rowCount` x `colCount` schema fits inside this block (both no
/// larger than the block's size).
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_check_bind_block_params.ts", rename_all = "camelCase")]
pub struct CheckBindBlockParams {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub row_count: usize,
    pub col_count: usize,
}

/// A column's width and visibility. A column with nothing set answers defaults.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_col_info_params.ts", rename_all = "camelCase")]
pub struct GetColInfoParams {
    pub sheet_idx: usize,
    pub col_idx: usize,
}

/// Blocks across one sheet or the whole workbook.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_all_blocks_params.ts", rename_all = "camelCase")]
pub struct GetAllBlocksParams {
    /// If neither `sheet_idx` nor `sheet_id` is set, returns blocks
    /// across every sheet in the workbook.
    pub sheet_idx: Option<usize>,
    pub sheet_id: Option<SheetId>,
}

/// Snapshot the current workbook state under a label. Answers the number of
/// checkpoints stored afterwards. Restoring goes through the
/// `RestoreCheckpoint` payload so it lands on the undo stack.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_save_checkpoint_params.ts", rename_all = "camelCase")]
pub struct SaveCheckpointParams {
    /// Label to store the snapshot under. Overwrites an existing
    /// checkpoint with the same label.
    pub label: String,
    /// Optional human-readable description, echoed back by
    /// `ListCheckpoints` for the UI/agent.
    pub description: Option<String>,
}

/// Drop a named checkpoint. Answers whether it existed.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_delete_checkpoint_params.ts",
    rename_all = "camelCase"
)]
pub struct DeleteCheckpointParams {
    pub label: String,
}

/// A checkpoint as `listCheckpoints` reports it: label and description, without the snapshot.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "checkpoint_meta.ts", rename_all = "camelCase")]
pub struct CheckpointMetaDto {
    pub label: String,
    pub description: Option<String>,
}

impl From<crate::CheckpointMeta> for CheckpointMetaDto {
    fn from(m: crate::CheckpointMeta) -> Self {
        Self {
            label: m.label,
            description: m.description,
        }
    }
}

/// Blocks lying entirely inside the `rowCnt` x `colCnt` rectangle whose
/// top-left is (`row`, `col`). A count of 0 covers nothing.
#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_fully_covered_blocks_params.ts",
    rename_all = "camelCase"
)]
pub struct GetFullyCoveredBlocksParams {
    pub sheet_id: SheetId,
    pub row: usize,
    pub col: usize,
    pub row_cnt: usize,
    pub col_cnt: usize,
}

/// A batch of payloads applied atomically, in order: each payload sees the
/// effects of the ones before it, and if one fails none are applied.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_transaction.ts", rename_all = "camelCase")]
pub struct Transaction {
    pub payloads: Vec<EditPayload>,
    /// Record the result as one undo step. `false` applies it without an undo
    /// entry.
    pub undoable: bool,
    /// Apply on the workbook's temp branch, opening it if none is open. There is
    /// one branch per workbook: later temp transactions accumulate on it until
    /// `commitTempStatus` (one undo step for all of them) or `cleanupTempStatus`
    /// (discarded). A non-temp transaction discards an open branch first.
    pub temp: bool,
}

#[derive(Debug)]
// ============================================================================
// WorkbookMethods Interface - generates TypeScript interface
// ============================================================================
#[derive(Interface)]
#[ts(file_name = "rpc_workbook_methods.ts", rename_all = "camelCase")]
pub struct WorkbookMethods {
    // Sheet operations
    pub get_sheet_dimension: fn(
        params: GetSheetDimensionParams,
        book_id: Option<usize>,
    ) -> Result<SheetDimension, ErrorMessage>,
    // Dependency tracking (Excel "trace precedents/dependents").
    pub get_dependents: fn(
        params: GetDependentsParams,
        book_id: Option<usize>,
    ) -> Result<Vec<DependentCell>, ErrorMessage>,
    pub get_precedents: fn(
        params: GetPrecedentsParams,
        book_id: Option<usize>,
    ) -> Result<Vec<CellRefRange>, ErrorMessage>,
    pub get_all_sheet_info: fn(book_id: Option<usize>) -> Result<Vec<SheetInfo>, ErrorMessage>,
    pub get_formula_function_names: fn(book_id: Option<usize>) -> Result<Vec<String>, ErrorMessage>,
    pub get_sheet_idx:
        fn(params: GetSheetIdxParams, book_id: Option<usize>) -> Result<usize, ErrorMessage>,
    pub get_sheet_id:
        fn(params: GetSheetIdParams, book_id: Option<usize>) -> Result<u32, ErrorMessage>,
    pub get_sheet_name_by_idx:
        fn(params: GetSheetNameByIdxParams, book_id: Option<usize>) -> Result<String, ErrorMessage>,

    // Row and column operations
    pub get_row_height:
        fn(params: GetRowHeightParams, book_id: Option<usize>) -> Result<f64, ErrorMessage>,
    pub get_col_width:
        fn(params: GetColWidthParams, book_id: Option<usize>) -> Result<f64, ErrorMessage>,

    // Display window operations
    pub get_display_window: fn(
        params: GetDisplayWindowParams,
        book_id: Option<usize>,
    ) -> Result<DisplayWindow, ErrorMessage>,

    pub get_display_window_within_cell: fn(
        params: GetDisplayWindowWithinCellParams,
        book_id: Option<usize>,
    )
        -> Result<DisplayWindowWithStartPoint, ErrorMessage>,

    // Cell operations
    pub get_cell:
        fn(params: GetCellParams, book_id: Option<usize>) -> Result<CellInfo, ErrorMessage>,
    pub get_cells:
        fn(params: GetCellsParams, book_id: Option<usize>) -> Result<Vec<CellInfo>, ErrorMessage>,
    pub get_cell_infos: fn(
        params: GetCellInfosParams,
        book_id: Option<usize>,
    ) -> Result<Vec<CellInfo>, ErrorMessage>,
    pub get_value: fn(params: GetCellParams, book_id: Option<usize>) -> Result<Value, ErrorMessage>,
    pub get_formula:
        fn(params: GetCellParams, book_id: Option<usize>) -> Result<String, ErrorMessage>,
    pub get_style: fn(params: GetCellParams, book_id: Option<usize>) -> Result<Style, ErrorMessage>,
    pub get_cells_except_window: fn(
        params: GetCellsExceptWindowParams,
        book_id: Option<usize>,
    ) -> Result<Vec<CellInfo>, ErrorMessage>,
    pub predict_fill: fn(
        params: PredictFillParams,
        book_id: Option<usize>,
    ) -> Result<Vec<CellInput>, ErrorMessage>,
    pub get_cell_position: fn(
        params: GetCellPositionParams,
        book_id: Option<usize>,
    ) -> Result<CellPosition, ErrorMessage>,
    pub get_cell_id:
        fn(params: GetCellIdParams, book_id: Option<usize>) -> Result<SheetCellId, ErrorMessage>,
    pub get_reproducible_cell: fn(
        params: GetReproducibleCellParams,
        book_id: Option<usize>,
    ) -> Result<ReproducibleCell, ErrorMessage>,
    pub get_reproducible_cells: fn(
        params: GetReproducibleCellsParams,
        book_id: Option<usize>,
    ) -> Result<Vec<ReproducibleCell>, ErrorMessage>,
    /// Typed as `CellPosition`, but the value is a grid coordinate: `x` is the
    /// column index and `y` the row index, both 0-based. Same for
    /// `get_data_boundary`.
    pub get_next_visible_cell: fn(
        params: GetNextVisibleCellParams,
        book_id: Option<usize>,
    ) -> Result<CellPosition, ErrorMessage>,
    pub get_data_boundary: fn(
        params: GetDataBoundaryParams,
        book_id: Option<usize>,
    ) -> Result<CellPosition, ErrorMessage>,

    // Batch operations
    pub batch_get_cell_info_by_id: fn(
        params: BatchGetCellInfoByIdParams,
        book_id: Option<usize>,
    ) -> Result<Vec<CellInfo>, ErrorMessage>,
    pub batch_get_cell_coordinate_with_sheet_by_id:
        fn(
            params: BatchGetCellCoordinateWithSheetByIdParams,
            book_id: Option<usize>,
        ) -> Result<Vec<CellCoordinateWithSheet>, ErrorMessage>,

    // Block operations
    pub get_block_info:
        fn(params: GetBlockInfoParams, book_id: Option<usize>) -> Result<BlockInfo, ErrorMessage>,
    pub get_block_display_window: fn(
        params: GetBlockDisplayWindowParams,
        book_id: Option<usize>,
    ) -> Result<DisplayWindow, ErrorMessage>,
    pub get_block_row_id:
        fn(params: GetBlockRowIdParams, book_id: Option<usize>) -> Result<RowId, ErrorMessage>,
    pub get_block_col_id:
        fn(params: GetBlockColIdParams, book_id: Option<usize>) -> Result<ColId, ErrorMessage>,
    pub get_block_values: fn(
        params: GetBlockValuesParams,
        book_id: Option<usize>,
    ) -> Result<Vec<String>, ErrorMessage>,
    pub get_block_sort_order: fn(
        params: GetBlockSortOrderParams,
        book_id: Option<usize>,
    ) -> Result<BlockSortOrder, ErrorMessage>,
    pub pivot_plan:
        fn(params: PivotPlanParams, book_id: Option<usize>) -> Result<PivotPlan, ErrorMessage>,
    pub pivot_plan_for:
        fn(params: PivotPlanForParams, book_id: Option<usize>) -> Result<PivotPlan, ErrorMessage>,
    /// Why a pivot would not survive a save to .xlsx as a real pivot table, or
    /// `None`. Asked before building, not discovered after saving.
    pub pivot_excel_note:
        fn(params: PivotPlanParams, book_id: Option<usize>) -> Result<PivotExcelNote, ErrorMessage>,
    pub may_modify_block:
        fn(params: MayModifyBlockParams, book_id: Option<usize>) -> Result<bool, ErrorMessage>,
    pub check_field_validation: fn(
        params: CheckFieldValidationParams,
        book_id: Option<usize>,
    ) -> Result<FieldValidationVerdict, ErrorMessage>,
    pub get_block_modify_info: fn(
        params: GetBlockModifyInfoParams,
        book_id: Option<usize>,
    ) -> Result<BlockModifyInfo, ErrorMessage>,
    pub get_available_block_id:
        fn(params: GetAvailableBlockIdParams, book_id: Option<usize>) -> Result<u32, ErrorMessage>,
    pub get_all_block_fields: fn(book_id: Option<usize>) -> Result<Vec<BlockField>, ErrorMessage>,
    pub duplicate_block_keys:
        fn(book_id: Option<usize>) -> Result<Vec<DuplicateBlockKey>, ErrorMessage>,
    pub get_enum_sets: fn(book_id: Option<usize>) -> Result<Vec<EnumSetInfo>, ErrorMessage>,
    pub get_defined_names: fn(book_id: Option<usize>) -> Result<Vec<DefinedNameInfo>, ErrorMessage>,
    pub get_block_op_for_payloads:
        fn(book_id: Option<usize>) -> Result<Vec<BlockOpForPayload>, ErrorMessage>,
    pub get_block_op_policies: fn(
        params: GetBlockOpPoliciesParams,
        book_id: Option<usize>,
    ) -> Result<Vec<BlockOpPolicy>, ErrorMessage>,
    pub get_all_blocks: fn(
        params: GetAllBlocksParams,
        book_id: Option<usize>,
    ) -> Result<Vec<BlockInfo>, ErrorMessage>,
    pub get_linkable_blocks: fn(
        params: GetLinkableBlocksParams,
        book_id: Option<usize>,
    ) -> Result<Vec<BlockInfo>, ErrorMessage>,
    pub get_links:
        fn(params: GetLinksParams, book_id: Option<usize>) -> Result<Vec<LinkInfo>, ErrorMessage>,
    /// Answers how many checkpoints are stored after the save.
    pub save_checkpoint:
        fn(params: SaveCheckpointParams, book_id: Option<usize>) -> Result<usize, ErrorMessage>,
    pub delete_checkpoint:
        fn(params: DeleteCheckpointParams, book_id: Option<usize>) -> Result<bool, ErrorMessage>,
    pub list_checkpoints:
        fn(book_id: Option<usize>) -> Result<Vec<CheckpointMetaDto>, ErrorMessage>,
    /// Answers `null`, not a number, when the cell is not a DIY cell.
    pub get_diy_cell_id_with_block_id: fn(
        params: GetDiyCellIdWithBlockIdParams,
        book_id: Option<usize>,
    ) -> Result<u64, ErrorMessage>,
    pub lookup_appendix_upward: fn(
        params: LookupAppendixUpwardParams,
        book_id: Option<usize>,
    ) -> Result<AppendixWithCell, ErrorMessage>,

    // Merged cells
    pub get_merged_cells: fn(
        params: GetMergedCellsParams,
        book_id: Option<usize>,
    ) -> Result<Vec<MergeCell>, ErrorMessage>,

    // Comments (threaded + @mentions)
    pub get_comments:
        fn(params: GetCommentsParams, book_id: Option<usize>) -> Result<Vec<Comment>, ErrorMessage>,

    // Cell images
    pub get_cell_images: fn(
        params: GetCellImagesParams,
        book_id: Option<usize>,
    ) -> Result<Vec<CellImageInfo>, ErrorMessage>,

    // Charts
    pub get_charts:
        fn(params: GetChartsParams, book_id: Option<usize>) -> Result<Vec<ChartInfo>, ErrorMessage>,

    // Conditional formatting. The write side goes through `handle_transaction`
    // with the Create/Update/Move/Delete payloads; this is how a rule manager
    // lists what is there, and gets each rule's spec back to edit it.
    pub get_conditional_formatting_rules: fn(
        params: GetConditionalFormattingRulesParams,
        book_id: Option<usize>,
    ) -> Result<Vec<CfRuleInfo>, ErrorMessage>,

    // Shadow cells
    pub get_shadow_cell_id: fn(
        params: GetShadowCellIdParams,
        book_id: Option<usize>,
    ) -> Result<SheetCellId, ErrorMessage>,
    pub get_shadow_cell_ids: fn(
        params: GetShadowCellIdsParams,
        book_id: Option<usize>,
    ) -> Result<Vec<SheetCellId>, ErrorMessage>,
    pub get_shadow_info_by_id: fn(
        params: GetShadowInfoByIdParams,
        book_id: Option<usize>,
    ) -> Result<ShadowCellInfo, ErrorMessage>,

    // Transaction operations
    /// `true` when a step was undone. With a temp branch open, undo and redo
    /// move within the branch and stop at its fork point.
    pub undo: fn(book_id: Option<usize>) -> Result<bool, ErrorMessage>,
    pub redo: fn(book_id: Option<usize>) -> Result<bool, ErrorMessage>,
    pub clean_history: fn(book_id: Option<usize>) -> Result<(), ErrorMessage>,
    /// A no-op; see [`ToggleStatusParams`].
    pub toggle_status:
        fn(params: ToggleStatusParams, book_id: Option<usize>) -> Result<(), ErrorMessage>,
    pub cleanup_temp_status: fn(book_id: Option<usize>) -> Result<(), ErrorMessage>,
    // The cells were already reported as they were written to the branch, so
    // the commit has no second effect to hand back.
    pub commit_temp_status: fn(book_id: Option<usize>) -> Result<(), ErrorMessage>,

    // Workbook operations
    pub load_workbook:
        fn(params: LoadWorkbookParams, book_id: Option<usize>) -> Result<(), ErrorMessage>,
    /// Sent on the wire as `saveWorkbook` ([`Message::SaveWorkbook`]); a client
    /// that forwards this field's name verbatim will not reach it.
    pub save:
        fn(params: SaveParams, book_id: Option<usize>) -> Result<SaveFileResult, ErrorMessage>,
    pub get_app_data: fn(book_id: Option<usize>) -> Result<Vec<AppData>, ErrorMessage>,
    // Monotonic write counter — snapshot it to detect concurrent modification.
    pub get_version: fn(book_id: Option<usize>) -> Result<u32, ErrorMessage>,

    // Formula operations
    pub get_display_units_of_formula: fn(
        params: GetDisplayUnitsOfFormulaParams,
        book_id: Option<usize>,
    ) -> Result<FormulaDisplayInfo, ErrorMessage>,
    pub calc_condition:
        fn(params: CalcConditionParams, book_id: Option<usize>) -> Result<bool, ErrorMessage>,
    pub get_cell_id_by_block_ref: fn(
        params: GetCellIdByBlockRefParams,
        book_id: Option<usize>,
    ) -> Result<SheetCellId, ErrorMessage>,
    pub export_block_data: fn(
        params: ExportBlockDataParams,
        book_id: Option<usize>,
    ) -> Result<Vec<BlockDataRow>, ErrorMessage>,
    pub get_temp_status_changes: fn(book_id: Option<usize>) -> Result<TempStatusDiff, ErrorMessage>,
    // Whether a temp branch is open. There is only one per workbook, so a
    // caller about to open its own must check: `cleanup_temp_status` discards
    // the whole branch, including edits somebody else put there.
    pub is_in_temp_mode: fn(book_id: Option<usize>) -> Result<bool, ErrorMessage>,
    pub check_formula:
        fn(params: CheckFormulaParams, book_id: Option<usize>) -> Result<bool, ErrorMessage>,

    // Row info
    pub get_row_info:
        fn(params: GetRowInfoParams, book_id: Option<usize>) -> Result<RowInfo, ErrorMessage>,

    // Helpers
    /// No [`Message`] variant carries this method, so the WASM transport rejects
    /// it as unknown.
    pub get_all_block_ref_names: fn() -> Vec<String>,

    pub handle_transaction: fn(
        params: HandleTransactionParams,
        book_id: Option<usize>,
    ) -> Result<ActionEffect, ErrorMessage>,
}
