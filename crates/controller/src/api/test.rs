use crate::edit_action::{
    AddComment, AuthorInput, CellInput, CommentMention, CreateBlock, CreateChart,
    CreateChartSeries, CreateDiyCell, DeleteCellImage, DeleteChart, DeleteComment, EditComment,
    EditPayload, LineStyleUpdate, ModifyPolicy, MoveChart, PayloadsAction, RemoveDiyCell,
    ResolveComment, SchemaFieldSpec, SetCellImage, SheetRename, StyleUpdateType, UpdateChart,
    WorkbookUpdateType,
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
            analyzes: None,
            pivot: None,
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
            analyzes: None,
            pivot: None,
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
                analyzes: None,
                pivot: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "rec".into(),
                sheet_idx: 0,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec![SchemaFieldSpec::new("v", "r0")],
                row: true,
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
                analyzes: None,
                pivot: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "rec".into(),
                sheet_idx: 0,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec![
                    SchemaFieldSpec::new("v", "r0")
                        .with_validation_formula(Some("#PLACEHOLDER>100".into()))
                        .with_editability_formula(Some("#PLACEHOLDER>100".into())),
                ],
                row: true,
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

// A field with a value formula owns every cell in its column. The grid's write
// path is `CellInput` (not `BlockInput`), and it used to sail straight through:
// the container wrote the typed value and the formula executor then REMOVED the
// materialized formula, so one keystroke permanently un-computed that row. The
// column is supposed to be read-only to people; assert every user-facing write
// payload leaves it exactly as the schema left it.
#[test]
fn a_templated_field_refuses_every_user_write() {
    use crate::controller::display::Value;
    use crate::edit_action::{BindFormSchema, CellClear, CellInput};

    let mut wb = Workbook::default();
    let bid = wb.get_available_block_id(0).unwrap();

    // 2x2 block at A1. Field 0 ("qty") is free-form and doubles as the key;
    // field 1 ("total") is derived: total = qty * 2.
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
                analyzes: None,
                pivot: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "rec".into(),
                sheet_idx: 0,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec![
                    SchemaFieldSpec::new("qty", "r0"),
                    SchemaFieldSpec::new("total", "r1")
                        .with_value_formula(Some("=#FIELD(\"qty\")*2".into())),
                ],
                row: true,
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 0,
                content: "10".to_string(),
            }),
        ],
        undoable: false,
        init: false,
    }));

    let total =
        |wb: &Workbook| -> Value { wb.get_sheet_by_idx(0).unwrap().get_value(0, 1).unwrap() };
    let formula =
        |wb: &Workbook| -> String { wb.get_sheet_by_idx(0).unwrap().get_formula(0, 1).unwrap() };

    assert!(
        matches!(total(&wb), Value::Number(n) if n == 20.0),
        "the template should have computed 10*2, got {:?}",
        total(&wb)
    );
    let materialized = formula(&wb);
    assert!(
        !materialized.is_empty(),
        "the templated cell should carry a real formula"
    );

    // Every one of these is a person interacting with the grid.
    for (label, payload) in [
        (
            "a plain value",
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 1,
                content: "999".to_string(),
            }),
        ),
        (
            "a literal formula",
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 1,
                content: "=42".to_string(),
            }),
        ),
        (
            "a clear",
            EditPayload::CellClear(CellClear {
                sheet_idx: 0,
                row: 0,
                col: 1,
            }),
        ),
    ] {
        wb.handle_action(EditAction::Payloads(PayloadsAction {
            payloads: vec![payload],
            undoable: false,
            init: false,
        }));
        assert!(
            matches!(total(&wb), Value::Number(n) if n == 20.0),
            "{label} must not change a templated cell's value, got {:?}",
            total(&wb)
        );
        assert_eq!(
            formula(&wb),
            materialized,
            "{label} must leave the field's formula on the cell"
        );
    }

    // And the column still tracks its input: the formula is live, not a
    // frozen leftover that merely survived the writes above.
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 0,
            col: 0,
            content: "7".to_string(),
        })],
        undoable: false,
        init: false,
    }));
    assert!(
        matches!(total(&wb), Value::Number(n) if n == 14.0),
        "the field formula should still recompute from its input, got {:?}",
        total(&wb)
    );
}

// `BlockOp::OverrideValidation` asks the host to gate a write BEFORE it lands,
// so the engine has to be able to judge a value the cell does not hold yet.
// The check runs the field's live validation shadow against the proposed value
// and must leave nothing behind — a question that quietly edits the workbook is
// worse than no question at all.
#[test]
fn a_proposed_value_is_judged_without_touching_the_workbook() {
    use crate::controller::display::Value;
    use crate::edit_action::{BindFormSchema, CellInput};

    let mut wb = Workbook::default();
    let bid = wb.get_available_block_id(0).unwrap();

    // 2x2 block at A1: key in col 0, `qty` in col 1 validated as > 0.
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
                analyzes: None,
                pivot: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "rec".into(),
                sheet_idx: 0,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec![
                    SchemaFieldSpec::new("key", "r0"),
                    SchemaFieldSpec::new("qty", "r1")
                        .with_validation_formula(Some("#PLACEHOLDER>0".into())),
                ],
                row: true,
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 1,
                content: "5".to_string(),
            }),
        ],
        undoable: false,
        init: false,
    }));

    let read =
        |wb: &Workbook| -> Value { wb.get_sheet_by_idx(0).unwrap().get_value(0, 1).unwrap() };
    assert!(
        matches!(read(&wb), Value::Number(n) if n == 5.0),
        "sanity: the cell should hold the value that was written"
    );

    let ok = wb.check_field_validation(0, 0, 1, "7".to_string()).unwrap();
    assert!(ok.has_rule, "the field carries a validation rule");
    assert!(!ok.violates, "7 > 0 passes the rule");
    assert_eq!(ok.rule, "#PLACEHOLDER>0");

    let bad = wb
        .check_field_validation(0, 0, 1, "-3".to_string())
        .unwrap();
    assert!(bad.violates, "-3 fails `#PLACEHOLDER>0`");

    // Neither call may have moved anything: not the cell it asked about, and
    // not the verdict the marker is currently showing.
    assert!(
        matches!(read(&wb), Value::Number(n) if n == 5.0),
        "checking a proposed value must leave the cell holding its own value, got {:?}",
        read(&wb)
    );

    // A field with no rule, and a cell outside any block, both answer
    // "nothing to check" rather than failing.
    let keyless = wb
        .check_field_validation(0, 0, 0, "anything".to_string())
        .unwrap();
    assert!(!keyless.has_rule, "the key field declares no validation");
    let outside = wb
        .check_field_validation(0, 9, 9, "anything".to_string())
        .unwrap();
    assert!(!outside.has_rule, "a cell outside every block has no rule");
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
                analyzes: None,
                pivot: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "rec".into(),
                sheet_idx: 0,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec![SchemaFieldSpec::new("v", "r0")],
                row: true,
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
            analyzes: None,
            pivot: None,
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
        analyzes: None,
        pivot: None,
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
                analyzes: None,
                pivot: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "rec".into(),
                sheet_idx: 1,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec![SchemaFieldSpec::new("v", "r0")],
                row: true,
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
                analyzes: None,
                pivot: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "rec".into(),
                sheet_idx: 0,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec![SchemaFieldSpec::new("v", "r0")],
                row: true,
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
                analyzes: None,
                pivot: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "rec".into(),
                sheet_idx: 0,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec![SchemaFieldSpec::new("v", "r0")],
                row: true,
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
            analyzes: None,
            pivot: None,
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
                analyzes: None,
                pivot: None,
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
            analyzes: None,
            pivot: None,
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
                analyzes: None,
                pivot: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "people".into(),
                sheet_idx: 0,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec![
                    SchemaFieldSpec::new("name", "r_name"),
                    SchemaFieldSpec::new("age", "r_age"),
                ],
                row: true,
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
                    analyzes: None,
                    pivot: None,
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
                analyzes: None,
                pivot: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "people".into(),
                sheet_idx: 0,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec![SchemaFieldSpec::new("Customer Status", "r0")],
                row: true,
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
                analyzes: None,
                pivot: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "people".into(),
                sheet_idx: 0,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec![
                    SchemaFieldSpec::new("name", "r_name"),
                    SchemaFieldSpec::new("age", "r_age"),
                ],
                row: true,
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
            analyzes: None,
            pivot: None,
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
                analyzes: None,
                pivot: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "rec".into(),
                sheet_idx: 0,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec![
                    SchemaFieldSpec::new("year", "r0"),
                    SchemaFieldSpec::new("amount", "r1"),
                ],
                row: true,
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
                analyzes: None,
                pivot: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "rec".into(),
                sheet_idx: 0,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec![
                    SchemaFieldSpec::new("id", "r0"),
                    SchemaFieldSpec::new("qty", "r1"),
                ],
                row: true,
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
            analyzes: None,
            pivot: None,
        }),
        EditPayload::BindFormSchema(BindFormSchema {
            ref_name: "sales".into(),
            sheet_idx: 0,
            block_id: bid,
            field_from: 0,
            key_idx: 0,
            fields: vec![
                SchemaFieldSpec::new("name", "r0"),
                SchemaFieldSpec::new("qty", "r1"),
                SchemaFieldSpec::new("price", "r2"),
            ],
            row: true,
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
                analyzes: None,
                pivot: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "rec".into(),
                sheet_idx: 0,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec![
                    SchemaFieldSpec::new("name", "r0"),
                    SchemaFieldSpec::new("qty", "r1"),
                ],
                row: true,
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
            analyzes: None,
            pivot: None,
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

// ---------------------------------------------------------------------------
// Block row-key uniqueness
//
// `(block, key, field)` is how a block addresses a cell: BLOCKREF scans the key
// column and takes the FIRST match. A repeated key therefore raises nothing —
// one record just becomes unreachable and every aggregate counts the reachable
// one twice. The tool layer refused duplicates at two doors; the engine has to
// refuse them at all of them.
// ---------------------------------------------------------------------------

/// A 3x2 block at A1 bound as `rec` (key column + an `amt` field), with the
/// three row keys seeded. Returns the workbook ready to be written into.
#[cfg(test)]
fn block_with_keys(keys: [&str; 3]) -> (Workbook, logisheets_base::BlockId) {
    use crate::edit_action::BindFormSchema;

    let mut wb = Workbook::default();
    let bid = wb.get_available_block_id(0).unwrap();
    let mut payloads = vec![
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
            analyzes: None,
            pivot: None,
        }),
        EditPayload::BindFormSchema(BindFormSchema {
            ref_name: "rec".into(),
            sheet_idx: 0,
            block_id: bid,
            field_from: 0,
            key_idx: 0,
            fields: vec![
                SchemaFieldSpec::new("key", "r0"),
                SchemaFieldSpec::new("amt", "r1"),
            ],
            row: true,
        }),
    ];
    for (row, key) in keys.iter().enumerate() {
        payloads.push(EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row,
            col: 0,
            content: key.to_string(),
        }));
    }
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads,
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "setup should succeed: {:?}",
        effect.error_message
    );
    (wb, bid)
}

#[cfg(test)]
fn key_at(wb: &Workbook, row: usize) -> String {
    use crate::controller::display::Value;
    match wb.get_sheet_by_idx(0).unwrap().get_value(row, 0).unwrap() {
        Value::Str(s) => s,
        Value::Number(n) => n.to_string(),
        Value::Empty => String::new(),
        other => panic!("unexpected key value {:?}", other),
    }
}

#[test]
fn a_write_that_repeats_a_row_key_is_refused() {
    let (mut wb, _bid) = block_with_keys(["a", "b", "c"]);

    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 1,
            col: 0,
            content: "a".to_string(),
        })],
        undoable: true,
        init: false,
    }));

    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Err(_)),
        "renaming row 1's key to \"a\" collides with row 0 and must be refused"
    );
    let msg = effect.error_message.unwrap_or_default();
    assert!(
        msg.contains("rec") && msg.contains('a'),
        "the refusal should name the block and the key, got {:?}",
        msg
    );
    assert_eq!(
        key_at(&wb, 1),
        "b",
        "a refused transaction must leave the key untouched"
    );
}

#[test]
fn a_repeated_key_inside_one_transaction_is_refused() {
    // Both writes land in the same transaction, so neither is a collision with
    // "what was already there" — the guard has to judge the finished state.
    let (mut wb, _bid) = block_with_keys(["a", "b", "c"]);

    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 1,
                col: 0,
                content: "x".to_string(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 2,
                col: 0,
                content: "x".to_string(),
            }),
        ],
        undoable: true,
        init: false,
    }));

    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Err(_)),
        "two records given the same key in one transaction must be refused"
    );
    assert_eq!(key_at(&wb, 1), "b", "neither write may have landed");
    assert_eq!(key_at(&wb, 2), "c", "neither write may have landed");
}

#[test]
fn two_records_may_swap_keys_in_one_transaction() {
    // Judged per-write, the first half of a swap always looks like a
    // collision. Judging the transaction's end state is what makes this legal.
    let (mut wb, _bid) = block_with_keys(["a", "b", "c"]);

    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 0,
                content: "b".to_string(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 1,
                col: 0,
                content: "a".to_string(),
            }),
        ],
        undoable: true,
        init: false,
    }));

    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "swapping two keys leaves them unique: {:?}",
        effect.error_message
    );
    assert_eq!(key_at(&wb, 0), "b");
    assert_eq!(key_at(&wb, 1), "a");
}

#[test]
fn empty_keys_are_not_duplicates_of_each_other() {
    // Inserting rows mints blank key cells; if blanks collided, the ordinary
    // insert-then-fill sequence could never get off the ground.
    use crate::edit_action::InsertRowsInBlock;

    let (mut wb, bid) = block_with_keys(["a", "b", "c"]);
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::InsertRowsInBlock(InsertRowsInBlock {
            sheet_idx: 0,
            block_id: bid,
            start: 3,
            cnt: 2,
        })],
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "two blank key cells are not a collision: {:?}",
        effect.error_message
    );
    assert_eq!(key_at(&wb, 3), "");
    assert_eq!(key_at(&wb, 4), "");
}

#[test]
fn rewriting_a_key_with_its_own_value_is_not_a_collision() {
    let (mut wb, _bid) = block_with_keys(["a", "b", "c"]);

    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 1,
            col: 0,
            content: "b".to_string(),
        })],
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "a key colliding only with itself is fine: {:?}",
        effect.error_message
    );
}

/// Plant duplicate keys the only way that is still possible: write the column
/// in one transaction, name it the key column in the next. Declaring the key
/// column over values written in the SAME transaction is itself refused, since
/// the guard reads the finished state.
#[cfg(test)]
fn block_with_legacy_duplicates() -> (Workbook, logisheets_base::BlockId) {
    use crate::edit_action::BindFormSchema;

    let mut wb = Workbook::default();
    let bid = wb.get_available_block_id(0).unwrap();
    let mut payloads = vec![EditPayload::CreateBlock(CreateBlock {
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
        analyzes: None,
        pivot: None,
    })];
    // Rows 0 and 2 share "dup"; row 1 is unique; row 3 is left blank.
    for (row, key) in [(0usize, "dup"), (1, "solo"), (2, "dup")] {
        payloads.push(EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row,
            col: 0,
            content: key.to_string(),
        }));
    }
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads,
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "writing two equal values into a column that is not yet a key column \
         is nobody's collision: {:?}",
        effect.error_message
    );

    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::BindFormSchema(BindFormSchema {
            ref_name: "rec".into(),
            sheet_idx: 0,
            block_id: bid,
            field_from: 0,
            key_idx: 0,
            fields: vec![
                SchemaFieldSpec::new("key", "r0"),
                SchemaFieldSpec::new("amt", "r1"),
            ],
            row: true,
        })],
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "binding a schema writes no cells, so it has nothing for the guard to \
         judge: {:?}",
        effect.error_message
    );
    (wb, bid)
}

#[test]
fn a_block_that_already_has_duplicates_stays_editable() {
    // A workbook can arrive with duplicates — from an .xlsx written elsewhere,
    // or from before this guard existed. Refusing every later write to such a
    // block would lock out the very edits that repair it, so the guard only
    // judges the keys THIS transaction wrote.
    let (mut wb, _bid) = block_with_legacy_duplicates();

    // Writing an unrelated field must not be punished for a collision it did
    // not cause.
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 0,
            col: 1,
            content: "10".to_string(),
        })],
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "a non-key write into a block with pre-existing duplicates must still \
         land: {:?}",
        effect.error_message
    );

    // And the repair — giving one of the two rows a distinct key — must be
    // allowed even though the block is dirty when the write starts.
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 2,
            col: 0,
            content: "other".to_string(),
        })],
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "repairing a duplicate must be allowed: {:?}",
        effect.error_message
    );
    assert_eq!(key_at(&wb, 2), "other");
}

#[test]
fn duplicate_block_keys_reports_what_the_guard_could_not_refuse() {
    // A block can hold duplicates the write-path guard never saw: written
    // before the column was named a key column here, arriving from an .xlsx in
    // the field. Nothing surfaces them on its own — BLOCKREF resolves the first
    // match and stays quiet — so this is the only way anyone finds out.
    let (mut wb, bid) = block_with_legacy_duplicates();

    let dups = wb.duplicate_block_keys();
    assert_eq!(
        dups.len(),
        1,
        "one repeated key — \"solo\" is unique and the blank row is exempt, got {:?}",
        dups
    );
    let d = &dups[0];
    assert_eq!(d.block_name, "rec");
    assert_eq!(d.sheet_idx, 0);
    assert_eq!(d.block_id, bid);
    assert_eq!(d.key, "dup");
    assert_eq!(
        d.records,
        vec![0, 2],
        "both records holding the key, in block order"
    );

    // Repairing one of them empties the report — the same read that raised the
    // problem has to be able to say it is gone.
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 2,
            col: 0,
            content: "other".to_string(),
        })],
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "the repair must be allowed: {:?}",
        effect.error_message
    );
    assert!(
        wb.duplicate_block_keys().is_empty(),
        "after the repair there is nothing left to report"
    );
}

// ---------------------------------------------------------------------------
// Stage 0 evidence: what a BLOCKREFS whose field name no longer exists does.
//
// The host composes a `unique` constraint into a field's validation rule as
// `COUNTIF(BLOCKREFSB(sheet, block, "*", "fieldName"), #PLACEHOLDER) = 1`
// (src/components/block-composer/index.tsx). The field name lives there as the
// fourth argument — a runtime string, resolved at evaluation rather than at
// parse time — so renaming the field leaves the rule parseable and pointing at
// a name nothing answers to.
//
// This pins what happens then, because that decides whether the user sees
// nothing at all or sees the whole column light up. See
// design/block-field-semantics.md §2.4.
// ---------------------------------------------------------------------------

#[test]
fn a_blockrefs_naming_a_field_that_does_not_exist_matches_nothing() {
    use crate::controller::display::Value;
    use crate::edit_action::BindFormSchema;

    let mut wb = Workbook::default();
    let bid = wb.get_available_block_id(0).unwrap();

    // 3x2 block at A1 bound as `rec`: keys a/b/c down column 0, `amt` 1/2/3
    // down column 1.
    let mut payloads = vec![
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
            analyzes: None,
            pivot: None,
        }),
        EditPayload::BindFormSchema(BindFormSchema {
            ref_name: "rec".into(),
            sheet_idx: 0,
            block_id: bid,
            field_from: 0,
            key_idx: 0,
            fields: vec![
                SchemaFieldSpec::new("key", "r0"),
                SchemaFieldSpec::new("amt", "r1"),
            ],
            row: true,
        }),
    ];
    for (row, key, amt) in [(0usize, "a", "1"), (1, "b", "2"), (2, "c", "3")] {
        payloads.push(EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row,
            col: 0,
            content: key.to_string(),
        }));
        payloads.push(EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row,
            col: 1,
            content: amt.to_string(),
        }));
    }
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads,
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "setup should succeed: {:?}",
        effect.error_message
    );

    let sheet_id = wb
        .controller
        .status
        .sheet_info_manager
        .get_sheet_id(0)
        .unwrap();

    // E1 counts through the field that exists, E2 through one that does not,
    // and E3 is the shape the composed `unique` rule actually takes.
    let formulas = [
        (
            0usize,
            format!(r#"=COUNTIF(BLOCKREFSB({sheet_id}, {bid}, "*", "amt"), 2)"#),
        ),
        (
            1,
            format!(r#"=COUNTIF(BLOCKREFSB({sheet_id}, {bid}, "*", "nope"), 2)"#),
        ),
        (
            2,
            format!(r#"=COUNTIF(BLOCKREFSB({sheet_id}, {bid}, "*", "nope"), 2) = 1"#),
        ),
    ];
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: formulas
            .iter()
            .map(|(row, f)| {
                EditPayload::CellInput(CellInput {
                    sheet_idx: 0,
                    row: *row,
                    col: 4,
                    content: f.clone(),
                })
            })
            .collect(),
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "the formulas should be accepted: {:?}",
        effect.error_message
    );

    let read = |wb: &Workbook, row: usize| -> Value {
        wb.get_sheet_by_idx(0).unwrap().get_value(row, 4).unwrap()
    };

    assert!(
        matches!(read(&wb, 0), Value::Number(n) if n == 1.0),
        "sanity: through a field that exists, the value 2 is found once, got {:?}",
        read(&wb, 0)
    );

    // The point of the test. A field name nothing answers to is not an error —
    // the field filter simply matches no column, the matrix comes back with no
    // values in it, and COUNTIF counts zero.
    assert!(
        matches!(read(&wb, 1), Value::Number(n) if n == 0.0),
        "a BLOCKREFS naming a field that does not exist must match nothing \
         rather than raise, got {:?}",
        read(&wb, 1)
    );

    // So the composed `unique` rule reads FALSE — for every row, forever. After
    // a field rename the whole column shows a validation warning, and the
    // engine's `overrideValidation` gate treats every write to it as violating.
    assert!(
        matches!(read(&wb, 2), Value::Bool(false)),
        "`COUNTIF(...) = 1` over a dead field name evaluates FALSE, which is \
         what a renamed unique field leaves behind, got {:?}",
        read(&wb, 2)
    );
}

// ---------------------------------------------------------------------------
// Stage 2: the engine derives the rule from the declaration.
//
// `required` had no formula form at all before this, so a required-but-empty
// cell raised no marker and was invisible to `list_violations` and to an agent.
// `unique` and enum membership were host-composed strings, so they meant
// nothing in a headless host — and a composed string cannot be regenerated,
// which is how renaming a unique field left a rule naming a dead field.
//
// See design/block-field-semantics.md §5, stage 2.
// ---------------------------------------------------------------------------

/// A 3-row block whose `amt` field carries the given declaration, plus the
/// author's own rule. Returns the workbook and the block id.
#[cfg(test)]
fn block_with_declared_field(
    required: bool,
    unique: bool,
    field_type: Option<crate::block_manager::schema_manager::field_type::FieldType>,
    own_rule: Option<&str>,
) -> (Workbook, logisheets_base::BlockId) {
    use crate::edit_action::BindFormSchema;

    let mut wb = Workbook::default();
    let bid = wb.get_available_block_id(0).unwrap();
    let mut spec = SchemaFieldSpec::new("amt", "r1")
        .with_required(required)
        .with_unique(unique)
        .with_validation_formula(own_rule.map(|s| s.to_string()));
    if let Some(t) = field_type {
        spec = spec.with_field_type(t);
    }
    let mut payloads = vec![
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
            analyzes: None,
            pivot: None,
        }),
        EditPayload::BindFormSchema(BindFormSchema {
            ref_name: "rec".into(),
            sheet_idx: 0,
            block_id: bid,
            field_from: 0,
            key_idx: 0,
            fields: vec![SchemaFieldSpec::new("key", "r0"), spec],
            row: true,
        }),
    ];
    // Keys matter: the derived `unique` rule counts through
    // `BLOCKREFSB(…, "*", …)`, whose key filter matches the KEY column's
    // values. A block with a blank key column matches no records at all, so
    // the count would be zero for every value and the rule would read FALSE
    // everywhere — which says nothing about uniqueness.
    for row in 0..3 {
        payloads.push(EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row,
            col: 0,
            content: format!("k{row}"),
        }));
    }
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads,
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "setup should succeed: {:?}",
        effect.error_message
    );
    (wb, bid)
}

/// Write into the `amt` column of the block built above.
#[cfg(test)]
fn write_amts(wb: &mut Workbook, values: &[&str]) {
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: values
            .iter()
            .enumerate()
            .filter(|(_, v)| !v.is_empty())
            .map(|(row, v)| {
                EditPayload::CellInput(CellInput {
                    sheet_idx: 0,
                    row,
                    col: 1,
                    content: v.to_string(),
                })
            })
            .collect(),
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "the writes should land: {:?}",
        effect.error_message
    );
}

/// Whether the validation shadow on (`row`, `amt`) currently reads as a
/// violation. `None` when the field carries no rule at all.
#[cfg(test)]
fn amt_violates(wb: &mut Workbook, row: usize) -> Option<bool> {
    use crate::controller::display::Value;
    use crate::sid_assigner::ShadowKind;

    use logisheets_base::CellId;

    let scid = wb
        .get_shadow_cell_id(0, row, 1, ShadowKind::Validation)
        .ok()?;
    let CellId::EphemeralCell(eid) = scid.cell_id else {
        return None;
    };
    let info = wb.get_shadow_info_by_id(eid).ok()?;
    match info.value {
        Value::Bool(b) => Some(!b),
        // An error counts as a violation: a rule nobody can evaluate is not a
        // rule anybody has met.
        Value::Error(_) => Some(true),
        _ => None,
    }
}

#[test]
fn required_now_has_a_formula_form_and_flags_the_empty_cell() {
    // Before this, `required` lived only in the host's own field store with no
    // formula behind it — nothing rendered a marker, nothing reached
    // list_violations, and an agent could not see it at all.
    let (mut wb, _bid) = block_with_declared_field(true, false, None, None);
    write_amts(&mut wb, &["5", "", "7"]);

    assert_eq!(amt_violates(&mut wb, 0), Some(false), "5 is present");
    assert_eq!(
        amt_violates(&mut wb, 1),
        Some(true),
        "a required field left empty is a violation"
    );
    assert_eq!(amt_violates(&mut wb, 2), Some(false), "7 is present");
}

#[test]
fn unique_is_derived_and_exempts_the_empty_cell() {
    let (mut wb, _bid) = block_with_declared_field(false, true, None, None);
    write_amts(&mut wb, &["5", "5", ""]);

    assert_eq!(amt_violates(&mut wb, 0), Some(true), "5 appears twice");
    assert_eq!(amt_violates(&mut wb, 1), Some(true), "5 appears twice");
    assert_eq!(
        amt_violates(&mut wb, 2),
        Some(false),
        "unique without required must still allow a blank"
    );
}

#[test]
fn a_field_declaring_nothing_gets_no_rule_at_all() {
    let (mut wb, _bid) = block_with_declared_field(false, false, None, None);
    write_amts(&mut wb, &["5", "5", ""]);
    assert_eq!(
        amt_violates(&mut wb, 0),
        None,
        "no declaration and no author rule means no shadow to read"
    );
}

#[test]
fn an_enum_whitelist_is_derived_from_the_workbooks_own_set() {
    use crate::edit_action::{EnumVariantSpec, UpsertEnumSet};

    let mut wb = Workbook::default();
    let bid = wb.get_available_block_id(0).unwrap();
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::UpsertEnumSet(UpsertEnumSet {
                id: "status".into(),
                name: None,
                variants: vec![
                    EnumVariantSpec {
                        id: "open".into(),
                        label: None,
                    },
                    EnumVariantSpec {
                        id: "done".into(),
                        label: None,
                    },
                ],
            }),
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
                analyzes: None,
                pivot: None,
            }),
            EditPayload::BindFormSchema(crate::edit_action::BindFormSchema {
                ref_name: "rec".into(),
                sheet_idx: 0,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec![
                    SchemaFieldSpec::new("key", "r0"),
                    SchemaFieldSpec::new("amt", "r1").with_field_type(
                        crate::block_manager::schema_manager::field_type::FieldType::Enum {
                            set_id: "status".into(),
                        },
                    ),
                ],
                row: true,
            }),
        ],
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "setup should succeed: {:?}",
        effect.error_message
    );

    // No whitelist formula was written anywhere: the rule comes from the set.
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: (0..3)
            .map(|row| {
                EditPayload::CellInput(CellInput {
                    sheet_idx: 0,
                    row,
                    col: 0,
                    content: format!("k{row}"),
                })
            })
            .collect(),
        undoable: true,
        init: false,
    }));
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));
    write_amts(&mut wb, &["open", "OPEN", "nope"]);
    assert_eq!(amt_violates(&mut wb, 0), Some(false), "an option");
    assert_eq!(
        amt_violates(&mut wb, 1),
        Some(true),
        "membership is case-sensitive — variant ids are what cells store"
    );
    assert_eq!(amt_violates(&mut wb, 2), Some(true), "not an option");
}

#[test]
fn the_authors_own_rule_is_kept_and_anded_with_the_derived_ones() {
    let (mut wb, _bid) = block_with_declared_field(true, false, None, Some("#PLACEHOLDER<100"));
    write_amts(&mut wb, &["5", "", "500"]);

    assert_eq!(
        amt_violates(&mut wb, 0),
        Some(false),
        "present and under 100"
    );
    assert_eq!(
        amt_violates(&mut wb, 1),
        Some(true),
        "the derived required check still applies"
    );
    assert_eq!(
        amt_violates(&mut wb, 2),
        Some(true),
        "the author's own rule still applies"
    );
}

#[test]
fn the_derived_rule_survives_a_field_rename_because_it_is_regenerated() {
    // The whole point of deriving rather than baking in. The host used to
    // compose `COUNTIF(BLOCKREFSB(…, "amt"), …)` and store it, and a rename
    // left that string naming a field the block no longer had — FALSE for
    // every record, forever. Now the rule is rebuilt from the current name.
    use crate::edit_action::BindFormSchema;

    let (mut wb, bid) = block_with_declared_field(false, true, None, None);
    write_amts(&mut wb, &["5", "6", "7"]);
    assert_eq!(
        amt_violates(&mut wb, 0),
        Some(false),
        "sanity: all distinct"
    );

    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::BindFormSchema(BindFormSchema {
            ref_name: "rec".into(),
            sheet_idx: 0,
            block_id: bid,
            field_from: 0,
            key_idx: 0,
            fields: vec![
                SchemaFieldSpec::new("key", "r0"),
                // Same renderId, new name — exactly what rename_field sends.
                SchemaFieldSpec::new("amount", "r1").with_unique(true),
            ],
            row: true,
        })],
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "the rename should succeed: {:?}",
        effect.error_message
    );

    assert_eq!(
        amt_violates(&mut wb, 0),
        Some(false),
        "the unique check still passes after the rename — it names the new field"
    );

    // And it still catches a real duplicate, so it did not merely stop working.
    write_amts(&mut wb, &["6", "6", "7"]);
    assert_eq!(amt_violates(&mut wb, 0), Some(true), "6 now appears twice");
}

// ---------------------------------------------------------------------------
// Field-level and block-level write policy: declared in the engine.
//
// `userEditable` was a tri-state boolean on the host's own field store — the
// last field-level rule a headless host could not see. The payload-to-operation
// mapping and "does this block state a policy at all" were re-implemented in
// the app, so the same payload could be governed differently in different
// hosts. All three are the engine's answers now.
//
// The engine DECLARES and answers; it does not enforce. It does not know who is
// writing — the host does, so the host decides with these in hand. See
// design/block-field-semantics.md.
// ---------------------------------------------------------------------------

#[test]
fn a_fields_write_policy_is_declared_on_the_schema_and_survives_a_round_trip() {
    use crate::block_manager::schema_manager::field_type::FieldWritePolicy;
    use crate::edit_action::BindFormSchema;

    let mut wb = Workbook::default();
    let bid = wb.get_available_block_id(0).unwrap();
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 0,
                id: bid,
                master_row: 0,
                master_col: 0,
                row_cnt: 2,
                col_cnt: 3,
                owner: None,
                modify_policy: None,
                permissions: None,
                description: None,
                analyzes: None,
                pivot: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "rec".into(),
                sheet_idx: 0,
                block_id: bid,
                field_from: 0,
                key_idx: 0,
                fields: vec![
                    SchemaFieldSpec::new("key", "r0")
                        .with_write_policy(FieldWritePolicy::OwnerOnly),
                    SchemaFieldSpec::new("note", "r1").with_write_policy(FieldWritePolicy::Anyone),
                    // Says nothing — inherits the block's own rules.
                    SchemaFieldSpec::new("amt", "r2"),
                ],
                row: true,
            }),
        ],
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "setup should succeed: {:?}",
        effect.error_message
    );

    let read = |wb: &Workbook| -> Vec<(String, String)> {
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let blocks = ws.get_all_blocks();
        let schema = blocks[0].schema.as_ref().unwrap();
        let mut fields = schema.fields.clone();
        fields.sort_by_key(|f| f.idx);
        fields
            .iter()
            .map(|f| (f.field.clone(), f.write_policy.clone()))
            .collect()
    };

    assert_eq!(
        read(&wb),
        vec![
            ("key".to_string(), "ownerOnly".to_string()),
            ("note".to_string(), "anyone".to_string()),
            // Always reported, so a reader never has to guess what an absent
            // value meant.
            ("amt".to_string(), "inherit".to_string()),
        ]
    );

    // It has to survive the file, or it is no better than the host store it
    // replaced.
    let saved = wb.save().unwrap();
    let reopened = Workbook::from_file(&saved, "again".to_string()).unwrap();
    assert_eq!(read(&reopened), read(&wb));
}

#[test]
fn the_engine_says_which_operation_a_payload_counts_as() {
    // One table, in the thing that defines the operations. Each host keeping
    // its own is how the same payload comes to be governed differently.
    let wb = Workbook::default();
    let table = wb.get_block_op_for_payloads();
    let lookup = |t: &str| {
        table
            .iter()
            .find(|e| e.payload_type == t)
            .map(|e| e.op.as_wire_str())
    };

    assert_eq!(lookup("cellInput"), Some("cellInput"));
    assert_eq!(lookup("blockInput"), Some("cellInput"));
    assert_eq!(lookup("removeBlock"), Some("removeBlock"));
    assert_eq!(lookup("insertRowsInBlock"), Some("insertDeleteLines"));
    assert_eq!(lookup("reorderBlockLines"), Some("sortByField"));
    assert_eq!(lookup("setBlockDescription"), Some("modifyDescription"));
    // Handing the policies over is itself a schema change — otherwise anyone
    // could unlock a block by asking to.
    assert_eq!(lookup("setBlockPermissions"), Some("modifySchema"));
    // Not something a block singles out. Not unguarded either: the caller falls
    // back to its owner check.
    assert_eq!(lookup("moveBlock"), None);
    assert_eq!(lookup("createSheet"), None);
}

#[test]
fn a_block_reports_whether_it_states_a_policy_at_all() {
    use crate::edit_action::{BlockOp, BlockPermissions, ModifyPolicy, SetBlockPermissions};

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
            // An owner but no policy — the case that matters. Reading the
            // unstated policy as "anyone" would make this block LESS protected
            // than it was before the engine knew about policies, so a host has
            // to be able to tell "nobody said" from "anyone may".
            owner: Some("some-craft".to_string()),
            modify_policy: None,
            permissions: None,
            description: None,
            analyzes: None,
            pivot: None,
        })],
        undoable: true,
        init: false,
    }));

    let policies = wb.get_block_op_policies(0, bid).unwrap();
    assert_eq!(
        policies.len(),
        BlockOp::ALL.len(),
        "every operation is reported, in a fixed order"
    );
    assert!(
        policies.iter().all(|p| p.policy == "all" && !p.stated),
        "an owner with no policy states nothing: {:?}",
        policies
    );

    // Now it says something about one operation, and only that one changes.
    let mut perms = BlockPermissions::default();
    perms.set(BlockOp::CellInput, Some(ModifyPolicy::OwnerOnly));
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::SetBlockPermissions(SetBlockPermissions {
            sheet_idx: 0,
            block_id: bid,
            permissions: perms,
            modify_policy: None,
        })],
        undoable: true,
        init: false,
    }));

    let policies = wb.get_block_op_policies(0, bid).unwrap();
    let cell_input = policies
        .iter()
        .find(|p| matches!(p.op, BlockOp::CellInput))
        .unwrap();
    assert_eq!(cell_input.policy, "ownerOnly");
    assert!(cell_input.stated);
    assert!(
        policies
            .iter()
            .filter(|p| !matches!(p.op, BlockOp::CellInput))
            .all(|p| !p.stated),
        "the other operations still say nothing"
    );
}

// ---------------------------------------------------------------------------
// Analysis blocks.
//
// An analysis block is an ordinary block that declares which block it analyses;
// its fields declare how they aggregate it, and the engine generates the
// formula from those declarations rather than storing one.
//
// The whole point of it being a SEPARATE block is that every row of every block
// stays a record — so an agent reading the sheet sees a table and its analysis,
// cannot mistake a total for a record, and can address the total by key. See
// design/block-analysis.md.
// ---------------------------------------------------------------------------

/// `orders` (3 records, `amt` 10/20/30) plus a one-row block below it declaring
/// `analyzes: orders` and a `SUM(amt)` field. Returns (workbook, source, analysis).
#[cfg(test)]
fn orders_with_analysis(
    func: crate::block_manager::schema_manager::field_type::AggFunc,
) -> (Workbook, logisheets_base::BlockId, logisheets_base::BlockId) {
    use crate::edit_action::BindFormSchema;

    let mut wb = Workbook::default();
    let src = wb.get_available_block_id(0).unwrap();
    let mut payloads = vec![
        EditPayload::CreateBlock(CreateBlock {
            sheet_idx: 0,
            id: src,
            master_row: 0,
            master_col: 0,
            row_cnt: 3,
            col_cnt: 2,
            owner: None,
            modify_policy: None,
            permissions: None,
            description: None,
            analyzes: None,
            pivot: None,
        }),
        EditPayload::BindFormSchema(BindFormSchema {
            ref_name: "orders".into(),
            sheet_idx: 0,
            block_id: src,
            field_from: 0,
            key_idx: 0,
            fields: vec![
                SchemaFieldSpec::new("key", "s0"),
                SchemaFieldSpec::new("amt", "s1"),
            ],
            row: true,
        }),
    ];
    for (row, amt) in [(0usize, "10"), (1, "20"), (2, "30")] {
        payloads.push(EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row,
            col: 0,
            content: format!("k{row}"),
        }));
        payloads.push(EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row,
            col: 1,
            content: amt.to_string(),
        }));
    }
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads,
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "source setup should succeed: {:?}",
        effect.error_message
    );

    let analysis = wb.get_available_block_id(0).unwrap();
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 0,
                id: analysis,
                master_row: 3,
                master_col: 0,
                row_cnt: 1,
                col_cnt: 2,
                owner: None,
                modify_policy: None,
                permissions: None,
                description: None,
                // Declared as the block is made, so it is never briefly a
                // stray table that a reader would take for records.
                analyzes: Some(src),
                pivot: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "orders_analysis".into(),
                sheet_idx: 0,
                block_id: analysis,
                field_from: 0,
                key_idx: 0,
                fields: vec![
                    // The label column declares no aggregate, so it stays an
                    // ordinary cell — and it is the key the result is
                    // addressed by.
                    SchemaFieldSpec::new("key", "a0"),
                    // No value formula is sent. The engine generates it.
                    SchemaFieldSpec::new("amt", "a1").with_aggregate(func, "amt"),
                ],
                row: true,
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 3,
                col: 0,
                content: "TOTAL".to_string(),
            }),
        ],
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "analysis setup should succeed: {:?}",
        effect.error_message
    );
    (wb, src, analysis)
}

#[cfg(test)]
fn cell_num(wb: &Workbook, row: usize, col: usize) -> Option<f64> {
    use crate::controller::display::Value;
    match wb.get_sheet_by_idx(0).unwrap().get_value(row, col).unwrap() {
        Value::Number(n) => Some(n),
        _ => None,
    }
}

#[test]
fn an_analysis_field_computes_from_its_declaration_with_no_formula_sent() {
    use crate::block_manager::schema_manager::field_type::AggFunc;

    let (mut wb, _src, _analysis) = orders_with_analysis(AggFunc::Sum);
    assert_eq!(cell_num(&wb, 3, 1), Some(60.0), "10+20+30");

    // It tracks an edit to the source.
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 1,
            col: 1,
            content: "99".to_string(),
        })],
        undoable: true,
        init: false,
    }));
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));
    assert_eq!(cell_num(&wb, 3, 1), Some(139.0), "10+99+30");
}

#[test]
fn the_total_does_not_count_itself() {
    // The reason a separate block is the design: the analysis is not a record
    // of the source, so `BLOCKREFS` over the source cannot reach it. An
    // in-block summary row would have had to be carved out of the record set
    // to get this, and every reader would have had to remember.
    use crate::block_manager::schema_manager::field_type::AggFunc;

    let (wb, _src, _analysis) = orders_with_analysis(AggFunc::Sum);
    assert_eq!(
        cell_num(&wb, 3, 1),
        Some(60.0),
        "60, not 120 — the total is outside the set it sums"
    );
}

#[test]
fn every_declared_function_computes() {
    use crate::block_manager::schema_manager::field_type::AggFunc;

    for (func, expected) in [
        (AggFunc::Sum, 60.0),
        (AggFunc::Count, 3.0),
        (AggFunc::Average, 20.0),
        (AggFunc::Min, 10.0),
        (AggFunc::Max, 30.0),
    ] {
        let (wb, _src, _analysis) = orders_with_analysis(func);
        assert_eq!(
            cell_num(&wb, 3, 1),
            Some(expected),
            "{} over 10/20/30",
            func.as_str()
        );
    }
}

#[test]
fn the_analysis_tracks_the_source_growing() {
    // Why the generated formula goes through BLOCKREFS rather than a resolved
    // cell range: the dependency is on the whole source block, so a new record
    // is picked up with nothing rewritten.
    use crate::block_manager::schema_manager::field_type::AggFunc;
    use crate::edit_action::{InsertRows, InsertRowsInBlock};

    let (mut wb, src, _analysis) = orders_with_analysis(AggFunc::Sum);
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            // Room first, or the block would grow into the analysis below it.
            EditPayload::InsertRows(InsertRows {
                sheet_idx: 0,
                start: 3,
                count: 1,
            }),
            EditPayload::InsertRowsInBlock(InsertRowsInBlock {
                sheet_idx: 0,
                block_id: src,
                start: 3,
                cnt: 1,
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 3,
                col: 0,
                content: "k3".to_string(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 3,
                col: 1,
                content: "1".to_string(),
            }),
        ],
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "growing the source should succeed: {:?}",
        effect.error_message
    );

    // The analysis was pushed down a row by the sheet insert, and picked the
    // new record up.
    assert_eq!(cell_num(&wb, 4, 1), Some(61.0), "10+20+30+1");
}

#[test]
fn the_label_column_stays_an_ordinary_cell() {
    // Which is why the aggregate is declared per FIELD rather than per block:
    // the label is the key the result is addressed by, and a person has to be
    // able to type it.
    use crate::block_manager::schema_manager::field_type::AggFunc;
    use crate::controller::display::Value;

    let (wb, _src, _analysis) = orders_with_analysis(AggFunc::Sum);
    assert!(
        matches!(
            wb.get_sheet_by_idx(0).unwrap().get_value(3, 0).unwrap(),
            Value::Str(s) if s == "TOTAL"
        ),
        "the label the transaction wrote is still there"
    );
}

#[test]
fn the_result_is_addressable_by_key_from_elsewhere() {
    // The capability an in-block summary row could not have had: the total has
    // a key, so anything else can reference it — which is what an agent needs
    // in order to USE a total rather than merely see it.
    use crate::block_manager::schema_manager::field_type::AggFunc;

    let (mut wb, _src, _analysis) = orders_with_analysis(AggFunc::Sum);
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 0,
            col: 5,
            content: r#"=BLOCKREF("orders_analysis", "TOTAL", "amt") * 2"#.to_string(),
        })],
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "referencing the analysis should succeed: {:?}",
        effect.error_message
    );
    assert_eq!(cell_num(&wb, 0, 5), Some(120.0), "60 * 2");
}

#[test]
fn a_block_may_not_analyse_itself() {
    // Its cells would aggregate a set they belong to — the cycle the separate
    // block design exists to avoid.
    use crate::edit_action::SetBlockAnalyzes;

    let (mut wb, src, _analysis) =
        orders_with_analysis(crate::block_manager::schema_manager::field_type::AggFunc::Sum);
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::SetBlockAnalyzes(SetBlockAnalyzes {
            sheet_idx: 0,
            block_id: src,
            analyzes: Some(src),
            pivot: None,
        })],
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Err(_)),
        "a self-analysis must be refused"
    );
    assert!(
        effect
            .error_message
            .unwrap_or_default()
            .contains("cannot analyse itself")
    );
}

#[test]
fn analysing_a_block_that_does_not_exist_is_refused() {
    // A marker pointing at nothing would make every field read empty with no
    // way for a reader to see why.
    use crate::edit_action::SetBlockAnalyzes;

    let (mut wb, _src, analysis) =
        orders_with_analysis(crate::block_manager::schema_manager::field_type::AggFunc::Sum);
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::SetBlockAnalyzes(SetBlockAnalyzes {
            sheet_idx: 0,
            block_id: analysis,
            analyzes: Some(9999),
            pivot: None,
        })],
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Err(_)),
        "analysing a nonexistent block must be refused"
    );
}

#[test]
fn the_declarations_survive_a_save_and_reload() {
    use crate::block_manager::schema_manager::field_type::AggFunc;

    let (wb, src, analysis) = orders_with_analysis(AggFunc::Sum);
    let saved = wb.save().unwrap();
    let reopened = Workbook::from_file(&saved, "again".to_string()).unwrap();

    // The marker, and the total it produces.
    let ws = reopened.get_sheet_by_idx(0).unwrap();
    let blocks = ws.get_all_blocks();
    let a = blocks.iter().find(|b| b.block_id == analysis).unwrap();
    assert_eq!(
        a.analyzes,
        Some(src),
        "the analysis marker round-trips: {:?}",
        a.analyzes
    );
    assert_eq!(
        cell_num(&reopened, 3, 1),
        Some(60.0),
        "and the generated formula is rebuilt, so the total still computes"
    );
}

#[test]
fn removing_the_source_removes_its_analyses() {
    use crate::block_manager::schema_manager::field_type::AggFunc;
    use crate::edit_action::RemoveBlock;

    let (mut wb, src, analysis) = orders_with_analysis(AggFunc::Sum);
    assert_eq!(
        wb.get_sheet_by_idx(0).unwrap().get_all_blocks().len(),
        2,
        "sanity: the pair exists"
    );

    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::RemoveBlock(RemoveBlock {
            sheet_idx: 0,
            id: src,
        })],
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "removing the source should succeed: {:?}",
        effect.error_message
    );

    // Both gone. An analysis block outliving its source would sit there
    // aggregating a block that no longer exists, reading empty with nothing to
    // say why.
    let blocks = wb.get_sheet_by_idx(0).unwrap().get_all_blocks();
    assert!(
        blocks.is_empty(),
        "the analysis went with its source, got {:?}",
        blocks.iter().map(|b| b.block_id).collect::<Vec<_>>()
    );

    // One undo brings the whole set back — which is why the cascade is extra
    // payloads in the same transaction rather than a special case.
    assert!(wb.undo());
    let blocks = wb.get_sheet_by_idx(0).unwrap().get_all_blocks();
    assert_eq!(blocks.len(), 2, "undo restores both");
    assert!(blocks.iter().any(|b| b.block_id == analysis));
    assert_eq!(
        cell_num(&wb, 3, 1),
        Some(60.0),
        "and the total still computes"
    );
}

#[test]
fn removing_an_analysis_leaves_its_source_alone() {
    // Not symmetric: a table means something without its total.
    use crate::block_manager::schema_manager::field_type::AggFunc;
    use crate::edit_action::RemoveBlock;

    let (mut wb, src, analysis) = orders_with_analysis(AggFunc::Sum);
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::RemoveBlock(RemoveBlock {
            sheet_idx: 0,
            id: analysis,
        })],
        undoable: true,
        init: false,
    }));
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));
    let blocks = wb.get_sheet_by_idx(0).unwrap().get_all_blocks();
    assert_eq!(blocks.len(), 1);
    assert_eq!(blocks[0].block_id, src);
}

#[test]
fn renaming_a_source_field_regenerates_the_analysis_formula() {
    // The trigger that has to exist. The generated formula names the source's
    // FIELD as a runtime string, and nothing else re-materializes a block when
    // a different block is re-bound — so without this the analysis would keep
    // naming a field that no longer exists, and a `BLOCKREFS` resolves that to
    // nothing rather than to an error. The total would silently read 0.
    use crate::block_manager::schema_manager::field_type::AggFunc;
    use crate::edit_action::BindFormSchema;

    let (mut wb, src, _analysis) = orders_with_analysis(AggFunc::Sum);
    assert_eq!(cell_num(&wb, 3, 1), Some(60.0), "sanity");

    // Rename `amt` to `amount` on the SOURCE, and update the analysis's
    // declaration to match — the two halves a rename tool would send.
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "orders_analysis".into(),
                sheet_idx: 0,
                block_id: _analysis,
                field_from: 0,
                key_idx: 0,
                fields: vec![
                    SchemaFieldSpec::new("key", "a0"),
                    SchemaFieldSpec::new("amount", "a1").with_aggregate(AggFunc::Sum, "amount"),
                ],
                row: true,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "orders".into(),
                sheet_idx: 0,
                block_id: src,
                field_from: 0,
                key_idx: 0,
                fields: vec![
                    SchemaFieldSpec::new("key", "s0"),
                    SchemaFieldSpec::new("amount", "s1"),
                ],
                row: true,
            }),
        ],
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "the rename should succeed: {:?}",
        effect.error_message
    );

    assert_eq!(
        cell_num(&wb, 3, 1),
        Some(60.0),
        "the total still computes after the source field was renamed"
    );
}

#[test]
fn a_block_reports_its_analyses_and_they_report_it() {
    // Both directions, because an agent reading the sheet has to be able to
    // tell a table from its analysis from either end — and must not sum an
    // analysis block's rows alongside the source's.
    use crate::block_manager::schema_manager::field_type::AggFunc;

    let (wb, src, analysis) = orders_with_analysis(AggFunc::Sum);
    let ws = wb.get_sheet_by_idx(0).unwrap();
    let blocks = ws.get_all_blocks();

    let source = blocks.iter().find(|b| b.block_id == src).unwrap();
    assert_eq!(source.analyzes, None, "the table analyses nothing");
    assert_eq!(source.analyzed_by, vec![analysis]);

    let a = blocks.iter().find(|b| b.block_id == analysis).unwrap();
    assert_eq!(a.analyzes, Some(src));
    assert!(a.analyzed_by.is_empty());

    // And the per-field declaration is reported, so a reader can see WHAT the
    // number is, not just that it is a number.
    let schema = a.schema.as_ref().unwrap();
    let amt = schema.fields.iter().find(|f| f.field == "amt").unwrap();
    assert_eq!(amt.agg_func.as_deref(), Some("SUM"));
    assert_eq!(amt.agg_field.as_deref(), Some("amt"));
    let key = schema.fields.iter().find(|f| f.field == "key").unwrap();
    assert_eq!(key.agg_func, None, "the label column aggregates nothing");
}

// ---------------------------------------------------------------------------
// Reshaping a bound block: the mechanism a pivot's refresh is built on.
//
// A pivot's shape is DATA — its rows are the source's distinct row-dimension
// values, its columns the distinct column-dimension values — so a refresh has
// to grow and shrink a block that already carries a schema, in one
// transaction. See `design/block-pivot.md` §6.
//
// `WorkbookOps.editFormBlock` documents a v1 contract of "fields are never
// removed", justified by a *tail* resize orphaning schema entries. A pivot
// cannot honour that: a dimension value that stops occurring must take its
// column with it. These tests pin what actually happens in each order, since
// the whole refresh sequence rests on it.
// ---------------------------------------------------------------------------

/// A one-record block named `t`, `1 x col_cnt`, with no schema yet.
fn reshapable_block(col_cnt: usize) -> (Workbook, logisheets_base::BlockId) {
    let mut wb = Workbook::default();
    let id = wb.get_available_block_id(0).unwrap();
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CreateBlock(CreateBlock {
            sheet_idx: 0,
            id,
            master_row: 0,
            master_col: 0,
            row_cnt: 1,
            col_cnt,
            owner: None,
            modify_policy: None,
            permissions: None,
            description: None,
            analyzes: None,
            pivot: None,
        })],
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "block setup: {:?}",
        effect.error_message
    );
    (wb, id)
}

/// `BindFormSchema` for `t` over `fields`, each `(name, value_formula)`.
fn bind_t(block_id: logisheets_base::BlockId, fields: &[(&str, Option<&str>)]) -> EditPayload {
    use crate::edit_action::BindFormSchema;
    EditPayload::BindFormSchema(BindFormSchema {
        ref_name: "t".into(),
        sheet_idx: 0,
        block_id,
        field_from: 0,
        key_idx: 0,
        fields: fields
            .iter()
            .enumerate()
            .map(|(i, (name, formula))| {
                let spec = SchemaFieldSpec::new(*name, format!("r{i}"));
                spec.with_value_formula(formula.map(String::from))
            })
            .collect(),
        row: true,
    })
}

fn resize_t(
    block_id: logisheets_base::BlockId,
    rows: Option<usize>,
    cols: Option<usize>,
) -> EditPayload {
    EditPayload::ResizeBlock(crate::edit_action::ResizeBlock {
        sheet_idx: 0,
        id: block_id,
        new_row_cnt: rows,
        new_col_cnt: cols,
    })
}

fn field_names(wb: &Workbook, block_id: logisheets_base::BlockId) -> Vec<String> {
    let ws = wb.get_sheet_by_idx(0).unwrap();
    let blocks = ws.get_all_blocks();
    let b = blocks.iter().find(|b| b.block_id == block_id).unwrap();
    b.schema
        .as_ref()
        .map(|s| s.fields.iter().map(|f| f.field.clone()).collect())
        .unwrap_or_default()
}

fn apply(wb: &mut Workbook, payloads: Vec<EditPayload>) -> crate::edit_action::ActionEffect {
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads,
        undoable: true,
        init: false,
    }))
}

#[test]
fn growing_a_block_and_rebinding_covers_the_new_column() {
    // The grow half of a pivot refresh: a new column-dimension value appears,
    // so the block gains a column and the schema gains the field that names
    // it. Resize FIRST — binding a field to a column that does not exist yet
    // has nothing to materialize onto.
    let (mut wb, id) = reshapable_block(2);
    let effect = apply(&mut wb, vec![bind_t(id, &[("key", None), ("a", None)])]);
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));
    let effect = apply(
        &mut wb,
        vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 0,
            col: 0,
            content: "k0".into(),
        })],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));

    let effect = apply(
        &mut wb,
        vec![
            resize_t(id, None, Some(3)),
            bind_t(id, &[("key", None), ("a", None), ("b", Some("LEN(#KEY)"))]),
        ],
    );
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "grow then bind: {:?}",
        effect.error_message
    );

    assert_eq!(field_names(&wb, id), vec!["key", "a", "b"]);
    // The bind materializes the WHOLE grid, so the brand-new column computes
    // immediately — and `#KEY` substituted for the row, which is exactly what
    // a pivot's per-row filter relies on.
    assert_eq!(cell_num(&wb, 0, 2), Some(2.0), "LEN(\"k0\")");
}

#[test]
fn growing_rows_and_rebinding_materializes_the_new_rows() {
    // The other grow axis, and the one a pivot needs most: new row-dimension
    // values mean new RECORDS. `ResizeBlock` alone does not materialize
    // templates (only InsertRowsInBlock, UpsertFieldFormulas and
    // BindFormSchema do), so the refresh gets its new rows computed only
    // because the bind that follows walks the full row x col grid.
    let (mut wb, id) = reshapable_block(2);
    let effect = apply(
        &mut wb,
        vec![
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 0,
                content: "aa".into(),
            }),
            bind_t(id, &[("key", None), ("a", Some("LEN(#KEY)"))]),
        ],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));
    assert_eq!(cell_num(&wb, 0, 1), Some(2.0));

    let effect = apply(
        &mut wb,
        vec![
            resize_t(id, Some(3), None),
            // The keys go in BEFORE the bind. `#KEY` is captured when the
            // template is materialized, not when the cell is calculated, and
            // the bind is what materializes — so a key written after it
            // substitutes as `""`. See `key_written_after_the_bind_...`.
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 1,
                col: 0,
                content: "bbb".into(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 2,
                col: 0,
                content: "cccc".into(),
            }),
            bind_t(id, &[("key", None), ("a", Some("LEN(#KEY)"))]),
        ],
    );
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "grow rows then bind: {:?}",
        effect.error_message
    );

    assert_eq!(cell_num(&wb, 0, 1), Some(2.0), "the existing row is intact");
    assert_eq!(cell_num(&wb, 1, 1), Some(3.0), "a new row computes");
    assert_eq!(cell_num(&wb, 2, 1), Some(4.0), "and so does the next");
}

#[test]
fn binding_before_shrinking_drops_a_column_and_leaves_no_orphan() {
    // The shrink half: a dimension value stops occurring, so its column goes.
    // Bind FIRST, so the narrower schema is in place before the columns
    // disappear — the doomed column is simply left unbound and the resize
    // then removes it.
    let (mut wb, id) = reshapable_block(3);
    let effect = apply(
        &mut wb,
        vec![
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 0,
                content: "k0".into(),
            }),
            bind_t(id, &[("key", None), ("a", None), ("b", Some("LEN(#KEY)"))]),
        ],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));
    assert_eq!(cell_num(&wb, 0, 2), Some(2.0), "sanity: b computes");

    let effect = apply(
        &mut wb,
        vec![
            bind_t(id, &[("key", None), ("a", None)]),
            resize_t(id, None, Some(2)),
        ],
    );
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "bind then shrink: {:?}",
        effect.error_message
    );

    assert_eq!(field_names(&wb, id), vec!["key", "a"]);
    let ws = wb.get_sheet_by_idx(0).unwrap();
    let blocks = ws.get_all_blocks();
    let b = blocks.iter().find(|b| b.block_id == id).unwrap();
    assert_eq!(b.col_cnt, 2, "the block really is narrower");
    assert_eq!(
        cell_num(&wb, 0, 2),
        None,
        "and the dropped column's value is gone with it"
    );
}

#[test]
fn shrinking_before_binding_reaches_the_same_place() {
    // The other order, pinned because the refresh in `packages/core` has to
    // pick one and a future reader will wonder whether the choice mattered.
    // It does not for the end state — the bind replaces the schema wholesale,
    // so neither order can orphan an entry — but bind-first is what
    // `binding_before_shrinking_...` documents and what the host sends,
    // because it never leaves a live template on a column about to vanish.
    let (mut wb, id) = reshapable_block(3);
    let effect = apply(
        &mut wb,
        vec![
            bind_t(id, &[("key", None), ("a", None), ("b", Some("LEN(#KEY)"))]),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 0,
                content: "k0".into(),
            }),
        ],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));

    let effect = apply(
        &mut wb,
        vec![
            resize_t(id, None, Some(2)),
            bind_t(id, &[("key", None), ("a", None)]),
        ],
    );
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "shrink then bind: {:?}",
        effect.error_message
    );

    assert_eq!(field_names(&wb, id), vec!["key", "a"]);
    assert_eq!(cell_num(&wb, 0, 2), None);
}

#[test]
fn a_reshape_is_one_undo() {
    // The refresh is one transaction, so a user who does not like the new
    // shape gets the old one back in a single step — the same property the
    // analysis cascade has.
    let (mut wb, id) = reshapable_block(2);
    let effect = apply(
        &mut wb,
        vec![
            bind_t(id, &[("key", None), ("a", None)]),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 0,
                content: "k0".into(),
            }),
        ],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));

    let effect = apply(
        &mut wb,
        vec![
            resize_t(id, Some(2), Some(3)),
            bind_t(id, &[("key", None), ("a", None), ("b", Some("LEN(#KEY)"))]),
        ],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));
    assert_eq!(field_names(&wb, id), vec!["key", "a", "b"]);

    wb.undo();
    assert_eq!(field_names(&wb, id), vec!["key", "a"]);
    let ws = wb.get_sheet_by_idx(0).unwrap();
    let blocks = ws.get_all_blocks();
    let b = blocks.iter().find(|b| b.block_id == id).unwrap();
    assert_eq!((b.row_cnt, b.col_cnt), (1, 2), "the old shape is back");
}

#[test]
fn a_key_written_after_the_bind_substitutes_as_empty() {
    // The constraint that fixes the refresh's payload order, pinned because it
    // is invisible and its failure mode is a silent zero.
    //
    // `#KEY` is substituted when the template is MATERIALIZED — the bind walks
    // the grid and builds an AST node from the key cell's value *at that
    // moment* (`input_block_cell_template`). Writing the key afterwards does
    // not re-materialize anything: only InsertRowsInBlock, UpsertFieldFormulas
    // and BindFormSchema do. So the row keeps a formula built from `""`.
    //
    // For a pivot that would mean every refreshed row filtering on the empty
    // string: a full grid of zeros, no error anywhere. Hence
    // `design/block-pivot.md` §6 writes the keys BEFORE the bind.
    let (mut wb, id) = reshapable_block(2);
    let effect = apply(
        &mut wb,
        vec![
            bind_t(id, &[("key", None), ("a", Some("LEN(#KEY)"))]),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 0,
                content: "k0".into(),
            }),
        ],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));
    assert_eq!(
        cell_num(&wb, 0, 1),
        Some(0.0),
        "LEN(\"\") — the key was not there yet when the template materialized"
    );

    // Re-binding with the key now in place is what repairs it, which is also
    // why the refresh can be re-run safely at any time.
    let effect = apply(
        &mut wb,
        vec![bind_t(id, &[("key", None), ("a", Some("LEN(#KEY)"))])],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));
    assert_eq!(cell_num(&wb, 0, 1), Some(2.0));
}

#[test]
fn editing_a_key_does_not_re_aim_the_row_until_a_rebind() {
    // The same property from the user's side, and the reason a pivot's key
    // column needs the guards in `design/block-pivot.md` §4.3: someone editing
    // a pivot's row label does NOT re-aim that row's aggregates — the row goes
    // on reporting the old group under the new name, which is worse than
    // either updating or refusing.
    let (mut wb, id) = reshapable_block(2);
    let effect = apply(
        &mut wb,
        vec![
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 0,
                content: "k0".into(),
            }),
            bind_t(id, &[("key", None), ("a", Some("LEN(#KEY)"))]),
        ],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));
    assert_eq!(cell_num(&wb, 0, 1), Some(2.0));

    let effect = apply(
        &mut wb,
        vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 0,
            col: 0,
            content: "much-longer".into(),
        })],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));
    assert_eq!(
        cell_num(&wb, 0, 1),
        Some(2.0),
        "still LEN(\"k0\"): the formula holds the key it was built with"
    );
}

// ---------------------------------------------------------------------------
// The pivot DECLARATION: what a host can state, what the engine refuses, and
// what survives a file. The lowering it drives is a separate step.
// See `design/block-pivot.md` §4.
// ---------------------------------------------------------------------------

fn pivot_parts() -> crate::block_manager::schema_manager::field_type::PivotSpecParts {
    crate::block_manager::schema_manager::field_type::PivotSpecParts {
        row_dim: "region".into(),
        col_dim: Some("quarter".into()),
        measure: "amt".into(),
        func: "SUM".into(),
        order: Some("ascending".into()),
        order_values: None,
        filters: None,
    }
}

/// `orders` (3 records) plus an empty block that pivots it.
fn orders_with_pivot() -> (Workbook, logisheets_base::BlockId, logisheets_base::BlockId) {
    use crate::block_manager::schema_manager::field_type::AggFunc;
    let (mut wb, src, _analysis) = orders_with_analysis(AggFunc::Sum);
    let pivot = wb.get_available_block_id(0).unwrap();
    let effect = apply(
        &mut wb,
        vec![EditPayload::CreateBlock(CreateBlock {
            sheet_idx: 0,
            id: pivot,
            master_row: 10,
            master_col: 0,
            row_cnt: 1,
            col_cnt: 2,
            owner: None,
            modify_policy: None,
            permissions: None,
            description: None,
            analyzes: Some(src),
            pivot: Some(pivot_parts()),
        })],
    );
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "pivot creation: {:?}",
        effect.error_message
    );
    (wb, src, pivot)
}

fn reported_pivot(
    wb: &Workbook,
    block_id: logisheets_base::BlockId,
) -> Option<crate::block_manager::schema_manager::field_type::PivotSpecParts> {
    let ws = wb.get_sheet_by_idx(0).unwrap();
    let blocks = ws.get_all_blocks();
    blocks
        .iter()
        .find(|b| b.block_id == block_id)
        .and_then(|b| b.pivot.clone())
}

#[test]
fn a_pivot_is_declared_as_the_block_is_created_and_reported_back() {
    // Declared at creation for the same reason `analyzes` is: between two
    // payloads a reader would see a stray table and take its cells for records.
    let (wb, src, pivot) = orders_with_pivot();

    let ws = wb.get_sheet_by_idx(0).unwrap();
    let blocks = ws.get_all_blocks();
    let p = blocks.iter().find(|b| b.block_id == pivot).unwrap();
    assert_eq!(p.analyzes, Some(src), "a pivot is an analysis block");

    let spec = p.pivot.as_ref().expect("the recipe is reported");
    assert_eq!(spec.row_dim, "region");
    assert_eq!(spec.col_dim.as_deref(), Some("quarter"));
    assert_eq!(spec.measure, "amt");
    assert_eq!(spec.func, "SUM");

    // And a plain analysis block is still not a pivot — the total row created
    // by the shared helper reports no recipe.
    let total = blocks
        .iter()
        .find(|b| b.analyzes == Some(src) && b.block_id != pivot)
        .unwrap();
    assert_eq!(total.pivot, None);
}

#[test]
fn a_pivot_that_analyses_nothing_is_refused() {
    // Every cell of it would aggregate a block that was never named: a grid of
    // zeros with nothing to say why. Better to refuse the declaration.
    let mut wb = Workbook::default();
    let id = wb.get_available_block_id(0).unwrap();
    let effect = apply(
        &mut wb,
        vec![EditPayload::CreateBlock(CreateBlock {
            sheet_idx: 0,
            id,
            master_row: 0,
            master_col: 0,
            row_cnt: 1,
            col_cnt: 2,
            owner: None,
            modify_policy: None,
            permissions: None,
            description: None,
            analyzes: None,
            pivot: Some(pivot_parts()),
        })],
    );
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Err(_)),
        "a pivot with no source should be refused"
    );
    assert!(
        effect
            .error_message
            .as_deref()
            .unwrap_or_default()
            .contains("needs a source block to aggregate"),
        "the refusal should say why: {:?}",
        effect.error_message
    );
}

#[test]
fn a_pivot_over_itself_is_refused() {
    // The cycle the separate-block design exists to avoid, reachable through
    // the recipe as well as through `analyzes`.
    let mut wb = Workbook::default();
    let id = wb.get_available_block_id(0).unwrap();
    let effect = apply(
        &mut wb,
        vec![EditPayload::CreateBlock(CreateBlock {
            sheet_idx: 0,
            id,
            master_row: 0,
            master_col: 0,
            row_cnt: 1,
            col_cnt: 2,
            owner: None,
            modify_policy: None,
            permissions: None,
            description: None,
            analyzes: Some(id),
            pivot: Some(pivot_parts()),
        })],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Err(_)
    ));
}

#[test]
fn an_uninterpretable_recipe_leaves_a_plain_analysis_block() {
    // An aggregate this build does not know is DROPPED, not guessed: a wrong
    // function produces a number that looks right. The block stays an analysis
    // block, which is the honest degraded state.
    let (mut wb, src, _analysis) =
        orders_with_analysis(crate::block_manager::schema_manager::field_type::AggFunc::Sum);
    let id = wb.get_available_block_id(0).unwrap();
    let effect = apply(
        &mut wb,
        vec![EditPayload::CreateBlock(CreateBlock {
            sheet_idx: 0,
            id,
            master_row: 10,
            master_col: 0,
            row_cnt: 1,
            col_cnt: 2,
            owner: None,
            modify_policy: None,
            permissions: None,
            description: None,
            analyzes: Some(src),
            pivot: Some(
                crate::block_manager::schema_manager::field_type::PivotSpecParts {
                    func: "MEDIAN".into(),
                    ..pivot_parts()
                },
            ),
        })],
    );
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "the block should still open: {:?}",
        effect.error_message
    );
    assert_eq!(reported_pivot(&wb, id), None);
    let ws = wb.get_sheet_by_idx(0).unwrap();
    let blocks = ws.get_all_blocks();
    let b = blocks.iter().find(|b| b.block_id == id).unwrap();
    assert_eq!(b.analyzes, Some(src), "but it is still an analysis block");
}

#[test]
fn the_recipe_can_be_changed_and_cleared_after_the_fact() {
    use crate::edit_action::SetBlockAnalyzes;
    let (mut wb, src, pivot) = orders_with_pivot();

    // Change it: one payload states the WHOLE declaration, so the source and
    // the recipe cannot drift apart.
    let effect = apply(
        &mut wb,
        vec![EditPayload::SetBlockAnalyzes(SetBlockAnalyzes {
            sheet_idx: 0,
            block_id: pivot,
            analyzes: Some(src),
            pivot: Some(
                crate::block_manager::schema_manager::field_type::PivotSpecParts {
                    col_dim: None,
                    func: "AVERAGE".into(),
                    ..pivot_parts()
                },
            ),
        })],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));
    let spec = reported_pivot(&wb, pivot).unwrap();
    assert_eq!(
        spec.col_dim, None,
        "a grouped pivot has no column dimension"
    );
    assert_eq!(spec.func, "AVERAGE");

    // Clear it back to a plain analysis block by stating no recipe.
    let effect = apply(
        &mut wb,
        vec![EditPayload::SetBlockAnalyzes(SetBlockAnalyzes {
            sheet_idx: 0,
            block_id: pivot,
            analyzes: Some(src),
            pivot: None,
        })],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));
    assert_eq!(reported_pivot(&wb, pivot), None);

    // And clearing the source clears the recipe with it, because the payload
    // states both — there is no state where a pivot has lost its source.
    let effect = apply(
        &mut wb,
        vec![EditPayload::SetBlockAnalyzes(SetBlockAnalyzes {
            sheet_idx: 0,
            block_id: pivot,
            analyzes: None,
            pivot: None,
        })],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));
    let ws = wb.get_sheet_by_idx(0).unwrap();
    let blocks = ws.get_all_blocks();
    let b = blocks.iter().find(|b| b.block_id == pivot).unwrap();
    assert_eq!(b.analyzes, None);
    assert_eq!(b.pivot, None);
}

#[test]
fn setting_a_recipe_without_a_source_is_refused() {
    let (mut wb, _src, pivot) = orders_with_pivot();
    let effect = apply(
        &mut wb,
        vec![EditPayload::SetBlockAnalyzes(
            crate::edit_action::SetBlockAnalyzes {
                sheet_idx: 0,
                block_id: pivot,
                analyzes: None,
                pivot: Some(pivot_parts()),
            },
        )],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Err(_)
    ));
}

#[test]
fn a_pivot_recipe_survives_a_real_xlsx_round_trip() {
    // The recipe is the only record of what a pivot IS — its cells are
    // generated from it and its shape is refreshed from it — so a file that
    // loses it loses the pivot, leaving a grid of numbers nobody can rebuild.
    let (wb, src, pivot) = orders_with_pivot();
    let bytes = wb.save().expect("save");
    let restored = Workbook::from_file(&bytes, "rt".to_string()).expect("load");

    let ws = restored.get_sheet_by_idx(0).unwrap();
    let blocks = ws.get_all_blocks();
    let p = blocks
        .iter()
        .find(|b| b.block_id == pivot)
        .expect("the pivot block is back");
    assert_eq!(p.analyzes, Some(src));
    let spec = p.pivot.as_ref().expect("and so is its recipe");
    assert_eq!(spec.row_dim, "region");
    assert_eq!(spec.col_dim.as_deref(), Some("quarter"));
    assert_eq!(spec.measure, "amt");
    assert_eq!(spec.func, "SUM");
    assert_eq!(spec.order.as_deref(), Some("ascending"));

    // The total row beside it is still a plain analysis block, so the two
    // kinds stay distinguishable across a file.
    let total = blocks
        .iter()
        .find(|b| b.analyzes == Some(src) && b.block_id != pivot)
        .unwrap();
    assert_eq!(total.pivot, None);
}

#[test]
fn a_grouped_pivot_survives_without_gaining_a_column_dimension() {
    // `col_dim: None` is the degenerate pivot, and it must not come back as
    // `Some("")` — that would be a column dimension named empty string, and
    // every cell would filter on it.
    use crate::edit_action::SetBlockAnalyzes;
    let (mut wb, src, pivot) = orders_with_pivot();
    let effect = apply(
        &mut wb,
        vec![EditPayload::SetBlockAnalyzes(SetBlockAnalyzes {
            sheet_idx: 0,
            block_id: pivot,
            analyzes: Some(src),
            pivot: Some(
                crate::block_manager::schema_manager::field_type::PivotSpecParts {
                    col_dim: None,
                    ..pivot_parts()
                },
            ),
        })],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));

    let bytes = wb.save().expect("save");
    let restored = Workbook::from_file(&bytes, "rt".to_string()).expect("load");
    let ws = restored.get_sheet_by_idx(0).unwrap();
    let blocks = ws.get_all_blocks();
    let p = blocks.iter().find(|b| b.block_id == pivot).unwrap();
    assert_eq!(p.pivot.as_ref().unwrap().col_dim, None);
}

#[test]
fn a_pivot_field_cannot_also_declare_its_own_aggregate() {
    // The two mean different things for the same column — "SUM of amt for
    // THIS row's group" versus "SUM of amt over everything" — and whichever
    // silently won would be a precedence rule invisible from the sheet.
    use crate::block_manager::schema_manager::field_type::AggFunc;
    use crate::edit_action::BindFormSchema;

    let (mut wb, _src, pivot) = orders_with_pivot();
    let effect = apply(
        &mut wb,
        vec![EditPayload::BindFormSchema(BindFormSchema {
            ref_name: "orders_pivot".into(),
            sheet_idx: 0,
            block_id: pivot,
            field_from: 0,
            key_idx: 0,
            fields: vec![
                SchemaFieldSpec::new("region", "p0"),
                SchemaFieldSpec::new("Q1", "p1").with_aggregate(AggFunc::Sum, "amt"),
            ],
            row: true,
        })],
    );
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Err(_)),
        "a pivot column carrying its own aggregate should be refused"
    );
    assert!(
        effect
            .error_message
            .as_deref()
            .unwrap_or_default()
            .contains("cannot also declare its own aggregate"),
        "the refusal should say which field and why: {:?}",
        effect.error_message
    );
}

#[test]
fn a_field_aggregate_is_still_fine_on_a_block_that_is_not_a_pivot() {
    // The guard must not touch the total row, which is exactly a block whose
    // fields declare their own aggregates.
    use crate::block_manager::schema_manager::field_type::AggFunc;
    let (wb, _src, _analysis) = orders_with_analysis(AggFunc::Sum);
    assert_eq!(cell_num(&wb, 3, 1), Some(60.0));
}

#[test]
fn declaring_a_pivot_over_a_block_whose_fields_aggregate_is_refused_too() {
    // The other order of arrival: the field aggregates first, the recipe
    // second. Same conflict, so the same refusal — which is why the check
    // runs on the finished state rather than per payload.
    use crate::block_manager::schema_manager::field_type::AggFunc;
    use crate::edit_action::SetBlockAnalyzes;

    let (mut wb, src, analysis) = orders_with_analysis(AggFunc::Sum);
    let effect = apply(
        &mut wb,
        vec![EditPayload::SetBlockAnalyzes(SetBlockAnalyzes {
            sheet_idx: 0,
            block_id: analysis,
            analyzes: Some(src),
            pivot: Some(pivot_parts()),
        })],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Err(_)
    ));
    // And the refusal is atomic: the block is still the total row it was.
    assert_eq!(reported_pivot(&wb, analysis), None);
    assert_eq!(cell_num(&wb, 3, 1), Some(60.0));
}

// ---------------------------------------------------------------------------
// A pivot that actually computes. `design/block-pivot.md` §4.1.
// ---------------------------------------------------------------------------

/// A `sales` fact table: an id key plus region x quarter x amt, six records.
///
/// ```text
///   id  region  quarter  amt
///   o0  East     Q1       10
///   o1  East     Q2       20
///   o2  South     Q1        3
///   o3  South     Q1        4     <- two rows in one cell of the pivot
///   o4  South     Q2        5
///   o5  North     Q1        7
/// ```
///
/// The id column exists because a pivot's source is a FACT table: its
/// dimension columns repeat by definition, so a dimension cannot be the
/// block's key — the key-uniqueness guard refuses that, correctly. A pivot's
/// `row_dim` is therefore an ordinary field, which is also why the lowering
/// reaches it through `BLOCKREFSB`'s field filter rather than through a key.
fn sales_block(wb: &mut Workbook) -> logisheets_base::BlockId {
    use crate::edit_action::BindFormSchema;
    let src = wb.get_available_block_id(0).unwrap();
    let rows = [
        ("o0", "East", "Q1", "10"),
        ("o1", "East", "Q2", "20"),
        ("o2", "South", "Q1", "3"),
        ("o3", "South", "Q1", "4"),
        ("o4", "South", "Q2", "5"),
        ("o5", "North", "Q1", "7"),
    ];
    let mut payloads = vec![
        EditPayload::CreateBlock(CreateBlock {
            sheet_idx: 0,
            id: src,
            master_row: 0,
            master_col: 0,
            row_cnt: rows.len(),
            col_cnt: 4,
            owner: None,
            modify_policy: None,
            permissions: None,
            description: None,
            analyzes: None,
            pivot: None,
        }),
        EditPayload::BindFormSchema(BindFormSchema {
            ref_name: "sales".into(),
            sheet_idx: 0,
            block_id: src,
            field_from: 0,
            key_idx: 0,
            fields: vec![
                SchemaFieldSpec::new("id", "s0"),
                SchemaFieldSpec::new("region", "s1"),
                SchemaFieldSpec::new("quarter", "s2"),
                SchemaFieldSpec::new("amt", "s3"),
            ],
            row: true,
        }),
    ];
    for (r, (id, region, quarter, amt)) in rows.iter().enumerate() {
        for (c, v) in [id, region, quarter, amt].iter().enumerate() {
            payloads.push(EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: r,
                col: c,
                content: v.to_string(),
            }));
        }
    }
    let effect = apply(wb, payloads);
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "sales setup: {:?}",
        effect.error_message
    );
    src
}

/// `sales` plus a pivot of it at row 10: rows East/South/North, columns Q1/Q2.
///
/// Built the way §6 says a refresh builds one — **keys before the bind** —
/// because `#KEY` is captured at materialization.
fn sales_with_pivot(
    func: &str,
    col_dim: Option<&str>,
) -> (Workbook, logisheets_base::BlockId, logisheets_base::BlockId) {
    use crate::block_manager::schema_manager::field_type::PivotSpecParts;
    use crate::edit_action::BindFormSchema;

    let mut wb = Workbook::default();
    let src = sales_block(&mut wb);
    let pivot = wb.get_available_block_id(0).unwrap();

    let keys = ["East", "South", "North"];
    let value_fields: Vec<&str> = match col_dim {
        Some(_) => vec!["Q1", "Q2"],
        None => vec!["total"],
    };

    let mut payloads = vec![EditPayload::CreateBlock(CreateBlock {
        sheet_idx: 0,
        id: pivot,
        master_row: 10,
        master_col: 0,
        row_cnt: keys.len(),
        col_cnt: 1 + value_fields.len(),
        owner: None,
        modify_policy: None,
        permissions: None,
        description: None,
        analyzes: Some(src),
        pivot: Some(PivotSpecParts {
            row_dim: "region".into(),
            col_dim: col_dim.map(String::from),
            measure: "amt".into(),
            func: func.into(),
            order: Some("ascending".into()),
            order_values: None,
            filters: None,
        }),
    })];
    // Keys first.
    for (i, k) in keys.iter().enumerate() {
        payloads.push(EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 10 + i,
            col: 0,
            content: k.to_string(),
        }));
    }
    // Then the bind, which materializes the whole grid from the recipe.
    let mut fields = vec![SchemaFieldSpec::new("region", "p0")];
    for (i, f) in value_fields.iter().enumerate() {
        fields.push(SchemaFieldSpec::new(*f, format!("p{}", i + 1)));
    }
    payloads.push(EditPayload::BindFormSchema(BindFormSchema {
        ref_name: "sales_pivot".into(),
        sheet_idx: 0,
        block_id: pivot,
        field_from: 0,
        key_idx: 0,
        fields,
        row: true,
    }));

    let effect = apply(&mut wb, payloads);
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "pivot setup: {:?}",
        effect.error_message
    );
    (wb, src, pivot)
}

#[test]
fn a_pivot_cross_tabulates_from_the_recipe_alone() {
    // No host sent a formula. Every cell below was generated from
    // `row_dim x col_dim -> SUM(measure)` plus the cell's own row key and
    // field name.
    let (wb, _src, _pivot) = sales_with_pivot("SUM", Some("quarter"));

    //            Q1              Q2
    // East       10               20
    // South       3 + 4 = 7        5
    // North       7                (none)
    assert_eq!(cell_num(&wb, 10, 1), Some(10.0), "East Q1");
    assert_eq!(cell_num(&wb, 10, 2), Some(20.0), "East Q2");
    assert_eq!(
        cell_num(&wb, 11, 1),
        Some(7.0),
        "South Q1 sums BOTH records"
    );
    assert_eq!(cell_num(&wb, 11, 2), Some(5.0), "South Q2");
    assert_eq!(cell_num(&wb, 12, 1), Some(7.0), "North Q1");
}

#[test]
fn a_cell_with_no_matching_records_reads_zero_rather_than_erroring() {
    // North has no Q2 row. An empty intersection is a real answer in a
    // cross-tab — the group exists, it just has nothing in that column — so
    // it must not poison the grid with an error.
    let (wb, _src, _pivot) = sales_with_pivot("SUM", Some("quarter"));
    assert_eq!(cell_num(&wb, 12, 2), Some(0.0), "North Q2");
}

#[test]
fn the_key_column_of_a_pivot_stays_an_ordinary_cell() {
    // It holds the row's dimension value, which is both the key the result is
    // addressed by and the filter `#KEY` resolves to. Generating a formula
    // into it would leave the pivot with no rows to name.
    let (wb, _src, _pivot) = sales_with_pivot("SUM", Some("quarter"));
    let ws = wb.get_sheet_by_idx(0).unwrap();
    assert!(
        matches!(
            ws.get_value(10, 0).unwrap(),
            crate::controller::display::Value::Str(ref s) if s == "East"
        ),
        "the key cell still holds the typed dimension value"
    );
}

#[test]
fn a_pivot_tracks_an_edit_to_the_source() {
    // Values are live: only the SHAPE needs a refresh.
    let (mut wb, src, _pivot) = sales_with_pivot("SUM", Some("quarter"));
    assert_eq!(cell_num(&wb, 11, 1), Some(7.0));

    // South Q1's second record: 4 -> 40.
    let effect = apply(
        &mut wb,
        vec![EditPayload::BlockInput(crate::edit_action::BlockInput {
            sheet_idx: 0,
            block_id: src,
            row: 3,
            col: 3,
            input: "40".into(),
        })],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));
    assert_eq!(cell_num(&wb, 11, 1), Some(43.0), "3 + 40");
    assert_eq!(cell_num(&wb, 10, 1), Some(10.0), "other cells untouched");
}

#[test]
fn a_pivot_tracks_a_record_added_to_a_group_it_already_shows() {
    // The case where the shape does NOT change: a new row in an existing
    // (region, quarter) intersection. This needs no refresh at all, which is
    // the half of the feature that is genuinely live.
    let (mut wb, src, _pivot) = sales_with_pivot("SUM", Some("quarter"));
    let effect = apply(
        &mut wb,
        vec![
            EditPayload::InsertRowsInBlock(crate::edit_action::InsertRowsInBlock {
                sheet_idx: 0,
                block_id: src,
                start: 6,
                cnt: 1,
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 6,
                col: 0,
                content: "o6".into(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 6,
                col: 1,
                content: "East".into(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 6,
                col: 2,
                content: "Q1".into(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 6,
                col: 3,
                content: "100".into(),
            }),
        ],
    );
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "{:?}",
        effect.error_message
    );
    assert_eq!(cell_num(&wb, 11, 1), Some(7.0), "South Q1 unchanged");
    assert_eq!(cell_num(&wb, 10, 1), Some(110.0), "East Q1 picked it up");
}

#[test]
fn a_grouped_pivot_totals_each_group_over_every_column() {
    // `col_dim: None`: one value column, filtered on the row alone.
    let (wb, _src, _pivot) = sales_with_pivot("SUM", None);
    assert_eq!(cell_num(&wb, 10, 1), Some(30.0), "East = 10 + 20");
    assert_eq!(cell_num(&wb, 11, 1), Some(12.0), "South = 3 + 4 + 5");
    assert_eq!(cell_num(&wb, 12, 1), Some(7.0), "North = 7");
}

#[test]
fn a_pivot_can_average_and_count_as_well_as_sum() {
    let (wb, _src, _pivot) = sales_with_pivot("AVERAGE", Some("quarter"));
    assert_eq!(cell_num(&wb, 11, 1), Some(3.5), "South Q1 = (3 + 4) / 2");

    let (wb, _src, _pivot) = sales_with_pivot("COUNT", Some("quarter"));
    assert_eq!(cell_num(&wb, 11, 1), Some(2.0), "South Q1 has two records");
    assert_eq!(cell_num(&wb, 12, 2), Some(0.0), "North Q2 has none");
}

#[test]
fn a_pivot_result_is_addressable_by_key_and_field() {
    // The reason a pivot is a block: `BLOCKREF(name, key, field)` reaches one
    // cell of it, so an agent can put a cross-tab number in a sentence or feed
    // it to another calculation.
    let (mut wb, _src, _pivot) = sales_with_pivot("SUM", Some("quarter"));
    let effect = apply(
        &mut wb,
        vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 20,
            col: 5,
            content: "=BLOCKREF(\"sales_pivot\",\"South\",\"Q1\")*2".into(),
        })],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));
    assert_eq!(cell_num(&wb, 20, 5), Some(14.0), "7 * 2");
}

#[test]
fn a_pivot_does_not_count_itself() {
    // The cycle question, for a pivot: its cells aggregate the SOURCE, and
    // `BlockAll(pivot)` depends on those cells. Two independent barriers.
    let (wb, _src, _pivot) = sales_with_pivot("SUM", None);
    // East = 30. If the pivot were somehow in its own source the numbers
    // would compound; the grand total across groups is 10+20+3+4+5+7 = 49.
    assert_eq!(
        cell_num(&wb, 10, 1).unwrap()
            + cell_num(&wb, 11, 1).unwrap()
            + cell_num(&wb, 12, 1).unwrap(),
        49.0
    );
}

#[test]
fn multi_criteria_sumifs_keeps_its_criteria_in_step() {
    // A plain-cell regression test for a bug the pivot work surfaced, and one
    // that had nothing to do with blocks: `calc_ifs` stopped advancing the
    // later criteria iterators as soon as an earlier one said no. They are
    // positional cursors, so from the first non-matching row onward every
    // later criterion was compared against the wrong record — a silently
    // wrong number, never an error.
    //
    //   A     B    C
    //   East  Q1   10
    //   East  Q2   20
    //   South  Q1    3
    //   South  Q1    4
    //   South  Q2    5
    //   North  Q1    7
    //
    // South AND Q1 is 3 + 4 = 7. The bug gave 8 (rows 3 and 5), because the
    // quarter cursor lagged by the two leading East rows.
    let mut wb = Workbook::default();
    let rows = [
        ("East", "Q1", "10"),
        ("East", "Q2", "20"),
        ("South", "Q1", "3"),
        ("South", "Q1", "4"),
        ("South", "Q2", "5"),
        ("North", "Q1", "7"),
    ];
    let mut payloads = vec![];
    for (r, (region, quarter, amt)) in rows.iter().enumerate() {
        for (c, v) in [region, quarter, amt].iter().enumerate() {
            payloads.push(EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: r,
                col: c,
                content: v.to_string(),
            }));
        }
    }
    for (row, formula) in [
        (10, "=SUMIFS(C1:C6,A1:A6,\"South\",B1:B6,\"Q1\")"),
        (11, "=COUNTIFS(A1:A6,\"South\",B1:B6,\"Q1\")"),
        (12, "=AVERAGEIFS(C1:C6,A1:A6,\"South\",B1:B6,\"Q1\")"),
        (13, "=MAXIFS(C1:C6,A1:A6,\"South\",B1:B6,\"Q1\")"),
        (14, "=MINIFS(C1:C6,A1:A6,\"South\",B1:B6,\"Q1\")"),
        // Three criteria, so a middle cursor has to stay in step too.
        (
            15,
            "=SUMIFS(C1:C6,A1:A6,\"South\",B1:B6,\"Q1\",C1:C6,\">3\")",
        ),
        // And one criterion still works — the path that was already correct.
        (16, "=SUMIFS(C1:C6,A1:A6,\"South\")"),
    ] {
        payloads.push(EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row,
            col: 5,
            content: formula.to_string(),
        }));
    }
    let effect = apply(&mut wb, payloads);
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));

    assert_eq!(cell_num(&wb, 10, 5), Some(7.0), "SUMIFS South x Q1 = 3 + 4");
    assert_eq!(cell_num(&wb, 11, 5), Some(2.0), "COUNTIFS");
    assert_eq!(cell_num(&wb, 12, 5), Some(3.5), "AVERAGEIFS");
    assert_eq!(cell_num(&wb, 13, 5), Some(4.0), "MAXIFS");
    assert_eq!(cell_num(&wb, 14, 5), Some(3.0), "MINIFS");
    assert_eq!(
        cell_num(&wb, 15, 5),
        Some(4.0),
        "three criteria: only the 4"
    );
    assert_eq!(cell_num(&wb, 16, 5), Some(12.0), "one criterion: 3 + 4 + 5");
}

#[test]
fn minifs_and_maxifs_do_not_fold_from_zero() {
    // A second bug the same work surfaced, also nothing to do with blocks:
    // `calc_ifs` seeded its accumulator at 0 and folded with min/max, so
    // MINIFS over all-positive data always returned 0 and MAXIFS over
    // all-negative data always returned 0 — the answer was never even in the
    // input. It matters here because MIN and MAX are two of the five
    // functions a pivot can declare.
    let mut wb = Workbook::default();
    let mut payloads = vec![];
    for (r, (tag, v)) in [("a", "3"), ("a", "5"), ("b", "-9"), ("a", "-2")]
        .iter()
        .enumerate()
    {
        payloads.push(EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: r,
            col: 0,
            content: tag.to_string(),
        }));
        payloads.push(EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: r,
            col: 1,
            content: v.to_string(),
        }));
    }
    for (row, formula) in [
        // All positive: the minimum is 3, and 0 is not in the data at all.
        (10, "=MINIFS(B1:B2,A1:A2,\"a\")"),
        // All negative: the maximum is -9.
        (11, "=MAXIFS(B3:B3,A3:A3,\"b\")"),
        // Straddling zero still works, which is why this went unnoticed.
        (12, "=MINIFS(B1:B4,A1:A4,\"a\")"),
        // Nothing matches: 0 is the honest answer for an empty fold here,
        // and it is what the function returned before.
        (13, "=MINIFS(B1:B4,A1:A4,\"zzz\")"),
    ] {
        payloads.push(EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row,
            col: 5,
            content: formula.to_string(),
        }));
    }
    let effect = apply(&mut wb, payloads);
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));
    assert_eq!(cell_num(&wb, 10, 5), Some(3.0), "MINIFS over 3 and 5");
    assert_eq!(cell_num(&wb, 11, 5), Some(-9.0), "MAXIFS over -9");
    assert_eq!(cell_num(&wb, 12, 5), Some(-2.0), "MINIFS over 3, 5, -2");
    assert_eq!(cell_num(&wb, 13, 5), Some(0.0), "no matches");
}

#[test]
fn a_pivots_key_column_must_name_a_group_that_occurs_in_the_source() {
    // The pivot's key column is the ONE cell of the block a person can type
    // into — everything else is generated, and the engine already drops writes
    // to templated cells. And editing it does not re-aim the row (`#KEY` was
    // captured at materialization), so the row would go on reporting the old
    // group under the new label. The derived rule puts a marker on it the
    // moment it stops naming a real group. See `design/block-pivot.md` §4.3.
    let (mut wb, _src, _pivot) = sales_with_pivot("SUM", Some("quarter"));

    // Row 10 is the pivot's first record; column 0 is its key.
    let real = wb
        .check_field_validation(0, 10, 0, "North".to_string())
        .unwrap();
    assert!(real.has_rule, "a pivot's key column carries a derived rule");
    assert!(!real.violates, "North occurs in the source");
    assert!(
        real.rule.contains("COUNTIFS(") && real.rule.contains("region"),
        "the rule asks the source's own column: {}",
        real.rule
    );

    let typo = wb
        .check_field_validation(0, 10, 0, "Norht".to_string())
        .unwrap();
    assert!(
        typo.violates,
        "a group that does not occur in the source is flagged"
    );

    // A value column is generated, so it is not the thing being guarded here.
    let value_col = wb
        .check_field_validation(0, 10, 1, "123".to_string())
        .unwrap();
    assert!(
        !value_col.has_rule,
        "only the key column gets the membership rule"
    );
}

#[test]
fn a_total_rows_key_column_gets_no_membership_rule() {
    // The rule is a pivot's, not every analysis block's: a total row's label
    // ("Total") is a caption, not a group, and flagging it would be noise.
    use crate::block_manager::schema_manager::field_type::AggFunc;
    let (mut wb, _src, _analysis) = orders_with_analysis(AggFunc::Sum);
    let v = wb
        .check_field_validation(0, 3, 0, "Total".to_string())
        .unwrap();
    assert!(!v.has_rule);
}

// ---------------------------------------------------------------------------
// `pivot_plan`: the shape a pivot SHOULD have, and whether it has it.
// `design/block-pivot.md` §6 and §8.
// ---------------------------------------------------------------------------

/// Append a record to `sales`. Returns nothing; the block grows by one row.
fn add_sale(
    wb: &mut Workbook,
    src: logisheets_base::BlockId,
    at: usize,
    id: &str,
    region: &str,
    quarter: &str,
    amt: &str,
) {
    let mut payloads = vec![EditPayload::InsertRowsInBlock(
        crate::edit_action::InsertRowsInBlock {
            sheet_idx: 0,
            block_id: src,
            start: at,
            cnt: 1,
        },
    )];
    for (c, v) in [id, region, quarter, amt].iter().enumerate() {
        payloads.push(EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: at,
            col: c,
            content: v.to_string(),
        }));
    }
    let effect = apply(wb, payloads);
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "add_sale: {:?}",
        effect.error_message
    );
}

#[test]
fn a_fresh_pivot_is_not_stale() {
    let (wb, _src, pivot) = sales_with_pivot("SUM", Some("quarter"));
    let plan = wb.pivot_plan(0, pivot).unwrap();

    assert_eq!(plan.keys, vec!["East", "North", "South"]);
    assert_eq!(plan.fields, vec!["Q1", "Q2"]);
    assert!(!plan.is_stale, "it shows exactly what the source justifies");
    assert!(plan.missing_keys.is_empty());
    assert!(plan.extra_keys.is_empty());
    assert_eq!(plan.unassigned_records, 0);
}

#[test]
fn a_reorder_alone_is_not_staleness() {
    // The pivot was built with East/South/North; the plan sorts to
    // East/North/South. Every group is present and every number is right, so
    // flagging it would train a reader to ignore the flag.
    let (wb, _src, pivot) = sales_with_pivot("SUM", Some("quarter"));
    let plan = wb.pivot_plan(0, pivot).unwrap();
    assert_ne!(plan.keys, plan.current_keys, "the order does differ");
    assert!(!plan.is_stale);
}

#[test]
fn a_new_group_in_the_source_makes_the_pivot_stale_and_says_which() {
    // The failure this whole reporting story exists for: every number in the
    // pivot stays correct and a whole region is simply absent.
    let (mut wb, src, pivot) = sales_with_pivot("SUM", Some("quarter"));
    add_sale(&mut wb, src, 6, "o6", "Northwest", "Q1", "99");

    let plan = wb.pivot_plan(0, pivot).unwrap();
    assert!(plan.is_stale);
    assert_eq!(plan.missing_keys, vec!["Northwest"]);
    assert!(plan.extra_keys.is_empty());
    assert!(plan.keys.contains(&"Northwest".to_string()));
    // And the pivot's own numbers are still individually correct — which is
    // exactly why this needs reporting rather than trust.
    assert_eq!(cell_num(&wb, 10, 1), Some(10.0));
}

#[test]
fn a_new_column_value_is_reported_as_a_missing_field() {
    let (mut wb, src, pivot) = sales_with_pivot("SUM", Some("quarter"));
    add_sale(&mut wb, src, 6, "o6", "East", "Q3", "99");

    let plan = wb.pivot_plan(0, pivot).unwrap();
    assert!(plan.is_stale);
    assert_eq!(plan.missing_fields, vec!["Q3"]);
    assert!(plan.missing_keys.is_empty(), "East is already shown");
}

#[test]
fn a_group_that_vanishes_from_the_source_is_reported_as_extra() {
    // The other direction. Harmless to read — the row computes 0 — but it is a
    // group that no longer exists, and a refresh would drop it.
    let (mut wb, src, pivot) = sales_with_pivot("SUM", Some("quarter"));
    // North has exactly one record (o5, the last one).
    let effect = apply(
        &mut wb,
        vec![EditPayload::DeleteRowsInBlock(
            crate::edit_action::DeleteRowsInBlock {
                sheet_idx: 0,
                block_id: src,
                start: 5,
                cnt: 1,
            },
        )],
    );
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "{:?}",
        effect.error_message
    );

    let plan = wb.pivot_plan(0, pivot).unwrap();
    assert!(plan.is_stale);
    assert_eq!(plan.extra_keys, vec!["North"]);
    assert!(plan.missing_keys.is_empty());
    assert_eq!(cell_num(&wb, 12, 1), Some(0.0), "and its row now reads 0");
}

#[test]
fn records_with_a_blank_dimension_are_counted_rather_than_dropped_silently() {
    // A blank is not a group: an empty key is not addressable and a row whose
    // `#KEY` is "" would filter on the empty string. So those records are in
    // NO cell of the pivot and its grand total is short by their measure —
    // which is worth saying out loud, since nothing else in the sheet shows it.
    let (mut wb, src, pivot) = sales_with_pivot("SUM", Some("quarter"));
    add_sale(&mut wb, src, 6, "o6", "", "Q1", "99");

    let plan = wb.pivot_plan(0, pivot).unwrap();
    assert_eq!(plan.unassigned_records, 1);
    assert!(
        !plan.keys.iter().any(|k| k.is_empty()),
        "a blank does not become a group of its own"
    );
    assert!(
        !plan.is_stale,
        "no group is missing — the record is nowhere"
    );
}

#[test]
fn the_plan_orders_dimensions_deterministically() {
    // Ascending by default, with the same typed comparison `sort_block` uses,
    // so a refresh does not reshuffle rows every time it runs.
    let (mut wb, src, pivot) = sales_with_pivot("SUM", Some("quarter"));
    add_sale(&mut wb, src, 6, "o6", "Northwest", "Q3", "1");

    let a = wb.pivot_plan(0, pivot).unwrap();
    let b = wb.pivot_plan(0, pivot).unwrap();
    assert_eq!(a.keys, b.keys, "twice in a row gives the same order");
    assert_eq!(a.fields, vec!["Q1", "Q2", "Q3"], "sorted, not first-seen");
}

#[test]
fn first_seen_order_keeps_the_sources_own_sequence() {
    use crate::block_manager::schema_manager::field_type::PivotSpecParts;
    use crate::edit_action::SetBlockAnalyzes;

    let (mut wb, src, pivot) = sales_with_pivot("SUM", Some("quarter"));
    let effect = apply(
        &mut wb,
        vec![EditPayload::SetBlockAnalyzes(SetBlockAnalyzes {
            sheet_idx: 0,
            block_id: pivot,
            analyzes: Some(src),
            pivot: Some(PivotSpecParts {
                row_dim: "region".into(),
                col_dim: Some("quarter".into()),
                measure: "amt".into(),
                func: "SUM".into(),
                order: Some("firstSeen".into()),
                order_values: None,
                filters: None,
            }),
        })],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));

    let plan = wb.pivot_plan(0, pivot).unwrap();
    // Source order is East, East, South, South, South, North.
    assert_eq!(plan.keys, vec!["East", "South", "North"]);
}

#[test]
fn a_grouped_pivot_plans_rows_only() {
    // `col_dim: None` has one value column whose name means nothing, so there
    // is nothing to plan for it — and no way for it to be reported stale.
    let (mut wb, src, pivot) = sales_with_pivot("SUM", None);
    assert!(wb.pivot_plan(0, pivot).unwrap().fields.is_empty());

    add_sale(&mut wb, src, 6, "o6", "Northwest", "Q9", "1");
    let plan = wb.pivot_plan(0, pivot).unwrap();
    assert_eq!(plan.missing_keys, vec!["Northwest"], "rows still track");
    assert!(plan.missing_fields.is_empty(), "columns do not");
}

#[test]
fn planning_a_block_that_is_not_a_pivot_says_so() {
    use crate::block_manager::schema_manager::field_type::AggFunc;
    let (wb, src, analysis) = orders_with_analysis(AggFunc::Sum);
    for id in [src, analysis] {
        let err = wb.pivot_plan(0, id).unwrap_err();
        assert!(format!("{err:?}").contains("is not a pivot"), "got {err:?}");
    }
}

#[test]
fn a_recipe_naming_a_field_the_source_lost_is_an_error_not_an_empty_plan() {
    // An empty plan would read as "this pivot should have no rows", and a
    // refresh acting on it would delete the whole thing.
    use crate::block_manager::schema_manager::field_type::PivotSpecParts;
    use crate::edit_action::SetBlockAnalyzes;

    let (mut wb, src, pivot) = sales_with_pivot("SUM", Some("quarter"));
    let effect = apply(
        &mut wb,
        vec![EditPayload::SetBlockAnalyzes(SetBlockAnalyzes {
            sheet_idx: 0,
            block_id: pivot,
            analyzes: Some(src),
            pivot: Some(PivotSpecParts {
                row_dim: "nope".into(),
                col_dim: Some("quarter".into()),
                measure: "amt".into(),
                func: "SUM".into(),
                order: None,
                order_values: None,
                filters: None,
            }),
        })],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));
    let err = wb.pivot_plan(0, pivot).unwrap_err();
    assert!(
        format!("{err:?}").contains("which block") && format!("{err:?}").contains("nope"),
        "the error should name the field: {err:?}"
    );
}

#[test]
fn a_dimension_with_too_many_values_is_refused_with_the_count() {
    // A pivot over a column with hundreds of distinct values is not a pivot,
    // it is an unreadable wall — and a block that wide is slow to materialize.
    // Returning a plan nobody can apply would be worse than saying so, and the
    // message has to name the field and the limit or the user cannot act.
    use crate::block_manager::schema_manager::field_type::PivotSpecParts;
    use crate::edit_action::{BindFormSchema, SetBlockAnalyzes};

    let mut wb = Workbook::default();
    let src = wb.get_available_block_id(0).unwrap();
    const N: usize = 250;
    let mut payloads = vec![
        EditPayload::CreateBlock(CreateBlock {
            sheet_idx: 0,
            id: src,
            master_row: 0,
            master_col: 0,
            row_cnt: N,
            col_cnt: 3,
            owner: None,
            modify_policy: None,
            permissions: None,
            description: None,
            analyzes: None,
            pivot: None,
        }),
        EditPayload::BindFormSchema(BindFormSchema {
            ref_name: "wide".into(),
            sheet_idx: 0,
            block_id: src,
            field_from: 0,
            key_idx: 0,
            fields: vec![
                SchemaFieldSpec::new("id", "w0"),
                SchemaFieldSpec::new("tag", "w1"),
                SchemaFieldSpec::new("amt", "w2"),
            ],
            row: true,
        }),
    ];
    for r in 0..N {
        for (c, v) in [format!("k{r}"), format!("t{r}"), "1".to_string()]
            .iter()
            .enumerate()
        {
            payloads.push(EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: r,
                col: c,
                content: v.clone(),
            }));
        }
    }
    let effect = apply(&mut wb, payloads);
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "wide setup: {:?}",
        effect.error_message
    );

    let pivot = wb.get_available_block_id(0).unwrap();
    let effect = apply(
        &mut wb,
        vec![
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 0,
                id: pivot,
                master_row: 300,
                master_col: 0,
                row_cnt: 1,
                col_cnt: 2,
                owner: None,
                modify_policy: None,
                permissions: None,
                description: None,
                analyzes: Some(src),
                pivot: None,
            }),
            EditPayload::SetBlockAnalyzes(SetBlockAnalyzes {
                sheet_idx: 0,
                block_id: pivot,
                analyzes: Some(src),
                pivot: Some(PivotSpecParts {
                    // 250 distinct tags as COLUMNS, past the 200 cap.
                    row_dim: "amt".into(),
                    col_dim: Some("tag".into()),
                    measure: "amt".into(),
                    func: "SUM".into(),
                    order: None,
                    order_values: None,
                    filters: None,
                }),
            }),
        ],
    );
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "pivot setup: {:?}",
        effect.error_message
    );

    let err = wb.pivot_plan(0, pivot).unwrap_err();
    let msg = format!("{err:?}");
    assert!(msg.contains("tag"), "names the field: {msg}");
    assert!(msg.contains("200"), "names the limit: {msg}");
    assert!(msg.contains("columns"), "says which axis: {msg}");

    // The row dimension is fine (every record has amt = 1), so the refusal is
    // about the column dimension specifically, not about the block's size.
    let effect = apply(
        &mut wb,
        vec![EditPayload::SetBlockAnalyzes(SetBlockAnalyzes {
            sheet_idx: 0,
            block_id: pivot,
            analyzes: Some(src),
            pivot: Some(PivotSpecParts {
                row_dim: "amt".into(),
                col_dim: None,
                measure: "amt".into(),
                func: "SUM".into(),
                order: None,
                order_values: None,
                filters: None,
            }),
        })],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));
    assert_eq!(wb.pivot_plan(0, pivot).unwrap().keys, vec!["1"]);
}

#[test]
fn refreshing_a_pivot_with_a_trailing_no_op_resize_loses_the_new_row() {
    // Found while wiring `WorkbookOps.refreshPivot` and pinned here because it
    // is silent: after the refresh sequence (grow, write keys, bind), a
    // TRAILING resize to the size the block already has leaves the newly added
    // row's generated cells empty. The row is there, the key is there, the
    // schema is right — only the numbers are missing, so a refreshed pivot
    // looks like its newest group has no data.
    //
    // The host-side rule this forces: send the trailing resize only when the
    // block is actually SHRINKING, which is what `design/block-pivot.md` §6
    // says anyway ("shrink, if shrinking").
    use crate::edit_action::BindFormSchema;

    let refresh = |wb: &mut Workbook, pivot, trailing: bool| {
        let mut payloads = vec![
            resize_t(pivot, Some(4), Some(3)),
            // The plan's order: East, North, South, Northwest.
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 11,
                col: 0,
                content: "East".into(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 12,
                col: 0,
                content: "North".into(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 13,
                col: 0,
                content: "South".into(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 14,
                col: 0,
                content: "Northwest".into(),
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "sales_pivot".into(),
                sheet_idx: 0,
                block_id: pivot,
                field_from: 0,
                key_idx: 0,
                fields: vec![
                    SchemaFieldSpec::new("region", "p0"),
                    SchemaFieldSpec::new("Q1", "p1"),
                    SchemaFieldSpec::new("Q2", "p2"),
                ],
                row: true,
            }),
        ];
        if trailing {
            payloads.push(resize_t(pivot, Some(4), Some(3)));
        }
        let effect = apply(wb, payloads);
        assert!(
            matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
            "refresh: {:?}",
            effect.error_message
        );
    };

    let grow_source = |wb: &mut Workbook, src| {
        let mut payloads = vec![
            EditPayload::InsertRows(crate::edit_action::InsertRows {
                sheet_idx: 0,
                start: 6,
                count: 1,
            }),
            EditPayload::InsertRowsInBlock(crate::edit_action::InsertRowsInBlock {
                sheet_idx: 0,
                block_id: src,
                start: 6,
                cnt: 1,
            }),
        ];
        for (c, v) in ["o6", "Northwest", "Q1", "99"].iter().enumerate() {
            payloads.push(EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 6,
                col: c,
                content: v.to_string(),
            }));
        }
        let effect = apply(wb, payloads);
        assert!(matches!(
            effect.status,
            crate::edit_action::StatusCode::Ok(_)
        ));
    };

    // Without the trailing resize: the new group computes.
    let (mut a, src_a, pivot_a) = sales_with_pivot("SUM", Some("quarter"));
    grow_source(&mut a, src_a);
    refresh(&mut a, pivot_a, false);
    assert_eq!(cell_num(&a, 14, 1), Some(99.0), "Northwest Q1");

    // With it: the row is present and keyed, but its numbers are gone.
    let (mut b, src_b, pivot_b) = sales_with_pivot("SUM", Some("quarter"));
    grow_source(&mut b, src_b);
    refresh(&mut b, pivot_b, true);
    assert_eq!(cell_num(&b, 11, 1), Some(10.0), "existing rows survive");
    assert_eq!(
        cell_num(&b, 14, 1),
        None,
        "but the row the bind just materialized lost its numbers"
    );

    // Note the asymmetry, which is why this is characterised rather than
    // explained: the same trailing resize does NOT lose an AUTHORED template's
    // value (`growing_rows_and_rebinding_materializes_the_new_rows` plus a
    // no-op resize still computes). Only a GENERATED formula — the pivot's —
    // is affected. The cause is not established here; the behaviour is, so a
    // host cannot walk into it again.
}

// ---------------------------------------------------------------------------
// §9 of `design/block-pivot.md`: what a pivot can say beyond one measure over
// one cross-tab — a row total, a second measure, a custom order, and a filter
// on which source records count at all.
// ---------------------------------------------------------------------------

/// `sales` plus a pivot whose columns are given explicitly, so a test can add
/// a total column or a second measure. `columns` is `(field name, spec)`.
fn sales_with_columns(
    spec: crate::block_manager::schema_manager::field_type::PivotSpecParts,
    columns: &[SchemaFieldSpec],
    keys: &[&str],
) -> (Workbook, logisheets_base::BlockId, logisheets_base::BlockId) {
    use crate::edit_action::BindFormSchema;

    let mut wb = Workbook::default();
    let src = sales_block(&mut wb);
    let pivot = wb.get_available_block_id(0).unwrap();

    let mut payloads = vec![EditPayload::CreateBlock(CreateBlock {
        sheet_idx: 0,
        id: pivot,
        master_row: 10,
        master_col: 0,
        row_cnt: keys.len(),
        col_cnt: 1 + columns.len(),
        owner: None,
        modify_policy: None,
        permissions: None,
        description: None,
        analyzes: Some(src),
        pivot: Some(spec),
    })];
    for (i, k) in keys.iter().enumerate() {
        payloads.push(EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 10 + i,
            col: 0,
            content: k.to_string(),
        }));
    }
    let mut fields = vec![SchemaFieldSpec::new("region", "p0")];
    fields.extend(columns.iter().cloned());
    payloads.push(EditPayload::BindFormSchema(BindFormSchema {
        ref_name: "sales_pivot".into(),
        sheet_idx: 0,
        block_id: pivot,
        field_from: 0,
        key_idx: 0,
        fields,
        row: true,
    }));

    let effect = apply(&mut wb, payloads);
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "pivot setup: {:?}",
        effect.error_message
    );
    (wb, src, pivot)
}

fn cross_tab_spec() -> crate::block_manager::schema_manager::field_type::PivotSpecParts {
    crate::block_manager::schema_manager::field_type::PivotSpecParts {
        row_dim: "region".into(),
        col_dim: Some("quarter".into()),
        measure: "amt".into(),
        func: "SUM".into(),
        order: Some("ascending".into()),
        order_values: None,
        filters: None,
    }
}

/// A source whose measure column has GAPS and a non-numeric entry — the only
/// shape in which COUNT and COUNTA can be told apart.
fn gappy_block(wb: &mut Workbook) -> logisheets_base::BlockId {
    use crate::edit_action::BindFormSchema;
    let src = wb.get_available_block_id(0).unwrap();
    // East: 10 and a blank. South: "n/a" and 5. So for East COUNT=1 COUNTA=1
    // (the blank is neither), and for South COUNT=1 COUNTA=2 — the text counts
    // as present but is not a number.
    let rows = [
        ("o0", "East", "10"),
        ("o1", "East", ""),
        ("o2", "South", "n/a"),
        ("o3", "South", "5"),
    ];
    let mut payloads = vec![
        EditPayload::CreateBlock(CreateBlock {
            sheet_idx: 0,
            id: src,
            master_row: 0,
            master_col: 0,
            row_cnt: rows.len(),
            col_cnt: 3,
            owner: None,
            modify_policy: None,
            permissions: None,
            description: None,
            analyzes: None,
            pivot: None,
        }),
        EditPayload::BindFormSchema(BindFormSchema {
            ref_name: "gappy".into(),
            sheet_idx: 0,
            block_id: src,
            field_from: 0,
            key_idx: 0,
            fields: vec![
                SchemaFieldSpec::new("id", "g0"),
                SchemaFieldSpec::new("region", "g1"),
                SchemaFieldSpec::new("amt", "g2"),
            ],
            row: true,
        }),
    ];
    for (r, (id, region, amt)) in rows.iter().enumerate() {
        for (c, v) in [id, region, amt].iter().enumerate() {
            if v.is_empty() {
                continue; // the gap is the point
            }
            payloads.push(EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: r,
                col: c,
                content: v.to_string(),
            }));
        }
    }
    let effect = apply(wb, payloads);
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "gappy setup: {:?}",
        effect.error_message
    );
    src
}

#[test]
fn counta_counts_present_values_where_count_counts_numbers() {
    // The distinction COUNTA exists for. A pivot COUNT counts matching
    // RECORDS; COUNTA counts the ones whose measure is actually there — which
    // is the question "how many of these did we fill in?", and it is not
    // answerable with any other aggregate.
    use crate::block_manager::schema_manager::field_type::PivotSpecParts;
    use crate::edit_action::BindFormSchema;

    let mut wb = Workbook::default();
    let src = gappy_block(&mut wb);
    let pivot = wb.get_available_block_id(0).unwrap();

    let spec = PivotSpecParts {
        row_dim: "region".into(),
        col_dim: None,
        measure: "amt".into(),
        func: "COUNTA".into(),
        order: Some("ascending".into()),
        order_values: None,
        filters: None,
    };
    let mut payloads = vec![EditPayload::CreateBlock(CreateBlock {
        sheet_idx: 0,
        id: pivot,
        master_row: 10,
        master_col: 0,
        row_cnt: 2,
        col_cnt: 3,
        owner: None,
        modify_policy: None,
        permissions: None,
        description: None,
        analyzes: Some(src),
        pivot: Some(spec),
    })];
    for (i, k) in ["East", "South"].iter().enumerate() {
        payloads.push(EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 10 + i,
            col: 0,
            content: k.to_string(),
        }));
    }
    payloads.push(EditPayload::BindFormSchema(BindFormSchema {
        ref_name: "gappy_pivot".into(),
        sheet_idx: 0,
        block_id: pivot,
        field_from: 0,
        key_idx: 0,
        fields: vec![
            SchemaFieldSpec::new("region", "p0"),
            SchemaFieldSpec::new("filled", "p1"),
            // Beside it, the same groups counted the other two ways.
            SchemaFieldSpec::new("records", "p2").with_pivot_column(
                None,
                crate::block_manager::schema_manager::field_type::AggFunc::Count,
                "amt",
            ),
        ],
        row: true,
    }));
    let effect = apply(&mut wb, payloads);
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "pivot setup: {:?}",
        effect.error_message
    );

    // East has one filled amt and one blank; South has "n/a" and 5.
    assert_eq!(cell_num(&wb, 10, 1), Some(1.0), "East: one amt present");
    assert_eq!(
        cell_num(&wb, 11, 1),
        Some(2.0),
        "South: \"n/a\" is present even though it is not a number"
    );
    // COUNT counts matching RECORDS, so it does not notice the gap at all.
    assert_eq!(cell_num(&wb, 10, 2), Some(2.0), "East: two records");
    assert_eq!(cell_num(&wb, 11, 2), Some(2.0), "South: two records");
}

#[test]
fn a_counta_recipe_survives_a_real_xlsx_round_trip() {
    // `func` is a free string on the wire precisely so a newer aggregate does
    // not stop an older build opening the file; this is the other half of that
    // — a build that KNOWS it must read it back.
    use crate::block_manager::schema_manager::field_type::{AggFunc, PivotSpecParts};
    let spec = PivotSpecParts {
        func: "COUNTA".into(),
        ..cross_tab_spec()
    };
    let (wb, _src, pivot) = sales_with_columns(
        spec,
        &[SchemaFieldSpec::new("Q1", "p1")],
        &["East", "South"],
    );
    let bytes = wb.save().expect("save");
    let restored = Workbook::from_file(&bytes, "rt".to_string()).expect("load");
    let ws = restored.get_sheet_by_idx(0).unwrap();
    let p = ws
        .get_all_blocks()
        .into_iter()
        .find(|b| b.block_id == pivot)
        .expect("the pivot survived");
    assert_eq!(
        p.pivot.as_ref().unwrap().func,
        AggFunc::CountA.as_str(),
        "the aggregate came back as COUNTA, not as a guess"
    );
}

#[test]
fn a_row_total_column_spans_every_value_of_the_column_dimension() {
    // The in-pivot total. A column declaring `col_value: *` drops the column
    // criteria pair entirely, which is exactly the grouped lowering — so the
    // same generator produces both, and there is no second code path to keep
    // in step.
    let (wb, _src, _pivot) = sales_with_columns(
        cross_tab_spec(),
        &[
            SchemaFieldSpec::new("Q1", "p1"),
            SchemaFieldSpec::new("Q2", "p2"),
            SchemaFieldSpec::new("Total", "p3").with_pivot_total(),
        ],
        &["East", "South", "North"],
    );

    // East: Q1 10, Q2 20, total 30.
    assert_eq!(cell_num(&wb, 10, 1), Some(10.0));
    assert_eq!(cell_num(&wb, 10, 2), Some(20.0));
    assert_eq!(cell_num(&wb, 10, 3), Some(30.0), "East total");
    // South: 3 + 4 in Q1, 5 in Q2, total 12.
    assert_eq!(cell_num(&wb, 11, 3), Some(12.0), "South total");
    // North: only Q1 = 7.
    assert_eq!(cell_num(&wb, 12, 3), Some(7.0), "North total");
}

#[test]
fn a_pivot_can_carry_a_second_measure() {
    // `SUM of amt` beside `COUNT` of the same rows. The block-level recipe
    // becomes a default; a column that says otherwise wins.
    use crate::block_manager::schema_manager::field_type::AggFunc;
    let (wb, _src, _pivot) = sales_with_columns(
        cross_tab_spec(),
        &[
            SchemaFieldSpec::new("Q1", "p1"),
            SchemaFieldSpec::new("Q1 Orders", "p2").with_pivot_column(
                Some("Q1"),
                AggFunc::Count,
                "amt",
            ),
            SchemaFieldSpec::new("Mean", "p3").with_pivot_column(None, AggFunc::Average, "amt"),
        ],
        &["East", "South"],
    );

    assert_eq!(cell_num(&wb, 10, 1), Some(10.0), "East Q1 amount");
    assert_eq!(cell_num(&wb, 10, 2), Some(1.0), "East has one Q1 record");
    assert_eq!(cell_num(&wb, 11, 1), Some(7.0), "South Q1 = 3 + 4");
    assert_eq!(cell_num(&wb, 11, 2), Some(2.0), "South has two Q1 records");
    // The average column spans every quarter: South is (3+4+5)/3 = 4.
    assert_eq!(cell_num(&wb, 11, 3), Some(4.0), "South average over all");
}

#[test]
fn a_refresh_keeps_the_columns_a_person_declared() {
    // The rule that makes totals and second measures survive: the plan owns
    // the DERIVED columns and nothing else. A total column is not a value the
    // source has, so "the source no longer justifies it" must not apply to it.
    use crate::block_manager::schema_manager::field_type::AggFunc;
    let (wb, _src, pivot) = sales_with_columns(
        cross_tab_spec(),
        &[
            SchemaFieldSpec::new("Q1", "p1"),
            SchemaFieldSpec::new("Q2", "p2"),
            SchemaFieldSpec::new("Total", "p3").with_pivot_total(),
            SchemaFieldSpec::new("Orders", "p4").with_pivot_column(None, AggFunc::Count, "amt"),
        ],
        &["East", "South", "North"],
    );

    let plan = wb.pivot_plan(0, pivot).unwrap();
    assert_eq!(
        plan.fields,
        vec!["Q1", "Q2", "Total", "Orders"],
        "derived columns first, hand-declared ones after"
    );
    assert!(
        plan.extra_fields.is_empty(),
        "a declared column is never 'extra': {:?}",
        plan.extra_fields
    );
    assert!(!plan.is_stale);
}

#[test]
fn a_declared_column_on_a_block_that_is_not_a_pivot_is_refused() {
    // It would be silently inert, and a declaration that does nothing is worse
    // than a refusal: its author believes it took effect.
    use crate::block_manager::schema_manager::field_type::AggFunc;
    use crate::edit_action::BindFormSchema;

    let (mut wb, src, _analysis) = orders_with_analysis(AggFunc::Sum);
    let effect = apply(
        &mut wb,
        vec![EditPayload::BindFormSchema(BindFormSchema {
            ref_name: "orders".into(),
            sheet_idx: 0,
            block_id: src,
            field_from: 0,
            key_idx: 0,
            fields: vec![
                SchemaFieldSpec::new("key", "s0"),
                SchemaFieldSpec::new("amt", "s1").with_pivot_total(),
            ],
            row: true,
        })],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Err(_)
    ));
    assert!(
        effect
            .error_message
            .as_deref()
            .unwrap_or_default()
            .contains("is not a pivot"),
        "{:?}",
        effect.error_message
    );
}

#[test]
fn a_custom_order_puts_the_dimensions_where_the_business_wants_them() {
    // Neither ascending nor first-seen can express a month ladder or a
    // reporting sequence, and both are wrong for them.
    use crate::block_manager::schema_manager::field_type::PivotSpecParts;
    let spec = PivotSpecParts {
        order: Some("custom".into()),
        order_values: Some(vec!["North".into(), "East".into(), "South".into()]),
        ..cross_tab_spec()
    };
    let (wb, _src, pivot) = sales_with_columns(
        spec,
        &[SchemaFieldSpec::new("Q1", "p1")],
        &["East", "South", "North"],
    );
    assert_eq!(
        wb.pivot_plan(0, pivot).unwrap().keys,
        vec!["North", "East", "South"]
    );
}

#[test]
fn a_value_the_custom_order_does_not_mention_still_gets_a_row() {
    // The trap a custom order invites: listing three regions and silently
    // losing the fourth. A hidden group is the exact failure this design
    // reports rather than commits, so unlisted values follow the list in
    // ascending order instead of vanishing.
    use crate::block_manager::schema_manager::field_type::PivotSpecParts;
    let spec = PivotSpecParts {
        order: Some("custom".into()),
        // South deliberately unlisted.
        order_values: Some(vec!["North".into(), "East".into()]),
        ..cross_tab_spec()
    };
    let (wb, _src, pivot) = sales_with_columns(
        spec,
        &[SchemaFieldSpec::new("Q1", "p1")],
        &["East", "South", "North"],
    );
    let plan = wb.pivot_plan(0, pivot).unwrap();
    assert_eq!(plan.keys, vec!["North", "East", "South"]);
    assert!(
        plan.keys.contains(&"South".to_string()),
        "an unlisted value is ordered last, never dropped"
    );
}

#[test]
fn a_key_excluded_by_a_filter_is_flagged_even_though_it_occurs_in_the_source() {
    // "Occurs in the source" and "belongs in this pivot" stop being the same
    // question once a filter exists, and the CELLS answer the second one. The
    // key rule used to answer the first, so a region every filter excluded was
    // accepted into the key column and its row then read 0 in every cell — an
    // unmarked empty row, which is exactly what this rule exists to prevent.
    use crate::block_manager::schema_manager::field_type::{PivotFilter, PivotSpecParts};
    let spec = PivotSpecParts {
        filters: Some(vec![PivotFilter {
            field: "region".into(),
            criteria: "<>North".into(),
        }]),
        col_dim: None,
        ..cross_tab_spec()
    };
    let (mut wb, _src, _pivot) = sales_with_columns(
        spec,
        &[SchemaFieldSpec::new("amt", "p1")],
        // North is deliberately absent: the filter excludes it.
        &["East", "South"],
    );

    // Row 10 is the pivot's first record; column 0 is its key.
    let included = wb
        .check_field_validation(0, 10, 0, "South".to_string())
        .unwrap();
    assert!(
        !included.violates,
        "South survives the filter, so it is a group this pivot has"
    );

    let excluded = wb
        .check_field_validation(0, 10, 0, "North".to_string())
        .unwrap();
    assert!(
        excluded.violates,
        "North is a real region the filter excludes — its row would read 0 in \
         every cell, so the key must be flagged: {}",
        excluded.rule
    );
    assert!(
        excluded.rule.contains("<>North"),
        "the rule carries the pivot's own filters: {}",
        excluded.rule
    );

    let unreal = wb
        .check_field_validation(0, 10, 0, "Atlantis".to_string())
        .unwrap();
    assert!(
        unreal.violates,
        "and a value that never occurs is still flagged"
    );
}

#[test]
fn a_source_filter_narrows_the_numbers_and_the_rows_together() {
    // The property that makes a filter honest: it is applied to the cells AND
    // to the plan. Applied to only the cells, a filtered-out group would keep
    // its row and show a confident 0; applied to only the plan, its numbers
    // would still be inside someone else's total.
    use crate::block_manager::schema_manager::field_type::{PivotFilter, PivotSpecParts};
    let spec = PivotSpecParts {
        filters: Some(vec![PivotFilter {
            field: "quarter".into(),
            criteria: "Q1".into(),
        }]),
        col_dim: None,
        ..cross_tab_spec()
    };
    // North only has a Q1 record, so it survives; every region does here.
    let (wb, _src, pivot) = sales_with_columns(
        spec,
        &[SchemaFieldSpec::new("amt", "p1")],
        &["East", "South", "North"],
    );

    // Only Q1 amounts: East 10, South 3 + 4, North 7 — the Q2 rows are gone.
    assert_eq!(cell_num(&wb, 10, 1), Some(10.0), "East without its Q2 20");
    assert_eq!(cell_num(&wb, 11, 1), Some(7.0), "South without its Q2 5");
    assert_eq!(cell_num(&wb, 12, 1), Some(7.0), "North");

    let plan = wb.pivot_plan(0, pivot).unwrap();
    assert_eq!(plan.keys, vec!["East", "North", "South"], "ascending");
    assert!(!plan.is_stale);
}

#[test]
fn a_filter_that_excludes_a_group_entirely_removes_its_row() {
    // The half that only works because the plan filters too.
    use crate::block_manager::schema_manager::field_type::{PivotFilter, PivotSpecParts};
    let spec = PivotSpecParts {
        filters: Some(vec![PivotFilter {
            field: "quarter".into(),
            criteria: "Q2".into(),
        }]),
        col_dim: None,
        ..cross_tab_spec()
    };
    // North has no Q2 record at all, so the filtered pivot must not offer it a
    // row that would read 0 as if that were its Q2 total.
    let (wb, _src, pivot) = sales_with_columns(
        spec,
        &[SchemaFieldSpec::new("amt", "p1")],
        &["East", "South", "North"],
    );
    let plan = wb.pivot_plan(0, pivot).unwrap();
    assert_eq!(plan.keys, vec!["East", "South"], "North is filtered out");
    assert_eq!(plan.extra_keys, vec!["North"]);
    assert!(plan.is_stale, "and the pivot is told to drop that row");
}

#[test]
fn a_numeric_filter_uses_the_same_condition_syntax_as_the_formula() {
    // `>5` means one thing, and it means it in both places, because both go
    // through the calc engine's own `parse_condition` / `match_condition`.
    use crate::block_manager::schema_manager::field_type::{PivotFilter, PivotSpecParts};
    let spec = PivotSpecParts {
        filters: Some(vec![PivotFilter {
            field: "amt".into(),
            criteria: ">5".into(),
        }]),
        col_dim: None,
        ..cross_tab_spec()
    };
    // Records over 5: East 10, East 20, North 7. South's 3/4/5 all fall out.
    let (wb, _src, pivot) = sales_with_columns(
        spec,
        &[SchemaFieldSpec::new("amt", "p1")],
        &["East", "North"],
    );
    assert_eq!(cell_num(&wb, 10, 1), Some(30.0), "East 10 + 20");
    assert_eq!(cell_num(&wb, 11, 1), Some(7.0), "North");
    let plan = wb.pivot_plan(0, pivot).unwrap();
    assert_eq!(
        plan.keys,
        vec!["East", "North"],
        "South has no record over 5"
    );
}

#[test]
fn a_filter_naming_a_field_the_source_lacks_is_an_error() {
    // Not a no-op: the CELLS would still filter on it and read 0, so a plan
    // that quietly ignored the filter would disagree with the numbers.
    use crate::block_manager::schema_manager::field_type::{PivotFilter, PivotSpecParts};
    let spec = PivotSpecParts {
        filters: Some(vec![PivotFilter {
            field: "nope".into(),
            criteria: "x".into(),
        }]),
        ..cross_tab_spec()
    };
    let (wb, _src, pivot) =
        sales_with_columns(spec, &[SchemaFieldSpec::new("Q1", "p1")], &["East"]);
    let err = wb.pivot_plan(0, pivot).unwrap_err();
    assert!(
        format!("{err:?}").contains("filters on") && format!("{err:?}").contains("nope"),
        "{err:?}"
    );
}

#[test]
fn a_pivots_inherited_number_formats_survive_a_round_trip() {
    // The formats are the newest part of a pivot and the easiest to lose,
    // because they do not live on the recipe or the schema — they hang off the
    // fields' RENDER ids. A pivot that reopens as bare numbers beside a
    // currency source is the kind of wrongness a reader blames on the data.
    use crate::edit_action::UpsertFieldRenderInfo;
    let money = "\"$\"#,##0.00";
    let (mut wb, _src, pivot) = sales_with_columns(
        cross_tab_spec(),
        &[
            SchemaFieldSpec::new("Q1", "p1"),
            SchemaFieldSpec::new("Total", "p2").with_pivot_total(),
        ],
        &["East", "South"],
    );
    // What every host sends after creating a pivot: the measure's format onto
    // each value column, and nothing onto the key.
    let effect = apply(
        &mut wb,
        vec![
            EditPayload::UpsertFieldRenderInfo(UpsertFieldRenderInfo {
                render_id: "p1".to_string(),
                diy_render: false,
                style_update: crate::edit_action::StyleUpdateType {
                    set_num_fmt: Some(money.to_string()),
                    ..Default::default()
                },
            }),
            EditPayload::UpsertFieldRenderInfo(UpsertFieldRenderInfo {
                render_id: "p2".to_string(),
                diy_render: false,
                style_update: crate::edit_action::StyleUpdateType {
                    set_num_fmt: Some(money.to_string()),
                    ..Default::default()
                },
            }),
        ],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));

    let bytes = wb.save().expect("save");
    let restored = Workbook::from_file(&bytes, "rt".to_string()).expect("load");
    let ws = restored.get_sheet_by_idx(0).unwrap();
    let blocks = ws.get_all_blocks();
    let p = blocks.iter().find(|b| b.block_id == pivot).unwrap();

    let fmt_of = |render_id: &str| {
        p.field_renders
            .iter()
            .find(|r| r.render_id == render_id)
            .and_then(|r| r.style.as_ref())
            .map(|s| s.formatter.clone())
            .unwrap_or_default()
    };
    assert_eq!(fmt_of("p1"), money, "the derived column");
    assert_eq!(fmt_of("p2"), money, "and the declared total");
    // The values are still there and still right, which is the other half of
    // "nothing was lost": a format on an empty cell is no use.
    assert_eq!(cell_num(&restored, 10, 1), Some(10.0), "East Q1");
    assert_eq!(cell_num(&restored, 11, 1), Some(7.0), "South Q1");
}

/// The OOXML pivot parts the save generates, or `None` when none were.
fn saved_pivot_parts(
    wb: &Workbook,
) -> Option<(
    logisheets_workbook::workbook::PivotCache,
    logisheets_workbook::workbook::PivotTablePart,
)> {
    let saved = crate::file_saver::save_file(&wb.controller, false).expect("save");
    let cache = saved.xl.pivot_caches.first()?.clone();
    let table = saved
        .xl
        .worksheets
        .values()
        .flat_map(|w| w.pivot_tables.iter())
        .next()?
        .clone();
    Some((cache, table))
}

#[test]
fn a_plain_pivot_is_also_written_as_a_real_ooxml_pivot_table() {
    // Our pivot's cells are `SUMIFS(BLOCKREFSB(..))`, and `BLOCKREFSB` is
    // ours: Excel shows the cached numbers and then `#NAME?` the moment it
    // recalculates. Declaring the pivot in Excel's own vocabulary is what
    // makes the file mean the same thing in both places.
    let (wb, _src, _pivot) = sales_with_columns(
        cross_tab_spec(),
        &[
            SchemaFieldSpec::new("Q1", "p1"),
            SchemaFieldSpec::new("Q2", "p2"),
        ],
        &["East", "South"],
    );
    let (cache, table) = saved_pivot_parts(&wb).expect("a pivot part was generated");

    // The cache names the source's TABLE — which the same save emits from the
    // source block — instead of copying its rows.
    assert_eq!(
        cache
            .definition
            .cache_source
            .worksheet_source
            .as_ref()
            .unwrap()
            .name
            .as_deref(),
        Some("sales")
    );
    assert!(cache.definition.refresh_on_load, "Excel builds the records");
    assert!(cache.records.is_none(), "so we ship none");

    // Axes point at the SOURCE's field indices: id, region, quarter, amt.
    assert_eq!(table.definition.row_fields.as_ref().unwrap().field[0].x, 1);
    assert_eq!(table.definition.col_fields.as_ref().unwrap().field[0].x, 2);
    assert_eq!(
        table.definition.data_fields.as_ref().unwrap().data_field[0].fld,
        3
    );
    // The label row plus the block's two rows: the pivot block starts at row
    // 10 (0-based), so the labels are on row 9 — A10:C12 in A1 terms.
    assert_eq!(table.definition.location.reference, "A10:C12");
}

#[test]
fn a_pivot_excel_cannot_express_gets_no_pivot_part() {
    // A filter is the clearest case: ours is a condition evaluated per record,
    // Excel's selects items from a list. A pivot table Excel would render with
    // different numbers than the sheet it sits in is worse than none, so we
    // emit none — the block is still saved, as our own values and recipe.
    use crate::block_manager::schema_manager::field_type::{PivotFilter, PivotSpecParts};
    let spec = PivotSpecParts {
        filters: Some(vec![PivotFilter {
            field: "quarter".into(),
            criteria: "Q1".into(),
        }]),
        ..cross_tab_spec()
    };
    let (wb, _src, _pivot) = sales_with_columns(
        spec,
        &[SchemaFieldSpec::new("Q1", "p1")],
        &["East", "South"],
    );
    assert!(
        saved_pivot_parts(&wb).is_none(),
        "a filtered pivot is not expressible as an OOXML pivot table"
    );
}

#[test]
fn a_generated_pivot_part_leaves_no_formulas_in_its_own_range() {
    // A native pivot table OWNS its range: Excel's files hold values there and
    // no formulas, and ours would hold a formula Excel cannot evaluate. So the
    // cells go out as values — which loses nothing, because a pivot's cells
    // are generated and the LOADER re-materializes every one of them.
    let (wb, _src, _pivot) = sales_with_columns(
        cross_tab_spec(),
        &[SchemaFieldSpec::new("Q1", "p1")],
        &["East", "South"],
    );
    let saved = crate::file_saver::save_file(&wb.controller, false).expect("save");
    let ws = saved.xl.worksheets.values().next().unwrap();
    for row in ws.worksheet_part.sheet_data.rows.iter() {
        for cell in row.cells.iter() {
            let Some(r) = cell.r.as_deref() else { continue };
            let Some((ri, ci)) = crate::sqref::a1_to_row_col(r) else {
                continue;
            };
            // The pivot block is rows 10..11, columns 0..1.
            if (10..12).contains(&ri) && ci < 2 {
                assert!(
                    cell.f.is_none(),
                    "{r} still carries a formula inside the pivot's range"
                );
            }
        }
    }
    // And the numbers are there, so Excel has something to show before it
    // refreshes the cache.
    let has_values = ws.worksheet_part.sheet_data.rows.iter().any(|row| {
        row.cells
            .iter()
            .any(|c| c.r.as_deref() == Some("B11") && c.v.is_some())
    });
    assert!(has_values, "the computed values are still written");
}

#[test]
fn everything_in_section_nine_survives_a_real_xlsx_round_trip() {
    // Three lists and a per-field override, all of which have to persist or
    // the pivot silently reverts to a plain cross-tab on reopen.
    use crate::block_manager::schema_manager::field_type::{AggFunc, PivotFilter, PivotSpecParts};
    let spec = PivotSpecParts {
        order: Some("custom".into()),
        order_values: Some(vec!["North".into(), "East".into()]),
        filters: Some(vec![PivotFilter {
            field: "quarter".into(),
            criteria: "Q1".into(),
        }]),
        ..cross_tab_spec()
    };
    let (wb, _src, pivot) = sales_with_columns(
        spec,
        &[
            SchemaFieldSpec::new("Q1", "p1"),
            SchemaFieldSpec::new("Total", "p2").with_pivot_total(),
            SchemaFieldSpec::new("Orders", "p3").with_pivot_column(None, AggFunc::Count, "amt"),
        ],
        &["North", "East", "South"],
    );

    let bytes = wb.save().expect("save");
    let restored = Workbook::from_file(&bytes, "rt".to_string()).expect("load");

    let ws = restored.get_sheet_by_idx(0).unwrap();
    let blocks = ws.get_all_blocks();
    let p = blocks.iter().find(|b| b.block_id == pivot).unwrap();
    let s = p.pivot.as_ref().expect("the recipe survived");
    assert_eq!(s.order.as_deref(), Some("custom"));
    assert_eq!(s.order_values.as_deref().unwrap(), ["North", "East"]);
    let filters = s.filters.as_deref().unwrap();
    assert_eq!(filters.len(), 1);
    assert_eq!(filters[0].field, "quarter");
    assert_eq!(filters[0].criteria, "Q1");

    let fields = &p.schema.as_ref().unwrap().fields;
    let total = fields.iter().find(|f| f.field == "Total").unwrap();
    assert_eq!(total.pivot_col_value.as_deref(), Some("*"));
    let count = fields.iter().find(|f| f.field == "Orders").unwrap();
    assert_eq!(count.pivot_col_value.as_deref(), Some("*"));
    assert_eq!(count.pivot_func.as_deref(), Some("COUNT"));
    assert_eq!(count.pivot_measure.as_deref(), Some("amt"));
    // A derived column keeps saying nothing.
    let q1 = fields.iter().find(|f| f.field == "Q1").unwrap();
    assert_eq!(q1.pivot_col_value, None);

    // And it still computes from the restored declaration.
    assert_eq!(cell_num(&restored, 10, 1), Some(7.0), "North Q1");
}

// ---------------------------------------------------------------------------
// Renaming a source field must not leave its dependents reading 0.
// ---------------------------------------------------------------------------

/// Re-bind `sales` with `region` renamed to `area`, keeping every render id —
/// which is what makes it a RENAME rather than a drop plus an add.
fn rename_region_to_area(wb: &mut Workbook, src: logisheets_base::BlockId) {
    use crate::edit_action::BindFormSchema;
    let effect = apply(
        wb,
        vec![EditPayload::BindFormSchema(BindFormSchema {
            ref_name: "sales".into(),
            sheet_idx: 0,
            block_id: src,
            field_from: 0,
            key_idx: 0,
            fields: vec![
                SchemaFieldSpec::new("id", "s0"),
                SchemaFieldSpec::new("area", "s1"),
                SchemaFieldSpec::new("quarter", "s2"),
                SchemaFieldSpec::new("amt", "s3"),
            ],
            row: true,
        })],
    );
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "rename: {:?}",
        effect.error_message
    );
}

#[test]
fn renaming_a_source_field_carries_into_a_pivots_recipe() {
    // Before this, the pivot kept saying `rows = region`, `BLOCKREFS` matched
    // nothing, and every cell read 0 — with no error anywhere on the sheet.
    let (mut wb, src, pivot) = sales_with_pivot("SUM", Some("quarter"));
    assert_eq!(cell_num(&wb, 10, 1), Some(10.0), "sanity");

    rename_region_to_area(&mut wb, src);

    assert_eq!(cell_num(&wb, 10, 1), Some(10.0), "East Q1 still computes");
    assert_eq!(cell_num(&wb, 11, 1), Some(7.0), "South Q1 = 3 + 4");
    let ws = wb.get_sheet_by_idx(0).unwrap();
    let blocks = ws.get_all_blocks();
    let p = blocks.iter().find(|b| b.block_id == pivot).unwrap();
    assert_eq!(
        p.pivot.as_ref().unwrap().row_dim,
        "area",
        "the recipe followed the rename"
    );
    // And the plan agrees, rather than erroring on a field that is gone.
    assert_eq!(wb.pivot_plan(0, pivot).unwrap().keys.len(), 3);
}

#[test]
fn renaming_a_measure_carries_into_the_recipe_and_the_declared_columns() {
    use crate::block_manager::schema_manager::field_type::AggFunc;
    use crate::edit_action::BindFormSchema;

    let (mut wb, src, pivot) = sales_with_columns(
        cross_tab_spec(),
        &[
            SchemaFieldSpec::new("Q1", "p1"),
            // A hand-declared column names the measure a SECOND time.
            SchemaFieldSpec::new("Mean", "p2").with_pivot_column(None, AggFunc::Average, "amt"),
        ],
        &["East", "South"],
    );
    assert_eq!(cell_num(&wb, 10, 2), Some(15.0), "East average of 10, 20");

    let effect = apply(
        &mut wb,
        vec![EditPayload::BindFormSchema(BindFormSchema {
            ref_name: "sales".into(),
            sheet_idx: 0,
            block_id: src,
            field_from: 0,
            key_idx: 0,
            fields: vec![
                SchemaFieldSpec::new("id", "s0"),
                SchemaFieldSpec::new("region", "s1"),
                SchemaFieldSpec::new("quarter", "s2"),
                SchemaFieldSpec::new("amount", "s3"),
            ],
            row: true,
        })],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));

    assert_eq!(cell_num(&wb, 10, 1), Some(10.0), "the derived column");
    assert_eq!(cell_num(&wb, 10, 2), Some(15.0), "and the declared one");
    let ws = wb.get_sheet_by_idx(0).unwrap();
    let blocks = ws.get_all_blocks();
    let p = blocks.iter().find(|b| b.block_id == pivot).unwrap();
    assert_eq!(p.pivot.as_ref().unwrap().measure, "amount");
    let declared = p
        .schema
        .as_ref()
        .unwrap()
        .fields
        .iter()
        .find(|f| f.field == "Mean")
        .unwrap();
    assert_eq!(declared.pivot_measure.as_deref(), Some("amount"));
}

#[test]
fn renaming_a_filtered_field_carries_into_the_filter() {
    use crate::block_manager::schema_manager::field_type::{PivotFilter, PivotSpecParts};
    let spec = PivotSpecParts {
        col_dim: None,
        filters: Some(vec![PivotFilter {
            field: "quarter".into(),
            criteria: "Q1".into(),
        }]),
        ..cross_tab_spec()
    };
    let (mut wb, src, pivot) = sales_with_columns(
        spec,
        &[SchemaFieldSpec::new("amt", "p1")],
        &["East", "South", "North"],
    );
    assert_eq!(cell_num(&wb, 10, 1), Some(10.0), "East Q1 only");

    use crate::edit_action::BindFormSchema;
    let effect = apply(
        &mut wb,
        vec![EditPayload::BindFormSchema(BindFormSchema {
            ref_name: "sales".into(),
            sheet_idx: 0,
            block_id: src,
            field_from: 0,
            key_idx: 0,
            fields: vec![
                SchemaFieldSpec::new("id", "s0"),
                SchemaFieldSpec::new("region", "s1"),
                SchemaFieldSpec::new("quarter", "s2"),
                SchemaFieldSpec::new("amt", "s3"),
            ],
            row: true,
        })],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));
    // A filter left naming the old field would match nothing, and every row
    // would collapse to 0 — while still looking like a filtered pivot.
    assert_eq!(cell_num(&wb, 10, 1), Some(10.0));
    let ws = wb.get_sheet_by_idx(0).unwrap();
    let blocks = ws.get_all_blocks();
    let p = blocks.iter().find(|b| b.block_id == pivot).unwrap();
    assert_eq!(
        p.pivot.as_ref().unwrap().filters.as_ref().unwrap()[0].field,
        "quarter"
    );
}

#[test]
fn renaming_a_source_field_carries_into_a_total_rows_aggregate() {
    // The same hazard, on the feature that had it first: an analysis block's
    // `SUM of "amt"` named the field by string too.
    use crate::block_manager::schema_manager::field_type::AggFunc;
    use crate::edit_action::BindFormSchema;

    let (mut wb, src, analysis) = orders_with_analysis(AggFunc::Sum);
    assert_eq!(cell_num(&wb, 3, 1), Some(60.0), "sanity");

    let effect = apply(
        &mut wb,
        vec![EditPayload::BindFormSchema(BindFormSchema {
            ref_name: "orders".into(),
            sheet_idx: 0,
            block_id: src,
            field_from: 0,
            key_idx: 0,
            fields: vec![
                SchemaFieldSpec::new("key", "s0"),
                SchemaFieldSpec::new("amount", "s1"),
            ],
            row: true,
        })],
    );
    assert!(matches!(
        effect.status,
        crate::edit_action::StatusCode::Ok(_)
    ));
    assert_eq!(cell_num(&wb, 3, 1), Some(60.0), "the total still totals");
    let ws = wb.get_sheet_by_idx(0).unwrap();
    let blocks = ws.get_all_blocks();
    let a = blocks.iter().find(|b| b.block_id == analysis).unwrap();
    let amt = a
        .schema
        .as_ref()
        .unwrap()
        .fields
        .iter()
        .find(|f| f.agg_field.is_some())
        .unwrap();
    assert_eq!(amt.agg_field.as_deref(), Some("amount"));
}

#[test]
fn adding_and_reordering_fields_is_not_read_as_a_rename() {
    // The detection is by RENDER ID, so a new field (new id) and a reorder
    // (same ids, same names) both leave declarations alone. Position matching
    // would have read a reorder as a mass rename and rewritten every recipe.
    use crate::edit_action::BindFormSchema;
    let (mut wb, src, pivot) = sales_with_pivot("SUM", Some("quarter"));

    let effect = apply(
        &mut wb,
        vec![
            EditPayload::InsertColsInBlock(crate::edit_action::InsertColsInBlock {
                sheet_idx: 0,
                block_id: src,
                start: 4,
                cnt: 1,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "sales".into(),
                sheet_idx: 0,
                block_id: src,
                field_from: 0,
                key_idx: 0,
                fields: vec![
                    SchemaFieldSpec::new("id", "s0"),
                    SchemaFieldSpec::new("region", "s1"),
                    SchemaFieldSpec::new("quarter", "s2"),
                    SchemaFieldSpec::new("amt", "s3"),
                    // Brand new, with a render id nothing has seen.
                    SchemaFieldSpec::new("note", "s4"),
                ],
                row: true,
            }),
        ],
    );
    assert!(
        matches!(effect.status, crate::edit_action::StatusCode::Ok(_)),
        "{:?}",
        effect.error_message
    );
    let ws = wb.get_sheet_by_idx(0).unwrap();
    let blocks = ws.get_all_blocks();
    let p = blocks.iter().find(|b| b.block_id == pivot).unwrap();
    assert_eq!(p.pivot.as_ref().unwrap().row_dim, "region", "untouched");
    assert_eq!(cell_num(&wb, 10, 1), Some(10.0));
}
