use logisheets_rs::rpc::Manager;
use logisheets_rs::{AsyncCalcResult, AsyncErr, AsyncFuncResult};
use singlyton::{Singleton, SingletonUninit};
use wasm_bindgen::prelude::*;

// ============================================================================
// Browser (WASM) transport state. The `Manager` type and all logic live in
// `logisheets_rs::rpc`; this module only holds the browser's single-threaded
// singleton instance + panic-hook init, plus the async-result entry point that
// the web worker calls directly (it is not routed through `rpc::handle`).
// ============================================================================

pub(crate) static INIT: Singleton<bool> = Singleton::new(false);
pub(crate) static MANAGER: SingletonUninit<Manager> = SingletonUninit::uninit();

pub(crate) fn init() {
    if *INIT.get() {
        return;
    }
    // Install panic hook so Rust panics surface in the browser console
    // with a stack trace, instead of corrupting the wasm instance silently.
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
    MANAGER.init(Manager::default());
    let mut init = INIT.get_mut();
    *init = true;
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
        .map(parse_async_value)
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
