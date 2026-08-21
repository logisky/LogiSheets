use gents_derives::{Interface, TS};

use crate::BlockId;
use crate::{
    ActionEffect, AppData, AppendixWithCell, BlockDataRow, BlockField, BlockInfo, BlockSortOrder,
    CellCoordinateWithSheet, CellImageInfo, CellInfo, CellInput, CellPosition, CellRefRange,
    CfRuleInfo, ChartInfo, ColId, Comment, DependentCell, DisplayWindow,
    DisplayWindowWithStartPoint, EditPayload, ErrorMessage, FormulaDisplayInfo, LinkInfo,
    MergeCell, ReproducibleCell, RowId, RowInfo, SaveFileResult, ShadowCellInfo, SheetCellId,
    SheetCoordinate, SheetDimension, SheetId, SheetInfo, Style, TempStatusDiff, Value,
};

// ============================================================================
// Params structs - all derive TS for TypeScript generation
// All params will be generated into a single file: rpc_params.ts
// ============================================================================

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
    GetBlockDisplayWindow(GetBlockDisplayWindowParams),
    GetBlockRowId(GetBlockRowIdParams),
    GetBlockColId(GetBlockColIdParams),
    GetSheetIdx(GetSheetIdxParams),
    GetSheetId(GetSheetIdParams),
    GetBlockValues(GetBlockValuesParams),
    GetBlockSortOrder(GetBlockSortOrderParams),
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

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_cell_infos_params.ts", rename_all = "camelCase")]
pub struct GetCellInfosParams {
    pub sheet_idx: usize,
    pub start_row: usize,
    pub start_col: usize,
    pub end_row: usize,
    pub end_col: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_sheet_dimension_params.ts",
    rename_all = "camelCase"
)]
pub struct GetSheetDimensionParams {
    pub sheet_id: SheetId,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_dependents_params.ts", rename_all = "camelCase")]
pub struct GetDependentsParams {
    pub sheet_idx: usize,
    pub start_row: usize,
    pub start_col: usize,
    pub end_row: usize,
    pub end_col: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_precedents_params.ts", rename_all = "camelCase")]
pub struct GetPrecedentsParams {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_linkable_blocks_params.ts",
    rename_all = "camelCase"
)]
pub struct GetLinkableBlocksParams {
    pub sheet_idx: usize,
    pub col_cnt: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_links_params.ts", rename_all = "camelCase")]
pub struct GetLinksParams {
    pub sheet_idx: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_row_height_params.ts", rename_all = "camelCase")]
pub struct GetRowHeightParams {
    pub sheet_id: SheetId,
    pub row_idx: usize,
}

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

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_cell_params.ts", rename_all = "camelCase")]
pub struct GetCellParams {
    pub sheet_idx: usize,
    pub row: usize,
    pub col: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_cells_params.ts", rename_all = "camelCase")]
pub struct GetCellsParams {
    pub sheet_idx: usize,
    pub start_row: usize,
    pub start_col: usize,
    pub end_row: usize,
    pub end_col: usize,
}

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

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_reproducible_cells_params.ts",
    rename_all = "camelCase"
)]
pub struct GetReproducibleCellsParams {
    pub sheet_idx: usize,
    pub coordinates: Vec<SheetCoordinate>,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_block_info_params.ts", rename_all = "camelCase")]
pub struct GetBlockInfoParams {
    pub sheet_id: SheetId,
    pub block_id: u32,
}

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

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_handle_transaction_params.ts",
    rename_all = "camelCase"
)]
pub struct HandleTransactionParams {
    pub transaction: Transaction,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_toggle_status_params.ts", rename_all = "camelCase")]
pub struct ToggleStatusParams {
    pub use_temp: bool,
}

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_batch_get_cell_info_by_id_params.ts",
    rename_all = "camelCase"
)]
pub struct BatchGetCellInfoByIdParams {
    pub ids: Vec<SheetCellId>,
}

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_batch_get_cell_coordinate_with_sheet_by_id_params.ts",
    rename_all = "camelCase"
)]
pub struct BatchGetCellCoordinateWithSheetByIdParams {
    pub ids: Vec<SheetCellId>,
}

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_sheet_name_by_idx_params.ts",
    rename_all = "camelCase"
)]
pub struct GetSheetNameByIdxParams {
    pub idx: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_load_workbook_params.ts", rename_all = "camelCase")]
pub struct LoadWorkbookParams {
    pub content: Vec<u8>,
    pub name: String,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_save_params.ts", rename_all = "camelCase")]
pub struct SaveParams {
    pub app_data: String,
    /// Write block formulas as `A1` references instead of `BLOCKREF(...)`.
    ///
    /// Off by default: the named form is the readable one and reopens here
    /// intact. Turn it on for a file another spreadsheet has to recalculate —
    /// no one else knows the BLOCKREF functions. See `FormulaFormat`.
    pub resolve_block_refs: Option<bool>,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_cell_id_params.ts", rename_all = "camelCase")]
pub struct GetCellIdParams {
    pub sheet_idx: usize,
    pub row_idx: usize,
    pub col_idx: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_merged_cells_params.ts", rename_all = "camelCase")]
pub struct GetMergedCellsParams {
    pub sheet_idx: usize,
    pub start_row: usize,
    pub start_col: usize,
    pub end_row: usize,
    pub end_col: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_comments_params.ts", rename_all = "camelCase")]
pub struct GetCommentsParams {
    pub sheet_idx: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_cell_images_params.ts", rename_all = "camelCase")]
pub struct GetCellImagesParams {
    pub sheet_idx: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_charts_params.ts", rename_all = "camelCase")]
pub struct GetChartsParams {
    pub sheet_idx: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_conditional_formatting_rules_params.ts",
    rename_all = "camelCase"
)]
pub struct GetConditionalFormattingRulesParams {
    pub sheet_idx: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_calc_condition_params.ts", rename_all = "camelCase")]
pub struct CalcConditionParams {
    pub sheet_idx: usize,
    pub condition: String,
}

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

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_block_display_window_params.ts",
    rename_all = "camelCase"
)]
pub struct GetBlockDisplayWindowParams {
    pub sheet_id: SheetId,
    pub block_id: BlockId,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_block_row_id_params.ts", rename_all = "camelCase")]
pub struct GetBlockRowIdParams {
    pub sheet_id: SheetId,
    pub block_id: BlockId,
    pub row_idx: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_block_col_id_params.ts", rename_all = "camelCase")]
pub struct GetBlockColIdParams {
    pub sheet_id: SheetId,
    pub block_id: BlockId,
    pub col_idx: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_sheet_idx_params.ts", rename_all = "camelCase")]
pub struct GetSheetIdxParams {
    pub sheet_id: SheetId,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_sheet_id_params.ts", rename_all = "camelCase")]
pub struct GetSheetIdParams {
    pub sheet_idx: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_block_values_params.ts", rename_all = "camelCase")]
pub struct GetBlockValuesParams {
    pub sheet_id: SheetId,
    pub block_id: BlockId,
    pub row_ids: Vec<RowId>,
    pub col_ids: Vec<ColId>,
}

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

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_shadow_cell_ids_params.ts",
    rename_all = "camelCase"
)]
pub struct GetShadowCellIdsParams {
    pub sheet_idx: usize,
    pub row_idx: Vec<usize>,
    pub col_idx: Vec<usize>,
    pub kind: Option<crate::ShadowKind>,
}

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_shadow_info_by_id_params.ts",
    rename_all = "camelCase"
)]
pub struct GetShadowInfoByIdParams {
    pub shadow_id: u64,
}

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

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_display_units_of_formula_params.ts",
    rename_all = "camelCase"
)]
pub struct GetDisplayUnitsOfFormulaParams {
    pub formula: String,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_row_info_params.ts", rename_all = "camelCase")]
pub struct GetRowInfoParams {
    pub sheet_idx: usize,
    pub row_idx: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_get_available_block_id_params.ts",
    rename_all = "camelCase"
)]
pub struct GetAvailableBlockIdParams {
    pub sheet_idx: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_check_formula_params.ts", rename_all = "camelCase")]
pub struct CheckFormulaParams {
    pub formula: String,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_check_bind_block_params.ts", rename_all = "camelCase")]
pub struct CheckBindBlockParams {
    pub sheet_idx: usize,
    pub block_id: usize,
    pub row_count: usize,
    pub col_count: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_col_info_params.ts", rename_all = "camelCase")]
pub struct GetColInfoParams {
    pub sheet_idx: usize,
    pub col_idx: usize,
}

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_get_all_blocks_params.ts", rename_all = "camelCase")]
pub struct GetAllBlocksParams {
    /// If neither `sheet_idx` nor `sheet_id` is set, returns blocks
    /// across every sheet in the workbook.
    pub sheet_idx: Option<usize>,
    pub sheet_id: Option<SheetId>,
}

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

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "rpc_delete_checkpoint_params.ts",
    rename_all = "camelCase"
)]
pub struct DeleteCheckpointParams {
    pub label: String,
}

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

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_transaction.ts", rename_all = "camelCase")]
pub struct Transaction {
    pub payloads: Vec<EditPayload>,
    pub undoable: bool,
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
    pub get_available_block_id:
        fn(params: GetAvailableBlockIdParams, book_id: Option<usize>) -> Result<u32, ErrorMessage>,
    pub get_all_block_fields: fn(book_id: Option<usize>) -> Result<Vec<BlockField>, ErrorMessage>,
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
    pub save_checkpoint:
        fn(params: SaveCheckpointParams, book_id: Option<usize>) -> Result<usize, ErrorMessage>,
    pub delete_checkpoint:
        fn(params: DeleteCheckpointParams, book_id: Option<usize>) -> Result<bool, ErrorMessage>,
    pub list_checkpoints:
        fn(book_id: Option<usize>) -> Result<Vec<CheckpointMetaDto>, ErrorMessage>,
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
    pub undo: fn(book_id: Option<usize>) -> Result<bool, ErrorMessage>,
    pub redo: fn(book_id: Option<usize>) -> Result<bool, ErrorMessage>,
    pub clean_history: fn(book_id: Option<usize>) -> Result<(), ErrorMessage>,
    pub toggle_status:
        fn(params: ToggleStatusParams, book_id: Option<usize>) -> Result<(), ErrorMessage>,
    pub cleanup_temp_status: fn(book_id: Option<usize>) -> Result<(), ErrorMessage>,
    pub commit_temp_status: fn(book_id: Option<usize>) -> Result<ActionEffect, ErrorMessage>,

    // Workbook operations
    pub load_workbook:
        fn(params: LoadWorkbookParams, book_id: Option<usize>) -> Result<(), ErrorMessage>,
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
    pub check_formula:
        fn(params: CheckFormulaParams, book_id: Option<usize>) -> Result<bool, ErrorMessage>,

    // Row info
    pub get_row_info:
        fn(params: GetRowInfoParams, book_id: Option<usize>) -> Result<RowInfo, ErrorMessage>,

    // Helpers
    pub get_all_block_ref_names: fn() -> Vec<String>,

    pub handle_transaction: fn(
        params: HandleTransactionParams,
        book_id: Option<usize>,
    ) -> Result<ActionEffect, ErrorMessage>,
}
