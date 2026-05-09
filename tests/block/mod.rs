use logisheets::Workbook;
use logisheets_controller::edit_action::{
    BindFormSchema, CreateBlock, EditPayload, PayloadsAction, StatusCode,
};

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

/// Reproduces the LogiSheets composer's exact pattern: a block with rowCnt=1
/// and colCnt=N, bound row-wise. Before the executor axis fix this would
/// fail at idx >= 1 with BlockCellIdNotFound, the worker silently swallowed
/// the error, and JS saw "success" with an empty grid.
#[test]
fn test_form_block_rowcnt1_two_fields() {
    let mut wb = Workbook::default();
    let result = wb.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 0,
                id: 1,
                master_row: 10,
                master_col: 7,
                row_cnt: 1,
                col_cnt: 2,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                sheet_idx: 0,
                block_id: 1,
                ref_name: "".to_string(),
                field_from: 0,
                key_idx: 0,
                fields: vec!["abcd".to_string(), "111a".to_string()],
                render_ids: vec!["r0".to_string(), "r1".to_string()],
                row: true,
            }),
        ],
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(result.status, StatusCode::Ok(_)),
        "transaction should succeed; got status: {:?}",
        result.status
    );
    let ws = wb.get_sheet_by_idx(0).unwrap();
    let window = ws.get_display_window(8, 5, 13, 10).unwrap();
    assert_eq!(window.blocks.len(), 1, "block should appear in viewport");
    let block = &window.blocks[0];
    let schema = block
        .info
        .schema
        .as_ref()
        .expect("block must have a schema");
    assert_eq!(schema.fields.len(), 2);
    assert_eq!(schema.fields[0].field, "abcd");
    assert_eq!(schema.fields[1].field, "111a");
}
