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

pub mod block_source;
pub mod executor;
pub mod refs;

pub use block_source::{ResolvedBlockRefs, resolve_block_refs};
pub use executor::ChartExecutor;
pub use refs::{ChartRange, ChartRefs, ChartSeriesRefs};

use std::sync::Arc;

use imbl::{HashMap, Vector};
use logisheets_base::{BlockId, CellId, SheetId};
use logisheets_workbook::prelude::{ChartData, PassthroughPart};

/// A chart anchor corner: a stable cell plus an EMU offset into that cell.
#[derive(Debug, Clone)]
pub struct ChartMarker {
    pub cell: CellId,
    pub col_off: i64,
    pub row_off: i64,
}

/// How far a chart's frame reaches from its `from` corner.
///
/// The file has two anchor elements for this and a chart keeps the one it
/// arrived with. A `oneCellAnchor` has no second cell at all, so giving it a
/// synthesised `to` would be both a lie and unstable — it would drift the first
/// time a row was inserted between the invented corners.
#[derive(Debug, Clone)]
pub enum ChartExtent {
    /// `twoCellAnchor`: a second corner that moves with its cell.
    ToCell(ChartMarker),
    /// `oneCellAnchor`: a fixed size in EMUs.
    Size { cx: i64, cy: i64 },
}

/// A chart whose ranges are a block's, not a fixed rectangle.
///
/// Charts normally carry A1 text (`Sheet1!$B$2:$B$5`), which is what OOXML
/// stores and all Excel understands. That is a snapshot: append a record to the
/// block and it falls outside the range. A block already knows its own extent
/// and where each field lives, so a chart bound to one states *what* to plot
/// and lets the block say *where* — the range is recomputed on every read and
/// every save, so it grows and shifts with the block for free.
///
/// Fields are held by name, the same identity `#FIELD("qty")` formulas use, so
/// inserting or moving a column inside the block keeps the link. Renaming a
/// field breaks it, exactly as it breaks those formulas.
#[derive(Debug, Clone, PartialEq)]
pub struct ChartBlockSource {
    pub block_id: BlockId,
    /// Field whose values label the category axis. `None` numbers the
    /// categories 1..n instead.
    pub category_field: Option<String>,
    /// Fields plotted as series, in series order.
    pub value_fields: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct Chart {
    /// Stable id (currently the chart part's file stem, e.g. `chart1`).
    pub id: String,
    pub from: ChartMarker,
    pub extent: ChartExtent,
    /// Workbook-absolute path of this chart's own part, e.g.
    /// `xl/charts/chart1.xml` — the drawing's `graphicFrame` references it.
    pub part_path: String,
    /// Render-ready view parsed from the chart OOXML.
    pub data: ChartData,
    /// Original chart part tree (chart XML + style/color satellites) preserved
    /// verbatim for lossless save. Behind an `Arc` to keep snapshots cheap.
    pub raw: Arc<Vec<PassthroughPart>>,
    /// Set when the chart plots a block rather than a fixed range. The refs in
    /// `data` are then a cache of the last resolution, not the truth — see
    /// [`ChartBlockSource`].
    pub source: Option<ChartBlockSource>,
    /// The data ranges, held by cell id so they ride along with row and column
    /// edits the way the anchor does. The A1 text in `data` is the fallback for
    /// a range whose corner has been deleted. See [`refs`].
    pub refs: ChartRefs,
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

    /// All charts on a sheet, in stored order, borrowed.
    ///
    /// Deliberately not `Vec<Chart>`: a `Chart` carries its parsed data and
    /// every preserved XML subtree, so cloning the list is far from free — and
    /// the read paths (rendering, saving, looking one up) only need a look.
    pub fn charts_of_sheet(&self, sheet_id: SheetId) -> impl Iterator<Item = &Chart> {
        self.charts
            .get(&sheet_id)
            .into_iter()
            .flat_map(|v| v.iter())
    }

    /// Re-anchor the chart with `chart_id` on `sheet_id`. Returns whether a
    /// matching chart was found and updated.
    pub fn move_chart(
        &mut self,
        sheet_id: SheetId,
        chart_id: &str,
        from: ChartMarker,
        extent: ChartExtent,
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
        chart.extent = extent;
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
        refs: ChartRefs,
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
        chart.refs = refs;
        v.set(idx, chart);
        self.charts.insert(sheet_id, v);
        true
    }

    /// Replace a chart's id-based ranges.
    pub fn set_refs(&mut self, sheet_id: SheetId, chart_id: &str, refs: ChartRefs) -> bool {
        let mut v = match self.charts.get(&sheet_id) {
            Some(v) => v.clone(),
            None => return false,
        };
        let idx = match v.iter().position(|c| c.id == chart_id) {
            Some(i) => i,
            None => return false,
        };
        let mut chart = v[idx].clone();
        chart.refs = refs;
        v.set(idx, chart);
        self.charts.insert(sheet_id, v);
        true
    }

    /// Bind (or, with `None`, unbind) a chart's block source. Returns whether
    /// a matching chart was found.
    pub fn set_source(
        &mut self,
        sheet_id: SheetId,
        chart_id: &str,
        source: Option<ChartBlockSource>,
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
        chart.source = source;
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
