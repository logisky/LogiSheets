use logisheets_rs::{
    lex_and_fmt, lex_success, AppData, AsyncCalcResult, AsyncErr, AsyncFuncResult, BasicError,
    BlockId, ColId, EditAction, Error, PayloadsAction, RowId, RowInfo, SaveFileResult, SheetCellId,
    SheetId, Workbook,
};
use singlyton::{Singleton, SingletonUninit};
use wasm_bindgen::prelude::*;

use crate::{manager::Manager, rpc::Transaction};

pub(crate) static INIT: Singleton<bool> = Singleton::new(false);
pub(crate) static MANAGER: SingletonUninit<Manager> = SingletonUninit::uninit();

#[macro_export]
macro_rules! handle_result {
    ($r:ident) => {
        if let Err(e) = $r {
            let e = logisheets_rs::ErrorMessage::from(e);
            return serde_wasm_bindgen::to_value(&e).unwrap();
        }
        let $r = $r.unwrap();
    };
}

pub(crate) fn init() {
    if *INIT.get() {
        return;
    }
    // Install panic hook so Rust panics surface in the browser console
    // with a stack trace, instead of corrupting the wasm instance
    // silently. Without this, a panic in execute_payload looks like
    // "handle_transaction returned undefined and nothing else happened"
    // from the JS side — exactly the symptom we're chasing.
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
    MANAGER.init(Manager::default());
    let mut init = INIT.get_mut();
    *init = true;
}

pub(crate) fn new_workbook() -> usize {
    init();
    let mut manager = MANAGER.get_mut();
    let id = manager.new_workbook();
    id
}

pub(crate) fn read_file(id: usize, name: String, buf: &[u8]) -> u8 {
    init();
    let ctrl = Workbook::from_file(buf, name);
    match ctrl {
        Ok(c) => {
            let mut manager = MANAGER.get_mut();
            manager.replace_workbook(id, c);
            0
        }
        Err(_) => 1,
    }
}

pub(crate) fn save_file(id: usize, app_data: String) -> JsValue {
    init();
    let result = save_file_impl(id, app_data);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

fn save_file_impl(id: usize, app_data: String) -> SaveFileResult {
    let mut manager = MANAGER.get_mut();
    let ctrl = manager.get_mut_workbook(&id);
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
    if let Ok(data) = ctrl.save() {
        SaveFileResult { data, code: 0 }
    } else {
        SaveFileResult {
            data: vec![],
            code: 1,
        }
    }
}

pub(crate) fn get_app_data(id: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let data = manager
        .get_workbook(&id)
        .map(|ctrl| ctrl.get_app_data())
        .unwrap_or_default();
    serde_wasm_bindgen::to_value(&data).unwrap()
}

pub(crate) fn release(id: usize) {
    init();
    let mut manager = MANAGER.get_mut();
    manager.remove(id)
}

pub(crate) fn undo(id: usize) -> bool {
    init();
    let mut manager = MANAGER.get_mut();
    let ctrl = manager.get_mut_workbook(&id);
    if let Some(ctrl) = ctrl {
        ctrl.undo()
    } else {
        false
    }
}

pub(crate) fn redo(id: usize) -> bool {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id);
    if let Some(ctrl) = wb {
        ctrl.redo()
    } else {
        false
    }
}

pub(crate) fn commit_temp_status(id: usize) -> JsValue {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    let action_effect = wb.commit_temp_status();
    serde_wasm_bindgen::to_value(&action_effect).unwrap()
}

pub(crate) fn clean_temp_status(id: usize) {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    wb.clean_temp_status();
}

pub(crate) fn toggle_status(id: usize, use_temp: bool) {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    wb.toggle_status(use_temp);
}

pub(crate) fn batch_get_cell_info_by_id(id: usize, ids: Vec<SheetCellId>) -> JsValue {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();

    let result = wb.batch_get_cell_info_by_id(ids);
    handle_result!(result);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

pub(crate) fn batch_get_cell_coordinate_with_sheet_by_id(
    id: usize,
    ids: Vec<SheetCellId>,
) -> JsValue {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();

    let result = wb.batch_get_cell_coordinate_with_sheet_by_id(ids);
    handle_result!(result);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

pub(crate) fn get_sheet_name_by_idx(id: usize, idx: usize) -> JsValue {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    let name = wb.get_sheet_name_by_idx(idx);
    handle_result!(name);
    serde_wasm_bindgen::to_value(&name).unwrap()
}

/// Input: AsyncFuncResult
/// Output: ActionAffect
#[wasm_bindgen]
pub fn input_async_result(id: usize, result: JsValue) -> JsValue {
    init();
    let r: AsyncFuncResult = serde_wasm_bindgen::from_value(result).unwrap();
    let values = r
        .values
        .into_iter()
        .map(|v| parse_async_value(v))
        .collect::<Vec<_>>();
    let tasks = r.tasks;
    let result = MANAGER
        .get_mut()
        .get_mut_workbook(&id)
        .unwrap()
        .handle_async_calc_results(tasks, values);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

fn parse_async_value(s: String) -> AsyncCalcResult {
    match s.as_str() {
        "#TIMEOUT!" => Err(AsyncErr::TimeOut),
        "#ARGERR!" => Err(AsyncErr::ArgErr),
        "#NOTFOUND" => Err(AsyncErr::NotFound),
        _ => Ok(s),
    }
}

pub(crate) fn get_sheet_count(id: usize) -> usize {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    wb.get_sheet_count()
}

pub(crate) fn get_all_sheet_info(id: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let result = wb.get_all_sheet_info();
    serde_wasm_bindgen::to_value(&result).unwrap()
}

pub(crate) fn get_row_info(id: usize, sheet_idx: usize, row_idx: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_idx(sheet_idx);
    handle_result!(ws);
    let row_info = ws
        .get_row_info(row_idx)
        .unwrap_or(RowInfo::default(row_idx));
    serde_wasm_bindgen::to_value(&row_info).unwrap()
}

pub fn check_formula(id: usize, f: String) -> bool {
    init();
    let manager = MANAGER.get_mut();
    let wb = manager.get_workbook(&id).unwrap();
    wb.check_formula(f)
}

pub fn calc_condition(id: usize, sheet_idx: usize, f: String) -> JsValue {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    let r = wb.calc_condition(sheet_idx, f);
    handle_result!(r);
    serde_wasm_bindgen::to_value(&r).unwrap()
}

pub fn get_cell_id_by_block_ref(
    id: usize,
    ref_name: String,
    key: String,
    field: String,
) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let r = wb.get_cell_id_by_block_ref(&ref_name, &key, &field);
    handle_result!(r);
    serde_wasm_bindgen::to_value(&r).unwrap()
}

pub fn export_block_data(
    id: usize,
    ref_name: String,
    key_filter: Option<Vec<String>>,
    field_filter: Option<Vec<String>>,
) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let r = wb.export_block_data(&ref_name, key_filter, field_filter);
    handle_result!(r);
    serde_wasm_bindgen::to_value(&r).unwrap()
}

pub fn get_temp_status_changes(id: usize) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let r = wb.get_temp_status_changes();
    handle_result!(r);
    serde_wasm_bindgen::to_value(&r).unwrap()
}

pub fn check_bind_block(
    id: usize,
    sheet_idx: usize,
    block_id: usize,
    row_count: usize,
    col_count: usize,
) -> bool {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    let r = wb.check_bind_block(sheet_idx, block_id, row_count, col_count);
    match r {
        Ok(_) => true,
        Err(_) => false,
    }
}

pub fn get_available_block_id(id: usize, sheet_idx: usize) -> JsValue {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    let r = wb.get_available_block_id(sheet_idx);
    handle_result!(r);
    serde_wasm_bindgen::to_value(&r).unwrap()
}

pub fn get_sheet_id(id: usize, sheet_idx: usize) -> JsValue {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    let r = wb.get_worksheet_id(sheet_idx);
    handle_result!(r);
    serde_wasm_bindgen::to_value(&r).unwrap()
}

pub fn get_sheet_idx(id: usize, sheet_id: SheetId) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let r = wb.get_sheet_idx_by_id(sheet_id);
    handle_result!(r);
    serde_wasm_bindgen::to_value(&r).unwrap()
}

pub fn get_block_values(
    id: usize,
    sheet_id: SheetId,
    block_id: BlockId,
    row_ids: Vec<RowId>,
    col_ids: Vec<ColId>,
) -> JsValue {
    init();
    let manager = MANAGER.get();
    let wb = manager.get_workbook(&id).unwrap();
    let r = wb.get_block_values(sheet_id, block_id, &row_ids, &col_ids);
    handle_result!(r);
    serde_wasm_bindgen::to_value(&r).unwrap()
}

pub fn get_block_row_id(
    id: usize,
    sheet_id: SheetId,
    block_id: BlockId,
    row_idx: usize,
) -> JsValue {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_id(sheet_id);
    handle_result!(ws);
    let r = ws.get_block_row_id(block_id, row_idx);
    handle_result!(r);
    serde_wasm_bindgen::to_value(&r).unwrap()
}

pub fn get_block_col_id(
    id: usize,
    sheet_id: SheetId,
    block_id: BlockId,
    col_idx: usize,
) -> JsValue {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_id(sheet_id);
    handle_result!(ws);
    let r = ws.get_block_col_id(block_id, col_idx);
    handle_result!(r);
    serde_wasm_bindgen::to_value(&r).unwrap()
}

pub fn get_display_window_for_block(id: usize, sheet_id: SheetId, block_id: BlockId) -> JsValue {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    let ws = wb.get_sheet_by_id(sheet_id);
    handle_result!(ws);
    let r = ws.get_display_window_for_block(block_id);
    handle_result!(r);
    serde_wasm_bindgen::to_value(&r).unwrap()
}

pub fn get_shadow_cell_id(
    id: usize,
    sheet_idx: usize,
    row_idx: usize,
    col_idx: usize,
    kind: logisheets_rs::ShadowKind,
) -> JsValue {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    let r = wb.get_shadow_cell_id(sheet_idx, row_idx, col_idx, kind);
    handle_result!(r);
    serde_wasm_bindgen::to_value(&r).unwrap()
}

pub fn get_shadow_cell_ids(
    id: usize,
    sheet_idx: usize,
    row_idx: Vec<usize>,
    col_idx: Vec<usize>,
    kind: logisheets_rs::ShadowKind,
) -> JsValue {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    let r = wb.get_shawdow_cell_ids(sheet_idx, row_idx, col_idx, kind);
    handle_result!(r);
    serde_wasm_bindgen::to_value(&r).unwrap()
}

pub fn get_shadow_info_by_id(id: usize, shadow_id: u64) -> JsValue {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    let r = wb.get_shadow_info_by_id(shadow_id);
    handle_result!(r);
    serde_wasm_bindgen::to_value(&r).unwrap()
}

pub fn get_cell_id(id: usize, sheet_idx: usize, row_idx: usize, col_idx: usize) -> JsValue {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    let sheet_id = wb.get_worksheet_id(sheet_idx);
    handle_result!(sheet_id);
    let ws = wb.get_sheet_by_id(sheet_id);
    handle_result!(ws);
    let r = ws.get_cell_id(row_idx, col_idx);
    handle_result!(r);
    let r = SheetCellId {
        sheet_id,
        cell_id: r,
    };
    serde_wasm_bindgen::to_value(&r).unwrap()
}

pub fn formula_check(f: &str) -> bool {
    let f = f.trim();
    let f = &f[1..];
    let r = lex_success(f);
    r
}

pub fn get_display_units_of_formula(f: &str) -> JsValue {
    let r = lex_and_fmt(f).ok_or(Error::from(BasicError::InvalidFormula(f.to_string())));
    handle_result!(r);
    serde_wasm_bindgen::to_value(&r).unwrap()
}

pub fn get_all_block_fields(id: usize) -> JsValue {
    init();
    let mut manager = MANAGER.get_mut();
    let wb = manager.get_mut_workbook(&id).unwrap();
    let r = wb.get_all_block_fields();
    handle_result!(r);
    serde_wasm_bindgen::to_value(&r).unwrap()
}

pub fn handle_transaction(id: usize, transaction: Transaction) -> JsValue {
    init();
    let mut manager = MANAGER.get_mut();

    // Process all payloads at once
    let payloads_action = PayloadsAction {
        payloads: transaction.payloads,
        undoable: transaction.undoable,
        init: false,
    };

    let wb = manager.get_mut_workbook(&id).unwrap();
    let action_effect = if transaction.temp {
        wb.handle_action_in_temp_status(payloads_action)
    } else {
        wb.handle_action(EditAction::Payloads(payloads_action))
    };

    // If the engine rejected the tx, surface the captured error string
    // to the browser console instead of dropping it into stdout (which
    // is a no-op in wasm).
    if let logisheets_rs::StatusCode::Err(_) = action_effect.status {
        if let Some(msg) = logisheets_rs::take_last_error() {
            web_sys::console::error_1(
                &format!("[handle_transaction] engine error: {}", msg).into(),
            );
        }
    }

    serde_wasm_bindgen::to_value(&action_effect).unwrap()
}
