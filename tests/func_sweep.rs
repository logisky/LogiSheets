//! Panic sweep over every formula function.
//!
//! Every function in the calc dispatch table is called with awkward arguments
//! — blanks, text, negatives, huge and tiny numbers, errors, booleans, refs,
//! ranges, arrays — and must return a value or an error value, never panic. A
//! panic in the wasm build poisons the engine instance for the rest of the
//! session (that is how `=HEX2DEC("XYZ")` took the app down).
//!
//! `arbitrary_formula_never_panics` in proptest_engine.rs and the
//! `formula_parser` fuzz target feed random TEXT, which almost never spells a
//! real function name with the right argument count; this sweep starts from
//! the names instead.
//!
//! Arity 0..=2 is exhaustive over the argument pool; arity 3..=4 is a seeded
//! sample per function (`FUNC_SWEEP_SAMPLES`, default 150), so a run is
//! deterministic. Raise it locally to dig deeper.
//!
//! `#[ignore]`d — run with `-- --ignored` (release mode is much faster).

use std::collections::BTreeSet;
use std::fs;
use std::panic::{self, AssertUnwindSafe};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use logisheets::{EditAction, Workbook};
use logisheets_controller::edit_action::{CellInput, PayloadsAction};

/// Function names dispatched in `function_calculate` (arms like `"NAME" => ...`).
/// Same parse as tests/function_coverage.rs.
fn dispatched_functions() -> BTreeSet<String> {
    let src = fs::read_to_string(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("crates/controller/src/calc_engine/calculator/funcs/mod.rs"),
    )
    .expect("read funcs/mod.rs");
    let mut set = BTreeSet::new();
    for line in src.lines() {
        let Some(rest) = line.trim_start().strip_prefix('"') else {
            continue;
        };
        let Some(end) = rest.find('"') else {
            continue;
        };
        let name = &rest[..end];
        let valid = !name.is_empty()
            && name
                .chars()
                .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || c == '.' || c == '_');
        if valid && rest[end + 1..].trim_start().starts_with("=>") {
            set.insert(name.to_string());
        }
    }
    assert!(set.len() > 100, "parsed too few dispatch arms ({})", set.len());
    set
}

/// Arguments spliced into calls. A1:B3 is filled by `fixture()`.
const ARGS: &[&str] = &[
    "",
    "0",
    "1",
    "-1",
    "2.5",
    "-0.5",
    "1E+300",
    "-1E+300",
    "1E-300",
    "2147483648",
    "\"\"",
    "\"abc\"",
    "\"-1\"",
    "\"1G\"",
    "TRUE",
    "#N/A",
    "1/0",
    "A1",
    "B2",
    "A1:B3",
    "{1,2;3,4}",
];

const ROW: usize = 20;
const COL: usize = 9;

/// A1=1, A2="abc", A3=TRUE, B1=#DIV/0!, B2 blank, B3=-2.5.
fn fixture() -> Workbook {
    let mut wb = Workbook::default();
    let mut action = PayloadsAction::new();
    for (row, col, content) in [
        (0, 0, "1"),
        (1, 0, "abc"),
        (2, 0, "TRUE"),
        (0, 1, "=1/0"),
        (2, 1, "-2.5"),
    ] {
        action = action.add_payload(CellInput {
            sheet_idx: 0,
            row,
            col,
            content: content.to_string(),
        });
    }
    wb.handle_action(EditAction::Payloads(action));
    wb
}

fn eval(wb: &mut Workbook, formula: &str) {
    wb.handle_action(EditAction::Payloads(PayloadsAction::new().add_payload(
        CellInput {
            sheet_idx: 0,
            row: ROW,
            col: COL,
            content: formula.to_string(),
        },
    )));
    if let Ok(ws) = wb.get_sheet_by_idx(0) {
        let _ = ws.get_value(ROW, COL);
    }
}

/// xorshift64: deterministic sampling without a rand dependency.
struct Rng(u64);
impl Rng {
    fn next(&mut self, n: usize) -> usize {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        (self.0 % n as u64) as usize
    }
}

fn formulas_for(name: &str, samples: usize) -> Vec<String> {
    let call = |args: &[&str]| format!("={}({})", name, args.join(","));
    let mut out = vec![call(&[])];
    for a in ARGS {
        out.push(call(&[a]));
        for b in ARGS {
            out.push(call(&[a, b]));
        }
    }
    let mut rng = Rng(name.bytes().fold(0x9E37_79B9_7F4A_7C15, |h, b| {
        (h ^ b as u64).wrapping_mul(0x100_0000_01B3)
    }));
    for i in 0..samples {
        let arity = 3 + i % 2;
        let args: Vec<&str> = (0..arity).map(|_| ARGS[rng.next(ARGS.len())]).collect();
        out.push(call(&args));
    }
    out
}

// Too slow for every CI run (hundreds of thousands of evaluations). Run it on
// demand: `cargo test -p logisheets --test func_sweep -- --ignored`.
#[test]
#[ignore]
fn every_function_survives_awkward_arguments() {
    let samples = std::env::var("FUNC_SWEEP_SAMPLES")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(150);

    // Keep panic messages for the report instead of spraying stderr.
    let last_panic = Arc::new(Mutex::new(String::new()));
    let sink = last_panic.clone();
    let prev_hook = panic::take_hook();
    panic::set_hook(Box::new(move |info| {
        let loc = info
            .location()
            .map(|l| format!(" at {}:{}", l.file(), l.line()))
            .unwrap_or_default();
        let msg = info
            .payload()
            .downcast_ref::<&str>()
            .map(|s| s.to_string())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_default();
        *sink.lock().unwrap() = format!("{msg}{loc}");
    }));

    let mut failures: Vec<(String, String)> = vec![];
    let mut slow: Vec<(String, Duration)> = vec![];
    let mut wb = fixture();
    for name in dispatched_functions() {
        // One report per function and panic site is enough.
        let mut seen_sites = BTreeSet::new();
        for f in formulas_for(&name, samples) {
            let start = Instant::now();
            let r = panic::catch_unwind(AssertUnwindSafe(|| eval(&mut wb, &f)));
            let took = start.elapsed();
            if r.is_err() {
                let msg = last_panic.lock().unwrap().clone();
                if seen_sites.insert(msg.clone()) {
                    failures.push((f.clone(), msg));
                }
                // The workbook may be half-updated; start clean.
                wb = fixture();
            } else if took > Duration::from_millis(500) {
                slow.push((f, took));
            }
        }
    }
    panic::set_hook(prev_hook);

    for (f, took) in &slow {
        eprintln!("slow: {f} took {took:?}");
    }
    assert!(
        failures.is_empty(),
        "{} function call(s) panicked:\n{}",
        failures.len(),
        failures
            .iter()
            .map(|(f, m)| format!("  {f}\n      {m}"))
            .collect::<Vec<_>>()
            .join("\n")
    );
}
