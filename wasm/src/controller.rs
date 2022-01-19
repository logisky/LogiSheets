use crate::async_helper::PendingTask;

use super::async_helper::AsyncHelper;
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use wasm_bindgen::prelude::*;
use xlrs_controller::controller::edit_action::{EditAction, EditPayload};
use xlrs_controller::controller::{display::DisplayRequest, Controller};
use xlrs_controller::{AsyncCalcResult, AsyncErr, Task};

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
        Some(c) => {
            *old_ctrl = c;
            ReadFileResult::Ok
        }
        None => ReadFileResult::FileErr,
    }
}

#[wasm_bindgen]
pub fn transaction_start() -> TransactionStartResult {
    TransactionStartResult::Ok
}

#[wasm_bindgen]
/// The JSON format of `TransactionEndResult`.
pub fn transaction_end(undoable: bool) -> String {
    let mut empty = Vec::<EditPayload>::new();
    let mut payloads = PAYLOADS.lock().unwrap();
    std::mem::swap(&mut empty, &mut payloads);
    let mut ctrl = CONTROLLER.lock().unwrap();
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
    let s = serde_json::to_string(&result).unwrap();
    s
}

#[wasm_bindgen]
pub fn input_async_result(result: String) -> String {
    let r: AsyncFuncResult = serde_json::from_str(&result).unwrap();
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
    let s = serde_json::to_string(&transaction_result).unwrap();
    s
}

#[wasm_bindgen]
/// xlrs_controller::DisplayResponse
pub fn get_patches(sheet_idx: u32, version: u32) -> String {
    let mut ctrl = CONTROLLER.lock().unwrap();
    let response = ctrl.get_display_response(DisplayRequest {
        sheet_idx: sheet_idx as usize,
        version,
    });
    let s = serde_json::to_string(&response).unwrap();
    s
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
