//! CI coverage guards for the formula function set.
//!
//! Two ratchets over every function in the calc dispatch table
//! (`crates/controller/src/calc_engine/calculator/funcs/mod.rs`):
//!
//!   1. every function has at least one logiscript test under `tests/`
//!   2. every function has an autocomplete / signature-help entry (智能提示)
//!      in `resources/funcs/out/funcs.json`
//!
//! Functions that predate these guards are grandfathered in the baseline files
//! (`tests/coverage_baseline_*.txt`). A NEW function must either be covered or
//! be explicitly added to a baseline (which should be rare and reviewed). The
//! tests also fail if a baseline entry is now covered (remove it) or no longer
//! dispatched (remove it), so the baselines can only shrink.

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

/// Function names dispatched in `function_calculate` (arms like `"NAME" => ...`).
fn dispatched_functions() -> BTreeSet<String> {
    let src = fs::read_to_string(
        repo_root().join("crates/controller/src/calc_engine/calculator/funcs/mod.rs"),
    )
    .expect("read funcs/mod.rs");
    let mut set = BTreeSet::new();
    for line in src.lines() {
        let t = line.trim_start();
        let Some(rest) = t.strip_prefix('"') else {
            continue;
        };
        let Some(end) = rest.find('"') else {
            continue;
        };
        let name = &rest[..end];
        let after = rest[end + 1..].trim_start();
        let valid = !name.is_empty()
            && name
                .chars()
                .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || c == '.' || c == '_');
        if after.starts_with("=>") && valid {
            set.insert(name.to_string());
        }
    }
    assert!(
        set.len() > 100,
        "parsed too few dispatch arms ({}); did mod.rs move?",
        set.len()
    );
    set
}

/// Uppercased concatenation of every `*.script` under `tests/`.
fn all_script_text() -> String {
    fn walk(dir: &Path, out: &mut String) {
        for e in fs::read_dir(dir).unwrap() {
            let p = e.unwrap().path();
            if p.is_dir() {
                walk(&p, out);
            } else if p.extension().and_then(|x| x.to_str()) == Some("script") {
                out.push_str(&fs::read_to_string(&p).unwrap().to_uppercase());
                out.push('\n');
            }
        }
    }
    let mut s = String::new();
    walk(&repo_root().join("tests"), &mut s);
    s
}

/// Is `NAME(` present in `hay`, not preceded by an identifier char (so `OR(`
/// does not match inside `XOR(`)? `hay` is already uppercased.
fn is_called(name: &str, hay: &str) -> bool {
    let pat = format!("{name}(");
    let bytes = hay.as_bytes();
    let mut from = 0;
    while let Some(i) = hay[from..].find(&pat) {
        let idx = from + i;
        let prev_ok = idx == 0 || {
            let c = bytes[idx - 1];
            !(c.is_ascii_alphanumeric() || c == b'_' || c == b'.')
        };
        if prev_ok {
            return true;
        }
        from = idx + 1;
    }
    false
}

/// Function names present in the autocomplete metadata (`out/funcs.json`).
fn intellisense_names() -> BTreeSet<String> {
    let txt = fs::read_to_string(
        repo_root().join("packages/formula-editor/src/lib/builtin-functions.json"),
    )
    .expect("read packages/formula-editor/src/lib/builtin-functions.json");
    let bytes = txt.as_bytes();
    let key = "\"name\"";
    let mut set = BTreeSet::new();
    let mut i = 0;
    while let Some(p) = txt[i..].find(key) {
        let mut j = i + p + key.len();
        while j < bytes.len() && matches!(bytes[j], b' ' | b'\t' | b'\n' | b'\r' | b':') {
            j += 1;
        }
        if j < bytes.len() && bytes[j] == b'"' {
            j += 1;
            let s = j;
            while j < bytes.len() && bytes[j] != b'"' {
                j += 1;
            }
            set.insert(txt[s..j].to_string());
        }
        i = i + p + key.len();
    }
    set
}

fn read_baseline(rel: &str) -> BTreeSet<String> {
    let path = repo_root().join(rel);
    let txt = fs::read_to_string(&path).unwrap_or_default();
    txt.lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty() && !l.starts_with('#'))
        .map(|l| l.to_string())
        .collect()
}

/// Shared ratchet: assert `covered ∪ baseline ⊇ dispatched`, and that the
/// baseline is minimal (no covered or non-dispatched entries).
fn check_ratchet(
    dispatched: &BTreeSet<String>,
    covered: impl Fn(&str) -> bool,
    baseline_file: &str,
    what: &str,
    fix_hint: &str,
) {
    let baseline = read_baseline(baseline_file);
    let mut missing = Vec::new();
    let mut stale = Vec::new();
    for f in dispatched {
        let cov = covered(f);
        let based = baseline.contains(f);
        if !cov && !based {
            missing.push(f.clone());
        }
        if cov && based {
            stale.push(f.clone());
        }
    }
    let orphan: Vec<String> = baseline
        .iter()
        .filter(|b| !dispatched.contains(*b))
        .cloned()
        .collect();

    let mut msg = String::new();
    if !missing.is_empty() {
        msg += &format!(
            "\n{} function(s) have NO {what}.\n  {}\n  Fix: {fix_hint}\n  (Or, discouraged, grandfather them in {baseline_file}.)\n",
            missing.len(),
            missing.join(" ")
        );
    }
    if !stale.is_empty() {
        msg += &format!(
            "\n{} function(s) now have {what} but are still listed in {baseline_file} — delete these lines so the baseline keeps shrinking:\n  {}\n",
            stale.len(),
            stale.join(" ")
        );
    }
    if !orphan.is_empty() {
        msg += &format!(
            "\n{} entrie(s) in {baseline_file} are no longer dispatched — delete these lines:\n  {}\n",
            orphan.len(),
            orphan.join(" ")
        );
    }
    assert!(msg.is_empty(), "{msg}");
}

#[test]
fn every_function_has_a_logiscript_test() {
    let dispatched = dispatched_functions();
    let hay = all_script_text();
    check_ratchet(
        &dispatched,
        |f| is_called(f, &hay),
        "tests/coverage_baseline_logiscript.txt",
        "logiscript test",
        "add a `.script` under tests/ that calls the function, e.g. `INPUT A1 =NAME(..)` + `CHECK...`",
    );
}

#[test]
fn every_function_has_intellisense() {
    let dispatched = dispatched_functions();
    let hints = intellisense_names();
    check_ratchet(
        &dispatched,
        |f| hints.contains(f),
        "tests/coverage_baseline_intellisense.txt",
        "autocomplete/signature entry",
        "add resources/funcs/<name>.json + a functions.<name>.description in resources/locale/en.json, then `yarn run-scripts`",
    );
}
