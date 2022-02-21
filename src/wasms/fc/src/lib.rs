use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn formula_check(f: &str) -> bool {
    use xlrs_controller::lex_success;
    lex_success(f)
}
