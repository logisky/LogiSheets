//! Every VALUE kind and every REFERENCE form must survive a save and a reload.
//!
//! Both are families, and the repo's history is that a family gets one member
//! tested and the rest silently broken. `InlineStr` is the standing example: it
//! was a `todo!()` in five separate places, each found only after the one before
//! it was fixed, because nothing ever asked for the whole set at once. A stored
//! string that arrives inline instead of through the shared-string table is not
//! an exotic input — it is what several real producers emit.
//!
//! So these are tables, not examples. Each row is written into a fresh workbook,
//! saved, reopened, and compared; adding a case is one line, and a case that
//! cannot work yet is listed with the reason rather than left out.

use logisheets::{EditAction, Value, Workbook};
use logisheets_controller::edit_action::{CellInput, PayloadsAction, StatusCode};

fn write(wb: &mut Workbook, cells: &[(usize, usize, &str)]) {
    let mut action = PayloadsAction::new();
    for (row, col, content) in cells {
        action = action.add_payload(CellInput {
            sheet_idx: 0,
            row: *row,
            col: *col,
            content: content.to_string(),
        });
    }
    let r = wb.handle_action(EditAction::Payloads(action));
    assert!(
        matches!(r.status, StatusCode::Ok(_)),
        "writing {cells:?} failed: {:?}",
        r.status
    );
}

fn save_reload(wb: &Workbook) -> Workbook {
    let mut bytes = wb.save().expect("save");
    Workbook::from_file(&mut bytes, "reload".to_string()).expect("reopen")
}

/// A cell's own displayed value, for every kind a cell can hold.
#[test]
fn every_value_kind_survives_a_round_trip() {
    // (what is typed, how it should read back)
    let cases: &[(&str, &str)] = &[
        ("42", "Number(42.0)"),
        ("-0.5", "Number(-0.5)"),
        // Enough digits that a float printed and reparsed has to land back on
        // the same bits.
        ("0.1234567890123456", "Number(0.1234567890123456)"),
        ("1e300", "Number(1e300)"),
        ("plain text", "Str(\"plain text\")"),
        // Non-ASCII, and a string holding the characters XML escapes.
        ("名字 & <tag> \"quoted\"", "Str(\"名字 & <tag> \\\"quoted\\\"\")"),
        // Long enough that a producer would put it in the shared-string table
        // rather than inline.
        (
            "a string long enough to be worth a shared-string entry of its own",
            "Str(\"a string long enough to be worth a shared-string entry of its own\")",
        ),
        // A typed string is TRIMMED on the way in — Excel keeps the space, we
        // drop it — so the expectation here is what the engine does, not what
        // Excel does. Recorded rather than left out: this is an input-path
        // decision, not a round-trip loss, and the round trip is what is under
        // test. The saved value keeps whatever survived the trim.
        ("  padded  ", "Str(\"padded\")"),
        ("TRUE", "Bool(true)"),
        ("FALSE", "Bool(false)"),
        ("=1/0", "Error(\"#DIV/0!\")"),
        ("=NA()", "Error(\"#N/A\")"),
        ("=\"a\"+1", "Error(\"#VALUE!\")"),
        ("=SUM(1,2)", "Number(3.0)"),
        // An empty write leaves the cell empty, and must not invent a value.
        ("", "Empty"),
    ];

    let mut failures = Vec::<String>::new();
    for (typed, want) in cases {
        let mut wb = Workbook::default();
        write(&mut wb, &[(0, 0, typed)]);
        let live = wb
            .get_sheet_by_idx(0)
            .and_then(|s| s.get_value(0, 0))
            .map(|v| format!("{v:?}"))
            .unwrap_or_else(|e| format!("{e:?}"));
        if live != *want {
            failures.push(format!("{typed:?}: read {live} before saving, wanted {want}"));
            continue;
        }
        let back = save_reload(&wb)
            .get_sheet_by_idx(0)
            .and_then(|s| s.get_value(0, 0))
            .map(|v| format!("{v:?}"))
            .unwrap_or_else(|e| format!("{e:?}"));
        if back != *want {
            failures.push(format!("{typed:?}: came back {back}, wanted {want}"));
        }
    }
    assert!(
        failures.is_empty(),
        "{} of {} value kinds broke:\n  {}",
        failures.len(),
        cases.len(),
        failures.join("\n  ")
    );
}

/// A formula's REFERENCE has to come back pointing at the same thing, and stay
/// live. A stored result looks identical to a working formula until something
/// upstream changes, so each case is re-checked after an edit on the far side.
#[test]
fn every_reference_form_survives_a_round_trip() {
    // (formula under test, expected before, expected after A1 becomes 100)
    let cases: &[(&str, f64, f64)] = &[
        ("=A1", 1.0, 100.0),
        // Absolute, mixed, and the two half-absolute forms: all four have to
        // survive as themselves, because a save writes the reference back out
        // as text and a lost `$` silently changes what a fill would do.
        ("=$A$1", 1.0, 100.0),
        ("=$A1", 1.0, 100.0),
        ("=A$1", 1.0, 100.0),
        ("=SUM(A1:A3)", 6.0, 105.0),
        ("=SUM($A$1:$A$3)", 6.0, 105.0),
        // A whole column: an unbounded range, resolved differently from A1:A3.
        ("=SUM(A:A)", 6.0, 105.0),
        // A range in one call and a bare ref in another, so the two dependency
        // kinds coexist on one cell.
        ("=SUM(A1:A3)+A1", 7.0, 205.0),
        ("=COUNT(A1:A3)", 3.0, 3.0),
        // Nested, with the reference buried inside two calls.
        ("=IF(SUM(A1:A2)>0,A1,0)", 1.0, 100.0),
    ];

    let mut failures = Vec::<String>::new();
    for (formula, want_before, want_after) in cases {
        let mut wb = Workbook::default();
        write(
            &mut wb,
            &[(0, 0, "1"), (1, 0, "2"), (2, 0, "3"), (0, 2, formula)],
        );
        let live = wb.get_sheet_by_idx(0).and_then(|s| s.get_value(0, 2));
        if !matches!(live, Ok(Value::Number(n)) if n == *want_before) {
            failures.push(format!("{formula}: {live:?} before saving, wanted {want_before}"));
            continue;
        }

        let mut back = save_reload(&wb);
        let reread = back.get_sheet_by_idx(0).and_then(|s| s.get_value(0, 2));
        if !matches!(reread, Ok(Value::Number(n)) if n == *want_before) {
            failures.push(format!("{formula}: came back {reread:?}, wanted {want_before}"));
            continue;
        }
        // The reference SPELLING, so a dropped `$` or a collapsed `A:A` is
        // reported as itself rather than as a puzzling number three tests from
        // now. The engine re-prints a formula from its AST, so the leading `=`
        // and the spacing around operators are its own and are normalized away
        // here; no case holds a string literal, so removing spaces cannot hide
        // a loss inside one.
        let text = back.get_sheet_by_idx(0).and_then(|s| s.get_formula(0, 2));
        let flat = |s: &str| s.trim_start_matches('=').replace(' ', "");
        if text.as_deref().map(flat).ok() != Some(flat(formula)) {
            failures.push(format!("{formula}: stored as {text:?}"));
        }

        write(&mut back, &[(0, 0, "100")]);
        let after = back.get_sheet_by_idx(0).and_then(|s| s.get_value(0, 2));
        if !matches!(after, Ok(Value::Number(n)) if n == *want_after) {
            failures.push(format!(
                "{formula}: went stale after reload — {after:?}, wanted {want_after}"
            ));
        }
    }
    assert!(
        failures.is_empty(),
        "{} of {} reference forms broke:\n  {}",
        failures.len(),
        cases.len(),
        failures.join("\n  ")
    );
}

/// A reference that names ANOTHER SHEET. Its own form, and the one most exposed
/// by a round trip: within a sheet a reference survives as a pair of numbers,
/// but a cross-sheet reference has to be written out as a NAME and resolved
/// again on load, against a sheet table rebuilt from XML. A name holding a space
/// is quoted in the file, and one holding an apostrophe has to escape it.
#[test]
fn a_cross_sheet_reference_survives_a_round_trip() {
    use logisheets_controller::edit_action::{CreateSheet, EditPayload, SheetRename};

    for name in ["Data", "Quarterly Data", "Bob's Data"] {
        let mut wb = Workbook::default();
        let r = wb.handle_action(EditAction::Payloads(PayloadsAction {
            payloads: vec![
                EditPayload::CreateSheet(CreateSheet {
                    idx: 1,
                    new_name: name.to_string(),
                }),
                EditPayload::SheetRename(SheetRename {
                    idx: Some(1),
                    old_name: None,
                    new_name: name.to_string(),
                }),
            ],
            undoable: false,
            init: false,
        }));
        assert!(
            matches!(r.status, StatusCode::Ok(_)),
            "creating sheet {name:?} failed: {:?}",
            r.status
        );

        let mut action = PayloadsAction::new().add_payload(CellInput {
            sheet_idx: 1,
            row: 0,
            col: 0,
            content: "7".into(),
        });
        // A name with a space or an apostrophe must be quoted in the formula.
        let quoted = if name.chars().all(|c| c.is_ascii_alphanumeric()) {
            name.to_string()
        } else {
            format!("'{}'", name.replace('\'', "''"))
        };
        action = action.add_payload(CellInput {
            sheet_idx: 0,
            row: 0,
            col: 0,
            content: format!("={quoted}!A1*2"),
        });
        let r = wb.handle_action(EditAction::Payloads(action));
        assert!(
            matches!(r.status, StatusCode::Ok(_)),
            "referring to {quoted} failed: {:?}",
            r.status
        );
        let live = wb.get_sheet_by_idx(0).and_then(|s| s.get_value(0, 0));
        assert!(
            matches!(live, Ok(Value::Number(n)) if n == 14.0),
            "{quoted}!A1*2 read {live:?} before saving"
        );

        let mut back = save_reload(&wb);
        let reread = back.get_sheet_by_idx(0).and_then(|s| s.get_value(0, 0));
        assert!(
            matches!(reread, Ok(Value::Number(n)) if n == 14.0),
            "{quoted}!A1*2 came back {reread:?}"
        );

        // And still pointing at that sheet, not at a stored 14.
        write(&mut back, &[]);
        let r = back.handle_action(EditAction::Payloads(PayloadsAction::new().add_payload(
            CellInput {
                sheet_idx: 1,
                row: 0,
                col: 0,
                content: "50".into(),
            },
        )));
        assert!(matches!(r.status, StatusCode::Ok(_)), "{:?}", r.status);
        let after = back.get_sheet_by_idx(0).and_then(|s| s.get_value(0, 0));
        assert!(
            matches!(after, Ok(Value::Number(n)) if n == 100.0),
            "{quoted}!A1*2 went stale after reload: {after:?}"
        );
    }
}

/// A STRUCTURAL edit shifts every reference that points past it, and the shifted
/// reference has to be what gets saved.
///
/// This is the family with the worst failure mode in the repo: a reference that
/// shifts wrong is not an error, it is a plausible number pointing at the wrong
/// cell, and it survives every check that only asks whether the file loads. The
/// engine holds references as ids, so nothing shifts internally — but a save
/// prints them back as TEXT against the post-edit grid, and that printing is
/// where an off-by-one lives.
///
/// Each case sets up the same sheet, applies one structural edit, and then
/// insists on three things: the value now, the value after a save and a reload,
/// and the reference's spelling in the reloaded file. The last one is what
/// distinguishes "shifted correctly" from "happened to still add up".
#[test]
fn a_structural_edit_is_saved_as_the_shifted_reference() {
    use logisheets_controller::edit_action::{
        DeleteCols, DeleteRows, EditPayload, InsertCols, InsertRows,
    };

    // A1=1 A2=2 A3=3, with the formula under test at D11 — below and to the
    // right of every edit, so it is never itself deleted and the test is
    // measuring the reference rather than the cell holding it.
    const FR: usize = 10;
    const FC: usize = 3;
    let setup = |wb: &mut Workbook, formula: &str| {
        write(
            wb,
            &[(0, 0, "1"), (1, 0, "2"), (2, 0, "3"), (FR, FC, formula)],
        );
    };

    // (formula, edit, expected value after, expected spelling after)
    let cases: &[(&str, EditPayload, f64, &str)] = &[
        // A row inserted ABOVE the referent moves it down.
        (
            "=A2",
            EditPayload::InsertRows(InsertRows {
                sheet_idx: 0,
                start: 0,
                count: 1,
            }),
            2.0,
            "A3",
        ),
        // A row inserted INSIDE a range widens it.
        (
            "=SUM(A1:A3)",
            EditPayload::InsertRows(InsertRows {
                sheet_idx: 0,
                start: 1,
                count: 1,
            }),
            6.0,
            "SUM(A1:A4)",
        ),
        // A row inserted below the range leaves it alone.
        (
            "=SUM(A1:A3)",
            EditPayload::InsertRows(InsertRows {
                sheet_idx: 0,
                start: 5,
                count: 1,
            }),
            6.0,
            "SUM(A1:A3)",
        ),
        // Deleting a row above pulls the referent up.
        (
            "=A3",
            EditPayload::DeleteRows(DeleteRows {
                sheet_idx: 0,
                start: 0,
                count: 1,
            }),
            3.0,
            "A2",
        ),
        // Deleting a row inside a range narrows it, and drops that addend.
        (
            "=SUM(A1:A3)",
            EditPayload::DeleteRows(DeleteRows {
                sheet_idx: 0,
                start: 1,
                count: 1,
            }),
            4.0,
            "SUM(A1:A2)",
        ),
        // An absolute reference shifts too: `$` pins it against a FILL, not
        // against a structural edit.
        (
            "=$A$2",
            EditPayload::InsertRows(InsertRows {
                sheet_idx: 0,
                start: 0,
                count: 1,
            }),
            2.0,
            "$A$3",
        ),
        // Columns, the same three ways.
        (
            "=A1",
            EditPayload::InsertCols(InsertCols {
                sheet_idx: 0,
                start: 0,
                count: 1,
            }),
            1.0,
            "B1",
        ),
        (
            "=SUM(A1:A3)",
            EditPayload::InsertCols(InsertCols {
                sheet_idx: 0,
                start: 0,
                count: 2,
            }),
            6.0,
            "SUM(C1:C3)",
        ),
        (
            "=SUM(B1:B3)",
            EditPayload::DeleteCols(DeleteCols {
                sheet_idx: 0,
                start: 0,
                count: 1,
            }),
            0.0,
            "SUM(A1:A3)",
        ),
    ];

    let mut failures = Vec::<String>::new();
    for (formula, edit, want, want_spelling) in cases {
        let label = format!("{formula} then {edit:?}");
        let mut wb = Workbook::default();
        setup(&mut wb, formula);
        let r = wb.handle_action(EditAction::Payloads(PayloadsAction {
            payloads: vec![edit.clone()],
            undoable: true,
            init: false,
        }));
        if !matches!(r.status, StatusCode::Ok(_)) {
            failures.push(format!("{label}: the edit failed: {:?}", r.status));
            continue;
        }

        // The formula's own cell moves with the edit, so follow it rather than
        // assuming — every edit here lands above or left of it.
        let (fr, fc) = match edit {
            EditPayload::InsertRows(p) => (FR + p.count, FC),
            EditPayload::DeleteRows(p) => (FR - p.count, FC),
            EditPayload::InsertCols(p) => (FR, FC + p.count),
            EditPayload::DeleteCols(p) => (FR, FC - p.count),
            _ => (FR, FC),
        };

        let live = wb.get_sheet_by_idx(0).and_then(|s| s.get_value(fr, fc));
        if !matches!(live, Ok(Value::Number(n)) if n == *want) {
            failures.push(format!("{label}: {live:?} before saving, wanted {want}"));
            continue;
        }

        let back = save_reload(&wb);
        let sheet = match back.get_sheet_by_idx(0) {
            Ok(s) => s,
            Err(e) => {
                failures.push(format!("{label}: sheet gone: {e:?}"));
                continue;
            }
        };
        let reread = sheet.get_value(fr, fc);
        if !matches!(reread, Ok(Value::Number(n)) if n == *want) {
            failures.push(format!("{label}: came back {reread:?}, wanted {want}"));
        }
        let text = sheet.get_formula(fr, fc);
        let flat = |s: &str| s.trim_start_matches('=').replace(' ', "");
        if text.as_deref().map(flat).ok().as_deref() != Some(*want_spelling) {
            failures.push(format!(
                "{label}: saved as {text:?}, wanted {want_spelling}"
            ));
        }
    }
    assert!(
        failures.is_empty(),
        "{} of {} structural edits broke:\n  {}",
        failures.len(),
        cases.len(),
        failures.join("\n  ")
    );
}
