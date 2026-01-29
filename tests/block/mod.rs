use logisheets_controller::edit_action::{BindFormSchema, EditPayload, PayloadsAction};

use crate::load_script;

use super::test_script;

#[test]
fn test_create_block() {
    test_script("tests/block/create_block.script");
}

#[test]
fn test_move_block() {
    test_script("tests/block/move_block.script");
}

#[test]
fn test_resize_block() {
    test_script("tests/block/resize_block.script");
}

#[test]
fn test_convert_block() {
    test_script("tests/block/convert_block.script");
}

#[test]
fn test_bind_block_schema() {
    let mut workbook = load_script("tests/block/create_block.script");
    let _ = workbook.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::BindFormSchema(BindFormSchema {
            sheet_idx: 0,
            block_id: 1,
            ref_name: "test".to_string(),
            field_from: 0,
            key_idx: 0,
            fields: vec!["name".to_string(), "age".to_string(), "address".to_string()],
            render_ids: vec![
                "test1".to_string(),
                "test2".to_string(),
                "test3".to_string(),
            ],
            row: true,
        })],
        undoable: true,
        init: false,
    }));

    let ws = workbook.get_sheet_by_idx(0).unwrap();
    let window = ws.get_display_window(0, 0, 5, 5).unwrap();
    let blocks = window.blocks;
    assert_eq!(blocks.len(), 1);
    let block = &blocks[0];
    println!("{:?}", &block.info.schema);
    assert!(block.info.schema.is_some());
}
