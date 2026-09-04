//! A chart's data range is held by cell id, so it follows the cells the way
//! the chart's own anchor does — and the file has to end up saying where they
//! went.
//!
//! Before this, the range was the `Sheet1!$B$2:$E$2` text OOXML stores and
//! nothing rewrote it: a row inserted above the data moved the values down
//! while the text stayed put, so the chart resolved a range of empty cells and
//! rendered blank. The engine's rule everywhere else is that positions exist
//! only at the edges — ids in the middle — and charts were the exception.

use std::io::Read;

use logisheets::Workbook;
use logisheets_controller::edit_action::{EditAction, EditPayload, InsertRows, PayloadsAction};

fn chart_part(bytes: &[u8], name: &str) -> Vec<u8> {
    let mut zip = zip::ZipArchive::new(std::io::Cursor::new(bytes.to_vec())).unwrap();
    let mut f = zip.by_name(name).unwrap();
    let mut out = Vec::new();
    f.read_to_end(&mut out).unwrap();
    out
}

/// A chart nobody disturbed goes back out untouched, so saving does not
/// rewrite every chart part in the workbook — the regeneration is triggered by
/// the range having actually moved, not by the feature existing.
#[test]
fn an_untouched_chart_part_is_byte_identical_across_saves() {
    let buf = std::fs::read("tests/graph.xlsx").unwrap();
    let wb = Workbook::from_file(&buf, "graph".to_string()).unwrap();
    let first = wb.save().unwrap();
    let wb2 = Workbook::from_file(&first, "again".to_string()).unwrap();
    let second = wb2.save().unwrap();
    assert_eq!(
        chart_part(&first, "xl/charts/chart1.xml"),
        chart_part(&second, "xl/charts/chart1.xml"),
    );
}

/// ...and one whose cells moved is rewritten, with the new range in it.
#[test]
fn a_moved_range_is_written_into_the_chart_part() {
    let buf = std::fs::read("tests/graph.xlsx").unwrap();
    let mut wb = Workbook::from_file(&buf, "graph".to_string()).unwrap();
    let before = chart_part(&wb.save().unwrap(), "xl/charts/chart1.xml");

    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::InsertRows(InsertRows {
            sheet_idx: 0,
            start: 0,
            count: 1,
        })],
        undoable: false,
        init: false,
    }));
    let after = chart_part(&wb.save().unwrap(), "xl/charts/chart1.xml");

    assert_ne!(before, after, "the part was regenerated");
    let text = String::from_utf8_lossy(&after);
    assert!(
        text.contains("Sheet1!$B$3:$E$3"),
        "the new range is in the file: {text}"
    );
    assert!(
        !text.contains("Sheet1!$B$2:$E$2"),
        "and the stale one is gone"
    );
}

/// The sheet is part of the range's identity too, so renaming it re-points the
/// chart. Previously the reference held the old name as text and the chart
/// went blank the moment a sheet was renamed.
#[test]
fn renaming_a_sheet_re_points_its_charts() {
    use logisheets_controller::edit_action::SheetRename;

    let buf = std::fs::read("tests/graph.xlsx").unwrap();
    let mut wb = Workbook::from_file(&buf, "graph".to_string()).unwrap();
    let values = wb.get_sheet_by_idx(0).unwrap().get_charts()[0].series[0]
        .values
        .clone();

    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![EditPayload::SheetRename(SheetRename {
            old_name: Some("Sheet1".to_string()),
            idx: None,
            new_name: "Q1 Data".to_string(),
        })],
        undoable: false,
        init: false,
    }));

    let ws = wb.get_sheet_by_idx(0).unwrap();
    let c = &ws.get_charts()[0];
    assert_eq!(
        c.series[0].val_ref.as_deref(),
        Some("'Q1 Data'!$B$2:$E$2"),
        "the new name, quoted because it has a space"
    );
    assert_eq!(c.series[0].values, values, "and it still reads the data");
}
