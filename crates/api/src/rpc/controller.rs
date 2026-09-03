use crate::{
    ActionEffect, AppData, BasicError, BlockDataRow, BlockField, BlockId, BlockSortOrder,
    CellCoordinateWithSheet, CellInfo, ColId, DisplayWindow, EditAction, Error, ErrorMessage,
    FormulaDisplayInfo, PayloadsAction, RowId, RowInfo, SaveFileResult, ShadowCellInfo,
    SheetCellId, SheetId, SheetInfo, TempStatusDiff, Workbook, lex_and_fmt, lex_success,
};

use super::{Manager, Transaction};

// ============================================================================
// Transport-agnostic workbook logic. Each function is a thin, serialization-free
// wrapper over `Workbook`, returning typed values (`Result<T, ErrorMessage>` for
// fallible calls, `T` otherwise). It receives `&Manager` / `&mut Manager` from
// whichever transport drives it (browser WASM `handle`, or a native Tauri
// command) so both share one implementation; serialization happens at the edge.
// ============================================================================

pub fn new_workbook(mgr: &mut Manager) -> usize {
    mgr.new_workbook()
}

pub fn read_file(mgr: &mut Manager, id: usize, name: String, buf: &[u8]) -> u8 {
    match Workbook::from_file(buf, name) {
        Ok(c) => {
            mgr.replace_workbook(id, c);
            0
        }
        Err(_) => 1,
    }
}

pub fn save_file(
    mgr: &mut Manager,
    id: usize,
    app_data: String,
    resolve_block_refs: bool,
) -> SaveFileResult {
    let ctrl = mgr.get_mut_workbook(&id);
    if ctrl.is_none() {
        return SaveFileResult {
            code: 1,
            data: vec![],
        };
    }
    let ctrl = ctrl.unwrap();
    ctrl.set_app_data(vec![AppData {
        name: "logisheets".to_string(),
        data: app_data.clone(),
    }]);
    let format = if resolve_block_refs {
        logisheets_controller::FormulaFormat::Coordinates
    } else {
        logisheets_controller::FormulaFormat::Named
    };
    if let Ok(data) = ctrl.save_with_format(format) {
        SaveFileResult { data, code: 0 }
    } else {
        SaveFileResult {
            data: vec![],
            code: 1,
        }
    }
}

pub fn get_app_data(mgr: &Manager, id: usize) -> Vec<AppData> {
    mgr.get_workbook(&id)
        .map(|ctrl| ctrl.get_app_data())
        .unwrap_or_default()
}

pub fn release(mgr: &mut Manager, id: usize) {
    mgr.remove(id)
}

pub fn undo(mgr: &mut Manager, id: usize) -> bool {
    if let Some(ctrl) = mgr.get_mut_workbook(&id) {
        ctrl.undo()
    } else {
        false
    }
}

pub fn redo(mgr: &mut Manager, id: usize) -> bool {
    if let Some(ctrl) = mgr.get_mut_workbook(&id) {
        ctrl.redo()
    } else {
        false
    }
}

pub fn clean_history(mgr: &mut Manager, id: usize) {
    if let Some(ctrl) = mgr.get_mut_workbook(&id) {
        ctrl.clear_history();
    }
}

pub fn commit_temp_status(mgr: &mut Manager, id: usize) {
    let wb = mgr.get_mut_workbook(&id).unwrap();
    wb.commit_temp_status()
}

pub fn clean_temp_status(mgr: &mut Manager, id: usize) {
    let wb = mgr.get_mut_workbook(&id).unwrap();
    wb.clean_temp_status();
}

pub fn toggle_status(mgr: &mut Manager, id: usize, use_temp: bool) {
    let wb = mgr.get_mut_workbook(&id).unwrap();
    wb.toggle_status(use_temp);
}

pub fn batch_get_cell_info_by_id(
    mgr: &mut Manager,
    id: usize,
    ids: Vec<SheetCellId>,
) -> Result<Vec<CellInfo>, ErrorMessage> {
    let wb = mgr.get_mut_workbook(&id).unwrap();
    wb.batch_get_cell_info_by_id(ids)
        .map_err(ErrorMessage::from)
}

pub fn batch_get_cell_coordinate_with_sheet_by_id(
    mgr: &mut Manager,
    id: usize,
    ids: Vec<SheetCellId>,
) -> Result<Vec<CellCoordinateWithSheet>, ErrorMessage> {
    let wb = mgr.get_mut_workbook(&id).unwrap();
    wb.batch_get_cell_coordinate_with_sheet_by_id(ids)
        .map_err(ErrorMessage::from)
}

pub fn get_sheet_name_by_idx(
    mgr: &mut Manager,
    id: usize,
    idx: usize,
) -> Result<String, ErrorMessage> {
    let wb = mgr.get_mut_workbook(&id).unwrap();
    wb.get_sheet_name_by_idx(idx).map_err(ErrorMessage::from)
}

pub fn get_sheet_count(mgr: &Manager, id: usize) -> usize {
    let wb = mgr.get_workbook(&id).unwrap();
    wb.get_sheet_count()
}

pub fn get_version(mgr: &Manager, id: usize) -> u32 {
    let wb = mgr.get_workbook(&id).unwrap();
    wb.get_version()
}

pub fn get_all_sheet_info(mgr: &Manager, id: usize) -> Vec<SheetInfo> {
    let wb = mgr.get_workbook(&id).unwrap();
    wb.get_all_sheet_info()
}

pub fn get_formula_function_names(mgr: &Manager, id: usize) -> Vec<String> {
    let wb = mgr.get_workbook(&id).unwrap();
    wb.get_formula_function_names()
}

pub fn get_row_info(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
    row_idx: usize,
) -> Result<RowInfo, ErrorMessage> {
    let wb = mgr.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_idx(sheet_idx).map_err(ErrorMessage::from)?;
    Ok(ws
        .get_row_info(row_idx)
        .unwrap_or(RowInfo::default(row_idx)))
}

pub fn check_formula(mgr: &Manager, id: usize, f: String) -> bool {
    let wb = mgr.get_workbook(&id).unwrap();
    wb.check_formula(f)
}

pub fn calc_condition(
    mgr: &mut Manager,
    id: usize,
    sheet_idx: usize,
    f: String,
) -> Result<bool, ErrorMessage> {
    let wb = mgr.get_mut_workbook(&id).unwrap();
    wb.calc_condition(sheet_idx, f).map_err(ErrorMessage::from)
}

pub fn get_cell_id_by_block_ref(
    mgr: &Manager,
    id: usize,
    ref_name: String,
    key: String,
    field: String,
) -> Result<SheetCellId, ErrorMessage> {
    let wb = mgr.get_workbook(&id).unwrap();
    wb.get_cell_id_by_block_ref(&ref_name, &key, &field)
        .map_err(ErrorMessage::from)
}

pub fn export_block_data(
    mgr: &Manager,
    id: usize,
    ref_name: String,
    key_filter: Option<Vec<String>>,
    field_filter: Option<Vec<String>>,
) -> Result<Vec<BlockDataRow>, ErrorMessage> {
    let wb = mgr.get_workbook(&id).unwrap();
    wb.export_block_data(&ref_name, key_filter, field_filter)
        .map_err(ErrorMessage::from)
}

pub fn get_temp_status_changes(mgr: &Manager, id: usize) -> Result<TempStatusDiff, ErrorMessage> {
    let wb = mgr.get_workbook(&id).unwrap();
    wb.get_temp_status_changes().map_err(ErrorMessage::from)
}

pub fn check_bind_block(
    mgr: &mut Manager,
    id: usize,
    sheet_idx: usize,
    block_id: usize,
    row_count: usize,
    col_count: usize,
) -> bool {
    let wb = mgr.get_mut_workbook(&id).unwrap();
    wb.check_bind_block(sheet_idx, block_id, row_count, col_count)
        .is_ok()
}

pub fn get_available_block_id(
    mgr: &mut Manager,
    id: usize,
    sheet_idx: usize,
) -> Result<BlockId, ErrorMessage> {
    let wb = mgr.get_mut_workbook(&id).unwrap();
    wb.get_available_block_id(sheet_idx)
        .map_err(ErrorMessage::from)
}

pub fn get_sheet_id(
    mgr: &mut Manager,
    id: usize,
    sheet_idx: usize,
) -> Result<SheetId, ErrorMessage> {
    let wb = mgr.get_mut_workbook(&id).unwrap();
    wb.get_worksheet_id(sheet_idx).map_err(ErrorMessage::from)
}

pub fn get_sheet_idx(mgr: &Manager, id: usize, sheet_id: SheetId) -> Result<usize, ErrorMessage> {
    let wb = mgr.get_workbook(&id).unwrap();
    wb.get_sheet_idx_by_id(sheet_id).map_err(ErrorMessage::from)
}

pub fn get_block_values(
    mgr: &Manager,
    id: usize,
    sheet_id: SheetId,
    block_id: BlockId,
    row_ids: Vec<RowId>,
    col_ids: Vec<ColId>,
) -> Result<Vec<String>, ErrorMessage> {
    let wb = mgr.get_workbook(&id).unwrap();
    wb.get_block_values(sheet_id, block_id, &row_ids, &col_ids)
        .map_err(ErrorMessage::from)
}

pub fn get_block_sort_order(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
    block_id: BlockId,
    field: String,
    asc: bool,
) -> Result<BlockSortOrder, ErrorMessage> {
    let wb = mgr.get_workbook(&id).unwrap();
    wb.get_block_sort_order(sheet_idx, block_id, &field, asc)
        .map_err(ErrorMessage::from)
}

/// Whether `actor` may perform `op` on this block — see
/// [`MayModifyBlockParams`]. Read-only: it decides nothing, it only answers,
/// and the host is what actually refuses the edit.
///
/// [`MayModifyBlockParams`]: crate::rpc::message::MayModifyBlockParams
pub fn may_modify_block(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
    block_id: BlockId,
    op: crate::BlockOp,
    actor: crate::BlockActor,
) -> Result<bool, ErrorMessage> {
    let wb = mgr.get_workbook(&id).unwrap();
    wb.may_modify_block(sheet_idx, block_id, op, &actor)
        .map_err(ErrorMessage::from)
}

/// A block's governance metadata, without its cells. See
/// [`GetBlockModifyInfoParams`].
///
/// [`GetBlockModifyInfoParams`]: crate::rpc::message::GetBlockModifyInfoParams
pub fn get_block_modify_info(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
    block_id: BlockId,
) -> Result<crate::BlockModifyInfo, ErrorMessage> {
    let wb = mgr.get_workbook(&id).unwrap();
    wb.get_block_modify_info(sheet_idx, block_id)
        .map_err(ErrorMessage::from)
}

pub fn get_block_row_id(
    mgr: &mut Manager,
    id: usize,
    sheet_id: SheetId,
    block_id: BlockId,
    row_idx: usize,
) -> Result<RowId, ErrorMessage> {
    let wb = mgr.get_mut_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_id(sheet_id).map_err(ErrorMessage::from)?;
    ws.get_block_row_id(block_id, row_idx)
        .map_err(ErrorMessage::from)
}

pub fn get_block_col_id(
    mgr: &mut Manager,
    id: usize,
    sheet_id: SheetId,
    block_id: BlockId,
    col_idx: usize,
) -> Result<ColId, ErrorMessage> {
    let wb = mgr.get_mut_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_id(sheet_id).map_err(ErrorMessage::from)?;
    ws.get_block_col_id(block_id, col_idx)
        .map_err(ErrorMessage::from)
}

pub fn get_display_window_for_block(
    mgr: &mut Manager,
    id: usize,
    sheet_id: SheetId,
    block_id: BlockId,
) -> Result<DisplayWindow, ErrorMessage> {
    let wb = mgr.get_mut_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_id(sheet_id).map_err(ErrorMessage::from)?;
    ws.get_display_window_for_block(block_id)
        .map_err(ErrorMessage::from)
}

pub fn get_shadow_cell_id(
    mgr: &mut Manager,
    id: usize,
    sheet_idx: usize,
    row_idx: usize,
    col_idx: usize,
    kind: crate::ShadowKind,
) -> Result<SheetCellId, ErrorMessage> {
    let wb = mgr.get_mut_workbook(&id).unwrap();
    wb.get_shadow_cell_id(sheet_idx, row_idx, col_idx, kind)
        .map_err(ErrorMessage::from)
}

pub fn get_shadow_cell_ids(
    mgr: &mut Manager,
    id: usize,
    sheet_idx: usize,
    row_idx: Vec<usize>,
    col_idx: Vec<usize>,
    kind: crate::ShadowKind,
) -> Result<Vec<SheetCellId>, ErrorMessage> {
    let wb = mgr.get_mut_workbook(&id).unwrap();
    wb.get_shawdow_cell_ids(sheet_idx, row_idx, col_idx, kind)
        .map_err(ErrorMessage::from)
}

pub fn get_shadow_info_by_id(
    mgr: &mut Manager,
    id: usize,
    shadow_id: u64,
) -> Result<ShadowCellInfo, ErrorMessage> {
    let wb = mgr.get_mut_workbook(&id).unwrap();
    wb.get_shadow_info_by_id(shadow_id)
        .map_err(ErrorMessage::from)
}

pub fn get_cell_id(
    mgr: &mut Manager,
    id: usize,
    sheet_idx: usize,
    row_idx: usize,
    col_idx: usize,
) -> Result<SheetCellId, ErrorMessage> {
    let wb = mgr.get_mut_workbook(&id).unwrap();
    let sheet_id = wb.get_worksheet_id(sheet_idx).map_err(ErrorMessage::from)?;
    let ws = wb.get_sheet_by_id(sheet_id).map_err(ErrorMessage::from)?;
    let cell_id = ws
        .get_cell_id(row_idx, col_idx)
        .map_err(ErrorMessage::from)?;
    Ok(SheetCellId { sheet_id, cell_id })
}

pub fn get_all_block_fields(mgr: &mut Manager, id: usize) -> Result<Vec<BlockField>, ErrorMessage> {
    let wb = mgr.get_mut_workbook(&id).unwrap();
    wb.get_all_block_fields().map_err(ErrorMessage::from)
}

pub fn handle_transaction(mgr: &mut Manager, id: usize, transaction: Transaction) -> ActionEffect {
    // Process all payloads at once
    let payloads_action = PayloadsAction {
        payloads: transaction.payloads,
        undoable: transaction.undoable,
        init: false,
    };

    let wb = mgr.get_mut_workbook(&id).unwrap();
    if transaction.temp {
        wb.handle_action_in_temp_status(payloads_action)
    } else {
        wb.handle_action(EditAction::Payloads(payloads_action))
    }
}

// ---- Formula helpers (no workbook state) ----------------------------------

pub fn formula_check(f: &str) -> bool {
    let f = f.trim();
    let f = &f[1..];
    lex_success(f)
}

pub fn get_display_units_of_formula(f: &str) -> Result<FormulaDisplayInfo, ErrorMessage> {
    lex_and_fmt(f)
        .ok_or_else(|| ErrorMessage::from(Error::from(BasicError::InvalidFormula(f.to_string()))))
}
