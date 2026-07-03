//! Integration tests for engine-managed validation / editability
//! formula templates. These exercise the Phase 1 + Phase 2 plumbing:
//!
//!   * BindFormSchema accepts validation_formulas / editability_formulas
//!     and the engine auto-installs the corresponding shadow cells on
//!     every existing row.
//!   * InsertRowsInBlock auto-installs shadows on the freshly-grown
//!     rows.
//!   * UpsertFieldFormulas treats empty incoming vecs as "preserve
//!     existing", non-empty as "replace all", and a vec of all-None as
//!     "explicit clear".
//!   * #PLACEHOLDER / #FIELD / #KEY substitutions work inside the rule
//!     templates.
//!
//! Shadow values are read via `Workbook::get_shadow_cell_id` +
//! `get_shadow_info_by_id` — the same path the host UI uses.

use logisheets::Value;
use logisheets::Workbook;
use logisheets_base::CellId;
use logisheets_controller::edit_action::{
    BindFormSchema, BlockInput, CreateBlock, EditPayload, InsertRowsInBlock, PayloadsAction,
    StatusCode, UpsertFieldFormulas,
};
use logisheets_controller::sid_assigner::ShadowKind;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn ok(wb: &mut Workbook, payloads: Vec<EditPayload>) {
    let result = wb.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
        payloads,
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(result.status, StatusCode::Ok(_)),
        "transaction should succeed; got status: {:?}",
        result.status
    );
}

/// Read a shadow's computed value at sheet-absolute (row, col).
fn shadow_value(
    wb: &mut Workbook,
    sheet_idx: usize,
    row: usize,
    col: usize,
    kind: ShadowKind,
) -> Value {
    let scid = wb
        .get_shadow_cell_id(sheet_idx, row, col, kind)
        .unwrap_or_else(|e| panic!("get_shadow_cell_id failed: {:?}", e));
    let eid = match scid.cell_id {
        CellId::EphemeralCell(e) => e,
        other => panic!("expected EphemeralCell, got {:?}", other),
    };
    wb.get_shadow_info_by_id(eid)
        .unwrap_or_else(|e| panic!("get_shadow_info_by_id failed: {:?}", e))
        .value
}

/// Build a single 3-row × 2-col block with a fresh schema. The block's
/// first column is the key; the second column is the value field whose
/// rules we exercise.
///
/// Returns the workbook with: block id 1 at (0,0)–(2,1), key cells at
/// rows 0..3 col 0 already filled with "k0"/"k1"/"k2", value cells at
/// rows 0..3 col 1 filled with the literal numbers 5 / 10 / 15.
fn fresh_block_with_data(
    validation_formulas: Vec<Option<String>>,
    editability_formulas: Vec<Option<String>>,
) -> Workbook {
    let mut wb = Workbook::default();
    ok(
        &mut wb,
        vec![
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 0,
                id: 1,
                master_row: 0,
                master_col: 0,
                row_cnt: 3,
                col_cnt: 2,
                owner: None,
                modify_policy: None,
            }),
            // Keys first (matches the factory-simulator pattern — see
            // `BindFormSchema` arm's comment in
            // formula_manager/executors/mod.rs).
            EditPayload::BlockInput(BlockInput {
                sheet_idx: 0,
                block_id: 1,
                row: 0,
                col: 0,
                input: "k0".into(),
            }),
            EditPayload::BlockInput(BlockInput {
                sheet_idx: 0,
                block_id: 1,
                row: 1,
                col: 0,
                input: "k1".into(),
            }),
            EditPayload::BlockInput(BlockInput {
                sheet_idx: 0,
                block_id: 1,
                row: 2,
                col: 0,
                input: "k2".into(),
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                sheet_idx: 0,
                block_id: 1,
                ref_name: "T".into(),
                field_from: 0,
                key_idx: 0,
                fields: vec!["key".into(), "value".into()],
                render_ids: vec!["r0".into(), "r1".into()],
                field_formulas: vec![None, None],
                validation_formulas,
                editability_formulas,
                row: true,
            }),
            // Value cells last — so #PLACEHOLDER references the cell
            // that already exists with these literals.
            EditPayload::BlockInput(BlockInput {
                sheet_idx: 0,
                block_id: 1,
                row: 0,
                col: 1,
                input: "5".into(),
            }),
            EditPayload::BlockInput(BlockInput {
                sheet_idx: 0,
                block_id: 1,
                row: 1,
                col: 1,
                input: "10".into(),
            }),
            EditPayload::BlockInput(BlockInput {
                sheet_idx: 0,
                block_id: 1,
                row: 2,
                col: 1,
                input: "15".into(),
            }),
        ],
    );
    wb
}

// ---------------------------------------------------------------------------
// Phase 1 — schema accepts the rule vecs
// ---------------------------------------------------------------------------

/// BindFormSchema with `#PLACEHOLDER`-based validation:
/// "value >= 10". The engine should install a Validation shadow on
/// every (row, value-col) and the post-calc shadow value should be
/// false / true / true for rows 0..3.
#[test]
fn test_validation_shadow_installed_at_bind_time() {
    let mut wb = fresh_block_with_data(
        vec![None, Some("#PLACEHOLDER>=10".into())],
        vec![None, None],
    );

    // Row 0 (value=5) → FALSE
    let v0 = shadow_value(&mut wb, 0, 0, 1, ShadowKind::Validation);
    assert!(
        matches!(v0, Value::Bool(false)),
        "row 0 should fail validation, got {:?}",
        v0
    );
    // Row 1 (value=10) → TRUE
    let v1 = shadow_value(&mut wb, 0, 1, 1, ShadowKind::Validation);
    assert!(
        matches!(v1, Value::Bool(true)),
        "row 1 should pass, got {:?}",
        v1
    );
    // Row 2 (value=15) → TRUE
    let v2 = shadow_value(&mut wb, 0, 2, 1, ShadowKind::Validation);
    assert!(
        matches!(v2, Value::Bool(true)),
        "row 2 should pass, got {:?}",
        v2
    );
}

/// Editability mirror: same plumbing, different ShadowKind. The
/// permission patch on the host reads UserEditable shadows to gate
/// writes; we just verify the value computes here.
#[test]
fn test_editability_shadow_installed_at_bind_time() {
    let mut wb = fresh_block_with_data(
        vec![None, None],
        vec![None, Some("#PLACEHOLDER<>15".into())],
    );

    let v0 = shadow_value(&mut wb, 0, 0, 1, ShadowKind::UserEditable);
    assert!(
        matches!(v0, Value::Bool(true)),
        "row 0 editable, got {:?}",
        v0
    );
    let v2 = shadow_value(&mut wb, 0, 2, 1, ShadowKind::UserEditable);
    assert!(
        matches!(v2, Value::Bool(false)),
        "row 2 not editable, got {:?}",
        v2
    );
}

/// `#FIELD("key")` should resolve to the row's key column. We build a
/// validation rule that checks the key equals "k1" — row 1 passes,
/// others fail.
#[test]
fn test_field_substitution_in_validation() {
    let mut wb = fresh_block_with_data(
        vec![None, Some(r#"#FIELD("key")="k1""#.into())],
        vec![None, None],
    );

    let v0 = shadow_value(&mut wb, 0, 0, 1, ShadowKind::Validation);
    assert!(
        matches!(v0, Value::Bool(false)),
        "row 0 (k0) should fail, got {:?}",
        v0
    );
    let v1 = shadow_value(&mut wb, 0, 1, 1, ShadowKind::Validation);
    assert!(
        matches!(v1, Value::Bool(true)),
        "row 1 (k1) should pass, got {:?}",
        v1
    );
}

/// `#KEY` resolves to the row's key value (the cell at col 0). Verifies
/// the bare-keyword path, distinct from `#FIELD("key")`.
#[test]
fn test_key_substitution_in_validation() {
    let mut wb = fresh_block_with_data(vec![None, Some(r#"#KEY="k2""#.into())], vec![None, None]);

    let v0 = shadow_value(&mut wb, 0, 0, 1, ShadowKind::Validation);
    assert!(matches!(v0, Value::Bool(false)));
    let v2 = shadow_value(&mut wb, 0, 2, 1, ShadowKind::Validation);
    assert!(matches!(v2, Value::Bool(true)));
}

// ---------------------------------------------------------------------------
// Phase 2 — engine auto-installs on InsertRowsInBlock
// ---------------------------------------------------------------------------

/// After InsertRowsInBlock, the freshly-grown row should have its
/// validation shadow auto-installed by the engine. The shadow's value
/// should reflect the post-insert cell value once the player writes
/// something into the new row.
/// Regression test for a pre-existing sequencer-mode bug:
/// `BlockInput` on a row freshly created by `InsertRowsInBlock`
/// silently wrote to `BlockCell(3, 1)` while the next `get_value(3,1)`
/// read `NormalCell(3, 1)` — a different cell in the container's
/// `imbl::HashMap`. Root cause:
///   * `Locked<Cache>` becomes `Arc<RwLock<Cache>>` under the
///     `sequencer` feature, so cloning `SheetNav` shares the same
///     cache across the live nav and `old_navigator` (the formula
///     executor's idx-nav).
///   * `add_block_place` (InsertRowsInBlock's nav-side handler) used
///     to clean the cache *in place* (`cache.clean_cell()`). A
///     Fetcher operating against the OLD `SheetNav` (whose
///     `data.blocks` was still pre-insert) could then write
///     `(3, 1) → NormalCell` into that same shared cache. Subsequent
///     reads via the NEW SheetNav saw the stale mapping.
/// Fix: `sn.cache = Default::default()` — give the new SheetNav an
/// independent `Locked<Cache>`, so old-Fetcher writes don't leak.
#[test]
fn probe_insert_rows_then_blockinput_writes_value() {
    let mut wb = fresh_block_with_data(vec![None, None], vec![None, None]);
    ok(
        &mut wb,
        vec![EditPayload::InsertRowsInBlock(InsertRowsInBlock {
            sheet_idx: 0,
            block_id: 1,
            start: 3,
            cnt: 1,
        })],
    );
    ok(
        &mut wb,
        vec![EditPayload::BlockInput(BlockInput {
            sheet_idx: 0,
            block_id: 1,
            row: 3,
            col: 1,
            input: "42".into(),
        })],
    );
    let ws = wb.get_sheet_by_idx(0).unwrap();
    let val = ws.get_value(3, 1).unwrap();
    assert!(
        matches!(val, Value::Number(n) if (n - 42.0).abs() < 1e-9),
        "BlockInput should write to fresh row, got {:?}",
        val
    );
}

/// After InsertRowsInBlock, the freshly-grown row should have its
/// validation shadow auto-installed by the engine. The shadow's value
/// should reflect the post-insert cell value once the player writes
/// something into the new row.
#[test]
fn test_insert_rows_auto_installs_validation_shadow() {
    let mut wb = fresh_block_with_data(
        vec![None, Some("#PLACEHOLDER>=10".into())],
        vec![None, None],
    );

    // Two-step: grow first, then write. Bundling them in one tx
    // matches the factory-simulator pattern but exposes the issue
    // we're testing differently — split them so each step's effect on
    // the calc engine is observable in isolation.
    ok(
        &mut wb,
        vec![EditPayload::InsertRowsInBlock(InsertRowsInBlock {
            sheet_idx: 0,
            block_id: 1,
            start: 3,
            cnt: 1,
        })],
    );

    ok(
        &mut wb,
        vec![
            EditPayload::BlockInput(BlockInput {
                sheet_idx: 0,
                block_id: 1,
                row: 3,
                col: 0,
                input: "k3".into(),
            }),
            EditPayload::BlockInput(BlockInput {
                sheet_idx: 0,
                block_id: 1,
                row: 3,
                col: 1,
                input: "3".into(),
            }),
        ],
    );

    // value=3 < 10 → Bool(false)
    let v3 = shadow_value(&mut wb, 0, 3, 1, ShadowKind::Validation);
    assert!(
        matches!(v3, Value::Bool(false)),
        "new row should fail validation, got {:?}",
        v3
    );
}

// ---------------------------------------------------------------------------
// Phase 2 — UpsertFieldFormulas semantics
// ---------------------------------------------------------------------------

/// `validation_formulas: vec![]` means "preserve existing". Sending an
/// upsert that only changes value_formulas must not clobber the
/// already-installed validation shadows.
#[test]
fn test_upsert_empty_vec_preserves_existing_rules() {
    let mut wb = fresh_block_with_data(
        vec![None, Some("#PLACEHOLDER>=10".into())],
        vec![None, None],
    );

    // Sanity: row 0 currently fails.
    let before = shadow_value(&mut wb, 0, 0, 1, ShadowKind::Validation);
    assert!(matches!(before, Value::Bool(false)));

    // Upsert with empty vecs → don't touch any rule kind.
    ok(
        &mut wb,
        vec![EditPayload::UpsertFieldFormulas(UpsertFieldFormulas {
            sheet_idx: 0,
            block_id: 1,
            field_formulas: vec![],
            validation_formulas: vec![],
            editability_formulas: vec![],
        })],
    );

    let after = shadow_value(&mut wb, 0, 0, 1, ShadowKind::Validation);
    assert!(
        matches!(after, Value::Bool(false)),
        "validation should be preserved, got {:?}",
        after
    );
}

/// `validation_formulas: vec![Some(new_rule), ...]` replaces the
/// per-field templates, and the engine re-installs shadows on every
/// existing row with the new rule.
#[test]
fn test_upsert_replaces_rule_and_recomputes() {
    let mut wb = fresh_block_with_data(
        vec![None, Some("#PLACEHOLDER>=10".into())],
        vec![None, None],
    );

    // Before: row 0 (value=5) fails the >=10 rule.
    assert!(matches!(
        shadow_value(&mut wb, 0, 0, 1, ShadowKind::Validation),
        Value::Bool(false)
    ));

    // Loosen the rule to >=1, all rows should now pass.
    ok(
        &mut wb,
        vec![EditPayload::UpsertFieldFormulas(UpsertFieldFormulas {
            sheet_idx: 0,
            block_id: 1,
            field_formulas: vec![],
            validation_formulas: vec![None, Some("#PLACEHOLDER>=1".into())],
            editability_formulas: vec![],
        })],
    );

    for r in 0..3 {
        let v = shadow_value(&mut wb, 0, r, 1, ShadowKind::Validation);
        assert!(
            matches!(v, Value::Bool(true)),
            "row {} after loosen should pass, got {:?}",
            r,
            v
        );
    }
}

/// `validation_formulas: vec![None; field_count]` is the explicit clear
/// — every per-field rule is removed and the engine strips the formulas
/// off existing validation shadows. We verify the formula is gone by
/// dirtying the underlying value and confirming the shadow doesn't
/// recompute (it still holds the cached value from before the clear).
/// Cached-value persistence after clear is intentional: shadow ids stay
/// allocated, just no longer computed. Host widgets that care about
/// "no rule" should check the schema, not the shadow's stale value.
#[test]
fn test_upsert_all_none_clears_shadows() {
    let mut wb = fresh_block_with_data(
        vec![None, Some("#PLACEHOLDER>=10".into())],
        vec![None, None],
    );

    // Row 0 (value=5) currently fails validation → Bool(false).
    let before = shadow_value(&mut wb, 0, 0, 1, ShadowKind::Validation);
    assert!(matches!(before, Value::Bool(false)));

    // Clear all validation rules.
    ok(
        &mut wb,
        vec![EditPayload::UpsertFieldFormulas(UpsertFieldFormulas {
            sheet_idx: 0,
            block_id: 1,
            field_formulas: vec![],
            validation_formulas: vec![None, None],
            editability_formulas: vec![],
        })],
    );

    // Now bump row 0's value to 50 (which WOULD pass the old rule). If
    // the formula were still wired up, the shadow would re-evaluate to
    // Bool(true). If it's been removed, the shadow stays at its cached
    // pre-clear value (Bool(false)).
    ok(
        &mut wb,
        vec![EditPayload::BlockInput(BlockInput {
            sheet_idx: 0,
            block_id: 1,
            row: 0,
            col: 1,
            input: "50".into(),
        })],
    );

    let after = shadow_value(&mut wb, 0, 0, 1, ShadowKind::Validation);
    assert!(
        matches!(after, Value::Bool(false)),
        "after clear the shadow should not recompute on data change, \
         got {:?} (would be Bool(true) if formula were still active)",
        after
    );
}

// ---------------------------------------------------------------------------
// Phase 1 — validation refs unknown field → error
// ---------------------------------------------------------------------------

/// A validation_formula that references a `#FIELD("nonexistent")` must
/// be rejected at bind time with InvalidFormula — same rule as
/// field_formulas.
#[test]
fn test_validation_field_ref_unknown_field_errors() {
    let mut wb = Workbook::default();
    let result = wb.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 0,
                id: 1,
                master_row: 0,
                master_col: 0,
                row_cnt: 1,
                col_cnt: 2,
                owner: None,
                modify_policy: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                sheet_idx: 0,
                block_id: 1,
                ref_name: "T".into(),
                field_from: 0,
                key_idx: 0,
                fields: vec!["key".into(), "value".into()],
                render_ids: vec!["r0".into(), "r1".into()],
                field_formulas: vec![],
                validation_formulas: vec![
                    None,
                    // typo: "nope" isn't a field
                    Some(r#"#FIELD("nope")>0"#.into()),
                ],
                editability_formulas: vec![],
                row: true,
            }),
        ],
        undoable: true,
        init: false,
    }));
    assert!(
        !matches!(result.status, StatusCode::Ok(_)),
        "BindFormSchema referencing unknown field should fail, got status: {:?}",
        result.status
    );
}
