use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn formula_check(f: &str) -> bool {
    use xlrs_controller::lex_success;
    let f = f.trim();
    let f = &f[1..].trim();
    // web_sys::console::log_1(&f.to_string().into());
    let r = lex_success(f);
    // web_sys::console::log_1(&r.to_string().into());
    r
}
