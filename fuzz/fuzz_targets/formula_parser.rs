// Fuzz the formula lexer/parser/evaluator: any byte string, fed as a cell
// formula, must never panic the engine (it may produce an error value). The
// stable-toolchain counterpart is `arbitrary_formula_never_panics` in
// tests/proptest_engine.rs; this target explores far deeper (coverage-guided).
#![no_main]

use libfuzzer_sys::fuzz_target;
use logisheets::{EditAction, Workbook};
use logisheets_controller::edit_action::{CellInput, PayloadsAction};

fuzz_target!(|data: &[u8]| {
    let Ok(s) = std::str::from_utf8(data) else {
        return;
    };
    let mut wb = Workbook::default();
    wb.handle_action(EditAction::Payloads(
        PayloadsAction::new().add_payload(CellInput {
            sheet_idx: 0,
            row: 0,
            col: 0,
            content: format!("={}", s),
        }),
    ));
    if let Ok(ws) = wb.get_sheet_by_idx(0) {
        let _ = ws.get_value(0, 0);
    }
});
