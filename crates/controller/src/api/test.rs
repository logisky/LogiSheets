use crate::edit_action::{
    AddComment, AuthorInput, CommentMention, CreateBlock, DeleteCellImage, DeleteComment,
    EditComment, EditPayload, LineStyleUpdate, ModifyPolicy, PayloadsAction, ResolveComment,
    SetCellImage, SheetRename, StyleUpdateType, WorkbookUpdateType,
};

use super::{EditAction, Workbook};

#[test]
fn data_validation_round_trip() {
    use logisheets_workbook::prelude::{
        CtDataValidation, CtDataValidations, PlainTextString, StDataValidationErrorStyle,
        StDataValidationImeMode, StDataValidationOperator, StDataValidationType, Wb, write,
    };

    // Start from a valid empty workbook, then inject a data-validation rule at
    // the workbook layer to simulate an xlsx authored by Excel.
    let base = Workbook::default().save().unwrap();
    let mut raw = Wb::from_file(&base).unwrap();
    let dv = CtDataValidations {
        data_validations: vec![CtDataValidation {
            formula1: Some(PlainTextString {
                value: "\"Apple,Banana,Cherry\"".to_string(),
                space: None,
            }),
            formula2: None,
            ty: StDataValidationType::List,
            error_style: StDataValidationErrorStyle::Stop,
            ime_mode: StDataValidationImeMode::NoControl,
            operator: StDataValidationOperator::Between,
            blank: true,
            show_drop_down: false,
            show_input_message: false,
            show_error_message: true,
            prompt_title: None,
            prompt: None,
            sqref: "A1:A10".to_string(),
        }],
        disable_prompts: false,
        x_window: None,
        y_window: None,
        count: 1,
    };
    raw.xl
        .worksheets
        .values_mut()
        .next()
        .unwrap()
        .worksheet_part
        .data_validations = Some(dv);
    let input = write(raw).unwrap();

    // Round-trip through the controller: load, save, reload.
    let wb = Workbook::from_file(&input, "dv".to_string()).unwrap();
    let out = wb.save().unwrap();

    // The validation must survive (previously the saver dropped it: wrote None).
    let reloaded = Wb::from_file(&out).unwrap();
    let ws = reloaded.xl.worksheets.values().next().unwrap();
    let dv2 = ws
        .worksheet_part
        .data_validations
        .as_ref()
        .expect("data validation should survive the controller round trip");
    assert_eq!(dv2.data_validations.len(), 1);
    assert_eq!(dv2.data_validations[0].sqref, "A1:A10");
    assert!(matches!(
        dv2.data_validations[0].ty,
        StDataValidationType::List
    ));
    assert_eq!(
        dv2.data_validations[0].formula1.as_ref().unwrap().value,
        "\"Apple,Banana,Cherry\""
    );
}

#[test]
fn data_validation_flags_invalid_cell() {
    use crate::controller::display::Value;
    use crate::edit_action::CellInput;
    use crate::sid_assigner::ShadowKind;
    use logisheets_base::CellId;
    use logisheets_workbook::prelude::{
        CtDataValidation, CtDataValidations, PlainTextString, StDataValidationErrorStyle,
        StDataValidationImeMode, StDataValidationOperator, StDataValidationType, Wb, write,
    };

    // Author an xlsx that already contains A1="Apple" (valid) and A2="Zebra"
    // (invalid) so the values are present at load time — shadows are only
    // materialized on load (from_file), not on later edits.
    let mut authored = Workbook::default();
    authored.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 0,
                content: "Apple".to_string(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 1,
                col: 0,
                content: "Zebra".to_string(),
            }),
        ],
        undoable: false,
        init: false,
    }));
    let base = authored.save().unwrap();

    // Inject a list rule on A1:A10 accepting only Apple/Banana.
    let mut raw = Wb::from_file(&base).unwrap();
    let dv = CtDataValidations {
        data_validations: vec![CtDataValidation {
            formula1: Some(PlainTextString {
                value: "\"Apple,Banana\"".to_string(),
                space: None,
            }),
            formula2: None,
            ty: StDataValidationType::List,
            error_style: StDataValidationErrorStyle::Stop,
            ime_mode: StDataValidationImeMode::NoControl,
            operator: StDataValidationOperator::Between,
            blank: true,
            show_drop_down: false,
            show_input_message: false,
            show_error_message: true,
            prompt_title: None,
            prompt: None,
            sqref: "A1:A10".to_string(),
        }],
        disable_prompts: false,
        x_window: None,
        y_window: None,
        count: 1,
    };
    raw.xl
        .worksheets
        .values_mut()
        .next()
        .unwrap()
        .worksheet_part
        .data_validations = Some(dv);
    let input = write(raw).unwrap();

    // Loading materializes the validation shadows for the non-empty cells.
    let mut wb = Workbook::from_file(&input, "dv".to_string()).unwrap();

    let mut read = |row: usize| -> Value {
        let scid = wb
            .get_shadow_cell_id(0, row, 0, ShadowKind::Validation)
            .unwrap();
        let id = match scid.cell_id {
            CellId::EphemeralCell(i) => i,
            _ => panic!("expected an ephemeral shadow cell"),
        };
        wb.get_shadow_info_by_id(id).unwrap().value
    };
    assert!(
        matches!(read(0), Value::Bool(true)),
        "Apple should be valid"
    );
    assert!(
        matches!(read(1), Value::Bool(false)),
        "Zebra should be invalid"
    );
}

#[test]
fn get_cell_list_validation_reads_list_type() {
    use crate::data_validation_manager::ListValidation;
    use logisheets_workbook::prelude::{
        CtDataValidation, CtDataValidations, PlainTextString, StDataValidationErrorStyle,
        StDataValidationImeMode, StDataValidationOperator, StDataValidationType, Wb, write,
    };

    let mk = |ty: StDataValidationType, f1: &str, sqref: &str| CtDataValidation {
        formula1: Some(PlainTextString {
            value: f1.to_string(),
            space: None,
        }),
        formula2: None,
        ty,
        error_style: StDataValidationErrorStyle::Stop,
        ime_mode: StDataValidationImeMode::NoControl,
        operator: StDataValidationOperator::Between,
        blank: true,
        show_drop_down: true,
        show_input_message: false,
        show_error_message: false,
        prompt_title: None,
        prompt: None,
        sqref: sqref.to_string(),
    };

    let base = Workbook::default().save().unwrap();
    let mut raw = Wb::from_file(&base).unwrap();
    let dv = CtDataValidations {
        data_validations: vec![
            // Inline list on A1:A10.
            mk(
                StDataValidationType::List,
                "\"East,West,North,South\"",
                "A1:A10",
            ),
            // Range-reference list on C1.
            mk(StDataValidationType::List, "$G$1:$G$4", "C1"),
            // A non-list rule that must be ignored on B1.
            mk(StDataValidationType::Whole, "1", "B1"),
        ],
        disable_prompts: false,
        x_window: None,
        y_window: None,
        count: 3,
    };
    raw.xl
        .worksheets
        .values_mut()
        .next()
        .unwrap()
        .worksheet_part
        .data_validations = Some(dv);
    let input = write(raw).unwrap();
    let wb = Workbook::from_file(&input, "dv".to_string()).unwrap();

    // Inline list: A1 (row 0, col 0) is covered.
    assert_eq!(
        wb.get_cell_list_validation(0, 0, 0),
        Some(ListValidation::Inline(vec![
            "East".into(),
            "West".into(),
            "North".into(),
            "South".into(),
        ]))
    );
    // Still covered lower in the sqref range (A10).
    assert!(matches!(
        wb.get_cell_list_validation(0, 9, 0),
        Some(ListValidation::Inline(_))
    ));
    // Range reference comes back raw for the caller to resolve.
    assert_eq!(
        wb.get_cell_list_validation(0, 0, 2),
        Some(ListValidation::Reference("$G$1:$G$4".to_string()))
    );
    // A non-list rule is not surfaced.
    assert_eq!(wb.get_cell_list_validation(0, 0, 1), None);
    // A cell outside every sqref has no validation.
    assert_eq!(wb.get_cell_list_validation(0, 5, 5), None);
}

#[test]
fn cell_image_round_trip() {
    use crate::image_manager::base64;

    // A tiny 1x1 transparent PNG.
    let png: &[u8] = &[
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x01, 0x02, 0x03, 0xFD, 0xFE, 0xFF,
    ];
    let data_b64 = base64::encode(png);

    let mut wb = Workbook::default();
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::SetCellImage(SetCellImage {
            sheet_idx: 0,
            row: 2,
            col: 3,
            image_id: "img-a".to_string(),
            format: "png".to_string(),
            data: data_b64.clone(),
        })],
        undoable: true,
        init: false,
    }));
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));

    // The image is visible via the display API.
    let ws = wb.get_sheet_by_idx(0).unwrap();
    let imgs = ws.get_cell_images();
    assert_eq!(imgs.len(), 1);
    assert_eq!((imgs[0].row, imgs[0].col), (2, 3));
    assert_eq!(imgs[0].format, "png");
    assert_eq!(base64::decode(&imgs[0].data).unwrap(), png);
    drop(ws);

    // Save to xlsx and reload — the image survives the round trip.
    let bytes = wb.save().unwrap();
    let wb2 = Workbook::from_file(&bytes, "reloaded".to_string()).unwrap();
    let ws2 = wb2.get_sheet_by_idx(0).unwrap();
    let imgs2 = ws2.get_cell_images();
    assert_eq!(imgs2.len(), 1, "image should survive save/load");
    assert_eq!((imgs2[0].row, imgs2[0].col), (2, 3));
    assert_eq!(imgs2[0].format, "png");
    assert_eq!(base64::decode(&imgs2[0].data).unwrap(), png);

    // Undo removes it.
    wb.handle_action(EditAction::Undo);
    let ws = wb.get_sheet_by_idx(0).unwrap();
    assert_eq!(
        ws.get_cell_images().len(),
        0,
        "undo should remove the image"
    );
    drop(ws);

    // Delete payload also removes it (redo first to bring it back).
    wb.handle_action(EditAction::Redo);
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::DeleteCellImage(DeleteCellImage {
            sheet_idx: 0,
            row: 2,
            col: 3,
        })],
        undoable: true,
        init: false,
    }));
    let ws = wb.get_sheet_by_idx(0).unwrap();
    assert_eq!(
        ws.get_cell_images().len(),
        0,
        "delete should remove the image"
    );
}

#[test]
fn new_workbook() {
    let mut wb = Workbook::default();
    let ws = wb.get_sheet_by_idx(0).unwrap();

    ws.get_cell_position(100, 100).unwrap();

    let empty_display_window = ws.get_display_window(0, 0, 100, 100).unwrap();
    let row_cnt = empty_display_window.rows.len();
    let col_cnt = empty_display_window.cols.len();
    let cell_cnt = empty_display_window.cells.len();
    assert!(row_cnt >= 100);
    assert!(col_cnt >= 100);
    assert_eq!(row_cnt * col_cnt, cell_cnt);
    assert_eq!(empty_display_window.rows[0].idx, 0);
    assert_eq!(empty_display_window.cols[0].idx, 0);

    let empty_display_resp = ws.get_display_window_response(0., 0., 100., 100.).unwrap();
    assert!(empty_display_resp.window.cells.len() > 0);
    assert!(empty_display_resp.window.rows.len() > 0);
    assert!(empty_display_resp.window.cols.len() > 0);

    assert_eq!(empty_display_resp.window.rows.get(0).unwrap().idx, 0);
    assert_eq!(empty_display_resp.window.cols.get(0).unwrap().idx, 0);
    let v = empty_display_resp
        .window
        .cols
        .into_iter()
        .fold(0., |p, c| return p + c.width);
    assert!(v > 100.);

    let result = wb.handle_action(crate::EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::SheetRename(SheetRename {
            old_name: Some("Sheet1".to_string()),
            new_name: "abcd".to_string(),
            idx: None,
        })],
        undoable: true,
        init: false,
    }));

    match result.status {
        crate::edit_action::StatusCode::Ok(workbook_update_type) => {
            println!("{:?}", workbook_update_type);
            assert!(matches!(workbook_update_type, WorkbookUpdateType::Sheet));
        }
        crate::edit_action::StatusCode::Err(e) => panic!("{:?}", e),
    }
}

#[test]
fn create_block() {
    let mut wb = Workbook::default();
    let id = wb.get_available_block_id(0).unwrap();
    let payload_action = PayloadsAction {
        payloads: vec![EditPayload::CreateBlock(CreateBlock {
            sheet_idx: 0,
            id,
            master_row: 1,
            master_col: 1,
            row_cnt: 3,
            col_cnt: 3,
            owner: None,
            modify_policy: None,
        })],
        undoable: false,
        init: false,
    };
    let _ = wb.handle_action(EditAction::Payloads(payload_action));
    let ws = wb.get_sheet_by_idx(0).unwrap();
    let _ = ws.get_display_window(0, 0, 10, 10).unwrap();
    ws.get_cell_position(1, 1).unwrap();
    ws.get_cell_position(3, 3).unwrap();
    let resp = ws.get_display_window_response(0., 0., 100., 100.).unwrap();
    assert_eq!(resp.window.blocks.len(), 1);
}

#[test]
fn get_col_style() {
    let mut wb = Workbook::default();
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::LineStyleUpdate(LineStyleUpdate {
            sheet_idx: 0,
            from: 0,
            to: 1,
            row: true,
            ty: StyleUpdateType {
                set_num_fmt: Some("0.00".to_string()),
                ..Default::default()
            },
        })],
        undoable: true,
        init: false,
    }));
    let ws = wb.get_sheet_by_idx(0).unwrap();
    let style = ws.get_style(0, 0).unwrap();
    assert_eq!(style.formatter, "0.00");
}

#[test]
fn overwrite_formula_with_plain_value() {
    use crate::controller::display::Value;
    use crate::edit_action::CellInput;

    let mut wb = Workbook::default();

    // Write a formula into A1.
    let r = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 0,
            col: 0,
            content: "=1+1".to_string(),
        })],
        undoable: true,
        init: false,
    }));
    assert!(matches!(r.status, crate::edit_action::StatusCode::Ok(_)));
    let ws = wb.get_sheet_by_idx(0).unwrap();
    assert_eq!(ws.get_formula(0, 0).unwrap(), "1 + 1");
    assert!(matches!(ws.get_value(0, 0).unwrap(), Value::Number(n) if (n - 2.0).abs() < 1e-9));

    // Overwrite with a plain number. The formula must be cleared,
    // otherwise the next recalc re-evaluates 1+1 over the typed "5".
    let r = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 0,
            col: 0,
            content: "5".to_string(),
        })],
        undoable: true,
        init: false,
    }));
    assert!(matches!(r.status, crate::edit_action::StatusCode::Ok(_)));
    let ws = wb.get_sheet_by_idx(0).unwrap();
    assert_eq!(ws.get_formula(0, 0).unwrap(), "");
    match ws.get_value(0, 0).unwrap() {
        Value::Number(n) => assert!((n - 5.0).abs() < 1e-9, "got {}", n),
        v => panic!("expected Number(5), got {:?}", v),
    }
}

// A range link redirects a source range (A1:A2) to a backing block's column.
// The seller's formula references the LITERAL A1:A2, yet:
//   - it reads the block (redirect at range-id resolution),
//   - editing the block recomputes it (the dependency edge is really in the
//     graph, so recalc triggers — not just a lazy value alias),
//   - growing the block (interior insert) makes the aggregate track new rows,
//   - the source A1:A2 cells are never touched (non-destructive facade).
#[test]
fn range_link_redirects_to_block_and_tracks_growth() {
    use crate::controller::display::Value;
    use crate::edit_action::{BindFormSchema, CellInput, InsertRowsInBlock};

    let mut wb = Workbook::default();
    let bid = wb.get_available_block_id(0).unwrap();

    // Backing block: 2 rows x 1 col at D1 (row 0, col 3), seeded 10 / 20, WITH a
    // form schema (a real record — growth tracking rides on the block-field dep).
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 0,
                id: bid,
                master_row: 0,
                master_col: 3,
                row_cnt: 2,
                col_cnt: 1,
                owner: None,
                modify_policy: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "rec".into(), sheet_idx: 0, block_id: bid,
                field_from: 0, key_idx: 0, fields: vec!["v".into()],
                render_ids: vec!["r0".into()], row: true,
                field_formulas: vec![], validation_formulas: vec![], editability_formulas: vec![],
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 3,
                content: "10".to_string(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 1,
                col: 3,
                content: "20".to_string(),
            }),
        ],
        undoable: false,
        init: false,
    }));

    // Link A1:A2 -> the block's column (block rows 0..=1, col 0).
    wb.test_add_range_link(0, (0, 0, 1, 0), bid, 0, 1, 0);

    // Seller formula references the literal A1:A2 -> resolves to the block.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 0,
            col: 4,
            content: "=SUM(A1:A2)".to_string(),
        })],
        undoable: false,
        init: false,
    }));
    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        assert!(
            matches!(ws.get_value(0, 4).unwrap(), Value::Number(n) if (n - 30.0).abs() < 1e-9),
            "linked SUM(A1:A2) should read the block (30), got {:?}",
            ws.get_value(0, 4).unwrap()
        );
        // The source A1 cell was never written — the link is non-destructive.
        assert!(matches!(ws.get_value(0, 0).unwrap(), Value::Empty));
    }

    // Edit a block cell -> the linked formula recomputes.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 0,
            col: 3,
            content: "100".to_string(),
        })],
        undoable: false,
        init: false,
    }));
    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        assert!(
            matches!(ws.get_value(0, 4).unwrap(), Value::Number(n) if (n - 120.0).abs() < 1e-9),
            "SUM should recompute after the block changed (120), got {:?}",
            ws.get_value(0, 4).unwrap()
        );
    }

    // Grow the block 2 -> 3 via interior insert, fill the new row.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::InsertRowsInBlock(InsertRowsInBlock {
            sheet_idx: 0,
            block_id: bid,
            start: 1,
            cnt: 1,
        })],
        undoable: false,
        init: false,
    }));
    // After interior insert: D1=100 (old r0), D2=new (empty), D3=20 (old r1).
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 1,
            col: 3,
            content: "5".to_string(),
        })],
        undoable: false,
        init: false,
    }));
    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        assert!(
            matches!(ws.get_value(0, 4).unwrap(), Value::Number(n) if (n - 125.0).abs() < 1e-9),
            "SUM should include the grown row (100+5+20=125), got {:?}",
            ws.get_value(0, 4).unwrap()
        );
    }
}

// The CreateLink edit payload, driven through the public API, for the real app
// flow: the seller's SUM(A1:A2) formula ALREADY exists (reading literal cells),
// THEN the user links A1:A2 to a block. The existing formula must redirect to the
// block (id remap + recalc), and growth must track — all via handle_action.
#[test]
fn create_link_payload_redirects_existing_formula() {
    use crate::controller::display::Value;
    use crate::edit_action::{BindFormSchema, CellInput, CreateLink, InsertRowsInBlock};

    let mut wb = Workbook::default();
    let bid = wb.get_available_block_id(0).unwrap();

    // Setup: A1=1, A2=2, E1=SUM(A1:A2) (reads the literal cells => 3); plus a
    // separate backing block (with a form schema — a real record) at D1:D2
    // seeded 10 / 20.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::CellInput(CellInput { sheet_idx: 0, row: 0, col: 0, content: "1".to_string() }),
            EditPayload::CellInput(CellInput { sheet_idx: 0, row: 1, col: 0, content: "2".to_string() }),
            EditPayload::CellInput(CellInput { sheet_idx: 0, row: 0, col: 4, content: "=SUM(A1:A2)".to_string() }),
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 0, id: bid, master_row: 0, master_col: 3,
                row_cnt: 2, col_cnt: 1, owner: None, modify_policy: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "rec".into(), sheet_idx: 0, block_id: bid,
                field_from: 0, key_idx: 0, fields: vec!["v".into()],
                render_ids: vec!["r0".into()], row: true,
                field_formulas: vec![], validation_formulas: vec![], editability_formulas: vec![],
            }),
            EditPayload::CellInput(CellInput { sheet_idx: 0, row: 0, col: 3, content: "10".to_string() }),
            EditPayload::CellInput(CellInput { sheet_idx: 0, row: 1, col: 3, content: "20".to_string() }),
        ],
        undoable: false,
        init: false,
    }));
    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        assert!(
            matches!(ws.get_value(0, 4).unwrap(), Value::Number(n) if (n - 3.0).abs() < 1e-9),
            "before link, SUM(A1:A2) reads the literal cells (3), got {:?}",
            ws.get_value(0, 4).unwrap()
        );
    }

    // Link A1:A2 -> the block. The existing SUM must redirect to the block.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CreateLink(CreateLink {
            sheet_idx: 0,
            master_row: 0,
            master_col: 0,
            row_cnt: 2,
            col_cnt: 1,
            block_id: bid,
            block_sheet_idx: None,
        })],
        undoable: false,
        init: false,
    }));
    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        assert!(
            matches!(ws.get_value(0, 4).unwrap(), Value::Number(n) if (n - 30.0).abs() < 1e-9),
            "after link, the existing SUM redirects to the block (30), got {:?}",
            ws.get_value(0, 4).unwrap()
        );
        // Source cells are untouched — still 1, non-destructive.
        assert!(matches!(ws.get_value(0, 0).unwrap(), Value::Number(n) if (n - 1.0).abs() < 1e-9));
    }

    // Grow the block via interior insert + fill -> the linked SUM tracks it.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::InsertRowsInBlock(InsertRowsInBlock {
                sheet_idx: 0, block_id: bid, start: 1, cnt: 1,
            }),
            EditPayload::CellInput(CellInput { sheet_idx: 0, row: 1, col: 3, content: "5".to_string() }),
        ],
        undoable: false,
        init: false,
    }));
    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        assert!(
            matches!(ws.get_value(0, 4).unwrap(), Value::Number(n) if (n - 35.0).abs() < 1e-9),
            "linked SUM tracks the grown block (10+5+20=35), got {:?}",
            ws.get_value(0, 4).unwrap()
        );
    }
}

// Repro of the reported bug: SUM over a range LINKED to a block (block has MORE
// rows than the source) still read the literal source cells. Covers BOTH orders:
// formula created BEFORE the link, and formula created AFTER the link.
#[test]
fn linked_range_size_mismatch_reads_block_both_orders() {
    use crate::controller::display::Value;
    use crate::edit_action::{CellInput, CreateLink};

    let sum_of_block = 1.0 + 3.0 + 4.0 + 5.0 + 6.0 + 7.0; // 26

    // Helper: build a workbook with a 6-row block at D1:D6 (1,3,4,5,6,7) and
    // literal 1,2,3,4 at A1:A4. `formula_first` controls the order of creating
    // =SUM(A1:A4) relative to CreateLink(A1:A4 -> block).
    let build = |formula_first: bool| -> Workbook {
        let mut wb = Workbook::default();
        let bid = wb.get_available_block_id(0).unwrap();
        let mut payloads = vec![
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 0, id: bid, master_row: 0, master_col: 3,
                row_cnt: 6, col_cnt: 1, owner: None, modify_policy: None,
            }),
        ];
        for (i, v) in [1, 3, 4, 5, 6, 7].iter().enumerate() {
            payloads.push(EditPayload::CellInput(CellInput {
                sheet_idx: 0, row: i, col: 3, content: v.to_string(),
            }));
        }
        for (i, v) in [1, 2, 3, 4].iter().enumerate() {
            payloads.push(EditPayload::CellInput(CellInput {
                sheet_idx: 0, row: i, col: 0, content: v.to_string(),
            }));
        }
        let formula = EditPayload::CellInput(CellInput {
            sheet_idx: 0, row: 0, col: 6, content: "=SUM(A1:A4)".to_string(),
        });
        let link = EditPayload::CreateLink(CreateLink {
            sheet_idx: 0, master_row: 0, master_col: 0, row_cnt: 4, col_cnt: 1, block_id: bid, block_sheet_idx: None,
        });
        if formula_first {
            payloads.push(formula);
            payloads.push(link);
        } else {
            payloads.push(link);
            payloads.push(formula);
        }
        wb.handle_action(EditAction::Payloads(PayloadsAction {
            payloads, undoable: false, init: false,
        }));
        wb
    };

    for formula_first in [true, false] {
        let wb = build(formula_first);
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let got = ws.get_value(0, 6).unwrap();
        assert!(
            matches!(got, Value::Number(n) if (n - sum_of_block).abs() < 1e-9),
            "formula_first={formula_first}: SUM(A1:A4) linked to the 6-row block \
             should read the block ({sum_of_block}), got {:?}",
            got
        );
    }
}

// Repro of the reported bug's real cause: a MULTI-column range is linked to a
// multi-column block, but the user SUMs only ONE column of it (a sub-range). The
// reference should map to the block's corresponding column.
#[test]
fn linked_multicol_subcolumn_reference_reads_block_column() {
    use crate::controller::display::Value;
    use crate::edit_action::{CellInput, CreateLink};

    let mut wb = Workbook::default();
    let bid = wb.get_available_block_id(0).unwrap();

    // Block D1:E6 (2 cols x 6 rows): col D = 10,20,30,40,50,60; col E = 1,3,4,5,6,7.
    let mut payloads = vec![EditPayload::CreateBlock(CreateBlock {
        sheet_idx: 0, id: bid, master_row: 0, master_col: 3,
        row_cnt: 6, col_cnt: 2, owner: None, modify_policy: None,
    })];
    for (i, v) in [10, 20, 30, 40, 50, 60].iter().enumerate() {
        payloads.push(EditPayload::CellInput(CellInput {
            sheet_idx: 0, row: i, col: 3, content: v.to_string(),
        }));
    }
    for (i, v) in [1, 3, 4, 5, 6, 7].iter().enumerate() {
        payloads.push(EditPayload::CellInput(CellInput {
            sheet_idx: 0, row: i, col: 4, content: v.to_string(),
        }));
    }
    // Literal 1,2,3,4 in A1:B4 (source), then link A1:B4 (2 cols) -> block.
    for (i, v) in [1, 2, 3, 4].iter().enumerate() {
        payloads.push(EditPayload::CellInput(CellInput {
            sheet_idx: 0, row: i, col: 0, content: (v * 100).to_string(),
        }));
        payloads.push(EditPayload::CellInput(CellInput {
            sheet_idx: 0, row: i, col: 1, content: v.to_string(),
        }));
    }
    // =SUM(B1:B4): only the 2nd column of the linked A1:B4 range.
    payloads.push(EditPayload::CellInput(CellInput {
        sheet_idx: 0, row: 0, col: 6, content: "=SUM(B1:B4)".to_string(),
    }));
    payloads.push(EditPayload::CreateLink(CreateLink {
        sheet_idx: 0, master_row: 0, master_col: 0, row_cnt: 4, col_cnt: 2, block_id: bid, block_sheet_idx: None,
    }));
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads, undoable: false, init: false,
    }));

    // Desired: B (2nd link col) maps to block col E = 1+3+4+5+6+7 = 26.
    let ws = wb.get_sheet_by_idx(0).unwrap();
    let got = ws.get_value(0, 6).unwrap();
    assert!(
        matches!(got, Value::Number(n) if (n - 26.0).abs() < 1e-9),
        "SUM(B1:B4), a sub-column of linked A1:B4, should read block col E (26), got {:?}",
        got
    );
}

// CROSS-SHEET link: the seller's `SUM(A1:A2)` on sheet 0 is backed by a schema'd
// block on sheet 1 (the hidden `__douyoushu_io__` pattern). The formula stays
// native on its own sheet; value + growth + save/load all track the other sheet.
#[test]
fn cross_sheet_linked_column_tracks_block_and_survives_save_load() {
    use crate::controller::display::Value;
    use crate::edit_action::{
        BindFormSchema, CellInput, CreateLink, CreateSheet, InsertRowsInBlock,
    };

    let mut wb = Workbook::default();
    // Sheet 1 ("io") holds the backing block.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CreateSheet(CreateSheet {
            idx: 1,
            new_name: "io".into(),
        })],
        undoable: false,
        init: false,
    }));
    let bid = wb.get_available_block_id(1).unwrap();
    // Sheet 1: schema'd block D1:D2 = 10, 20. Sheet 0: =SUM(A1:A2) cross-sheet
    // linked to that block.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 1, id: bid, master_row: 0, master_col: 3,
                row_cnt: 2, col_cnt: 1, owner: None, modify_policy: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "rec".into(), sheet_idx: 1, block_id: bid,
                field_from: 0, key_idx: 0, fields: vec!["v".into()],
                render_ids: vec!["r0".into()], row: true,
                field_formulas: vec![], validation_formulas: vec![], editability_formulas: vec![],
            }),
            EditPayload::CellInput(CellInput { sheet_idx: 1, row: 0, col: 3, content: "10".into() }),
            EditPayload::CellInput(CellInput { sheet_idx: 1, row: 1, col: 3, content: "20".into() }),
            EditPayload::CellInput(CellInput { sheet_idx: 0, row: 0, col: 6, content: "=SUM(A1:A2)".into() }),
            EditPayload::CreateLink(CreateLink {
                sheet_idx: 0, master_row: 0, master_col: 0, row_cnt: 2, col_cnt: 1,
                block_id: bid, block_sheet_idx: Some(1),
            }),
        ],
        undoable: false, init: false,
    }));
    let val = |wb: &Workbook| wb.get_sheet_by_idx(0).unwrap().get_value(0, 6).unwrap();
    assert!(matches!(val(&wb), Value::Number(n) if (n - 30.0).abs() < 1e-9),
        "cross-sheet SUM reads the block on sheet 1 (30), got {:?}", val(&wb));
    // The facade A1 on sheet 0 stays empty (non-destructive).
    assert!(matches!(wb.get_sheet_by_idx(0).unwrap().get_value(0, 0).unwrap(), Value::Empty));

    // Append a row on sheet 1 + fill → the sheet-0 SUM tracks.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::InsertRowsInBlock(InsertRowsInBlock { sheet_idx: 1, block_id: bid, start: 2, cnt: 1 }),
            EditPayload::CellInput(CellInput { sheet_idx: 1, row: 2, col: 3, content: "7".into() }),
        ],
        undoable: false, init: false,
    }));
    assert!(matches!(val(&wb), Value::Number(n) if (n - 37.0).abs() < 1e-9),
        "cross-sheet SUM tracks the appended block row (37), got {:?}", val(&wb));
    // A later edit of the appended cell (separate txn) recomputes across sheets.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput { sheet_idx: 1, row: 2, col: 3, content: "100".into() })],
        undoable: false, init: false,
    }));
    assert!(matches!(val(&wb), Value::Number(n) if (n - 130.0).abs() < 1e-9),
        "cross-sheet later edit recomputes (130), got {:?}", val(&wb));

    // Save/load keeps the cross-sheet link (formula stays native on sheet 0).
    let bytes = wb.save().expect("save");
    let wb2 = Workbook::from_file(&bytes, "reloaded".into()).expect("load");
    let ws0 = wb2.get_sheet_by_idx(0).unwrap();
    assert_eq!(ws0.get_links().len(), 1, "cross-sheet link restored on load");
    assert_eq!(ws0.get_formula(0, 6).unwrap(), "SUM(A1:A2)");
    assert!(matches!(ws0.get_value(0, 6).unwrap(), Value::Number(n) if (n - 130.0).abs() < 1e-9),
        "cross-sheet value survives save/load (130)");
}

// A link survives save -> load: the link map is persisted in the LogiSheets
// ooxml part, the formula keeps its FACADE reference (`SUM(A1:A2)`, not the
// block's coords), and value + growth still work after the round-trip.
#[test]
fn link_survives_save_load() {
    use crate::controller::display::Value;
    use crate::edit_action::{BindFormSchema, CellInput, CreateLink, InsertRowsInBlock};

    let mut wb = Workbook::default();
    let bid = wb.get_available_block_id(0).unwrap();
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 0, id: bid, master_row: 0, master_col: 3,
                row_cnt: 2, col_cnt: 1, owner: None, modify_policy: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "rec".into(), sheet_idx: 0, block_id: bid,
                field_from: 0, key_idx: 0, fields: vec!["v".into()],
                render_ids: vec!["r0".into()], row: true,
                field_formulas: vec![], validation_formulas: vec![], editability_formulas: vec![],
            }),
            EditPayload::CellInput(CellInput { sheet_idx: 0, row: 0, col: 3, content: "10".into() }),
            EditPayload::CellInput(CellInput { sheet_idx: 0, row: 1, col: 3, content: "20".into() }),
            EditPayload::CellInput(CellInput { sheet_idx: 0, row: 0, col: 5, content: "=SUM(A1:A2)".into() }),
            EditPayload::CreateLink(CreateLink {
                sheet_idx: 0, master_row: 0, master_col: 0, row_cnt: 2, col_cnt: 1, block_id: bid, block_sheet_idx: None,
            }),
        ],
        undoable: false, init: false,
    }));
    assert!(matches!(wb.get_sheet_by_idx(0).unwrap().get_value(0, 5).unwrap(),
        Value::Number(n) if (n - 30.0).abs() < 1e-9));

    let bytes = wb.save().expect("save");
    let mut wb2 = Workbook::from_file(&bytes, "reloaded".into()).expect("load");
    let ws2 = wb2.get_sheet_by_idx(0).unwrap();
    // The link persisted...
    assert_eq!(ws2.get_links().len(), 1, "the link should be restored on load");
    // ...the formula kept its facade reference (NOT baked to the block coords)...
    assert_eq!(ws2.get_formula(0, 5).unwrap(), "SUM(A1:A2)");
    // ...it still reads the block, and the facade A1:A2 stays empty.
    assert!(matches!(ws2.get_value(0, 5).unwrap(), Value::Number(n) if (n - 30.0).abs() < 1e-9));
    assert!(matches!(ws2.get_value(0, 0).unwrap(), Value::Empty));

    // Growth still works after load.
    wb2.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::InsertRowsInBlock(InsertRowsInBlock { sheet_idx: 0, block_id: bid, start: 2, cnt: 1 }),
            EditPayload::CellInput(CellInput { sheet_idx: 0, row: 2, col: 3, content: "7".into() }),
        ],
        undoable: false, init: false,
    }));
    assert!(matches!(wb2.get_sheet_by_idx(0).unwrap().get_value(0, 5).unwrap(),
        Value::Number(n) if (n - 37.0).abs() < 1e-9));
}

// A linked record column must follow the block when it grows at the TAIL
// (a new record appended after the last row), not just on interior inserts.
#[test]
fn linked_column_tracks_tail_append() {
    use crate::controller::display::Value;
    use crate::edit_action::{CellInput, CreateLink, InsertRowsInBlock};

    use crate::edit_action::BindFormSchema;
    let mut wb = Workbook::default();
    let bid = wb.get_available_block_id(0).unwrap();
    // Block D1:D2 = 10, 20, WITH a form schema (a real record block). Link
    // A1:A2 -> it. =SUM(A1:A2) reads the block = 30.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 0, id: bid, master_row: 0, master_col: 3,
                row_cnt: 2, col_cnt: 1, owner: None, modify_policy: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "rec".into(), sheet_idx: 0, block_id: bid,
                field_from: 0, key_idx: 0, fields: vec!["v".into()],
                render_ids: vec!["r0".into()], row: true,
                field_formulas: vec![], validation_formulas: vec![], editability_formulas: vec![],
            }),
            EditPayload::CellInput(CellInput { sheet_idx: 0, row: 0, col: 3, content: "10".into() }),
            EditPayload::CellInput(CellInput { sheet_idx: 0, row: 1, col: 3, content: "20".into() }),
            EditPayload::CellInput(CellInput { sheet_idx: 0, row: 0, col: 5, content: "=SUM(A1:A2)".into() }),
            EditPayload::CreateLink(CreateLink {
                sheet_idx: 0, master_row: 0, master_col: 0, row_cnt: 2, col_cnt: 1, block_id: bid, block_sheet_idx: None,
            }),
        ],
        undoable: false, init: false,
    }));
    let val = |wb: &Workbook| wb.get_sheet_by_idx(0).unwrap().get_value(0, 5).unwrap();
    assert!(matches!(val(&wb), Value::Number(n) if (n - 30.0).abs() < 1e-9),
        "baseline SUM = 30, got {:?}", val(&wb));

    // Append a 3rd row at the TAIL (start == row_cnt) and fill it with 7.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::InsertRowsInBlock(InsertRowsInBlock {
                sheet_idx: 0, block_id: bid, start: 2, cnt: 1,
            }),
            EditPayload::CellInput(CellInput { sheet_idx: 0, row: 2, col: 3, content: "7".into() }),
        ],
        undoable: false, init: false,
    }));
    assert!(matches!(val(&wb), Value::Number(n) if (n - 37.0).abs() < 1e-9),
        "SUM must follow the tail-appended block row (10+20+7=37), got {:?}", val(&wb));

    // LATER edit of the appended cell (separate txn) must also recompute SUM.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0, row: 2, col: 3, content: "100".into(),
        })],
        undoable: false, init: false,
    }));
    assert!(matches!(val(&wb), Value::Number(n) if (n - 130.0).abs() < 1e-9),
        "editing the appended cell later must recompute SUM (10+20+100=130), got {:?}", val(&wb));
}

// A linked region is a variable-length RECORD: it may be referenced only one
// WHOLE column at a time. References that touch the region any other way
// (multi-column / whole region / partial height / a single cell) are #VALUE!.
#[test]
fn linked_record_rejects_non_column_references() {
    use crate::controller::display::Value;
    use crate::edit_action::{CellInput, CreateLink};

    // Build A1:B6 block (col A = 10.., col B = 1,3,4,5,6,7) and literal 1..4 in
    // A/B rows 1..4 of a DIFFERENT area we'll link. `formula` is placed at G1,
    // and `formula_first` controls its order vs. CreateLink(D1:E4 -> block).
    // Layout: block at D1:E6; linked source at A1:B4 (2 cols x 4 rows).
    let build = |formula: &str, formula_first: bool| -> Workbook {
        let mut wb = Workbook::default();
        let bid = wb.get_available_block_id(0).unwrap();
        let mut payloads = vec![EditPayload::CreateBlock(CreateBlock {
            sheet_idx: 0, id: bid, master_row: 0, master_col: 3,
            row_cnt: 6, col_cnt: 2, owner: None, modify_policy: None,
        })];
        for (i, v) in [1, 3, 4, 5, 6, 7].iter().enumerate() {
            payloads.push(EditPayload::CellInput(CellInput {
                sheet_idx: 0, row: i, col: 4, content: v.to_string(),
            }));
        }
        for (i, v) in [1, 2, 3, 4].iter().enumerate() {
            payloads.push(EditPayload::CellInput(CellInput {
                sheet_idx: 0, row: i, col: 0, content: (v * 10).to_string(),
            }));
            payloads.push(EditPayload::CellInput(CellInput {
                sheet_idx: 0, row: i, col: 1, content: v.to_string(),
            }));
        }
        let f = EditPayload::CellInput(CellInput {
            sheet_idx: 0, row: 0, col: 6, content: formula.to_string(),
        });
        let link = EditPayload::CreateLink(CreateLink {
            sheet_idx: 0, master_row: 0, master_col: 0, row_cnt: 4, col_cnt: 2, block_id: bid, block_sheet_idx: None,
        });
        let payloads = if formula_first {
            payloads.push(f); payloads.push(link); payloads
        } else {
            payloads.push(link); payloads.push(f); payloads
        };
        wb.handle_action(EditAction::Payloads(PayloadsAction {
            payloads, undoable: false, init: false,
        }));
        wb
    };

    let is_value_err = |wb: &Workbook| -> bool {
        matches!(wb.get_sheet_by_idx(0).unwrap().get_value(0, 6).unwrap(),
                 Value::Error(s) if s == "#VALUE!")
    };
    let num = |wb: &Workbook| -> f64 {
        match wb.get_sheet_by_idx(0).unwrap().get_value(0, 6).unwrap() {
            Value::Number(n) => n,
            other => panic!("expected number, got {other:?}"),
        }
    };

    for first in [true, false] {
        // Valid full column B -> block col E = 26.
        assert!((num(&build("=SUM(B1:B4)", first)) - 26.0).abs() < 1e-9);
        // Whole 2-col region -> #VALUE.
        assert!(is_value_err(&build("=SUM(A1:B4)", first)), "whole region (first={first})");
        // Partial-height single column -> #VALUE.
        assert!(is_value_err(&build("=SUM(A1:A2)", first)), "partial column (first={first})");
        // A single cell inside the region -> #VALUE.
        assert!(is_value_err(&build("=A1+0", first)), "single cell (first={first})");
        // A reference entirely OUTSIDE the region is unaffected (Z1 empty => 0).
        assert!((num(&build("=SUM(Z1:Z9)", first))).abs() < 1e-9);
    }
}

#[test]
fn get_links_reports_linked_source_range_coords() {
    use crate::edit_action::{CellInput, CreateLink};

    let mut wb = Workbook::default();
    let bid = wb.get_available_block_id(0).unwrap();

    // A backing block at D1:D2, and a formula over A1:A2 linked to it.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::CellInput(CellInput { sheet_idx: 0, row: 0, col: 0, content: "1".to_string() }),
            EditPayload::CellInput(CellInput { sheet_idx: 0, row: 1, col: 0, content: "2".to_string() }),
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 0, id: bid, master_row: 0, master_col: 3,
                row_cnt: 2, col_cnt: 1, owner: None, modify_policy: None,
            }),
            EditPayload::CreateLink(CreateLink {
                sheet_idx: 0, master_row: 0, master_col: 0, row_cnt: 2, col_cnt: 1, block_id: bid, block_sheet_idx: None,
            }),
        ],
        undoable: false,
        init: false,
    }));

    let ws = wb.get_sheet_by_idx(0).unwrap();
    let links = ws.get_links();
    assert_eq!(links.len(), 1, "exactly one link, got {:?}", links);
    let l = &links[0];
    // The source range A1:A2 -> rows 0..1, col 0, pointing at the block.
    assert_eq!(l.block_id, bid);
    assert_eq!((l.start_row, l.start_col), (0, 0));
    assert_eq!((l.end_row, l.end_col), (1, 0));
    assert_eq!(l.sheet_idx, 0);
}

#[test]
fn test_check_formula() {
    let wb = Workbook::new();
    let r = wb.check_formula("=1+1".to_string());
    assert!(r);

    let r = wb.check_formula("=SUM(1)+".to_string());
    assert!(!r);
}

#[test]
fn create_block_with_owner_and_policy_roundtrip() {
    // Create a workbook with a block carrying an owner and a non-default policy,
    // save to .xlsx bytes, reload, and verify the metadata survives the round trip.
    let mut wb = Workbook::default();
    let id = wb.get_available_block_id(0).unwrap();
    let payload_action = PayloadsAction {
        payloads: vec![EditPayload::CreateBlock(CreateBlock {
            sheet_idx: 0,
            id,
            master_row: 1,
            master_col: 1,
            row_cnt: 2,
            col_cnt: 2,
            owner: Some("what-if-calculator".to_string()),
            modify_policy: Some(ModifyPolicy::OwnerAndUser),
        })],
        undoable: false,
        init: false,
    };
    let _ = wb.handle_action(EditAction::Payloads(payload_action));

    let bytes = wb.save().expect("save");
    let reloaded = Workbook::from_file(&bytes, "roundtrip.xlsx".to_string()).expect("reload");

    let info = reloaded
        .get_block_modify_info(0, id)
        .expect("block missing after reload");
    assert_eq!(info.owner, "what-if-calculator");
    assert!(matches!(info.modify_policy, ModifyPolicy::OwnerAndUser));
}

fn author(name: &str) -> AuthorInput {
    AuthorInput {
        display_name: name.to_string(),
        user_id: None,
        provider_id: None,
    }
}

fn enterprise_author(name: &str, user_id: &str) -> AuthorInput {
    AuthorInput {
        display_name: name.to_string(),
        user_id: Some(user_id.to_string()),
        provider_id: Some("AD".to_string()),
    }
}

#[test]
fn comment_thread_add_reply_mention_edit_delete() {
    let mut wb = Workbook::default();

    // Root comment authored by Alice, mentioning Bob (an enterprise user).
    let root_id = "{root-0000-0000-0000-000000000001}".to_string();
    let bob = enterprise_author("Bob", "bob@corp.com");
    let r = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::AddComment(AddComment {
            sheet_idx: 0,
            row: 2,
            col: 3,
            comment_id: root_id.clone(),
            parent_id: None,
            author: enterprise_author("Alice", "alice@corp.com"),
            dt: "2026-07-03T10:00:00Z".to_string(),
            content: "Please review @Bob".to_string(),
            mentions: vec![CommentMention {
                start: 15,
                len: 4,
                author: bob.clone(),
                mention_id: None,
            }],
        })],
        undoable: true,
        init: false,
    }));
    assert!(matches!(r.status, crate::edit_action::StatusCode::Ok(_)));

    // Reply authored by Bob.
    let reply_id = "{reply-0000-0000-0000-000000000002}".to_string();
    let _ = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::AddComment(AddComment {
            sheet_idx: 0,
            row: 2,
            col: 3,
            comment_id: reply_id.clone(),
            parent_id: Some(root_id.clone()),
            author: bob.clone(),
            dt: "2026-07-03T10:05:00Z".to_string(),
            content: "Done".to_string(),
            mentions: vec![],
        })],
        undoable: true,
        init: false,
    }));

    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let comment = ws.get_comment(2, 3).expect("comment thread missing");
        assert_eq!(comment.notes.len(), 2);
        let root = &comment.notes[0];
        assert_eq!(root.author.display_name, "Alice");
        assert_eq!(root.author.user_id.as_deref(), Some("alice@corp.com"));
        assert_eq!(root.mentions.len(), 1);
        assert_eq!(root.mentions[0].person.display_name, "Bob");
        assert!(root.parent_id.is_none());
        let reply = &comment.notes[1];
        assert_eq!(reply.author.display_name, "Bob");
        assert_eq!(reply.parent_id.as_deref(), Some(root_id.as_str()));
        // Alice + Bob mentioned/authored, so at least 2 sheet comments? Only one thread.
        assert_eq!(ws.get_comments().len(), 1);
    }

    // Edit the root note's text.
    let _ = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::EditComment(EditComment {
            sheet_idx: 0,
            comment_id: root_id.clone(),
            content: "Reviewed, thanks".to_string(),
            mentions: vec![],
        })],
        undoable: true,
        init: false,
    }));
    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let comment = ws.get_comment(2, 3).unwrap();
        assert_eq!(comment.notes[0].content, "Reviewed, thanks");
        assert_eq!(comment.notes[0].mentions.len(), 0);
    }

    // Resolve the thread.
    let _ = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::ResolveComment(ResolveComment {
            sheet_idx: 0,
            comment_id: root_id.clone(),
            resolved: true,
        })],
        undoable: true,
        init: false,
    }));
    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        assert!(ws.get_comment(2, 3).unwrap().notes[0].resolved);
    }

    // Delete the reply only — root should remain.
    let _ = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::DeleteComment(DeleteComment {
            sheet_idx: 0,
            comment_id: reply_id.clone(),
        })],
        undoable: true,
        init: false,
    }));
    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        assert_eq!(ws.get_comment(2, 3).unwrap().notes.len(), 1);
    }

    // Deleting the root removes the whole thread.
    let _ = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::DeleteComment(DeleteComment {
            sheet_idx: 0,
            comment_id: root_id.clone(),
        })],
        undoable: true,
        init: false,
    }));
    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        assert!(ws.get_comment(2, 3).is_none());
    }
}

#[test]
fn comment_roundtrip_persists_thread_and_persons() {
    let mut wb = Workbook::default();
    let root_id = "{root-0000-0000-0000-0000000000aa}".to_string();
    let reply_id = "{reply-0000-0000-0000-0000000000bb}".to_string();
    let bob = enterprise_author("Bob", "bob@corp.com");

    let _ = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::AddComment(AddComment {
                sheet_idx: 0,
                row: 5,
                col: 1,
                comment_id: root_id.clone(),
                parent_id: None,
                author: author("Guest"),
                dt: "2026-07-03T12:00:00Z".to_string(),
                content: "cc @Bob".to_string(),
                mentions: vec![CommentMention {
                    start: 3,
                    len: 4,
                    author: bob.clone(),
                    mention_id: None,
                }],
            }),
            EditPayload::AddComment(AddComment {
                sheet_idx: 0,
                row: 5,
                col: 1,
                comment_id: reply_id.clone(),
                parent_id: Some(root_id.clone()),
                author: bob.clone(),
                dt: "2026-07-03T12:01:00Z".to_string(),
                content: "ack".to_string(),
                mentions: vec![],
            }),
        ],
        undoable: false,
        init: false,
    }));

    let bytes = wb.save().expect("save");
    let reloaded = Workbook::from_file(&bytes, "comments.xlsx".to_string()).expect("reload");
    let ws = reloaded.get_sheet_by_idx(0).unwrap();
    let comment = ws.get_comment(5, 1).expect("thread lost on reload");
    assert_eq!(comment.notes.len(), 2);
    assert_eq!(comment.notes[0].content, "cc @Bob");
    assert_eq!(comment.notes[0].mentions.len(), 1);
    // The mentioned person's directory identity survived the round trip.
    assert_eq!(
        comment.notes[0].mentions[0].person.user_id.as_deref(),
        Some("bob@corp.com")
    );
    assert_eq!(
        comment.notes[1].parent_id.as_deref(),
        Some(root_id.as_str())
    );
    assert_eq!(comment.notes[1].author.display_name, "Bob");
}

#[test]
fn dependency_tracking_precedents_and_dependents() {
    use super::CellRefRange;
    use crate::edit_action::CellInput;

    // A1=1, A2=2; C1=SUM(A1:A2) (a RANGE reference), C2=A1*2 (a SINGLE-cell ref).
    let mut wb = Workbook::default();
    let cell = |row, col, content: &str| {
        EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row,
            col,
            content: content.to_string(),
        })
    };
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            cell(0, 0, "1"),
            cell(1, 0, "2"),
            cell(0, 2, "=SUM(A1:A2)"),
            cell(1, 2, "=A1*2"),
        ],
        undoable: false,
        init: false,
    }));
    let ws = wb.get_sheet_by_idx(0).unwrap();

    let is_single = |r: &CellRefRange| {
        !r.all_rows && !r.all_cols && r.start_row == r.end_row && r.start_col == r.end_col
    };

    // Dependents of A1:A2 → C1 (via the A1:A2 range) and C2 (via single A1).
    let deps = ws.get_dependents(0, 0, 1, 0).unwrap();
    let c1 = deps
        .iter()
        .find(|d| d.row == 0 && d.col == 2)
        .expect("C1 must depend on A1:A2");
    assert!(
        !is_single(&c1.via)
            && c1.via.start_row == 0
            && c1.via.end_row == 1
            && c1.via.start_col == 0
            && c1.via.end_col == 0,
        "C1's reference is the multi-cell range A1:A2, got {:?}",
        c1.via
    );
    let c2 = deps
        .iter()
        .find(|d| d.row == 1 && d.col == 2)
        .expect("C2 must depend on A1");
    assert!(is_single(&c2.via), "C2's reference is single-cell A1");

    // Dependents of A2 ALONE → C1 (its range covers A2) but NOT C2 (refs A1).
    let deps_a2 = ws.get_dependents(1, 0, 1, 0).unwrap();
    assert!(
        deps_a2.iter().any(|d| d.row == 0 && d.col == 2),
        "C1 depends on A2 via the range"
    );
    assert!(
        !deps_a2.iter().any(|d| d.row == 1 && d.col == 2),
        "C2 does NOT depend on A2"
    );

    // Precedents of C1 → the A1:A2 range.
    let prec = ws.get_precedents(0, 2).unwrap();
    assert!(
        prec.iter()
            .any(|r| r.start_row == 0 && r.end_row == 1 && r.start_col == 0 && r.end_col == 0),
        "C1's precedent is A1:A2, got {:?}",
        prec
    );
}
