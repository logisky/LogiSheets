//! One workbook carrying every piece of block + schema state we persist, put
//! through a real `.xlsx` save/load twice.
//!
//! The existing coverage was three disconnected layers: `roundtrip_corpus.rs`
//! checks that no zip entry disappears but knows nothing about blocks; the
//! persistence unit tests in `block_manager/*/persistence.rs` stop at the
//! xmlserde structs, so nothing they assert ever reaches the writer; and the
//! integration tests are single-issue regressions (owner + policy, one link,
//! one formula). Between them, no test ever asserted that a schema bound by
//! `BindFormSchema` comes back field-for-field from a file — and `ColSchema`,
//! `RandomSchema`, `<fieldRender>` and `<colInfos>` had never been written to
//! disk by any test at all.
//!
//! The shape here is deliberately one workbook rather than a test per feature:
//! the interesting failures are cross-cutting (a `blockId` collision between
//! sheets, a ref-name index rebuilt in the wrong order, an XML attribute that
//! only breaks when a sibling element is present), and they only show up when
//! everything is in the same file.
//!
//! `check` runs against three states — freshly authored, after one round trip,
//! after two — so the file is asserted to be a *fixed point*, not merely
//! survivable. A second trip catches the class of bug where load reconstructs
//! state that save then cannot re-emit.

use logisheets::Workbook;
use logisheets_controller::controller::display::BlockSchemaType;
use logisheets_controller::edit_action::{
    BindFormSchema, BindRandomSchema, BlockActor, BlockLineNameFieldUpdate, BlockOp,
    BlockPermissions, CellInput, CreateAppendix, CreateBlock, CreateLink, CreateSheet, EditAction,
    EditPayload, InsertRows, ModifyPolicy, PayloadsAction, RandomSchemaUnit, StatusCode,
    StyleUpdateType, UpsertFieldRenderInfo,
};

// ---------------------------------------------------------------------------
// The authored workbook
// ---------------------------------------------------------------------------

/// Sheet 0's row-schema block: 3 records x 4 columns at A1, key in col 0.
const ORDERS: usize = 1;
/// Sheet 1's col-schema block: fields run DOWN rows, records across columns.
const SPECS: usize = 1;
/// Sheet 1's random-schema block: keys at arbitrary (row, col) offsets.
const DIAL: usize = 2;
/// Sheet 1's plain block — no schema at all. A `<blockRange>` with no sibling
/// schema element is its own persistence case, and it is what the cross-sheet
/// link points at.
const LEDGER: usize = 3;

/// Formula templates deliberately containing `<`, `>` and `"`. Every one of
/// them is stored as an XML *attribute* in `logisheets/data.xml`, so a missing
/// escape corrupts the part rather than merely losing a value — and nothing
/// else in the suite writes those characters into it.
const TOTAL_VALUE_RULE: &str = r#"=#FIELD("qty")*#FIELD("price")"#;
const TOTAL_VALIDATION_RULE: &str = r#"=AND(#PLACEHOLDER>0,#PLACEHOLDER<10000)"#;
const TOTAL_EDITABILITY_RULE: &str = r#"=#FIELD("qty")<>0"#;

fn ok(wb: &mut Workbook, payloads: Vec<EditPayload>) {
    let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads,
        undoable: false,
        init: false,
    }));
    assert!(
        matches!(effect.status, StatusCode::Ok(_)),
        "authoring transaction failed: {:?}",
        effect.status
    );
}

fn authored() -> Workbook {
    let mut wb = Workbook::default();

    ok(
        &mut wb,
        vec![EditPayload::CreateSheet(CreateSheet {
            idx: 1,
            new_name: "io".into(),
        })],
    );

    // Block ids are minted per sheet, so ORDERS (sheet 0) and SPECS (sheet 1)
    // deliberately collide on id 1. A persistence layer keyed by block id alone
    // rather than (sheet, block) merges them; nothing else in the suite puts
    // two same-id blocks with *schemas* in one file.
    assert_eq!(wb.get_available_block_id(0).unwrap(), ORDERS);
    assert_eq!(wb.get_available_block_id(1).unwrap(), SPECS);

    // ---- sheet 0: row schema, all three rule kinds, owner + policy ---------
    ok(
        &mut wb,
        vec![
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 0,
                id: ORDERS,
                master_row: 0,
                master_col: 0,
                row_cnt: 3,
                col_cnt: 4,
                owner: Some("roundtrip-craft".into()),
                modify_policy: Some(ModifyPolicy::OwnerAndUser),
                // A craft-owned block that still wants the user typing in it,
                // but must not have rows pulled out from under it or its
                // schema re-pointed — the case the per-operation policies
                // exist for. `sort_by_field` is left unstated on purpose, so
                // the trip has to preserve "defers to the default" as
                // something distinct from "stated as ownerAndUser".
                permissions: Some(BlockPermissions {
                    insert_delete_lines: Some(ModifyPolicy::OwnerOnly),
                    remove_block: Some(ModifyPolicy::OwnerOnly),
                    modify_schema: Some(ModifyPolicy::OwnerOnly),
                    cell_input: Some(ModifyPolicy::All),
                    sort_by_field: None,
                    modify_description: Some(ModifyPolicy::OwnerOnly),
                }),
                description: Some(
                    "Customer orders, one per row. `total` is qty * price and is \
                     maintained by the craft — write qty or price, never total."
                        .into(),
                ),
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "orders".into(),
                sheet_idx: 0,
                block_id: ORDERS,
                field_from: 1,
                key_idx: 0,
                fields: vec!["qty".into(), "price".into(), "total".into()],
                render_ids: vec!["r-qty".into(), "r-price".into(), "r-total".into()],
                row: true,
                field_formulas: vec![None, None, Some(TOTAL_VALUE_RULE.into())],
                validation_formulas: vec![None, None, Some(TOTAL_VALIDATION_RULE.into())],
                editability_formulas: vec![None, None, Some(TOTAL_EDITABILITY_RULE.into())],
            }),
        ],
    );

    // Records. The key column holds strings; `qty`/`price` are free-form and
    // `total` is engine-derived, so its value is proof the rule survived as a
    // *live* formula rather than a retained string.
    let mut records = Vec::new();
    for (i, (key, qty, price)) in [
        ("a-1", "2", "3.5"),
        ("b-2", "4", "1.25"),
        ("c-3", "1", "10"),
    ]
    .iter()
    .enumerate()
    {
        for (col, content) in [(0, *key), (1, *qty), (2, *price)] {
            records.push(EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: i,
                col,
                content: content.to_string(),
            }));
        }
    }
    ok(&mut wb, records);

    // Per-line metadata, on columns 0 and 2 only. Sparse on purpose: the writer
    // emits just the annotated lines, so an entry has to carry its own position
    // or the loader can only zip positionally and column 2's label lands on
    // column 1. Annotating every column would hide exactly that.
    ok(
        &mut wb,
        [0usize, 2]
            .into_iter()
            .map(|line| {
                EditPayload::BlockLineNameFieldUpdate(BlockLineNameFieldUpdate {
                    sheet_idx: 0,
                    block_id: ORDERS,
                    line,
                    row: false,
                    // Column 0's label carries `&` and angle brackets: the one
                    // attribute in the data part a human types freely. There is
                    // no public reader for a line name, so it is not asserted
                    // directly — but a broken escape here takes the whole part
                    // with it, and every assertion below would fail at once.
                    name: Some(if line == 0 {
                        "a & b <c>".to_string()
                    } else {
                        format!("col-name-{line}")
                    }),
                    field_id: format!("field-{line}"),
                    diy_render: Some(line % 2 == 0),
                })
            })
            .collect(),
    );

    // ---- sheet 1: col schema + random schema ------------------------------
    ok(
        &mut wb,
        vec![
            // Fields run DOWN rows here: 4 rows (key + 3 fields) x 2 records.
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 1,
                id: SPECS,
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
                ref_name: "specs".into(),
                sheet_idx: 1,
                block_id: SPECS,
                field_from: 1,
                key_idx: 0,
                fields: vec!["alpha".into(), "beta".into(), "gamma".into()],
                render_ids: vec!["r-alpha".into(), "r-beta".into(), "r-gamma".into()],
                row: false,
                field_formulas: vec![],
                validation_formulas: vec![],
                editability_formulas: vec![],
            }),
            // Random schema: keys pinned to explicit (row, col) offsets, which
            // is the only schema kind with no axis at all.
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 1,
                id: DIAL,
                master_row: 10,
                master_col: 0,
                row_cnt: 3,
                col_cnt: 3,
                owner: Some("dial-craft".into()),
                modify_policy: Some(ModifyPolicy::OwnerOnly),
                permissions: None,
                description: None,
            }),
            EditPayload::BindRandomSchema(BindRandomSchema {
                ref_name: "dial".into(),
                sheet_idx: 1,
                block_id: DIAL,
                units: vec![
                    RandomSchemaUnit {
                        key: "top-left".into(),
                        render_id: "r-tl".into(),
                        row: 0,
                        col: 0,
                    },
                    RandomSchemaUnit {
                        key: "middle".into(),
                        render_id: "r-mid".into(),
                        row: 1,
                        col: 1,
                    },
                    RandomSchemaUnit {
                        key: "bottom-right".into(),
                        render_id: "r-br".into(),
                        row: 2,
                        col: 2,
                    },
                ],
            }),
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 1,
                id: LEDGER,
                master_row: 20,
                master_col: 0,
                row_cnt: 2,
                col_cnt: 1,
                owner: None,
                modify_policy: None,
                permissions: None,
                description: None,
            }),
        ],
    );

    // The col-schema block's key row and one data row, so the schema has
    // something to key on after reload.
    ok(
        &mut wb,
        vec![
            EditPayload::CellInput(CellInput {
                sheet_idx: 1,
                row: 0,
                col: 0,
                content: "k0".into(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 1,
                row: 0,
                col: 1,
                content: "k1".into(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 1,
                row: 1,
                col: 0,
                content: "7".into(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 1,
                row: 1,
                col: 1,
                content: "9".into(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 1,
                row: 20,
                col: 0,
                content: "7".into(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 1,
                row: 21,
                col: 0,
                content: "9".into(),
            }),
        ],
    );

    // ---- workbook-level field renders -------------------------------------
    // `<fieldRender>` is the one persisted element that hangs off the workbook
    // rather than a sheet, and its StyleId is re-minted on load (the xlsx style
    // table renumbers), so the assertion has to be on the FORMATTER, not the id.
    ok(
        &mut wb,
        vec![
            EditPayload::UpsertFieldRenderInfo(UpsertFieldRenderInfo {
                render_id: "r-price".into(),
                diy_render: false,
                style_update: StyleUpdateType {
                    set_num_fmt: Some("0.00".to_string()),
                    ..Default::default()
                },
            }),
            EditPayload::UpsertFieldRenderInfo(UpsertFieldRenderInfo {
                render_id: "r-total".into(),
                diy_render: true,
                style_update: StyleUpdateType {
                    set_num_fmt: Some(r##""¥"#,##0.00"##.to_string()),
                    ..Default::default()
                },
            }),
            EditPayload::UpsertFieldRenderInfo(UpsertFieldRenderInfo {
                render_id: "r-alpha".into(),
                diy_render: true,
                style_update: StyleUpdateType::default(),
            }),
        ],
    );

    // ---- a cross-sheet range link over the col-schema block ----------------
    // Source range lives on sheet 0; the backing block is on sheet 1. The link
    // is stored as `<linkRange blockSheetIdx=…>` and restored only after every
    // sheet's blocks exist, which is exactly the ordering a two-sheet file
    // exercises and a one-sheet file cannot.
    ok(
        &mut wb,
        vec![
            EditPayload::CreateLink(CreateLink {
                sheet_idx: 0,
                master_row: 20,
                master_col: 0,
                row_cnt: 2,
                col_cnt: 1,
                block_id: LEDGER,
                block_sheet_idx: Some(1),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 20,
                col: 5,
                content: "=SUM(A21:A22)".into(),
            }),
        ],
    );

    // ---- craft appendices on block cells -----------------------------------
    // Two stacked on one cell (the manager holds a Vec per cell, and the craft
    // that wrote them reads them back in push order) plus one on another cell,
    // so the save cannot get away with emitting a single entry per cell or
    // letting hash order decide what comes back.
    ok(
        &mut wb,
        vec![
            EditPayload::CreateAppendix(CreateAppendix {
                sheet_id: None,
                sheet_idx: Some(0),
                block_id: ORDERS,
                row_idx: 1,
                col_idx: 2,
                craft_id: "roundtrip-craft".into(),
                tag: 7,
                content: r#"{"note":"a & b < c"}"#.into(),
            }),
            EditPayload::CreateAppendix(CreateAppendix {
                sheet_id: None,
                sheet_idx: Some(0),
                block_id: ORDERS,
                row_idx: 1,
                col_idx: 2,
                craft_id: "other-craft".into(),
                tag: 0,
                content: String::new(),
            }),
            EditPayload::CreateAppendix(CreateAppendix {
                sheet_id: None,
                sheet_idx: Some(0),
                block_id: ORDERS,
                row_idx: 2,
                col_idx: 0,
                craft_id: "roundtrip-craft".into(),
                tag: 255,
                content: "plain text".into(),
            }),
        ],
    );

    wb
}

// ---------------------------------------------------------------------------
// The assertion
// ---------------------------------------------------------------------------

fn num(wb: &Workbook, sheet_idx: usize, row: usize, col: usize) -> f64 {
    match wb
        .get_sheet_by_idx(sheet_idx)
        .unwrap()
        .get_value(row, col)
        .unwrap()
    {
        logisheets::Value::Number(n) => n,
        other => panic!("expected a number at ({sheet_idx},{row},{col}), got {other:?}"),
    }
}

fn check(wb: &Workbook, stage: &str) {
    // ---- sheet 0 / row schema ---------------------------------------------
    let ws0 = wb.get_sheet_by_idx(0).unwrap();
    let orders = ws0
        .get_block_info(ORDERS)
        .unwrap_or_else(|e| panic!("[{stage}] orders block missing: {e:?}"));
    assert_eq!(
        (
            orders.row_start,
            orders.col_start,
            orders.row_cnt,
            orders.col_cnt
        ),
        (0, 0, 3, 4),
        "[{stage}] orders geometry"
    );

    let schema = orders
        .schema
        .as_ref()
        .unwrap_or_else(|| panic!("[{stage}] orders lost its schema"));
    assert_eq!(schema.name, "orders", "[{stage}] orders ref name");
    assert!(
        matches!(schema.schema_type, BlockSchemaType::Row),
        "[{stage}] orders schema type"
    );

    // Fields: name, axis index, render id and all three rule templates, in
    // declared order. The axis index is the part the unit tests cannot see —
    // it is stored as an axis *id* and re-resolved to a position on load.
    let fields: Vec<(&str, usize, &str, Option<&str>, Option<&str>, Option<&str>)> = schema
        .fields
        .iter()
        .map(|f| {
            (
                f.field.as_str(),
                f.idx,
                f.render_id.as_str(),
                f.value_formula.as_deref(),
                f.validation_formula.as_deref(),
                f.editability_formula.as_deref(),
            )
        })
        .collect();
    assert_eq!(
        fields,
        vec![
            ("qty", 1, "r-qty", None, None, None),
            ("price", 2, "r-price", None, None, None),
            (
                "total",
                3,
                "r-total",
                Some(TOTAL_VALUE_RULE),
                Some(TOTAL_VALIDATION_RULE),
                Some(TOTAL_EDITABILITY_RULE),
            ),
        ],
        "[{stage}] orders fields (order, axis idx, render id, rules)"
    );

    // Keys carry their own record row — the key column is col 0, which is NOT
    // in `fields`, so this also pins down `key_idx` surviving the trip.
    let keys: Vec<(&str, usize)> = schema
        .keys
        .iter()
        .map(|k| (k.key.as_str(), k.idx))
        .collect();
    assert_eq!(
        keys,
        vec![("a-1", 0), ("b-2", 1), ("c-3", 2)],
        "[{stage}] orders keys"
    );

    // The value rule is live, not a retained string: 2*3.5, 4*1.25, 1*10.
    for (row, want) in [(0usize, 7.0), (1, 5.0), (2, 10.0)] {
        let got = num(wb, 0, row, 3);
        assert!(
            (got - want).abs() < 1e-9,
            "[{stage}] total row {row}: want {want}, got {got}"
        );
    }

    // Owner + policy.
    let modify = wb.get_block_modify_info(0, ORDERS).unwrap();
    assert_eq!(modify.owner, "roundtrip-craft", "[{stage}] orders owner");
    assert!(
        matches!(modify.modify_policy, ModifyPolicy::OwnerAndUser),
        "[{stage}] orders policy"
    );

    // ---- description ------------------------------------------------------
    // Prose, with the quoting and the line continuation the authored string
    // had: this is the one field an AI reads to know what the block is for, so
    // it has to come back as written rather than merely non-empty.
    assert_eq!(
        modify.description,
        "Customer orders, one per row. `total` is qty * price and is \
         maintained by the craft — write qty or price, never total.",
        "[{stage}] orders description"
    );
    // Reported on the block itself too, which is what the host renders from.
    let info = wb
        .get_sheet_by_idx(0)
        .unwrap()
        .get_block_info(ORDERS)
        .unwrap();
    assert_eq!(
        info.description, modify.description,
        "[{stage}] description agrees between block info and modify info"
    );

    // ---- per-operation permissions ----------------------------------------
    // Each operation separately, INCLUDING the one deliberately left unstated:
    // "defers to the block's default" has to survive as its own thing, or a
    // trip would quietly freeze it as whatever the default happened to be.
    let perms = &modify.permissions;
    assert_eq!(
        perms.explicit(BlockOp::InsertDeleteLines),
        Some(ModifyPolicy::OwnerOnly),
        "[{stage}] insertDeleteLines"
    );
    assert_eq!(
        perms.explicit(BlockOp::RemoveBlock),
        Some(ModifyPolicy::OwnerOnly),
        "[{stage}] removeBlock"
    );
    assert_eq!(
        perms.explicit(BlockOp::ModifySchema),
        Some(ModifyPolicy::OwnerOnly),
        "[{stage}] modifySchema"
    );
    assert_eq!(
        perms.explicit(BlockOp::CellInput),
        Some(ModifyPolicy::All),
        "[{stage}] cellInput"
    );
    assert_eq!(
        perms.explicit(BlockOp::SortByField),
        None,
        "[{stage}] sortByField stays unstated"
    );
    assert_eq!(
        perms.explicit(BlockOp::ModifyDescription),
        Some(ModifyPolicy::OwnerOnly),
        "[{stage}] modifyDescription"
    );
    // ...and that the unstated one still resolves through the default.
    assert_eq!(
        perms.policy_for(BlockOp::SortByField, modify.modify_policy),
        ModifyPolicy::OwnerAndUser,
        "[{stage}] sortByField falls back to the block default"
    );

    // The decision the host actually asks for, end to end.
    let user = BlockActor::User;
    let owner = BlockActor::Craft("roundtrip-craft".into());
    let other = BlockActor::Craft("some-other-craft".into());
    let may = |op, actor: &BlockActor| wb.may_modify_block(0, ORDERS, op, actor).unwrap();
    assert!(
        !may(BlockOp::InsertDeleteLines, &user),
        "[{stage}] the user must not resize a craft-owned block"
    );
    assert!(
        may(BlockOp::InsertDeleteLines, &owner),
        "[{stage}] its owner still can"
    );
    // Deleting the block outright is the mistake there is no undoing by
    // editing, so it gets its own policy rather than riding on the others.
    assert!(
        !may(BlockOp::RemoveBlock, &user),
        "[{stage}] the user must not delete a craft-owned block"
    );
    assert!(
        !may(BlockOp::RemoveBlock, &other),
        "[{stage}] nor another craft"
    );
    assert!(may(BlockOp::RemoveBlock, &owner), "[{stage}] its owner may");
    assert!(
        may(BlockOp::CellInput, &user),
        "[{stage}] but the user keeps typing in it"
    );
    assert!(
        may(BlockOp::CellInput, &other),
        "[{stage}] cellInput is All, which means any craft as well"
    );
    // Where a third party IS shut out: OwnerOnly excludes both the user and
    // other crafts, which is the difference from the block's OwnerAndUser
    // default that `sort_by_field` still defers to.
    assert!(
        !may(BlockOp::ModifySchema, &other),
        "[{stage}] another craft must not re-point the schema"
    );
    assert!(
        may(BlockOp::SortByField, &user),
        "[{stage}] sorting falls back to OwnerAndUser, so the user may"
    );
    assert!(
        !may(BlockOp::SortByField, &other),
        "[{stage}] but another craft may not"
    );

    // ---- field renders ----------------------------------------------------
    // Reported per block, keyed by the render ids its schema actually uses.
    let mut renders: Vec<(String, Option<String>, bool)> = orders
        .field_renders
        .iter()
        .map(|r| {
            (
                r.render_id.clone(),
                r.style.as_ref().map(|s| s.formatter.clone()),
                r.diy_render,
            )
        })
        .collect();
    renders.sort();
    assert_eq!(
        renders,
        vec![
            ("r-price".to_string(), Some("0.00".to_string()), false),
            (
                "r-total".to_string(),
                Some(r##""¥"#,##0.00"##.to_string()),
                true
            ),
        ],
        "[{stage}] orders field renders (numFmt is re-minted on load, so the \
         FORMATTER must match even though the StyleId will not)"
    );

    // ---- per-line metadata ------------------------------------------------
    // Only `field_id` has a public reader; name / diy_render are write-only
    // today, so the round trip is asserted through the field ids here, and
    // through the emitted `line` attribute in the dedicated test below.
    let mut line_fields: Vec<String> = wb
        .get_all_block_fields()
        .unwrap()
        .into_iter()
        .filter(|f| f.sheet_id == orders.sheet_id && f.block_id == ORDERS)
        .map(|f| f.field_id)
        .collect();
    line_fields.sort();
    assert_eq!(
        line_fields,
        vec!["field-0", "field-2"],
        "[{stage}] orders per-column field ids — the two annotated columns and \
         nothing invented for the two that were not"
    );

    // ---- craft appendices ---------------------------------------------------
    let stacked = ws0.get_reproducible_cell(1, 2).unwrap().appendix;
    assert_eq!(
        stacked
            .iter()
            .map(|a| (a.craft_id.as_str(), a.tag, a.content.as_str()))
            .collect::<Vec<_>>(),
        vec![
            ("roundtrip-craft", 7u8, r#"{"note":"a & b < c"}"#),
            // An empty payload is its own case: an element written with no text
            // produces no text event when read back, so a missing default makes
            // the whole part unreadable.
            ("other-craft", 0, ""),
        ],
        "[{stage}] both appendices on one cell, in push order"
    );
    let single = ws0.get_reproducible_cell(2, 0).unwrap().appendix;
    assert_eq!(
        single
            .iter()
            .map(|a| (a.craft_id.as_str(), a.tag, a.content.as_str()))
            .collect::<Vec<_>>(),
        vec![("roundtrip-craft", 255u8, "plain text")],
        "[{stage}] the appendix on the second cell"
    );
    assert!(
        ws0.get_reproducible_cell(0, 0).unwrap().appendix.is_empty(),
        "[{stage}] an unannotated block cell must not pick one up"
    );

    // ---- sheet 1 / col schema ---------------------------------------------
    let ws1 = wb.get_sheet_by_idx(1).unwrap();
    assert_eq!(
        wb.get_sheet_name_by_idx(1).unwrap(),
        "io",
        "[{stage}] sheet 1 name"
    );
    let specs = ws1
        .get_block_info(SPECS)
        .unwrap_or_else(|e| panic!("[{stage}] specs block missing: {e:?}"));
    let specs_schema = specs
        .schema
        .as_ref()
        .unwrap_or_else(|| panic!("[{stage}] specs lost its schema"));
    assert_eq!(specs_schema.name, "specs", "[{stage}] specs ref name");
    assert!(
        matches!(specs_schema.schema_type, BlockSchemaType::Col),
        "[{stage}] specs must stay a COL schema — the three variants share a \
         wire shape and are told apart only by element name"
    );
    let specs_fields: Vec<(&str, usize, &str)> = specs_schema
        .fields
        .iter()
        .map(|f| (f.field.as_str(), f.idx, f.render_id.as_str()))
        .collect();
    assert_eq!(
        specs_fields,
        vec![
            ("alpha", 1, "r-alpha"),
            ("beta", 2, "r-beta"),
            ("gamma", 3, "r-gamma")
        ],
        "[{stage}] specs fields index the ROW axis"
    );
    let specs_keys: Vec<(&str, usize)> = specs_schema
        .keys
        .iter()
        .map(|k| (k.key.as_str(), k.idx))
        .collect();
    assert_eq!(
        specs_keys,
        vec![("k0", 0), ("k1", 1)],
        "[{stage}] specs keys index COLUMNS"
    );

    // ---- sheet 1 / random schema ------------------------------------------
    let dial = ws1
        .get_block_info(DIAL)
        .unwrap_or_else(|e| panic!("[{stage}] dial block missing: {e:?}"));
    let dial_schema = dial
        .schema
        .as_ref()
        .unwrap_or_else(|| panic!("[{stage}] dial lost its schema"));
    assert_eq!(dial_schema.name, "dial", "[{stage}] dial ref name");
    assert!(
        matches!(dial_schema.schema_type, BlockSchemaType::Random),
        "[{stage}] dial schema type"
    );
    let mut dial_entries: Vec<(String, usize, usize, String)> = dial_schema
        .random_entries
        .iter()
        .map(|e| (e.key.clone(), e.row, e.col, e.render_id.clone()))
        .collect();
    dial_entries.sort();
    assert_eq!(
        dial_entries,
        vec![
            ("bottom-right".to_string(), 2, 2, "r-br".to_string()),
            ("middle".to_string(), 1, 1, "r-mid".to_string()),
            ("top-left".to_string(), 0, 0, "r-tl".to_string()),
        ],
        "[{stage}] dial random entries (row/col are stored as axis ids and \
         re-resolved to offsets on load)"
    );
    let dial_modify = wb.get_block_modify_info(1, DIAL).unwrap();
    assert_eq!(dial_modify.owner, "dial-craft", "[{stage}] dial owner");
    assert!(
        matches!(dial_modify.modify_policy, ModifyPolicy::OwnerOnly),
        "[{stage}] dial policy"
    );

    // Two blocks on sheet 1, three across the workbook — a block id colliding
    // across sheets must not merge them.
    assert_eq!(
        ws1.get_all_blocks().len(),
        3,
        "[{stage}] sheet 1 block count"
    );
    assert_eq!(
        ws0.get_all_blocks().len(),
        1,
        "[{stage}] sheet 0 block count"
    );
    assert_eq!(
        wb.get_all_blocks(None, None).unwrap().len(),
        4,
        "[{stage}] workbook block count"
    );
    // A block with no schema still comes back as a block, and without one.
    let ledger = ws1
        .get_block_info(LEDGER)
        .unwrap_or_else(|e| panic!("[{stage}] ledger block missing: {e:?}"));
    assert!(
        ledger.schema.is_none(),
        "[{stage}] the unschema'd block must not acquire a schema on load"
    );
    assert_eq!(
        (
            ledger.row_start,
            ledger.col_start,
            ledger.row_cnt,
            ledger.col_cnt
        ),
        (20, 0, 2, 1),
        "[{stage}] ledger geometry"
    );

    // ---- cross-sheet link --------------------------------------------------
    let links = ws0.get_links();
    assert_eq!(links.len(), 1, "[{stage}] the cross-sheet link");
    assert_eq!(
        (
            links[0].block_id,
            links[0].start_row,
            links[0].start_col,
            links[0].end_row,
            links[0].end_col
        ),
        (LEDGER, 20, 0, 21, 0),
        "[{stage}] link source rectangle + target block"
    );
    // The facade stays empty and the formula over it reads the sheet-1 block: 7 + 9.
    assert!(
        matches!(ws0.get_value(20, 0).unwrap(), logisheets::Value::Empty),
        "[{stage}] the linked source range must stay untouched"
    );
    let linked = num(wb, 0, 20, 5);
    assert!(
        (linked - 16.0).abs() < 1e-9,
        "[{stage}] SUM over the linked facade should read the sheet-1 block (16), got {linked}"
    );
    assert_eq!(
        ws0.get_formula(20, 5).unwrap(),
        "SUM(A21:A22)",
        "[{stage}] the formula keeps its facade reference"
    );
}

// ---------------------------------------------------------------------------
// The tests
// ---------------------------------------------------------------------------

fn round_trip(wb: &Workbook, name: &str) -> Workbook {
    let bytes = wb.save().unwrap_or_else(|e| panic!("save {name}: {e:?}"));
    Workbook::from_file(&bytes, name.to_string()).unwrap_or_else(|e| panic!("load {name}: {e:?}"))
}

/// Everything above, asserted identically before the save, after one trip and
/// after two.
#[test]
fn block_and_schema_state_is_a_save_load_fixed_point() {
    let wb = authored();
    check(&wb, "authored");

    let once = round_trip(&wb, "trip-1.xlsx");
    check(&once, "after 1 round trip");

    let twice = round_trip(&once, "trip-2.xlsx");
    check(&twice, "after 2 round trips");
}

/// The bytes must stabilise too, not just the observable state.
///
/// A file that differs on every save is a file that cannot be diffed, and it is
/// usually a symptom: an id minted fresh each time, or a `HashMap` iteration
/// order leaking into the output. `schemas_to_xml` documents its output order as
/// unspecified, so schema element order is normalised out of this comparison —
/// everything else has to land byte-identical.
#[test]
fn a_second_save_produces_the_same_data_part() {
    let wb = authored();
    let once = round_trip(&wb, "stable-1.xlsx");
    let twice = round_trip(&once, "stable-2.xlsx");

    let a = data_xml(&once.save().unwrap());
    let b = data_xml(&twice.save().unwrap());
    assert_eq!(
        sorted_elements(&a),
        sorted_elements(&b),
        "logisheets/data.xml drifts between saves"
    );
}

fn data_xml(bytes: &[u8]) -> String {
    use std::io::Read;
    let mut zip = zip::ZipArchive::new(std::io::Cursor::new(bytes.to_vec())).expect("a zip");
    for i in 0..zip.len() {
        let mut f = zip.by_index(i).unwrap();
        // The archive also carries a bare `logisheets/` directory entry; match
        // the part itself, not its folder.
        if f.name() != "logisheets/data.xml" {
            continue;
        }
        let mut s = String::new();
        f.read_to_string(&mut s).expect("utf-8 data part");
        assert!(
            s.contains("<logisheets>"),
            "the data part should not be empty — an empty string would make \
             every comparison against it vacuously true"
        );
        return s;
    }
    panic!("no logisheets data part in the saved file");
}

/// Split on `<` so sibling elements can be compared as a set — see the caller.
fn sorted_elements(xml: &str) -> Vec<&str> {
    let mut parts: Vec<&str> = xml.split('<').collect();
    parts.sort();
    parts
}

/// Schemas must not survive by accident: their rules are the part with no
/// visible fallback, so a reload that quietly drops a validation template looks
/// exactly like a file that never had one. Recompute after reload and check the
/// derived column moves.
#[test]
fn a_reloaded_value_rule_still_recomputes() {
    let wb = round_trip(&authored(), "recompute.xlsx");
    let mut wb = wb;
    ok(
        &mut wb,
        vec![EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 0,
            col: 1,
            content: "5".into(),
        })],
    );
    let got = num(&wb, 0, 0, 3);
    assert!(
        (got - 17.5).abs() < 1e-9,
        "after a reload, editing qty must drive total (5*3.5=17.5), got {got}"
    );
}

// ---------------------------------------------------------------------------
// The two losses this file was written to find
// ---------------------------------------------------------------------------

/// A craft appendix must be addressed by where it sits IN ITS BLOCK, not by a
/// sheet coordinate.
///
/// `AppendixManager` keys on a `BlockCellId`, whose row/col are ids rather than
/// positions, so nothing about the in-memory record moves when the sheet does.
/// The file has to preserve that: rows inserted above a block shift every cell
/// in it, and a saved sheet coordinate would come back pointing at whatever now
/// occupies the old address.
#[test]
fn an_appendix_follows_its_block_cell_when_the_block_moves() {
    let mut wb = Workbook::default();
    let bid = wb.get_available_block_id(0).unwrap();
    ok(
        &mut wb,
        vec![
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
            EditPayload::CreateAppendix(CreateAppendix {
                sheet_id: None,
                sheet_idx: Some(0),
                block_id: bid,
                row_idx: 1,
                col_idx: 1,
                craft_id: "mover".into(),
                tag: 3,
                content: "pinned".into(),
            }),
            // Push the whole block down three rows. The annotated cell is now
            // at sheet row 4, but at block row 1 as it always was.
            EditPayload::InsertRows(InsertRows {
                sheet_idx: 0,
                start: 0,
                count: 3,
            }),
        ],
    );

    let reloaded = round_trip(&wb, "moved-appendix.xlsx");
    let ws = reloaded.get_sheet_by_idx(0).unwrap();
    assert_eq!(
        ws.get_block_info(bid).unwrap().row_start,
        3,
        "the block should have moved down"
    );
    let at_block_cell = ws.get_reproducible_cell(4, 1).unwrap().appendix;
    assert_eq!(
        at_block_cell.len(),
        1,
        "the appendix must come back on the block cell it was attached to"
    );
    assert_eq!(at_block_cell[0].content, "pinned");
    assert!(
        ws.get_reproducible_cell(1, 1).unwrap().appendix.is_empty(),
        "and not at the sheet coordinate the cell used to have"
    );
}

/// Per-line metadata on a partially annotated block must come back on its own
/// line.
///
/// The writer emits only the annotated lines, so a `<colInfos>` list is not a
/// dense image of the block's axis and its entries cannot be placed by their
/// position in the list. Before `line` was written, metadata set on column 2
/// alone came back attached to column 0 — silently, since one annotation went
/// in and one annotation came out.
///
/// There is no public reader tying a line's metadata back to its column, so the
/// assertion is made on the emitted part: re-saving the RELOADED workbook is
/// what proves the loader put it back where it belonged, because a misplaced
/// entry would be re-emitted under the column it was misplaced onto.
#[test]
fn sparse_block_line_info_returns_to_its_own_line() {
    let mut wb = Workbook::default();
    let bid = wb.get_available_block_id(0).unwrap();
    ok(
        &mut wb,
        vec![
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 0,
                id: bid,
                master_row: 0,
                master_col: 0,
                row_cnt: 3,
                col_cnt: 3,
                owner: None,
                modify_policy: None,
                permissions: None,
                description: None,
            }),
            // Only the LAST column, and only the LAST row.
            EditPayload::BlockLineNameFieldUpdate(BlockLineNameFieldUpdate {
                sheet_idx: 0,
                block_id: bid,
                line: 2,
                row: false,
                name: Some("only-col".into()),
                field_id: "field-col-2".into(),
                diy_render: Some(true),
            }),
            EditPayload::BlockLineNameFieldUpdate(BlockLineNameFieldUpdate {
                sheet_idx: 0,
                block_id: bid,
                line: 2,
                row: true,
                name: Some("only-row".into()),
                field_id: "field-row-2".into(),
                diy_render: Some(false),
            }),
        ],
    );

    let first = data_xml(&wb.save().unwrap());
    assert!(
        first.contains(r#"<colInfos line="2" name="only-col" fieldId="field-col-2""#),
        "the annotated column must be written with its own position: {first}"
    );
    assert!(
        first.contains(r#"<rowInfos line="2" name="only-row" fieldId="field-row-2""#),
        "and so must the annotated row: {first}"
    );
    assert_eq!(
        (
            first.matches("<colInfos").count(),
            first.matches("<rowInfos").count()
        ),
        (1, 1),
        "only the annotated lines are written"
    );

    // Round trip, then save again: the loader has to have put both back on line
    // 2, or this second part names line 0.
    let again = data_xml(&round_trip(&wb, "sparse.xlsx").save().unwrap());
    assert_eq!(
        sorted_elements(&first),
        sorted_elements(&again),
        "a sparsely annotated block is not a fixed point — the line info moved"
    );

    let mut fields: Vec<String> = round_trip(&wb, "sparse.xlsx")
        .get_all_block_fields()
        .unwrap()
        .into_iter()
        .map(|f| f.field_id)
        .collect();
    fields.sort();
    assert_eq!(fields, vec!["field-col-2", "field-row-2"]);
}

/// The description and the per-operation policies are also settable *after* the
/// block exists, and what those payloads write has to survive a file the same
/// way the create-time values do.
#[test]
fn set_description_and_permissions_survive_a_trip() {
    use logisheets_controller::edit_action::{SetBlockDescription, SetBlockPermissions};

    const B: usize = 1;
    let mut wb = Workbook::default();
    ok(
        &mut wb,
        vec![EditPayload::CreateBlock(CreateBlock {
            sheet_idx: 0,
            id: B,
            master_row: 0,
            master_col: 0,
            row_cnt: 2,
            col_cnt: 2,
            owner: Some("watson".into()),
            modify_policy: None,
            permissions: None,
            description: None,
        })],
    );
    // Created bare, so this is also a check that "no metadata" is a real state
    // and not a hole that reads as something else.
    {
        let m = wb.get_block_modify_info(0, B).unwrap();
        assert_eq!(m.description, "");
        assert!(m.permissions.is_empty(), "nothing stated yet");
        assert!(matches!(m.modify_policy, ModifyPolicy::All));
    }

    ok(
        &mut wb,
        vec![
            EditPayload::SetBlockDescription(SetBlockDescription {
                sheet_idx: 0,
                block_id: B,
                description: "Watson's scratch table — do not resize.".into(),
            }),
            EditPayload::SetBlockPermissions(SetBlockPermissions {
                sheet_idx: 0,
                block_id: B,
                permissions: BlockPermissions {
                    insert_delete_lines: Some(ModifyPolicy::OwnerOnly),
                    remove_block: Some(ModifyPolicy::OwnerOnly),
                    modify_schema: None,
                    cell_input: None,
                    sort_by_field: Some(ModifyPolicy::OwnerAndUser),
                    modify_description: Some(ModifyPolicy::OwnerOnly),
                },
                // Raising the default at the same time, which is the other
                // half of that payload.
                modify_policy: Some(ModifyPolicy::OwnerAndUser),
            }),
        ],
    );

    let assert_state = |wb: &Workbook, stage: &str| {
        let m = wb.get_block_modify_info(0, B).unwrap();
        assert_eq!(
            m.description, "Watson's scratch table — do not resize.",
            "[{stage}] description"
        );
        assert_eq!(m.owner, "watson", "[{stage}] owner");
        assert!(
            matches!(m.modify_policy, ModifyPolicy::OwnerAndUser),
            "[{stage}] default policy was raised"
        );
        assert_eq!(
            m.permissions.explicit(BlockOp::InsertDeleteLines),
            Some(ModifyPolicy::OwnerOnly),
            "[{stage}] insertDeleteLines"
        );
        assert_eq!(
            m.permissions.explicit(BlockOp::RemoveBlock),
            Some(ModifyPolicy::OwnerOnly),
            "[{stage}] removeBlock"
        );
        assert_eq!(
            m.permissions.explicit(BlockOp::ModifySchema),
            None,
            "[{stage}] modifySchema left unstated"
        );
        assert_eq!(
            m.permissions.explicit(BlockOp::SortByField),
            Some(ModifyPolicy::OwnerAndUser),
            "[{stage}] sortByField"
        );
        // The user may not take rows out of Watson's table, but may still sort
        // and type in it — the whole point of splitting the policy up.
        let user = BlockActor::User;
        assert!(
            !wb.may_modify_block(0, B, BlockOp::InsertDeleteLines, &user)
                .unwrap()
        );
        assert!(
            wb.may_modify_block(0, B, BlockOp::SortByField, &user)
                .unwrap()
        );
        assert!(
            wb.may_modify_block(0, B, BlockOp::CellInput, &user)
                .unwrap()
        );
        assert!(
            !wb.may_modify_block(0, B, BlockOp::RemoveBlock, &user)
                .unwrap()
        );
        assert!(
            !wb.may_modify_block(0, B, BlockOp::ModifyDescription, &user)
                .unwrap()
        );
    };

    assert_state(&wb, "authored");
    let once = round_trip(&wb, "set-metadata");
    assert_state(&once, "one trip");
    let twice = round_trip(&once, "set-metadata again");
    assert_state(&twice, "two trips");
}

/// A block that says nothing about itself must not start writing attributes,
/// so files from before this existed keep round-tripping unchanged and a diff
/// of a saved workbook does not fill up with defaults.
#[test]
fn a_block_with_no_metadata_writes_no_attributes() {
    const B: usize = 1;
    let mut wb = Workbook::default();
    ok(
        &mut wb,
        vec![EditPayload::CreateBlock(CreateBlock {
            sheet_idx: 0,
            id: B,
            master_row: 0,
            master_col: 0,
            row_cnt: 2,
            col_cnt: 2,
            owner: None,
            modify_policy: None,
            permissions: None,
            description: None,
        })],
    );
    let xml = data_xml(&wb.save().unwrap());
    for attr in [
        "description",
        "permInsertDeleteLines",
        "permRemoveBlock",
        "permModifySchema",
        "permCellInput",
        "permSortByField",
        "permModifyDescription",
    ] {
        assert!(!xml.contains(attr), "a bare block wrote {attr}:\n{xml}");
    }
}
