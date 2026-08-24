//! Every `.xlsx` in `tests/` must survive load-then-save.
//!
//! This is the cheapest bug-finder in the repo. One run over the corpus found
//! pivot tables dropped, WPS cell images deleted, and eight misspelled element
//! names — and unlike a hand-authored fixture it uses files real producers
//! wrote, so it keeps finding things as the corpus grows. Adding a file to
//! `tests/` is the whole cost of extending it.
//!
//! Three properties, each of which has already been violated:
//!   * no zip entry disappears — a part we do not model is not ours to delete;
//!   * no `.rels` file repeats a relationship Id — that makes the package
//!     invalid, and it happened the moment preserved ids met minted ones;
//!   * what we wrote can be read again.
//!
//! Deliberate, characterised exceptions are listed below rather than silently
//! tolerated. A new loss fails the test.

use logisheets::Workbook;
use std::collections::{HashMap, HashSet};
use std::io::{Cursor, Read};

/// Entries a file is allowed to lose, with the reason. Anything else is a bug.
fn allowed_losses(file: &str) -> &'static [&'static str] {
    match file {
        // A note is up-converted to a threaded comment: the text, the anchor and
        // the author all survive (the author in `xl/persons/person.xml`), under
        // the modern part names. The legacy part is therefore not written.
        "default_ns_drawing.xlsx" | "one_cell_anchor.xlsx" => &["xl/comments/comment1.xml"],
        // WPS anchors its in-cell images with blip-less `<xdr:pic>` placeholders.
        // The images themselves round-trip (see `cellimages.xml`); the empty
        // drawing does not, because nothing is loaded from it and the save only
        // emits a drawing when there is something to put in one.
        "7.xlsx" => &[
            "xl/drawings/drawing1.xml",
            "xl/worksheets/_rels/sheet1.xml.rels",
        ],
        _ => &[],
    }
}

fn entries(bytes: &[u8]) -> HashMap<String, Vec<u8>> {
    let mut zip = zip::ZipArchive::new(Cursor::new(bytes.to_vec())).expect("a zip");
    let mut out = HashMap::new();
    for i in 0..zip.len() {
        let mut f = zip.by_index(i).unwrap();
        let name = f.name().to_string();
        if name.ends_with('/') {
            continue;
        }
        let mut buf = Vec::new();
        let _ = f.read_to_end(&mut buf);
        out.insert(name, buf);
    }
    out
}

#[test]
fn every_corpus_file_round_trips() {
    let mut checked = 0;
    let mut failures = Vec::<String>::new();
    for entry in std::fs::read_dir("tests").expect("tests dir") {
        let path = entry.expect("dir entry").path();
        if path.extension().and_then(|e| e.to_str()) != Some("xlsx") {
            continue;
        }
        let file = path
            .file_name()
            .and_then(|f| f.to_str())
            .unwrap_or("")
            .to_string();
        let mut buf = std::fs::read(&path).expect("read fixture");
        let before = entries(&buf);

        let wb = match Workbook::from_file(&mut buf, file.clone()) {
            Ok(wb) => wb,
            Err(e) => {
                failures.push(format!("{file}: load failed: {e:?}"));
                continue;
            }
        };
        let saved = match wb.save() {
            Ok(s) => s,
            Err(e) => {
                failures.push(format!("{file}: save failed: {e:?}"));
                continue;
            }
        };
        checked += 1;
        let after = entries(&saved);

        let allowed: HashSet<&str> = allowed_losses(&file).iter().copied().collect();
        let mut lost: Vec<&String> = before
            .keys()
            .filter(|k| !after.contains_key(*k) && !allowed.contains(k.as_str()))
            .collect();
        lost.sort();
        if !lost.is_empty() {
            failures.push(format!("{file}: dropped {lost:?}"));
        }
        // An exception that no longer applies is also worth knowing about: it
        // means the fix landed and the list should shrink.
        for a in allowed.iter() {
            if before.contains_key(*a) && after.contains_key(*a) {
                failures.push(format!(
                    "{file}: {a} is listed as an allowed loss but now survives — \
                     remove it from `allowed_losses`"
                ));
            }
        }

        for (name, data) in after.iter() {
            if !name.ends_with(".rels") {
                continue;
            }
            let xml = String::from_utf8_lossy(data);
            let mut ids: Vec<&str> = xml
                .match_indices("Id=\"")
                .map(|(at, _)| {
                    let rest = &xml[at + 4..];
                    &rest[..rest.find('"').unwrap_or(0)]
                })
                .collect();
            let total = ids.len();
            ids.sort_unstable();
            ids.dedup();
            if ids.len() != total {
                failures.push(format!("{file}: {name} repeats a relationship Id"));
            }
        }

        let mut again = saved.clone();
        if let Err(e) = Workbook::from_file(&mut again, file.clone()) {
            failures.push(format!("{file}: could not reopen what we wrote: {e:?}"));
        }
    }
    assert!(checked > 0, "no fixtures found — is the corpus gone?");
    assert!(
        failures.is_empty(),
        "{} of {} corpus files regressed:\n  {}",
        failures.len(),
        checked,
        failures.join("\n  ")
    );
}
