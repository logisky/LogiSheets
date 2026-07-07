use gents_derives::{Interface, TS};
use logisheets_rs::BlockId;
use logisheets_rs::{
    ActionEffect, AppData, AppendixWithCell, BlockDataRow, BlockField, BlockInfo,
    CellCoordinateWithSheet, CellImageInfo, CellInfo, CellInput, CellPosition, ColId, Comment,
    DisplayWindow,
    DisplayWindowWithStartPoint, EditPayload, ErrorMessage, FormulaDisplayInfo, MergeCell,
    ReproducibleCell, RowId, RowInfo, SaveFileResult, ShadowCellInfo, SheetCellId, SheetCoordinate,
    SheetDimension, SheetId, SheetInfo, Style, TempStatusDiff, Value,
};
use wasm_bindgen::prelude::*;

use crate::controller;
use crate::ws;

// ============================================================================
// Params structs - all derive TS for TypeScript generation
// All params will be generated into a single file: rpc_params.ts
// ============================================================================

#[derive(Debug, Clone, TS)]
#[ts(file_name = "rpc_message.ts", tag = "method", rename_all = "camelCase")]
pub enum Message {
    GetSheetDimension(GetSheetDimensionParams),
    GetDisplayWindow(GetDisplayWindowParams),
    GetCell(GetCellParams),
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
    GetAllSheetInfo,
    GetAppData,
    CleanTempStatus,
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
    pub kind: Option<logisheets_rs::ShadowKind>,
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
    pub kind: Option<logisheets_rs::ShadowKind>,
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

impl From<logisheets_rs::CheckpointMeta> for CheckpointMetaDto {
    fn from(m: logisheets_rs::CheckpointMeta) -> Self {
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
    pub get_all_sheet_info: fn(book_id: Option<usize>) -> Result<Vec<SheetInfo>, ErrorMessage>,
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
    pub get_available_block_id:
        fn(params: GetAvailableBlockIdParams, book_id: Option<usize>) -> Result<u32, ErrorMessage>,
    pub get_all_block_fields: fn(book_id: Option<usize>) -> Result<Vec<BlockField>, ErrorMessage>,
    pub get_all_blocks: fn(
        params: GetAllBlocksParams,
        book_id: Option<usize>,
    ) -> Result<Vec<BlockInfo>, ErrorMessage>,
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

#[wasm_bindgen]
pub fn handle(msg: JsValue, book_id: Option<usize>) -> JsValue {
    let msg: Message = serde_wasm_bindgen::from_value(msg).unwrap();

    // Handle messages that don't require a book_id
    if let Message::NewWorkbook = &msg {
        let id = controller::new_workbook();
        return serde_wasm_bindgen::to_value(&id).unwrap();
    }

    let id = book_id.expect("book id");
    match msg {
        Message::NewWorkbook => unreachable!(),
        Message::GetSheetDimension(params) => {
            let sheet_id = params.sheet_id;
            let result = ws::get_sheet_dimension(id, sheet_id);
            result
        }
        Message::GetDisplayWindow(params) => ws::get_display_window(
            id,
            params.sheet_idx,
            params.start_row,
            params.end_row,
            params.start_col,
            params.end_col,
        ),
        Message::GetCell(params) => ws::get_cell_info(id, params.sheet_idx, params.row, params.col),
        Message::GetValue(params) => ws::get_value(id, params.sheet_idx, params.row, params.col),
        Message::GetFormula(params) => {
            ws::get_formula(id, params.sheet_idx, params.row, params.col)
        }
        Message::GetStyle(params) => ws::get_style(id, params.sheet_idx, params.row, params.col),
        Message::GetCells(params) => ws::get_cell_infos(
            id,
            params.sheet_idx,
            params.start_row,
            params.start_col,
            params.end_row,
            params.end_col,
        ),
        Message::PredictFill(params) => ws::predict_fill(
            id,
            params.sheet_idx,
            params.src_start_row,
            params.src_start_col,
            params.src_end_row,
            params.src_end_col,
            params.dst_start_row,
            params.dst_start_col,
            params.dst_end_row,
            params.dst_end_col,
        ),
        Message::GetCellsExceptWindow(params) => ws::get_cell_infos_except_window(
            id,
            params.sheet_idx,
            params.start_row,
            params.start_col,
            params.end_row,
            params.end_col,
            params.window_start_row,
            params.window_start_col,
            params.window_end_row,
            params.window_end_col,
        ),
        Message::GetReproducibleCells(params) => {
            ws::get_reproducible_cells(id, params.sheet_idx, params.coordinates)
        }
        Message::GetReproducibleCell(params) => {
            ws::get_reproducible_cell(id, params.sheet_idx, params.row, params.col)
        }
        Message::GetCellPosition(params) => {
            ws::get_cell_position(id, params.sheet_idx, params.row, params.col)
        }
        Message::GetRowHeight(params) => ws::get_row_height(id, params.sheet_id, params.row_idx),
        Message::GetColWidth(params) => ws::get_col_width(id, params.sheet_id, params.col_idx),
        Message::HandleTransaction(params) => {
            controller::handle_transaction(id, params.transaction)
        }
        Message::ToggleStatus(params) => {
            controller::toggle_status(id, params.use_temp);
            JsValue::NULL
        }
        Message::BatchGetCellInfoById(params) => {
            controller::batch_get_cell_info_by_id(id, params.ids)
        }
        Message::BatchGetCellCoordinateWithSheetById(params) => {
            controller::batch_get_cell_coordinate_with_sheet_by_id(id, params.ids)
        }
        Message::GetSheetNameByIdx(params) => controller::get_sheet_name_by_idx(id, params.idx),
        Message::LoadWorkbook(params) => {
            let result = controller::read_file(id, params.name, &params.content);
            serde_wasm_bindgen::to_value(&result).unwrap()
        }
        Message::SaveWorkbook(params) => controller::save_file(id, params.app_data),
        Message::GetCellId(params) => {
            controller::get_cell_id(id, params.sheet_idx, params.row_idx, params.col_idx)
        }
        Message::GetMergedCells(params) => ws::get_merged_cells(
            id,
            params.sheet_idx,
            params.start_row,
            params.start_col,
            params.end_row,
            params.end_col,
        ),
        Message::GetComments(params) => ws::get_comments(id, params.sheet_idx),
        Message::GetCellImages(params) => ws::get_cell_images(id, params.sheet_idx),
        Message::CalcCondition(params) => {
            controller::calc_condition(id, params.sheet_idx, params.condition)
        }
        Message::GetCellIdByBlockRef(params) => {
            controller::get_cell_id_by_block_ref(id, params.ref_name, params.key, params.field)
        }
        Message::ExportBlockData(params) => controller::export_block_data(
            id,
            params.ref_name,
            params.key_filter,
            params.field_filter,
        ),
        Message::GetTempStatusChanges => controller::get_temp_status_changes(id),
        Message::GetBlockDisplayWindow(params) => {
            controller::get_display_window_for_block(id, params.sheet_id, params.block_id)
        }
        Message::GetBlockRowId(params) => {
            controller::get_block_row_id(id, params.sheet_id, params.block_id, params.row_idx)
        }
        Message::GetBlockColId(params) => {
            controller::get_block_col_id(id, params.sheet_id, params.block_id, params.col_idx)
        }
        Message::GetSheetIdx(params) => controller::get_sheet_idx(id, params.sheet_id),
        Message::GetSheetId(params) => controller::get_sheet_id(id, params.sheet_idx),
        Message::GetBlockValues(params) => controller::get_block_values(
            id,
            params.sheet_id,
            params.block_id,
            params.row_ids,
            params.col_ids,
        ),
        Message::GetShadowCellId(params) => controller::get_shadow_cell_id(
            id,
            params.sheet_idx,
            params.row_idx,
            params.col_idx,
            params.kind.unwrap_or_default(),
        ),
        Message::GetShadowCellIds(params) => controller::get_shadow_cell_ids(
            id,
            params.sheet_idx,
            params.row_idx,
            params.col_idx,
            params.kind.unwrap_or_default(),
        ),
        Message::GetShadowInfoById(params) => {
            controller::get_shadow_info_by_id(id, params.shadow_id)
        }
        Message::GetDiyCellIdWithBlockId(params) => {
            let result = ws::get_diy_cell_id_with_block_id(
                id,
                params.sheet_id,
                params.block_id,
                params.row,
                params.col,
            );
            serde_wasm_bindgen::to_value(&result).unwrap()
        }
        Message::LookupAppendixUpward(params) => ws::lookup_appendix_upward(
            id,
            params.sheet_id,
            params.block_id,
            params.row,
            params.col,
            params.craft_id,
            params.tag,
        ),
        Message::GetNextVisibleCell(params) => ws::get_next_visible_cell(
            id,
            params.sheet_idx,
            params.row_idx,
            params.col_idx,
            params.direction,
        ),
        Message::GetDataBoundary(params) => ws::get_data_boundary(
            id,
            params.sheet_idx,
            params.row_idx,
            params.col_idx,
            params.direction,
        ),
        Message::GetDisplayUnitsOfFormula(params) => {
            controller::get_display_units_of_formula(&params.formula)
        }
        Message::GetRowInfo(params) => {
            controller::get_row_info(id, params.sheet_idx, params.row_idx)
        }
        Message::GetAvailableBlockId(params) => {
            controller::get_available_block_id(id, params.sheet_idx)
        }
        Message::CheckFormula(params) => {
            let result = controller::check_formula(id, params.formula);
            serde_wasm_bindgen::to_value(&result).unwrap()
        }
        Message::GetBlockInfo(params) => {
            ws::get_block_info(id, params.sheet_id, params.block_id as usize)
        }
        Message::GetCellInfos(params) => ws::get_cell_infos(
            id,
            params.sheet_idx,
            params.start_row,
            params.start_col,
            params.end_row,
            params.end_col,
        ),
        Message::Undo => {
            let result = controller::undo(id);
            serde_wasm_bindgen::to_value(&result).unwrap()
        }
        Message::Redo => {
            let result = controller::redo(id);
            serde_wasm_bindgen::to_value(&result).unwrap()
        }
        Message::CleanHistory => {
            controller::clean_history(id);
            JsValue::NULL
        }
        Message::GetAllBlockFields => controller::get_all_block_fields(id),
        Message::Release => {
            controller::release(id);
            JsValue::NULL
        }
        Message::GetSheetCount => {
            let count = controller::get_sheet_count(id);
            serde_wasm_bindgen::to_value(&count).unwrap()
        }
        Message::GetAllSheetInfo => controller::get_all_sheet_info(id),
        Message::GetAppData => controller::get_app_data(id),
        Message::CleanTempStatus => {
            controller::clean_temp_status(id);
            JsValue::NULL
        }
        Message::CommitTempStatus => controller::commit_temp_status(id),
        Message::CheckBindBlock(params) => {
            let result = controller::check_bind_block(
                id,
                params.sheet_idx,
                params.block_id,
                params.row_count,
                params.col_count,
            );
            serde_wasm_bindgen::to_value(&result).unwrap()
        }
        Message::GetDisplayWindowWithStartPoint(params) => ws::get_display_window_with_start_point(
            id,
            params.sheet_idx,
            params.start_x,
            params.start_y,
            params.height,
            params.width,
        ),
        Message::GetDisplayWindowWithinCell(params) => ws::get_display_window_within_cell(
            id,
            params.sheet_idx,
            params.row,
            params.col,
            params.height,
            params.width,
        ),
        Message::GetColInfo(params) => ws::get_col_info(id, params.sheet_idx, params.col_idx),
        Message::GetFullyCoveredBlocks(params) => ws::get_all_fully_covered_blocks(
            id,
            params.sheet_id,
            params.row,
            params.col,
            params.row_cnt,
            params.col_cnt,
        ),
        Message::GetAllBlocks(params) => ws::get_all_blocks(id, params.sheet_idx, params.sheet_id),
        Message::SaveCheckpoint(params) => {
            ws::save_checkpoint(id, params.label, params.description)
        }
        Message::DeleteCheckpoint(params) => ws::delete_checkpoint(id, params.label),
        Message::ListCheckpoints => ws::list_checkpoints(id),
    }
}
