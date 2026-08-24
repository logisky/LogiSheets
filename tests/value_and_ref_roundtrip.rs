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
