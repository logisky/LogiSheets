//! The drawable chartEx kinds, reduced to what is plotted.
//!
//! `tests/chart_ex_kinds.xlsx` (from `tests/gen/chart_ex_kinds.py`) holds one
//! chart of each kind over a small table. Every expected number below is
//! worked out by hand from that table with Excel's rules — `QUARTILE.EXC`
//! for the boxes, right-closed bins, a Pareto sorted descending — so a
//! regression in the statistics shows up as a wrong number, not a crash.

use logisheets::Workbook;
use logisheets_controller::controller::display::{ChartExInfo, ChartInfo};
use logisheets_controller::edit_action::{
    CellInput, EditAction, EditPayload, InsertRows, PayloadsAction, StatusCode,
};

fn load() -> Workbook {
    let buf = std::fs::read("tests/chart_ex_kinds.xlsx").unwrap();
    Workbook::from_file(&buf, "kinds".to_string()).unwrap()
}

fn charts(wb: &Workbook) -> Vec<ChartInfo> {
    wb.get_sheet_by_idx(0).unwrap().get_charts()
}

fn ex(wb: &Workbook, id: &str) -> ChartExInfo {
    charts(wb)
        .into_iter()
        .find(|c| c.chart_id == id)
        .unwrap_or_else(|| panic!("{id} not loaded"))
        .ex
        .unwrap_or_else(|| panic!("{id} has nothing to draw"))
}

fn apply(wb: &mut Workbook, payload: EditPayload) {
    let status = wb
        .handle_action(EditAction::Payloads(PayloadsAction {
            payloads: vec![payload],
            undoable: true,
            init: false,
        }))
        .status;
    assert!(matches!(status, StatusCode::Ok(_)), "{status:?}");
}

#[test]
fn every_kind_loads_and_is_drawable() {
    let wb = load();
    let kinds: Vec<(String, Option<String>)> = charts(&wb)
        .into_iter()
        .map(|c| (c.chart_id, c.ex.map(|e| e.kind)))
        .collect();
    assert_eq!(
        kinds,
        vec![
            ("chartEx1".into(), Some("treemap".into())),
            ("chartEx2".into(), Some("sunburst".into())),
            ("chartEx3".into(), Some("funnel".into())),
            ("chartEx4".into(), Some("boxWhisker".into())),
            ("chartEx5".into(), Some("histogram".into())),
            ("chartEx6".into(), Some("pareto".into())),
            ("chartEx7".into(), Some("waterfall".into())),
        ]
    );
}

#[test]
fn a_treemap_sums_cities_into_regions() {
    let t = ex(&load(), "chartEx1");
    assert_eq!(t.title.as_deref(), Some("Sales by region"));
    let node = |name: &str| t.nodes.iter().find(|n| n.name == name).unwrap();
    assert_eq!(node("East").value, 80.0);
    assert_eq!(node("West").value, 40.0);
    assert_eq!(node("North").value, 70.0);
    assert_eq!(node("South").value, 35.0);
    assert_eq!(node("East").parent, None);
    let east = t.nodes.iter().position(|n| n.name == "East").unwrap() as u32;
    assert_eq!(node("Shanghai").parent, Some(east));
    assert_eq!(node("Shanghai").value, 40.0);
}

#[test]
fn a_funnel_and_a_waterfall_read_their_steps() {
    let wb = load();
    let f = ex(&wb, "chartEx3");
    assert_eq!(
        f.categories,
        vec!["Visits", "Signups", "Trials", "Paid", "Renewed"]
    );
    assert_eq!(f.values, vec![1000.0, 600.0, 300.0, 120.0, 80.0]);

    let w = ex(&wb, "chartEx7");
    assert_eq!(
        w.categories,
        vec!["Start", "Sales", "Refunds", "Costs", "End"]
    );
    assert_eq!(w.values, vec![100.0, 40.0, -15.0, -30.0, 95.0]);
    assert_eq!(w.subtotals, vec![4]);
}

#[test]
fn box_and_whisker_groups_by_category_with_exclusive_quartiles() {
    let b = ex(&load(), "chartEx4");
    assert!(b.show_mean && b.show_outliers);
    let boxes = &b.box_series[0].boxes;
    let cats: Vec<&str> = boxes.iter().map(|b| b.category.as_str()).collect();
    assert_eq!(cats, vec!["East", "West", "North", "South"]);
    // East {12, 15, 18}: ranks 1, 2, 3 under QUARTILE.EXC.
    let e = &boxes[0];
    assert_eq!((e.q1, e.median, e.q3), (12.0, 15.0, 18.0));
    assert_eq!(e.mean, 15.0);
    // West {22, 25}: q1 clamps to the low end, median interpolates.
    let w = &boxes[1];
    assert_eq!((w.q1, w.median, w.q3), (22.0, 23.5, 25.0));
}

#[test]
fn a_histogram_splits_the_scores_into_four_bins() {
    let h = ex(&load(), "chartEx5");
    assert_eq!(
        h.categories,
        vec!["[12, 31.5]", "(31.5, 51]", "(51, 70.5]", "(70.5, 90]"]
    );
    assert_eq!(h.values, vec![6.0, 1.0, 0.0, 1.0]);
}

#[test]
fn a_pareto_sorts_cities_and_accumulates_their_share() {
    let p = ex(&load(), "chartEx6");
    assert_eq!(p.categories[0], "Beijing");
    assert_eq!(p.values[..3], [50.0, 40.0, 35.0]);
    assert_eq!(p.values.len(), 8);
    assert!((p.cumulative_percent[0] - 50.0 / 225.0 * 100.0).abs() < 1e-9);
    assert_eq!(*p.cumulative_percent.last().unwrap(), 100.0);
}

#[test]
fn a_chart_ex_follows_its_cells() {
    let mut wb = load();
    // C2 is Shanghai's sales.
    apply(
        &mut wb,
        EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row: 1,
            col: 2,
            content: "100".to_string(),
        }),
    );
    let t = ex(&wb, "chartEx1");
    assert_eq!(
        t.nodes.iter().find(|n| n.name == "East").unwrap().value,
        140.0
    );

    // A row above the data moves it; the ranges are held by cell id.
    apply(
        &mut wb,
        EditPayload::InsertRows(InsertRows {
            sheet_idx: 0,
            start: 0,
            count: 2,
        }),
    );
    let t = ex(&wb, "chartEx1");
    assert_eq!(
        t.nodes.iter().find(|n| n.name == "East").unwrap().value,
        140.0
    );
    let f = ex(&wb, "chartEx3");
    assert_eq!(f.values, vec![1000.0, 600.0, 300.0, 120.0, 80.0]);
}
