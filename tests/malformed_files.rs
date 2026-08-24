//! A broken file must be REFUSED or degraded, never crash the loader.
//!
//! Everything the loader reads is a file someone else wrote, and the parts do
//! not have to agree with each other: a cell can name a shared string that is
//! not in the table, `<sheetDataSet>` can be wider than `<sheetNames>`, an
//! `<externalLink>` can hold a `<ddeLink>` where we look for `<externalBook>`.
//! Each of those was an `.unwrap()`, so a workbook with one bad byte in it took
//! the whole load down — and in the wasm build that surfaces as a panic in the
//! console rather than as an error anyone can act on.
//!
//! So this corrupts a real file in each of the ways the format allows and asks
//! only that we come back. Refusing the file is a fine answer; a wrong value in
//! one cell is a fine answer; unwinding is not. What each corruption is, and
//! what it stands for, is written next to it.

use std::io::{Cursor, Read, Write};

/// Rewrite one zip entry, leaving the rest of the package alone.
fn patch(bytes: &[u8], edits: &[(&str, Option<String>)]) -> Vec<u8> {
    let mut zip = zip::ZipArchive::new(Cursor::new(bytes.to_vec())).expect("a zip");
    let mut out = Vec::new();
    {
        let mut w = zip::ZipWriter::new(Cursor::new(&mut out));
        for i in 0..zip.len() {
            let mut f = zip.by_index(i).expect("entry");
            let name = f.name().to_string();
            if name.ends_with('/') {
                continue;
            }
            let mut data = Vec::new();
            f.read_to_end(&mut data).expect("read");
            let replacement = edits.iter().find(|(n, _)| *n == name);
            let data = match replacement {
                // `None` means drop the part entirely.
                Some((_, None)) => continue,
                Some((_, Some(text))) => text.clone().into_bytes(),
                None => data,
            };
            w.start_file(
                name,
                zip::write::FileOptions::default()
                    .compression_method(zip::CompressionMethod::Deflated),
            )
            .expect("start");
            w.write_all(&data).expect("write");
        }
        w.finish().expect("finish");
    }
    out
}

const SHEET_HEAD: &str = concat!(
    r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>"#,
    r#"<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">"#,
    "<sheetData>"
);
const SHEET_TAIL: &str = "</sheetData></worksheet>";

fn sheet(rows: &str) -> String {
    format!("{SHEET_HEAD}{rows}{SHEET_TAIL}")
}

#[test]
fn a_malformed_file_never_panics() {
    let base = std::fs::read("tests/calc_test.xlsx").expect("a corpus file to corrupt");
    const SHEET1: &str = "xl/worksheets/sheet1.xml";
    const SST: &str = "xl/sharedStrings.xml";

    let cases: Vec<(&str, Vec<(&str, Option<String>)>)> = vec![
        (
            // A shared-string index past the end of the table. The table is not
            // indexed by anything the file checks.
            "shared-string index out of range",
            vec![(
                SHEET1,
                Some(sheet(r#"<row r="1"><c r="A1" t="s"><v>99999</v></c></row>"#)),
            )],
        ),
        (
            // Cells claim shared strings and the table is not in the package.
            "shared-string table missing entirely",
            vec![
                (
                    SHEET1,
                    Some(sheet(r#"<row r="1"><c r="A1" t="s"><v>0</v></c></row>"#)),
                ),
                (SST, None),
            ],
        ),
        (
            // A negative index, which is not even the right type.
            "shared-string index is not a count",
            vec![(
                SHEET1,
                Some(sheet(r#"<row r="1"><c r="A1" t="s"><v>-3</v></c></row>"#)),
            )],
        ),
        (
            // Unbalanced parentheses: no parser accepts this.
            "formula that cannot be parsed",
            vec![(
                SHEET1,
                Some(sheet(r#"<row r="1"><c r="A1"><f>SUM(((</f><v>0</v></c></row>"#)),
            )],
        ),
        (
            // A function nobody has: the file may come from a newer Excel.
            "formula calling an unknown function",
            vec![(
                SHEET1,
                Some(sheet(
                    r#"<row r="1"><c r="A1"><f>NOSUCHFUNC(1,2)</f><v>7</v></c></row>"#,
                )),
            )],
        ),
        (
            // A reference to a sheet that is not in this workbook.
            "formula referring to a missing sheet",
            vec![(
                SHEET1,
                Some(sheet(
                    r#"<row r="1"><c r="A1"><f>Nope!A1+1</f><v>1</v></c></row>"#,
                )),
            )],
        ),
        (
            // Past the grid: a column label longer than any that exists.
            "cell reference beyond the sheet",
            vec![(
                SHEET1,
                Some(sheet(r#"<row r="1"><c r="ZZZZ9999999"><v>1</v></c></row>"#)),
            )],
        ),
        (
            // Rows are 1-based, so row 0 does not exist.
            "row index zero",
            vec![(
                SHEET1,
                Some(sheet(r#"<row r="0"><c r="A0"><v>1</v></c></row>"#)),
            )],
        ),
        (
            // A style index with no style behind it.
            "style index out of range",
            vec![(
                SHEET1,
                Some(sheet(r#"<row r="1"><c r="A1" s="9999"><v>1</v></c></row>"#)),
            )],
        ),
        (
            // Cut off mid-element.
            "truncated worksheet",
            vec![(SHEET1, Some(format!("{SHEET_HEAD}<row r=\"1\"><c r=\"A")))],
        ),
        (
            "not XML at all",
            vec![(SHEET1, Some(String::from("this is not xml")))],
        ),
        (
            "empty worksheet part",
            vec![(SHEET1, Some(String::new()))],
        ),
        (
            // The part every load starts from.
            "workbook part missing",
            vec![("xl/workbook.xml", None)],
        ),
        (
            "relationships missing",
            vec![("xl/_rels/workbook.xml.rels", None)],
        ),
        (
            "content types missing",
            vec![("[Content_Types].xml", None)],
        ),
    ];

    // A panic prints its own message, which would bury the report below.
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(|_| {}));
    let mut crashed = Vec::<&str>::new();
    for (label, edits) in &cases {
        let bytes = patch(&base, edits);
        let outcome = std::panic::catch_unwind(move || {
            let mut buf = bytes;
            match logisheets::Workbook::from_file(&mut buf, "broken".to_string()) {
                // Loading is allowed to succeed; then reading has to be safe
                // too, since that is where a half-built model would show up.
                Ok(wb) => {
                    if let Ok(sheet) = wb.get_sheet_by_idx(0) {
                        let _ = sheet.get_value(0, 0);
                        let _ = sheet.get_formula(0, 0);
                        let _ = sheet.get_style(0, 0);
                    }
                    let _ = wb.save();
                }
                Err(_) => {}
            }
        });
        if outcome.is_err() {
            crashed.push(label);
        }
    }
    std::panic::set_hook(previous);

    assert!(
        crashed.is_empty(),
        "{} of {} malformed files panicked instead of being refused:\n  {}",
        crashed.len(),
        cases.len(),
        crashed.join("\n  ")
    );
}
