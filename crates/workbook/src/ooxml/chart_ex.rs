//! Read-only model of a chartEx part (`xl/charts/chartExN.xml`, root
//! `cx:chartSpace`): the Excel 2016 chart family — treemap, sunburst, funnel,
//! box & whisker, histogram, Pareto, waterfall, filled map.
//!
//! Only what drawing the chart needs is typed: the data dimensions, the
//! title, and each series' layout and layout properties. Nothing here is ever
//! written back — a chartEx part is saved verbatim (see `PreservedChart` in
//! the controller), so the model may be as partial as reading requires.
//!
//! A chartEx chart keeps its data apart from its series: `cx:chartData` holds
//! numbered `cx:data` blocks of dimensions (`cat`, `val`, `size`, …), and a
//! series names the block it plots with `cx:dataId`.

use xmlserde_derives::XmlDeserialize;

use crate::xml_deserialize_from_str;

/// A chartEx chart, resolved enough to draw.
#[derive(Debug, Clone, Default)]
pub struct ChartExData {
    pub title: Option<String>,
    pub series: Vec<ChartExSeries>,
}

#[derive(Debug, Clone, Default)]
pub struct ChartExSeries {
    /// `layoutId`: `treemap`, `sunburst`, `funnel`, `boxWhisker`,
    /// `clusteredColumn` (a histogram, or a Pareto's bars), `paretoLine`,
    /// `waterfall`, `regionMap`.
    pub layout: String,
    /// The series name as cached in the file; `name_ref` is where it lives.
    pub name: Option<String>,
    pub name_ref: Option<String>,
    /// `ownerIdx`: a Pareto line names the bar series it accumulates.
    pub owner: Option<u32>,
    pub hidden: bool,
    /// The dimensions of the data block this series plots.
    pub dims: Vec<ChartExDim>,
    /// Waterfall: indices of the points drawn as totals from zero.
    pub subtotals: Vec<u32>,
    /// Histogram / Pareto over numbers: how values fall into bins.
    pub binning: Option<ChartExBinning>,
    /// Histogram / Pareto over categories: sum the values per category
    /// instead of binning them.
    pub aggregation: bool,
    /// Box & whisker: `QUARTILE.INC` rather than Excel's default
    /// `QUARTILE.EXC`.
    pub quartile_inclusive: bool,
    /// Box & whisker: draw the mean marker, and the outlier points.
    pub show_mean: bool,
    pub show_outliers: bool,
}

/// One dimension of a data block — a category list or a value list.
#[derive(Debug, Clone, Default)]
pub struct ChartExDim {
    /// `cat`, `val`, `size`, `x`, `y`, `colorVal`, …
    pub ty: String,
    pub is_num: bool,
    /// The range it reads, e.g. `Sheet1!$A$2:$B$9`. Several columns mean
    /// several levels of a hierarchy, outermost on the left.
    pub formula: Option<String>,
    /// The cached values, one list per level, INNERMOST first — the order
    /// `cx:lvl` is written in. Each list is indexed by point.
    pub levels: Vec<Vec<Option<String>>>,
    pub format_code: Option<String>,
}

impl ChartExDim {
    pub fn cached_numbers(&self) -> Vec<Option<f64>> {
        self.levels
            .first()
            .map(|l| {
                l.iter()
                    .map(|v| v.as_deref().and_then(|s| s.trim().parse::<f64>().ok()))
                    .collect()
            })
            .unwrap_or_default()
    }
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct ChartExBinning {
    /// `intervalClosed="l"`: bins are `[a, b)` rather than the default
    /// `(a, b]`.
    pub closed_left: bool,
    /// A fixed edge below which every value shares one bin; `None` is `auto`.
    pub underflow: Option<f64>,
    /// A fixed edge above which every value shares one bin.
    pub overflow: Option<f64>,
    pub bin_size: Option<f64>,
    pub bin_count: Option<u32>,
}

/// Parse a chartEx part. `None` when the bytes are not a chartEx chart space
/// at all; a part this reads but cannot fully interpret still yields its
/// series, so a caller decides what it can draw.
pub fn parse_chart_ex(bytes: &[u8]) -> Option<ChartExData> {
    let text = std::str::from_utf8(bytes).ok()?;
    let space = xml_deserialize_from_str::<CxChartSpace>(text).ok()?;
    let blocks = space.chart_data.map(|d| d.data).unwrap_or_default();
    let chart = space.chart?;
    let title = chart.title.and_then(|t| t.tx).and_then(|tx| tx.text());
    let series = chart
        .plot_area
        .and_then(|p| p.region)
        .map(|r| r.series)
        .unwrap_or_default()
        .into_iter()
        .map(|s| {
            let data_id = s.data_id.as_ref().and_then(|d| d.val.parse::<u32>().ok());
            let dims = data_id
                .and_then(|id| blocks.iter().find(|b| b.id == id))
                .map(|b| {
                    b.str_dims
                        .iter()
                        .map(|d| d.to_dim(false))
                        .chain(b.num_dims.iter().map(|d| d.to_dim(true)))
                        .collect()
                })
                .unwrap_or_default();
            let pr = s.layout_pr.unwrap_or_default();
            let vis = pr.visibility.unwrap_or_default();
            ChartExSeries {
                layout: s.layout_id,
                name: s.tx.as_ref().and_then(|t| t.text()),
                name_ref: s
                    .tx
                    .as_ref()
                    .and_then(|t| t.tx_data.as_ref())
                    .and_then(|d| d.f.as_ref())
                    .map(|f| f.val.clone()),
                owner: s.owner_idx,
                hidden: s.hidden.unwrap_or(false),
                dims,
                subtotals: pr
                    .subtotals
                    .map(|s| s.idx.iter().filter_map(|i| i.val.parse().ok()).collect())
                    .unwrap_or_default(),
                binning: pr.binning.map(|b| ChartExBinning {
                    closed_left: b.interval_closed.as_deref() == Some("l"),
                    underflow: b.underflow.as_deref().and_then(|v| v.parse().ok()),
                    overflow: b.overflow.as_deref().and_then(|v| v.parse().ok()),
                    bin_size: b.bin_size.and_then(|v| v.val.parse().ok()),
                    bin_count: b.bin_count.and_then(|v| v.val.parse().ok()),
                }),
                aggregation: pr.aggregation.is_some(),
                quartile_inclusive: pr.statistics.and_then(|s| s.quartile_method).as_deref()
                    == Some("inclusive"),
                show_mean: vis.mean_marker.unwrap_or(true),
                show_outliers: vis.outliers.unwrap_or(true),
            }
        })
        .collect();
    Some(ChartExData { title, series })
}

// --- XML shape -------------------------------------------------------------

#[derive(Debug, XmlDeserialize)]
#[xmlserde(root = b"cx:chartSpace")]
struct CxChartSpace {
    #[xmlserde(name = b"cx:chartData", ty = "child")]
    chart_data: Option<CxChartData>,
    #[xmlserde(name = b"cx:chart", ty = "child")]
    chart: Option<CxChart>,
}

#[derive(Debug, XmlDeserialize)]
struct CxChartData {
    #[xmlserde(name = b"cx:data", ty = "child")]
    data: Vec<CxData>,
}

#[derive(Debug, XmlDeserialize)]
struct CxData {
    #[xmlserde(name = b"id", ty = "attr")]
    id: u32,
    #[xmlserde(name = b"cx:strDim", ty = "child")]
    str_dims: Vec<CxDim>,
    #[xmlserde(name = b"cx:numDim", ty = "child")]
    num_dims: Vec<CxDim>,
}

#[derive(Debug, XmlDeserialize)]
struct CxDim {
    #[xmlserde(name = b"type", ty = "attr")]
    ty: String,
    #[xmlserde(name = b"cx:f", ty = "child")]
    f: Option<CxText>,
    #[xmlserde(name = b"cx:lvl", ty = "child")]
    lvls: Vec<CxLvl>,
}

impl CxDim {
    fn to_dim(&self, is_num: bool) -> ChartExDim {
        ChartExDim {
            ty: self.ty.clone(),
            is_num,
            formula: self.f.as_ref().map(|f| f.val.clone()),
            levels: self
                .lvls
                .iter()
                .map(|l| {
                    let n = l.pt_count.map(|c| c as usize).unwrap_or_else(|| {
                        l.pts.iter().map(|p| p.idx as usize + 1).max().unwrap_or(0)
                    });
                    let mut out = vec![None; n];
                    for p in l.pts.iter() {
                        if let Some(slot) = out.get_mut(p.idx as usize) {
                            *slot = Some(p.val.clone());
                        }
                    }
                    out
                })
                .collect(),
            format_code: self.lvls.first().and_then(|l| l.format_code.clone()),
        }
    }
}

#[derive(Debug, XmlDeserialize)]
struct CxLvl {
    #[xmlserde(name = b"ptCount", ty = "attr")]
    pt_count: Option<u32>,
    #[xmlserde(name = b"formatCode", ty = "attr")]
    format_code: Option<String>,
    #[xmlserde(name = b"cx:pt", ty = "child")]
    pts: Vec<CxPt>,
}

#[derive(Debug, XmlDeserialize)]
struct CxPt {
    #[xmlserde(name = b"idx", ty = "attr")]
    idx: u32,
    #[xmlserde(ty = "text")]
    val: String,
}

#[derive(Debug, XmlDeserialize)]
struct CxText {
    #[xmlserde(ty = "text")]
    val: String,
}

#[derive(Debug, XmlDeserialize)]
struct CxChart {
    #[xmlserde(name = b"cx:title", ty = "child")]
    title: Option<CxTitle>,
    #[xmlserde(name = b"cx:plotArea", ty = "child")]
    plot_area: Option<CxPlotArea>,
}

#[derive(Debug, XmlDeserialize)]
struct CxTitle {
    #[xmlserde(name = b"cx:tx", ty = "child")]
    tx: Option<CxTx>,
}

/// Text that is either a literal / cell reference (`cx:txData`) or rich text
/// (`cx:rich`, DrawingML paragraphs), which is what Excel writes for a title
/// the user typed.
#[derive(Debug, XmlDeserialize)]
struct CxTx {
    #[xmlserde(name = b"cx:txData", ty = "child")]
    tx_data: Option<CxTxData>,
    #[xmlserde(name = b"cx:rich", ty = "child")]
    rich: Option<CxRich>,
}

impl CxTx {
    fn text(&self) -> Option<String> {
        if let Some(v) = self.tx_data.as_ref().and_then(|d| d.v.as_ref()) {
            return Some(v.val.clone());
        }
        let rich = self.rich.as_ref()?;
        let s = rich
            .paragraphs
            .iter()
            .map(|p| {
                p.runs
                    .iter()
                    .map(|r| r.t.as_ref().map(|t| t.val.as_str()).unwrap_or(""))
                    .collect::<String>()
            })
            .collect::<Vec<_>>()
            .join("\n");
        Some(s).filter(|s| !s.is_empty())
    }
}

#[derive(Debug, XmlDeserialize)]
struct CxTxData {
    #[xmlserde(name = b"cx:f", ty = "child")]
    f: Option<CxText>,
    #[xmlserde(name = b"cx:v", ty = "child")]
    v: Option<CxText>,
}

#[derive(Debug, XmlDeserialize)]
struct CxRich {
    #[xmlserde(name = b"a:p", ty = "child")]
    paragraphs: Vec<AParagraph>,
}

#[derive(Debug, XmlDeserialize)]
struct AParagraph {
    #[xmlserde(name = b"a:r", ty = "child")]
    runs: Vec<ARun>,
}

#[derive(Debug, XmlDeserialize)]
struct ARun {
    #[xmlserde(name = b"a:t", ty = "child")]
    t: Option<CxText>,
}

#[derive(Debug, XmlDeserialize)]
struct CxPlotArea {
    #[xmlserde(name = b"cx:plotAreaRegion", ty = "child")]
    region: Option<CxPlotAreaRegion>,
}

#[derive(Debug, XmlDeserialize)]
struct CxPlotAreaRegion {
    #[xmlserde(name = b"cx:series", ty = "child")]
    series: Vec<CxSeries>,
}

#[derive(Debug, XmlDeserialize)]
struct CxSeries {
    #[xmlserde(name = b"layoutId", ty = "attr")]
    layout_id: String,
    #[xmlserde(name = b"hidden", ty = "attr")]
    hidden: Option<bool>,
    #[xmlserde(name = b"ownerIdx", ty = "attr")]
    owner_idx: Option<u32>,
    #[xmlserde(name = b"cx:tx", ty = "child")]
    tx: Option<CxTx>,
    #[xmlserde(name = b"cx:dataId", ty = "child")]
    data_id: Option<CxVal>,
    #[xmlserde(name = b"cx:layoutPr", ty = "child")]
    layout_pr: Option<CxLayoutPr>,
}

#[derive(Debug, XmlDeserialize)]
struct CxVal {
    #[xmlserde(name = b"val", ty = "attr")]
    val: String,
}

#[derive(Debug, Default, XmlDeserialize)]
struct CxLayoutPr {
    #[xmlserde(name = b"cx:subtotals", ty = "child")]
    subtotals: Option<CxSubtotals>,
    #[xmlserde(name = b"cx:binning", ty = "child")]
    binning: Option<CxBinning>,
    #[xmlserde(name = b"cx:aggregation", ty = "child")]
    aggregation: Option<CxEmpty>,
    #[xmlserde(name = b"cx:statistics", ty = "child")]
    statistics: Option<CxStatistics>,
    #[xmlserde(name = b"cx:visibility", ty = "child")]
    visibility: Option<CxVisibility>,
}

#[derive(Debug, XmlDeserialize)]
struct CxSubtotals {
    #[xmlserde(name = b"cx:idx", ty = "child")]
    idx: Vec<CxVal>,
}

#[derive(Debug, XmlDeserialize)]
struct CxBinning {
    #[xmlserde(name = b"intervalClosed", ty = "attr")]
    interval_closed: Option<String>,
    #[xmlserde(name = b"underflow", ty = "attr")]
    underflow: Option<String>,
    #[xmlserde(name = b"overflow", ty = "attr")]
    overflow: Option<String>,
    #[xmlserde(name = b"cx:binSize", ty = "child")]
    bin_size: Option<CxVal>,
    #[xmlserde(name = b"cx:binCount", ty = "child")]
    bin_count: Option<CxVal>,
}

#[derive(Debug, XmlDeserialize)]
struct CxEmpty {}

#[derive(Debug, XmlDeserialize)]
struct CxStatistics {
    #[xmlserde(name = b"quartileMethod", ty = "attr")]
    quartile_method: Option<String>,
}

#[derive(Debug, Default, XmlDeserialize)]
struct CxVisibility {
    #[xmlserde(name = b"meanMarker", ty = "attr")]
    mean_marker: Option<bool>,
    #[xmlserde(name = b"outliers", ty = "attr")]
    outliers: Option<bool>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn part(name: &str) -> Vec<u8> {
        use std::io::Read;
        let buf = std::fs::read("../../tests/chart_ex_kinds.xlsx").unwrap();
        let mut zip = zip::ZipArchive::new(std::io::Cursor::new(buf)).unwrap();
        let mut f = zip.by_name(name).unwrap();
        let mut out = Vec::new();
        f.read_to_end(&mut out).unwrap();
        out
    }

    #[test]
    fn a_treemap_reads_its_hierarchy_and_sizes() {
        let d = parse_chart_ex(&part("xl/charts/chartEx1.xml")).unwrap();
        assert_eq!(d.title.as_deref(), Some("Sales by region"));
        let s = &d.series[0];
        assert_eq!(s.layout, "treemap");
        assert_eq!(s.name.as_deref(), Some("Sales"));
        let cat = s.dims.iter().find(|d| d.ty == "cat").unwrap();
        assert_eq!(cat.formula.as_deref(), Some("Sheet1!$A$2:$B$9"));
        assert_eq!(cat.levels.len(), 2);
        assert_eq!(
            cat.levels[0][0].as_deref(),
            Some("Shanghai"),
            "innermost first"
        );
        assert_eq!(cat.levels[1][0].as_deref(), Some("East"));
        let size = s.dims.iter().find(|d| d.ty == "size").unwrap();
        assert!(size.is_num);
        assert_eq!(size.cached_numbers()[0], Some(40.0));
    }

    #[test]
    fn layout_properties_are_read() {
        let bw = parse_chart_ex(&part("xl/charts/chartEx4.xml")).unwrap();
        let s = &bw.series[0];
        assert!(!s.quartile_inclusive);
        assert!(s.show_mean && s.show_outliers);

        let hist = parse_chart_ex(&part("xl/charts/chartEx5.xml")).unwrap();
        let b = hist.series[0].binning.clone().unwrap();
        assert_eq!(b.bin_count, Some(4));
        assert!(!b.closed_left);

        let pareto = parse_chart_ex(&part("xl/charts/chartEx6.xml")).unwrap();
        assert!(pareto.series[0].aggregation);
        assert_eq!(pareto.series[1].layout, "paretoLine");
        assert_eq!(pareto.series[1].owner, Some(0));

        let wf = parse_chart_ex(&part("xl/charts/chartEx7.xml")).unwrap();
        assert_eq!(wf.series[0].subtotals, vec![4]);
    }
}
