//! Checks for whole families of bug, rather than for one bug at a time.
//!
//! Most defects found in this codebase have come in families, and each family
//! has a cheap and complete check. Nine misspelled OOXML names were one grep.
//! Five `todo!()`s reachable from a file's own contents were another. Finding
//! them one at a time, by reading, is the expensive way.
//!
//! These run in milliseconds and need no fixtures.

use std::fs;
use std::path::{Path, PathBuf};

fn rust_sources(root: &str) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let mut stack = vec![PathBuf::from(root)];
    while let Some(dir) = stack.pop() {
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        for e in entries.flatten() {
            let p = e.path();
            if p.is_dir() {
                if p.file_name().and_then(|f| f.to_str()) != Some("target") {
                    stack.push(p);
                }
            } else if p.extension().and_then(|x| x.to_str()) == Some("rs") {
                out.push(p);
            }
        }
    }
    out
}

/// OOXML element and attribute names are camelCase, never snake_case. An
/// underscore in one means a Rust field name was pasted where the XML name
/// belongs — and the result is invisible: an unmatched attribute is simply
/// absent on read, and misspelled on write.
///
/// This found nine at once, `pivotCache` and `textRotation` among them. A
/// rotated cell had been coming back straight, and the pivot chain could not
/// resolve its cache.
#[test]
fn xml_names_are_not_snake_case() {
    let mut bad = Vec::new();
    for path in rust_sources("crates") {
        let Ok(text) = fs::read_to_string(&path) else {
            continue;
        };
        for (i, line) in text.lines().enumerate() {
            let Some(at) = line.find("name = b\"") else {
                continue;
            };
            let rest = &line[at + 9..];
            let Some(end) = rest.find('"') else { continue };
            let name = &rest[..end];
            // `ty = "text"` fields carry no XML name; `_xlfn`-style values and
            // namespace prefixes are not affected.
            if name.contains('_') && !name.starts_with('_') {
                bad.push(format!("{}:{} {}", path.display(), i + 1, name));
            }
        }
    }
    assert!(
        bad.is_empty(),
        "OOXML names are camelCase; these look like Rust field names:\n  {}",
        bad.join("\n  ")
    );
}

/// A panic must not be reachable from a file's own contents.
///
/// The load, save and calculation paths take arbitrary bytes from arbitrary
/// producers. A `todo!()` there is not a note-to-self, it is a crash triggered
/// by data — and in wasm a panic poisons the instance, so one bad workbook can
/// end the session. Five of these have already been found this way, each one
/// unreachable until a separate bug was fixed and the arm suddenly ran.
///
/// The count is a ratchet rather than a ban: there are too many to clear at once,
/// so the rule is that it may fall and must not rise. Lower the number when you
/// remove one.
#[test]
fn panics_reachable_from_data_do_not_increase() {
    // Paths that parse, evaluate or write a user's file.
    const DATA_PATHS: &[(&str, usize)] = &[
        ("crates/workbook/src/reader.rs", 1),
        ("crates/workbook/src/writer.rs", 1),
        ("crates/controller/src/file_loader", 4),
        ("crates/controller/src/file_saver", 1),
        ("crates/controller/base/src/lib.rs", 2),
        // The calculator is the big one, and the least surprising: an
        // unimplemented corner of a function is a `todo!()` today. Every one is
        // a formula someone can type.
        ("crates/controller/src/calc_engine", 26),
    ];
    let mut report = Vec::new();
    for (path, budget) in DATA_PATHS {
        let files = if Path::new(path).is_dir() {
            rust_sources(path)
        } else {
            vec![PathBuf::from(path)]
        };
        let mut found = 0;
        for f in files {
            let Ok(text) = fs::read_to_string(&f) else {
                continue;
            };
            let mut in_tests = false;
            for line in text.lines() {
                if line.contains("mod tests") {
                    in_tests = true;
                }
                if in_tests {
                    continue;
                }
                if line.contains("todo!()") || line.contains("unreachable!()") {
                    found += 1;
                }
            }
        }
        if found > *budget {
            report.push(format!(
                "{path}: {found} panic sites, budget {budget} — a new one was added"
            ));
        } else if found < *budget {
            report.push(format!(
                "{path}: {found} panic sites, budget {budget} — lower the budget in this test"
            ));
        }
    }
    assert!(report.is_empty(), "{}", report.join("\n"));
}
