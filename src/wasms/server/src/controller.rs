use crate::async_helper::PendingTask;

use super::async_helper::AsyncHelper;
use lazy_static::lazy_static;
use logisheets_controller::controller::edit_action::{
    BlockInput, CellInput, ColShift, CreateBlock, EditAction, EditPayload, MoveBlock, RowShift,
};
use logisheets_controller::controller::{display::DisplayRequest, Controller};
use logisheets_controller::{AsyncCalcResult, AsyncErr, Task};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use wasm_bindgen::prelude::*;

lazy_static! {
    static ref CONTROLLER: Mutex<Controller> = Mutex::new(Controller::default());
    static ref PAYLOADS: Mutex<Vec<EditPayload>> = Mutex::new(vec![]);
    static ref ASYNC_HELPER: Mutex<AsyncHelper> = Mutex::new(AsyncHelper::default());
}

#[wasm_bindgen]
pub fn read_file(name: String, buf: &[u8]) -> ReadFileResult {
    let mut old_ctrl = CONTROLLER.lock().unwrap();
    let ctrl = Controller::from_file(name, buf);
    match ctrl {
        Ok(c) => {
            *old_ctrl = c;
            ReadFileResult::Ok
        }
        Err(_) => ReadFileResult::FileErr,
    }
}

#[wasm_bindgen]
pub fn undo() -> bool {
    let mut ctrl = CONTROLLER.lock().unwrap();
    ctrl.undo()
}

#[wasm_bindgen]
pub fn redo() -> bool {
    let mut ctrl = CONTROLLER.lock().unwrap();
    ctrl.redo()
}

#[wasm_bindgen]
pub fn transaction_start() -> TransactionStartResult {
    web_sys::console::log_1(&"ssss".to_string().into());
    TransactionStartResult::Ok
}

#[wasm_bindgen]
/// The JSON format of `TransactionEndResult`.
pub fn transaction_end(undoable: bool) -> JsValue {
    web_sys::console::log_1(&"hhhh".to_string().into());
    let mut empty = Vec::<EditPayload>::new();
    let mut payloads = PAYLOADS.lock().unwrap();
    web_sys::console::log_1(&"tttt".to_string().into());
    std::mem::swap(&mut empty, &mut payloads);
    let mut ctrl = CONTROLLER.lock().unwrap();
    web_sys::console::log_1(&"qqqqq".to_string().into());
    let action = EditAction::Payloads(empty);
    let result = match ctrl.handle_action(action, undoable) {
        Some(effect) => {
            let async_id = if effect.async_tasks.len() > 0 {
                let t = PendingTask {
                    tasks: effect.async_tasks.clone(),
                    dirtys: effect.dirtys.clone(),
                };
                ASYNC_HELPER.lock().unwrap().add_pending_task(t)
            } else {
                0
            };
            let r = TransactionEndResult {
                sheet_idx: effect.sheets,
                tasks: effect.async_tasks,
                async_id,
                code: TransactionCode::Ok,
            };
            r
        }
        None => TransactionEndResult::from_err_code(TransactionCode::Err),
    };
    JsValue::from_serde(&result).unwrap()
}

/// Input: AsyncFuncResult
/// Output: TransactionEndResult
#[wasm_bindgen]
pub fn input_async_result(result: &JsValue) -> JsValue {
    let r: AsyncFuncResult = result.into_serde().unwrap();
    let transaction_result = match ASYNC_HELPER.lock().unwrap().get_pending_task(r.async_id) {
        Some(pending) => {
            let values = r
                .values
                .into_iter()
                .map(|v| parse_async_value(v))
                .collect::<Vec<_>>();
            let tasks = pending.tasks;
            let dirtys = pending.dirtys;
            let action_effect = CONTROLLER
                .lock()
                .unwrap()
                .handle_async_calc_results(tasks, values, dirtys);
            match action_effect {
                Some(effect) => {
                    let async_id = if effect.async_tasks.len() > 0 {
                        let t = PendingTask {
                            tasks: effect.async_tasks.clone(),
                            dirtys: effect.dirtys.clone(),
                        };
                        ASYNC_HELPER.lock().unwrap().add_pending_task(t)
                    } else {
                        0
                    };
                    TransactionEndResult {
                        sheet_idx: effect.sheets,
                        tasks: effect.async_tasks,
                        async_id,
                        code: TransactionCode::Ok,
                    }
                }
                None => TransactionEndResult::from_err_code(TransactionCode::Err),
            }
        }
        None => TransactionEndResult::from_err_code(TransactionCode::Err),
    };
    JsValue::from_serde(&transaction_result).unwrap()
}

#[wasm_bindgen]
/// logisheets_controller::DisplayResponse
pub fn get_patches(sheet_idx: u32, version: u32) -> JsValue {
    let mut ctrl = CONTROLLER.lock().unwrap();
    let response = ctrl.get_display_response(DisplayRequest {
        sheet_idx: sheet_idx as usize,
        version,
    });
    let res = JsValue::from_serde(&response);
    match res {
        Ok(r) => r,
        Err(err) => {
            web_sys::console::log_1(&err.to_string().into());
            panic!()
        }
    }
}

#[wasm_bindgen]
pub fn cell_input(sheet_idx: usize, row: usize, col: usize, content: String) {
    let mut payloads = PAYLOADS.lock().unwrap();
    payloads.push(EditPayload::CellInput(CellInput {
        sheet_idx,
        row,
        col,
        content,
    }));
}

#[wasm_bindgen]
pub fn row_insert(sheet_idx: usize, start: usize, count: usize) {
    let mut payloads = PAYLOADS.lock().unwrap();
    payloads.push(EditPayload::RowShift(RowShift {
        sheet_idx,
        start,
        count,
        insert: true,
    }));
}

#[wasm_bindgen]
pub fn row_delete(sheet_idx: usize, start: usize, count: usize) {
    let mut payloads = PAYLOADS.lock().unwrap();
    payloads.push(EditPayload::RowShift(RowShift {
        sheet_idx,
        start,
        count,
        insert: false,
    }));
}

#[wasm_bindgen]
pub fn col_insert(sheet_idx: usize, start: usize, count: usize) {
    let mut payloads = PAYLOADS.lock().unwrap();
    payloads.push(EditPayload::ColShift(ColShift {
        sheet_idx,
        start,
        count,
        insert: true,
    }));
}

#[wasm_bindgen]
pub fn col_delete(sheet_idx: usize, start: usize, count: usize) {
    let mut payloads = PAYLOADS.lock().unwrap();
    payloads.push(EditPayload::ColShift(ColShift {
        sheet_idx,
        start,
        count,
        insert: false,
    }));
}

#[wasm_bindgen]
pub fn create_block(
    sheet_idx: usize,
    id: usize,
    master_row: usize,
    master_col: usize,
    row_cnt: usize,
    col_cnt: usize,
) {
    let b = CreateBlock {
        sheet_idx,
        master_row,
        master_col,
        row_cnt,
        col_cnt,
        id,
    };
    let mut payloads = PAYLOADS.lock().unwrap();
    payloads.push(EditPayload::CreateBlock(b));
}

#[wasm_bindgen]
pub fn move_block(sheet_idx: usize, id: usize, row: usize, col: usize) {
    let m = MoveBlock {
        sheet_idx,
        id,
        new_master_row: row,
        new_master_col: col,
    };
    let mut payloads = PAYLOADS.lock().unwrap();
    payloads.push(EditPayload::MoveBlock(m));
}

#[wasm_bindgen]
pub fn block_input(sheet_idx: usize, id: usize, row: usize, col: usize, input: String) {
    let bi = BlockInput {
        sheet_idx,
        id,
        row,
        col,
        input,
    };
    let mut payloads = PAYLOADS.lock().unwrap();
    payloads.push(EditPayload::BlockInput(bi));
}

#[wasm_bindgen]
pub enum ReadFileResult {
    Ok,
    FileErr,
}

#[wasm_bindgen]
pub enum TransactionStartResult {
    Ok,
}

#[derive(Serialize)]
/// Since `Vec<T>` is not supported type in `wasm-bindgen`, we serialize the
/// result as a JSON.
pub struct TransactionEndResult {
    sheet_idx: Vec<usize>,
    tasks: Vec<Task>,
    async_id: u32,
    code: TransactionCode,
}

#[derive(Deserialize)]
pub struct AsyncFuncResult {
    async_id: u32,
    values: Vec<String>,
}

impl TransactionEndResult {
    pub fn from_err_code(code: TransactionCode) -> Self {
        TransactionEndResult {
            sheet_idx: vec![],
            tasks: vec![],
            async_id: 0,
            code,
        }
    }
}

#[repr(u8)]
#[derive(Serialize)]
pub enum TransactionCode {
    Ok = 0,
    Err = 1,
}

fn parse_async_value(s: String) -> AsyncCalcResult {
    match s.as_str() {
        "#TIMEOUT!" => Err(AsyncErr::TimeOut),
        "#ARGERR!" => Err(AsyncErr::ArgErr),
        _ => Ok(s),
    }
}
