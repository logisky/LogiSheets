use std::fs;

use logiscript::execute_script;
use logisheets::Workbook;

pub fn test_script(path: &str) {
    println!("testing script: {:?}", path);
    let script = fs::read_to_string(path).unwrap();
    match execute_script(&script) {
        Some(error) => panic!("{:?}", error.to_string()),
        None => (),
    }
}

pub fn load_script(path: &str) -> Workbook {
    let script = fs::read_to_string(path).unwrap();
    logiscript::load_from_script(&script).unwrap()
}

#[cfg(test)]
mod block;

#[cfg(test)]
mod common;

#[cfg(test)]
mod funcs {

    use glob::glob;
    use logisheets::EditAction;

    use crate::{load_script, test_script};
    use logisheets_controller::edit_action::{
        BindFormSchema, CellInput, CreateBlock, PayloadsAction,
    };

    #[test]
    fn test_funcs() {
        let scripts = glob("tests/funcs/*.script").expect("");
        scripts.into_iter().for_each(|p| {
            let path = p.unwrap();
            let path = path.to_str().unwrap();
            test_script(path)
        });
    }

    #[test]
    fn test_block_ref() {
        let mut wb = load_script("tests/funcs/block_ref_data.script");
        wb.handle_action(EditAction::Payloads(
            PayloadsAction::new()
                .add_payload(BindFormSchema {
                    ref_name: "test_ref".to_string(),
                    sheet_idx: 0,
                    block_id: 1, // check it in the script
                    field_from: 1,
                    key_idx: 0,
                    fields: vec![String::from("field1"), String::from("field2")],
                    render_ids: vec![String::from("render1"), String::from("render2")],
                    field_formulas: vec![],
                    row: true,
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 10,
                    col: 10,
                    content: String::from(r#"=BLOCKREF("test_ref", "key2", "field2")"#),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 11,
                    col: 11,
                    content: String::from(r#"=SUM(BLOCKREFS("test_ref", "key*", "field2"))"#),
                }),
        ));
        let v = wb.get_sheet_by_idx(0).unwrap().get_value(10, 10).unwrap();
        match v {
            logisheets::Value::Number(v) => assert_eq!(v, 8.0),
            _ => panic!("wrong result in blockref"),
        }
        let v = wb.get_sheet_by_idx(0).unwrap().get_value(11, 11).unwrap();
        match v {
            logisheets::Value::Number(v) => assert_eq!(v, 24.0),
            _ => panic!("wrong result in blockrefs"),
        }
    }

    /// Regression: editing a block field cell must re-fire BlockRef formulas
    /// that read it. Before the id-keyed virtual-vertex rework, BlockRef
    /// formulas were only attached to a string-keyed `BlockSchema(refname)`
    /// vertex that no cell write ever dirtied — so this assertion would have
    /// failed (the formula kept its stale value).
    #[test]
    fn test_block_ref_reacts_to_field_value_change() {
        let mut wb = load_script("tests/funcs/block_ref_data.script");
        wb.handle_action(EditAction::Payloads(
            PayloadsAction::new()
                .add_payload(BindFormSchema {
                    ref_name: "test_ref".to_string(),
                    sheet_idx: 0,
                    block_id: 1,
                    field_from: 1,
                    key_idx: 0,
                    fields: vec![String::from("field1"), String::from("field2")],
                    render_ids: vec![String::from("render1"), String::from("render2")],
                    field_formulas: vec![],
                    row: true,
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 10,
                    col: 10,
                    content: String::from(r#"=BLOCKREF("test_ref", "key2", "field2")"#),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 11,
                    col: 11,
                    content: String::from(r#"=SUM(BLOCKREFS("test_ref", "key*", "field2"))"#),
                }),
        ));

        // Sanity: initial values match the original test_block_ref.
        let v = wb.get_sheet_by_idx(0).unwrap().get_value(10, 10).unwrap();
        assert!(matches!(v, logisheets::Value::Number(n) if n == 8.0));
        let v = wb.get_sheet_by_idx(0).unwrap().get_value(11, 11).unwrap();
        assert!(matches!(v, logisheets::Value::Number(n) if n == 24.0));

        // Mutate C2 (key=key2, field=field2) from 8 to 100.
        wb.handle_action(EditAction::Payloads(PayloadsAction::new().add_payload(
            CellInput {
                sheet_idx: 0,
                row: 1,
                col: 2,
                content: String::from("100"),
            },
        )));

        let v = wb.get_sheet_by_idx(0).unwrap().get_value(10, 10).unwrap();
        match v {
            logisheets::Value::Number(n) => assert_eq!(n, 100.0, "BLOCKREF didn't pick up new C2"),
            other => panic!("BLOCKREF returned non-number: {:?}", other),
        }
        // 7 + 100 + 9 = 116 (kye4 row 11 still excluded by the "key*" wildcard).
        let v = wb.get_sheet_by_idx(0).unwrap().get_value(11, 11).unwrap();
        match v {
            logisheets::Value::Number(n) => {
                assert_eq!(n, 116.0, "BLOCKREFS didn't pick up new C2")
            }
            other => panic!("BLOCKREFS returned non-number: {:?}", other),
        }
    }

    #[test]
    fn test_empty_workbook_save_open_get_cell() {
        use logisheets::Workbook;
        let wb = Workbook::default();
        // Sanity: default workbook has Sheet1 reachable by idx 0.
        let v0 = wb.get_sheet_by_idx(0).unwrap().get_value(0, 0).unwrap();
        assert!(matches!(v0, logisheets::Value::Empty));
        let bytes = wb.save().expect("save empty workbook");
        let mut bytes = bytes;
        let reopened = Workbook::from_file(&mut bytes, "test".to_string()).expect("reopen");
        let v = reopened.get_sheet_by_idx(0).unwrap().get_value(0, 0);
        // Empty cell → should be Empty, not panic.
        match v {
            Ok(logisheets::Value::Empty) => (),
            other => panic!("unexpected: {:?}", other),
        }
    }

    /// Mirror the exact payload sequence the block-composer UI emits:
    /// fields list *includes* the primary key, field_from = 0,
    /// key_idx points at the primary in that list. Then mutate a field cell
    /// and confirm BLOCKREFS picks it up.
    #[test]
    fn test_block_ref_block_composer_layout() {
        use logisheets::Workbook;
        let mut wb = Workbook::default();
        wb.handle_action(EditAction::Payloads(
            PayloadsAction::new()
                .add_payload(CreateBlock {
                    sheet_idx: 0,
                    id: 7,
                    master_row: 0,
                    master_col: 0,
                    row_cnt: 3,
                    col_cnt: 2,
                    owner: None,
                    modify_policy: None,
                })
                .add_payload(BindFormSchema {
                    ref_name: "people".to_string(),
                    sheet_idx: 0,
                    block_id: 7,
                    // Block-composer style: field_from=0, fields list contains
                    // primary + the rest.
                    field_from: 0,
                    key_idx: 0,
                    fields: vec!["name".into(), "age".into()],
                    render_ids: vec!["r-name".into(), "r-age".into()],
                    field_formulas: vec![],
                    row: true,
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 0,
                    col: 0,
                    content: "alice".into(),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 0,
                    col: 1,
                    content: "30".into(),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 1,
                    col: 0,
                    content: "bob".into(),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 1,
                    col: 1,
                    content: "40".into(),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 10,
                    col: 5,
                    content: r#"=SUM(BLOCKREFS("people", "*", "age"))"#.into(),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 10,
                    col: 6,
                    content: r#"=BLOCKREF("people", "alice", "age")"#.into(),
                }),
        ));

        let v = wb.get_sheet_by_idx(0).unwrap().get_value(10, 5).unwrap();
        assert!(
            matches!(v, logisheets::Value::Number(n) if n == 70.0),
            "BLOCKREFS init: {:?}",
            v
        );
        let v = wb.get_sheet_by_idx(0).unwrap().get_value(10, 6).unwrap();
        assert!(
            matches!(v, logisheets::Value::Number(n) if n == 30.0),
            "BLOCKREF init: {:?}",
            v
        );

        // Edit alice's age via the standard CellInput path (engine-canvas
        // dispatches this on grid edits).
        wb.handle_action(EditAction::Payloads(PayloadsAction::new().add_payload(
            CellInput {
                sheet_idx: 0,
                row: 0,
                col: 1,
                content: "31".into(),
            },
        )));

        let v = wb.get_sheet_by_idx(0).unwrap().get_value(10, 5).unwrap();
        match v {
            logisheets::Value::Number(n) => assert_eq!(n, 71.0, "BLOCKREFS stale"),
            other => panic!("BLOCKREFS non-number: {:?}", other),
        }
        let v = wb.get_sheet_by_idx(0).unwrap().get_value(10, 6).unwrap();
        match v {
            logisheets::Value::Number(n) => assert_eq!(n, 31.0, "BLOCKREF stale"),
            other => panic!("BLOCKREF non-number: {:?}", other),
        }
    }

    /// Reproduces the block-composer scenario: build a block from scratch
    /// via payloads (no script preload), add a BLOCKREFS formula, then mutate
    /// a field cell. The formula must reflect the new value.
    #[test]
    fn test_block_ref_after_create_block_payload() {
        use logisheets::Workbook;
        let mut wb = Workbook::default();
        wb.handle_action(EditAction::Payloads(
            PayloadsAction::new()
                .add_payload(CreateBlock {
                    sheet_idx: 0,
                    id: 42,
                    master_row: 0,
                    master_col: 0,
                    row_cnt: 4,
                    col_cnt: 3,
                    owner: None,
                    modify_policy: None,
                })
                // Header rows aren't needed for the schema (RowSchema reads
                // values, not headers); just stuff numbers + keys.
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 0,
                    col: 0,
                    content: "alice".to_string(),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 0,
                    col: 1,
                    content: "30".to_string(),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 1,
                    col: 0,
                    content: "bob".to_string(),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 1,
                    col: 1,
                    content: "40".to_string(),
                })
                .add_payload(BindFormSchema {
                    ref_name: "people".to_string(),
                    sheet_idx: 0,
                    block_id: 42,
                    field_from: 1,
                    key_idx: 0,
                    fields: vec!["age".into()],
                    render_ids: vec!["r-age".into()],
                    field_formulas: vec![],
                    row: true,
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 10,
                    col: 5,
                    content: r#"=BLOCKREF("people", "alice", "age")"#.to_string(),
                }),
        ));

        let v = wb.get_sheet_by_idx(0).unwrap().get_value(10, 5).unwrap();
        assert!(
            matches!(v, logisheets::Value::Number(n) if n == 30.0),
            "initial BLOCKREF wrong: {:?}",
            wb.get_sheet_by_idx(0).unwrap().get_value(10, 5)
        );

        // Now mutate alice's age cell — same payload type the UI emits.
        wb.handle_action(EditAction::Payloads(PayloadsAction::new().add_payload(
            CellInput {
                sheet_idx: 0,
                row: 0,
                col: 1,
                content: "31".to_string(),
            },
        )));

        let v = wb.get_sheet_by_idx(0).unwrap().get_value(10, 5).unwrap();
        match v {
            logisheets::Value::Number(n) => assert_eq!(n, 31.0, "BLOCKREF didn't update"),
            other => panic!("BLOCKREF returned non-number: {:?}", other),
        }
    }

    /// Regression: renaming a block schema must not break already-typed
    /// BlockRef formulas. The new id-keyed AST keeps `(sheet_id, block_id)`
    /// in the formula so a rename of the ref-name leaves dependencies intact.
    #[test]
    fn test_block_ref_survives_ref_name_rename() {
        let mut wb = load_script("tests/funcs/block_ref_data.script");
        wb.handle_action(EditAction::Payloads(
            PayloadsAction::new()
                .add_payload(BindFormSchema {
                    ref_name: "test_ref".to_string(),
                    sheet_idx: 0,
                    block_id: 1,
                    field_from: 1,
                    key_idx: 0,
                    fields: vec![String::from("field1"), String::from("field2")],
                    render_ids: vec![String::from("render1"), String::from("render2")],
                    field_formulas: vec![],
                    row: true,
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 10,
                    col: 10,
                    content: String::from(r#"=BLOCKREF("test_ref", "key2", "field2")"#),
                }),
        ));

        // Rebind the same block under a new ref-name. The formula's stored
        // AST keeps the block_id, so it should still resolve.
        wb.handle_action(EditAction::Payloads(PayloadsAction::new().add_payload(
            BindFormSchema {
                ref_name: "renamed_ref".to_string(),
                sheet_idx: 0,
                block_id: 1,
                field_from: 1,
                key_idx: 0,
                fields: vec![String::from("field1"), String::from("field2")],
                render_ids: vec![String::from("render1"), String::from("render2")],
                field_formulas: vec![],
                row: true,
            },
        )));

        let v = wb.get_sheet_by_idx(0).unwrap().get_value(10, 10).unwrap();
        match v {
            logisheets::Value::Number(n) => assert_eq!(n, 8.0),
            other => panic!("formula broke after ref rename: {:?}", other),
        }
    }

    /// Integration test mirroring the factory-simulator
    /// PL → L1/L2 templated-formula shape:
    ///   - L1 block: keys "1", "2", "3"; one numeric column "v".
    ///   - L2 block: same shape, different values.
    ///   - PL block: keys "一", "二"; LEVEL column (literal "1"),
    ///     and a templated formula
    ///       =IF(#KEY="一",
    ///           BLOCKREF("L1", #FIELD("LEVEL"), "v"),
    ///           BLOCKREF("L2", #FIELD("LEVEL"), "v"))
    ///
    /// Both PL rows must compute. End-to-end coverage of three
    /// concurrent fixes: the `BlockAll(B) → cell` topo-barrier edge,
    /// the multi-DFS-root post-order assembly in `calc_order`, and
    /// the same-block BLOCKREF rejection at registration.
    #[test]
    fn test_templated_row_block_ref_cross_block_chain() {
        use logisheets::Workbook;
        let mut wb = Workbook::default();

        // L1, L2 — keyed by level string ("1"); one "v" column.
        // PL — keyed by line ("一" / "二"); LEVEL stored ("1"),
        // VALUE templated:
        //   =IF(#KEY="一",
        //       BLOCKREF("L1", #FIELD("LEVEL"), "v"),
        //       BLOCKREF("L2", #FIELD("LEVEL"), "v"))
        wb.handle_action(EditAction::Payloads(
            PayloadsAction::new()
                // L1 block at A1:B1 (one row, key "1").
                .add_payload(CreateBlock {
                    sheet_idx: 0,
                    id: 1,
                    master_row: 0,
                    master_col: 0,
                    row_cnt: 1,
                    col_cnt: 2,
                    owner: None,
                    modify_policy: None,
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 0,
                    col: 0,
                    content: "1".into(),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 0,
                    col: 1,
                    content: "111".into(),
                })
                .add_payload(BindFormSchema {
                    ref_name: "L1".to_string(),
                    sheet_idx: 0,
                    block_id: 1,
                    field_from: 0,
                    key_idx: 0,
                    fields: vec!["key".into(), "v".into()],
                    render_ids: vec!["L1-key".into(), "L1-v".into()],
                    field_formulas: vec![],
                    row: true,
                })
                // L2 block at A3:B3 (one row, key "1").
                .add_payload(CreateBlock {
                    sheet_idx: 0,
                    id: 2,
                    master_row: 2,
                    master_col: 0,
                    row_cnt: 1,
                    col_cnt: 2,
                    owner: None,
                    modify_policy: None,
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 2,
                    col: 0,
                    content: "1".into(),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 2,
                    col: 1,
                    content: "222".into(),
                })
                .add_payload(BindFormSchema {
                    ref_name: "L2".to_string(),
                    sheet_idx: 0,
                    block_id: 2,
                    field_from: 0,
                    key_idx: 0,
                    fields: vec!["key".into(), "v".into()],
                    render_ids: vec!["L2-key".into(), "L2-v".into()],
                    field_formulas: vec![],
                    row: true,
                })
                // PL block at A5:C6 (two rows, keys "一"/"二").
                // Keys first (so #KEY substitutes at BindFormSchema).
                .add_payload(CreateBlock {
                    sheet_idx: 0,
                    id: 3,
                    master_row: 4,
                    master_col: 0,
                    row_cnt: 2,
                    col_cnt: 3,
                    owner: None,
                    modify_policy: None,
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 4,
                    col: 0,
                    content: "一".into(),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 5,
                    col: 0,
                    content: "二".into(),
                })
                .add_payload(BindFormSchema {
                    ref_name: "PL".to_string(),
                    sheet_idx: 0,
                    block_id: 3,
                    field_from: 0,
                    key_idx: 0,
                    fields: vec!["key".into(), "LEVEL".into(), "VALUE".into()],
                    render_ids: vec![
                        "PL-key".into(),
                        "PL-LEVEL".into(),
                        "PL-VALUE".into(),
                    ],
                    field_formulas: vec![
                        None,
                        None,
                        Some(
                            r#"=IF(#KEY="一",BLOCKREF("L1",#FIELD("LEVEL"),"v"),BLOCKREF("L2",#FIELD("LEVEL"),"v"))"#
                                .to_string(),
                        ),
                    ],
                    row: true,
                })
                // Seed LEVEL = "1" for both PL rows AFTER bind, as the
                // simulator does for ProductionLine.
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 4,
                    col: 1,
                    content: "1".into(),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 5,
                    col: 1,
                    content: "1".into(),
                }),
        ));

        let sheet = wb.get_sheet_by_idx(0).unwrap();
        let r0 = sheet.get_value(4, 2);
        let r1 = sheet.get_value(5, 2);
        println!("PL row0 (一) VALUE = {:?}", r0);
        println!("PL row1 (二) VALUE = {:?}", r1);
        match r0.unwrap() {
            logisheets::Value::Number(n) => assert_eq!(n, 111.0, "PL row0 (一)"),
            other => panic!("PL row0 (一) bad: {:?}", other),
        }
        match r1.unwrap() {
            logisheets::Value::Number(n) => assert_eq!(n, 222.0, "PL row1 (二)"),
            other => panic!("PL row1 (二) bad: {:?}", other),
        }
    }
}

#[cfg(test)]
mod shift;

#[cfg(test)]
mod test_builtin_style {
    #[test]
    fn test_builtin1() {
        use logisheets::Workbook;
        use logisheets_controller::Fill;
        use std::fs;
        let mut buf = fs::read("tests/builtin_style.xlsx").unwrap();
        let wb = Workbook::from_file(&mut buf, String::from("6")).unwrap();
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let s = ws.get_style(3, 1).unwrap();
        match s.fill {
            Fill::PatternFill(f) => {
                if let Some(_) = f.fg_color {
                } else {
                    panic!()
                }
            }
            Fill::GradientFill(_) => todo!(),
        }
    }
}

#[cfg(test)]
mod test_6 {
    use logisheets::SheetDimension;

    #[test]
    fn test_value1() {
        use logisheets::{Value, Workbook};
        use std::fs;
        let mut buf = fs::read("tests/6.xlsx").unwrap();
        let wb = Workbook::from_file(&mut buf, String::from("6")).unwrap();
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let v = ws.get_value(9, 1).unwrap();
        match v {
            Value::Number(f) => assert_eq!(f, 32.0),
            _ => panic!(),
        }
        let v = ws.get_value(8, 1).unwrap();
        match v {
            Value::Str(f) => assert_eq!(f, "Q1"),
            _ => panic!(),
        }
        let v = ws.get_value(100, 1).unwrap();
        match v {
            Value::Empty => {}
            _ => panic!(),
        };
    }

    #[ignore]
    #[test]
    fn test_save() {
        use logisheets::Workbook;
        use std::fs;
        let mut buf = fs::read("tests/6.xlsx").unwrap();
        let wb = Workbook::from_file(&mut buf, String::from("6")).unwrap();

        let buf = wb.save().unwrap();
        fs::write("tests/6_save.xlsx", buf).unwrap()
    }

    #[test]
    fn test_formula1() {
        use logisheets::Workbook;
        use std::fs;
        let mut buf = fs::read("tests/6.xlsx").unwrap();
        let wb = Workbook::from_file(&mut buf, String::from("6")).unwrap();
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let f = ws.get_formula(9, 1).unwrap();
        assert_eq!(f, "B18")
    }

    #[test]
    fn test_style1() {
        use logisheets::{StUnderlineValues, Workbook};
        use std::fs;
        let mut buf = fs::read("tests/6.xlsx").unwrap();
        let wb = Workbook::from_file(&mut buf, String::from("6")).unwrap();
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let style = ws.get_style(9, 1).unwrap();
        let underline = style.font.underline.unwrap().val;
        assert!(matches!(underline, StUnderlineValues::Single));
        let SheetDimension {
            max_row: row_cnt,
            max_col: col_cnt,
            height: _,
            width: _,
        } = ws.get_sheet_dimension().unwrap();
        for r in 0..row_cnt {
            for c in 0..col_cnt {
                let _ = ws.get_style(r, c).unwrap();
            }
        }
    }

    #[test]
    fn test_style2() {
        use logisheets::Workbook;
        use std::fs;
        let mut buf = fs::read("tests/builtin_style.xlsx").unwrap();
        let wb = Workbook::from_file(&mut buf, String::from("builtin_style")).unwrap();
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let SheetDimension {
            max_row: row_cnt,
            max_col: col_cnt,
            height: _,
            width: _,
        } = ws.get_sheet_dimension().unwrap();
        for r in 0..row_cnt {
            for c in 0..col_cnt {
                let _ = ws.get_style(r, c).unwrap();
            }
        }
    }
}

#[cfg(test)]
mod test_7 {

    #[test]
    fn test_style() {
        use logisheets::Workbook;
        use std::fs;
        let mut buf = fs::read("tests/7.xlsx").unwrap();
        let wb = Workbook::from_file(&mut buf, String::from("7")).unwrap();
        let ws = wb.get_sheet_by_idx(0).unwrap();
        ws.get_display_window_response(0., 0., 100., 100.).unwrap();

        let a1_info = ws.get_cell_info(0, 0).unwrap();
        let s = a1_info.style;
        let f_color = s.font.color.unwrap();
        assert_eq!(f_color.red.unwrap(), 0.);
        assert_eq!(f_color.green.unwrap(), 0.);
        assert_eq!(f_color.blue.unwrap(), 0.);
        let c5_info = ws.get_cell_info(4, 2).unwrap();
        let _s = c5_info.style;
        // println!("{:?}", s.font.color);
        let row1 = ws.get_row_info(0).unwrap();
        assert!(row1.height > 70.);
    }
}

#[cfg(test)]
mod calc_test {
    use logisheets::Workbook;
    use std::fs;
    #[test]
    fn test_calc_test() {
        let mut buf = fs::read("tests/calc_test.xlsx").unwrap();
        let _ = Workbook::from_file(&mut buf, String::from("calc_test")).unwrap();
    }
}
