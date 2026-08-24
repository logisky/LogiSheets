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

// Operator & expression semantics (precedence, associativity, unary minus,
// power, percent, comparison, concatenation, coercion) — the class of bug that
// the '/'-then-'*' precedence error belonged to. Runs every *.script in
// tests/operators/ the same way the funcs suite does.
#[cfg(test)]
mod operators {
    use glob::glob;

    use crate::test_script;

    #[test]
    fn test_operators() {
        let scripts = glob("tests/operators/*.script").expect("");
        scripts.into_iter().for_each(|p| {
            let path = p.unwrap();
            let path = path.to_str().unwrap();
            test_script(path)
        });
    }
}

#[cfg(test)]
mod funcs {

    use glob::glob;
    use logisheets::EditAction;

    use crate::{load_script, test_script};
    use logisheets_controller::edit_action::{
        BindFormSchema, BlockInput, CellInput, CreateBlock, CreateSheet, ModifyPolicy,
        PayloadsAction, UpsertFieldFormulas,
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

    /// Regression: a RANGE-reference formula (`=SUM(A1:A2)`) must still
    /// recompute when a member cell changes AFTER the workbook is saved and
    /// reloaded. The file-load path used to record only the formula→range edge
    /// and skip the range→member-cell edges the live path builds, so a reloaded
    /// `SUM` went stale on edits (while a cell-ref `=A1` worked). Fixed by the
    /// post-load `FormulaManager::rebuild_range_deps` pass in `file_loader`.
    #[test]
    fn test_range_dep_recomputes_after_reload() {
        use logisheets::Workbook;
        let mut wb = Workbook::default();
        wb.handle_action(EditAction::Payloads(
            PayloadsAction::new()
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 0,
                    col: 0,
                    content: "1".into(),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 1,
                    col: 0,
                    content: "2".into(),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 0,
                    col: 2,
                    content: "=SUM(A1:A2)".into(),
                }),
        ));
        let v = wb.get_sheet_by_idx(0).unwrap().get_value(0, 2).unwrap();
        assert!(
            matches!(v, logisheets::Value::Number(n) if n == 3.0),
            "pre-save SUM(A1:A2): {:?}",
            v
        );

        // Save → reload, then change a member cell on the reloaded workbook.
        let mut bytes = wb.save().expect("save");
        let mut reopened = Workbook::from_file(&mut bytes, "reload".to_string()).expect("reopen");
        reopened.handle_action(EditAction::Payloads(PayloadsAction::new().add_payload(
            CellInput {
                sheet_idx: 0,
                row: 0,
                col: 0,
                content: "10".into(),
            },
        )));
        let v = reopened
            .get_sheet_by_idx(0)
            .unwrap()
            .get_value(0, 2)
            .unwrap();
        match v {
            logisheets::Value::Number(n) => {
                assert_eq!(n, 12.0, "range formula went stale after reload+edit")
            }
            other => panic!("SUM non-number after reload+edit: {:?}", other),
        }
    }

    /// Regression: a formula with a parenthesized sub-expression as the LEFT
    /// operand — `C1 = (1+E1)^E2` over cross-sheet BLOCKREF helpers — must keep
    /// its value after save→reload→edit. The bug was in the grammar: the
    /// top-level `"(" ~ expression ~ ")"` alternative dropped the bracket flag,
    /// so unparse saved `(1+E1)^E2` as `1+E1^E2`; on reload that re-parsed as
    /// `1+(E1^E2)` and silently changed the result. (This is douyoushu's 房贷
    /// `(1+r)^n` staleness — a save/unparse bug, not a recompute one.)
    #[test]
    fn test_blockref_chain_recomputes_after_reload() {
        use logisheets::Workbook;
        // Mirror the douyoushu 房贷 layout: TWO blocks on a hidden sheet, each a
        // separate input; the visible sheet pulls both via BLOCKREF, feeds them
        // through helper cells, and combines them with `^` (the shape that went
        // stale). On reload BOTH inputs are written in ONE transaction (as the
        // craft's onRequest does).
        let mut wb = Workbook::default();
        // Match buildBlockPlan exactly: createBlock → seed key+value via RAW
        // cellInput (not blockInput) → bindFormSchema AFTER seeding.
        let mk_block = |a: PayloadsAction, id: usize, refname: &str, seed: &str| {
            let mr = (id - 1) * 2; // buildBlockPlan layout: rows 0, 2, 4
            a.add_payload(CreateBlock {
                sheet_idx: 1,
                id,
                master_row: mr,
                master_col: 0,
                row_cnt: 1,
                col_cnt: 2,
                owner: None,
                modify_policy: Some(ModifyPolicy::OwnerAndUser),
            })
            .add_payload(CellInput {
                sheet_idx: 1,
                row: mr,
                col: 0,
                content: "k".to_string(),
            })
            .add_payload(CellInput {
                sheet_idx: 1,
                row: mr,
                col: 1,
                content: seed.to_string(),
            })
            .add_payload(BindFormSchema {
                ref_name: refname.to_string(),
                sheet_idx: 1,
                block_id: id,
                field_from: 1,
                key_idx: 0,
                fields: vec![String::from("v")],
                render_ids: vec![format!("r{id}")],
                field_formulas: vec![],
                validation_formulas: vec![],
                editability_formulas: vec![],
                row: true,
            })
        };
        // Phase 1: sellers's sheet before baking. A1/A2/A3 hold plain values;
        // helpers E1..E4 and the output C1 exactly mirror the 房贷 calculator.
        wb.handle_action(EditAction::Payloads(
            PayloadsAction::new()
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 0,
                    col: 0,
                    content: "100".into(),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 1,
                    col: 0,
                    content: "4.9".into(),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 2,
                    col: 0,
                    content: "30".into(),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 0,
                    col: 4,
                    content: "=A1*10000".into(),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 1,
                    col: 4,
                    content: "=A2/100/12".into(),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 2,
                    col: 4,
                    content: "=A3*12".into(),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 3,
                    col: 4,
                    content: "=(1+E2)^E3".into(),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 0,
                    col: 2,
                    content: "=ROUND(E1*E2*E4/(E4-1),2)".into(),
                }),
        ));
        // Phase 2 (buildBlockPlan): three input blocks, then rewrite A1/A2/A3 to
        // =BLOCKREF pulling from them.
        let mut action = PayloadsAction::new().add_payload(CreateSheet {
            idx: 1,
            new_name: "hidden".to_string(),
        });
        action = mk_block(action, 1, "loan", "100");
        action = mk_block(action, 2, "rate", "4.9");
        action = mk_block(action, 3, "years", "30");
        action = action
            .add_payload(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 0,
                content: r#"=BLOCKREF("loan", "k", "v")"#.into(),
            })
            .add_payload(CellInput {
                sheet_idx: 0,
                row: 1,
                col: 0,
                content: r#"=BLOCKREF("rate", "k", "v")"#.into(),
            })
            .add_payload(CellInput {
                sheet_idx: 0,
                row: 2,
                col: 0,
                content: r#"=BLOCKREF("years", "k", "v")"#.into(),
            })
            // Output MIRROR cells on the hidden sheet (buildBlockPlan layout):
            // reactive `=<sellerSheet>!<outCell>` at cols 100/164/228.
            .add_payload(CellInput {
                sheet_idx: 1,
                row: 0,
                col: 100,
                content: "=Sheet1!C1".into(),
            })
            .add_payload(CellInput {
                sheet_idx: 1,
                row: 0,
                col: 164,
                content: "=Sheet1!C2".into(),
            })
            .add_payload(CellInput {
                sheet_idx: 1,
                row: 0,
                col: 228,
                content: "=Sheet1!C3".into(),
            });
        wb.handle_action(EditAction::Payloads(action));

        let num = |wb: &mut Workbook, r, c| match wb
            .get_sheet_by_idx(0)
            .unwrap()
            .get_value(r, c)
            .unwrap()
        {
            logisheets::Value::Number(n) => n,
            other => panic!("expected number at ({r},{c}): {:?}", other),
        };
        assert!(
            (num(&mut wb, 3, 4) - 4.3362).abs() < 0.01,
            "E4=(1+E2)^E3 pre-save: {}",
            num(&mut wb, 3, 4)
        );

        // Double round-trip, then write ALL THREE inputs in ONE tx (as onRequest does).
        let mut bytes = wb.save().expect("save");
        let wb = Workbook::from_file(&mut bytes, "reload".to_string()).expect("reopen");
        let mut bytes = wb.save().expect("save2");
        let mut wb = Workbook::from_file(&mut bytes, "reload2".to_string()).expect("reopen2");
        wb.handle_action(EditAction::Payloads(
            PayloadsAction::new()
                .add_payload(BlockInput {
                    sheet_idx: 1,
                    block_id: 1,
                    row: 0,
                    col: 1,
                    input: "100".into(),
                })
                .add_payload(BlockInput {
                    sheet_idx: 1,
                    block_id: 2,
                    row: 0,
                    col: 1,
                    input: "4.9".into(),
                })
                .add_payload(BlockInput {
                    sheet_idx: 1,
                    block_id: 3,
                    row: 0,
                    col: 1,
                    input: "30".into(),
                }),
        ));
        let e4 = num(&mut wb, 3, 4);
        let monthly = num(&mut wb, 0, 2);
        assert!(
            (e4 - 4.3362).abs() < 0.01,
            "E4=(1+E2)^E3 went stale after reload+edit: {}",
            e4
        );
        assert!(
            monthly > 5000.0 && monthly < 5500.0,
            "monthly after reload+edit: {}",
            monthly
        );
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
                    validation_formulas: vec![],
                    editability_formulas: vec![],
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
                    validation_formulas: vec![],
                    editability_formulas: vec![],
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
                    validation_formulas: vec![],
                    editability_formulas: vec![],
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
                    validation_formulas: vec![],
                    editability_formulas: vec![],
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

    /// Renaming a block's schema ref-name must NOT break formulas that already
    /// reference it. Block refs are resolved to the block id at PARSE time and
    /// both the AST and the dependency graph are id-keyed, so re-binding the
    /// SAME block with a new `ref_name` leaves existing formulas evaluating —
    /// and still reactive. (Confirms the "references use the id, not the name"
    /// property.)
    #[test]
    fn test_rename_block_ref_name_keeps_formulas() {
        use logisheets::Workbook;
        let mut wb = Workbook::default();
        wb.handle_action(EditAction::Payloads(
            PayloadsAction::new()
                .add_payload(CreateBlock {
                    sheet_idx: 0,
                    id: 42,
                    master_row: 0,
                    master_col: 0,
                    row_cnt: 2,
                    col_cnt: 2,
                    owner: None,
                    modify_policy: None,
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
                .add_payload(BindFormSchema {
                    ref_name: "people".into(),
                    sheet_idx: 0,
                    block_id: 42,
                    field_from: 1,
                    key_idx: 0,
                    fields: vec!["age".into()],
                    render_ids: vec!["r-age".into()],
                    field_formulas: vec![],
                    validation_formulas: vec![],
                    editability_formulas: vec![],
                    row: true,
                })
                // Two formulas referencing the block BY NAME "people".
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 10,
                    col: 5,
                    content: r#"=BLOCKREF("people", "alice", "age")"#.into(),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 10,
                    col: 6,
                    content: r#"=SUM(BLOCKREFS("people", "*", "age"))"#.into(),
                }),
        ));

        let get = |wb: &Workbook, r: usize, c: usize| {
            wb.get_sheet_by_idx(0).unwrap().get_value(r, c).unwrap()
        };
        assert!(
            matches!(get(&wb, 10, 5), logisheets::Value::Number(n) if n == 30.0),
            "BLOCKREF before rename"
        );
        assert!(
            matches!(get(&wb, 10, 6), logisheets::Value::Number(n) if n == 70.0),
            "BLOCKREFS before rename"
        );

        // RENAME: re-bind the SAME block (id 42) with a new ref_name. The
        // layout / fields are unchanged — only the name in `refs` moves.
        wb.handle_action(EditAction::Payloads(PayloadsAction::new().add_payload(
            BindFormSchema {
                ref_name: "humans".into(),
                sheet_idx: 0,
                block_id: 42,
                field_from: 1,
                key_idx: 0,
                fields: vec!["age".into()],
                render_ids: vec!["r-age".into()],
                field_formulas: vec![],
                validation_formulas: vec![],
                editability_formulas: vec![],
                row: true,
            },
        )));

        // The existing formulas (typed with the OLD name) STILL evaluate.
        assert!(
            matches!(get(&wb, 10, 5), logisheets::Value::Number(n) if n == 30.0),
            "BLOCKREF must survive the rename"
        );
        assert!(
            matches!(get(&wb, 10, 6), logisheets::Value::Number(n) if n == 70.0),
            "BLOCKREFS must survive the rename"
        );

        // ...and stay REACTIVE — editing a field cell recomputes them, proving
        // the id-keyed dependency edges survived the rename.
        wb.handle_action(EditAction::Payloads(PayloadsAction::new().add_payload(
            CellInput {
                sheet_idx: 0,
                row: 0,
                col: 1,
                content: "31".into(),
            },
        )));
        assert!(
            matches!(get(&wb, 10, 5), logisheets::Value::Number(n) if n == 31.0),
            "BLOCKREF reactive after rename"
        );
        assert!(
            matches!(get(&wb, 10, 6), logisheets::Value::Number(n) if n == 71.0),
            "BLOCKREFS reactive after rename"
        );

        // A NEW formula typed with the NEW name resolves to the same block.
        wb.handle_action(EditAction::Payloads(PayloadsAction::new().add_payload(
            CellInput {
                sheet_idx: 0,
                row: 10,
                col: 7,
                content: r#"=BLOCKREF("humans", "alice", "age")"#.into(),
            },
        )));
        assert!(
            matches!(get(&wb, 10, 7), logisheets::Value::Number(n) if n == 31.0),
            "the new ref name resolves to the same block"
        );
    }

    /// Douyoushu scalar I/O: a degenerate single-row block has no meaningful
    /// key column, so its key cell is left empty. `BLOCKREF(ref, "", field)`
    /// must resolve the sole row by geometry (not by matching a stored key
    /// value, which doesn't exist), and stay reactive to field-cell edits.
    #[test]
    fn test_block_ref_empty_key_resolves_scalar() {
        use logisheets::Workbook;
        let mut wb = Workbook::default();
        wb.handle_action(EditAction::Payloads(
            PayloadsAction::new()
                // 1 row x 2 cols: col0 = key (left EMPTY), col1 = field "v".
                .add_payload(CreateBlock {
                    sheet_idx: 0,
                    id: 7,
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
                    col: 1,
                    content: "30".to_string(),
                })
                .add_payload(BindFormSchema {
                    ref_name: "price".to_string(),
                    sheet_idx: 0,
                    block_id: 7,
                    field_from: 1,
                    key_idx: 0,
                    fields: vec!["v".into()],
                    render_ids: vec!["r-v".into()],
                    field_formulas: vec![],
                    validation_formulas: vec![],
                    editability_formulas: vec![],
                    row: true,
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 5,
                    col: 5,
                    content: r#"=BLOCKREF("price", "", "v")"#.to_string(),
                }),
        ));

        let v = wb.get_sheet_by_idx(0).unwrap().get_value(5, 5).unwrap();
        assert!(
            matches!(v, logisheets::Value::Number(n) if n == 30.0),
            "empty-key BLOCKREF should resolve the sole row: {:?}",
            wb.get_sheet_by_idx(0).unwrap().get_value(5, 5)
        );

        // Reactivity: writing the field cell (the runtime's input sink) must
        // re-fire the BLOCKREF formula that reads it.
        wb.handle_action(EditAction::Payloads(PayloadsAction::new().add_payload(
            CellInput {
                sheet_idx: 0,
                row: 0,
                col: 1,
                content: "42".to_string(),
            },
        )));
        let v = wb.get_sheet_by_idx(0).unwrap().get_value(5, 5).unwrap();
        match v {
            logisheets::Value::Number(n) => assert_eq!(n, 42.0, "empty-key BLOCKREF stale"),
            other => panic!("empty-key BLOCKREF non-number: {:?}", other),
        }
    }

    /// Guard: empty key is only unambiguous for a single-row block. A block
    /// with multiple rows queried by empty key has no defined "sole row", so
    /// `BLOCKREF(ref, "", field)` must resolve to an error rather than silently
    /// picking a row.
    #[test]
    fn test_block_ref_empty_key_ambiguous_is_error() {
        use logisheets::Workbook;
        let mut wb = Workbook::default();
        wb.handle_action(EditAction::Payloads(
            PayloadsAction::new()
                // 2 rows x 2 cols, keys left empty => ambiguous.
                .add_payload(CreateBlock {
                    sheet_idx: 0,
                    id: 8,
                    master_row: 0,
                    master_col: 0,
                    row_cnt: 2,
                    col_cnt: 2,
                    owner: None,
                    modify_policy: None,
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 0,
                    col: 1,
                    content: "10".to_string(),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 1,
                    col: 1,
                    content: "20".to_string(),
                })
                .add_payload(BindFormSchema {
                    ref_name: "ambig".to_string(),
                    sheet_idx: 0,
                    block_id: 8,
                    field_from: 1,
                    key_idx: 0,
                    fields: vec!["v".into()],
                    render_ids: vec!["r-v".into()],
                    field_formulas: vec![],
                    validation_formulas: vec![],
                    editability_formulas: vec![],
                    row: true,
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 5,
                    col: 5,
                    content: r#"=BLOCKREF("ambig", "", "v")"#.to_string(),
                }),
        ));

        let v = wb.get_sheet_by_idx(0).unwrap().get_value(5, 5).unwrap();
        assert!(
            matches!(v, logisheets::Value::Error(_)),
            "ambiguous empty-key BLOCKREF should be an error, got: {:?}",
            v
        );
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
                    validation_formulas: vec![],
                    editability_formulas: vec![],
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
                validation_formulas: vec![],
                editability_formulas: vec![],
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
                    validation_formulas: vec![],
                    editability_formulas: vec![],
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
                    validation_formulas: vec![],
                    editability_formulas: vec![],
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
                    validation_formulas: vec![],
                    editability_formulas: vec![],
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

    /// Two-phase bind: a single transaction that BindFormSchema-s
    /// every block with empty `field_formulas`, then UpsertFieldFormulas
    /// each block with its real templates. Lets a block declared
    /// early in the payload list cross-reference one declared later —
    /// the parser sees a fully-populated refName / field table by the
    /// time any template is parsed.
    ///
    /// Concretely: block A is declared first and BLOCKREFS-sums a
    /// column in B (declared second). Single-pass BindFormSchema
    /// would resolve A's BLOCKREFS-into-B as a generic function
    /// (B not yet bound at A's parse time) → permanent #NAME?.
    /// Two-phase makes A's formula resolve correctly.
    #[test]
    fn test_upsert_field_formulas_resolves_forward_refs() {
        use logisheets::Workbook;
        let mut wb = Workbook::default();

        // A at A1:B2 — two rows, key + value.
        // B at A4:B5 — two rows, key + value.
        //
        // A.value formula  =  SUM(BLOCKREFS("B","*","v"))      → cross-block sum
        // B.v   formula    =  BLOCKREF("A",#KEY,"value") * 0   → forces a parse-time
        //                     lookup into A; arithmetic is irrelevant, we just need
        //                     the parser to resolve A's refName even though B is
        //                     bound first in declaration order (which it is, below).
        wb.handle_action(EditAction::Payloads(
            PayloadsAction::new()
                .add_payload(CreateBlock {
                    sheet_idx: 0,
                    id: 1,
                    master_row: 0,
                    master_col: 0,
                    row_cnt: 2,
                    col_cnt: 2,
                    owner: None,
                    modify_policy: None,
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 0,
                    col: 0,
                    content: "a1".into(),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 1,
                    col: 0,
                    content: "a2".into(),
                })
                .add_payload(CreateBlock {
                    sheet_idx: 0,
                    id: 2,
                    master_row: 3,
                    master_col: 0,
                    row_cnt: 2,
                    col_cnt: 2,
                    owner: None,
                    modify_policy: None,
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 3,
                    col: 0,
                    content: "a1".into(),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 4,
                    col: 0,
                    content: "a2".into(),
                })
                // PHASE 1: bind both schemas with NO formulas — just
                // register refNames + field sets so later parses can
                // resolve cross-block names regardless of order.
                .add_payload(BindFormSchema {
                    ref_name: "A".to_string(),
                    sheet_idx: 0,
                    block_id: 1,
                    field_from: 0,
                    key_idx: 0,
                    fields: vec!["key".into(), "value".into()],
                    render_ids: vec!["A-key".into(), "A-value".into()],
                    field_formulas: vec![None, None],
                    validation_formulas: vec![],
                    editability_formulas: vec![],
                    row: true,
                })
                .add_payload(BindFormSchema {
                    ref_name: "B".to_string(),
                    sheet_idx: 0,
                    block_id: 2,
                    field_from: 0,
                    key_idx: 0,
                    fields: vec!["key".into(), "v".into()],
                    render_ids: vec!["B-key".into(), "B-v".into()],
                    field_formulas: vec![None, None],
                    validation_formulas: vec![],
                    editability_formulas: vec![],
                    row: true,
                })
                // Seed B's v column with literal numbers so A's SUM
                // has something to add up.
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 3,
                    col: 1,
                    content: "10".into(),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 4,
                    col: 1,
                    content: "20".into(),
                })
                // PHASE 2: install A's forward-reference template. By
                // now B's refName + field set are registered, so the
                // parser resolves BLOCKREFS("B",...) to a real
                // BlockRefNode instead of falling back to a generic
                // function call. B has no formulas itself, so it gets
                // no UpsertFieldFormulas payload.
                .add_payload(UpsertFieldFormulas {
                    sheet_idx: 0,
                    block_id: 1,
                    field_formulas: vec![None, Some(r#"=SUM(BLOCKREFS("B","*","v"))"#.to_string())],
                    validation_formulas: vec![],
                    editability_formulas: vec![],
                }),
        ));

        let sheet = wb.get_sheet_by_idx(0).unwrap();
        // A.value = SUM(BLOCKREFS("B","*","v")) = 10 + 20 = 30 on
        // every row (BLOCKREFS evaluates the same regardless of A's
        // row position, no #KEY filter).
        for r in 0..=1 {
            match sheet.get_value(r, 1).unwrap() {
                logisheets::Value::Number(n) => assert_eq!(n, 30.0, "A row {} .value", r),
                other => panic!(
                    "A row{}.value bad (expected Number(30), got {:?})",
                    r, other
                ),
            }
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

/// A workbook written by openpyxl, which is how most tooling that is not Excel
/// emits `.xlsx`. This one carries all three things that used to make the
/// reader abort, and it aborted before reading a single cell:
///
///   * relationship targets in absolute form (`/xl/worksheets/sheet1.xml`),
///     mixed with relative ones;
///   * a `core.xml` with no `lastModifiedBy` and an `app.xml` with no
///     `HeadingPairs` — metadata the loader discards anyway;
///   * 25 formula cells whose value element is empty (`<f>B20/$B$8</f><v/>`),
///     because openpyxl writes formulas without computing them.
///
/// The last one is the substance of the test: with no cached results in the
/// file at all, every number here has to come from our own evaluation of the
/// formulas. It is a five-year DCF, and its value per share is computed
/// independently in Python from the same inputs — not copied from any
/// spreadsheet's output.
#[test]
fn reads_and_computes_a_workbook_openpyxl_wrote() {
    use logisheets::{Value, Workbook};
    use std::fs;
    let mut buf = fs::read("tests/openpyxl-dcf.xlsx").unwrap();
    let wb = Workbook::from_file(&mut buf, String::from("openpyxl")).unwrap();
    // `write_data_to_excel` with an unknown sheet name adds a sheet, so the
    // model sits on the second one, after the empty default.
    let ws = wb.get_sheet_by_idx(1).unwrap();

    // An assumption, read straight from the file.
    match ws.get_value(0, 1).unwrap() {
        Value::Number(f) => assert_eq!(f, 1000.0),
        other => panic!("B1 should be the base revenue, got {:?}", other),
    }
    // And the answer, which exists only if we evaluated the chain ourselves.
    match ws.get_value(20, 1).unwrap() {
        Value::Number(f) => assert!(
            (f - 20.803603425995494).abs() < 1e-9,
            "value per share should be 20.8036…, got {}",
            f
        ),
        other => panic!("B21 should be a number, got {:?}", other),
    }
}

/// An Excel table arrives, becomes an addressable block under its own name, and
/// is still a table on the way out — with its range following the block.
///
/// The loader has always adopted a `<table>` as a block, which is the useful
/// half. The other half was missing: the block was named `unspecified-<id>`
/// rather than the table's own `displayName`, so a formula could not name it
/// without looking the number up first; and the `tableN.xml` part was dropped on
/// save, so a file that arrived with a table came back without one.
///
/// Keeping the part means keeping its range honest, which is why the growth case
/// is asserted here too: a preserved `ref` would otherwise describe where the
/// data used to be.
#[test]
fn test_excel_table_round_trips_as_a_named_block() {
    use logisheets::{Workbook, Value};
    use std::fs;

    let mut buf = fs::read("tests/table.xlsx").unwrap();
    let wb = Workbook::from_file(&mut buf, String::from("table")).unwrap();

    // Adopted under the table's own name, with its column headers as fields.
    let blocks = wb.get_sheet_by_idx(0).unwrap().get_all_blocks();
    assert_eq!(blocks.len(), 1, "the table should have become one block");
    let schema = blocks[0].schema.as_ref().expect("the block has a schema");
    assert_eq!(schema.name, "Sales", "named after the table, not a serial");
    let fields: Vec<&str> = schema.fields.iter().map(|f| f.field.as_str()).collect();
    assert_eq!(fields, vec!["region", "q1", "q2", "total"]);

    // The table's own formulas are alive: D4 is south's total.
    let v = wb.get_sheet_by_idx(0).unwrap().get_value(2, 3).unwrap();
    assert!(
        matches!(v, Value::Number(n) if (n - 38.0).abs() < 1e-9),
        "20 + 18, computed by the engine; got {:?}",
        v
    );

    let table_ref = |bytes: &[u8]| -> String {
        let mut zip = zip::ZipArchive::new(std::io::Cursor::new(bytes.to_vec())).unwrap();
        for i in 0..zip.len() {
            let mut f = zip.by_index(i).unwrap();
            if f.name().starts_with("xl/tables/") && f.name().ends_with(".xml") {
                use std::io::Read;
                let mut s = String::new();
                f.read_to_string(&mut s).unwrap();
                let at = s.find("<table ").expect("a table element");
                let rest = &s[at..];
                let r = rest.find("ref=\"").expect("a ref") + 5;
                let end = rest[r..].find('"').unwrap();
                return rest[r..r + end].to_string();
            }
        }
        String::from("no table part")
    };

    // Saved back with the table intact, over the same range.
    let saved = wb.save().expect("save");
    assert_eq!(table_ref(&saved), "A1:D4");

    // Grow the block; the table's range follows.
    let mut wb = Workbook::from_file(&mut buf, String::from("table2")).unwrap();
    let result = wb.handle_action(logisheets::EditAction::Payloads(
        logisheets_controller::edit_action::PayloadsAction {
            payloads: vec![logisheets_controller::edit_action::EditPayload::InsertRowsInBlock(
                logisheets_controller::edit_action::InsertRowsInBlock {
                    sheet_idx: 0,
                    block_id: blocks[0].block_id,
                    start: 3,
                    cnt: 1,
                },
            )],
            undoable: true,
            init: false,
        },
    ));
    assert!(matches!(
        result.status,
        logisheets_controller::edit_action::StatusCode::Ok(_)
    ));
    let grown = wb.save().expect("save after growth");
    assert_eq!(
        table_ref(&grown),
        "A1:D5",
        "a preserved range would still say A1:D4 and stop short of the new row"
    );
}

/// A block is written out as an Excel table, so a person opening the file gets a
/// real ListObject over the rows the agent addresses by name.
///
/// The two carriers compose: the table describes the shape (name, columns,
/// extent), `logisheets/data.xml` describes the semantics (field rules, key
/// column, render ids). Reloading must therefore produce ONE block, not two —
/// and the shape alone has to be enough when the app data is absent, which is
/// what another tool, or an older build, would leave behind.
#[test]
fn test_block_is_saved_as_an_excel_table() {
    use logisheets::Workbook;
    use logisheets_controller::edit_action::{
        BindFormSchema, BlockInput, CreateBlock, EditPayload, PayloadsAction, StatusCode,
    };

    let mut wb = Workbook::default();
    let result = wb.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 0,
                id: 1,
                master_row: 0,
                master_col: 0,
                row_cnt: 2,
                col_cnt: 2,
                owner: None,
                modify_policy: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                sheet_idx: 0,
                block_id: 1,
                ref_name: "sales".into(),
                field_from: 0,
                key_idx: 0,
                fields: vec!["region".into(), "amount".into()],
                render_ids: vec!["r0".into(), "r1".into()],
                field_formulas: vec![],
                validation_formulas: vec![],
                editability_formulas: vec![],
                row: true,
            }),
            EditPayload::BlockInput(BlockInput {
                sheet_idx: 0,
                block_id: 1,
                row: 0,
                col: 0,
                input: "north".into(),
            }),
            EditPayload::BlockInput(BlockInput {
                sheet_idx: 0,
                block_id: 1,
                row: 1,
                col: 0,
                input: "south".into(),
            }),
        ],
        undoable: true,
        init: false,
    }));
    assert!(matches!(result.status, StatusCode::Ok(_)));

    let saved = wb.save().expect("save");
    let part = {
        let mut zip =
            zip::ZipArchive::new(std::io::Cursor::new(saved.clone())).expect("a zip");
        let mut found = String::new();
        for i in 0..zip.len() {
            let mut f = zip.by_index(i).unwrap();
            if f.name().starts_with("xl/tables/") && f.name().ends_with(".xml") {
                use std::io::Read;
                f.read_to_string(&mut found).unwrap();
            }
        }
        found
    };
    assert!(
        part.contains("displayName=\"sales\""),
        "the block should be a table named after its ref: {}",
        part
    );
    // No header row in the sheet — a block's field names live in its schema —
    // so the table carries them as column names, the way Excel stores a table
    // created without headers.
    assert!(part.contains("headerRowCount=\"0\""), "{}", part);
    assert!(part.contains("name=\"region\""), "{}", part);
    assert!(part.contains("ref=\"A1:B2\""), "{}", part);

    // Reload: exactly one block, not one from the table and another from the
    // app data.
    let mut bytes = saved.clone();
    let reopened = Workbook::from_file(&mut bytes, String::from("again")).expect("reopen");
    let blocks = reopened.get_sheet_by_idx(0).unwrap().get_all_blocks();
    assert_eq!(blocks.len(), 1, "the table and the app data are one block");
    assert_eq!(
        blocks[0].schema.as_ref().unwrap().name,
        "sales",
        "and it keeps its name"
    );
}

/// A ref name addresses one block for the whole workbook, and the ENGINE has to
/// say so — the tool layer refusing is not enough, since any host can send a
/// `BindFormSchema` of its own.
///
/// Taking a name that is already spoken for used to overwrite the entry: the
/// first block stayed on its sheet, looking fine, while every `BLOCKREF` naming
/// it silently began resolving to the second one. Formulas that keep evaluating
/// against the wrong data are the worst failure available.
#[test]
fn test_block_ref_name_is_unique_across_the_workbook() {
    use logisheets::Workbook;
    use logisheets_controller::edit_action::{
        BindFormSchema, CreateBlock, CreateSheet, EditPayload, PayloadsAction, StatusCode,
    };

    let bind = |sheet_idx: usize, block_id: usize, name: &str| {
        vec![
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx,
                id: block_id,
                master_row: 0,
                master_col: 0,
                row_cnt: 1,
                col_cnt: 2,
                owner: None,
                modify_policy: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                sheet_idx,
                block_id,
                ref_name: name.into(),
                field_from: 0,
                key_idx: 0,
                fields: vec!["k".into(), "v".into()],
                render_ids: vec![format!("{}-0", name), format!("{}-1", name)],
                field_formulas: vec![],
                validation_formulas: vec![],
                editability_formulas: vec![],
                row: true,
            }),
        ]
    };

    let mut wb = Workbook::default();
    let r = wb.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
        payloads: {
            let mut p = vec![EditPayload::CreateSheet(CreateSheet {
                idx: 1,
                new_name: "Second".into(),
            })];
            p.extend(bind(0, 1, "dup"));
            p
        },
        undoable: true,
        init: false,
    }));
    assert!(matches!(r.status, StatusCode::Ok(_)), "{:?}", r.status);

    // The same name, a different sheet and block: refused.
    let r = wb.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
        payloads: bind(1, 2, "dup"),
        undoable: true,
        init: false,
    }));
    assert!(
        !matches!(r.status, StatusCode::Ok(_)),
        "a second block named \"dup\" should be refused, got {:?}",
        r.status
    );

    // Rebinding the SAME block under the name it already has is not a clash —
    // that is how a field gets renamed.
    let r = wb.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::BindFormSchema(BindFormSchema {
            sheet_idx: 0,
            block_id: 1,
            ref_name: "dup".into(),
            field_from: 0,
            key_idx: 0,
            fields: vec!["k".into(), "value".into()],
            render_ids: vec!["dup-0".into(), "dup-1".into()],
            field_formulas: vec![],
            validation_formulas: vec![],
            editability_formulas: vec![],
            row: true,
        })],
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(r.status, StatusCode::Ok(_)),
        "rebinding the same block should be allowed, got {:?}",
        r.status
    );

    // And the name still points where it did.
    let blocks = wb.get_sheet_by_idx(0).unwrap().get_all_blocks();
    assert_eq!(blocks.len(), 1);
    assert_eq!(blocks[0].schema.as_ref().unwrap().name, "dup");
    let fields: Vec<&str> = blocks[0]
        .schema
        .as_ref()
        .unwrap()
        .fields
        .iter()
        .map(|f| f.field.as_str())
        .collect();
    assert_eq!(fields, vec!["k", "value"], "the rebind took effect");
    assert!(
        wb.get_sheet_by_idx(1).unwrap().get_all_blocks().is_empty(),
        "the refused bind must not have left a block behind"
    );
}

/// A chart anchored with `oneCellAnchor` — one corner plus a size — comes back
/// as one, with its size intact.
///
/// Only `twoCellAnchor` used to be modeled, so such a chart was skipped on load
/// without a word and vanished on save. Giving it a synthesised second corner
/// would have been worse than skipping: the invented corner would drift the
/// first time a row was inserted between it and the anchor.
#[test]
fn test_one_cell_anchor_chart_round_trips() {
    use logisheets::Workbook;
    use std::fs;

    let anchors = |bytes: &[u8]| -> (String, String) {
        let mut zip = zip::ZipArchive::new(std::io::Cursor::new(bytes.to_vec())).unwrap();
        for i in 0..zip.len() {
            let mut f = zip.by_index(i).unwrap();
            if f.name() == "xl/drawings/drawing1.xml" {
                use std::io::Read;
                let mut s = String::new();
                f.read_to_string(&mut s).unwrap();
                let kind = if s.contains("oneCellAnchor") {
                    "oneCellAnchor"
                } else if s.contains("twoCellAnchor") {
                    "twoCellAnchor"
                } else {
                    "none"
                };
                let ext = s
                    .find("<xdr:ext ")
                    .map(|at| s[at..].split('>').next().unwrap_or("").to_string())
                    .unwrap_or_default();
                return (kind.to_string(), ext);
            }
        }
        (String::from("no drawing"), String::new())
    };

    let mut buf = fs::read("tests/one_cell_anchor.xlsx").unwrap();
    let before = anchors(&buf);
    assert_eq!(before.0, "oneCellAnchor", "fixture sanity");

    let wb = Workbook::from_file(&mut buf, String::from("one")).unwrap();
    let saved = wb.save().expect("save");
    let after = anchors(&saved);
    assert_eq!(
        after.0, "oneCellAnchor",
        "the anchor kind is kept, not converted"
    );
    assert!(
        after.1.contains(r#"cx="5400000""#) && after.1.contains(r#"cy="2700000""#),
        "the size should survive verbatim, got {:?}",
        after.1
    );
}

/// The same chart from a producer that binds the drawing namespaces as the
/// DEFAULT rather than as `xdr:` / `c:` prefixes.
///
/// The prefix is a binding the producer chose, not part of an element's
/// identity, but names here are matched literally — so every anchor in such a
/// file was invisible and the chart was dropped in silence, whatever its anchor
/// kind. The `alias` attribute (xmlserde 0.14) is what lets one declaration
/// answer to both spellings; this fixture is written by openpyxl, which does it
/// the unprefixed way.
#[test]
fn test_chart_from_a_default_namespace_drawing_round_trips() {
    use logisheets::Workbook;
    use std::fs;

    let mut buf = fs::read("tests/default_ns_drawing.xlsx").unwrap();
    // Sanity: the fixture really is the unprefixed shape.
    {
        let mut zip = zip::ZipArchive::new(std::io::Cursor::new(buf.clone())).unwrap();
        let mut found = String::new();
        for i in 0..zip.len() {
            let mut f = zip.by_index(i).unwrap();
            if f.name() == "xl/drawings/drawing1.xml" {
                use std::io::Read;
                f.read_to_string(&mut found).unwrap();
            }
        }
        assert!(
            found.contains("<oneCellAnchor") && !found.contains("<xdr:oneCellAnchor"),
            "fixture should be unprefixed"
        );
    }

    let wb = Workbook::from_file(&mut buf, String::from("dn")).unwrap();
    let saved = wb.save().expect("save");

    let mut zip = zip::ZipArchive::new(std::io::Cursor::new(saved)).unwrap();
    let mut drawing = String::new();
    let mut has_chart_part = false;
    for i in 0..zip.len() {
        let mut f = zip.by_index(i).unwrap();
        if f.name() == "xl/drawings/drawing1.xml" {
            use std::io::Read;
            f.read_to_string(&mut drawing).unwrap();
        }
        if f.name().starts_with("xl/charts/") && f.name().ends_with(".xml") {
            has_chart_part = true;
        }
    }
    assert!(has_chart_part, "the chart part should be written back");
    assert!(
        drawing.contains("<xdr:oneCellAnchor"),
        "and its anchor kind kept — written under our own prefix: {}",
        &drawing[..drawing.len().min(200)]
    );
    assert!(
        drawing.contains(r#"cx="5400000""#),
        "with the size intact: {}",
        &drawing[..drawing.len().min(300)]
    );
}




/// A pivot table and the cache it reads from both come back.
///
/// Neither was written on save, so a workbook arrived with a pivot and left
/// without one. Fixing that exposed the reason the chain could not have worked
/// anyway: `CtPivotCaches` declared its child element as `pivot_cache`, and
/// OOXML spells it `pivotCache`. The wrapper matched, its contents never did, so
/// the list was always empty — which left the writer unable to say which cache a
/// pivot table reads and so unable to write the table's relationship file.
///
/// Seven more element names had the same snake_case slip; `textRotation` is the
/// one a person would notice, since a rotated cell came back straight.
#[test]
fn test_pivot_table_and_cache_round_trip() {
    use logisheets::Workbook;
    use std::fs;

    let parts = |bytes: &[u8]| -> Vec<String> {
        let mut zip = zip::ZipArchive::new(std::io::Cursor::new(bytes.to_vec())).unwrap();
        (0..zip.len())
            .map(|i| zip.by_index(i).unwrap().name().to_string())
            .filter(|n| n.contains("pivot"))
            .collect()
    };

    let mut buf = fs::read("tests/calc_test.xlsx").unwrap();
    let before = parts(&buf);
    assert!(
        before.iter().any(|p| p.contains("pivotTables/pivotTable")),
        "fixture should have a pivot table, got {:?}",
        before
    );

    let wb = Workbook::from_file(&mut buf, String::from("pv")).unwrap();
    let saved = wb.save().expect("save");
    let after = parts(&saved);

    for want in [
        "xl/pivotTables/pivotTable1.xml",
        "xl/pivotTables/_rels/pivotTable1.xml.rels",
        "xl/pivotCache/pivotCacheDefinition1.xml",
        "xl/pivotCache/pivotCacheRecords1.xml",
    ] {
        assert!(
            after.iter().any(|p| p == want),
            "{} should be written back; got {:?}",
            want,
            after
        );
    }
}

/// A part reached by a relationship type nothing here models is kept, along with
/// everything it references and its `[Content_Types].xml` entry.
///
/// `tests/7.xlsx` is a WPS workbook whose in-cell images live in a vendor
/// extension: `xl/cellimages.xml` is a manifest, its own relationships name the
/// eight media files, and the cells hold `_xlfn.DISPIMG(...)`. None of that is
/// OOXML — the `_xlfn.` prefix is the producer saying so — and Excel does not
/// render it either. Which is exactly why the reader used to no-op on the
/// relationship and the writer emit nothing: a save deleted the manifest, its
/// rels, and all eight images.
///
/// Preserving is not supporting. Nothing here understands the bytes and no
/// renderer will show them; it only means a save is not a deletion.
#[test]
fn test_unmodeled_parts_survive_a_save() {
    use logisheets::Workbook;
    use std::fs;

    let names = |bytes: &[u8]| -> Vec<String> {
        let mut zip = zip::ZipArchive::new(std::io::Cursor::new(bytes.to_vec())).unwrap();
        (0..zip.len())
            .map(|i| zip.by_index(i).unwrap().name().to_string())
            .collect()
    };
    let text_of = |bytes: &[u8], want: &str| -> String {
        let mut zip = zip::ZipArchive::new(std::io::Cursor::new(bytes.to_vec())).unwrap();
        for i in 0..zip.len() {
            let mut f = zip.by_index(i).unwrap();
            if f.name() == want {
                use std::io::Read;
                let mut s = String::new();
                let _ = f.read_to_string(&mut s);
                return s;
            }
        }
        String::new()
    };

    let mut buf = fs::read("tests/7.xlsx").unwrap();
    let wb = Workbook::from_file(&mut buf, String::from("wps")).unwrap();
    let saved = wb.save().expect("save");
    let after = names(&saved);

    for want in [
        "xl/cellimages.xml",
        "xl/_rels/cellimages.xml.rels",
        "xl/media/image1.png",
        "xl/media/image6.webp",
        "xl/media/image8.png",
    ] {
        assert!(
            after.iter().any(|n| n == want),
            "{} should survive; got {:?}",
            want,
            after
        );
    }

    // The vendor content type has to travel with the part: nothing can derive
    // it from a relationship type.
    let ct = text_of(&saved, "[Content_Types].xml");
    assert!(
        ct.contains("application/vnd.wps-officedocument.cellimage+xml"),
        "the content type override should be carried: {}",
        ct
    );
    // And the relationship that reached it, under its original id, because the
    // manifest is referenced by that id.
    let rels = text_of(&saved, "xl/_rels/workbook.xml.rels");
    assert!(
        rels.contains("cellimages.xml") && rels.contains("www.wps.cn"),
        "the relationship should be re-attached: {}",
        rels
    );

    // No two relationships may share an Id — preserved ids keep theirs, so ours
    // step around them.
    for part in ["xl/_rels/workbook.xml.rels", "xl/worksheets/_rels/sheet1.xml.rels"] {
        let xml = text_of(&saved, part);
        let mut ids: Vec<&str> = xml
            .match_indices("Id=\"")
            .map(|(at, _)| {
                let rest = &xml[at + 4..];
                &rest[..rest.find('"').unwrap_or(0)]
            })
            .collect();
        let before = ids.len();
        ids.sort_unstable();
        ids.dedup();
        assert_eq!(before, ids.len(), "duplicate relationship id in {}", part);
    }

    // What we wrote has to be readable again.
    let mut again = saved.clone();
    Workbook::from_file(&mut again, String::from("wps2")).expect("reopen");
}

/// Dividing by a small number is division, not division by zero.
///
/// The divide operator treated anything under 1e-10 in magnitude as zero, so
/// ordinary arithmetic on small quantities came back `#DIV/0!`. Rates,
/// probabilities and any scientific measure live down there — proptest found it
/// as `=(-(2^(-5)))/7^(-12)`, which is -432540225.03125 and not an error.
///
/// The same 1e-10 was in the blank-versus-number comparison, where it made
/// every number smaller than that EQUAL to an empty cell.
#[test]
fn test_small_divisors_and_blank_comparisons() {
    use logisheets::{Value, Workbook};

    let mut wb = Workbook::default();
    let eval = |wb: &mut Workbook, f: &str| -> Value {
        use logisheets_controller::edit_action::{CellInput, EditPayload, PayloadsAction};
        let r = wb.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
            payloads: vec![EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 20,
                col: 20,
                content: f.to_string(),
            })],
            undoable: true,
            init: false,
        }));
        assert!(matches!(
            r.status,
            logisheets_controller::edit_action::StatusCode::Ok(_)
        ));
        wb.get_sheet_by_idx(0).unwrap().get_value(20, 20).unwrap()
    };

    // The case proptest shrank to.
    let v = eval(&mut wb, "=(-(2^(-5)))/7^(-12)");
    assert!(
        matches!(v, Value::Number(n) if (n - -432540225.03125).abs() < 1e-4),
        "expected -432540225.03125, got {:?}",
        v
    );
    // A divisor far below the old cutoff.
    let v = eval(&mut wb, "=1/0.00000000000001");
    assert!(
        matches!(v, Value::Number(n) if (n - 1e14).abs() < 1.0),
        "got {:?}",
        v
    );
    // Exact zero is still #DIV/0!.
    let v = eval(&mut wb, "=1/0");
    assert!(matches!(v, Value::Error(ref e) if e == "#DIV/0!"), "got {:?}", v);
    // And an overflow is #NUM!, not infinity.
    let v = eval(&mut wb, "=1E308/0.000000001");
    assert!(matches!(v, Value::Error(ref e) if e == "#NUM!"), "got {:?}", v);

    // A blank is zero, so a tiny positive number is greater than one — not
    // equal to it.
    let v = eval(&mut wb, "=A50=0.00000000005");
    assert!(matches!(v, Value::Bool(false)), "blank should not equal 5e-11, got {:?}", v);
    let v = eval(&mut wb, "=A50<0.00000000005");
    assert!(matches!(v, Value::Bool(true)), "blank is less than 5e-11, got {:?}", v);
    // A blank really does equal zero.
    let v = eval(&mut wb, "=A50=0");
    assert!(matches!(v, Value::Bool(true)), "got {:?}", v);
}
