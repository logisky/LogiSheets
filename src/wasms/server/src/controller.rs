use crate::async_helper::PendingTask;

use super::async_helper::AsyncHelper;
use logisheets_controller::controller::edit_action::{
    BlockInput, CellInput, ColShift, CreateBlock, EditAction, EditPayload, MoveBlock,
    PayloadsAction, RowShift,
};
use logisheets_controller::controller::{display::DisplayRequest, Controller};
use logisheets_controller::{AsyncCalcResult, AsyncErr, Task};
use serde::{Deserialize, Serialize};
use singlyton::{Singleton, SingletonUninit};
use wasm_bindgen::prelude::*;

static INIT: Singleton<bool> = Singleton::new(false);
static CONTROLLER: SingletonUninit<Controller> = SingletonUninit::uninit();
static ASYNC_HELPER: SingletonUninit<AsyncHelper> = SingletonUninit::uninit();
static PAYLOADS: Singleton<Vec<EditPayload>> = Singleton::new(vec![]);

fn init() {
    if *INIT.get() {
        return;
    }
    CONTROLLER.init(Controller::default());
    ASYNC_HELPER.init(AsyncHelper::default());
}

#[wasm_bindgen]
pub fn read_file(name: String, buf: &[u8]) -> ReadFileResult {
    let ctrl = Controller::from_file(name, buf);
    match ctrl {
        Ok(c) => {
            CONTROLLER.replace(c);
            ReadFileResult::Ok
        }
        Err(_) => ReadFileResult::FileErr,
    }
}

#[wasm_bindgen]
pub fn undo() -> bool {
    init();
    let mut ctrl = CONTROLLER.get_mut();
    ctrl.undo()
}

#[wasm_bindgen]
pub fn redo() -> bool {
    init();
    let mut ctrl = CONTROLLER.get_mut();
    ctrl.redo()
}

#[wasm_bindgen]
pub fn transaction_start() -> TransactionStartResult {
    init();
    PAYLOADS.get_mut().clear();
    TransactionStartResult::Ok
}

#[wasm_bindgen]
/// The JSON format of `TransactionEndResult`.
pub fn transaction_end(undoable: bool) -> JsValue {
    init();
    let mut empty = vec![];
    let mut payloads = PAYLOADS.get_mut();
    std::mem::swap(&mut empty, &mut payloads);
    let mut ctrl = CONTROLLER.get_mut();
    let action = EditAction::Payloads(PayloadsAction {
        payloads: empty,
        undoable,
    });
    let result = match ctrl.handle_action(action) {
        Some(effect) => {
            let async_id = if effect.async_tasks.len() > 0 {
                let t = PendingTask {
                    tasks: effect.async_tasks.clone(),
                    dirtys: effect.dirtys.clone(),
                };
                ASYNC_HELPER.get_mut().add_pending_task(t)
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
    serde_wasm_bindgen::to_value(&result).unwrap()
}

/// Input: AsyncFuncResult
/// Output: TransactionEndResult
#[wasm_bindgen]
pub fn input_async_result(result: &JsValue) -> JsValue {
    init();
    let r: AsyncFuncResult = serde_wasm_bindgen::from_value(result.clone()).unwrap();
    let transaction_result = match ASYNC_HELPER.get_mut().get_pending_task(r.async_id) {
        Some(pending) => {
            let values = r
                .values
                .into_iter()
                .map(|v| parse_async_value(v))
                .collect::<Vec<_>>();
            let tasks = pending.tasks;
            let dirtys = pending.dirtys;
            let action_effect = CONTROLLER
                .get_mut()
                .handle_async_calc_results(tasks, values, dirtys);
            match action_effect {
                Some(effect) => {
                    let async_id = if effect.async_tasks.len() > 0 {
                        let t = PendingTask {
                            tasks: effect.async_tasks.clone(),
                            dirtys: effect.dirtys.clone(),
                        };
                        ASYNC_HELPER.get_mut().add_pending_task(t)
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
    serde_wasm_bindgen::to_value(&transaction_result).unwrap()
}

#[wasm_bindgen]
/// logisheets_controller::DisplayResponse
pub fn get_patches(sheet_idx: u32, version: u32) -> JsValue {
    init();
    let ctrl = CONTROLLER.get();
    let response = ctrl.get_display_response(DisplayRequest {
        sheet_idx: sheet_idx as usize,
        version,
    });
    let res = serde_wasm_bindgen::to_value(&response);
    match res {
        Ok(r) => r,
        Err(err) => {
            #[allow(unused_unsafe)]
            unsafe {
                web_sys::console::log_1(&err.to_string().into())
            };
            panic!()
        }
    }
}

#[wasm_bindgen]
pub fn cell_input(sheet_idx: usize, row: usize, col: usize, content: String) {
    init();
    let mut payloads = PAYLOADS.get_mut();
    payloads.push(EditPayload::CellInput(CellInput {
        sheet_idx,
        row,
        col,
        content,
    }));
}

#[wasm_bindgen]
pub fn row_insert(sheet_idx: usize, start: usize, count: usize) {
    init();
    let mut payloads = PAYLOADS.get_mut();
    payloads.push(EditPayload::RowShift(RowShift {
        sheet_idx,
        row: start,
        count,
        insert: true,
    }));
}

#[wasm_bindgen]
pub fn row_delete(sheet_idx: usize, start: usize, count: usize) {
    init();
    let mut payloads = PAYLOADS.get_mut();
    payloads.push(EditPayload::RowShift(RowShift {
        sheet_idx,
        row: start,
        count,
        insert: false,
    }));
}

#[wasm_bindgen]
pub fn col_insert(sheet_idx: usize, start: usize, count: usize) {
    init();
    let mut payloads = PAYLOADS.get_mut();
    payloads.push(EditPayload::ColShift(ColShift {
        sheet_idx,
        col: start,
        count,
        insert: true,
    }));
}

#[wasm_bindgen]
pub fn col_delete(sheet_idx: usize, start: usize, count: usize) {
    init();
    let mut payloads = PAYLOADS.get_mut();
    payloads.push(EditPayload::ColShift(ColShift {
        sheet_idx,
        col: start,
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
    init();
    let b = CreateBlock {
        sheet_idx,
        master_row,
        master_col,
        row_cnt,
        col_cnt,
        id,
    };
    let mut payloads = PAYLOADS.get_mut();
    payloads.push(EditPayload::CreateBlock(b));
}

#[wasm_bindgen]
pub fn move_block(sheet_idx: usize, id: usize, row: usize, col: usize) {
    init();
    let m = MoveBlock {
        sheet_idx,
        id,
        new_master_row: row,
        new_master_col: col,
    };
    let mut payloads = PAYLOADS.get_mut();
    payloads.push(EditPayload::MoveBlock(m));
}

#[wasm_bindgen]
pub fn block_input(sheet_idx: usize, block_id: usize, row: usize, col: usize, input: String) {
    init();
    let bi = BlockInput {
        sheet_idx,
        block_id,
        row,
        col,
        input,
    };
    let mut payloads = PAYLOADS.get_mut();
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
