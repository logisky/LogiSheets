use logisheets_controller::edit_action::{CellInput, PayloadsAction};

use crate::load_script;

use super::test_script;

#[test]
fn test_lower_case() {
    test_script("tests/common/lower_case.script");
}

#[test]
fn test_deps1() {
    test_script("tests/common/deps1.script");
}

#[test]
fn test_deps2() {
    test_script("tests/common/deps2.script");
}

#[test]
fn test_transaction() {
    let mut wb = load_script("tests/common/deps3.script");
    let ws = wb.get_sheet_by_idx(0).unwrap();
    let info = ws.get_cell_info(0, 0).unwrap();
    match &info.value {
        logisheets::Value::Number(n) => {
            assert_eq!(*n, 1.0);
        }
        logisheets::Value::Empty => {
            // this is expected since we haven't set any value yet
            println!("empty value found");
        }
        _ => {
            println!("unexpected value type found");
        }
    }
    let result = wb.handle_action(logisheets::EditAction::Payloads(
        PayloadsAction::new()
            .set_undoable(true)
            .set_init(false)
            .add_payload(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 0,
                content: "10".to_string(),
            })
            .add_payload(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 1,
                content: "20".to_string(),
            }),
    ));
    assert_eq!(result.value_changed.len(), 5);
}
