//! Editing a chartEx chart with `UpdateChartEx`.
//!
//! The part is patched, never regenerated: what an edit does not touch goes
//! back out as it came, and a chart nobody edited — and whose cells did not
//! move — is byte-identical after a save. Fixture: `tests/chart_ex_kinds.xlsx`.

use std::io::Read;

use logisheets::Workbook;
use logisheets_controller::controller::display::ChartExInfo;
use logisheets_controller::edit_action::{
    EditAction, EditPayload, InsertRows, PayloadsAction, StatusCode, UpdateChart, UpdateChartEx,
};

fn load(path: &str) -> Workbook {
    let buf = std::fs::read(path).unwrap();
    Workbook::from_file(&buf, "edit".to_string()).unwrap()
}

fn ex(wb: &Workbook, id: &str) -> ChartExInfo {
    wb.get_sheet_by_idx(0)
        .unwrap()
        .get_charts()
        .into_iter()
        .find(|c| c.chart_id == id)
        .and_then(|c| c.ex)
        .unwrap_or_else(|| panic!("{id} has nothing to draw"))
}

fn apply(wb: &mut Workbook, payload: EditPayload) -> StatusCode {
    wb.handle_action(EditAction::Payloads(PayloadsAction {
        payloads: vec![payload],
        undoable: true,
        init: false,
    }))
    .status
}

fn update(id: &str) -> UpdateChartEx {
    UpdateChartEx {
        sheet_idx: 0,
        chart_id: id.to_string(),
        ..Default::default()
    }
}

fn part(bytes: &[u8], name: &str) -> Vec<u8> {
    let mut zip = zip::ZipArchive::new(std::io::Cursor::new(bytes.to_vec())).unwrap();
    let mut f = zip.by_name(name).unwrap();
    let mut out = Vec::new();
    f.read_to_end(&mut out).unwrap();
    out
}

fn text(bytes: &[u8], name: &str) -> String {
    String::from_utf8(part(bytes, name)).unwrap()
}

fn ok(s: StatusCode) {
    assert!(matches!(s, StatusCode::Ok(_)), "{s:?}");
}

#[test]
fn a_title_and_range_edit_draws_now_and_survives_a_save() {
    let mut wb = load("tests/chart_ex_kinds.xlsx");
    ok(apply(
        &mut wb,
        EditPayload::UpdateChartEx(UpdateChartEx {
            title: Some("Top of funnel".to_string()),
            cat_ref: Some("Sheet1!$F$2:$F$4".to_string()),
            val_ref: Some("Sheet1!$G$2:$G$4".to_string()),
            ..update("chartEx3")
        }),
    ));
    let f = ex(&wb, "chartEx3");
    assert_eq!(f.title.as_deref(), Some("Top of funnel"));
    assert_eq!(f.values, vec![1000.0, 600.0, 300.0]);
    assert_eq!(f.val_ref.as_deref(), Some("Sheet1!$G$2:$G$4"));

    let saved = wb.save().unwrap();
    let xml = text(&saved, "xl/charts/chartEx3.xml");
    assert!(xml.contains("<cx:f>Sheet1!$G$2:$G$4</cx:f>"), "{xml}");
    assert!(xml.contains("<cx:v>Top of funnel</cx:v>"), "{xml}");

    let again = Workbook::from_file(&saved, "again".to_string()).unwrap();
    let f = ex(&again, "chartEx3");
    assert_eq!(f.title.as_deref(), Some("Top of funnel"));
    assert_eq!(f.categories, vec!["Visits", "Signups", "Trials"]);
}

#[test]
fn editing_one_chart_leaves_the_others_byte_for_byte() {
    let original = std::fs::read("tests/chart_ex_kinds.xlsx").unwrap();
    let mut wb = load("tests/chart_ex_kinds.xlsx");
    ok(apply(
        &mut wb,
        EditPayload::UpdateChartEx(UpdateChartEx {
            title: Some("Renamed".to_string()),
            ..update("chartEx3")
        }),
    ));
    let saved = wb.save().unwrap();
    for n in [1, 2, 4, 5, 6, 7] {
        let name = format!("xl/charts/chartEx{n}.xml");
        assert_eq!(part(&saved, &name), part(&original, &name), "{name}");
    }
}

#[test]
fn the_saved_file_follows_inserted_rows() {
    let mut wb = load("tests/chart_ex_kinds.xlsx");
    ok(apply(
        &mut wb,
        EditPayload::InsertRows(InsertRows {
            sheet_idx: 0,
            start: 0,
            count: 2,
        }),
    ));
    let saved = wb.save().unwrap();
    let xml = text(&saved, "xl/charts/chartEx1.xml");
    assert!(xml.contains("<cx:f>Sheet1!$A$4:$B$11</cx:f>"), "{xml}");
    assert!(xml.contains("<cx:f>Sheet1!$C$4:$C$11</cx:f>"), "{xml}");
    // The moved dimensions lose their stale caches; the rest of the part —
    // the series name's own reference included — is as it was.
    assert!(!xml.contains("<cx:pt idx=\"0\">Shanghai</cx:pt>"), "{xml}");
    assert!(xml.contains("<cx:v>Sales</cx:v>"), "{xml}");
}

#[test]
fn an_edit_is_undone_like_any_other() {
    let mut wb = load("tests/chart_ex_kinds.xlsx");
    ok(apply(
        &mut wb,
        EditPayload::UpdateChartEx(UpdateChartEx {
            subtotals: Some(vec![0, 4]),
            ..update("chartEx7")
        }),
    ));
    assert_eq!(ex(&wb, "chartEx7").subtotals, vec![0, 4]);
    wb.handle_action(EditAction::Undo);
    assert_eq!(ex(&wb, "chartEx7").subtotals, vec![4]);
}

#[test]
fn each_kind_takes_its_own_settings() {
    let mut wb = load("tests/chart_ex_kinds.xlsx");

    ok(apply(
        &mut wb,
        EditPayload::UpdateChartEx(UpdateChartEx {
            bin_mode: Some("size".to_string()),
            bin_value: Some(40.0),
            ..update("chartEx5")
        }),
    ));
    let h = ex(&wb, "chartEx5");
    assert_eq!(h.bin_mode.as_deref(), Some("size"));
    assert_eq!(h.categories, vec!["[12, 52]", "(52, 92]"]);
    assert_eq!(h.values, vec![7.0, 1.0]);

    ok(apply(
        &mut wb,
        EditPayload::UpdateChartEx(UpdateChartEx {
            quartile_method: Some("inclusive".to_string()),
            show_outliers: Some(false),
            ..update("chartEx4")
        }),
    ));
    let b = ex(&wb, "chartEx4");
    assert_eq!(b.quartile_method.as_deref(), Some("inclusive"));
    assert!(!b.show_outliers);
    // East {12, 15, 18} under QUARTILE.INC: 13.5, 15, 16.5.
    let east = &b.box_series[0].boxes[0];
    assert_eq!((east.q1, east.median, east.q3), (13.5, 15.0, 16.5));

    let saved = wb.save().unwrap();
    let xml = text(&saved, "xl/charts/chartEx5.xml");
    assert!(xml.contains(r#"<cx:binSize val="40"/>"#), "{xml}");
    let xml = text(&saved, "xl/charts/chartEx4.xml");
    assert!(xml.contains(r#"quartileMethod="inclusive""#), "{xml}");
}

#[test]
fn a_setting_that_does_not_fit_the_kind_is_refused() {
    let mut wb = load("tests/chart_ex_kinds.xlsx");
    for bad in [
        UpdateChartEx {
            bin_mode: Some("count".to_string()),
            bin_value: Some(3.0),
            ..update("chartEx7")
        },
        UpdateChartEx {
            subtotals: Some(vec![1]),
            ..update("chartEx5")
        },
        UpdateChartEx {
            bin_mode: Some("count".to_string()),
            bin_value: Some(2.5),
            ..update("chartEx5")
        },
        UpdateChartEx {
            val_ref: Some("not a range".to_string()),
            ..update("chartEx3")
        },
    ] {
        let s = apply(&mut wb, EditPayload::UpdateChartEx(bad.clone()));
        assert!(matches!(s, StatusCode::Err(_)), "{bad:?} was accepted");
    }
    // Nothing above changed anything.
    assert_eq!(ex(&wb, "chartEx7").subtotals, vec![4]);
}

#[test]
fn each_payload_refuses_the_other_familys_charts() {
    let mut wb = load("tests/chart_ex.xlsx");
    let s = apply(
        &mut wb,
        EditPayload::UpdateChartEx(UpdateChartEx {
            title: Some("x".to_string()),
            ..update("chart1")
        }),
    );
    assert!(
        matches!(s, StatusCode::Err(_)),
        "UpdateChartEx on a classic chart"
    );
    let s = apply(
        &mut wb,
        EditPayload::UpdateChart(UpdateChart {
            sheet_idx: 0,
            chart_id: "chartEx1".to_string(),
            title: Some("x".to_string()),
            ..Default::default()
        }),
    );
    assert!(
        matches!(s, StatusCode::Err(_)),
        "UpdateChart on a chartEx chart"
    );
}
