use crate::edit_action::{
    AddComment, AuthorInput, CellInput, CommentMention, CreateBlock, CreateChart,
    CreateChartSeries, CreateDiyCell, DeleteCellImage, DeleteChart, DeleteComment, EditComment,
    EditPayload, LineStyleUpdate, ModifyPolicy, MoveChart, PayloadsAction, RemoveDiyCell,
    ResolveComment, SetCellImage, SheetRename, StyleUpdateType, UpdateChart, WorkbookUpdateType,
};

#[test]
fn cross_sheet_range_unparses_after_calc() {
    // Regression: a cross-sheet range argument (`Sheet2!A5:B20`) must survive
    // unparse. It used to resolve the range's cells against the formula's own
    // sheet, fail, and render as the literal "error".
    let buf = std::fs::read("../../tests/graph.xlsx").unwrap();
    let mut wb = Workbook::from_file(&buf, "graph".to_string()).unwrap();
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 0,
            col: 25,
            content: "=VLOOKUP(O8,Sheet2!A5:B20,2,FALSE)".to_string(),
        })],
        undoable: true,
        init: false,
    }));
    let ws = wb.get_sheet_by_idx(0).unwrap();
    let f = ws.get_formula(0, 25).unwrap();
    assert!(
        f.contains("Sheet2!A5:B20"),
        "cross-sheet range not preserved: {}",
        f
    );
    assert!(!f.contains("error"), "unparse produced 'error': {}", f);
}

#[test]
fn update_chart_changes_type_and_title() {
    let buf = std::fs::read("../../tests/graph.xlsx").unwrap();
    let mut wb = Workbook::from_file(&buf, "graph".to_string()).unwrap();
    let chart_id = {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let c = ws.get_charts();
        assert_eq!(c[0].chart_type, "col");
        c[0].chart_id.clone()
    };

    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::UpdateChart(UpdateChart {
            sheet_idx: 0,
            chart_id: chart_id.clone(),
            chart_type: Some("line".to_string()),
            title: Some("My Title".to_string()),
            ..Default::default()
        })],
        undoable: true,
        init: false,
    }));

    let ws = wb.get_sheet_by_idx(0).unwrap();
    let charts = ws.get_charts();
    let c = &charts[0];
    assert_eq!(c.chart_type, "line", "type changed");
    assert_eq!(c.title.as_deref(), Some("My Title"), "title set");
    // Data references are preserved through the regeneration.
    assert_eq!(c.series.len(), 3);
    assert_eq!(
        c.series[0].values,
        vec![Some(11.0), Some(13.0), Some(15.0), Some(24.0)],
        "series data preserved"
    );
}

#[test]
fn create_chart_from_scratch() {
    // Start from an empty workbook; put some numbers in B1:C2 to reference.
    let mut wb = Workbook::default();
    let inputs = [
        (0usize, 1usize, "10"),
        (0, 2, "20"),
        (1, 1, "30"),
        (1, 2, "40"),
    ];
    let payloads: Vec<EditPayload> = inputs
        .iter()
        .map(|(r, c, v)| {
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: *r,
                col: *c,
                content: v.to_string(),
            })
        })
        .collect();
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads,
        undoable: true,
        init: false,
    }));

    // Create a column chart with two series referencing those cells.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CreateChart(CreateChart {
            sheet_idx: 0,
            chart_id: "chartNew".to_string(),
            chart_type: "col".to_string(),
            from_row: 4,
            from_col: 1,
            from_col_off: 0,
            from_row_off: 0,
            to_row: 18,
            to_col: 8,
            to_col_off: 0,
            to_row_off: 0,
            title: Some("My Chart".to_string()),
            categories_ref: None,
            series: vec![
                CreateChartSeries {
                    name: Some("Row1".to_string()),
                    value_ref: "Sheet1!$B$1:$C$1".to_string(),
                    color: None,
                    size_ref: None,
                    series_type: None,
                },
                CreateChartSeries {
                    name: Some("Row2".to_string()),
                    value_ref: "Sheet1!$B$2:$C$2".to_string(),
                    color: None,
                    size_ref: None,
                    series_type: None,
                },
            ],
            block_source: None,
        })],
        undoable: true,
        init: false,
    }));

    // The new chart is visible via the display API with live values.
    let ws = wb.get_sheet_by_idx(0).unwrap();
    let charts = ws.get_charts();
    assert_eq!(charts.len(), 1, "chart created");
    let c = &charts[0];
    assert_eq!(c.chart_type, "col");
    assert_eq!(c.title.as_deref(), Some("My Chart"));
    assert_eq!(c.series.len(), 2);
    assert_eq!(c.series[0].values, vec![Some(10.0), Some(20.0)]);
    assert_eq!(c.series[1].values, vec![Some(30.0), Some(40.0)]);
    assert_eq!((c.from_row, c.from_col), (4, 1));
    drop(ws);

    // It survives save/reload.
    let bytes = wb.save().unwrap();
    let wb2 = Workbook::from_file(&bytes, "reloaded".to_string()).unwrap();
    let ws2 = wb2.get_sheet_by_idx(0).unwrap();
    let charts2 = ws2.get_charts();
    assert_eq!(charts2.len(), 1, "created chart persists");
    assert_eq!(charts2[0].series[0].values, vec![Some(10.0), Some(20.0)]);
}

#[test]
fn delete_chart_removes_it() {
    let buf = std::fs::read("../../tests/graph.xlsx").unwrap();
    let mut wb = Workbook::from_file(&buf, "graph".to_string()).unwrap();
    let chart_id = {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        ws.get_charts()
            .first()
            .expect("chart present")
            .chart_id
            .clone()
    };

    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::DeleteChart(DeleteChart {
            sheet_idx: 0,
            chart_id,
        })],
        undoable: true,
        init: false,
    }));

    let ws = wb.get_sheet_by_idx(0).unwrap();
    assert!(ws.get_charts().is_empty(), "chart should be deleted");
    drop(ws);

    // Deletion persists through save/reload.
    let bytes = wb.save().unwrap();
    let wb2 = Workbook::from_file(&bytes, "reloaded".to_string()).unwrap();
    assert!(
        wb2.get_sheet_by_idx(0).unwrap().get_charts().is_empty(),
        "deletion should persist"
    );
}

use super::{EditAction, Workbook};

#[test]
fn chart_reflects_live_data() {
    let buf = std::fs::read("../../tests/graph.xlsx").unwrap();
    let mut wb = Workbook::from_file(&buf, "graph".to_string()).unwrap();

    // series[0] references Sheet1!$B$2:$E$2 → [11, 13, 15, 24] initially.
    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let charts = ws.get_charts();
        assert_eq!(
            charts[0].series[0].values,
            vec![Some(11.0), Some(13.0), Some(15.0), Some(24.0)],
            "initial live values match the source range"
        );
    }

    // Edit B2 (row 1, col 1) → 100. The chart should reflect it (values are
    // read live from the source range, not the OOXML cache).
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 1,
            col: 1,
            content: "100".to_string(),
        })],
        undoable: true,
        init: false,
    }));

    let ws = wb.get_sheet_by_idx(0).unwrap();
    let charts = ws.get_charts();
    assert_eq!(
        charts[0].series[0].values[0],
        Some(100.0),
        "chart should reflect the edited cell"
    );
    assert_eq!(
        charts[0].series[0].values[1],
        Some(13.0),
        "others unchanged"
    );

    // Series scheme colors (accent1..3) resolve to theme RGB hex.
    let color = charts[0].series[0].color.clone();
    assert!(
        color.as_ref().is_some_and(|c| c.len() == 6 || c.len() == 8),
        "series color should resolve to a theme hex, got {:?}",
        color
    );
}

#[test]
fn move_chart_updates_anchor() {
    let buf = std::fs::read("../../tests/graph.xlsx").unwrap();
    let mut wb = Workbook::from_file(&buf, "graph".to_string()).unwrap();

    // The chart is anchored on the first sheet in graph.xlsx.
    let sheet_idx = 0usize;
    let chart_id = {
        let ws = wb.get_sheet_by_idx(sheet_idx).unwrap();
        ws.get_charts()
            .first()
            .expect("a chart should be present on sheet 0")
            .chart_id
            .clone()
    };

    // Move the chart so its top-left anchors at B3 (row 2, col 1).
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::MoveChart(MoveChart {
            sheet_idx,
            chart_id: chart_id.clone(),
            from_row: 2,
            from_col: 1,
            from_col_off: 0,
            from_row_off: 0,
            to_row: 12,
            to_col: 7,
            to_col_off: 0,
            to_row_off: 0,
        })],
        undoable: true,
        init: false,
    }));
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));

    let ws = wb.get_sheet_by_idx(sheet_idx).unwrap();
    let charts = ws.get_charts();
    let c = charts.iter().find(|c| c.chart_id == chart_id).unwrap();
    assert_eq!((c.from_row, c.from_col), (2, 1), "anchor should have moved");
    assert_eq!((c.to_row, c.to_col), (12, 7));
    drop(ws);

    // Save to xlsx and reload: the chart survives the controller round-trip
    // (Stage 3b) at its moved anchor.
    let bytes = wb.save().unwrap();
    let wb2 = Workbook::from_file(&bytes, "reloaded".to_string()).unwrap();
    let ws2 = wb2.get_sheet_by_idx(sheet_idx).unwrap();
    let charts2 = ws2.get_charts();
    assert_eq!(charts2.len(), 1, "chart should survive save/reload");
    let c2 = &charts2[0];
    assert_eq!(c2.chart_type, "col", "chart data preserved");
    assert_eq!((c2.from_row, c2.from_col), (2, 1), "moved anchor persisted");
    assert_eq!((c2.to_row, c2.to_col), (12, 7));
    assert_eq!(c2.series.len(), 3);
}

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
            permissions: None,
            description: None,
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
fn worksheet_page_setup_survives_save_load() {
    // Regression: page setup / margins / header-footer were parsed on load but
    // hardcoded to `None` on save, so open→save dropped them. They must now be
    // preserved verbatim. graph.xlsx carries <pageSetup>, <pageMargins> and
    // <headerFooter>.
    use logisheets_workbook::prelude::Wb;
    let buf = std::fs::read("../../tests/graph.xlsx").unwrap();
    let wb = Workbook::from_file(&buf, "graph".to_string()).unwrap();
    let saved = wb.save().unwrap();

    let doc = Wb::from_file(&saved).unwrap();
    assert!(
        doc.xl
            .worksheets
            .values()
            .any(|ws| ws.worksheet_part.page_setup.is_some()),
        "pageSetup should survive open→save"
    );
    assert!(
        doc.xl
            .worksheets
            .values()
            .any(|ws| ws.worksheet_part.page_margins.is_some()),
        "pageMargins should survive open→save"
    );
    assert!(
        doc.xl
            .worksheets
            .values()
            .any(|ws| ws.worksheet_part.header_footer.is_some()),
        "headerFooter should survive open→save"
    );
}

#[test]
fn worksheet_protection_survives_save_load() {
    // 6.xlsx carries <sheetProtection>; it must survive open→save (previously
    // hardcoded to `None`).
    use logisheets_workbook::prelude::Wb;
    let buf = std::fs::read("../../tests/6.xlsx").unwrap();
    let wb = Workbook::from_file(&buf, "6".to_string()).unwrap();
    let saved = wb.save().unwrap();

    let doc = Wb::from_file(&saved).unwrap();
    assert!(
        doc.xl
            .worksheets
            .values()
            .any(|ws| ws.worksheet_part.sheet_protection.is_some()),
        "sheetProtection should survive open→save"
    );
}

#[test]
fn remove_diy_cell_round_trips_without_panicking() {
    // Regression: RemoveDiyCell / RemoveDiyCellById had a `todo!()` in the diff
    // computation (engine panic) and no arm in the exclusive executor (silent
    // no-op). This exercises the create → remove round-trip: it must return Ok
    // (no panic) and actually clear the DIY-cell registration.
    let mut wb = Workbook::default();
    let id = wb.get_available_block_id(0).unwrap();
    // A 3x3 block anchored at (1,1) so (1,1) is a BlockCell (DIY cells require
    // a block cell).
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CreateBlock(CreateBlock {
            sheet_idx: 0,
            id,
            master_row: 1,
            master_col: 1,
            row_cnt: 3,
            col_cnt: 3,
            owner: None,
            modify_policy: None,
            permissions: None,
            description: None,
        })],
        undoable: false,
        init: false,
    }));

    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CreateDiyCell(CreateDiyCell {
            sheet_idx: 0,
            row: 1,
            col: 1,
        })],
        undoable: true,
        init: false,
    }));
    let ws = wb.get_sheet_by_idx(0).unwrap();
    assert!(
        ws.get_diy_cell_id(1, 1).is_ok(),
        "DIY cell should exist after CreateDiyCell"
    );

    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::RemoveDiyCell(RemoveDiyCell {
            sheet_idx: 0,
            row: 1,
            col: 1,
        })],
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "RemoveDiyCell should succeed, got {:?}",
        effect.status
    );

    let ws = wb.get_sheet_by_idx(0).unwrap();
    assert!(
        ws.get_diy_cell_id(1, 1).is_err(),
        "DIY cell should be gone after RemoveDiyCell"
    );
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

// An OOXML `<table>` in a loaded .xlsx becomes a form block: the header row
// supplies the field names (and stays as normal cells), the data rows become
// the block's records (values preserved), the schema ref is `unspecified-*`,
// and re-saving never writes the table back out.
#[test]
fn table_converts_to_block_on_load() {
    use crate::controller::display::Value;
    use crate::edit_action::CellInput;
    use logisheets_workbook::prelude::{CtTableColumn, CtTableColumns, Table, Wb, write};
    use logisheets_workbook::workbook::TablePart;

    // Build a CT_TableColumn with just a name; everything else defaulted/empty.
    fn make_col(id: u32, name: &str) -> CtTableColumn {
        CtTableColumn {
            calculated_column_formula: None,
            totals_row_formula: None,
            xml_column_pr: None,
            ext_lst: None,
            id,
            unique_name: None,
            name: name.to_string(),
            totals_row_function: None,
            totals_row_label: None,
            query_table_field_id: None,
            header_row_dxf_id: None,
            data_dxf_id: None,
            totals_row_dxf_id: None,
            header_row_cell_style: None,
            data_cell_style: None,
            totals_row_cell_style: None,
        }
    }
    fn make_table(reference: &str, cols: &[&str]) -> Table {
        Table {
            auto_filter: None,
            sort_state: None,
            table_columns: CtTableColumns {
                table_column: cols
                    .iter()
                    .enumerate()
                    .map(|(i, n)| make_col(i as u32 + 1, n))
                    .collect(),
                count: cols.len() as u32,
            },
            table_style_info: None,
            ext_lst: None,
            id: 1,
            name: None,
            display_name: "Table1".to_string(),
            comment: None,
            reference: reference.to_string(),
            table_type: None,
            header_row_count: 1,
            insert_row: false,
            insert_row_shift: false,
            totals_row_count: 0,
            totals_row_shown: true,
            published: false,
            header_row_dxf_id: None,
            data_dxf_id: None,
            totals_row_dxf_id: None,
            header_row_border_dxf_id: None,
            table_border_dxf_id: None,
            totals_row_border_dxf_id: None,
            header_row_cell_style: None,
            data_cell_style: None,
            totals_row_cell_style: None,
            connection_id: None,
        }
    }

    // 1. Author a 4x3 grid: header row (Region/Q1/Q2) + 3 data rows.
    let grid = [
        ["Region", "Q1", "Q2"],
        ["East", "10", "20"],
        ["West", "30", "40"],
        ["North", "50", "60"],
    ];
    let mut authored = Workbook::default();
    let mut payloads = vec![];
    for (r, row) in grid.iter().enumerate() {
        for (c, val) in row.iter().enumerate() {
            payloads.push(EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: r,
                col: c,
                content: val.to_string(),
            }));
        }
    }
    authored.handle_action(EditAction::Payloads(PayloadsAction {
        payloads,
        undoable: false,
        init: false,
    }));
    let base = authored.save().unwrap();

    // 2. Inject a <table> over A1:C4 (header row 1). The writer emits the table
    //    part + its worksheet relationship; the reader re-discovers it via rels.
    let mut raw = Wb::from_file(&base).unwrap();
    let ws = raw.xl.worksheets.values_mut().next().unwrap();
    ws.tables.push(TablePart {
        rel_id: "rId777".to_string(),
        table: make_table("A1:C4", &["Region", "Q1", "Q2"]),
    });
    let input = write(raw).unwrap();

    // 3. Load — the table is converted into a block.
    let wb = Workbook::from_file(&input, "tbl".to_string()).unwrap();

    // Exactly one block, covering the DATA rows only (A2:C4), header excluded.
    let ws0 = wb.get_sheet_by_idx(0).unwrap();
    let blocks = ws0.get_all_blocks();
    assert_eq!(blocks.len(), 1, "the table should have become one block");
    let b = &blocks[0];
    assert_eq!(
        (b.row_start, b.col_start),
        (1, 0),
        "block starts below header"
    );
    assert_eq!(
        (b.row_cnt, b.col_cnt),
        (3, 3),
        "block covers the 3 data rows"
    );

    // The ref name is the TABLE's own name, and its fields are the header
    // names. A ref name is how a formula addresses the block, so the name the
    // user already gave the table is the useful one; `unspecified-<id>` is the
    // fallback for a table whose `displayName` is empty or already taken.
    let schema = b.schema.as_ref().expect("converted block has a schema");
    assert_eq!(
        schema.name, "Table1",
        "the block should adopt the table's own displayName"
    );
    let field_names: Vec<&str> = schema.fields.iter().map(|f| f.field.as_str()).collect();
    assert_eq!(field_names, vec!["Region", "Q1", "Q2"]);

    // Header cells stay as normal cells; data values are preserved (now in the block).
    assert!(matches!(ws0.get_value(0, 0).unwrap(), Value::Str(s) if s == "Region"));
    assert!(matches!(ws0.get_value(1, 0).unwrap(), Value::Str(s) if s == "East"));
    assert!(matches!(ws0.get_value(3, 2).unwrap(), Value::Number(n) if (n - 60.0).abs() < 1e-9));

    // 4. Re-save: the block goes back out AS A TABLE. That is the point of the
    // conversion being two-way — a block is the engine's idea, and a table is
    // how every other program recognizes the same region, so a file that came in
    // with a table leaves with one and Excel still sees what it wrote.
    let resaved = wb.save().unwrap();
    let raw2 = Wb::from_file(&resaved).unwrap();
    let tables: Vec<_> = raw2
        .xl
        .worksheets
        .values()
        .flat_map(|w| w.tables.iter())
        .collect();
    assert_eq!(
        tables.len(),
        1,
        "the block should be written back out as one table"
    );

    // Reload the re-saved file: the table becomes the block again, under the
    // same name, so the round trip is a fixed point rather than a drift.
    let wb2 = Workbook::from_file(&resaved, "tbl2".to_string()).unwrap();
    let ws2 = wb2.get_sheet_by_idx(0).unwrap();
    let blocks2 = ws2.get_all_blocks();
    assert_eq!(blocks2.len(), 1, "block survives save/reload");
    assert_eq!(
        blocks2[0].schema.as_ref().expect("still has a schema").name,
        schema.name,
        "the ref name should not change across a save"
    );
    assert!(matches!(ws2.get_value(1, 0).unwrap(), Value::Str(s) if s == "East"));
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
                permissions: None,
                description: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "rec".into(),
                sheet_idx: 0,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec!["v".into()],
                render_ids: vec!["r0".into()],
                row: true,
                field_formulas: vec![],
                validation_formulas: vec![],
                editability_formulas: vec![],
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

// Clearing a per-field validation / editability rule (Some -> None) must cancel
// the previous rule's effect: the shadow cell's stale computed value has to be
// purged, otherwise readers that key off shadow-id existence keep surfacing the
// old warning / lock even though no rule is in force any more.
#[test]
fn clearing_field_rule_purges_stale_shadow_value() {
    use crate::controller::display::Value;
    use crate::edit_action::{BindFormSchema, CellInput, UpsertFieldFormulas};
    use crate::sid_assigner::ShadowKind;
    use logisheets_base::CellId;

    let mut wb = Workbook::default();
    let bid = wb.get_available_block_id(0).unwrap();

    // 2x1 block at D1 (row 0, col 3). Bind a schema whose single field carries
    // both a validation and an editability rule that FAIL for the seeded value
    // (`#PLACEHOLDER > 100` on 10 / 20 -> false), then seed the cells.
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
                permissions: None,
                description: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "rec".into(),
                sheet_idx: 0,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec!["v".into()],
                render_ids: vec!["r0".into()],
                row: true,
                field_formulas: vec![],
                validation_formulas: vec![Some("#PLACEHOLDER>100".into())],
                editability_formulas: vec![Some("#PLACEHOLDER>100".into())],
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

    // Read the shadow value for the block cell at (row, col=3) & kind.
    let read = |wb: &mut Workbook, row: usize, kind: ShadowKind| -> Value {
        let scid = wb.get_shadow_cell_id(0, row, 3, kind).unwrap();
        let id = match scid.cell_id {
            CellId::EphemeralCell(i) => i,
            _ => panic!("expected an ephemeral shadow cell"),
        };
        wb.get_shadow_info_by_id(id).unwrap().value
    };

    // Sanity: the rules are in force and failing.
    assert!(
        matches!(read(&mut wb, 0, ShadowKind::Validation), Value::Bool(false)),
        "validation should fail (10 > 100 is false) while the rule is set"
    );
    assert!(
        matches!(
            read(&mut wb, 0, ShadowKind::UserEditable),
            Value::Bool(false)
        ),
        "editability should be false while the rule is set"
    );

    // Clear BOTH rules (send `vec![None]` = explicitly clear the field's rule;
    // `field_formulas: vec![]` leaves value templates untouched).
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::UpsertFieldFormulas(UpsertFieldFormulas {
            sheet_idx: 0,
            block_id: bid,
            field_formulas: vec![],
            validation_formulas: vec![None],
            editability_formulas: vec![None],
        })],
        undoable: false,
        init: false,
    }));

    // The stale shadow values must be gone (empty == no warning / editable),
    // for every row the rule covered.
    for row in [0usize, 1usize] {
        assert!(
            matches!(read(&mut wb, row, ShadowKind::Validation), Value::Empty),
            "validation shadow at row {row} should be empty after the rule is cleared, got {:?}",
            read(&mut wb, row, ShadowKind::Validation)
        );
        assert!(
            matches!(read(&mut wb, row, ShadowKind::UserEditable), Value::Empty),
            "editability shadow at row {row} should be empty after the rule is cleared, got {:?}",
            read(&mut wb, row, ShadowKind::UserEditable)
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
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 0,
                content: "1".to_string(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 1,
                col: 0,
                content: "2".to_string(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 4,
                content: "=SUM(A1:A2)".to_string(),
            }),
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 0,
                id: bid,
                master_row: 0,
                master_col: 3,
                row_cnt: 2,
                col_cnt: 1,
                owner: None,
                modify_policy: None,
                permissions: None,
                description: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "rec".into(),
                sheet_idx: 0,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec!["v".into()],
                render_ids: vec!["r0".into()],
                row: true,
                field_formulas: vec![],
                validation_formulas: vec![],
                editability_formulas: vec![],
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
                sheet_idx: 0,
                block_id: bid,
                start: 1,
                cnt: 1,
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 1,
                col: 3,
                content: "5".to_string(),
            }),
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
        let mut payloads = vec![EditPayload::CreateBlock(CreateBlock {
            sheet_idx: 0,
            id: bid,
            master_row: 0,
            master_col: 3,
            row_cnt: 6,
            col_cnt: 1,
            owner: None,
            modify_policy: None,
            permissions: None,
            description: None,
        })];
        for (i, v) in [1, 3, 4, 5, 6, 7].iter().enumerate() {
            payloads.push(EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: i,
                col: 3,
                content: v.to_string(),
            }));
        }
        for (i, v) in [1, 2, 3, 4].iter().enumerate() {
            payloads.push(EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: i,
                col: 0,
                content: v.to_string(),
            }));
        }
        let formula = EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 0,
            col: 6,
            content: "=SUM(A1:A4)".to_string(),
        });
        let link = EditPayload::CreateLink(CreateLink {
            sheet_idx: 0,
            master_row: 0,
            master_col: 0,
            row_cnt: 4,
            col_cnt: 1,
            block_id: bid,
            block_sheet_idx: None,
        });
        if formula_first {
            payloads.push(formula);
            payloads.push(link);
        } else {
            payloads.push(link);
            payloads.push(formula);
        }
        wb.handle_action(EditAction::Payloads(PayloadsAction {
            payloads,
            undoable: false,
            init: false,
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
        sheet_idx: 0,
        id: bid,
        master_row: 0,
        master_col: 3,
        row_cnt: 6,
        col_cnt: 2,
        owner: None,
        modify_policy: None,
        permissions: None,
        description: None,
    })];
    for (i, v) in [10, 20, 30, 40, 50, 60].iter().enumerate() {
        payloads.push(EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: i,
            col: 3,
            content: v.to_string(),
        }));
    }
    for (i, v) in [1, 3, 4, 5, 6, 7].iter().enumerate() {
        payloads.push(EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: i,
            col: 4,
            content: v.to_string(),
        }));
    }
    // Literal 1,2,3,4 in A1:B4 (source), then link A1:B4 (2 cols) -> block.
    for (i, v) in [1, 2, 3, 4].iter().enumerate() {
        payloads.push(EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: i,
            col: 0,
            content: (v * 100).to_string(),
        }));
        payloads.push(EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: i,
            col: 1,
            content: v.to_string(),
        }));
    }
    // =SUM(B1:B4): only the 2nd column of the linked A1:B4 range.
    payloads.push(EditPayload::CellInput(CellInput {
        sheet_idx: 0,
        row: 0,
        col: 6,
        content: "=SUM(B1:B4)".to_string(),
    }));
    payloads.push(EditPayload::CreateLink(CreateLink {
        sheet_idx: 0,
        master_row: 0,
        master_col: 0,
        row_cnt: 4,
        col_cnt: 2,
        block_id: bid,
        block_sheet_idx: None,
    }));
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads,
        undoable: false,
        init: false,
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
                sheet_idx: 1,
                id: bid,
                master_row: 0,
                master_col: 3,
                row_cnt: 2,
                col_cnt: 1,
                owner: None,
                modify_policy: None,
                permissions: None,
                description: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "rec".into(),
                sheet_idx: 1,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec!["v".into()],
                render_ids: vec!["r0".into()],
                row: true,
                field_formulas: vec![],
                validation_formulas: vec![],
                editability_formulas: vec![],
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 1,
                row: 0,
                col: 3,
                content: "10".into(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 1,
                row: 1,
                col: 3,
                content: "20".into(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 6,
                content: "=SUM(A1:A2)".into(),
            }),
            EditPayload::CreateLink(CreateLink {
                sheet_idx: 0,
                master_row: 0,
                master_col: 0,
                row_cnt: 2,
                col_cnt: 1,
                block_id: bid,
                block_sheet_idx: Some(1),
            }),
        ],
        undoable: false,
        init: false,
    }));
    let val = |wb: &Workbook| wb.get_sheet_by_idx(0).unwrap().get_value(0, 6).unwrap();
    assert!(
        matches!(val(&wb), Value::Number(n) if (n - 30.0).abs() < 1e-9),
        "cross-sheet SUM reads the block on sheet 1 (30), got {:?}",
        val(&wb)
    );
    // The facade A1 on sheet 0 stays empty (non-destructive).
    assert!(matches!(
        wb.get_sheet_by_idx(0).unwrap().get_value(0, 0).unwrap(),
        Value::Empty
    ));

    // Append a row on sheet 1 + fill → the sheet-0 SUM tracks.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::InsertRowsInBlock(InsertRowsInBlock {
                sheet_idx: 1,
                block_id: bid,
                start: 2,
                cnt: 1,
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 1,
                row: 2,
                col: 3,
                content: "7".into(),
            }),
        ],
        undoable: false,
        init: false,
    }));
    assert!(
        matches!(val(&wb), Value::Number(n) if (n - 37.0).abs() < 1e-9),
        "cross-sheet SUM tracks the appended block row (37), got {:?}",
        val(&wb)
    );
    // A later edit of the appended cell (separate txn) recomputes across sheets.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput {
            sheet_idx: 1,
            row: 2,
            col: 3,
            content: "100".into(),
        })],
        undoable: false,
        init: false,
    }));
    assert!(
        matches!(val(&wb), Value::Number(n) if (n - 130.0).abs() < 1e-9),
        "cross-sheet later edit recomputes (130), got {:?}",
        val(&wb)
    );

    // Save/load keeps the cross-sheet link (formula stays native on sheet 0).
    let bytes = wb.save().expect("save");
    let wb2 = Workbook::from_file(&bytes, "reloaded".into()).expect("load");
    let ws0 = wb2.get_sheet_by_idx(0).unwrap();
    assert_eq!(
        ws0.get_links().len(),
        1,
        "cross-sheet link restored on load"
    );
    assert_eq!(ws0.get_formula(0, 6).unwrap(), "SUM(A1:A2)");
    assert!(
        matches!(ws0.get_value(0, 6).unwrap(), Value::Number(n) if (n - 130.0).abs() < 1e-9),
        "cross-sheet value survives save/load (130)"
    );
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
                sheet_idx: 0,
                id: bid,
                master_row: 0,
                master_col: 3,
                row_cnt: 2,
                col_cnt: 1,
                owner: None,
                modify_policy: None,
                permissions: None,
                description: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "rec".into(),
                sheet_idx: 0,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec!["v".into()],
                render_ids: vec!["r0".into()],
                row: true,
                field_formulas: vec![],
                validation_formulas: vec![],
                editability_formulas: vec![],
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 3,
                content: "10".into(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 1,
                col: 3,
                content: "20".into(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 5,
                content: "=SUM(A1:A2)".into(),
            }),
            EditPayload::CreateLink(CreateLink {
                sheet_idx: 0,
                master_row: 0,
                master_col: 0,
                row_cnt: 2,
                col_cnt: 1,
                block_id: bid,
                block_sheet_idx: None,
            }),
        ],
        undoable: false,
        init: false,
    }));
    assert!(
        matches!(wb.get_sheet_by_idx(0).unwrap().get_value(0, 5).unwrap(),
        Value::Number(n) if (n - 30.0).abs() < 1e-9)
    );

    let bytes = wb.save().expect("save");
    let mut wb2 = Workbook::from_file(&bytes, "reloaded".into()).expect("load");
    let ws2 = wb2.get_sheet_by_idx(0).unwrap();
    // The link persisted...
    assert_eq!(
        ws2.get_links().len(),
        1,
        "the link should be restored on load"
    );
    // ...the formula kept its facade reference (NOT baked to the block coords)...
    assert_eq!(ws2.get_formula(0, 5).unwrap(), "SUM(A1:A2)");
    // ...it still reads the block, and the facade A1:A2 stays empty.
    assert!(matches!(ws2.get_value(0, 5).unwrap(), Value::Number(n) if (n - 30.0).abs() < 1e-9));
    assert!(matches!(ws2.get_value(0, 0).unwrap(), Value::Empty));

    // Growth still works after load.
    wb2.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::InsertRowsInBlock(InsertRowsInBlock {
                sheet_idx: 0,
                block_id: bid,
                start: 2,
                cnt: 1,
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 2,
                col: 3,
                content: "7".into(),
            }),
        ],
        undoable: false,
        init: false,
    }));
    assert!(
        matches!(wb2.get_sheet_by_idx(0).unwrap().get_value(0, 5).unwrap(),
        Value::Number(n) if (n - 37.0).abs() < 1e-9)
    );
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
                sheet_idx: 0,
                id: bid,
                master_row: 0,
                master_col: 3,
                row_cnt: 2,
                col_cnt: 1,
                owner: None,
                modify_policy: None,
                permissions: None,
                description: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "rec".into(),
                sheet_idx: 0,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec!["v".into()],
                render_ids: vec!["r0".into()],
                row: true,
                field_formulas: vec![],
                validation_formulas: vec![],
                editability_formulas: vec![],
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 3,
                content: "10".into(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 1,
                col: 3,
                content: "20".into(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 5,
                content: "=SUM(A1:A2)".into(),
            }),
            EditPayload::CreateLink(CreateLink {
                sheet_idx: 0,
                master_row: 0,
                master_col: 0,
                row_cnt: 2,
                col_cnt: 1,
                block_id: bid,
                block_sheet_idx: None,
            }),
        ],
        undoable: false,
        init: false,
    }));
    let val = |wb: &Workbook| wb.get_sheet_by_idx(0).unwrap().get_value(0, 5).unwrap();
    assert!(
        matches!(val(&wb), Value::Number(n) if (n - 30.0).abs() < 1e-9),
        "baseline SUM = 30, got {:?}",
        val(&wb)
    );

    // Append a 3rd row at the TAIL (start == row_cnt) and fill it with 7.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::InsertRowsInBlock(InsertRowsInBlock {
                sheet_idx: 0,
                block_id: bid,
                start: 2,
                cnt: 1,
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 2,
                col: 3,
                content: "7".into(),
            }),
        ],
        undoable: false,
        init: false,
    }));
    assert!(
        matches!(val(&wb), Value::Number(n) if (n - 37.0).abs() < 1e-9),
        "SUM must follow the tail-appended block row (10+20+7=37), got {:?}",
        val(&wb)
    );

    // LATER edit of the appended cell (separate txn) must also recompute SUM.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 2,
            col: 3,
            content: "100".into(),
        })],
        undoable: false,
        init: false,
    }));
    assert!(
        matches!(val(&wb), Value::Number(n) if (n - 130.0).abs() < 1e-9),
        "editing the appended cell later must recompute SUM (10+20+100=130), got {:?}",
        val(&wb)
    );
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
            sheet_idx: 0,
            id: bid,
            master_row: 0,
            master_col: 3,
            row_cnt: 6,
            col_cnt: 2,
            owner: None,
            modify_policy: None,
            permissions: None,
            description: None,
        })];
        for (i, v) in [1, 3, 4, 5, 6, 7].iter().enumerate() {
            payloads.push(EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: i,
                col: 4,
                content: v.to_string(),
            }));
        }
        for (i, v) in [1, 2, 3, 4].iter().enumerate() {
            payloads.push(EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: i,
                col: 0,
                content: (v * 10).to_string(),
            }));
            payloads.push(EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: i,
                col: 1,
                content: v.to_string(),
            }));
        }
        let f = EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 0,
            col: 6,
            content: formula.to_string(),
        });
        let link = EditPayload::CreateLink(CreateLink {
            sheet_idx: 0,
            master_row: 0,
            master_col: 0,
            row_cnt: 4,
            col_cnt: 2,
            block_id: bid,
            block_sheet_idx: None,
        });
        let payloads = if formula_first {
            payloads.push(f);
            payloads.push(link);
            payloads
        } else {
            payloads.push(link);
            payloads.push(f);
            payloads
        };
        wb.handle_action(EditAction::Payloads(PayloadsAction {
            payloads,
            undoable: false,
            init: false,
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
        assert!(
            is_value_err(&build("=SUM(A1:B4)", first)),
            "whole region (first={first})"
        );
        // Partial-height single column -> #VALUE.
        assert!(
            is_value_err(&build("=SUM(A1:A2)", first)),
            "partial column (first={first})"
        );
        // A single cell inside the region -> #VALUE.
        assert!(
            is_value_err(&build("=A1+0", first)),
            "single cell (first={first})"
        );
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
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 0,
                content: "1".to_string(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 1,
                col: 0,
                content: "2".to_string(),
            }),
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 0,
                id: bid,
                master_row: 0,
                master_col: 3,
                row_cnt: 2,
                col_cnt: 1,
                owner: None,
                modify_policy: None,
                permissions: None,
                description: None,
            }),
            EditPayload::CreateLink(CreateLink {
                sheet_idx: 0,
                master_row: 0,
                master_col: 0,
                row_cnt: 2,
                col_cnt: 1,
                block_id: bid,
                block_sheet_idx: None,
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
            permissions: None,
            description: None,
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

// End-to-end sort-a-block-by-field, through the real engine: build a row-schema
// block with typed values, compute the order via the public `get_block_sort_order`
// API, apply it as a `ReorderBlockLines` transaction, then read the cells back to
// confirm the records land in sorted order. Also covers the error branches
// (unknown field, random-schema block). The sort_block unit tests already cover
// the pure comparator; this exercises field resolution, typed value reads, and
// the reorder semantics against a live controller.
#[test]
fn sort_block_by_field_end_to_end() {
    use crate::api::BlockSortOrder;
    use crate::controller::display::Value;
    use crate::edit_action::{
        BindFormSchema, BindRandomSchema, CellInput, RandomSchemaUnit, ReorderBlockLines,
    };

    // A fresh workbook with a 4-record × 2-field row-schema block at A1.
    // Fields: "name" (col 0, text), "age" (col 1, number). Records are
    // deliberately out of order on BOTH fields.
    fn build() -> (Workbook, usize) {
        let mut wb = Workbook::default();
        let bid = wb.get_available_block_id(0).unwrap();
        let records = [
            ("Charlie", "30"),
            ("Alice", "10"),
            ("Bob", "20"),
            ("Dave", "5"),
        ];
        let mut payloads = vec![
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 0,
                id: bid,
                master_row: 0,
                master_col: 0,
                row_cnt: records.len(),
                col_cnt: 2,
                owner: None,
                modify_policy: None,
                permissions: None,
                description: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "people".into(),
                sheet_idx: 0,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec!["name".into(), "age".into()],
                render_ids: vec!["r_name".into(), "r_age".into()],
                row: true,
                field_formulas: vec![],
                validation_formulas: vec![],
                editability_formulas: vec![],
            }),
        ];
        for (r, (name, age)) in records.iter().enumerate() {
            payloads.push(EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: r,
                col: 0,
                content: name.to_string(),
            }));
            payloads.push(EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: r,
                col: 1,
                content: age.to_string(),
            }));
        }
        // Seed as the init baseline so an undo of a later (undoable) sort
        // returns to the populated block rather than the empty workbook.
        wb.handle_action(EditAction::Payloads(PayloadsAction {
            payloads,
            undoable: false,
            init: true,
        }));
        (wb, bid)
    }

    // Read the 4 records top-to-bottom: names (col 0, text) and ages (col 1, number).
    fn names(wb: &Workbook) -> Vec<String> {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        (0..4)
            .map(|r| match ws.get_value(r, 0).unwrap() {
                Value::Str(s) => s,
                other => panic!("name at row {r} not text: {other:?}"),
            })
            .collect()
    }
    fn ages(wb: &Workbook) -> Vec<f64> {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        (0..4)
            .map(|r| match ws.get_value(r, 1).unwrap() {
                Value::Number(n) => n,
                other => panic!("age at row {r} not a number: {other:?}"),
            })
            .collect()
    }
    fn apply(wb: &mut Workbook, bid: usize, order: BlockSortOrder) {
        wb.handle_action(EditAction::Payloads(PayloadsAction {
            payloads: vec![EditPayload::ReorderBlockLines(ReorderBlockLines {
                sheet_idx: 0,
                block_id: bid,
                is_row: order.is_row,
                new_order: order.new_order,
            })],
            undoable: false,
            init: false,
        }));
    }

    // Ascending by the numeric "age" field: 30,10,20,5 → indices [3,1,2,0].
    // The reorder must move whole records, so names follow their ages.
    {
        let (mut wb, bid) = build();
        let order = wb.get_block_sort_order(0, bid, "age", true).unwrap();
        assert!(order.is_row, "row-schema block sorts by reordering rows");
        assert_eq!(order.new_order, vec![3, 1, 2, 0]);
        apply(&mut wb, bid, order);
        assert_eq!(ages(&wb), vec![5.0, 10.0, 20.0, 30.0]);
        assert_eq!(names(&wb), vec!["Dave", "Alice", "Bob", "Charlie"]);
    }

    // Descending by "age": 30,20,10,5 → indices [0,2,1,3].
    {
        let (mut wb, bid) = build();
        let order = wb.get_block_sort_order(0, bid, "age", false).unwrap();
        assert_eq!(order.new_order, vec![0, 2, 1, 3]);
        apply(&mut wb, bid, order);
        assert_eq!(ages(&wb), vec![30.0, 20.0, 10.0, 5.0]);
        assert_eq!(names(&wb), vec!["Charlie", "Bob", "Alice", "Dave"]);
    }

    // Ascending by the text "name" field: Alice,Bob,Charlie,Dave → indices [1,2,0,3].
    {
        let (mut wb, bid) = build();
        let order = wb.get_block_sort_order(0, bid, "name", true).unwrap();
        assert_eq!(order.new_order, vec![1, 2, 0, 3]);
        apply(&mut wb, bid, order);
        assert_eq!(names(&wb), vec!["Alice", "Bob", "Charlie", "Dave"]);
        assert_eq!(ages(&wb), vec![10.0, 20.0, 30.0, 5.0]);
    }

    // Unknown field → error (never silently a no-op).
    {
        let (wb, bid) = build();
        assert!(
            wb.get_block_sort_order(0, bid, "nope", true).is_err(),
            "unknown field name must error"
        );
    }

    // A random-schema block has no field axis → sorting is rejected.
    {
        let mut wb = Workbook::default();
        let bid = wb.get_available_block_id(0).unwrap();
        wb.handle_action(EditAction::Payloads(PayloadsAction {
            payloads: vec![
                EditPayload::CreateBlock(CreateBlock {
                    sheet_idx: 0,
                    id: bid,
                    master_row: 0,
                    master_col: 0,
                    row_cnt: 2,
                    col_cnt: 1,
                    owner: None,
                    modify_policy: None,
                    permissions: None,
                    description: None,
                }),
                EditPayload::BindRandomSchema(BindRandomSchema {
                    ref_name: "rnd".into(),
                    sheet_idx: 0,
                    block_id: bid,
                    units: vec![RandomSchemaUnit {
                        key: "k0".into(),
                        render_id: "r0".into(),
                        row: 0,
                        col: 0,
                    }],
                }),
            ],
            undoable: false,
            init: false,
        }));
        assert!(
            wb.get_block_sort_order(0, bid, "k0", true).is_err(),
            "random-schema blocks have no sortable fields"
        );
    }

    // Undo/redo: the sort's mutation is a `ReorderBlockLines` payload dispatched
    // as an UNDOABLE transaction (exactly what the frontend `sortBlock` op does),
    // so it lands on the undo stack. Ctrl-Z restores the original record order;
    // redo re-applies the sort. This is the property that would break if sorting
    // bypassed the payload pipeline.
    {
        let (mut wb, bid) = build();
        let order = wb.get_block_sort_order(0, bid, "age", true).unwrap();
        wb.handle_action(EditAction::Payloads(PayloadsAction {
            payloads: vec![EditPayload::ReorderBlockLines(ReorderBlockLines {
                sheet_idx: 0,
                block_id: bid,
                is_row: order.is_row,
                new_order: order.new_order,
            })],
            undoable: true,
            init: false,
        }));
        assert_eq!(ages(&wb), vec![5.0, 10.0, 20.0, 30.0], "sorted after apply");

        wb.handle_action(EditAction::Undo);
        assert_eq!(
            ages(&wb),
            vec![30.0, 10.0, 20.0, 5.0],
            "undo restores the original record order"
        );

        wb.handle_action(EditAction::Redo);
        assert_eq!(
            ages(&wb),
            vec![5.0, 10.0, 20.0, 30.0],
            "redo re-applies the sort"
        );
    }
}

// Reproduces the browser app's exact flow: create a 1-record block with a single
// field, GROW it with InsertRowsInBlock (the "add row" button), then type the
// field values in — instead of seeding every record at creation time. Guards
// against the sort reading blank values (identity order) when records arrive via
// interior inserts.
#[test]
fn sort_block_grown_by_insert_rows() {
    use crate::controller::display::Value;
    use crate::edit_action::{BindFormSchema, CellInput, InsertRowsInBlock, ReorderBlockLines};

    let mut wb = Workbook::default();
    let bid = wb.get_available_block_id(0).unwrap();

    // One-record block at A1 with a single string field, then grow to 3 records.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 0,
                id: bid,
                master_row: 0,
                master_col: 0,
                row_cnt: 1,
                col_cnt: 1,
                owner: None,
                modify_policy: None,
                permissions: None,
                description: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "people".into(),
                sheet_idx: 0,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec!["Customer Status".into()],
                render_ids: vec!["r0".into()],
                row: true,
                field_formulas: vec![],
                validation_formulas: vec![],
                editability_formulas: vec![],
            }),
            // Add two rows (interior insert at index 1), like clicking "add row".
            EditPayload::InsertRowsInBlock(InsertRowsInBlock {
                sheet_idx: 0,
                block_id: bid,
                start: 1,
                cnt: 2,
            }),
            // Type the three records' values (rows 0..=2, col 0).
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 0,
                content: "Charlie".into(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 1,
                col: 0,
                content: "Alice".into(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 2,
                col: 0,
                content: "Bob".into(),
            }),
        ],
        undoable: false,
        init: false,
    }));

    let names = |wb: &Workbook| -> Vec<String> {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        (0..3)
            .map(|r| match ws.get_value(r, 0).unwrap() {
                Value::Str(s) => s,
                Value::Empty => String::new(),
                other => panic!("row {r} not text: {other:?}"),
            })
            .collect()
    };
    assert_eq!(
        names(&wb),
        vec!["Charlie", "Alice", "Bob"],
        "records populated as typed"
    );

    let order = wb
        .get_block_sort_order(0, bid, "Customer Status", true)
        .unwrap();
    assert_eq!(
        order.new_order,
        vec![1, 2, 0],
        "ascending order must reflect the typed values, not blanks (identity)"
    );

    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::ReorderBlockLines(ReorderBlockLines {
            sheet_idx: 0,
            block_id: bid,
            is_row: order.is_row,
            new_order: order.new_order,
        })],
        undoable: false,
        init: false,
    }));
    assert_eq!(names(&wb), vec!["Alice", "Bob", "Charlie"]);
}

// A formula that references a block cell must keep referencing THAT cell across a
// sort: LogiSheets tracks references by stable cell-id, not by position. So after
// the sort moves the referenced cell to a new coordinate, the formula (a) still
// evaluates to that cell's value, and (b) unparses to the cell's NEW coordinate.
#[test]
fn sort_block_reference_follows_moved_cell() {
    use crate::controller::display::Value;
    use crate::edit_action::{BindFormSchema, CellInput, ReorderBlockLines};

    let mut wb = Workbook::default();
    let bid = wb.get_available_block_id(0).unwrap();

    let cell = |row, col, content: &str| {
        EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row,
            col,
            content: content.to_string(),
        })
    };

    // 4-record block at A1: field "name" (col A), "age" (col B). Charlie's age
    // (30) sits at B1. A formula in D1 references B1.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 0,
                id: bid,
                master_row: 0,
                master_col: 0,
                row_cnt: 4,
                col_cnt: 2,
                owner: None,
                modify_policy: None,
                permissions: None,
                description: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "people".into(),
                sheet_idx: 0,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec!["name".into(), "age".into()],
                render_ids: vec!["r_name".into(), "r_age".into()],
                row: true,
                field_formulas: vec![],
                validation_formulas: vec![],
                editability_formulas: vec![],
            }),
            cell(0, 0, "Charlie"),
            cell(0, 1, "30"),
            cell(1, 0, "Alice"),
            cell(1, 1, "10"),
            cell(2, 0, "Bob"),
            cell(2, 1, "20"),
            cell(3, 0, "Dave"),
            cell(3, 1, "5"),
            // D1 (row 0, col 3) references Charlie's age cell B1.
            cell(0, 3, "=B1"),
        ],
        undoable: false,
        init: false,
    }));

    // Before sorting: D1 reads Charlie's age via B1.
    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        assert!(
            matches!(ws.get_value(0, 3).unwrap(), Value::Number(n) if (n - 30.).abs() < 1e-9),
            "D1 should read B1 = 30 before the sort, got {:?}",
            ws.get_value(0, 3).unwrap()
        );
        assert_eq!(ws.get_formula(0, 3).unwrap(), "B1");
    }

    // Sort ascending by age → [3,1,2,0]: Charlie (row 0) moves to row 3, so his
    // age cell moves B1 → B4.
    let order = wb.get_block_sort_order(0, bid, "age", true).unwrap();
    assert_eq!(order.new_order, vec![3, 1, 2, 0]);
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::ReorderBlockLines(ReorderBlockLines {
            sheet_idx: 0,
            block_id: bid,
            is_row: order.is_row,
            new_order: order.new_order,
        })],
        undoable: false,
        init: false,
    }));

    // After sorting: the reference followed the cell to B4. The formula's VALUE
    // is unchanged (still Charlie's 30, not the 5 now sitting at B1), and its
    // TEXT re-anchored to the new coordinate.
    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        assert!(
            matches!(ws.get_value(0, 3).unwrap(), Value::Number(n) if (n - 30.).abs() < 1e-9),
            "D1 must still read Charlie's 30 (the cell it referenced), got {:?}",
            ws.get_value(0, 3).unwrap()
        );
        assert_eq!(
            ws.get_formula(0, 3).unwrap(),
            "B4",
            "the reference must re-anchor to the moved cell's new coordinate"
        );
        // Sanity: B1 now holds Dave's 5, confirming the record really moved.
        assert!(
            matches!(ws.get_value(0, 1).unwrap(), Value::Number(n) if (n - 5.).abs() < 1e-9),
            "B1 should now hold Dave's 5 after the sort"
        );
    }
}

#[test]
fn formulatext_returns_source_formula_and_na() {
    use crate::controller::display::Value;
    use crate::edit_action::CellInput;

    let mut wb = Workbook::default();
    let input = |row: usize, col: usize, content: &str| {
        EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row,
            col,
            content: content.to_string(),
        })
    };
    let r = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            input(0, 0, "=1+1"),             // A1: a formula
            input(1, 0, "42"),               // A2: a plain value (no formula)
            input(0, 1, "=FORMULATEXT(A1)"), // B1: formula of A1
            input(1, 1, "=FORMULATEXT(A2)"), // B2: A2 has no formula -> #N/A
            input(0, 2, "=ISFORMULA(A1)"),   // C1: A1 has a formula -> TRUE
            input(1, 2, "=ISFORMULA(A2)"),   // C2: A2 has none -> FALSE
        ],
        undoable: true,
        init: false,
    }));
    assert!(matches!(r.status, crate::edit_action::StatusCode::Ok(_)));

    let ws = wb.get_sheet_by_idx(0).unwrap();
    // FORMULATEXT: the formula text with a leading '=' (Excel behavior).
    match ws.get_value(0, 1).unwrap() {
        Value::Str(s) => assert_eq!(s, "=1 + 1"),
        v => panic!("B1 expected the formula text, got {:?}", v),
    }
    // FORMULATEXT of a cell without a formula yields #N/A.
    match ws.get_value(1, 1).unwrap() {
        Value::Error(e) => assert_eq!(e, "#N/A"),
        v => panic!("B2 expected #N/A, got {:?}", v),
    }
    // ISFORMULA: TRUE for a formula cell, FALSE otherwise.
    assert!(
        matches!(ws.get_value(0, 2).unwrap(), Value::Bool(true)),
        "C1 expected ISFORMULA(A1) == TRUE"
    );
    assert!(
        matches!(ws.get_value(1, 2).unwrap(), Value::Bool(false)),
        "C2 expected ISFORMULA(A2) == FALSE"
    );
}

/// `<dxfs>` must survive open→save. Conditional formatting rules (preserved
/// verbatim) address their format by *position* in that list, so dropping it —
/// as the saver used to, hardcoding `dxfs: None` — left every `cfRule/@dxfId`
/// dangling in the output file even though the rules themselves were retained.
#[test]
fn dxfs_round_trip_keeps_cf_references_resolvable() {
    use logisheets_workbook::prelude::{
        CtCfRule, CtColor, CtConditionalFormatting, CtDxf, CtDxfs, CtFill, CtPatternFill, StCfType,
        StConditionalFormattingOperator, StPatternType, Wb, write,
    };

    fn solid_dxf(rgb: &str) -> CtDxf {
        CtDxf {
            font: None,
            num_fmt: None,
            fill: Some(CtFill::PatternFill(CtPatternFill {
                fg_color: Some(CtColor {
                    auto: None,
                    indexed: None,
                    rgb: Some(rgb.to_string()),
                    theme: None,
                    tint: 0.0,
                }),
                bg_color: None,
                pattern_type: Some(StPatternType::Solid),
            })),
            alignment: None,
            border: None,
            protection: None,
        }
    }

    // Author an xlsx the way Excel would: two dxfs in styles.xml, and a rule
    // that points at the *second* one (dxfId=1).
    let base = Workbook::default().save().unwrap();
    let mut raw = Wb::from_file(&base).unwrap();
    raw.xl.styles.1.dxfs = Some(CtDxfs {
        count: 2,
        dxfs: vec![solid_dxf("FFFF0000"), solid_dxf("FFFFFF00")],
    });
    raw.xl
        .worksheets
        .values_mut()
        .next()
        .unwrap()
        .worksheet_part
        .conditional_formatting = vec![CtConditionalFormatting {
        cf_rules: vec![CtCfRule {
            formulas: vec![],
            color_scale: None,
            data_bar: None,
            icon_set: None,
            ty: StCfType::CellIs,
            dxf_id: Some(1),
            priority: 1,
            stop_if_true: false,
            above_average: true,
            percent: false,
            bottom: false,
            operator: Some(StConditionalFormattingOperator::GreaterThan),
            text: None,
            time_period: None,
            rank: None,
            std_dev: None,
            equal_average: false,
        }],
        pviot: false,
        sqref: "A1:A10".to_string(),
    }];
    let input = write(raw).unwrap();

    let wb = Workbook::from_file(&input, "dxf".to_string()).unwrap();
    let out = wb.save().unwrap();

    let reloaded = Wb::from_file(&out).unwrap();
    let dxfs = reloaded
        .xl
        .styles
        .1
        .dxfs
        .as_ref()
        .expect("dxfs should survive the controller round trip");
    assert_eq!(dxfs.count, 2);
    assert_eq!(dxfs.dxfs.len(), 2);

    // Order matters: dxfId is an index. The rule's dxfId=1 must still resolve
    // to the yellow fill it referenced in the input.
    let ws = reloaded.xl.worksheets.values().next().unwrap();
    let rule = &ws.worksheet_part.conditional_formatting[0].cf_rules[0];
    assert_eq!(rule.dxf_id, Some(1));
    let referenced = dxfs
        .dxfs
        .get(rule.dxf_id.unwrap() as usize)
        .expect("dxfId must be in range");
    let fg = match referenced.fill.as_ref().unwrap() {
        CtFill::PatternFill(p) => p.fg_color.as_ref().unwrap().rgb.as_deref(),
        CtFill::GradientFill(_) => None,
    };
    assert_eq!(fg, Some("FFFFFF00"));
}

/// A workbook with no `<dxfs>` must not grow an empty element.
#[test]
fn no_dxfs_stays_absent() {
    use logisheets_workbook::prelude::Wb;

    let out = Workbook::default().save().unwrap();
    let reloaded = Wb::from_file(&out).unwrap();
    assert!(reloaded.xl.styles.1.dxfs.is_none());
}

/// Build an xlsx that carries `conditional_formatting` on its first sheet, the
/// way Excel would author it. `base` is an already-saved workbook to inject
/// into, so callers can set up blocks or cell values first.
#[cfg(test)]
fn with_conditional_formatting(
    base: &[u8],
    elements: Vec<(&str, Vec<logisheets_workbook::prelude::CtCfRule>)>,
) -> Vec<u8> {
    use logisheets_workbook::prelude::{CtConditionalFormatting, Wb, write};
    let mut raw = Wb::from_file(base).unwrap();
    raw.xl
        .worksheets
        .values_mut()
        .next()
        .unwrap()
        .worksheet_part
        .conditional_formatting = elements
        .into_iter()
        .map(|(sqref, cf_rules)| CtConditionalFormatting {
            cf_rules,
            pviot: false,
            sqref: sqref.to_string(),
        })
        .collect();
    write(raw).unwrap()
}

/// A minimal `cellIs > 0` rule pointing at dxf 0.
#[cfg(test)]
fn cell_is_rule(priority: i32) -> logisheets_workbook::prelude::CtCfRule {
    use logisheets_workbook::prelude::{CtCfRule, StCfType, StConditionalFormattingOperator};
    CtCfRule {
        formulas: vec![],
        color_scale: None,
        data_bar: None,
        icon_set: None,
        ty: StCfType::CellIs,
        dxf_id: Some(0),
        priority,
        stop_if_true: false,
        above_average: true,
        percent: false,
        bottom: false,
        operator: Some(StConditionalFormattingOperator::GreaterThan),
        text: None,
        time_period: None,
        rank: None,
        std_dev: None,
        equal_average: false,
    }
}

/// The first sheet's `conditionalFormatting` sqrefs, after a save.
#[cfg(test)]
fn saved_cf_sqrefs(bytes: &[u8]) -> Vec<String> {
    use logisheets_workbook::prelude::Wb;
    let reloaded = Wb::from_file(bytes).unwrap();
    reloaded
        .xl
        .worksheets
        .values()
        .next()
        .unwrap()
        .worksheet_part
        .conditional_formatting
        .iter()
        .map(|cf| cf.sqref.clone())
        .collect()
}

/// Every `sqref` shape Excel writes must survive open→save unchanged: bounded
/// rectangles, single cells, whole columns, whole rows, and multi-token unions.
#[test]
fn conditional_formatting_sqref_round_trips() {
    let base = Workbook::default().save().unwrap();
    let input = with_conditional_formatting(
        &base,
        vec![
            ("A1:B10", vec![cell_is_rule(1)]),
            ("D3", vec![cell_is_rule(2)]),
            ("F:G", vec![cell_is_rule(3)]),
            ("2:4", vec![cell_is_rule(4)]),
            ("A20:A21 C20 E20:F21", vec![cell_is_rule(5)]),
        ],
    );

    let wb = Workbook::from_file(&input, "cf".to_string()).unwrap();
    let out = wb.save().unwrap();

    assert_eq!(
        saved_cf_sqrefs(&out),
        vec!["A1:B10", "D3", "F:G", "2:4", "A20:A21 C20 E20:F21"]
    );
}

/// The whole point of modeling `sqref` as ids: inserting a row above a rule's
/// range moves the range, exactly as Excel does. Kept as a raw A1 string it
/// would silently keep pointing at the old rows.
#[test]
fn conditional_formatting_range_shifts_when_rows_are_inserted() {
    use crate::edit_action::InsertRows;

    let base = Workbook::default().save().unwrap();
    let input = with_conditional_formatting(
        &base,
        vec![
            ("A2:A10", vec![cell_is_rule(1)]),
            ("C:C", vec![cell_is_rule(2)]),
        ],
    );

    let mut wb = Workbook::from_file(&input, "cf".to_string()).unwrap();
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::InsertRows(InsertRows {
            sheet_idx: 0,
            start: 0,
            count: 2,
        })],
        undoable: false,
        init: false,
    }));
    let out = wb.save().unwrap();

    // The rectangle moved down by two; the whole-column range is unaffected by
    // a row insert, which is also Excel's behavior.
    assert_eq!(saved_cf_sqrefs(&out), vec!["A4:A12", "C:C"]);
}

/// A column insert to the left shifts a rule's columns, including a
/// whole-column range.
#[test]
fn conditional_formatting_range_shifts_when_cols_are_inserted() {
    use crate::edit_action::InsertCols;

    let base = Workbook::default().save().unwrap();
    let input = with_conditional_formatting(
        &base,
        vec![
            ("B2:C10", vec![cell_is_rule(1)]),
            ("D:D", vec![cell_is_rule(2)]),
        ],
    );

    let mut wb = Workbook::from_file(&input, "cf".to_string()).unwrap();
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::InsertCols(InsertCols {
            sheet_idx: 0,
            start: 0,
            count: 1,
        })],
        undoable: false,
        init: false,
    }));
    let out = wb.save().unwrap();

    assert_eq!(saved_cf_sqrefs(&out), vec!["C2:D10", "E:E"]);
}

/// A rule covering a form block must anchor on *block* cell ids, not the normal
/// cell ids those coordinates would have had before the block existed —
/// otherwise the range stops tracking as soon as the block's own rows move.
#[test]
fn conditional_formatting_anchors_on_block_cells() {
    use crate::conditional_formatting_manager::CfRange;
    use crate::edit_action::InsertRowsInBlock;
    use logisheets_base::CellId;

    // A 3x3 block at (1,1), i.e. B2:D4. Save it so the block is present at load
    // time — the modeling pass runs after the loader settles.
    let mut authored = Workbook::default();
    let block_id = authored.get_available_block_id(0).unwrap();
    authored.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CreateBlock(CreateBlock {
            sheet_idx: 0,
            id: block_id,
            master_row: 1,
            master_col: 1,
            row_cnt: 3,
            col_cnt: 3,
            owner: None,
            modify_policy: None,
            permissions: None,
            description: None,
        })],
        undoable: false,
        init: false,
    }));
    let base = authored.save().unwrap();
    let input = with_conditional_formatting(&base, vec![("B2:D4", vec![cell_is_rule(1)])]);

    let mut wb = Workbook::from_file(&input, "cf".to_string()).unwrap();
    assert_eq!(
        wb.get_sheet_by_idx(0).unwrap().get_all_blocks().len(),
        1,
        "the block must be present at load time for this test to mean anything"
    );

    // Both corners of B2:D4 land inside the block.
    {
        let sheet_id = wb.status().sheet_info_manager.pos[0];
        let blocks = wb
            .status()
            .conditional_formatting_manager
            .get_sheet(sheet_id)
            .expect("the rule should be modeled");
        assert_eq!(blocks.len(), 1);
        match blocks[0].ranges[0] {
            CfRange::Rect(start, end) => {
                assert!(
                    matches!(start, CellId::BlockCell(_)),
                    "top-left should anchor on a block cell, got {start:?}"
                );
                assert!(
                    matches!(end, CellId::BlockCell(_)),
                    "bottom-right should anchor on a block cell, got {end:?}"
                );
            }
            other => panic!("expected a rectangle, got {other:?}"),
        }
    }

    // Growing the block from the inside must grow the covered range with it.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::InsertRowsInBlock(InsertRowsInBlock {
            sheet_idx: 0,
            block_id,
            start: 1,
            cnt: 1,
        })],
        undoable: false,
        init: false,
    }));
    let out = wb.save().unwrap();
    assert_eq!(saved_cf_sqrefs(&out), vec!["B2:D5"]);
}

/// Modeling must never lose what it can't model: a `sqref` we don't understand
/// stays in the verbatim passthrough and still round-trips.
#[test]
fn unmodelable_conditional_formatting_is_preserved_verbatim() {
    let base = Workbook::default().save().unwrap();
    // `B2:B` is half-open but not a clean whole-column range — there is no sane
    // id to anchor the open end on.
    let input = with_conditional_formatting(
        &base,
        vec![
            ("B2:B", vec![cell_is_rule(1)]),
            ("A1:A5", vec![cell_is_rule(2)]),
        ],
    );

    let wb = Workbook::from_file(&input, "cf".to_string()).unwrap();
    let sheet_id = wb.status().sheet_info_manager.pos[0];
    assert_eq!(
        wb.status()
            .conditional_formatting_manager
            .get_sheet(sheet_id)
            .map(|b| b.len()),
        Some(1),
        "only the modelable element should be in the manager"
    );

    let out = wb.save().unwrap();
    let mut sqrefs = saved_cf_sqrefs(&out);
    sqrefs.sort();
    assert_eq!(sqrefs, vec!["A1:A5", "B2:B"]);
}

/// End-to-end: a `cellIs > 100` rule must actually evaluate. The cell's
/// `ConditionalFormat` shadow holds the bitmask of matching rules, so bit 0 set
/// (value 1) means the single rule matched.
#[test]
fn conditional_formatting_rule_evaluates_on_load() {
    use crate::controller::display::Value;
    use crate::edit_action::CellInput;
    use crate::sid_assigner::ShadowKind;
    use logisheets_workbook::prelude::{CtCfRule, PlainTextString};

    fn greater_than(v: &str) -> CtCfRule {
        let mut r = cell_is_rule(1);
        r.formulas = vec![PlainTextString {
            value: v.to_string(),
            space: None,
        }];
        r
    }

    // A1 = 150 (matches), A2 = 50 (does not). Values must exist at load time.
    let mut authored = Workbook::default();
    authored.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 0,
                content: "150".to_string(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 1,
                col: 0,
                content: "50".to_string(),
            }),
        ],
        undoable: false,
        init: false,
    }));
    let base = authored.save().unwrap();
    let input = with_conditional_formatting(&base, vec![("A1:A10", vec![greater_than("100")])]);

    let mut wb = Workbook::from_file(&input, "cf".to_string()).unwrap();

    let mut mask = |row: usize| -> Value {
        let scid = wb
            .get_shadow_cell_id(0, row, 0, ShadowKind::ConditionalFormat)
            .unwrap();
        let id = match scid.cell_id {
            logisheets_base::CellId::EphemeralCell(i) => i,
            _ => panic!("expected an ephemeral shadow cell"),
        };
        wb.get_shadow_info_by_id(id).unwrap().value
    };

    // Bit 0 is the only rule, so 1 means "matched" and 0 means "did not".
    let a1 = mask(0);
    assert!(
        matches!(a1, Value::Number(n) if n == 1.0),
        "A1=150 should match the >100 rule, got {a1:?}"
    );
    let a2 = mask(1);
    assert!(
        matches!(a2, Value::Number(n) if n == 0.0),
        "A2=50 should not match, got {a2:?}"
    );
    // A3 is blank, so no formula was installed for it: reading its shadow gives
    // no match rather than a stale one.
    let a3 = mask(2);
    assert!(
        !matches!(a3, Value::Number(n) if n != 0.0),
        "a blank cell must not report a match, got {a3:?}"
    );
}

/// The gap that made validation's "only sync at load" approach unacceptable for
/// conditional formatting: typing into a cell that was blank at load time must
/// still light the rule up, and clearing it must turn the rule off again.
#[test]
fn conditional_formatting_resyncs_after_edits() {
    use crate::controller::display::Value;
    use crate::edit_action::{CellClear, CellInput, InsertRows};
    use crate::sid_assigner::ShadowKind;
    use logisheets_workbook::prelude::{CtCfRule, PlainTextString};

    fn greater_than(v: &str) -> CtCfRule {
        let mut r = cell_is_rule(1);
        r.formulas = vec![PlainTextString {
            value: v.to_string(),
            space: None,
        }];
        r
    }

    // Nothing in the sheet at load: every covered cell is blank, so no shadow
    // is materialized up front.
    let base = Workbook::default().save().unwrap();
    let input = with_conditional_formatting(&base, vec![("A1:A10", vec![greater_than("100")])]);
    let mut wb = Workbook::from_file(&input, "cf".to_string()).unwrap();

    let input_at = |wb: &mut Workbook, row: usize, content: &str| {
        wb.handle_action(EditAction::Payloads(PayloadsAction {
            payloads: vec![EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row,
                col: 0,
                content: content.to_string(),
            })],
            undoable: true,
            init: false,
        }));
    };
    let mask = |wb: &mut Workbook, row: usize| -> Value {
        let scid = wb
            .get_shadow_cell_id(0, row, 0, ShadowKind::ConditionalFormat)
            .unwrap();
        let id = match scid.cell_id {
            logisheets_base::CellId::EphemeralCell(i) => i,
            _ => panic!("expected an ephemeral shadow cell"),
        };
        wb.get_shadow_info_by_id(id).unwrap().value
    };

    // Type a matching value into a cell that had no shadow.
    input_at(&mut wb, 4, "500");
    let v = mask(&mut wb, 4);
    assert!(
        matches!(v, Value::Number(n) if n == 1.0),
        "A5=500 should match after the edit, got {v:?}"
    );

    // Overwrite with a non-matching value.
    input_at(&mut wb, 4, "5");
    let v = mask(&mut wb, 4);
    assert!(
        matches!(v, Value::Number(n) if n == 0.0),
        "A5=5 should stop matching, got {v:?}"
    );

    // Clearing the cell must not leave a stale match behind.
    input_at(&mut wb, 4, "500");
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellClear(CellClear {
            sheet_idx: 0,
            row: 4,
            col: 0,
        })],
        undoable: true,
        init: false,
    }));
    let v = mask(&mut wb, 4);
    assert!(
        !matches!(v, Value::Number(n) if n != 0.0),
        "a cleared cell must not report a match, got {v:?}"
    );

    // A row insert moves the range; the value that rode down with it keeps its
    // formatting, and the rule still covers its new position.
    input_at(&mut wb, 2, "700");
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::InsertRows(InsertRows {
            sheet_idx: 0,
            start: 0,
            count: 1,
        })],
        undoable: true,
        init: false,
    }));
    let v = mask(&mut wb, 3);
    assert!(
        matches!(v, Value::Number(n) if n == 1.0),
        "the value moved to A4 and should still match, got {v:?}"
    );
}

/// The payoff of the whole stage: a matching rule's differential format arrives
/// on `CellInfo` already merged onto the cell's own style, so the frontend has
/// nothing to decide. And a dxf that sets only one property must leave the
/// cell's other properties intact.
#[test]
fn conditional_format_reaches_cell_info_merged() {
    use crate::edit_action::CellInput;
    use logisheets_workbook::prelude::{
        CtColor, CtDxf, CtDxfs, CtFill, CtFont, CtPatternFill, PlainTextString, StPatternType, Wb,
        write,
    };

    fn red(rgb: &str) -> CtColor {
        CtColor {
            auto: None,
            indexed: None,
            rgb: Some(rgb.to_string()),
            theme: None,
            tint: 0.0,
        }
    }

    // A1 = 150 (matches >100), A2 = 50 (does not), both bold via the cell's own
    // style so we can check the dxf does not clobber it.
    let mut authored = Workbook::default();
    authored.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 0,
                content: "150".to_string(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 1,
                col: 0,
                content: "50".to_string(),
            }),
            EditPayload::CellStyleUpdate(crate::edit_action::CellStyleUpdate {
                sheet_idx: 0,
                row: 0,
                col: 0,
                ty: StyleUpdateType {
                    set_font_bold: Some(true),
                    ..Default::default()
                },
            }),
        ],
        undoable: false,
        init: false,
    }));
    let base = authored.save().unwrap();

    // Inject a dxf that sets ONLY a fill colour, and a rule pointing at it.
    let mut raw = Wb::from_file(&base).unwrap();
    raw.xl.styles.1.dxfs = Some(CtDxfs {
        count: 1,
        dxfs: vec![CtDxf {
            font: Some(CtFont {
                bold: false,
                italic: false,
                underline: None,
                color: Some(red("FFFF0000")),
                sz: None,
                name: None,
                charset: None,
                family: None,
                strike: false,
                outline: false,
                shadow: false,
                condense: false,
                extend: false,
                vert_align: None,
                scheme: None,
            }),
            num_fmt: None,
            fill: Some(CtFill::PatternFill(CtPatternFill {
                fg_color: Some(red("FFFFFF00")),
                bg_color: None,
                pattern_type: Some(StPatternType::Solid),
            })),
            alignment: None,
            border: None,
            protection: None,
        }],
    });
    let base = write(raw).unwrap();

    let mut rule = cell_is_rule(1);
    rule.formulas = vec![PlainTextString {
        value: "100".to_string(),
        space: None,
    }];
    let input = with_conditional_formatting(&base, vec![("A1:A10", vec![rule])]);

    let wb = Workbook::from_file(&input, "cf".to_string()).unwrap();
    let ws = wb.get_sheet_by_idx(0).unwrap();

    let a1 = ws.get_cell_info(0, 0).unwrap();
    let cf = a1
        .conditional_format
        .as_ref()
        .expect("A1=150 matches, so it must carry a conditional format");
    // The dxf's font colour came through...
    // Color channels are 0..255 here.
    assert_eq!(
        cf.style.font.color.as_ref().and_then(|c| c.red),
        Some(255.0),
        "the dxf font colour should be applied"
    );
    // ...and the cell's own bold survived, because a dxf is a partial style.
    assert!(
        cf.style.font.bold,
        "the cell's own bold must not be clobbered by a dxf that doesn't set it"
    );
    // The base style is still reported unchanged alongside it.
    assert!(
        a1.style.font.color.as_ref().and_then(|c| c.red) != Some(255.0),
        "CellInfo::style should remain the cell's own style"
    );

    // A2 does not match, so it carries no conditional format at all.
    let a2 = ws.get_cell_info(1, 0).unwrap();
    assert!(
        a2.conditional_format.is_none(),
        "A2=50 does not match; no conditional format expected"
    );
}

/// Undo must put the conditional formatting back too. The rules live in
/// `Status` (so they ride the snapshot), but the shadows are installed with
/// `undoable: false`, so this checks that the re-sync hook fires on an undo and
/// re-derives the match from the restored value.
#[test]
fn conditional_formatting_follows_undo_and_redo() {
    use crate::controller::display::Value;
    use crate::edit_action::CellInput;
    use crate::sid_assigner::ShadowKind;
    use logisheets_workbook::prelude::{CtCfRule, PlainTextString};

    fn greater_than(v: &str) -> CtCfRule {
        let mut r = cell_is_rule(1);
        r.formulas = vec![PlainTextString {
            value: v.to_string(),
            space: None,
        }];
        r
    }

    let base = Workbook::default().save().unwrap();
    let input = with_conditional_formatting(&base, vec![("A1:A10", vec![greater_than("100")])]);
    let mut wb = Workbook::from_file(&input, "cf".to_string()).unwrap();

    let mask = |wb: &mut Workbook| -> Value {
        let scid = wb
            .get_shadow_cell_id(0, 0, 0, ShadowKind::ConditionalFormat)
            .unwrap();
        let id = match scid.cell_id {
            logisheets_base::CellId::EphemeralCell(i) => i,
            _ => panic!("expected an ephemeral shadow cell"),
        };
        wb.get_shadow_info_by_id(id).unwrap().value
    };

    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 0,
            col: 0,
            content: "500".to_string(),
        })],
        undoable: true,
        init: false,
    }));
    let v = mask(&mut wb);
    assert!(
        matches!(v, Value::Number(n) if n == 1.0),
        "A1=500 should match, got {v:?}"
    );

    wb.handle_action(EditAction::Undo);
    let v = mask(&mut wb);
    assert!(
        !matches!(v, Value::Number(n) if n != 0.0),
        "after undo A1 is blank again, so it must not report a match, got {v:?}"
    );

    wb.handle_action(EditAction::Redo);
    let v = mask(&mut wb);
    assert!(
        matches!(v, Value::Number(n) if n == 1.0),
        "after redo A1=500 should match again, got {v:?}"
    );
}

/// A whole-column conditional format is commonly written out as an explicit
/// `A1:A1048576`, addressing the last row of the xlsx grid. The navigator used
/// to allocate only 1,000,000 rows per sheet and `Fetcher::get_row_id` panics
/// past the end, so resolving such a range brought the whole loader down —
/// which in the browser also poisons the wasm instance.
#[test]
fn conditional_formatting_spanning_the_full_grid_loads() {
    let base = Workbook::default().save().unwrap();
    let input = with_conditional_formatting(
        &base,
        vec![
            ("A1:A1048576", vec![cell_is_rule(1)]),
            ("B1:XFD1", vec![cell_is_rule(2)]),
        ],
    );

    let wb = Workbook::from_file(&input, "grid".to_string()).expect("must load");
    let total: usize = wb
        .status()
        .conditional_formatting_manager
        .data
        .iter()
        .flat_map(|(_, b)| b.iter())
        .map(|b| b.rules.len())
        .sum();
    assert_eq!(total, 2, "both full-extent rules should survive the load");

    // And the extents must come back out intact rather than clamped to the
    // populated area.
    let out = wb.save().unwrap();
    let reloaded = logisheets_workbook::prelude::Wb::from_file(&out).unwrap();
    let ws = reloaded.xl.worksheets.values().next().unwrap();
    let sqrefs: Vec<&str> = ws
        .worksheet_part
        .conditional_formatting
        .iter()
        .map(|c| c.sqref.as_str())
        .collect();
    assert!(
        sqrefs.contains(&"A1:A1048576"),
        "expected the full-column range back, got {sqrefs:?}"
    );
    assert!(
        sqrefs.contains(&"B1:XFD1"),
        "expected the full-row range back, got {sqrefs:?}"
    );
}

/// Authoring a rule from scratch: create it, see it take effect on the right
/// cells, save it, and read it back from the file.
#[test]
fn create_conditional_formatting_rule_end_to_end() {
    use crate::edit_action::{CellInput, CreateConditionalFormattingRule};

    let mut wb = Workbook::default();
    // A1=50, A2=500 so exactly one of them should match.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 0,
                content: "50".to_string(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 1,
                col: 0,
                content: "500".to_string(),
            }),
        ],
        undoable: false,
        init: false,
    }));

    let spec = greater_than_spec("100", "FFFFC7CE");
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CreateConditionalFormattingRule(
            CreateConditionalFormattingRule {
                sheet_idx: 0,
                start_row: 0,
                start_col: 0,
                end_row: 9,
                end_col: 0,
                rule: spec,
            },
        )],
        undoable: true,
        init: false,
    }));

    // The rule is listed, with a range and a round-trippable spec.
    let rules = wb
        .get_sheet_by_idx(0)
        .unwrap()
        .get_conditional_formatting_rules();
    assert_eq!(rules.len(), 1);
    assert_eq!(rules[0].range, "A1:A10");
    assert_eq!(rules[0].spec.ty, "cellIs");
    assert_eq!(rules[0].spec.operator.as_deref(), Some("greaterThan"));
    assert_eq!(rules[0].spec.operands, vec!["100".to_string()]);
    assert_eq!(
        rules[0]
            .spec
            .format
            .as_ref()
            .and_then(|f| f.fill_color.as_deref()),
        Some("FFFFC7CE")
    );
    assert!(rules[0].preview.is_some(), "a preview style should resolve");

    // And it actually applies: A2 (500) matches, A1 (50) does not.
    let ws = wb.get_sheet_by_idx(0).unwrap();
    assert!(
        ws.get_cell_info(1, 0).unwrap().conditional_format.is_some(),
        "A2=500 should be formatted"
    );
    assert!(
        ws.get_cell_info(0, 0).unwrap().conditional_format.is_none(),
        "A1=50 must not match a >100 rule"
    );

    // It survives the file.
    let bytes = wb.save().unwrap();
    let reloaded = Workbook::from_file(&bytes, "cf".to_string()).unwrap();
    let rules = reloaded
        .get_sheet_by_idx(0)
        .unwrap()
        .get_conditional_formatting_rules();
    assert_eq!(rules.len(), 1, "the authored rule must survive a save");
    assert_eq!(rules[0].range, "A1:A10");
    assert_eq!(
        rules[0]
            .spec
            .format
            .as_ref()
            .and_then(|f| f.fill_color.as_deref()),
        Some("FFFFC7CE"),
        "the authored dxf must survive too"
    );
}

/// Update reuses the rule's dxf slot instead of appending, so editing a rule
/// repeatedly does not grow `<dxfs>`; delete removes the rule and its element.
#[test]
fn update_and_delete_conditional_formatting_rule() {
    use crate::edit_action::{DeleteConditionalFormattingRule, UpdateConditionalFormattingRule};

    let mut wb = Workbook::default();
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CreateConditionalFormattingRule(
            crate::edit_action::CreateConditionalFormattingRule {
                sheet_idx: 0,
                start_row: 0,
                start_col: 0,
                end_row: 9,
                end_col: 0,
                rule: greater_than_spec("100", "FFFFC7CE"),
            },
        )],
        undoable: true,
        init: false,
    }));
    let rules = wb
        .get_sheet_by_idx(0)
        .unwrap()
        .get_conditional_formatting_rules();
    let id = rules[0].rule_id;
    let dxfs_after_create = wb.status().style_manager.dxf_manager.len();
    assert_eq!(dxfs_after_create, 1);

    // Edit it three times; the dxf list must not grow.
    for color in ["FF00FF00", "FF0000FF", "FFFFFF00"] {
        wb.handle_action(EditAction::Payloads(PayloadsAction {
            payloads: vec![EditPayload::UpdateConditionalFormattingRule(
                UpdateConditionalFormattingRule {
                    sheet_idx: 0,
                    rule_id: id,
                    rule: greater_than_spec("200", color),
                },
            )],
            undoable: true,
            init: false,
        }));
    }
    let rules = wb
        .get_sheet_by_idx(0)
        .unwrap()
        .get_conditional_formatting_rules();
    assert_eq!(rules.len(), 1);
    assert_eq!(rules[0].rule_id, id, "an update must keep the rule's id");
    assert_eq!(rules[0].spec.operands, vec!["200".to_string()]);
    assert_eq!(
        rules[0]
            .spec
            .format
            .as_ref()
            .and_then(|f| f.fill_color.as_deref()),
        Some("FFFFFF00")
    );
    assert_eq!(
        wb.status().style_manager.dxf_manager.len(),
        dxfs_after_create,
        "repeated edits must reuse the rule's dxf slot"
    );

    // Delete removes it entirely.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::DeleteConditionalFormattingRule(
            DeleteConditionalFormattingRule {
                sheet_idx: 0,
                rule_id: id,
            },
        )],
        undoable: true,
        init: false,
    }));
    assert!(
        wb.get_sheet_by_idx(0)
            .unwrap()
            .get_conditional_formatting_rules()
            .is_empty(),
        "the rule should be gone"
    );
    assert!(
        wb.status().conditional_formatting_manager.is_empty(),
        "an element left with no rules should be dropped"
    );
}

/// A malformed spec must be rejected with a message, not stored as a rule that
/// silently never matches.
#[test]
fn invalid_conditional_formatting_specs_are_rejected() {
    use crate::conditional_formatting_manager::spec::CfRuleSpec;
    use crate::edit_action::CreateConditionalFormattingRule;

    let cases: Vec<(&str, CfRuleSpec)> = vec![
        (
            "unknown type",
            CfRuleSpec {
                ty: "notARule".to_string(),
                ..Default::default()
            },
        ),
        (
            "cellIs with no operator",
            CfRuleSpec {
                ty: "cellIs".to_string(),
                operands: vec!["1".to_string()],
                ..Default::default()
            },
        ),
        (
            "between with one operand",
            CfRuleSpec {
                ty: "cellIs".to_string(),
                operator: Some("between".to_string()),
                operands: vec!["1".to_string()],
                ..Default::default()
            },
        ),
        (
            "containsText with no text",
            CfRuleSpec {
                ty: "containsText".to_string(),
                ..Default::default()
            },
        ),
        (
            "colorScale with one colour",
            CfRuleSpec {
                ty: "colorScale".to_string(),
                colors: vec!["FFFF0000".to_string()],
                ..Default::default()
            },
        ),
    ];

    for (name, spec) in cases {
        let mut wb = Workbook::default();
        let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
            payloads: vec![EditPayload::CreateConditionalFormattingRule(
                CreateConditionalFormattingRule {
                    sheet_idx: 0,
                    start_row: 0,
                    start_col: 0,
                    end_row: 0,
                    end_col: 0,
                    rule: spec,
                },
            )],
            undoable: true,
            init: false,
        }));
        assert!(
            matches!(effect.status, crate::edit_action::StatusCode::Err(_)),
            "{name} should be rejected with an error, got {:?}",
            effect.status
        );
        assert!(
            wb.get_sheet_by_idx(0)
                .unwrap()
                .get_conditional_formatting_rules()
                .is_empty(),
            "{name} must not leave a rule behind"
        );
    }
}

/// An authored rule's range is anchored on cell ids, so inserting a row above it
/// shifts it the way Excel does.
#[test]
fn authored_rule_range_shifts_on_insert() {
    use crate::edit_action::{CreateConditionalFormattingRule, InsertRows};

    let mut wb = Workbook::default();
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CreateConditionalFormattingRule(
            CreateConditionalFormattingRule {
                sheet_idx: 0,
                start_row: 4,
                start_col: 0,
                end_row: 9,
                end_col: 0,
                rule: greater_than_spec("100", "FFFFC7CE"),
            },
        )],
        undoable: true,
        init: false,
    }));
    assert_eq!(
        wb.get_sheet_by_idx(0)
            .unwrap()
            .get_conditional_formatting_rules()[0]
            .range,
        "A5:A10"
    );

    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::InsertRows(InsertRows {
            sheet_idx: 0,
            start: 0,
            count: 2,
        })],
        undoable: true,
        init: false,
    }));
    assert_eq!(
        wb.get_sheet_by_idx(0)
            .unwrap()
            .get_conditional_formatting_rules()[0]
            .range,
        "A7:A12",
        "the range must follow the rows it was anchored to"
    );
}

/// A `cellIs greaterThan` spec with a solid fill, the shape a UI would send.
fn greater_than_spec(
    operand: &str,
    fill: &str,
) -> crate::conditional_formatting_manager::spec::CfRuleSpec {
    use crate::conditional_formatting_manager::spec::{CfFormatSpec, CfRuleSpec};
    CfRuleSpec {
        ty: "cellIs".to_string(),
        operator: Some("greaterThan".to_string()),
        operands: vec![operand.to_string()],
        format: Some(CfFormatSpec {
            fill_color: Some(fill.to_string()),
            ..Default::default()
        }),
        ..Default::default()
    }
}

#[test]
fn empty_app_data_round_trips() {
    // Regression: the JS/wasm save entry (`save_file`) *always* injects an
    // AppData record, and its `data` is empty whenever the host has no
    // app-specific state — every headless / agent-built workbook. That wrote
    // `<app name="logisheets"></app>`, which yields no text event on read, so
    // the derived deserializer unwrapped `None` and panicked. Net effect: a
    // file LogiSheets had just written could not be reopened by LogiSheets.
    use logisheets_workbook::logisheets::AppData;

    let mut wb = Workbook::default();
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 0,
            col: 0,
            content: "=1+1".to_string(),
        })],
        undoable: true,
        init: false,
    }));
    wb.set_app_data(vec![AppData {
        name: "logisheets".to_string(),
        data: String::new(),
    }]);

    let bytes = wb.save().unwrap();
    let reloaded = Workbook::from_file(&bytes, "saved".to_string())
        .expect("a workbook we just saved must be loadable again");

    // The empty payload comes back as empty, not as a missing record.
    let apps = reloaded.get_app_data();
    assert_eq!(apps.len(), 1);
    assert_eq!(apps[0].name, "logisheets");
    assert_eq!(apps[0].data, "");

    // And the actual content survived (get_formula returns the unparsed body).
    assert_eq!(
        reloaded
            .get_sheet_by_idx(0)
            .unwrap()
            .get_formula(0, 0)
            .unwrap(),
        "1 + 1"
    );
}

#[test]
fn non_empty_app_data_still_round_trips() {
    // The default must not shadow a real payload.
    use logisheets_workbook::logisheets::AppData;

    let mut wb = Workbook::default();
    wb.set_app_data(vec![AppData {
        name: "logisheets".to_string(),
        data: r#"{"craft":"what-if","n":3}"#.to_string(),
    }]);
    let bytes = wb.save().unwrap();
    let reloaded = Workbook::from_file(&bytes, "saved".to_string()).unwrap();
    assert_eq!(
        reloaded.get_app_data()[0].data,
        r#"{"craft":"what-if","n":3}"#
    );
}

/// Regression: a block schema's key entries must report the index of the RECORD
/// the key identifies — the block-relative row for a RowSchema.
///
/// Both `get_all_blocks` and `get_block_info` resolved a key cell's index on the
/// FIELD axis instead: for a RowSchema they looked the key cell's *column* up in
/// `block_place.cols`. Every key cell sits in the same key column, so every key
/// came back with `idx: 0`. Anything addressing a record by key then aimed at
/// row 0 — a host writing "set field X of record 2025" silently overwrote 2024.
#[test]
fn block_schema_key_entries_report_record_row() {
    use crate::edit_action::{BindFormSchema, CellInput, InsertRowsInBlock};

    let mut wb = Workbook::default();
    let bid = wb.get_available_block_id(0).unwrap();

    // 3 rows x 2 cols at A1; col 0 is the key column, col 1 a data field.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 0,
                id: bid,
                master_row: 0,
                master_col: 0,
                row_cnt: 3,
                col_cnt: 2,
                owner: None,
                modify_policy: None,
                permissions: None,
                description: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "rec".into(),
                sheet_idx: 0,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec!["year".into(), "amount".into()],
                render_ids: vec!["r0".into(), "r1".into()],
                row: true,
                field_formulas: vec![],
                validation_formulas: vec![],
                editability_formulas: vec![],
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 0,
                content: "2024".to_string(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 1,
                col: 0,
                content: "2025".to_string(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 2,
                col: 0,
                content: "2026".to_string(),
            }),
        ],
        undoable: false,
        init: false,
    }));

    let keys_of = |wb: &Workbook| -> Vec<(String, usize)> {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let info = ws.get_block_info(bid).unwrap();
        let schema = info.schema.expect("block should have a schema");
        schema.keys.iter().map(|k| (k.key.clone(), k.idx)).collect()
    };

    assert_eq!(
        keys_of(&wb),
        vec![
            ("2024".to_string(), 0),
            ("2025".to_string(), 1),
            ("2026".to_string(), 2),
        ],
        "each key must carry its own block-relative row"
    );

    // Field entries stay on the field axis: they index columns.
    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let schema = ws.get_block_info(bid).unwrap().schema.unwrap();
        let fields: Vec<(String, usize)> = schema
            .fields
            .iter()
            .map(|f| (f.field.clone(), f.idx))
            .collect();
        assert!(fields.contains(&("year".to_string(), 0)));
        assert!(fields.contains(&("amount".to_string(), 1)));
    }

    // Growing the block must renumber, not flatten: insert a row in the middle.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::InsertRowsInBlock(InsertRowsInBlock {
                sheet_idx: 0,
                block_id: bid,
                start: 1,
                cnt: 1,
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 1,
                col: 0,
                content: "2024H2".to_string(),
            }),
        ],
        undoable: false,
        init: false,
    }));

    assert_eq!(
        keys_of(&wb),
        vec![
            ("2024".to_string(), 0),
            ("2024H2".to_string(), 1),
            ("2025".to_string(), 2),
            ("2026".to_string(), 3),
        ],
        "after an interior insert every key must still point at its own row"
    );
}

/// Regression: a range with one endpoint inside a block and the other outside
/// it has no representation (a `Range` is wholly normal or wholly one block's),
/// and the reference builder used to `panic!()` on it. That took down the whole
/// engine instance — fatal for a host that just parses whatever formula a user
/// or an agent typed. It must be a recoverable error instead.
#[test]
fn range_straddling_a_block_boundary_does_not_panic() {
    use crate::edit_action::{BindFormSchema, CellInput};

    let mut wb = Workbook::default();
    let bid = wb.get_available_block_id(0).unwrap();

    // A 1x2 block at A1: B1 is a block cell, B10 is an ordinary cell.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 0,
                id: bid,
                master_row: 0,
                master_col: 0,
                row_cnt: 1,
                col_cnt: 2,
                owner: None,
                modify_policy: None,
                permissions: None,
                description: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "rec".into(),
                sheet_idx: 0,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec!["id".into(), "qty".into()],
                render_ids: vec!["r0".into(), "r1".into()],
                row: true,
                field_formulas: vec![],
                validation_formulas: vec![],
                editability_formulas: vec![],
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 1,
                content: "4".to_string(),
            }),
        ],
        undoable: false,
        init: false,
    }));

    // The formula the engine cannot represent. Surviving this call is the test.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 0,
            col: 4,
            content: "=SUM(B1:B10)*2".to_string(),
        })],
        undoable: false,
        init: false,
    }));

    // The workbook is still usable afterwards: ordinary formulas still work.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 5,
            col: 0,
            content: "=1+1".to_string(),
        })],
        undoable: false,
        init: false,
    }));
    let ws = wb.get_sheet_by_idx(0).unwrap();
    assert!(
        matches!(ws.get_value(5, 0).unwrap(), crate::controller::display::Value::Number(n) if (n - 2.0).abs() < 1e-9),
        "the engine must stay usable after rejecting the reference"
    );

    // And it survives a save/load round-trip, which is where a host would hit
    // this again on reopening the file it just wrote.
    let bytes = wb.save().unwrap();
    let reloaded = Workbook::from_file(&bytes, "saved".to_string())
        .expect("reloading must not panic on the rejected reference");
    assert_eq!(reloaded.get_sheet_count(), 1);
}

#[test]
fn update_chart_changes_every_setting() {
    // Everything the chart editor can change must land in the chart and
    // survive a save/reload — the chart XML is regenerated on each edit, so a
    // setting that is not written back is silently lost.
    let buf = std::fs::read("../../tests/graph.xlsx").unwrap();
    let mut wb = Workbook::from_file(&buf, "graph".to_string()).unwrap();
    let (chart_id, original_color) = {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let charts = ws.get_charts();
        (
            charts[0].chart_id.clone(),
            charts[0].series[0].color.clone(),
        )
    };
    assert!(original_color.is_some(), "fixture series has a theme color");

    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::UpdateChart(UpdateChart {
            sheet_idx: 0,
            chart_id: chart_id.clone(),
            chart_type: Some("bar".to_string()),
            stacked: Some(true),
            legend_pos: Some("right".to_string()),
            cat_axis_title: Some("Quarter".to_string()),
            val_axis_title: Some("Amount".to_string()),
            show_data_labels: Some(true),
            data_label_position: Some("ctr".to_string()),
            num_fmt: Some("#,##0.00".to_string()),
            ..Default::default()
        })],
        undoable: true,
        init: false,
    }));

    let check = |c: &crate::controller::display::ChartInfo| {
        assert_eq!(c.chart_type, "bar");
        assert!(c.stacked, "stacked");
        assert_eq!(c.legend_pos.as_deref(), Some("right"));
        assert_eq!(c.cat_axis_title.as_deref(), Some("Quarter"));
        assert_eq!(c.val_axis_title.as_deref(), Some("Amount"));
        assert!(c.data_labels.show_value, "data labels on");
        assert_eq!(c.data_labels.position.as_deref(), Some("ctr"));
        assert_eq!(c.data_labels.num_fmt.as_deref(), Some("#,##0.00"));
        assert_eq!(c.val_axis_num_fmt.as_deref(), Some("#,##0.00"));
        // Regenerating the XML must not drop the series' colors.
        assert_eq!(c.series.len(), 3);
        assert!(c.series[0].color.is_some(), "series color preserved");
    };
    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        check(&ws.get_charts()[0]);
    }

    let bytes = wb.save().unwrap();
    let wb2 = Workbook::from_file(&bytes, "reloaded".to_string()).unwrap();
    let ws2 = wb2.get_sheet_by_idx(0).unwrap();
    check(&ws2.get_charts()[0]);
    assert_eq!(
        ws2.get_charts()[0].series[0].color,
        original_color,
        "the theme color is the same one it was loaded with"
    );
}

#[test]
fn update_chart_repoints_series_and_keeps_colors() {
    let buf = std::fs::read("../../tests/graph.xlsx").unwrap();
    let mut wb = Workbook::from_file(&buf, "graph".to_string()).unwrap();
    let (chart_id, color0) = {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let c = ws.get_charts();
        (c[0].chart_id.clone(), c[0].series[0].color.clone())
    };

    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::UpdateChart(UpdateChart {
            sheet_idx: 0,
            chart_id,
            // Two series instead of three; the first keeps its slot (and its
            // color), the second names an explicit one.
            series: Some(vec![
                CreateChartSeries {
                    name: Some("First".to_string()),
                    value_ref: "Sheet1!$B$2:$E$2".to_string(),
                    color: None,
                    size_ref: None,
                    series_type: None,
                },
                CreateChartSeries {
                    name: Some("Second".to_string()),
                    value_ref: "Sheet1!$B$3:$E$3".to_string(),
                    color: Some("FF0000".to_string()),
                    size_ref: None,
                    series_type: None,
                },
            ]),
            categories_ref: Some("Sheet1!$B$1:$E$1".to_string()),
            ..Default::default()
        })],
        undoable: true,
        init: false,
    }));

    let ws = wb.get_sheet_by_idx(0).unwrap();
    let c = &ws.get_charts()[0];
    assert_eq!(c.series.len(), 2);
    assert_eq!(c.series[0].name.as_deref(), Some("First"));
    assert_eq!(c.series[0].color, color0, "kept its position's color");
    assert_eq!(c.series[1].color.as_deref(), Some("FF0000"));
    assert_eq!(c.series[0].val_ref.as_deref(), Some("Sheet1!$B$2:$E$2"));
    assert_eq!(c.cat_ref.as_deref(), Some("Sheet1!$B$1:$E$1"));
    assert_eq!(
        c.series[0].values,
        vec![Some(11.0), Some(13.0), Some(15.0), Some(24.0)]
    );
}

#[test]
fn chart_categories_and_formats_are_live() {
    // Category labels follow the source cells (formatted the way the sheet
    // shows them), and the series' number format is read from those cells so
    // labels/axis can render like the data does.
    let mut wb = Workbook::default();
    let mut payloads: Vec<EditPayload> = vec![
        ("A1", 0usize, 0usize, "Jan"),
        ("A2", 1, 0, "Feb"),
        ("B1", 0, 1, "1234.5"),
        ("B2", 1, 1, "6789"),
    ]
    .into_iter()
    .map(|(_, r, c, v)| {
        EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: r,
            col: c,
            content: v.to_string(),
        })
    })
    .collect();
    // Format the values as currency-ish thousands.
    payloads.push(EditPayload::CellStyleUpdate(
        crate::edit_action::CellStyleUpdate {
            sheet_idx: 0,
            row: 0,
            col: 1,
            ty: StyleUpdateType {
                set_num_fmt: Some("#,##0.00".to_string()),
                ..Default::default()
            },
        },
    ));
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads,
        undoable: true,
        init: false,
    }));

    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CreateChart(CreateChart {
            sheet_idx: 0,
            chart_id: "chartLive".to_string(),
            chart_type: "col".to_string(),
            from_row: 4,
            from_col: 0,
            from_col_off: 0,
            from_row_off: 0,
            to_row: 18,
            to_col: 8,
            to_col_off: 0,
            to_row_off: 0,
            title: None,
            categories_ref: Some("Sheet1!$A$1:$A$2".to_string()),
            series: vec![CreateChartSeries {
                name: Some("Values".to_string()),
                value_ref: "Sheet1!$B$1:$B$2".to_string(),
                color: None,
                size_ref: None,
                series_type: None,
            }],
            block_source: None,
        })],
        undoable: true,
        init: false,
    }));

    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let c = &ws.get_charts()[0];
        assert_eq!(c.categories, vec!["Jan".to_string(), "Feb".to_string()]);
        assert_eq!(
            c.series[0].num_fmt.as_deref(),
            Some("#,##0.00"),
            "series format comes from the source cells"
        );
        // The label strings are rendered core-side; the host cannot evaluate
        // Excel format codes.
        assert_eq!(
            c.series[0].formatted_values,
            vec![Some("1,234.50".to_string()), Some("6,789.00".to_string())],
            "values are pre-formatted for data labels"
        );
    }

    // Renaming a category cell updates the chart's labels.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 1,
            col: 0,
            content: "March".to_string(),
        })],
        undoable: true,
        init: false,
    }));
    let ws = wb.get_sheet_by_idx(0).unwrap();
    assert_eq!(
        ws.get_charts()[0].categories,
        vec!["Jan".to_string(), "March".to_string()],
        "category labels are live"
    );
}

#[test]
fn editing_a_chart_keeps_its_styling_and_satellite_parts() {
    // A chart authored in Excel carries styling this engine does not model
    // (fonts, fills, gridline colors) plus sibling parts (style1/colors1).
    // Editing it regenerates the chart XML, so both have to survive that —
    // and survive a save/reload afterwards.
    let buf = std::fs::read("../../tests/graph.xlsx").unwrap();
    let mut wb = Workbook::from_file(&buf, "graph".to_string()).unwrap();
    let chart_id = {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        ws.get_charts()[0].chart_id.clone()
    };

    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::UpdateChart(UpdateChart {
            sheet_idx: 0,
            chart_id: chart_id.clone(),
            chart_type: Some("line".to_string()),
            title: Some("Edited".to_string()),
            ..Default::default()
        })],
        undoable: true,
        init: false,
    }));

    let bytes = wb.save().unwrap();
    let parts = chart_parts(&bytes);
    let chart_xml = parts
        .iter()
        .find(|(p, _)| p.ends_with("chart1.xml"))
        .map(|(_, d)| String::from_utf8_lossy(d).to_string())
        .expect("chart part written");

    assert!(
        chart_xml.contains(r#"<a:defRPr lang="zh-CN" sz="1400""#),
        "title font survived the edit"
    );
    assert!(
        chart_xml.contains("<c:majorGridlines><c:spPr>"),
        "styled gridlines survived the edit"
    );
    assert!(
        chart_xml.contains(r#"<c:spPr><a:solidFill><a:schemeClr val="bg1"/></a:solidFill>"#),
        "chart-area fill survived the edit"
    );
    assert!(chart_xml.contains("<c:lineChart>"), "the edit applied");

    // Excel's own style/colors parts ride along untouched.
    assert!(
        parts.iter().any(|(p, _)| p.ends_with("style1.xml")),
        "style part kept, got {:?}",
        parts.iter().map(|(p, _)| p).collect::<Vec<_>>()
    );
    assert!(
        parts.iter().any(|(p, _)| p.ends_with("colors1.xml")),
        "colors part kept"
    );

    // And the reloaded workbook still shows the edited chart.
    let wb2 = Workbook::from_file(&bytes, "reloaded".to_string()).unwrap();
    let ws2 = wb2.get_sheet_by_idx(0).unwrap();
    let c = &ws2.get_charts()[0];
    assert_eq!(c.chart_type, "line");
    assert_eq!(c.title.as_deref(), Some("Edited"));
    assert!(c.series[0].color.is_some(), "series colors still resolve");
}

/// Every chart part in a saved workbook, as (path, bytes).
fn chart_parts(xlsx: &[u8]) -> Vec<(String, Vec<u8>)> {
    let wb = logisheets_workbook::workbook::Wb::from_file(xlsx).unwrap();
    wb.xl
        .worksheets
        .values()
        .filter_map(|w| w.drawing.as_ref())
        .flat_map(|d| d.chart_parts.iter())
        .map(|p| (p.path.clone(), p.data.clone()))
        .collect()
}

#[test]
fn update_chart_sets_the_axis_scale() {
    use crate::edit_action::AxisScaleUpdate;
    let buf = std::fs::read("../../tests/graph.xlsx").unwrap();
    let mut wb = Workbook::from_file(&buf, "graph".to_string()).unwrap();
    let chart_id = {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        assert_eq!(
            ws.get_charts()[0].val_axis_scale.min,
            None,
            "starts automatic"
        );
        ws.get_charts()[0].chart_id.clone()
    };

    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::UpdateChart(UpdateChart {
            sheet_idx: 0,
            chart_id: chart_id.clone(),
            val_axis_scale: Some(AxisScaleUpdate {
                min: Some(0.0),
                max: Some(80.0),
                major_unit: Some(20.0),
                // Out of Excel's 2..=1000 range, so it must be ignored rather
                // than written into a file Excel would refuse.
                log_base: Some(1.0),
                ..Default::default()
            }),
            ..Default::default()
        })],
        undoable: true,
        init: false,
    }));

    let check = |c: &crate::controller::display::ChartInfo| {
        assert_eq!(c.val_axis_scale.min, Some(0.0));
        assert_eq!(c.val_axis_scale.max, Some(80.0));
        assert_eq!(c.val_axis_scale.major_unit, Some(20.0));
        assert_eq!(c.val_axis_scale.log_base, None, "invalid log base dropped");
        assert!(!c.val_axis_scale.reversed);
    };
    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        check(&ws.get_charts()[0]);
    }

    let bytes = wb.save().unwrap();
    let wb2 = Workbook::from_file(&bytes, "reloaded".to_string()).unwrap();
    check(&wb2.get_sheet_by_idx(0).unwrap().get_charts()[0]);

    // Sending the scale again with everything cleared returns it to automatic.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::UpdateChart(UpdateChart {
            sheet_idx: 0,
            chart_id,
            val_axis_scale: Some(AxisScaleUpdate::default()),
            ..Default::default()
        })],
        undoable: true,
        init: false,
    }));
    let ws = wb.get_sheet_by_idx(0).unwrap();
    assert_eq!(ws.get_charts()[0].val_axis_scale.max, None, "back to auto");
}

/// Charts live in `Status`, which is what the undo stack snapshots — so every
/// chart payload has to be undoable like any cell edit. This pins that down for
/// all four of them, since nothing else would catch a chart edit quietly
/// falling outside the history.
#[test]
fn chart_edits_are_undoable() {
    let buf = std::fs::read("../../tests/graph.xlsx").unwrap();
    let mut wb = Workbook::from_file(&buf, "graph".to_string()).unwrap();
    let chart_id = {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let c = ws.get_charts();
        assert_eq!(c[0].chart_type, "col");
        assert_eq!(c[0].title, None);
        c[0].chart_id.clone()
    };
    let charts = |wb: &Workbook| wb.get_sheet_by_idx(0).unwrap().get_charts();

    // --- reconfigure -------------------------------------------------
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::UpdateChart(UpdateChart {
            sheet_idx: 0,
            chart_id: chart_id.clone(),
            chart_type: Some("line".to_string()),
            title: Some("Edited".to_string()),
            ..Default::default()
        })],
        undoable: true,
        init: false,
    }));
    assert_eq!(charts(&wb)[0].chart_type, "line");

    wb.handle_action(EditAction::Undo);
    let c = charts(&wb);
    assert_eq!(c[0].chart_type, "col", "undo restores the chart type");
    assert_eq!(c[0].title, None, "undo restores the title");

    wb.handle_action(EditAction::Redo);
    let c = charts(&wb);
    assert_eq!(c[0].chart_type, "line", "redo re-applies it");
    assert_eq!(c[0].title.as_deref(), Some("Edited"));

    // --- move --------------------------------------------------------
    let (from_row, from_col) = (charts(&wb)[0].from_row, charts(&wb)[0].from_col);
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::MoveChart(MoveChart {
            sheet_idx: 0,
            chart_id: chart_id.clone(),
            from_row: from_row + 5,
            from_col: from_col + 2,
            from_col_off: 0,
            from_row_off: 0,
            to_row: from_row + 20,
            to_col: from_col + 10,
            to_col_off: 0,
            to_row_off: 0,
        })],
        undoable: true,
        init: false,
    }));
    assert_eq!(charts(&wb)[0].from_row, from_row + 5);
    wb.handle_action(EditAction::Undo);
    assert_eq!(
        (charts(&wb)[0].from_row, charts(&wb)[0].from_col),
        (from_row, from_col),
        "undo restores the anchor"
    );

    // --- delete ------------------------------------------------------
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::DeleteChart(DeleteChart {
            sheet_idx: 0,
            chart_id: chart_id.clone(),
        })],
        undoable: true,
        init: false,
    }));
    assert!(charts(&wb).is_empty());
    wb.handle_action(EditAction::Undo);
    let c = charts(&wb);
    assert_eq!(c.len(), 1, "undo brings the chart back");
    assert_eq!(c[0].chart_id, chart_id);
    assert_eq!(c[0].series.len(), 3, "with its data intact");
    assert!(c[0].series[0].color.is_some(), "and its styling");

    // --- create ------------------------------------------------------
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CreateChart(CreateChart {
            sheet_idx: 0,
            chart_id: "chartUndo".to_string(),
            chart_type: "pie".to_string(),
            from_row: 20,
            from_col: 1,
            from_col_off: 0,
            from_row_off: 0,
            to_row: 30,
            to_col: 8,
            to_col_off: 0,
            to_row_off: 0,
            title: None,
            categories_ref: None,
            series: vec![CreateChartSeries {
                name: None,
                value_ref: "Sheet1!$B$2:$E$2".to_string(),
                color: None,
                size_ref: None,
                series_type: None,
            }],
            block_source: None,
        })],
        undoable: true,
        init: false,
    }));
    assert_eq!(charts(&wb).len(), 2);
    wb.handle_action(EditAction::Undo);
    assert_eq!(charts(&wb).len(), 1, "undo removes the created chart");
    wb.handle_action(EditAction::Redo);
    assert_eq!(charts(&wb).len(), 2, "redo brings it back");
}

#[test]
fn create_bubble_chart_with_live_sizes() {
    // A bubble chart's third dimension goes through the same live-value path
    // as the Y values: editing a size cell must move the bubble.
    let mut wb = Workbook::default();
    let cells = [
        (0usize, 0usize, "10"), // x
        (1, 0, "20"),
        (0, 1, "5"), // y
        (1, 1, "8"),
        (0, 2, "100"), // size
        (1, 2, "400"),
    ];
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: cells
            .iter()
            .map(|(r, c, v)| {
                EditPayload::CellInput(CellInput {
                    sheet_idx: 0,
                    row: *r,
                    col: *c,
                    content: v.to_string(),
                })
            })
            .collect(),
        undoable: true,
        init: false,
    }));

    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CreateChart(CreateChart {
            sheet_idx: 0,
            chart_id: "bubble1".to_string(),
            chart_type: "bubble".to_string(),
            from_row: 4,
            from_col: 0,
            from_col_off: 0,
            from_row_off: 0,
            to_row: 18,
            to_col: 8,
            to_col_off: 0,
            to_row_off: 0,
            title: Some("Bubbles".to_string()),
            categories_ref: Some("Sheet1!$A$1:$A$2".to_string()),
            series: vec![CreateChartSeries {
                name: Some("Products".to_string()),
                value_ref: "Sheet1!$B$1:$B$2".to_string(),
                color: None,
                size_ref: Some("Sheet1!$C$1:$C$2".to_string()),
                series_type: None,
            }],
            block_source: None,
        })],
        undoable: true,
        init: false,
    }));

    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let c = &ws.get_charts()[0];
        assert_eq!(c.chart_type, "bubble");
        assert_eq!(c.series[0].values, vec![Some(5.0), Some(8.0)]);
        assert_eq!(c.series[0].sizes, vec![Some(100.0), Some(400.0)]);
        assert_eq!(c.series[0].size_ref.as_deref(), Some("Sheet1!$C$1:$C$2"));
    }

    // Sizes are live.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 0,
            col: 2,
            content: "900".to_string(),
        })],
        undoable: true,
        init: false,
    }));
    assert_eq!(
        wb.get_sheet_by_idx(0).unwrap().get_charts()[0].series[0].sizes[0],
        Some(900.0)
    );

    // And they survive save/reload.
    let bytes = wb.save().unwrap();
    let wb2 = Workbook::from_file(&bytes, "r".to_string()).unwrap();
    let c = &wb2.get_sheet_by_idx(0).unwrap().get_charts()[0];
    assert_eq!(c.chart_type, "bubble");
    assert_eq!(c.series[0].sizes, vec![Some(900.0), Some(400.0)]);
}

#[test]
fn switch_a_chart_to_radar_and_bubble() {
    let buf = std::fs::read("../../tests/graph.xlsx").unwrap();
    let mut wb = Workbook::from_file(&buf, "graph".to_string()).unwrap();
    let chart_id = wb.get_sheet_by_idx(0).unwrap().get_charts()[0]
        .chart_id
        .clone();

    let switch = |wb: &mut Workbook, ty: &str| {
        wb.handle_action(EditAction::Payloads(PayloadsAction {
            payloads: vec![EditPayload::UpdateChart(UpdateChart {
                sheet_idx: 0,
                chart_id: chart_id.clone(),
                chart_type: Some(ty.to_string()),
                ..Default::default()
            })],
            undoable: true,
            init: false,
        }));
    };

    switch(&mut wb, "radar");
    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let c = &ws.get_charts()[0];
        assert_eq!(c.chart_type, "radar");
        assert_eq!(c.series.len(), 3, "series survive the switch");
        assert_eq!(
            c.series[0].values,
            vec![Some(11.0), Some(13.0), Some(15.0), Some(24.0)]
        );
        assert!(c.series[0].color.is_some(), "colors survive");
    }

    switch(&mut wb, "bubble");
    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let c = &ws.get_charts()[0];
        assert_eq!(c.chart_type, "bubble");
        // No size reference was ever set, so bubbles have no third dimension —
        // the chart is still valid, the renderer just uses a default size.
        assert!(c.series[0].sizes.is_empty());
    }

    // Both kinds survive a save/reload.
    let bytes = wb.save().unwrap();
    let wb2 = Workbook::from_file(&bytes, "r".to_string()).unwrap();
    assert_eq!(
        wb2.get_sheet_by_idx(0).unwrap().get_charts()[0].chart_type,
        "bubble"
    );
}

#[test]
fn create_stock_of_pie_and_surface_charts() {
    // The three kinds differ in shape, not just in name: stock's series are
    // the price components, of-pie carries a split, and a surface needs three
    // axes. Each has to survive creation, a save and a reload.
    let mut wb = Workbook::default();
    let mut payloads: Vec<EditPayload> = vec![];
    for row in 0..4usize {
        for col in 0..4usize {
            payloads.push(EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row,
                col,
                content: ((row + 1) * 10 + col).to_string(),
            }));
        }
    }
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads,
        undoable: true,
        init: false,
    }));

    let make = |wb: &mut Workbook, id: &str, ty: &str, series: Vec<CreateChartSeries>| {
        wb.handle_action(EditAction::Payloads(PayloadsAction {
            payloads: vec![EditPayload::CreateChart(CreateChart {
                sheet_idx: 0,
                chart_id: id.to_string(),
                chart_type: ty.to_string(),
                from_row: 6,
                from_col: 0,
                from_col_off: 0,
                from_row_off: 0,
                to_row: 20,
                to_col: 8,
                to_col_off: 0,
                to_row_off: 0,
                title: None,
                categories_ref: Some("Sheet1!$A$1:$A$4".to_string()),
                series,
                block_source: None,
            })],
            undoable: true,
            init: false,
        }));
    };
    let ser = |name: &str, col: char| CreateChartSeries {
        name: Some(name.to_string()),
        value_ref: format!("Sheet1!${}$1:${}$4", col, col),
        color: None,
        size_ref: None,
        series_type: None,
    };

    make(
        &mut wb,
        "stock1",
        "stock",
        vec![
            ser("Open", 'A'),
            ser("High", 'B'),
            ser("Low", 'C'),
            ser("Close", 'D'),
        ],
    );
    make(&mut wb, "ofpie1", "ofPie", vec![ser("Share", 'B')]);
    make(
        &mut wb,
        "surf1",
        "surface",
        vec![ser("r1", 'B'), ser("r2", 'C'), ser("r3", 'D')],
    );

    let check = |wb: &Workbook| {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let charts = ws.get_charts();
        let by = |id: &str| {
            charts
                .iter()
                .find(|c| c.chart_id == id)
                .unwrap_or_else(|| {
                    panic!(
                        "{} missing, have {:?}",
                        id,
                        charts.iter().map(|c| &c.chart_id).collect::<Vec<_>>()
                    )
                })
                .clone()
        };
        let stock = by("stock1");
        assert_eq!(stock.chart_type, "stock");
        assert_eq!(stock.series.len(), 4, "all four price series");
        assert_eq!(stock.series[3].name.as_deref(), Some("Close"));
        // Values are live like any other chart's.
        assert_eq!(stock.series[0].values[0], Some(10.0));

        let of_pie = by("ofpie1");
        assert_eq!(of_pie.chart_type, "ofPie");
        assert_eq!(of_pie.series.len(), 1, "of-pie plots one series");

        let surface = by("surf1");
        assert_eq!(surface.chart_type, "surface");
        assert_eq!(surface.series.len(), 3, "one series per grid row");
    };
    check(&wb);

    let bytes = wb.save().unwrap();
    let wb2 = Workbook::from_file(&bytes, "reloaded".to_string()).unwrap();
    check(&wb2);
}

#[test]
fn update_chart_sets_the_of_pie_split() {
    use crate::edit_action::OfPieSplitUpdate;
    let mut wb = Workbook::default();
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: (0..6usize)
            .map(|r| {
                EditPayload::CellInput(CellInput {
                    sheet_idx: 0,
                    row: r,
                    col: 0,
                    content: (10 - r).to_string(),
                })
            })
            .collect(),
        undoable: true,
        init: false,
    }));
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CreateChart(CreateChart {
            sheet_idx: 0,
            chart_id: "op".to_string(),
            chart_type: "ofPie".to_string(),
            from_row: 8,
            from_col: 0,
            from_col_off: 0,
            from_row_off: 0,
            to_row: 20,
            to_col: 8,
            to_col_off: 0,
            to_row_off: 0,
            title: None,
            categories_ref: None,
            series: vec![CreateChartSeries {
                name: None,
                value_ref: "Sheet1!$A$1:$A$6".to_string(),
                color: None,
                size_ref: None,
                series_type: None,
            }],
            block_source: None,
        })],
        undoable: true,
        init: false,
    }));

    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::UpdateChart(UpdateChart {
            sheet_idx: 0,
            chart_id: "op".to_string(),
            of_pie_split: Some(OfPieSplitUpdate {
                by: Some("pos".to_string()),
                pos: Some(2.0),
                // Out of Excel's 5..=200 range, so it must be dropped.
                second_size: Some(500.0),
            }),
            ..Default::default()
        })],
        undoable: true,
        init: false,
    }));

    let check = |wb: &Workbook| {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let c = &ws.get_charts()[0];
        assert_eq!(c.of_pie_split.by.as_deref(), Some("pos"));
        assert_eq!(c.of_pie_split.pos, Some(2.0));
        assert_eq!(
            c.of_pie_split.second_size, None,
            "out-of-range size dropped"
        );
    };
    check(&wb);

    let bytes = wb.save().unwrap();
    check(&Workbook::from_file(&bytes, "r".to_string()).unwrap());

    // And switching to a kind with no split leaves the chart valid.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::UpdateChart(UpdateChart {
            sheet_idx: 0,
            chart_id: "op".to_string(),
            chart_type: Some("surface".to_string()),
            ..Default::default()
        })],
        undoable: true,
        init: false,
    }));
    let ws = wb.get_sheet_by_idx(0).unwrap();
    assert_eq!(ws.get_charts()[0].chart_type, "surface");
}

#[test]
fn create_a_combo_chart_and_keep_it_through_edits() {
    // A combo chart is one whose series disagree about their kind. The whole
    // point is that an edit elsewhere must not collapse it back to one kind.
    let mut wb = Workbook::default();
    let mut payloads: Vec<EditPayload> = vec![];
    for row in 0..4usize {
        for (col, base) in [(0usize, 100), (1, 20), (2, 3)] {
            payloads.push(EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row,
                col,
                content: (base + row).to_string(),
            }));
        }
    }
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads,
        undoable: true,
        init: false,
    }));

    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CreateChart(CreateChart {
            sheet_idx: 0,
            chart_id: "combo".to_string(),
            chart_type: "col".to_string(),
            from_row: 6,
            from_col: 0,
            from_col_off: 0,
            from_row_off: 0,
            to_row: 20,
            to_col: 8,
            to_col_off: 0,
            to_row_off: 0,
            title: None,
            categories_ref: None,
            series: vec![
                CreateChartSeries {
                    name: Some("Revenue".to_string()),
                    value_ref: "Sheet1!$A$1:$A$4".to_string(),
                    color: None,
                    size_ref: None,
                    series_type: None,
                },
                CreateChartSeries {
                    name: Some("Margin".to_string()),
                    value_ref: "Sheet1!$B$1:$B$4".to_string(),
                    color: None,
                    size_ref: None,
                    series_type: Some("line".to_string()),
                },
                CreateChartSeries {
                    name: Some("Churn".to_string()),
                    value_ref: "Sheet1!$C$1:$C$4".to_string(),
                    color: None,
                    size_ref: None,
                    series_type: Some("area".to_string()),
                },
            ],
            block_source: None,
        })],
        undoable: true,
        init: false,
    }));

    let check = |wb: &Workbook, note: &str| {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let c = &ws.get_charts()[0];
        assert_eq!(c.chart_type, "col", "{}", note);
        assert_eq!(c.series.len(), 3, "{}", note);
        assert_eq!(c.series[0].series_type, None, "{}: follows the chart", note);
        assert_eq!(
            c.series[1].series_type.as_deref(),
            Some("line"),
            "{}: line override",
            note
        );
        assert_eq!(
            c.series[2].series_type.as_deref(),
            Some("area"),
            "{}: area override",
            note
        );
        // Values stay live in every group.
        assert_eq!(c.series[1].values[0], Some(20.0), "{}", note);
    };
    check(&wb, "after create");

    // An unrelated edit regenerates the XML — the overrides must survive it.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::UpdateChart(UpdateChart {
            sheet_idx: 0,
            chart_id: "combo".to_string(),
            title: Some("Combo".to_string()),
            ..Default::default()
        })],
        undoable: true,
        init: false,
    }));
    check(&wb, "after an unrelated edit");

    // So must a save/reload.
    let bytes = wb.save().unwrap();
    let wb2 = Workbook::from_file(&bytes, "reloaded".to_string()).unwrap();
    check(&wb2, "after reload");

    // Re-pointing a series without restating its kind keeps the override.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::UpdateChart(UpdateChart {
            sheet_idx: 0,
            chart_id: "combo".to_string(),
            series: Some(vec![
                CreateChartSeries {
                    name: Some("Revenue".to_string()),
                    value_ref: "Sheet1!$A$1:$A$4".to_string(),
                    color: None,
                    size_ref: None,
                    series_type: None,
                },
                CreateChartSeries {
                    name: Some("Margin".to_string()),
                    // A different range, same kind.
                    value_ref: "Sheet1!$B$2:$B$4".to_string(),
                    color: None,
                    size_ref: None,
                    series_type: None,
                },
            ]),
            ..Default::default()
        })],
        undoable: true,
        init: false,
    }));
    let ws = wb.get_sheet_by_idx(0).unwrap();
    let c = &ws.get_charts()[0];
    assert_eq!(c.series.len(), 2);
    assert_eq!(
        c.series[1].series_type.as_deref(),
        Some("line"),
        "the slot's kind is kept when the caller does not restate it"
    );
    assert_eq!(c.series[1].val_ref.as_deref(), Some("Sheet1!$B$2:$B$4"));
}

#[test]
fn three_d_chart_types_round_trip_through_the_api() {
    let mut wb = Workbook::default();
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: (0..4usize)
            .map(|r| {
                EditPayload::CellInput(CellInput {
                    sheet_idx: 0,
                    row: r,
                    col: 0,
                    content: ((r + 1) * 5).to_string(),
                })
            })
            .collect(),
        undoable: true,
        init: false,
    }));

    for (i, ty) in ["col3d", "bar3d", "line3d", "area3d", "pie3d"]
        .iter()
        .enumerate()
    {
        wb.handle_action(EditAction::Payloads(PayloadsAction {
            payloads: vec![EditPayload::CreateChart(CreateChart {
                sheet_idx: 0,
                chart_id: format!("c3d{}", i),
                chart_type: ty.to_string(),
                from_row: 6 + i * 2,
                from_col: 0,
                from_col_off: 0,
                from_row_off: 0,
                to_row: 20 + i * 2,
                to_col: 8,
                to_col_off: 0,
                to_row_off: 0,
                title: None,
                categories_ref: None,
                series: vec![CreateChartSeries {
                    name: Some(ty.to_string()),
                    value_ref: "Sheet1!$A$1:$A$4".to_string(),
                    color: None,
                    size_ref: None,
                    series_type: None,
                }],
                block_source: None,
            })],
            undoable: true,
            init: false,
        }));
    }

    let bytes = wb.save().unwrap();
    let wb2 = Workbook::from_file(&bytes, "reloaded".to_string()).unwrap();
    let ws = wb2.get_sheet_by_idx(0).unwrap();
    let charts = ws.get_charts();
    assert_eq!(charts.len(), 5);
    let mut kinds: Vec<&str> = charts.iter().map(|c| c.chart_type.as_str()).collect();
    kinds.sort_unstable();
    assert_eq!(kinds, ["area3d", "bar3d", "col3d", "line3d", "pie3d"]);
    // Values are live in the 3-D forms too.
    assert_eq!(
        charts[0].series[0].values,
        vec![Some(5.0), Some(10.0), Some(15.0), Some(20.0)]
    );
}

/// A chart bound to a block plots the block, not a snapshot of where it was:
/// records appended to it appear without the chart being touched, and edits
/// elsewhere on the sheet cannot leave it pointing at the wrong cells.
#[test]
fn chart_bound_to_block_follows_it() {
    use crate::edit_action::{
        BindFormSchema, ChartBlockSource, CreateBlock, InsertRows, InsertRowsInBlock,
    };

    let mut wb = Workbook::default();
    let bid = wb.get_available_block_id(0).unwrap();
    let cell = |row: usize, col: usize, content: &str| {
        EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row,
            col,
            content: content.to_string(),
        })
    };

    // A 3x3 block at B2 with a row schema: name / qty / price, one record a row.
    // The header that named the fields is *outside* the block, so every row of
    // the block is a record.
    let mut payloads = vec![
        EditPayload::CreateBlock(CreateBlock {
            sheet_idx: 0,
            id: bid,
            master_row: 1,
            master_col: 1,
            row_cnt: 3,
            col_cnt: 3,
            owner: None,
            modify_policy: None,
            permissions: None,
            description: None,
        }),
        EditPayload::BindFormSchema(BindFormSchema {
            ref_name: "sales".into(),
            sheet_idx: 0,
            block_id: bid,
            field_from: 0,
            key_idx: 0,
            fields: vec!["name".into(), "qty".into(), "price".into()],
            render_ids: vec!["r0".into(), "r1".into(), "r2".into()],
            row: true,
            field_formulas: vec![],
            validation_formulas: vec![],
            editability_formulas: vec![],
        }),
    ];
    for (i, (name, qty)) in [("a", "10"), ("b", "20"), ("c", "30")].iter().enumerate() {
        payloads.push(cell(1 + i, 1, name));
        payloads.push(cell(1 + i, 2, qty));
    }
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads,
        undoable: false,
        init: false,
    }));

    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CreateChart(CreateChart {
            sheet_idx: 0,
            chart_id: "chart1".to_string(),
            chart_type: "col".to_string(),
            from_row: 6,
            from_col: 1,
            from_col_off: 0,
            from_row_off: 0,
            to_row: 16,
            to_col: 6,
            to_col_off: 0,
            to_row_off: 0,
            title: Some("Sales".to_string()),
            // Named fields, not ranges: the block says where they are.
            categories_ref: None,
            series: vec![],
            block_source: Some(ChartBlockSource {
                block_id: bid,
                category_field: Some("name".to_string()),
                value_fields: vec!["qty".to_string()],
            }),
        })],
        undoable: true,
        init: false,
    }));

    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let c = &ws.get_charts()[0];
        assert_eq!(c.cat_ref.as_deref(), Some("Sheet1!$B$2:$B$4"));
        assert_eq!(c.series.len(), 1);
        assert_eq!(c.series[0].name.as_deref(), Some("qty"));
        assert_eq!(c.series[0].val_ref.as_deref(), Some("Sheet1!$C$2:$C$4"));
        assert_eq!(c.series[0].values, vec![Some(10.0), Some(20.0), Some(30.0)]);
        assert_eq!(c.categories, vec!["a", "b", "c"]);
    }

    // Append a record. Nothing touches the chart.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::InsertRowsInBlock(InsertRowsInBlock {
                sheet_idx: 0,
                block_id: bid,
                start: 3,
                cnt: 1,
            }),
            cell(4, 1, "d"),
            cell(4, 2, "40"),
        ],
        undoable: false,
        init: false,
    }));
    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let c = &ws.get_charts()[0];
        assert_eq!(
            c.series[0].val_ref.as_deref(),
            Some("Sheet1!$C$2:$C$5"),
            "the range grew with the block"
        );
        assert_eq!(
            c.series[0].values,
            vec![Some(10.0), Some(20.0), Some(30.0), Some(40.0)]
        );
        assert_eq!(c.categories, vec!["a", "b", "c", "d"]);
    }

    // A row inserted above the block pushes it down. A stored A1 ref would now
    // be a row short of the data; a bound one is recomputed and still right.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::InsertRows(InsertRows {
            sheet_idx: 0,
            start: 0,
            count: 1,
        })],
        undoable: false,
        init: false,
    }));
    {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let c = &ws.get_charts()[0];
        assert_eq!(
            c.series[0].val_ref.as_deref(),
            Some("Sheet1!$C$3:$C$6"),
            "the range shifted with the block"
        );
        assert_eq!(
            c.series[0].values,
            vec![Some(10.0), Some(20.0), Some(30.0), Some(40.0)]
        );
    }
}

/// The binding survives a save: the xlsx carries real A1 ranges so Excel can
/// draw the chart, and logisheets.xml carries what they were derived from, so
/// reopening here leaves the chart still following the block.
#[test]
fn block_bound_chart_survives_save() {
    use crate::edit_action::{BindFormSchema, ChartBlockSource, CreateBlock, InsertRowsInBlock};

    let mut wb = Workbook::default();
    let bid = wb.get_available_block_id(0).unwrap();
    let cell = |row: usize, col: usize, content: &str| {
        EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row,
            col,
            content: content.to_string(),
        })
    };
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 0,
                id: bid,
                master_row: 0,
                master_col: 0,
                row_cnt: 2,
                col_cnt: 2,
                owner: None,
                modify_policy: None,
                permissions: None,
                description: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "rec".into(),
                sheet_idx: 0,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec!["name".into(), "qty".into()],
                render_ids: vec!["r0".into(), "r1".into()],
                row: true,
                field_formulas: vec![],
                validation_formulas: vec![],
                editability_formulas: vec![],
            }),
            cell(0, 0, "a"),
            cell(0, 1, "10"),
            cell(1, 0, "b"),
            cell(1, 1, "20"),
            EditPayload::CreateChart(CreateChart {
                sheet_idx: 0,
                chart_id: "chart1".to_string(),
                chart_type: "col".to_string(),
                from_row: 5,
                from_col: 0,
                from_col_off: 0,
                from_row_off: 0,
                to_row: 15,
                to_col: 5,
                to_col_off: 0,
                to_row_off: 0,
                title: None,
                categories_ref: None,
                series: vec![],
                block_source: Some(ChartBlockSource {
                    block_id: bid,
                    category_field: Some("name".to_string()),
                    value_fields: vec!["qty".to_string()],
                }),
            }),
        ],
        undoable: false,
        init: false,
    }));

    let bytes = wb.save().unwrap();
    let mut wb2 = Workbook::from_file(&bytes, "reloaded".to_string()).unwrap();
    {
        let ws = wb2.get_sheet_by_idx(0).unwrap();
        let c = &ws.get_charts()[0];
        assert_eq!(c.series[0].val_ref.as_deref(), Some("Sheet1!$B$1:$B$2"));
        assert_eq!(c.series[0].values, vec![Some(10.0), Some(20.0)]);
    }
    // Still bound, not frozen: growing the reloaded block grows the chart.
    let bid2 = {
        let ws = wb2.get_sheet_by_idx(0).unwrap();
        ws.get_all_blocks()[0].block_id
    };
    wb2.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::InsertRowsInBlock(InsertRowsInBlock {
                sheet_idx: 0,
                block_id: bid2,
                start: 2,
                cnt: 1,
            }),
            cell(2, 0, "c"),
            cell(2, 1, "30"),
        ],
        undoable: false,
        init: false,
    }));
    let ws = wb2.get_sheet_by_idx(0).unwrap();
    let c = &ws.get_charts()[0];
    assert_eq!(
        c.series[0].val_ref.as_deref(),
        Some("Sheet1!$B$1:$B$3"),
        "the reloaded chart is still bound to the block"
    );
    assert_eq!(c.series[0].values, vec![Some(10.0), Some(20.0), Some(30.0)]);
}

/// A cell's displayed value and `ROUND` must agree about the same number.
/// Before, the display path rounded on the exact double (JavaScript's rule,
/// inherited from the `ssf` port) while `ROUND` scaled by a power of ten, so
/// the two could disagree — and the money formats disagreed with `0.00`.
#[test]
fn text_and_round_agree_at_excel_precision() {
    let mut wb = Workbook::default();
    let cases = [
        ("=TEXT(1.005,\"0.00\")", "1.01"),
        ("=TEXT(1.005,\"#,##0.00\")", "1.01"),
        ("=TEXT(4.935,\"0.00\")", "4.94"),
        ("=TEXT(2.675,\"#,##0.00\")", "2.68"),
        ("=FIXED(1.005,2)", "1.01"),
        ("=DOLLAR(1.005,2)", "$1.01"),
        ("=TEXT(ROUND(1.005,2),\"0.00\")", "1.01"),
    ];
    let mut payloads = vec![];
    for (i, (e, _)) in cases.iter().enumerate() {
        payloads.push(EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: i,
            col: 0,
            content: e.to_string(),
        }));
    }
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads,
        undoable: false,
        init: false,
    }));
    let ws = wb.get_sheet_by_idx(0).unwrap();
    for (i, (e, want)) in cases.iter().enumerate() {
        // `Value` has no `PartialEq`, and a formatted cell is a string anyway.
        let got = match ws.get_value(i, 0).unwrap() {
            crate::controller::display::Value::Str(s) => s,
            other => panic!("{e} did not render as text: {other:?}"),
        };
        assert_eq!(got, *want, "{e}");
    }
}

/// Block metadata is undoable like anything else. It lives on `BlockPlace`,
/// which is inside `Status`, and every undoable action snapshots the whole
/// `Status` — but that is a property of where the field was put, so it is
/// worth a test rather than an assumption.
#[test]
fn block_description_and_permissions_are_undoable() {
    use crate::edit_action::{
        BlockOp, BlockPermissions, ModifyPolicy, SetBlockDescription, SetBlockPermissions,
    };

    let mut wb = Workbook::default();
    let bid = wb.get_available_block_id(0).unwrap();
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CreateBlock(CreateBlock {
            sheet_idx: 0,
            id: bid,
            master_row: 0,
            master_col: 0,
            row_cnt: 2,
            col_cnt: 2,
            owner: Some("craft-a".to_string()),
            modify_policy: None,
            permissions: None,
            description: Some("first".to_string()),
        })],
        undoable: true,
        init: false,
    }));
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::SetBlockDescription(SetBlockDescription {
                sheet_idx: 0,
                block_id: bid,
                description: "second".to_string(),
            }),
            EditPayload::SetBlockPermissions(SetBlockPermissions {
                sheet_idx: 0,
                block_id: bid,
                permissions: BlockPermissions {
                    insert_delete_lines: Some(ModifyPolicy::OwnerOnly),
                    ..Default::default()
                },
                modify_policy: None,
            }),
        ],
        undoable: true,
        init: false,
    }));

    let state = |wb: &Workbook| {
        let m = wb.get_block_modify_info(0, bid).unwrap();
        (
            m.description.clone(),
            m.permissions.explicit(BlockOp::InsertDeleteLines),
        )
    };
    assert_eq!(
        state(&wb),
        ("second".to_string(), Some(ModifyPolicy::OwnerOnly))
    );
    wb.handle_action(EditAction::Undo);
    assert_eq!(
        state(&wb),
        ("first".to_string(), None),
        "undo restores both the description and the permissions"
    );
    wb.handle_action(EditAction::Redo);
    assert_eq!(
        state(&wb),
        ("second".to_string(), Some(ModifyPolicy::OwnerOnly)),
        "and redo puts them back"
    );
}

/// A chart's data range rides along with row and column edits, like every
/// other thing the engine anchors. It used to hold the file's A1 text and
/// nothing rewrote it, so inserting a row above the data left the chart
/// pointing at cells that had moved — and it rendered blank.
#[test]
fn plain_chart_follows_row_and_column_edits() {
    use crate::edit_action::{InsertCols, InsertRows};

    let buf = std::fs::read("../../tests/graph.xlsx").unwrap();
    let mut wb = Workbook::from_file(&buf, "graph".to_string()).unwrap();
    let read = |wb: &Workbook| {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let c = &ws.get_charts()[0];
        (
            c.series[0].val_ref.clone(),
            c.series[0].values.clone(),
            c.cat_ref.clone(),
        )
    };
    let (ref0, values0, cat0) = read(&wb);
    assert_eq!(ref0.as_deref(), Some("Sheet1!$B$2:$E$2"));
    assert_eq!(
        values0,
        vec![Some(11.0), Some(13.0), Some(15.0), Some(24.0)]
    );

    // A row inserted above the data pushes it down one.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::InsertRows(InsertRows {
            sheet_idx: 0,
            start: 0,
            count: 1,
        })],
        undoable: true,
        init: false,
    }));
    let (ref1, values1, _) = read(&wb);
    assert_eq!(
        ref1.as_deref(),
        Some("Sheet1!$B$3:$E$3"),
        "the range moved with its cells"
    );
    assert_eq!(values1, values0, "and reads the same numbers");

    // A column inserted to the left does the same sideways.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::InsertCols(InsertCols {
            sheet_idx: 0,
            start: 0,
            count: 1,
        })],
        undoable: true,
        init: false,
    }));
    let (ref2, values2, _) = read(&wb);
    assert_eq!(ref2.as_deref(), Some("Sheet1!$C$3:$F$3"));
    assert_eq!(values2, values0);

    // Undo restores the ranges too, since they are part of the snapshot.
    wb.handle_action(EditAction::Undo);
    wb.handle_action(EditAction::Undo);
    let (ref3, values3, cat3) = read(&wb);
    assert_eq!(ref3, ref0, "undo puts the range back");
    assert_eq!(values3, values0);
    assert_eq!(cat3, cat0);
}

/// The moved range has to reach the file too, or the fix would live only in
/// memory and the saved workbook would still point at the old cells.
#[test]
fn a_moved_chart_range_survives_a_save() {
    use crate::edit_action::InsertRows;

    let buf = std::fs::read("../../tests/graph.xlsx").unwrap();
    let mut wb = Workbook::from_file(&buf, "graph".to_string()).unwrap();
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::InsertRows(InsertRows {
            sheet_idx: 0,
            start: 0,
            count: 1,
        })],
        undoable: false,
        init: false,
    }));

    let bytes = wb.save().unwrap();
    let wb2 = Workbook::from_file(&bytes, "reloaded".to_string()).unwrap();
    let ws = wb2.get_sheet_by_idx(0).unwrap();
    let c = &ws.get_charts()[0];
    assert_eq!(
        c.series[0].val_ref.as_deref(),
        Some("Sheet1!$B$3:$E$3"),
        "the file carries where the cells ended up"
    );
    assert_eq!(
        c.series[0].values,
        vec![Some(11.0), Some(13.0), Some(15.0), Some(24.0)]
    );
}
