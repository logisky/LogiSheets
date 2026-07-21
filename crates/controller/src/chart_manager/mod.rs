//! Stores charts anchored on worksheets.
//!
//! A chart is anchored by its two corner cells (`from`/`to`) as stable
//! `CellId`s — like [`crate::image_manager`] — so it rides along when rows or
//! columns are inserted or deleted. `data` is the render-ready view parsed from
//! the chart's OOXML; `raw` keeps the original chart part bytes (chart XML plus
//! its style/color satellites) so the chart round-trips losslessly on save. The
//! raw bytes sit behind an `Arc` so the persistent (imbl) map stays cheap to
//! clone for undo/redo snapshots.
//!
//! The source of truth for a chart's definition is its Excel-native OOXML
//! (`c:chartSpace`), not this struct: `data` is derived for rendering and may be
//! lossy, while `raw` is authoritative for persistence.

pub mod executor;

pub use executor::ChartExecutor;

use std::sync::Arc;

use imbl::{HashMap, Vector};
use logisheets_base::{CellId, SheetId};
use logisheets_workbook::prelude::{ChartData, PassthroughPart};

/// A chart anchor corner: a stable cell plus an EMU offset into that cell.
#[derive(Debug, Clone)]
pub struct ChartMarker {
    pub cell: CellId,
    pub col_off: i64,
    pub row_off: i64,
}

#[derive(Debug, Clone)]
pub struct Chart {
    /// Stable id (currently the chart part's file stem, e.g. `chart1`).
    pub id: String,
    pub from: ChartMarker,
    pub to: ChartMarker,
    /// Workbook-absolute path of this chart's own part, e.g.
    /// `xl/charts/chart1.xml` — the drawing's `graphicFrame` references it.
    pub part_path: String,
    /// Render-ready view parsed from the chart OOXML.
    pub data: ChartData,
    /// Original chart part tree (chart XML + style/color satellites) preserved
    /// verbatim for lossless save. Behind an `Arc` to keep snapshots cheap.
    pub raw: Arc<Vec<PassthroughPart>>,
}

#[derive(Debug, Clone, Default)]
pub struct ChartManager {
    pub charts: HashMap<SheetId, Vector<Chart>>,
}

impl ChartManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add(&mut self, sheet_id: SheetId, chart: Chart) {
        let mut v = self.charts.get(&sheet_id).cloned().unwrap_or_default();
        v.push_back(chart);
        self.charts.insert(sheet_id, v);
    }

    /// All charts on a sheet, in stored order.
    pub fn charts_of_sheet(&self, sheet_id: SheetId) -> Vec<Chart> {
        self.charts
            .get(&sheet_id)
            .map(|v| v.iter().cloned().collect())
            .unwrap_or_default()
    }

    /// Re-anchor the chart with `chart_id` on `sheet_id`. Returns whether a
    /// matching chart was found and updated.
    pub fn move_chart(
        &mut self,
        sheet_id: SheetId,
        chart_id: &str,
        from: ChartMarker,
        to: ChartMarker,
    ) -> bool {
        let mut v = match self.charts.get(&sheet_id) {
            Some(v) => v.clone(),
            None => return false,
        };
        let idx = v.iter().position(|c| c.id == chart_id);
        let idx = match idx {
            Some(i) => i,
            None => return false,
        };
        let mut chart = v[idx].clone();
        chart.from = from;
        chart.to = to;
        v.set(idx, chart);
        self.charts.insert(sheet_id, v);
        true
    }

    /// Replace a chart's parsed data + raw parts (e.g. after regenerating the
    /// chart XML for a type/title change), keeping its id, anchor, and path.
    pub fn update_content(
        &mut self,
        sheet_id: SheetId,
        chart_id: &str,
        data: ChartData,
        raw: Arc<Vec<PassthroughPart>>,
    ) -> bool {
        let mut v = match self.charts.get(&sheet_id) {
            Some(v) => v.clone(),
            None => return false,
        };
        let idx = match v.iter().position(|c| c.id == chart_id) {
            Some(i) => i,
            None => return false,
        };
        let mut chart = v[idx].clone();
        chart.data = data;
        chart.raw = raw;
        v.set(idx, chart);
        self.charts.insert(sheet_id, v);
        true
    }

    /// Remove the chart with `chart_id` from `sheet_id`. Returns whether it
    /// existed.
    pub fn remove_chart(&mut self, sheet_id: SheetId, chart_id: &str) -> bool {
        let mut v = match self.charts.get(&sheet_id) {
            Some(v) => v.clone(),
            None => return false,
        };
        let idx = match v.iter().position(|c| c.id == chart_id) {
            Some(i) => i,
            None => return false,
        };
        v.remove(idx);
        self.charts.insert(sheet_id, v);
        true
    }
}
