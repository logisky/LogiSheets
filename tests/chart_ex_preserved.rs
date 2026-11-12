//! A chartEx chart (waterfall, treemap, histogram, …) is kept, not dropped.
//!
//! These charts live in their own part (`xl/charts/chartExN.xml`), reached
//! through a relationship type the reader did not follow, from an anchor Excel
//! wraps in `mc:AlternateContent` — which the drawing model skipped. So the
//! chart never loaded, and a save wrote a file without it: opening a workbook
//! and saving it deleted every waterfall in it.
//!
//! Now such a chart loads as a preserved chart: placed, moved, deleted and
//! saved like any other, its part written back byte for byte, drawn as a
//! placeholder. `tests/chart_ex.xlsx` is `graph.xlsx` plus a hand-built
//! waterfall (see `tests/gen/chart_ex.py`), next to the classic chart.

use std::io::Read;

use logisheets::Workbook;
use logisheets_controller::edit_action::{
    DeleteChart, EditAction, EditPayload, InsertRows, MoveChart, PayloadsAction, StatusCode,
    UpdateChart,
};

const FIXTURE: &str = "tests/chart_ex.xlsx";

fn part(bytes: &[u8], name: &str) -> Option<Vec<u8>> {
    let mut zip = zip::ZipArchive::new(std::io::Cursor::new(bytes.to_vec())).unwrap();
    let mut f = zip.by_name(name).ok()?;
    let mut out = Vec::new();
    f.read_to_end(&mut out).unwrap();
    Some(out)
}

fn text(bytes: &[u8], name: &str) -> String {
    String::from_utf8(part(bytes, name).unwrap_or_else(|| panic!("{name} missing"))).unwrap()
}

fn load() -> Workbook {
    let buf = std::fs::read(FIXTURE).unwrap();
    Workbook::from_file(&buf, "chart_ex".to_string()).unwrap()
}

fn apply(wb: &mut Workbook, payload: EditPayload) -> StatusCode {
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![payload],
        undoable: true,
        init: false,
    }))
    .status
}

#[test]
fn a_chart_ex_loads_as_a_preserved_chart_beside_the_classic_one() {
    let wb = load();
    let charts = wb.get_sheet_by_idx(0).unwrap().get_charts();
    assert_eq!(charts.len(), 2, "both charts load");

    let ex = charts.iter().find(|c| c.chart_id == "chartEx1").unwrap();
    assert_eq!(ex.preserved_kind.as_deref(), Some("waterfall"));
    assert_eq!((ex.from_row, ex.from_col), (16, 7));
    assert_eq!((ex.to_row, ex.to_col), (30, 13));
    assert!(ex.series.is_empty(), "nothing is plotted for it");

    let classic = charts.iter().find(|c| c.chart_id == "chart1").unwrap();
    assert_eq!(classic.preserved_kind, None);
    assert!(!classic.series.is_empty(), "the classic chart is untouched");
}

#[test]
fn a_chart_ex_survives_a_save_byte_for_byte() {
    let original = std::fs::read(FIXTURE).unwrap();
    let saved = load().save().unwrap();

    for name in [
        "xl/charts/chartEx1.xml",
        "xl/charts/style2.xml",
        "xl/charts/colors2.xml",
    ] {
        assert_eq!(part(&saved, name), part(&original, name), "{name}");
    }
    // Relationship files are always re-serialized, so compare what they say.
    let rels = text(&saved, "xl/charts/_rels/chartEx1.xml.rels");
    assert!(
        rels.contains(r#"Target="style2.xml""#) && rels.contains(r#"Target="colors2.xml""#),
        "{rels}"
    );

    let drawing = text(&saved, "xl/drawings/drawing1.xml");
    assert!(drawing.contains("<mc:AlternateContent"), "{drawing}");
    assert!(drawing.contains(r#"Requires="cx1""#), "{drawing}");
    // `Requires` names a prefix, so it must be declared where it is used.
    assert!(
        drawing.contains(
            r#"xmlns:cx1="http://schemas.microsoft.com/office/drawing/2015/9/8/chartex""#
        ),
        "{drawing}"
    );
    assert!(
        drawing.contains(r#"uri="http://schemas.microsoft.com/office/drawing/2014/chartex""#),
        "{drawing}"
    );
    assert!(
        drawing.contains("isn't available in your version of Excel"),
        "the fallback older readers show is kept: {drawing}"
    );

    // The anchor's `cx:chart r:id` resolves to the chartEx part.
    let at = drawing.find("<cx:chart ").unwrap();
    let rid = drawing[at..]
        .split("r:id=\"")
        .nth(1)
        .and_then(|s| s.split('"').next())
        .unwrap()
        .to_string();
    let rels = text(&saved, "xl/drawings/_rels/drawing1.xml.rels");
    let rel = rels
        .split("<Relationship ")
        .find(|r| r.contains(&format!(r#"Id="{rid}""#)))
        .unwrap_or_else(|| panic!("{rid} not in {rels}"));
    assert!(
        rel.contains("http://schemas.microsoft.com/office/2014/relationships/chartEx"),
        "{rel}"
    );
    assert!(rel.contains("../charts/chartEx1.xml"), "{rel}");

    let ct = text(&saved, "[Content_Types].xml");
    assert!(
        ct.contains(
            r#"PartName="/xl/charts/chartEx1.xml" ContentType="application/vnd.ms-office.chartex+xml""#
        ),
        "{ct}"
    );
}

#[test]
fn a_saved_chart_ex_reloads_as_the_same_preserved_chart() {
    let first = load().save().unwrap();
    let wb = Workbook::from_file(&first, "again".to_string()).unwrap();
    let second = wb.save().unwrap();
    let charts = wb.get_sheet_by_idx(0).unwrap().get_charts();
    let ex = charts.iter().find(|c| c.chart_id == "chartEx1").unwrap();
    assert_eq!(ex.preserved_kind.as_deref(), Some("waterfall"));
    assert_eq!(
        part(&first, "xl/drawings/drawing1.xml"),
        part(&second, "xl/drawings/drawing1.xml"),
        "the drawing is stable across saves"
    );
}

#[test]
fn a_chart_ex_moves_and_follows_inserted_rows() {
    let mut wb = load();
    let status = apply(
        &mut wb,
        EditPayload::MoveChart(MoveChart {
            sheet_idx: 0,
            chart_id: "chartEx1".to_string(),
            from_row: 20,
            from_col: 2,
            from_col_off: 0,
            from_row_off: 0,
            to_row: 34,
            to_col: 8,
            to_col_off: 0,
            to_row_off: 0,
        }),
    );
    assert!(matches!(status, StatusCode::Ok(_)), "{status:?}");
    let status = apply(
        &mut wb,
        EditPayload::InsertRows(InsertRows {
            sheet_idx: 0,
            start: 0,
            count: 2,
        }),
    );
    assert!(matches!(status, StatusCode::Ok(_)), "{status:?}");

    let charts = wb.get_sheet_by_idx(0).unwrap().get_charts();
    let ex = charts.iter().find(|c| c.chart_id == "chartEx1").unwrap();
    assert_eq!((ex.from_row, ex.from_col), (22, 2));
    assert_eq!((ex.to_row, ex.to_col), (36, 8));

    let drawing = text(&wb.save().unwrap(), "xl/drawings/drawing1.xml");
    let at = drawing.find("<mc:AlternateContent").unwrap();
    let anchor_start = drawing[..at].rfind("<xdr:twoCellAnchor").unwrap();
    let anchor = &drawing[anchor_start..at];
    assert!(
        anchor.contains("<xdr:row>22</xdr:row>") && anchor.contains("<xdr:row>36</xdr:row>"),
        "the new position is saved: {anchor}"
    );
}

#[test]
fn deleting_a_chart_ex_removes_its_parts_and_leaves_the_classic_chart() {
    let mut wb = load();
    let status = apply(
        &mut wb,
        EditPayload::DeleteChart(DeleteChart {
            sheet_idx: 0,
            chart_id: "chartEx1".to_string(),
        }),
    );
    assert!(matches!(status, StatusCode::Ok(_)), "{status:?}");
    let saved = wb.save().unwrap();

    // Each chart carries only its own part tree; if the classic chart still
    // carried every chart part of the drawing, these would outlive the delete.
    for name in [
        "xl/charts/chartEx1.xml",
        "xl/charts/style2.xml",
        "xl/charts/colors2.xml",
    ] {
        assert!(part(&saved, name).is_none(), "{name} should be gone");
    }
    assert!(part(&saved, "xl/charts/chart1.xml").is_some());
    let drawing = text(&saved, "xl/drawings/drawing1.xml");
    assert!(!drawing.contains("AlternateContent"), "{drawing}");
    assert!(!text(&saved, "[Content_Types].xml").contains("chartEx1"));
}

#[test]
fn editing_a_chart_ex_is_refused_and_changes_nothing() {
    let mut wb = load();
    let status = apply(
        &mut wb,
        EditPayload::UpdateChart(UpdateChart {
            sheet_idx: 0,
            chart_id: "chartEx1".to_string(),
            title: Some("Renamed".to_string()),
            ..Default::default()
        }),
    );
    assert!(matches!(status, StatusCode::Err(_)), "{status:?}");

    let original = std::fs::read(FIXTURE).unwrap();
    let saved = wb.save().unwrap();
    assert_eq!(
        part(&saved, "xl/charts/chartEx1.xml"),
        part(&original, "xl/charts/chartEx1.xml"),
        "a regenerated part would have replaced the waterfall with an empty chart"
    );
}
