use logisheets::Workbook;
use logisheets_controller::edit_action::{
    BindFormSchema, BlockInput, CellInput, CreateBlock, CreateSheet, DeleteRows,
    DeleteRowsInBlock, DeleteSheet, EditPayload, InsertCols, InsertRows, InsertRowsInBlock,
    MoveBlock, PayloadsAction, StatusCode,
};

use crate::load_script;

use super::test_script;

mod rules;

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
            field_formulas: vec![],
            validation_formulas: vec![],
            editability_formulas: vec![],
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
                owner: None,
                modify_policy: None,
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                sheet_idx: 0,
                block_id: 1,
                ref_name: "".to_string(),
                field_from: 0,
                key_idx: 0,
                fields: vec!["abcd".to_string(), "111a".to_string()],
                render_ids: vec!["r0".to_string(), "r1".to_string()],
                field_formulas: vec![],
                validation_formulas: vec![],
                editability_formulas: vec![],
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

/// Reproduction for the factory-simulator "round 3+ wipe is a silent no-op"
/// bug. Each simulated round:
///   1. wipe: deleteRowsInBlock(1, N-1) + deleteRows(rowStart+1, N-1) so the
///      block shrinks back to its initial 1 row.
///   2. fill: for each of 3 generated orders, either reuse the template row
///      (first order, row 0 is empty) or insertRows + insertRowsInBlock to
///      append a new row, then blockInput a couple of cells.
///
/// Observation from the live craft (browser console diagnostics):
///   click 2 wipes rowCnt 3 -> 1 successfully;
///   click 3 sends the same payload sequence but rowCnt stays at 3;
///   handle_action returns Ok, no error surfaced.
///
/// This test asserts get_block_info().row_cnt collapses to 1 after every
/// wipe — if the bug exists, the assertion on round 3 (or later) fails.
#[test]
fn test_factory_simulator_round_wipe_loop() {
    const COL_CNT: usize = 5;
    const ORDERS_PER_ROUND: usize = 3;
    const BLOCK_ID: usize = 1;
    const SHEET_IDX: usize = 0;

    let mut wb = Workbook::default();

    // Initial: create a 1x5 block at row 0.
    let init = wb.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CreateBlock(CreateBlock {
            sheet_idx: SHEET_IDX,
            id: BLOCK_ID,
            master_row: 0,
            master_col: 0,
            row_cnt: 1,
            col_cnt: COL_CNT,
            owner: None,
            modify_policy: None,
        })],
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(init.status, StatusCode::Ok(_)),
        "create block failed: {:?}",
        init.status
    );

    fn read_block_dims(wb: &mut Workbook) -> (usize, usize) {
        let ws = wb.get_sheet_by_idx(SHEET_IDX).unwrap();
        let info = ws.get_block_info(BLOCK_ID).expect("get_block_info");
        (info.row_start, info.row_cnt)
    }

    fn wipe(wb: &mut Workbook) {
        let (row_start, row_cnt) = read_block_dims(wb);
        if row_cnt <= 1 {
            return;
        }
        let remove_cnt = row_cnt - 1;
        // Same payload sequence factory-simulator's wipeBlockRows sends.
        let mut payloads: Vec<EditPayload> = vec![
            EditPayload::DeleteRowsInBlock(DeleteRowsInBlock {
                sheet_idx: SHEET_IDX,
                block_id: BLOCK_ID,
                start: 1,
                cnt: remove_cnt,
            }),
            EditPayload::DeleteRows(DeleteRows {
                sheet_idx: SHEET_IDX,
                start: row_start + 1,
                count: remove_cnt,
            }),
        ];
        for c in 0..COL_CNT {
            payloads.push(EditPayload::BlockInput(BlockInput {
                sheet_idx: SHEET_IDX,
                block_id: BLOCK_ID,
                row: 0,
                col: c,
                input: String::new(),
            }));
        }
        let r = wb.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
            payloads,
            undoable: true,
            init: false,
        }));
        assert!(
            matches!(r.status, StatusCode::Ok(_)),
            "wipe tx failed: {:?}",
            r.status
        );
    }

    fn fill_one_round(wb: &mut Workbook, round: usize) {
        for i in 0..ORDERS_PER_ROUND {
            let (row_start, row_cnt) = read_block_dims(wb);
            // Matches the TS `row0Empty` heuristic: first order of a round
            // lands on row 0 if the block is still at its single-row template
            // state (either freshly created or freshly wiped).
            let _ = round;
            let row0_empty = row_cnt == 1 && i == 0;
            let target_row = if row0_empty { 0 } else { row_cnt };
            let mut payloads: Vec<EditPayload> = vec![];
            if !row0_empty {
                payloads.push(EditPayload::InsertRows(InsertRows {
                    sheet_idx: SHEET_IDX,
                    start: row_start + row_cnt,
                    count: 1,
                }));
                payloads.push(EditPayload::InsertRowsInBlock(InsertRowsInBlock {
                    sheet_idx: SHEET_IDX,
                    block_id: BLOCK_ID,
                    start: row_cnt,
                    cnt: 1,
                }));
            }
            for c in 0..COL_CNT {
                payloads.push(EditPayload::BlockInput(BlockInput {
                    sheet_idx: SHEET_IDX,
                    block_id: BLOCK_ID,
                    row: target_row,
                    col: c,
                    input: format!("r{}o{}c{}", round, i, c),
                }));
            }
            let r = wb.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
                payloads,
                undoable: true,
                init: false,
            }));
            assert!(
                matches!(r.status, StatusCode::Ok(_)),
                "insertOrder tx failed (round {} order {}): {:?}",
                round,
                i,
                r.status
            );
        }
    }

    // Round 1: just fill (mimics "new game + first advanceRound without a
    // prior wipe").
    fill_one_round(&mut wb, 1);
    let (_, after_round1) = read_block_dims(&mut wb);
    assert_eq!(
        after_round1, ORDERS_PER_ROUND,
        "round 1 should produce rowCnt={}, got {}",
        ORDERS_PER_ROUND, after_round1
    );

    // Rounds 2..=5: tick (temp-mode blockInput on row 0 then commit) +
    // wipe + fill. The tick simulates the factory simulator's round
    // counter increment that runs through the temp branch between
    // wipes — this is the only thing the bare-engine reproduction was
    // missing that distinguishes it from the live flow.
    let mut tick_value: i64 = 0;
    for round in 2..=5 {
        tick_value += 1;
        // temp-mode blockInput on (row 0, col 0) — same shape as the craft's
        // round-counter update on the constants table.
        let tick_effect = wb.handle_action_in_temp_status(PayloadsAction {
            payloads: vec![EditPayload::BlockInput(BlockInput {
                sheet_idx: SHEET_IDX,
                block_id: BLOCK_ID,
                row: 0,
                col: 0,
                input: tick_value.to_string(),
            })],
            undoable: true,
            init: false,
        });
        assert!(
            matches!(tick_effect.status, StatusCode::Ok(_)),
            "tick (temp) failed at round {}: {:?}",
            round,
            tick_effect.status
        );
        wb.commit_temp_status();

        wipe(&mut wb);
        let (_, after_wipe) = read_block_dims(&mut wb);
        assert_eq!(
            after_wipe, 1,
            "round {} wipe should leave rowCnt=1, got {} (this is the silent-noop bug)",
            round, after_wipe
        );
        fill_one_round(&mut wb, round);
        let (_, after_fill) = read_block_dims(&mut wb);
        assert_eq!(
            after_fill, ORDERS_PER_ROUND,
            "round {} fill should leave rowCnt={}, got {}",
            round, ORDERS_PER_ROUND, after_fill
        );
    }
}

/// Reproduction for the *new* (post-refactor) single-tx advanceRound flow.
/// Mirrors what `engine.ts::advanceRound` sends per round:
///   ONE non-temp transaction with payloads (in order):
///     - wipe orderStatus: deleteRowsInBlock(start=1, cnt=rowCnt-1) +
///       blockInput(row=0, col=0..colCnt) clearing the surviving row
///     - wipe orderContribution: same shape on the second block
///     - bump constants[round].value with a blockInput
///     - 3× insertOrder: order 0 reuses row 0 (no insertRowsInBlock);
///       orders 1..N each emit insertRowsInBlock(start=i, cnt=1) then
///       blockInput(row=i, col=0..colCnt) with the new content
///
/// This matches the live craft's "第三轮开始点不动" report: rounds 1-2
/// land cleanly, round 3 silently fails. If the engine handles the full
/// payload sequence correctly across rounds this test passes; if it
/// doesn't, the assertion in round 3 will fire.
#[test]
fn test_factory_simulator_single_tx_round() {
    const ORDER_STATUS_COL: usize = 7; // matches ORDER_STATUS_TABLE.fields.length
    const ORDER_CONTRIB_COL: usize = 7; // matches ORDER_CONTRIBUTION_TABLE.fields.length
    const ORDERS_PER_ROUND: usize = 3;
    const ORDER_STATUS_BLOCK: usize = 1;
    const ORDER_CONTRIB_BLOCK: usize = 2;
    const CONSTANTS_BLOCK: usize = 3;
    // Default workbook has 1 sheet; reuse it for both "main" and
    // "engine" blocks. The bug we're hunting doesn't depend on cross-
    // sheet payloads.
    const MAIN_SHEET: usize = 0;
    const ENGINE_SHEET: usize = 0;
    const ROUND_ROW_IDX: usize = 0;
    const ROUND_VALUE_COL: usize = 1;

    let mut wb = Workbook::default();

    // Setup: two sheets (main + engine), three blocks.
    let setup = wb.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: MAIN_SHEET,
                id: ORDER_STATUS_BLOCK,
                master_row: 0,
                master_col: 0,
                row_cnt: 1,
                col_cnt: ORDER_STATUS_COL,
                owner: None,
                modify_policy: None,
            }),
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: MAIN_SHEET,
                id: ORDER_CONTRIB_BLOCK,
                master_row: 20,
                master_col: 0,
                row_cnt: 1,
                col_cnt: ORDER_CONTRIB_COL,
                owner: None,
                modify_policy: None,
            }),
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: ENGINE_SHEET,
                id: CONSTANTS_BLOCK,
                master_row: 100,
                master_col: 10,
                row_cnt: 2,
                col_cnt: 2,
                owner: None,
                modify_policy: None,
            }),
            EditPayload::BlockInput(BlockInput {
                sheet_idx: ENGINE_SHEET,
                block_id: CONSTANTS_BLOCK,
                row: ROUND_ROW_IDX,
                col: ROUND_VALUE_COL,
                input: "1".to_string(),
            }),
        ],
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(setup.status, StatusCode::Ok(_)),
        "setup failed: {:?}",
        setup.status
    );

    fn read_row_cnt(wb: &mut Workbook, sheet_idx: usize, block_id: usize) -> usize {
        let ws = wb.get_sheet_by_idx(sheet_idx).unwrap();
        ws.get_block_info(block_id).expect("get_block_info").row_cnt
    }

    fn append_wipe(
        out: &mut Vec<EditPayload>,
        sheet_idx: usize,
        block_id: usize,
        row_cnt: usize,
        col_cnt: usize,
    ) {
        if row_cnt > 1 {
            out.push(EditPayload::DeleteRowsInBlock(DeleteRowsInBlock {
                sheet_idx,
                block_id,
                start: 1,
                cnt: row_cnt - 1,
            }));
        }
        for c in 0..col_cnt {
            out.push(EditPayload::BlockInput(BlockInput {
                sheet_idx,
                block_id,
                row: 0,
                col: c,
                input: String::new(),
            }));
        }
    }

    fn append_insert_order(
        out: &mut Vec<EditPayload>,
        sheet_idx: usize,
        block_id: usize,
        target_row: usize,
        col_cnt: usize,
        order_label: &str,
    ) {
        if target_row > 0 {
            out.push(EditPayload::InsertRowsInBlock(InsertRowsInBlock {
                sheet_idx,
                block_id,
                start: target_row,
                cnt: 1,
            }));
        }
        for c in 0..col_cnt {
            out.push(EditPayload::BlockInput(BlockInput {
                sheet_idx,
                block_id,
                row: target_row,
                col: c,
                input: format!("{}_c{}", order_label, c),
            }));
        }
    }

    let mut round = 1usize;
    for click in 1..=5 {
        let order_status_rowcnt = read_row_cnt(&mut wb, MAIN_SHEET, ORDER_STATUS_BLOCK);
        let order_contrib_rowcnt = read_row_cnt(&mut wb, MAIN_SHEET, ORDER_CONTRIB_BLOCK);
        let next_round = round + 1;

        let mut payloads: Vec<EditPayload> = vec![];

        // (1) wipes
        append_wipe(
            &mut payloads,
            MAIN_SHEET,
            ORDER_STATUS_BLOCK,
            order_status_rowcnt,
            ORDER_STATUS_COL,
        );
        append_wipe(
            &mut payloads,
            MAIN_SHEET,
            ORDER_CONTRIB_BLOCK,
            order_contrib_rowcnt,
            ORDER_CONTRIB_COL,
        );
        // (2) bump round counter
        payloads.push(EditPayload::BlockInput(BlockInput {
            sheet_idx: ENGINE_SHEET,
            block_id: CONSTANTS_BLOCK,
            row: ROUND_ROW_IDX,
            col: ROUND_VALUE_COL,
            input: next_round.to_string(),
        }));
        // (3) insert orders
        for i in 0..ORDERS_PER_ROUND {
            let label = format!("r{}o{}", next_round, i);
            append_insert_order(
                &mut payloads,
                MAIN_SHEET,
                ORDER_STATUS_BLOCK,
                i,
                ORDER_STATUS_COL,
                &label,
            );
        }

        let r = wb.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
            payloads,
            undoable: true,
            init: false,
        }));
        assert!(
            matches!(r.status, StatusCode::Ok(_)),
            "single-tx advanceRound click {} failed: {:?}",
            click,
            r.status
        );

        let after_rowcnt = read_row_cnt(&mut wb, MAIN_SHEET, ORDER_STATUS_BLOCK);
        assert_eq!(
            after_rowcnt, ORDERS_PER_ROUND,
            "click {} (advancing to round {}) should leave orderStatus rowCnt={}, got {}",
            click, next_round, ORDERS_PER_ROUND, after_rowcnt
        );

        round = next_round;
    }
}

/// Reproduce the live craft's "round counter stops bumping" symptom.
/// Live setup: TWO sheets, BOTH have a block with the same numeric id
/// (per-sheet block-id counters in the factory simulator). One tx does
///   - deleteRowsInBlock on main sheet's block_id=1 (orderStatus)
///   - blockInput on engine sheet's block_id=1 (constants[round].value)
/// Live craft observed: the blockInput silently stops landing after the
/// first round where deleteRowsInBlock fires.
#[test]
fn test_block_input_after_deleterows_cross_sheet_same_blockid() {
    const MAIN_SHEET: usize = 0; // default sheet
    const ENGINE_SHEET: usize = 1; // we'll create this
    const MAIN_BLOCK_ID: usize = 1;
    const ENGINE_BLOCK_ID: usize = 1; // intentionally same numeric id
    const COL_CNT: usize = 7;

    let mut wb = Workbook::default();

    // Setup: create the engine sheet, then two blocks (one per sheet,
    // both with block_id=1), seed engine block's (row 1, col 1) with "1".
    let setup = wb.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::CreateSheet(CreateSheet {
                idx: ENGINE_SHEET,
                new_name: "Engine".to_string(),
            }),
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: MAIN_SHEET,
                id: MAIN_BLOCK_ID,
                master_row: 0,
                master_col: 0,
                row_cnt: 1,
                col_cnt: COL_CNT,
                owner: None,
                modify_policy: None,
            }),
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: ENGINE_SHEET,
                id: ENGINE_BLOCK_ID,
                master_row: 0,
                master_col: 0,
                row_cnt: 2,
                col_cnt: 2,
                owner: None,
                modify_policy: None,
            }),
            EditPayload::BlockInput(BlockInput {
                sheet_idx: ENGINE_SHEET,
                block_id: ENGINE_BLOCK_ID,
                row: 1,
                col: 1,
                input: "1".to_string(),
            }),
        ],
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(setup.status, StatusCode::Ok(_)),
        "setup failed: {:?}",
        setup.status
    );

    fn read_engine_round(wb: &mut Workbook) -> String {
        use logisheets::Value;
        let ws = wb.get_sheet_by_idx(ENGINE_SHEET).unwrap();
        let info = ws.get_block_info(ENGINE_BLOCK_ID).expect("get_block_info");
        let cell = &info.cells[1 * info.col_cnt as usize + 1];
        match &cell.value {
            Value::Number(n) => n.to_string(),
            Value::Str(s) => s.clone(),
            Value::Bool(b) => b.to_string(),
            Value::Empty => "<empty>".to_string(),
            _ => "<other>".to_string(),
        }
    }

    // Grow the main block to rowCnt=3 first (same way the craft does it).
    let grow = wb.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::InsertRowsInBlock(InsertRowsInBlock {
                sheet_idx: MAIN_SHEET,
                block_id: MAIN_BLOCK_ID,
                start: 1,
                cnt: 1,
            }),
            EditPayload::InsertRowsInBlock(InsertRowsInBlock {
                sheet_idx: MAIN_SHEET,
                block_id: MAIN_BLOCK_ID,
                start: 2,
                cnt: 1,
            }),
        ],
        undoable: true,
        init: false,
    }));
    assert!(
        matches!(grow.status, StatusCode::Ok(_)),
        "grow failed: {:?}",
        grow.status
    );

    // Simulate the per-round tx 5× in a row: delete 2 rows + bump round +
    // re-grow back to 3 rows. Each round we write a new value into
    // engine[1][1]. Check that the engine block actually stores it.
    for round in 2..=6 {
        let tx = wb.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
            payloads: vec![
                // (1) wipe main block: deleteRowsInBlock(1, 2)
                EditPayload::DeleteRowsInBlock(DeleteRowsInBlock {
                    sheet_idx: MAIN_SHEET,
                    block_id: MAIN_BLOCK_ID,
                    start: 1,
                    cnt: 2,
                }),
                // (2) bump round on engine block
                EditPayload::BlockInput(BlockInput {
                    sheet_idx: ENGINE_SHEET,
                    block_id: ENGINE_BLOCK_ID,
                    row: 1,
                    col: 1,
                    input: round.to_string(),
                }),
                // (3) re-grow main block back to 3 rows so the next
                // round has rows to delete.
                EditPayload::InsertRowsInBlock(InsertRowsInBlock {
                    sheet_idx: MAIN_SHEET,
                    block_id: MAIN_BLOCK_ID,
                    start: 1,
                    cnt: 1,
                }),
                EditPayload::InsertRowsInBlock(InsertRowsInBlock {
                    sheet_idx: MAIN_SHEET,
                    block_id: MAIN_BLOCK_ID,
                    start: 2,
                    cnt: 1,
                }),
            ],
            undoable: true,
            init: false,
        }));
        assert!(
            matches!(tx.status, StatusCode::Ok(_)),
            "round {} tx failed: {:?}",
            round,
            tx.status
        );

        let stored = read_engine_round(&mut wb);
        assert_eq!(
            stored,
            round.to_string(),
            "round {} bump payload didn't land in engine block: engine[1][1] = {:?} (expected {:?})",
            round,
            stored,
            round.to_string(),
        );
    }
}

/// A formula stored in a cell INSIDE a block used to vanish when the file was
/// reloaded.
///
/// `load_normal_formula` matched only `CellId::NormalCell` and dropped anything
/// else. Blocks are registered before sheet data, so every in-block cell
/// resolves to a `BlockCell` — and its formula was discarded with no error. The
/// writer had emitted it correctly and the cached `<v>` still loaded, so the
/// workbook looked intact: right numbers, no formula, nothing recalculating ever
/// again. Reported via logisheets-mcp, where `get_cells` showed values but no
/// formulas for a model that had been saved and reopened.
///
/// Asserts the formula text comes back AND that it is live, which is the part
/// that actually matters — a retained string that never recalculates would be
/// the same bug wearing a disguise.
#[test]
fn test_block_cell_formula_survives_reload() {
    let mut workbook = Workbook::new();

    workbook.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 0,
                id: 1,
                master_row: 0,
                master_col: 0,
                row_cnt: 2,
                col_cnt: 3,
                owner: None,
                modify_policy: None,
            }),
            EditPayload::BlockInput(BlockInput {
                sheet_idx: 0,
                block_id: 1,
                row: 0,
                col: 0,
                input: "10".to_string(),
            }),
            EditPayload::BlockInput(BlockInput {
                sheet_idx: 0,
                block_id: 1,
                row: 0,
                col: 1,
                input: "20".to_string(),
            }),
            EditPayload::BlockInput(BlockInput {
                sheet_idx: 0,
                block_id: 1,
                row: 0,
                col: 2,
                input: "=A1+B1".to_string(),
            }),
        ],
        undoable: true,
        init: false,
    }));

    let ws = workbook.get_sheet_by_idx(0).unwrap();
    assert_eq!(ws.get_formula(0, 2).unwrap(), "A1 + B1", "pre-save formula");

    let mut bytes = workbook.save().expect("save");
    let mut reopened = Workbook::from_file(&mut bytes, "reload".to_string()).expect("reopen");

    let ws = reopened.get_sheet_by_idx(0).unwrap();
    assert_eq!(
        ws.get_formula(0, 2).unwrap(),
        "A1 + B1",
        "block cell lost its formula on reload"
    );

    // Live, not just remembered: change a precedent and the formula recomputes.
    reopened.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::BlockInput(BlockInput {
            sheet_idx: 0,
            block_id: 1,
            row: 0,
            col: 0,
            input: "100".to_string(),
        })],
        undoable: true,
        init: false,
    }));
    let v = reopened
        .get_sheet_by_idx(0)
        .unwrap()
        .get_value(0, 2)
        .unwrap();
    assert!(
        matches!(v, logisheets::Value::Number(n) if n == 120.0),
        "reloaded block formula did not recalculate: {:?}",
        v
    );
}

/// Out-of-range payload indices must be rejected, not panic.
///
/// Every case below killed the engine instance before: indices arrived straight
/// from the payload and reached imbl's `split_at` / `remove` / index operators,
/// or an `unwrap` on a lookup that legitimately fails. Under wasm a panic is not
/// a catchable error — it takes the session down — and an agent driving the
/// engine explores far more of this input space than a UI user does.
#[test]
fn test_out_of_range_payloads_are_rejected() {
    fn rejected(payload: EditPayload) -> bool {
        let mut workbook = Workbook::new();
        // A block to aim the block-scoped payloads at.
        workbook.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
            payloads: vec![EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 0,
                id: 1,
                master_row: 0,
                master_col: 0,
                row_cnt: 3,
                col_cnt: 3,
                owner: None,
                modify_policy: None,
            })],
            init: false,
            undoable: false,
        }));
        let effect = workbook.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
            payloads: vec![payload],
            init: false,
            undoable: false,
        }));
        matches!(effect.status, StatusCode::Err(_))
    }

    // A sheet may be inserted just past the last one, never beyond.
    assert!(rejected(EditPayload::CreateSheet(CreateSheet {
        idx: 3,
        new_name: "far".to_string(),
    })));
    assert!(rejected(EditPayload::DeleteSheet(DeleteSheet { idx: 9 })));

    // Line counts must fit the sheet; `count: u32::MAX` used to never return.
    assert!(rejected(EditPayload::InsertCols(InsertCols {
        sheet_idx: 0,
        start: 0,
        count: u32::MAX as usize,
    })));
    assert!(rejected(EditPayload::InsertRows(InsertRows {
        sheet_idx: 0,
        start: 0,
        count: u32::MAX as usize,
    })));

    // Block line ranges must fall inside the block.
    assert!(rejected(EditPayload::DeleteRowsInBlock(DeleteRowsInBlock {
        sheet_idx: 0,
        block_id: 1,
        start: 100,
        cnt: u32::MAX as usize,
    })));
    assert!(rejected(EditPayload::InsertRowsInBlock(InsertRowsInBlock {
        sheet_idx: 0,
        block_id: 1,
        start: 100,
        cnt: 1,
    })));

    // Moving a block that does not exist is a bad request, not a crash.
    assert!(rejected(EditPayload::MoveBlock(MoveBlock {
        sheet_idx: 0,
        id: 4096,
        new_master_row: 0,
        new_master_col: 0,
    })));
}

/// A block whose dimensions are large enough to overflow an allocation must be
/// rejected, not abort the process.
///
/// `create_block` is a first-class agent operation, and nothing bounded the
/// requested size: `row_cnt * col_cnt` cells were materialized eagerly, so
/// 1048576 x 16384 — each within the sheet's own limits — asked for ~17 billion
/// cells and panicked inside `RawVec` with a capacity overflow. Under wasm that
/// takes down the engine instance and the session with it.
#[test]
fn test_create_block_rejects_absurd_dimensions() {
    let mut workbook = Workbook::new();
    let effect = workbook.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::CreateBlock(CreateBlock {
            sheet_idx: 0,
            id: 1,
            master_row: 0,
            master_col: 0,
            row_cnt: 1048576,
            col_cnt: 16384,
            owner: None,
            modify_policy: None,
        })],
        init: false,
        undoable: false,
    }));
    assert!(
        matches!(effect.status, StatusCode::Err(_)),
        "expected a rejection, got {:?}",
        effect.status
    );
}

/// A formula OUTSIDE a block that reads into it via BLOCKREF / BLOCKREFS must
/// keep recomputing after the workbook has been saved and reopened.
///
/// It did not. The live input path registers a topo-barrier edge making every
/// formula cell inside a block a dep of `BlockAll(block)`; the file-load path
/// (`add_ast_node`) skipped it. So after a reload, recomputing a block cell
/// never walked out to `BlockAll`, and external readers kept their old values —
/// a wrong number with no error, and only after a round trip. Found by building
/// a DCF, saving it, and changing one assumption: the projection updated while
/// every summary line over it stayed stale, moving value-per-share by 15%.
#[test]
fn test_blockref_readers_recompute_after_reload() {
    let mut workbook = Workbook::new();

    // Block 1: `a` is an input, `b` is a formula over it.
    workbook.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
        payloads: vec![
            EditPayload::CreateBlock(CreateBlock {
                sheet_idx: 0,
                id: 1,
                master_row: 0,
                master_col: 0,
                row_cnt: 1,
                col_cnt: 3,
                owner: None,
                modify_policy: None,
            }),
            EditPayload::BlockInput(BlockInput {
                sheet_idx: 0,
                block_id: 1,
                row: 0,
                col: 0,
                input: "k1".to_string(),
            }),
            EditPayload::BlockInput(BlockInput {
                sheet_idx: 0,
                block_id: 1,
                row: 0,
                col: 1,
                input: "10".to_string(),
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "t".to_string(),
                sheet_idx: 0,
                block_id: 1,
                field_from: 0,
                key_idx: 0,
                fields: vec!["key".to_string(), "a".to_string(), "b".to_string()],
                render_ids: vec!["r0".to_string(), "r1".to_string(), "r2".to_string()],
                field_formulas: vec![None, None, Some("=#FIELD(\"a\")*2".to_string())],
                validation_formulas: vec![],
                editability_formulas: vec![],
                row: true,
            }),
            // Two readers outside the block: the single form and the aggregate.
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 5,
                col: 0,
                content: "=BLOCKREF(\"t\",\"k1\",\"b\")".to_string(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 5,
                col: 1,
                content: "=SUM(BLOCKREFS(\"t\",\"*\",\"b\"))".to_string(),
            }),
        ],
        undoable: true,
        init: false,
    }));

    let num = |wb: &mut Workbook, r: usize, c: usize| -> f64 {
        let v = wb.get_sheet_by_idx(0).unwrap().get_value(r, c).unwrap();
        match v {
            logisheets::Value::Number(n) => n,
            other => panic!("expected a number at ({r},{c}), got {other:?}"),
        }
    };
    assert_eq!(num(&mut workbook, 0, 2), 20.0, "b = a*2");
    assert_eq!(num(&mut workbook, 5, 0), 20.0, "BLOCKREF");
    assert_eq!(num(&mut workbook, 5, 1), 20.0, "BLOCKREFS");

    let mut bytes = workbook.save().expect("save");
    let mut reopened = Workbook::from_file(&mut bytes, "reload".to_string()).expect("reopen");

    // Change the input the block's own formula depends on.
    reopened.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::BlockInput(BlockInput {
            sheet_idx: 0,
            block_id: 1,
            row: 0,
            col: 1,
            input: "50".to_string(),
        })],
        undoable: true,
        init: false,
    }));

    assert_eq!(
        num(&mut reopened, 0, 2),
        100.0,
        "the block's own formula recomputed"
    );
    assert_eq!(
        num(&mut reopened, 5, 0),
        100.0,
        "BLOCKREF reader went stale after reload"
    );
    assert_eq!(
        num(&mut reopened, 5, 1),
        100.0,
        "BLOCKREFS reader went stale after reload"
    );
}

/// `FormulaFormat::Coordinates` must turn BLOCKREF / BLOCKREFS into ordinary A1
/// references, because no other spreadsheet knows those functions — a file Excel
/// recalculates would otherwise fill with `#NAME?`. The default keeps the named
/// form, which is the readable one and the one that survives rows moving.
#[test]
fn test_save_can_resolve_block_refs_to_coordinates() {
    let mut workbook = Workbook::new();
    workbook.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
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
            EditPayload::BlockInput(BlockInput {
                sheet_idx: 0,
                block_id: 1,
                row: 0,
                col: 0,
                input: "r1".to_string(),
            }),
            EditPayload::BlockInput(BlockInput {
                sheet_idx: 0,
                block_id: 1,
                row: 0,
                col: 1,
                input: "10".to_string(),
            }),
            EditPayload::BlockInput(BlockInput {
                sheet_idx: 0,
                block_id: 1,
                row: 1,
                col: 0,
                input: "r2".to_string(),
            }),
            EditPayload::BlockInput(BlockInput {
                sheet_idx: 0,
                block_id: 1,
                row: 1,
                col: 1,
                input: "20".to_string(),
            }),
            EditPayload::BindFormSchema(BindFormSchema {
                ref_name: "t".to_string(),
                sheet_idx: 0,
                block_id: 1,
                field_from: 0,
                key_idx: 0,
                fields: vec!["key".to_string(), "v".to_string()],
                render_ids: vec!["r0".to_string(), "r1".to_string()],
                field_formulas: vec![],
                validation_formulas: vec![],
                editability_formulas: vec![],
                row: true,
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 5,
                col: 0,
                content: "=BLOCKREF(\"t\",\"r2\",\"v\")".to_string(),
            }),
            EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 5,
                col: 1,
                content: "=SUM(BLOCKREFS(\"t\",\"*\",\"v\"))".to_string(),
            }),
        ],
        undoable: true,
        init: false,
    }));

    // Default: the named form is preserved.
    let mut named = workbook.save().expect("save named");
    let reopened = Workbook::from_file(&mut named, "named".to_string()).expect("reopen named");
    let ws = reopened.get_sheet_by_idx(0).unwrap();
    assert!(
        ws.get_formula(5, 0).unwrap().contains("BLOCKREF"),
        "default save must keep BLOCKREF, got {:?}",
        ws.get_formula(5, 0)
    );

    // Coordinates: A1 refs, and no LogiSheets-only function left behind.
    let bytes = workbook
        .save_with_format(logisheets::FormulaFormat::Coordinates)
        .expect("save resolved");
    let mut bytes = bytes;
    let reopened =
        Workbook::from_file(&mut bytes, "resolved".to_string()).expect("reopen resolved");
    let ws = reopened.get_sheet_by_idx(0).unwrap();

    // `v` of row key "r2" is the block's (1,1) => sheet B2.
    let single = ws.get_formula(5, 0).unwrap();
    assert_eq!(single, "B2", "BLOCKREF should resolve to a cell, got {single:?}");

    // Every row of field `v` is B1:B2.
    let multi = ws.get_formula(5, 1).unwrap();
    assert!(
        multi.contains("B1:B2") && !multi.contains("BLOCKREF"),
        "BLOCKREFS should resolve to a range, got {multi:?}"
    );
}

/// Removing a row from a block must dirty `BlockAll`, or an aggregate reading
/// that block keeps counting the row that is gone.
///
/// `BLOCKREFS` depends on `BlockAll` and nothing else — its filters scan
/// whatever the block currently holds, so no per-cell edge can stand in for it.
/// Only the three schema payloads dirtied it, so deletion left the total stale
/// until an unrelated write happened to trigger a recalculation: a block holding
/// 10, 20, 30 still summed to 60 after 20 was deleted.
///
/// Insertion only appeared to work, because new rows materialize their fields'
/// value formulas and writing those cells reaches `BlockAll` through the
/// per-cell edge — so a block whose fields had no formula had the bug in both
/// directions.
#[test]
fn test_block_row_removal_dirties_readers() {
    let mut workbook = Workbook::new();
    let mut payloads = vec![EditPayload::CreateBlock(CreateBlock {
        sheet_idx: 0,
        id: 1,
        master_row: 0,
        master_col: 0,
        row_cnt: 3,
        col_cnt: 2,
        owner: None,
        modify_policy: None,
    })];
    for (i, (k, v)) in [("k1", "10"), ("k2", "20"), ("k3", "30")]
        .into_iter()
        .enumerate()
    {
        payloads.push(EditPayload::BlockInput(BlockInput {
            sheet_idx: 0,
            block_id: 1,
            row: i,
            col: 0,
            input: k.to_string(),
        }));
        payloads.push(EditPayload::BlockInput(BlockInput {
            sheet_idx: 0,
            block_id: 1,
            row: i,
            col: 1,
            input: v.to_string(),
        }));
    }
    payloads.push(EditPayload::BindFormSchema(BindFormSchema {
        ref_name: "t".to_string(),
        sheet_idx: 0,
        block_id: 1,
        field_from: 0,
        key_idx: 0,
        fields: vec!["key".to_string(), "v".to_string()],
        render_ids: vec!["r0".to_string(), "r1".to_string()],
        field_formulas: vec![],
        validation_formulas: vec![],
        editability_formulas: vec![],
        row: true,
    }));
    // Readers outside the block: one aggregate over the field, one count.
    payloads.push(EditPayload::CellInput(CellInput {
        sheet_idx: 0,
        row: 10,
        col: 0,
        content: "=SUM(BLOCKREFS(\"t\",\"*\",\"v\"))".to_string(),
    }));
    payloads.push(EditPayload::CellInput(CellInput {
        sheet_idx: 0,
        row: 10,
        col: 1,
        content: "=COUNT(BLOCKREFS(\"t\",\"*\",\"v\"))".to_string(),
    }));
    workbook.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
        payloads,
        undoable: true,
        init: false,
    }));

    let num = |wb: &mut Workbook, row: usize, col: usize| -> f64 {
        match wb.get_sheet_by_idx(0).unwrap().get_value(row, col).unwrap() {
            logisheets::Value::Number(n) => n,
            other => panic!("expected a number at ({row},{col}), got {other:?}"),
        }
    };
    assert_eq!(num(&mut workbook, 10, 0), 60.0);
    assert_eq!(num(&mut workbook, 10, 1), 3.0);

    // Drop the middle row.
    workbook.handle_action(logisheets::EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::DeleteRowsInBlock(DeleteRowsInBlock {
            sheet_idx: 0,
            block_id: 1,
            start: 1,
            cnt: 1,
        })],
        undoable: true,
        init: false,
    }));

    // Immediately — not after some later unrelated write.
    assert_eq!(
        num(&mut workbook, 10, 0),
        40.0,
        "SUM(BLOCKREFS) still counts the deleted row"
    );
    assert_eq!(
        num(&mut workbook, 10, 1),
        2.0,
        "COUNT(BLOCKREFS) still counts the deleted row"
    );
}
