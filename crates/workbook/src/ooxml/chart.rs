//! Structured, parse-only view of a chart part (`xl/charts/chartN.xml`).
//!
//! This models just enough of `c:chartSpace` to render a chart: its type, the
//! data-series references and their cached values, the title, legend position,
//! and axis titles. It is deliberately NOT round-trip: the raw bytes kept in
//! `PassthroughPart` remain the source of truth for saving, so this model only
//! needs to be read. Every field is therefore `Option`/`Vec` — xmlserde panics
//! on a missing *required* child/attr, and unmapped children are simply dropped
//! (which is fine, we never re-serialize this).
//!
//! Matching is by literal `c:`/`a:` prefixes, which is what Excel/WPS emit. A
//! producer using different prefixes or a default namespace would not parse;
//! that is an accepted limitation for now.

use crate::xml_deserialize_from_str;
use xmlserde_derives::XmlDeserialize;

// ---------------------------------------------------------------------------
// Rendering model (the output of `parse_chart`)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq)]
pub enum ChartType {
    Col,
    Bar,
    Line,
    Area,
    Pie,
    Doughnut,
    Scatter,
}

#[derive(Debug, Clone, PartialEq)]
pub enum LegendPos {
    Top,
    Bottom,
    Left,
    Right,
}

/// A series fill color as authored: either a direct RGB hex or a theme scheme
/// color name (e.g. `accent1`). Scheme colors are resolved against the theme by
/// the consumer (the parser has no theme).
#[derive(Debug, Clone, PartialEq)]
pub enum SeriesColor {
    Srgb(String),
    Scheme(String),
}

#[derive(Debug, Clone)]
pub struct ChartSeries {
    /// Series name, resolved from `c:tx` (literal or cached string ref).
    pub name: Option<String>,
    /// The value reference formula, e.g. `Sheet1!$B$2:$E$2`.
    pub val_ref: Option<String>,
    /// Cached numeric values (`c:numCache`), indexed to match `categories`.
    pub cached_values: Vec<Option<f64>>,
    /// Fill color as authored (`c:spPr/a:solidFill`), if any.
    pub color: Option<SeriesColor>,
}

/// A chart resolved into render-ready form.
#[derive(Debug, Clone)]
pub struct ChartData {
    pub chart_type: ChartType,
    pub stacked: bool,
    pub title: Option<String>,
    pub legend_pos: Option<LegendPos>,
    /// Category reference formula (from the first series that has one).
    pub cat_ref: Option<String>,
    /// Cached category labels (`c:cat` string/number cache).
    pub categories: Vec<String>,
    pub series: Vec<ChartSeries>,
    pub cat_axis_title: Option<String>,
    pub val_axis_title: Option<String>,
}

/// Parse a chart part's raw bytes into render-ready [`ChartData`]. Returns
/// `None` if the XML is not valid UTF-8, does not parse, or has no plottable
/// chart-type element.
pub fn parse_chart(bytes: &[u8]) -> Option<ChartData> {
    let text = std::str::from_utf8(bytes).ok()?;
    let space = xml_deserialize_from_str::<CtChartSpace>(text).ok()?;
    let chart = space.chart?;
    let plot = chart.plot_area?;

    let (chart_type, stacked, series_src) = detect_type(&plot)?;

    let title = chart.title.and_then(|t| t.text());
    let legend_pos = chart.legend.and_then(|l| l.pos());
    let (cat_axis_title, val_axis_title) = plot.axis_titles();

    // Categories come from the first series that carries them (`c:cat` for
    // cartesian charts, `c:xVal` for scatter).
    let (cat_ref, categories) = series_src
        .iter()
        .find_map(|s| s.category_source())
        .map(|src| (src.formula(), src.cached_labels()))
        .unwrap_or((None, Vec::new()));

    let series = series_src.iter().map(|s| s.to_series()).collect();

    Some(ChartData {
        chart_type,
        stacked,
        title,
        legend_pos,
        cat_ref,
        categories,
        series,
        cat_axis_title,
        val_axis_title,
    })
}

fn detect_type(plot: &CtPlotArea) -> Option<(ChartType, bool, &Vec<CtSer>)> {
    if let Some(b) = &plot.bar_chart {
        let horizontal = b.bar_dir.as_ref().and_then(|d| d.val.as_deref()) == Some("bar");
        let ty = if horizontal { ChartType::Bar } else { ChartType::Col };
        return Some((ty, is_stacked(b.grouping.as_ref()), &b.ser));
    }
    if let Some(l) = &plot.line_chart {
        return Some((ChartType::Line, is_stacked(l.grouping.as_ref()), &l.ser));
    }
    if let Some(a) = &plot.area_chart {
        return Some((ChartType::Area, is_stacked(a.grouping.as_ref()), &a.ser));
    }
    if let Some(p) = &plot.pie_chart {
        return Some((ChartType::Pie, false, &p.ser));
    }
    if let Some(d) = &plot.doughnut_chart {
        return Some((ChartType::Doughnut, false, &d.ser));
    }
    if let Some(s) = &plot.scatter_chart {
        return Some((ChartType::Scatter, false, &s.ser));
    }
    None
}

fn is_stacked(grouping: Option<&CtStrAttr>) -> bool {
    matches!(
        grouping.and_then(|g| g.val.as_deref()),
        Some("stacked") | Some("percentStacked")
    )
}

// ---------------------------------------------------------------------------
// xmlserde parse structs (subset of c:chartSpace)
// ---------------------------------------------------------------------------

#[derive(Debug, XmlDeserialize, Default)]
#[xmlserde(root = b"c:chartSpace")]
struct CtChartSpace {
    #[xmlserde(name = b"c:chart", ty = "child")]
    chart: Option<CtChart>,
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtChart {
    #[xmlserde(name = b"c:title", ty = "child")]
    title: Option<CtTitle>,
    #[xmlserde(name = b"c:plotArea", ty = "child")]
    plot_area: Option<CtPlotArea>,
    #[xmlserde(name = b"c:legend", ty = "child")]
    legend: Option<CtLegend>,
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtPlotArea {
    #[xmlserde(name = b"c:barChart", ty = "child")]
    bar_chart: Option<CtBarChart>,
    #[xmlserde(name = b"c:lineChart", ty = "child")]
    line_chart: Option<CtGroupedChart>,
    #[xmlserde(name = b"c:areaChart", ty = "child")]
    area_chart: Option<CtGroupedChart>,
    #[xmlserde(name = b"c:pieChart", ty = "child")]
    pie_chart: Option<CtSimpleChart>,
    #[xmlserde(name = b"c:doughnutChart", ty = "child")]
    doughnut_chart: Option<CtSimpleChart>,
    #[xmlserde(name = b"c:scatterChart", ty = "child")]
    scatter_chart: Option<CtSimpleChart>,
    #[xmlserde(name = b"c:catAx", ty = "child")]
    cat_ax: Vec<CtAxis>,
    #[xmlserde(name = b"c:valAx", ty = "child")]
    val_ax: Vec<CtAxis>,
}

impl CtPlotArea {
    /// (category-axis title, value-axis title).
    fn axis_titles(&self) -> (Option<String>, Option<String>) {
        let cat = self.cat_ax.iter().find_map(|a| a.title());
        let val = self.val_ax.iter().find_map(|a| a.title());
        (cat, val)
    }
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtBarChart {
    #[xmlserde(name = b"c:barDir", ty = "child")]
    bar_dir: Option<CtStrAttr>,
    #[xmlserde(name = b"c:grouping", ty = "child")]
    grouping: Option<CtStrAttr>,
    #[xmlserde(name = b"c:ser", ty = "child")]
    ser: Vec<CtSer>,
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtGroupedChart {
    #[xmlserde(name = b"c:grouping", ty = "child")]
    grouping: Option<CtStrAttr>,
    #[xmlserde(name = b"c:ser", ty = "child")]
    ser: Vec<CtSer>,
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtSimpleChart {
    #[xmlserde(name = b"c:ser", ty = "child")]
    ser: Vec<CtSer>,
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtSer {
    #[xmlserde(name = b"c:tx", ty = "child")]
    tx: Option<CtSerTx>,
    #[xmlserde(name = b"c:spPr", ty = "child")]
    sp_pr: Option<CtChartShapeProps>,
    #[xmlserde(name = b"c:cat", ty = "child")]
    cat: Option<CtAxDataSource>,
    #[xmlserde(name = b"c:val", ty = "child")]
    val: Option<CtNumDataSource>,
    #[xmlserde(name = b"c:xVal", ty = "child")]
    x_val: Option<CtAxDataSource>,
    #[xmlserde(name = b"c:yVal", ty = "child")]
    y_val: Option<CtNumDataSource>,
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtChartShapeProps {
    #[xmlserde(name = b"a:solidFill", ty = "child")]
    solid_fill: Option<CtChartSolidFill>,
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtChartSolidFill {
    #[xmlserde(name = b"a:srgbClr", ty = "child")]
    srgb: Option<CtChartColorVal>,
    #[xmlserde(name = b"a:schemeClr", ty = "child")]
    scheme: Option<CtChartColorVal>,
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtChartColorVal {
    #[xmlserde(name = b"val", ty = "attr")]
    val: Option<String>,
}

impl CtChartShapeProps {
    fn color(&self) -> Option<SeriesColor> {
        let fill = self.solid_fill.as_ref()?;
        if let Some(c) = fill.srgb.as_ref().and_then(|c| c.val.clone()) {
            return Some(SeriesColor::Srgb(c));
        }
        if let Some(c) = fill.scheme.as_ref().and_then(|c| c.val.clone()) {
            return Some(SeriesColor::Scheme(c));
        }
        None
    }
}

impl CtSer {
    fn category_source(&self) -> Option<&CtAxDataSource> {
        self.cat.as_ref().or(self.x_val.as_ref())
    }

    fn value_source(&self) -> Option<&CtNumDataSource> {
        self.val.as_ref().or(self.y_val.as_ref())
    }

    fn to_series(&self) -> ChartSeries {
        let name = self.tx.as_ref().and_then(|t| t.name());
        let val = self.value_source();
        ChartSeries {
            name,
            val_ref: val.and_then(|v| v.formula()),
            cached_values: val.map(|v| v.cached_values()).unwrap_or_default(),
            color: self.sp_pr.as_ref().and_then(|p| p.color()),
        }
    }
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtSerTx {
    #[xmlserde(name = b"c:strRef", ty = "child")]
    str_ref: Option<CtStrRef>,
    #[xmlserde(name = b"c:v", ty = "child")]
    v: Option<CtText>,
}

impl CtSerTx {
    fn name(&self) -> Option<String> {
        if let Some(v) = &self.v {
            return non_empty(v.v.clone());
        }
        self.str_ref
            .as_ref()
            .and_then(|r| r.str_cache.as_ref())
            .and_then(|c| c.first_value())
    }
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtNumDataSource {
    #[xmlserde(name = b"c:numRef", ty = "child")]
    num_ref: Option<CtNumRef>,
}

impl CtNumDataSource {
    fn formula(&self) -> Option<String> {
        self.num_ref
            .as_ref()
            .and_then(|r| r.f.as_ref())
            .and_then(|f| non_empty(f.v.clone()))
    }

    fn cached_values(&self) -> Vec<Option<f64>> {
        self.num_ref
            .as_ref()
            .and_then(|r| r.num_cache.as_ref())
            .map(|c| c.values())
            .unwrap_or_default()
    }
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtNumRef {
    #[xmlserde(name = b"c:f", ty = "child")]
    f: Option<CtText>,
    #[xmlserde(name = b"c:numCache", ty = "child")]
    num_cache: Option<CtNumData>,
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtNumData {
    #[xmlserde(name = b"c:ptCount", ty = "child")]
    pt_count: Option<CtU32Attr>,
    #[xmlserde(name = b"c:pt", ty = "child")]
    pts: Vec<CtNumPt>,
}

impl CtNumData {
    /// Dense value vector: length is `ptCount` (or the max index seen), with
    /// each `c:pt idx` slotted into place and gaps left as `None`.
    fn values(&self) -> Vec<Option<f64>> {
        let len = self
            .pt_count
            .as_ref()
            .and_then(|c| c.val)
            .map(|v| v as usize)
            .unwrap_or_else(|| {
                self.pts
                    .iter()
                    .map(|p| p.idx.unwrap_or(0) as usize + 1)
                    .max()
                    .unwrap_or(0)
            });
        let mut out = vec![None; len];
        for (i, pt) in self.pts.iter().enumerate() {
            let idx = pt.idx.unwrap_or(i as u32) as usize;
            if idx < out.len() {
                out[idx] = pt.v.as_ref().and_then(|t| t.v.trim().parse::<f64>().ok());
            }
        }
        out
    }
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtNumPt {
    #[xmlserde(name = b"idx", ty = "attr")]
    idx: Option<u32>,
    #[xmlserde(name = b"c:v", ty = "child")]
    v: Option<CtText>,
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtAxDataSource {
    #[xmlserde(name = b"c:strRef", ty = "child")]
    str_ref: Option<CtStrRef>,
    #[xmlserde(name = b"c:numRef", ty = "child")]
    num_ref: Option<CtNumRef>,
}

impl CtAxDataSource {
    fn formula(&self) -> Option<String> {
        if let Some(r) = &self.str_ref {
            if let Some(f) = &r.f {
                return non_empty(f.v.clone());
            }
        }
        if let Some(r) = &self.num_ref {
            if let Some(f) = &r.f {
                return non_empty(f.v.clone());
            }
        }
        None
    }

    fn cached_labels(&self) -> Vec<String> {
        if let Some(r) = &self.str_ref {
            if let Some(c) = &r.str_cache {
                return c.labels();
            }
        }
        if let Some(r) = &self.num_ref {
            if let Some(c) = &r.num_cache {
                return c
                    .values()
                    .into_iter()
                    .map(|v| v.map(|n| format_num(n)).unwrap_or_default())
                    .collect();
            }
        }
        Vec::new()
    }
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtStrRef {
    #[xmlserde(name = b"c:f", ty = "child")]
    f: Option<CtText>,
    #[xmlserde(name = b"c:strCache", ty = "child")]
    str_cache: Option<CtStrData>,
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtStrData {
    #[xmlserde(name = b"c:ptCount", ty = "child")]
    pt_count: Option<CtU32Attr>,
    #[xmlserde(name = b"c:pt", ty = "child")]
    pts: Vec<CtNumPt>,
}

impl CtStrData {
    fn labels(&self) -> Vec<String> {
        let len = self
            .pt_count
            .as_ref()
            .and_then(|c| c.val)
            .map(|v| v as usize)
            .unwrap_or(self.pts.len());
        let mut out = vec![String::new(); len];
        for (i, pt) in self.pts.iter().enumerate() {
            let idx = pt.idx.unwrap_or(i as u32) as usize;
            if idx < out.len() {
                out[idx] = pt.v.as_ref().map(|t| t.v.clone()).unwrap_or_default();
            }
        }
        out
    }

    fn first_value(&self) -> Option<String> {
        self.pts
            .first()
            .and_then(|p| p.v.as_ref())
            .and_then(|t| non_empty(t.v.clone()))
    }
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtTitle {
    #[xmlserde(name = b"c:tx", ty = "child")]
    tx: Option<CtTx>,
}

impl CtTitle {
    fn text(&self) -> Option<String> {
        self.tx.as_ref().and_then(|tx| tx.text())
    }
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtTx {
    #[xmlserde(name = b"c:rich", ty = "child")]
    rich: Option<CtTextBody>,
    #[xmlserde(name = b"c:strRef", ty = "child")]
    str_ref: Option<CtStrRef>,
}

impl CtTx {
    fn text(&self) -> Option<String> {
        if let Some(r) = &self.rich {
            let s = r.text();
            if !s.is_empty() {
                return Some(s);
            }
        }
        self.str_ref
            .as_ref()
            .and_then(|r| r.str_cache.as_ref())
            .and_then(|c| c.first_value())
    }
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtTextBody {
    #[xmlserde(name = b"a:p", ty = "child")]
    paras: Vec<CtTextPara>,
}

impl CtTextBody {
    fn text(&self) -> String {
        self.paras
            .iter()
            .flat_map(|p| p.runs.iter())
            .filter_map(|r| r.t.as_ref().map(|t| t.v.as_str()))
            .collect::<Vec<_>>()
            .join("")
    }
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtTextPara {
    #[xmlserde(name = b"a:r", ty = "child")]
    runs: Vec<CtTextRun>,
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtTextRun {
    #[xmlserde(name = b"a:t", ty = "child")]
    t: Option<CtText>,
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtLegend {
    #[xmlserde(name = b"c:legendPos", ty = "child")]
    legend_pos: Option<CtStrAttr>,
}

impl CtLegend {
    fn pos(&self) -> Option<LegendPos> {
        match self.legend_pos.as_ref().and_then(|p| p.val.as_deref()) {
            Some("t") => Some(LegendPos::Top),
            Some("b") => Some(LegendPos::Bottom),
            Some("l") => Some(LegendPos::Left),
            Some("r") => Some(LegendPos::Right),
            // "tr" (top-right) and unknowns fall back to right.
            Some("tr") => Some(LegendPos::Right),
            _ => None,
        }
    }
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtAxis {
    #[xmlserde(name = b"c:title", ty = "child")]
    title: Option<CtTitle>,
}

impl CtAxis {
    fn title(&self) -> Option<String> {
        self.title.as_ref().and_then(|t| t.text())
    }
}

// --- small value holders -------------------------------------------------

#[derive(Debug, XmlDeserialize, Default)]
struct CtStrAttr {
    #[xmlserde(name = b"val", ty = "attr")]
    val: Option<String>,
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtU32Attr {
    #[xmlserde(name = b"val", ty = "attr")]
    val: Option<u32>,
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtText {
    #[xmlserde(ty = "text")]
    v: String,
}

fn non_empty(s: String) -> Option<String> {
    if s.trim().is_empty() { None } else { Some(s) }
}

fn format_num(n: f64) -> String {
    if n.fract() == 0.0 {
        format!("{}", n as i64)
    } else {
        format!("{}", n)
    }
}

// ---------------------------------------------------------------------------
// Chart XML generation (authoring new charts)
// ---------------------------------------------------------------------------

/// A series for a newly-created chart: an optional literal name and the value
/// reference formula (e.g. `Sheet1!$B$2:$E$2`).
#[derive(Debug, Clone)]
pub struct NewChartSeries {
    pub name: Option<String>,
    pub value_ref: String,
}

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// Generate a minimal but valid `c:chartSpace` for a new chart. `numCache` is
/// intentionally omitted — values are resolved live from the series references
/// (see `Worksheet::get_charts`), and Excel recomputes the cache on open. The
/// result parses cleanly back through [`parse_chart`].
pub fn build_chart_xml(
    chart_type: &ChartType,
    title: Option<&str>,
    categories_ref: Option<&str>,
    series: &[NewChartSeries],
) -> String {
    const AX_CAT: u64 = 111_111_111;
    const AX_VAL: u64 = 222_222_222;
    let mut s = String::with_capacity(1024);
    s.push_str(r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>"#);
    s.push_str(
        r#"<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:chart>"#,
    );
    match title {
        Some(t) => {
            s.push_str("<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>");
            s.push_str(&xml_escape(t));
            s.push_str("</a:t></a:r></a:p></c:rich></c:tx><c:overlay val=\"0\"/></c:title>");
            s.push_str("<c:autoTitleDeleted val=\"0\"/>");
        }
        None => s.push_str("<c:autoTitleDeleted val=\"1\"/>"),
    }
    s.push_str("<c:plotArea><c:layout/>");

    let is_scatter = matches!(chart_type, ChartType::Scatter);
    let cartesian = matches!(
        chart_type,
        ChartType::Col | ChartType::Bar | ChartType::Line | ChartType::Area
    );

    match chart_type {
        ChartType::Col | ChartType::Bar => {
            let dir = if matches!(chart_type, ChartType::Bar) { "bar" } else { "col" };
            s.push_str("<c:barChart>");
            s.push_str(&format!("<c:barDir val=\"{}\"/>", dir));
            s.push_str("<c:grouping val=\"clustered\"/><c:varyColors val=\"0\"/>");
            push_cartesian_series(&mut s, categories_ref, series);
            s.push_str(&format!("<c:axId val=\"{}\"/><c:axId val=\"{}\"/>", AX_CAT, AX_VAL));
            s.push_str("</c:barChart>");
        }
        ChartType::Line | ChartType::Area => {
            let tag = if matches!(chart_type, ChartType::Area) { "areaChart" } else { "lineChart" };
            s.push_str(&format!("<c:{}>", tag));
            s.push_str("<c:grouping val=\"standard\"/><c:varyColors val=\"0\"/>");
            push_cartesian_series(&mut s, categories_ref, series);
            s.push_str(&format!("<c:axId val=\"{}\"/><c:axId val=\"{}\"/>", AX_CAT, AX_VAL));
            s.push_str(&format!("</c:{}>", tag));
        }
        ChartType::Pie | ChartType::Doughnut => {
            let tag = if matches!(chart_type, ChartType::Doughnut) { "doughnutChart" } else { "pieChart" };
            s.push_str(&format!("<c:{}>", tag));
            s.push_str("<c:varyColors val=\"1\"/>");
            push_cartesian_series(&mut s, categories_ref, series);
            if matches!(chart_type, ChartType::Doughnut) {
                s.push_str("<c:holeSize val=\"50\"/>");
            }
            s.push_str(&format!("</c:{}>", tag));
        }
        ChartType::Scatter => {
            s.push_str("<c:scatterChart><c:scatterStyle val=\"lineMarker\"/><c:varyColors val=\"0\"/>");
            push_scatter_series(&mut s, categories_ref, series);
            s.push_str(&format!("<c:axId val=\"{}\"/><c:axId val=\"{}\"/>", AX_CAT, AX_VAL));
            s.push_str("</c:scatterChart>");
        }
    }

    if cartesian {
        s.push_str(&format!(
            "<c:catAx><c:axId val=\"{}\"/><c:scaling><c:orientation val=\"minMax\"/></c:scaling><c:delete val=\"0\"/><c:axPos val=\"b\"/><c:crossAx val=\"{}\"/></c:catAx>",
            AX_CAT, AX_VAL
        ));
        s.push_str(&format!(
            "<c:valAx><c:axId val=\"{}\"/><c:scaling><c:orientation val=\"minMax\"/></c:scaling><c:delete val=\"0\"/><c:axPos val=\"l\"/><c:crossAx val=\"{}\"/></c:valAx>",
            AX_VAL, AX_CAT
        ));
    } else if is_scatter {
        s.push_str(&format!(
            "<c:valAx><c:axId val=\"{}\"/><c:scaling><c:orientation val=\"minMax\"/></c:scaling><c:delete val=\"0\"/><c:axPos val=\"b\"/><c:crossAx val=\"{}\"/></c:valAx>",
            AX_CAT, AX_VAL
        ));
        s.push_str(&format!(
            "<c:valAx><c:axId val=\"{}\"/><c:scaling><c:orientation val=\"minMax\"/></c:scaling><c:delete val=\"0\"/><c:axPos val=\"l\"/><c:crossAx val=\"{}\"/></c:valAx>",
            AX_VAL, AX_CAT
        ));
    }

    s.push_str("</c:plotArea>");
    s.push_str("<c:legend><c:legendPos val=\"b\"/><c:overlay val=\"0\"/></c:legend>");
    s.push_str("<c:plotVisOnly val=\"1\"/><c:dispBlanksAs val=\"gap\"/>");
    s.push_str("</c:chart></c:chartSpace>");
    s
}

fn push_cartesian_series(s: &mut String, categories_ref: Option<&str>, series: &[NewChartSeries]) {
    for (i, ser) in series.iter().enumerate() {
        s.push_str("<c:ser>");
        s.push_str(&format!("<c:idx val=\"{}\"/><c:order val=\"{}\"/>", i, i));
        if let Some(name) = &ser.name {
            s.push_str("<c:tx><c:v>");
            s.push_str(&xml_escape(name));
            s.push_str("</c:v></c:tx>");
        }
        if let Some(cat) = categories_ref {
            s.push_str("<c:cat><c:strRef><c:f>");
            s.push_str(&xml_escape(cat));
            s.push_str("</c:f></c:strRef></c:cat>");
        }
        s.push_str("<c:val><c:numRef><c:f>");
        s.push_str(&xml_escape(&ser.value_ref));
        s.push_str("</c:f></c:numRef></c:val>");
        s.push_str("</c:ser>");
    }
}

fn push_scatter_series(s: &mut String, x_ref: Option<&str>, series: &[NewChartSeries]) {
    for (i, ser) in series.iter().enumerate() {
        s.push_str("<c:ser>");
        s.push_str(&format!("<c:idx val=\"{}\"/><c:order val=\"{}\"/>", i, i));
        if let Some(name) = &ser.name {
            s.push_str("<c:tx><c:v>");
            s.push_str(&xml_escape(name));
            s.push_str("</c:v></c:tx>");
        }
        if let Some(x) = x_ref {
            s.push_str("<c:xVal><c:numRef><c:f>");
            s.push_str(&xml_escape(x));
            s.push_str("</c:f></c:numRef></c:xVal>");
        }
        s.push_str("<c:yVal><c:numRef><c:f>");
        s.push_str(&xml_escape(&ser.value_ref));
        s.push_str("</c:f></c:numRef></c:yVal>");
        s.push_str("</c:ser>");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_graph_fixture_chart() {
        // chart1.xml from tests/graph.xlsx: a clustered column chart with three
        // series over Sheet1!$B$2:$E$4 and a bottom legend.
        let buf = std::fs::read("../../tests/graph.xlsx").unwrap();
        let wb = crate::workbook::Wb::from_file(&buf).unwrap();
        let chart_bytes = wb
            .xl
            .worksheets
            .values()
            .filter_map(|w| w.drawing.as_ref())
            .flat_map(|d| d.chart_parts.iter())
            .find(|p| p.path.ends_with("chart1.xml"))
            .map(|p| p.data.clone())
            .expect("chart part present");

        let data = parse_chart(&chart_bytes).expect("chart parses");
        assert_eq!(data.chart_type, ChartType::Col);
        assert!(!data.stacked);
        assert_eq!(data.legend_pos, Some(LegendPos::Bottom));
        assert_eq!(data.series.len(), 3);

        let s0 = &data.series[0];
        assert_eq!(s0.val_ref.as_deref(), Some("Sheet1!$B$2:$E$2"));
        assert_eq!(
            s0.cached_values,
            vec![Some(11.0), Some(13.0), Some(15.0), Some(24.0)]
        );
        let s2 = &data.series[2];
        assert_eq!(s2.val_ref.as_deref(), Some("Sheet1!$B$4:$E$4"));
        assert_eq!(
            s2.cached_values,
            vec![Some(23.0), Some(45.0), Some(65.0), Some(25.0)]
        );

        // Series fill colors are scheme colors accent1/2/3 in this fixture.
        assert_eq!(s0.color, Some(SeriesColor::Scheme("accent1".to_string())));
        assert_eq!(
            data.series[1].color,
            Some(SeriesColor::Scheme("accent2".to_string()))
        );
        assert_eq!(s2.color, Some(SeriesColor::Scheme("accent3".to_string())));
    }

    #[test]
    fn build_chart_xml_round_trips_through_parser() {
        let series = vec![
            NewChartSeries {
                name: Some("Revenue".to_string()),
                value_ref: "Sheet1!$B$2:$E$2".to_string(),
            },
            NewChartSeries {
                name: Some("Cost & <fees>".to_string()), // exercises escaping
                value_ref: "Sheet1!$B$3:$E$3".to_string(),
            },
        ];
        let xml = build_chart_xml(
            &ChartType::Col,
            Some("Quarterly"),
            Some("Sheet1!$B$1:$E$1"),
            &series,
        );
        let data = parse_chart(xml.as_bytes()).expect("generated chart parses");
        assert_eq!(data.chart_type, ChartType::Col);
        assert_eq!(data.title.as_deref(), Some("Quarterly"));
        assert_eq!(data.legend_pos, Some(LegendPos::Bottom));
        assert_eq!(data.series.len(), 2);
        assert_eq!(data.series[0].name.as_deref(), Some("Revenue"));
        assert_eq!(data.series[0].val_ref.as_deref(), Some("Sheet1!$B$2:$E$2"));
        assert_eq!(data.series[1].name.as_deref(), Some("Cost & <fees>"));
        assert_eq!(data.cat_ref.as_deref(), Some("Sheet1!$B$1:$E$1"));
    }
}
