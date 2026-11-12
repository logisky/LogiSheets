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

use super::xml_tree::{XDoc, XElement};
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
    /// The `cx:data` block this series plots. Series may share one — a
    /// Pareto line plots its bars' block.
    pub data_id: Option<u32>,
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
                data_id,
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

/// Rewrite a chartEx part so it says what `data` says, touching only what
/// differs from the part as it is.
///
/// The part is edited in place, not regenerated: everything the model does
/// not cover — styling, data labels, axes, extensions — is written back as it
/// came. What can change is the title, each data dimension's range, and the
/// layout properties an editor exposes (waterfall totals, histogram binning,
/// box & whisker statistics and markers).
///
/// A dimension whose range changes loses its cached values (`cx:lvl`): they
/// describe the old range, the schema makes them optional, and Excel fills
/// them from the formula on open. A title becomes plain text, which drops
/// the formatting of a rich title.
///
/// `None` when the part does not parse.
pub fn write_chart_ex(original: &[u8], data: &ChartExData) -> Option<Vec<u8>> {
    let old = parse_chart_ex(original)?;
    let mut doc = XDoc::parse(original)?;
    let chart = doc.root.child_mut("cx:chart")?;

    if old.title != data.title {
        match &data.title {
            None => chart.remove_children("cx:title"),
            Some(t) => {
                let tx = text_tx(t);
                match chart.child_mut("cx:title") {
                    Some(title) => {
                        title.remove_children("cx:tx");
                        title.insert_ordered(tx, &["cx:tx", "cx:spPr", "cx:txPr", "cx:extLst"]);
                    }
                    None => {
                        let mut title = XElement::with(
                            "cx:title",
                            &[("pos", "t"), ("align", "ctr"), ("overlay", "0")],
                            None,
                        );
                        title.children.push(super::xml_tree::XNode::El(tx));
                        chart.insert_ordered(
                            title,
                            &["cx:title", "cx:plotArea", "cx:legend", "cx:extLst"],
                        );
                    }
                }
            }
        }
    }

    let series_els: Vec<usize> = chart
        .child("cx:plotArea")
        .and_then(|p| p.child("cx:plotAreaRegion"))
        .map(|r| (0..r.children_named("cx:series").count()).collect())
        .unwrap_or_default();
    for (i, (was, now)) in old.series.iter().zip(data.series.iter()).enumerate() {
        if !series_els.contains(&i) || !layout_differs(was, now) {
            continue;
        }
        let Some(el) = chart
            .child_mut("cx:plotArea")
            .and_then(|p| p.child_mut("cx:plotAreaRegion"))
            .and_then(|r| r.children_named_mut("cx:series").nth(i))
        else {
            continue;
        };
        patch_layout(el, was, now);
    }

    // Dimensions live in the data blocks, which series share; each block is
    // patched once, from the first series that plots it.
    let mut done: Vec<u32> = Vec::new();
    for now in data.series.iter() {
        let Some(id) = now.data_id else { continue };
        if done.contains(&id) {
            continue;
        }
        done.push(id);
        let was = old
            .series
            .iter()
            .find(|s| s.data_id == Some(id))
            .map(|s| s.dims.as_slice())
            .unwrap_or(&[]);
        let Some(block) = doc.root.child_mut("cx:chartData").and_then(|d| {
            d.children_named_mut("cx:data")
                .find(|b| b.attr("id") == Some(id.to_string()))
        }) else {
            continue;
        };
        patch_dims(block, was, &now.dims);
    }
    Some(doc.to_bytes())
}

fn text_tx(t: &str) -> XElement {
    let mut tx = XElement::new("cx:tx");
    let mut td = XElement::new("cx:txData");
    td.children.push(super::xml_tree::XNode::El(XElement::with(
        "cx:v",
        &[],
        Some(t),
    )));
    tx.children.push(super::xml_tree::XNode::El(td));
    tx
}

fn dim_tag(is_num: bool) -> &'static str {
    if is_num { "cx:numDim" } else { "cx:strDim" }
}

fn patch_dims(block: &mut XElement, was: &[ChartExDim], now: &[ChartExDim]) {
    let same = |a: &ChartExDim, b: &ChartExDim| a.is_num == b.is_num && a.ty == b.ty;
    // Gone from the model: remove the element.
    for d in was.iter().filter(|d| !now.iter().any(|n| same(n, d))) {
        let tag = dim_tag(d.is_num);
        let ty = d.ty.clone();
        block.children.retain(|c| {
            !matches!(c, super::xml_tree::XNode::El(e) if e.name() == tag && e.attr("type").as_deref() == Some(ty.as_str()))
        });
    }
    for d in now.iter() {
        let tag = dim_tag(d.is_num);
        match was.iter().find(|w| same(w, d)) {
            Some(w) if w.formula == d.formula => {}
            Some(_) => {
                let Some(el) = block
                    .children_named_mut(tag)
                    .find(|e| e.attr("type").as_deref() == Some(d.ty.as_str()))
                else {
                    continue;
                };
                el.remove_children("cx:lvl");
                el.remove_children("cx:f");
                if let Some(f) = &d.formula {
                    el.insert_ordered(
                        XElement::with("cx:f", &[], Some(f)),
                        &["cx:f", "cx:nf", "cx:lvl", "cx:extLst"],
                    );
                }
            }
            None => {
                let mut el = XElement::with(tag, &[("type", d.ty.as_str())], None);
                if let Some(f) = &d.formula {
                    el.children.push(super::xml_tree::XNode::El(XElement::with(
                        "cx:f",
                        &[],
                        Some(f),
                    )));
                }
                // Categories first, values after, as Excel writes a block.
                if d.is_num {
                    block.children.push(super::xml_tree::XNode::El(el));
                } else {
                    block.children.insert(0, super::xml_tree::XNode::El(el));
                }
            }
        }
    }
}

fn layout_differs(a: &ChartExSeries, b: &ChartExSeries) -> bool {
    a.subtotals != b.subtotals
        || a.binning != b.binning
        || a.quartile_inclusive != b.quartile_inclusive
        || a.show_mean != b.show_mean
        || a.show_outliers != b.show_outliers
}

/// `CT_SeriesLayoutProperties`' child order.
const LAYOUT_PR_ORDER: &[&str] = &[
    "cx:parentLabelLayout",
    "cx:regionLabelLayout",
    "cx:visibility",
    "cx:aggregation",
    "cx:binning",
    "cx:geography",
    "cx:statistics",
    "cx:subtotals",
    "cx:extLst",
];

fn patch_layout(series: &mut XElement, was: &ChartExSeries, now: &ChartExSeries) {
    if series.child("cx:layoutPr").is_none() {
        series.insert_ordered(
            XElement::new("cx:layoutPr"),
            &[
                "cx:tx",
                "cx:spPr",
                "cx:valueColors",
                "cx:valueColorPositions",
                "cx:dataPt",
                "cx:dataLabels",
                "cx:dataId",
                "cx:layoutPr",
                "cx:axisId",
                "cx:extLst",
            ],
        );
    }
    let Some(pr) = series.child_mut("cx:layoutPr") else {
        return;
    };
    let bit = |b: bool| if b { "1" } else { "0" };
    if was.show_mean != now.show_mean || was.show_outliers != now.show_outliers {
        if pr.child("cx:visibility").is_none() {
            pr.insert_ordered(XElement::new("cx:visibility"), LAYOUT_PR_ORDER);
        }
        if let Some(v) = pr.child_mut("cx:visibility") {
            v.set_attr("meanMarker", bit(now.show_mean));
            v.set_attr("outliers", bit(now.show_outliers));
        }
    }
    if was.binning != now.binning {
        pr.remove_children("cx:binning");
        if let Some(b) = &now.binning {
            let under = b.underflow.map(|v| v.to_string());
            let over = b.overflow.map(|v| v.to_string());
            let mut attrs = vec![("intervalClosed", if b.closed_left { "l" } else { "r" })];
            if let Some(u) = &under {
                attrs.push(("underflow", u.as_str()));
            }
            if let Some(o) = &over {
                attrs.push(("overflow", o.as_str()));
            }
            let mut el = XElement::with("cx:binning", &attrs, None);
            if let Some(size) = b.bin_size {
                el.children.push(super::xml_tree::XNode::El(XElement::with(
                    "cx:binSize",
                    &[("val", &size.to_string())],
                    None,
                )));
            } else if let Some(count) = b.bin_count {
                el.children.push(super::xml_tree::XNode::El(XElement::with(
                    "cx:binCount",
                    &[("val", &count.to_string())],
                    None,
                )));
            }
            pr.insert_ordered(el, LAYOUT_PR_ORDER);
        }
    }
    if was.quartile_inclusive != now.quartile_inclusive {
        if pr.child("cx:statistics").is_none() {
            pr.insert_ordered(XElement::new("cx:statistics"), LAYOUT_PR_ORDER);
        }
        if let Some(st) = pr.child_mut("cx:statistics") {
            st.set_attr(
                "quartileMethod",
                if now.quartile_inclusive {
                    "inclusive"
                } else {
                    "exclusive"
                },
            );
        }
    }
    if was.subtotals != now.subtotals {
        pr.remove_children("cx:subtotals");
        if !now.subtotals.is_empty() {
            let mut el = XElement::new("cx:subtotals");
            for i in now.subtotals.iter() {
                el.children.push(super::xml_tree::XNode::El(XElement::with(
                    "cx:idx",
                    &[("val", &i.to_string())],
                    None,
                )));
            }
            pr.insert_ordered(el, LAYOUT_PR_ORDER);
        }
    }
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

    #[test]
    fn writing_an_unchanged_model_changes_nothing_it_models() {
        let src = part("xl/charts/chartEx1.xml");
        let data = parse_chart_ex(&src).unwrap();
        let out = write_chart_ex(&src, &data).unwrap();
        let again = parse_chart_ex(&out).unwrap();
        assert_eq!(format!("{again:?}"), format!("{data:?}"));
    }

    #[test]
    fn a_new_range_replaces_the_formula_and_drops_the_stale_cache() {
        let src = part("xl/charts/chartEx3.xml");
        let mut data = parse_chart_ex(&src).unwrap();
        let val = data.series[0]
            .dims
            .iter_mut()
            .find(|d| d.ty == "val")
            .unwrap();
        val.formula = Some("Sheet1!$G$2:$G$4".to_string());
        let out = String::from_utf8(write_chart_ex(&src, &data).unwrap()).unwrap();
        assert!(out.contains("<cx:f>Sheet1!$G$2:$G$4</cx:f>"), "{out}");
        let again = parse_chart_ex(out.as_bytes()).unwrap();
        let val = again.series[0].dims.iter().find(|d| d.ty == "val").unwrap();
        assert!(val.levels.is_empty(), "the old range's values are gone");
        let cat = again.series[0].dims.iter().find(|d| d.ty == "cat").unwrap();
        assert_eq!(
            cat.levels[0].len(),
            5,
            "an untouched dimension keeps its cache"
        );
        // Everything outside the edit is as it was.
        assert!(out.contains(r#"<cx:legend pos="t" align="ctr" overlay="0"/>"#));
    }

    #[test]
    fn title_and_layout_edits_land_in_schema_order() {
        let src = part("xl/charts/chartEx4.xml");
        let mut data = parse_chart_ex(&src).unwrap();
        data.title = Some("A & B".to_string());
        data.series[0].quartile_inclusive = true;
        data.series[0].show_outliers = false;
        let out = String::from_utf8(write_chart_ex(&src, &data).unwrap()).unwrap();
        assert!(out.contains("<cx:v>A &amp; B</cx:v>"), "{out}");
        assert!(out.contains(r#"quartileMethod="inclusive""#), "{out}");
        assert!(out.contains(r#"outliers="0""#), "{out}");
        let again = parse_chart_ex(out.as_bytes()).unwrap();
        assert_eq!(again.title.as_deref(), Some("A & B"));
        assert!(again.series[0].quartile_inclusive);
        assert!(!again.series[0].show_outliers);

        // Totals and bins are rewritten whole.
        let wf_src = part("xl/charts/chartEx7.xml");
        let mut wf = parse_chart_ex(&wf_src).unwrap();
        wf.series[0].subtotals = vec![0, 4];
        let wf_out = write_chart_ex(&wf_src, &wf).unwrap();
        assert_eq!(
            parse_chart_ex(&wf_out).unwrap().series[0].subtotals,
            vec![0, 4]
        );

        let h_src = part("xl/charts/chartEx5.xml");
        let mut h = parse_chart_ex(&h_src).unwrap();
        h.series[0].binning = Some(ChartExBinning {
            bin_size: Some(10.0),
            ..Default::default()
        });
        let h_out = String::from_utf8(write_chart_ex(&h_src, &h).unwrap()).unwrap();
        assert!(h_out.contains(r#"<cx:binSize val="10"/>"#), "{h_out}");
        assert!(!h_out.contains("binCount"), "{h_out}");
    }

    #[test]
    fn a_category_range_can_be_added_and_removed() {
        let src = part("xl/charts/chartEx5.xml");
        let mut data = parse_chart_ex(&src).unwrap();
        data.series[0].dims.push(ChartExDim {
            ty: "cat".to_string(),
            formula: Some("Sheet1!$A$2:$A$9".to_string()),
            ..Default::default()
        });
        let out = write_chart_ex(&src, &data).unwrap();
        let again = parse_chart_ex(&out).unwrap();
        let cat = again.series[0].dims.iter().find(|d| d.ty == "cat").unwrap();
        assert_eq!(cat.formula.as_deref(), Some("Sheet1!$A$2:$A$9"));

        let mut back = again.clone();
        back.series[0].dims.retain(|d| d.ty != "cat");
        let out2 = write_chart_ex(&out, &back).unwrap();
        assert!(!String::from_utf8(out2).unwrap().contains("cx:strDim"));
    }
}
