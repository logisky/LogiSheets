//! Differential test against workbooks another library wrote.
//!
//! `tests/roundtrip_corpus.rs` proves we do not lose parts of a file we cannot
//! model. It says nothing about whether the numbers are right. This does the
//! other half: load a workbook produced by openpyxl and check every computed
//! cell against a value worked out independently.
//!
//! Two properties make it worth having:
//!
//!   * **openpyxl caches nothing.** It writes `<f>B1*B2</f><v/>` because it
//!     never evaluates. So there is no cached result to fall back on and no way
//!     to pass by echoing the file — every number here is our own evaluation of
//!     the formula, from the inputs.
//!   * **The expectations are not ours.** They are computed in Python, from the
//!     same inputs, by `tests/gen/gen_corpus.py`, and never read back out of any
//!     spreadsheet. Where Excel's semantics differ from Python's — `^` is
//!     left-associative, unary minus binds tighter than it, `ROUND` is half away
//!     from zero — the generator writes the Excel answer out literally with the
//!     reason, because a reference that quietly computed the Python answer would
//!     be worse than no test at all.
//!
//! Where we knowingly differ from Excel the manifest carries a `diverges`
//! note beside the Excel answer, and this test holds that line in both
//! directions: a new mismatch fails, and so does a listed one that starts
//! passing — because that means somebody fixed it and the note is now a lie.
//!
//! Every expectation is checked twice: once on the file as loaded, and again
//! after saving it through our own writer and reading it back. `roundtrip_corpus`
//! proves no PART of a file survives the trip; this proves no VALUE changes on
//! the way — the class where the engine computes the right answer and then
//! writes something else, which neither check could catch alone.
//!
//! The corpus and its manifest are committed, so this needs no Python to run.
//! Regenerate with `python3 tests/gen/gen_corpus.py` after editing the script.

use logisheets::{Value, Workbook};
use serde_json::Value as Json;

/// `"B12"` → `(row, col)`, both 0-based, as the API wants them.
fn parse_a1(cell: &str) -> (usize, usize) {
    let split = cell
        .find(|c: char| c.is_ascii_digit())
        .unwrap_or_else(|| panic!("{cell} has no row number"));
    let (letters, digits) = cell.split_at(split);
    let col = letters.bytes().fold(0usize, |acc, b| {
        acc * 26 + (b.to_ascii_uppercase() - b'A' + 1) as usize
    });
    let row: usize = digits
        .parse()
        .unwrap_or_else(|_| panic!("bad row in {cell}"));
    (row - 1, col - 1)
}

/// What the cell holds, rendered for a failure message. A value we cannot read
/// at all is as much a failure as a wrong one, so this never panics.
fn describe(v: &Option<Value>) -> String {
    match v {
        Some(Value::Number(n)) => format!("number {n}"),
        Some(Value::Str(t)) => format!("text {t:?}"),
        Some(Value::Bool(b)) => format!("bool {b}"),
        Some(Value::Error(e)) => format!("error {e}"),
        Some(other) => format!("{other:?}"),
        None => "nothing".to_string(),
    }
}

/// Compare one workbook against the manifest's checks, appending any
/// mismatches to `failures`. `phase` names which copy is being looked at.
fn verify(
    wb: &Workbook,
    book: &Json,
    file: &str,
    phase: &str,
    failures: &mut Vec<String>,
) -> usize {
    let mut checked = 0usize;
    for check in book["checks"].as_array().expect("checks is an array") {
        let sheet = check["sheet"].as_str().unwrap();
        let cell = check["cell"].as_str().unwrap();
        let note = check["note"].as_str().unwrap_or("");
        let (row, col) = parse_a1(cell);

        let ws = match wb.get_sheet_by_name(sheet) {
            Ok(ws) => ws,
            Err(e) => {
                failures.push(format!("{file} [{phase}] !{sheet}: no such sheet ({e:?})"));
                continue;
            }
        };
        let got = ws.get_value(row, col).ok();
        checked += 1;

        let ok = match check["kind"].as_str().unwrap() {
            "number" => {
                let want = check["value"].as_f64().unwrap();
                match &got {
                    // Relative where it matters, absolute near zero: a
                    // margin of 0.6333… is not a candidate for ==.
                    Some(Value::Number(n)) => (n - want).abs() <= 1e-9 * want.abs().max(1.0),
                    _ => false,
                }
            }
            "text" => {
                let want = check["value"].as_str().unwrap();
                matches!(&got, Some(Value::Str(t)) if t == want)
            }
            "bool" => {
                let want = check["value"].as_bool().unwrap();
                matches!(&got, Some(Value::Bool(b)) if *b == want)
            }
            other => panic!("manifest asks for an unknown kind {other:?}"),
        };

        // A known divergence keeps Excel's answer in the manifest — that
        // is still what is true — and records why we differ. Same bargain
        // as `allowed_losses` in roundtrip_corpus: characterised, never
        // silently tolerated, and it fails the moment it stops being
        // accurate in either direction.
        match (ok, check.get("diverges").and_then(|d| d.as_str())) {
            (true, None) | (false, Some(_)) => {}
            (false, None) => failures.push(format!(
                "{file} [{phase}] !{sheet}!{cell}: expected {} {}, got {} — {note}",
                check["kind"].as_str().unwrap(),
                check["value"],
                describe(&got),
            )),
            (true, Some(why)) => failures.push(format!(
                "{file} [{phase}] !{sheet}!{cell}: now MATCHES Excel, but is still \
                 listed as a known divergence ({why}) — drop the \
                 `diverges=` from tests/gen/gen_corpus.py and regenerate"
            )),
        }
    }
    checked
}

#[test]
fn computes_what_another_library_left_uncomputed() {
    let dir = std::path::Path::new("tests/generated");
    let manifest = std::fs::read_to_string(dir.join("manifest.json"))
        .expect("tests/generated/manifest.json — regenerate with tests/gen/gen_corpus.py");
    let manifest: Json = serde_json::from_str(&manifest).expect("manifest is JSON");
    let books = manifest.as_array().expect("manifest is an array");
    assert!(!books.is_empty(), "the manifest lists no workbooks");

    let mut checked = 0usize;
    let mut failures = Vec::<String>::new();

    for book in books {
        let file = book["file"].as_str().expect("each entry names a file");
        let mut buf = match std::fs::read(dir.join(file)) {
            Ok(b) => b,
            Err(e) => {
                failures.push(format!("{file}: cannot read: {e}"));
                continue;
            }
        };
        let wb = match Workbook::from_file(&mut buf, file.to_string()) {
            Ok(wb) => wb,
            Err(e) => {
                failures.push(format!("{file}: load failed: {e:?}"));
                continue;
            }
        };
        checked += verify(&wb, book, file, "as loaded", &mut failures);

        // And again through our own writer. `roundtrip_corpus` proves no PART
        // of a file is lost on save; this proves no VALUE is — the class where
        // the engine computes the right answer and then writes something else,
        // which neither test could see on its own. Every expectation above is
        // re-checked, so the second pass costs one save and one load.
        let saved = match wb.save() {
            Ok(s) => s,
            Err(e) => {
                failures.push(format!("{file}: save failed: {e:?}"));
                continue;
            }
        };
        let mut saved_buf = saved;
        match Workbook::from_file(&mut saved_buf, file.to_string()) {
            Ok(reloaded) => {
                checked += verify(&reloaded, book, file, "after save+reload", &mut failures)
            }
            Err(e) => failures.push(format!("{file}: reload of our own output failed: {e:?}")),
        }
    }

    assert!(
        checked > 0,
        "the manifest produced no checks at all — is tests/generated empty?"
    );
    assert!(
        failures.is_empty(),
        "{} of {checked} checks failed:\n  {}",
        failures.len(),
        failures.join("\n  ")
    );
}
