//! Structured view of a chart part (`xl/charts/chartN.xml`).
//!
//! Two things live here: [`parse_chart`], which reads `c:chartSpace` into a
//! render-ready [`ChartData`], and [`build_chart_xml`], which writes a
//! `ChartData` back out. Editing a chart goes parse → patch → build, so the two
//! must agree: **anything this model does not carry is lost the moment a user
//! edits the chart.**
//!
//! That is why the model has two halves. Everything the editor understands is
//! typed (chart kind, series, labels, axis scale …). Everything else — fills,
//! fonts, gridlines, 3-D settings, markers, trendlines — is captured verbatim
//! as [`Unparsed`] subtrees in [`PreservedXml`] and re-emitted untouched, so a
//! chart styled in Excel keeps its styling through an edit here. Saving an
//! *unedited* chart does not go through this at all: the original bytes in
//! `PassthroughPart` are written back as-is.
//!
//! Matching is by literal `c:`/`a:` prefixes, which is what Excel/WPS emit. A
//! producer using different prefixes or a default namespace would not parse;
//! that is an accepted limitation for now.

use crate::xml_deserialize_from_str;
use xmlserde::quick_xml;
use xmlserde::{Unparsed, XmlSerialize};
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
    /// A spider/star chart: one spoke per category, plotted on a value axis.
    Radar,
    /// Scatter with a third dimension — each point sized by `c:bubbleSize`.
    Bubble,
    /// Open/high/low/close. The series *are* the price components: 4 of them
    /// is OHLC, 3 is high-low-close.
    Stock,
    /// Pie of pie: one series split across a main pie and a second pie that
    /// breaks down the remainder.
    OfPie,
    /// Bar of pie — the same split, with the second plot drawn as a bar.
    BarOfPie,
    /// A value surface over a category × series grid.
    Surface,
    /// The 3-D form of the same thing.
    Surface3d,
    /// The 3-D forms of the ordinary kinds. They differ from their flat
    /// siblings only in the element name, a depth axis (except the pie) and a
    /// couple of depth settings — the series are identical, which is why they
    /// share the flat kinds' code paths and render flat.
    Col3d,
    Bar3d,
    Line3d,
    Area3d,
    Pie3d,
}

impl ChartType {
    /// Whether this kind plots a category axis against a value axis. Pie-like
    /// and XY kinds do not.
    fn is_cartesian(&self) -> bool {
        matches!(
            self,
            ChartType::Col
                | ChartType::Bar
                | ChartType::Line
                | ChartType::Area
                | ChartType::Radar
                | ChartType::Stock
                | ChartType::Surface
                | ChartType::Surface3d
                | ChartType::Col3d
                | ChartType::Bar3d
                | ChartType::Line3d
                | ChartType::Area3d
        )
    }

    fn is_surface(&self) -> bool {
        matches!(self, ChartType::Surface | ChartType::Surface3d)
    }

    /// Written as a `*3DChart` element.
    fn is_3d(&self) -> bool {
        matches!(
            self,
            ChartType::Col3d
                | ChartType::Bar3d
                | ChartType::Line3d
                | ChartType::Area3d
                | ChartType::Pie3d
                | ChartType::Surface3d
        )
    }

    /// Kinds that plot into a depth dimension carry a third (`c:serAx`) axis
    /// alongside the usual pair. Omitting it makes the file unopenable.
    fn needs_series_axis(&self) -> bool {
        self.is_surface()
            || matches!(
                self,
                ChartType::Col3d | ChartType::Bar3d | ChartType::Line3d | ChartType::Area3d
            )
    }

    fn is_of_pie(&self) -> bool {
        matches!(self, ChartType::OfPie | ChartType::BarOfPie)
    }

    /// Whether this kind can share a plot area with other kinds. Excel only
    /// combines the flat category/value kinds: everything else either owns the
    /// plot area (pie, of-pie), needs its own axis shape (scatter, bubble,
    /// radar) or draws into depth (the 3-D forms and surfaces).
    fn is_combinable(&self) -> bool {
        matches!(
            self,
            ChartType::Col | ChartType::Bar | ChartType::Line | ChartType::Area
        )
    }

    /// The flat kind this one degrades to for rendering and for deciding which
    /// series children are legal.
    fn flattened(&self) -> ChartType {
        match self {
            ChartType::Col3d => ChartType::Col,
            ChartType::Bar3d => ChartType::Bar,
            ChartType::Line3d => ChartType::Line,
            ChartType::Area3d => ChartType::Area,
            ChartType::Pie3d => ChartType::Pie,
            ChartType::Surface3d => ChartType::Surface,
            other => other.clone(),
        }
    }
}

/// How a pie-of-pie or bar-of-pie divides its single series between the two
/// plots. Only meaningful for those two kinds.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct OfPieSplit {
    /// `c:splitType` — `auto | cust | percent | pos | val`.
    pub by: Option<String>,
    /// `c:splitPos` — read according to `by`: a count of trailing points for
    /// `pos`, a threshold for `val`, a percentage for `percent`.
    pub pos: Option<f64>,
    /// `c:secondPieSize` — the second plot's size as a percentage of the first.
    pub second_size: Option<f64>,
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

/// What a chart writes next to each data point (`c:dLbls`). All-false means no
/// labels, which is Excel's default for a freshly inserted chart.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct DataLabels {
    pub show_value: bool,
    pub show_category: bool,
    pub show_series: bool,
    pub show_percent: bool,
    pub show_legend_key: bool,
    /// `c:dLblPos` — `ctr|inEnd|outEnd|inBase|bestFit|l|r|t|b`.
    pub position: Option<String>,
    /// Number-format code applied to the label's value (`c:numFmt`).
    pub num_fmt: Option<String>,
}

impl PreservedGroup {
    /// A group with nothing preserved — what a combo chart's secondary groups
    /// get, since the file's settings describe the primary one.
    const EMPTY: PreservedGroup = PreservedGroup {
        vary_colors: None,
        gap_width: None,
        overlap: None,
        hole_size: None,
        first_slice_ang: None,
        scatter_style: None,
        marker: None,
        drop_lines: None,
        radar_style: None,
        hi_low_lines: None,
        up_down_bars: None,
        ser_lines: Vec::new(),
        cust_split: None,
        wireframe: None,
        band_fmts: None,
        gap_depth: None,
        shape: None,
        bubble_scale: None,
        bubble_3d: None,
        show_neg_bubbles: None,
        size_represents: None,
    };
}

impl DataLabels {
    /// Whether anything at all is shown; used to decide if `c:dLbls` needs
    /// writing and whether a renderer should draw labels.
    pub fn any(&self) -> bool {
        self.show_value || self.show_category || self.show_series || self.show_percent
    }
}

#[derive(Debug, Clone)]
pub struct ChartSeries {
    /// Series name, resolved from `c:tx` (literal or cached string ref).
    pub name: Option<String>,
    /// The value reference formula, e.g. `Sheet1!$B$2:$E$2`.
    pub val_ref: Option<String>,
    /// Cached numeric values (`c:numCache`), indexed to match `categories`.
    pub cached_values: Vec<Option<f64>>,
    /// The bubble-size reference (`c:bubbleSize`), a bubble chart's third
    /// dimension. `None` on every other chart kind.
    pub size_ref: Option<String>,
    /// Cached bubble sizes, indexed to match `cached_values`.
    pub cached_sizes: Vec<Option<f64>>,
    /// The source cells' number format as cached by the producer
    /// (`c:numCache/c:formatCode`). Used to render values the way the sheet
    /// does when the live cell format cannot be read.
    pub format_code: Option<String>,
    /// Fill color as authored (`c:spPr/a:solidFill`), if any.
    pub color: Option<SeriesColor>,
    /// The kind this series is drawn as, when it differs from the chart's own
    /// — a combo chart is exactly a chart whose series do not all agree.
    /// `None` means "follow [`ChartData::chart_type`]".
    pub series_type: Option<ChartType>,
    /// Per-series XML the editor does not model. See [`PreservedSeries`].
    pub preserved: PreservedSeries,
}

/// How an axis maps values to positions (`c:scaling` plus the tick units).
/// `None` everywhere means "auto", which is what Excel shows by default.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct AxisScale {
    pub min: Option<f64>,
    pub max: Option<f64>,
    /// `c:logBase` — a logarithmic axis. Excel allows 2..=1000.
    pub log_base: Option<f64>,
    /// `c:orientation val="maxMin"` — the axis runs the other way.
    pub reversed: bool,
    pub major_unit: Option<f64>,
    pub minor_unit: Option<f64>,
}

/// Chart XML this model does not interpret, kept verbatim so re-authoring the
/// chart cannot lose it. Each field is exactly one element, re-emitted in
/// schema order by [`build_chart_xml`].
///
/// The rule for adding to the typed model instead: if the editor needs to
/// *read or change* it, type it; if it only needs to survive, put it here.
#[derive(Debug, Clone, Default)]
pub struct PreservedXml {
    // `c:chartSpace` level: the chart area's own fill/border and the default
    // text properties every element inherits.
    pub date1904: Option<Unparsed>,
    pub lang: Option<Unparsed>,
    pub rounded_corners: Option<Unparsed>,
    pub chart_space_sp_pr: Option<Unparsed>,
    pub chart_space_tx_pr: Option<Unparsed>,
    pub external_data: Option<Unparsed>,
    pub print_settings: Option<Unparsed>,
    /// `mc:AlternateContent` wrapping `c:style` — Excel's built-in chart style
    /// id. It carries its own `xmlns:mc`, so re-emitting it is self-contained.
    pub style: Option<Unparsed>,
    // `c:chart` level.
    pub view_3d: Option<Unparsed>,
    pub floor: Option<Unparsed>,
    pub side_wall: Option<Unparsed>,
    pub back_wall: Option<Unparsed>,
    pub plot_vis_only: Option<Unparsed>,
    pub disp_blanks_as: Option<Unparsed>,
    pub show_d_lbls_over_max: Option<Unparsed>,
    // Title: the text is typed (the editor rewrites it); its placement and
    // formatting are not.
    pub title_layout: Option<Unparsed>,
    pub title_overlay: Option<Unparsed>,
    pub title_sp_pr: Option<Unparsed>,
    pub title_tx_pr: Option<Unparsed>,
    // Legend: only the position is typed.
    pub legend_layout: Option<Unparsed>,
    pub legend_overlay: Option<Unparsed>,
    pub legend_sp_pr: Option<Unparsed>,
    pub legend_tx_pr: Option<Unparsed>,
    // Plot area.
    pub plot_layout: Option<Unparsed>,
    pub plot_sp_pr: Option<Unparsed>,
    pub data_table: Option<Unparsed>,
    /// Settings of the plot group itself (bar gap width, hole size, …).
    pub group: PreservedGroup,
    pub cat_axis: PreservedAxis,
    pub val_axis: PreservedAxis,
    /// A surface chart's third axis (`c:serAx`), which runs across the series.
    pub ser_axis: PreservedAxis,
}

/// Per-chart-kind settings on the plot group (`c:barChart`, `c:pieChart`, …).
/// Which ones are present depends on the kind; they are written back only when
/// the kind still accepts them.
#[derive(Debug, Clone, Default)]
pub struct PreservedGroup {
    pub vary_colors: Option<Unparsed>,
    pub gap_width: Option<Unparsed>,
    pub overlap: Option<Unparsed>,
    pub hole_size: Option<Unparsed>,
    pub first_slice_ang: Option<Unparsed>,
    pub scatter_style: Option<Unparsed>,
    pub marker: Option<Unparsed>,
    pub drop_lines: Option<Unparsed>,
    /// `c:radarStyle` — `standard`, `marker` or `filled`.
    pub radar_style: Option<Unparsed>,
    /// Stock: the lines and bars drawn between the price series.
    pub hi_low_lines: Option<Unparsed>,
    pub up_down_bars: Option<Unparsed>,
    /// Of-pie: the leader lines joining the two plots, and a custom split.
    pub ser_lines: Vec<Unparsed>,
    pub cust_split: Option<Unparsed>,
    /// Surface: whether it is drawn as a mesh, and its colour bands.
    pub wireframe: Option<Unparsed>,
    pub band_fmts: Option<Unparsed>,
    /// 3-D: the depth between series, and the solid each bar is drawn as.
    pub gap_depth: Option<Unparsed>,
    pub shape: Option<Unparsed>,
    pub bubble_scale: Option<Unparsed>,
    pub bubble_3d: Option<Unparsed>,
    pub show_neg_bubbles: Option<Unparsed>,
    /// Whether a bubble's value maps to its area or its width.
    pub size_represents: Option<Unparsed>,
}

/// Axis presentation. The scale itself is typed on [`ChartData`]; everything
/// here is style and layout the editor never touches.
#[derive(Debug, Clone, Default)]
pub struct PreservedAxis {
    pub delete: Option<Unparsed>,
    pub ax_pos: Option<Unparsed>,
    pub major_gridlines: Option<Unparsed>,
    pub minor_gridlines: Option<Unparsed>,
    pub major_tick_mark: Option<Unparsed>,
    pub minor_tick_mark: Option<Unparsed>,
    pub tick_lbl_pos: Option<Unparsed>,
    pub sp_pr: Option<Unparsed>,
    pub tx_pr: Option<Unparsed>,
    pub crosses: Option<Unparsed>,
    pub crosses_at: Option<Unparsed>,
    pub cross_between: Option<Unparsed>,
    pub auto: Option<Unparsed>,
    pub lbl_algn: Option<Unparsed>,
    pub lbl_offset: Option<Unparsed>,
    pub no_multi_lvl_lbl: Option<Unparsed>,
    pub tick_lbl_skip: Option<Unparsed>,
    pub tick_mark_skip: Option<Unparsed>,
}

/// Per-series XML the editor does not model: markers, per-point formatting,
/// trendlines and so on.
#[derive(Debug, Clone, Default)]
pub struct PreservedSeries {
    /// The series' whole `c:spPr`. [`ChartSeries::color`] is read out of it for
    /// display; setting a color clears this so the builder writes a fresh fill.
    pub sp_pr: Option<Unparsed>,
    pub invert_if_negative: Option<Unparsed>,
    pub marker: Option<Unparsed>,
    pub explosion: Option<Unparsed>,
    pub d_pt: Vec<Unparsed>,
    pub trendline: Vec<Unparsed>,
    pub err_bars: Option<Unparsed>,
    pub smooth: Option<Unparsed>,
    pub bubble_3d: Option<Unparsed>,
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
    /// Data labels for the whole plot group (per-point overrides are not
    /// modeled; the group setting is what the UI edits).
    pub data_labels: DataLabels,
    /// Number-format code on the value axis (`c:valAx/c:numFmt@formatCode`).
    pub val_axis_num_fmt: Option<String>,
    pub cat_axis_scale: AxisScale,
    pub val_axis_scale: AxisScale,
    /// How an of-pie chart splits its series. Ignored by every other kind.
    pub of_pie_split: OfPieSplit,
    /// Everything else in the file, kept verbatim. See [`PreservedXml`].
    ///
    /// Boxed because it dwarfs the rest of the struct: `ChartData` is stored
    /// by value in an `imbl::Vector`, whose fixed-size chunks are built on the
    /// stack — inline, a few dozen preserved subtrees overflow it.
    pub preserved: Box<PreservedXml>,
}

/// Parse a chart part's raw bytes into render-ready [`ChartData`]. Returns
/// `None` if the XML is not valid UTF-8, does not parse, or has no plottable
/// chart-type element.
pub fn parse_chart(bytes: &[u8]) -> Option<ChartData> {
    let text = std::str::from_utf8(bytes).ok()?;
    let space = xml_deserialize_from_str::<CtChartSpace>(text).ok()?;
    let chart = space.chart?;
    let plot = chart.plot_area?;

    let groups = detect_groups(&plot);
    let (chart_type, stacked, series_src, group_labels) = groups.first()?.clone();

    let title = chart.title.as_ref().and_then(|t| t.text());
    let legend_pos = chart.legend.as_ref().and_then(|l| l.pos());
    let (cat_axis_title, val_axis_title) = plot.axis_titles();
    let val_axis_num_fmt = plot.val_axis_num_fmt();
    let cat_axis_scale = plot.cat_axis().map(|a| a.scale()).unwrap_or_default();
    let val_axis_scale = plot.val_axis().map(|a| a.scale()).unwrap_or_default();
    let preserved = Box::new(PreservedXml {
        date1904: space.date1904.clone(),
        lang: space.lang.clone(),
        rounded_corners: space.rounded_corners.clone(),
        chart_space_sp_pr: space.sp_pr.clone(),
        chart_space_tx_pr: space.tx_pr.clone(),
        external_data: space.external_data.clone(),
        print_settings: space.print_settings.clone(),
        style: space.style.clone(),
        view_3d: chart.view_3d.clone(),
        floor: chart.floor.clone(),
        side_wall: chart.side_wall.clone(),
        back_wall: chart.back_wall.clone(),
        plot_vis_only: chart.plot_vis_only.clone(),
        disp_blanks_as: chart.disp_blanks_as.clone(),
        show_d_lbls_over_max: chart.show_d_lbls_over_max.clone(),
        title_layout: chart.title.as_ref().and_then(|t| t.layout.clone()),
        title_overlay: chart.title.as_ref().and_then(|t| t.overlay.clone()),
        title_sp_pr: chart.title.as_ref().and_then(|t| t.sp_pr.clone()),
        title_tx_pr: chart.title.as_ref().and_then(|t| t.tx_pr.clone()),
        legend_layout: chart.legend.as_ref().and_then(|l| l.layout.clone()),
        legend_overlay: chart.legend.as_ref().and_then(|l| l.overlay.clone()),
        legend_sp_pr: chart.legend.as_ref().and_then(|l| l.sp_pr.clone()),
        legend_tx_pr: chart.legend.as_ref().and_then(|l| l.tx_pr.clone()),
        plot_layout: plot.layout.clone(),
        plot_sp_pr: plot.sp_pr.clone(),
        data_table: plot.d_table.clone(),
        group: plot.group_settings(),
        cat_axis: plot.cat_axis().map(|a| a.preserved()).unwrap_or_default(),
        val_axis: plot.val_axis().map(|a| a.preserved()).unwrap_or_default(),
        ser_axis: plot.ser_axis().map(|a| a.preserved()).unwrap_or_default(),
    });
    let of_pie_split = plot.of_pie_split();
    // A group-level `c:dLbls` is what Excel writes when you turn labels on for
    // the whole chart; fall back to the first series that carries its own.
    let data_labels = group_labels
        .map(|l| l.to_model())
        .or_else(|| {
            series_src
                .iter()
                .find_map(|s| s.d_lbls.as_ref())
                .map(|l| l.to_model())
        })
        .unwrap_or_default();

    // Categories come from the first series that carries them (`c:cat` for
    // cartesian charts, `c:xVal` for scatter).
    let (cat_ref, categories) = groups
        .iter()
        .flat_map(|(_, _, ser, _)| ser.iter())
        .find_map(|s| s.category_source())
        .map(|src| (src.formula(), src.cached_labels()))
        .unwrap_or((None, Vec::new()));

    // Series from every group, each tagged with the kind it was drawn as when
    // that is not the chart's own — which is what makes a combo chart.
    let primary_kind = chart_type.clone();
    // Series are read group by group, but `c:order` is what decides the order
    // Excel plots and lists them in — so a combo chart's series come back
    // interleaved as authored, not bunched by plot group.
    let mut ordered: Vec<(u32, ChartSeries)> = groups
        .iter()
        .flat_map(|(kind, _, ser, _)| {
            let kind = kind.clone();
            let primary = primary_kind.clone();
            ser.iter().map(move |s| {
                let mut out = s.to_series();
                if kind != primary {
                    out.series_type = Some(kind.clone());
                }
                (
                    s.order.as_ref().and_then(|o| o.val).unwrap_or(u32::MAX),
                    out,
                )
            })
        })
        .collect();
    ordered.sort_by_key(|(order, _)| *order);
    let series = ordered.into_iter().map(|(_, s)| s).collect();

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
        data_labels,
        val_axis_num_fmt,
        cat_axis_scale,
        val_axis_scale,
        of_pie_split,
        preserved,
    })
}

type DetectedPlot<'a> = (ChartType, bool, &'a Vec<CtSer>, Option<&'a CtDLbls>);

/// Every plot group in the area, in document order. More than one means a
/// combo chart: the first group is the chart's own kind and the rest override
/// it per series.
fn detect_groups(plot: &CtPlotArea) -> Vec<DetectedPlot<'_>> {
    let mut out = Vec::new();
    if let Some(b) = &plot.bar_chart {
        let horizontal = b.bar_dir.as_ref().and_then(|d| d.val.as_deref()) == Some("bar");
        let ty = if horizontal {
            ChartType::Bar
        } else {
            ChartType::Col
        };
        out.push((
            ty,
            is_stacked(b.grouping.as_ref()),
            &b.ser,
            b.d_lbls.as_ref(),
        ));
    }
    if let Some(l) = &plot.line_chart {
        out.push((
            ChartType::Line,
            is_stacked(l.grouping.as_ref()),
            &l.ser,
            l.d_lbls.as_ref(),
        ));
    }
    if let Some(a) = &plot.area_chart {
        out.push((
            ChartType::Area,
            is_stacked(a.grouping.as_ref()),
            &a.ser,
            a.d_lbls.as_ref(),
        ));
    }
    // The remaining kinds never combine, so at most one of them appears and it
    // is the whole chart.
    if let Some(single) = detect_type(plot) {
        if !out.iter().any(|(k, ..)| *k == single.0) {
            out.push(single);
        }
    }
    out
}

fn detect_type(plot: &CtPlotArea) -> Option<DetectedPlot<'_>> {
    if let Some(b) = &plot.bar_chart {
        let horizontal = b.bar_dir.as_ref().and_then(|d| d.val.as_deref()) == Some("bar");
        let ty = if horizontal {
            ChartType::Bar
        } else {
            ChartType::Col
        };
        return Some((
            ty,
            is_stacked(b.grouping.as_ref()),
            &b.ser,
            b.d_lbls.as_ref(),
        ));
    }
    if let Some(l) = &plot.line_chart {
        return Some((
            ChartType::Line,
            is_stacked(l.grouping.as_ref()),
            &l.ser,
            l.d_lbls.as_ref(),
        ));
    }
    if let Some(a) = &plot.area_chart {
        return Some((
            ChartType::Area,
            is_stacked(a.grouping.as_ref()),
            &a.ser,
            a.d_lbls.as_ref(),
        ));
    }
    if let Some(p) = &plot.pie_chart {
        return Some((ChartType::Pie, false, &p.ser, p.d_lbls.as_ref()));
    }
    if let Some(d) = &plot.doughnut_chart {
        return Some((ChartType::Doughnut, false, &d.ser, d.d_lbls.as_ref()));
    }
    if let Some(s) = &plot.scatter_chart {
        return Some((ChartType::Scatter, false, &s.ser, s.d_lbls.as_ref()));
    }
    if let Some(r) = &plot.radar_chart {
        return Some((ChartType::Radar, false, &r.ser, r.d_lbls.as_ref()));
    }
    if let Some(b) = &plot.bubble_chart {
        return Some((ChartType::Bubble, false, &b.ser, b.d_lbls.as_ref()));
    }
    if let Some(st) = &plot.stock_chart {
        return Some((ChartType::Stock, false, &st.ser, st.d_lbls.as_ref()));
    }
    if let Some(o) = &plot.of_pie_chart {
        // `c:ofPieType` picks which shape the second plot takes; it is required
        // by the schema, and "pie" is what Excel writes when in doubt.
        let ty = if o.of_pie_type.as_ref().and_then(|t| t.val.as_deref()) == Some("bar") {
            ChartType::BarOfPie
        } else {
            ChartType::OfPie
        };
        return Some((ty, false, &o.ser, o.d_lbls.as_ref()));
    }
    if let Some(sf) = &plot.surface_chart {
        return Some((ChartType::Surface, false, &sf.ser, sf.d_lbls.as_ref()));
    }
    if let Some(sf) = &plot.surface_3d_chart {
        return Some((ChartType::Surface3d, false, &sf.ser, sf.d_lbls.as_ref()));
    }
    if let Some(b) = &plot.bar_3d_chart {
        let horizontal = b.bar_dir.as_ref().and_then(|d| d.val.as_deref()) == Some("bar");
        let ty = if horizontal {
            ChartType::Bar3d
        } else {
            ChartType::Col3d
        };
        return Some((
            ty,
            is_stacked(b.grouping.as_ref()),
            &b.ser,
            b.d_lbls.as_ref(),
        ));
    }
    if let Some(l) = &plot.line_3d_chart {
        return Some((
            ChartType::Line3d,
            is_stacked(l.grouping.as_ref()),
            &l.ser,
            l.d_lbls.as_ref(),
        ));
    }
    if let Some(a) = &plot.area_3d_chart {
        return Some((
            ChartType::Area3d,
            is_stacked(a.grouping.as_ref()),
            &a.ser,
            a.d_lbls.as_ref(),
        ));
    }
    if let Some(p) = &plot.pie_3d_chart {
        return Some((ChartType::Pie3d, false, &p.ser, p.d_lbls.as_ref()));
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
#[xmlserde(alias(b"chartSpace"))]
struct CtChartSpace {
    #[xmlserde(name = b"c:date1904", ty = "child")]
    #[xmlserde(alias(b"date1904"))]
    date1904: Option<Unparsed>,
    #[xmlserde(name = b"c:lang", ty = "child")]
    #[xmlserde(alias(b"lang"))]
    lang: Option<Unparsed>,
    #[xmlserde(name = b"c:roundedCorners", ty = "child")]
    #[xmlserde(alias(b"roundedCorners"))]
    rounded_corners: Option<Unparsed>,
    #[xmlserde(name = b"c:chart", ty = "child")]
    #[xmlserde(alias(b"chart"))]
    chart: Option<CtChart>,
    #[xmlserde(name = b"c:spPr", ty = "child")]
    #[xmlserde(alias(b"spPr"))]
    sp_pr: Option<Unparsed>,
    #[xmlserde(name = b"c:txPr", ty = "child")]
    #[xmlserde(alias(b"txPr"))]
    tx_pr: Option<Unparsed>,
    #[xmlserde(name = b"c:externalData", ty = "child")]
    #[xmlserde(alias(b"externalData"))]
    external_data: Option<Unparsed>,
    #[xmlserde(name = b"c:printSettings", ty = "child")]
    #[xmlserde(alias(b"printSettings"))]
    print_settings: Option<Unparsed>,
    #[xmlserde(name = b"mc:AlternateContent", ty = "child")]
    #[xmlserde(alias(b"AlternateContent"))]
    style: Option<Unparsed>,
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtChart {
    #[xmlserde(name = b"c:title", ty = "child")]
    #[xmlserde(alias(b"title"))]
    title: Option<CtTitle>,
    #[xmlserde(name = b"c:view3D", ty = "child")]
    #[xmlserde(alias(b"view3D"))]
    view_3d: Option<Unparsed>,
    #[xmlserde(name = b"c:floor", ty = "child")]
    #[xmlserde(alias(b"floor"))]
    floor: Option<Unparsed>,
    #[xmlserde(name = b"c:sideWall", ty = "child")]
    #[xmlserde(alias(b"sideWall"))]
    side_wall: Option<Unparsed>,
    #[xmlserde(name = b"c:backWall", ty = "child")]
    #[xmlserde(alias(b"backWall"))]
    back_wall: Option<Unparsed>,
    #[xmlserde(name = b"c:plotArea", ty = "child")]
    #[xmlserde(alias(b"plotArea"))]
    plot_area: Option<CtPlotArea>,
    #[xmlserde(name = b"c:legend", ty = "child")]
    #[xmlserde(alias(b"legend"))]
    legend: Option<CtLegend>,
    #[xmlserde(name = b"c:plotVisOnly", ty = "child")]
    #[xmlserde(alias(b"plotVisOnly"))]
    plot_vis_only: Option<Unparsed>,
    #[xmlserde(name = b"c:dispBlanksAs", ty = "child")]
    #[xmlserde(alias(b"dispBlanksAs"))]
    disp_blanks_as: Option<Unparsed>,
    #[xmlserde(name = b"c:showDLblsOverMax", ty = "child")]
    #[xmlserde(alias(b"showDLblsOverMax"))]
    show_d_lbls_over_max: Option<Unparsed>,
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtPlotArea {
    #[xmlserde(name = b"c:layout", ty = "child")]
    #[xmlserde(alias(b"layout"))]
    layout: Option<Unparsed>,
    #[xmlserde(name = b"c:spPr", ty = "child")]
    #[xmlserde(alias(b"spPr"))]
    sp_pr: Option<Unparsed>,
    #[xmlserde(name = b"c:dTable", ty = "child")]
    #[xmlserde(alias(b"dTable"))]
    d_table: Option<Unparsed>,
    #[xmlserde(name = b"c:barChart", ty = "child")]
    #[xmlserde(alias(b"barChart"))]
    bar_chart: Option<CtBarChart>,
    #[xmlserde(name = b"c:lineChart", ty = "child")]
    #[xmlserde(alias(b"lineChart"))]
    line_chart: Option<CtGroupedChart>,
    #[xmlserde(name = b"c:areaChart", ty = "child")]
    #[xmlserde(alias(b"areaChart"))]
    area_chart: Option<CtGroupedChart>,
    #[xmlserde(name = b"c:pieChart", ty = "child")]
    #[xmlserde(alias(b"pieChart"))]
    pie_chart: Option<CtSimpleChart>,
    #[xmlserde(name = b"c:doughnutChart", ty = "child")]
    #[xmlserde(alias(b"doughnutChart"))]
    doughnut_chart: Option<CtSimpleChart>,
    #[xmlserde(name = b"c:scatterChart", ty = "child")]
    #[xmlserde(alias(b"scatterChart"))]
    scatter_chart: Option<CtSimpleChart>,
    #[xmlserde(name = b"c:radarChart", ty = "child")]
    #[xmlserde(alias(b"radarChart"))]
    radar_chart: Option<CtSimpleChart>,
    #[xmlserde(name = b"c:bubbleChart", ty = "child")]
    #[xmlserde(alias(b"bubbleChart"))]
    bubble_chart: Option<CtSimpleChart>,
    #[xmlserde(name = b"c:stockChart", ty = "child")]
    #[xmlserde(alias(b"stockChart"))]
    stock_chart: Option<CtSimpleChart>,
    #[xmlserde(name = b"c:ofPieChart", ty = "child")]
    #[xmlserde(alias(b"ofPieChart"))]
    of_pie_chart: Option<CtSimpleChart>,
    #[xmlserde(name = b"c:surfaceChart", ty = "child")]
    #[xmlserde(alias(b"surfaceChart"))]
    surface_chart: Option<CtSimpleChart>,
    #[xmlserde(name = b"c:surface3DChart", ty = "child")]
    #[xmlserde(alias(b"surface3DChart"))]
    surface_3d_chart: Option<CtSimpleChart>,
    #[xmlserde(name = b"c:bar3DChart", ty = "child")]
    #[xmlserde(alias(b"bar3DChart"))]
    bar_3d_chart: Option<CtBarChart>,
    #[xmlserde(name = b"c:line3DChart", ty = "child")]
    #[xmlserde(alias(b"line3DChart"))]
    line_3d_chart: Option<CtGroupedChart>,
    #[xmlserde(name = b"c:area3DChart", ty = "child")]
    #[xmlserde(alias(b"area3DChart"))]
    area_3d_chart: Option<CtGroupedChart>,
    #[xmlserde(name = b"c:pie3DChart", ty = "child")]
    #[xmlserde(alias(b"pie3DChart"))]
    pie_3d_chart: Option<CtSimpleChart>,

    #[xmlserde(name = b"c:catAx", ty = "child")]
    #[xmlserde(alias(b"catAx"))]
    cat_ax: Vec<CtAxis>,
    #[xmlserde(name = b"c:valAx", ty = "child")]
    #[xmlserde(alias(b"valAx"))]
    val_ax: Vec<CtAxis>,
    #[xmlserde(name = b"c:serAx", ty = "child")]
    #[xmlserde(alias(b"serAx"))]
    ser_ax: Vec<CtAxis>,
}

impl CtPlotArea {
    /// The horizontal (category) axis. Scatter charts have no `c:catAx` — the
    /// first of their two `c:valAx` plays that role.
    fn cat_axis(&self) -> Option<&CtAxis> {
        self.cat_ax.first().or_else(|| self.val_ax.first())
    }

    /// A surface chart's third axis, running across the series.
    fn ser_axis(&self) -> Option<&CtAxis> {
        self.ser_ax.first()
    }

    /// The vertical (value) axis. On a scatter chart that is the *second*
    /// `c:valAx`; everywhere else the only one.
    fn val_axis(&self) -> Option<&CtAxis> {
        if self.cat_ax.is_empty() && self.val_ax.len() > 1 {
            self.val_ax.get(1)
        } else {
            self.val_ax.first()
        }
    }

    /// (category-axis title, value-axis title).
    fn axis_titles(&self) -> (Option<String>, Option<String>) {
        (
            self.cat_axis().and_then(|a| a.title()),
            self.val_axis().and_then(|a| a.title()),
        )
    }

    fn val_axis_num_fmt(&self) -> Option<String> {
        self.val_axis()?
            .num_fmt
            .as_ref()
            .and_then(|n| n.format_code.clone())
            .and_then(explicit_format)
    }

    fn of_pie_split(&self) -> OfPieSplit {
        let Some(o) = &self.of_pie_chart else {
            return OfPieSplit::default();
        };
        OfPieSplit {
            by: o.split_type.as_ref().and_then(|t| t.val.clone()),
            pos: o.split_pos.as_ref().and_then(|v| v.val),
            second_size: o.second_pie_size.as_ref().and_then(|v| v.val),
        }
    }

    /// Settings that belong to whichever plot group this chart uses.
    fn group_settings(&self) -> PreservedGroup {
        for b in [&self.bar_chart, &self.bar_3d_chart].into_iter().flatten() {
            return PreservedGroup {
                vary_colors: b.vary_colors.clone(),
                gap_width: b.gap_width.clone(),
                overlap: b.overlap.clone(),
                gap_depth: b.gap_depth.clone(),
                shape: b.shape.clone(),
                ..Default::default()
            };
        }
        for g in [
            &self.line_chart,
            &self.area_chart,
            &self.line_3d_chart,
            &self.area_3d_chart,
        ]
        .into_iter()
        .flatten()
        {
            return PreservedGroup {
                vary_colors: g.vary_colors.clone(),
                marker: g.marker.clone(),
                drop_lines: g.drop_lines.clone(),
                gap_depth: g.gap_depth.clone(),
                ..Default::default()
            };
        }
        for c in [
            &self.pie_chart,
            &self.doughnut_chart,
            &self.scatter_chart,
            &self.radar_chart,
            &self.bubble_chart,
            &self.stock_chart,
            &self.of_pie_chart,
            &self.surface_chart,
            &self.surface_3d_chart,
            &self.pie_3d_chart,
        ]
        .into_iter()
        .flatten()
        {
            return PreservedGroup {
                vary_colors: c.vary_colors.clone(),
                hole_size: c.hole_size.clone(),
                first_slice_ang: c.first_slice_ang.clone(),
                scatter_style: c.scatter_style.clone(),
                radar_style: c.radar_style.clone(),
                bubble_scale: c.bubble_scale.clone(),
                bubble_3d: c.bubble_3d.clone(),
                show_neg_bubbles: c.show_neg_bubbles.clone(),
                size_represents: c.size_represents.clone(),
                hi_low_lines: c.hi_low_lines.clone(),
                up_down_bars: c.up_down_bars.clone(),
                ser_lines: c.ser_lines.clone(),
                cust_split: c.cust_split.clone(),
                wireframe: c.wireframe.clone(),
                band_fmts: c.band_fmts.clone(),
                gap_width: c.gap_width.clone(),
                ..Default::default()
            };
        }
        PreservedGroup::default()
    }
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtBarChart {
    #[xmlserde(name = b"c:barDir", ty = "child")]
    #[xmlserde(alias(b"barDir"))]
    bar_dir: Option<CtStrAttr>,
    #[xmlserde(name = b"c:grouping", ty = "child")]
    #[xmlserde(alias(b"grouping"))]
    grouping: Option<CtStrAttr>,
    #[xmlserde(name = b"c:ser", ty = "child")]
    #[xmlserde(alias(b"ser"))]
    ser: Vec<CtSer>,
    #[xmlserde(name = b"c:dLbls", ty = "child")]
    #[xmlserde(alias(b"dLbls"))]
    d_lbls: Option<CtDLbls>,
    #[xmlserde(name = b"c:varyColors", ty = "child")]
    #[xmlserde(alias(b"varyColors"))]
    vary_colors: Option<Unparsed>,
    #[xmlserde(name = b"c:gapWidth", ty = "child")]
    #[xmlserde(alias(b"gapWidth"))]
    gap_width: Option<Unparsed>,
    #[xmlserde(name = b"c:overlap", ty = "child")]
    #[xmlserde(alias(b"overlap"))]
    overlap: Option<Unparsed>,
    #[xmlserde(name = b"c:gapDepth", ty = "child")]
    #[xmlserde(alias(b"gapDepth"))]
    gap_depth: Option<Unparsed>,
    #[xmlserde(name = b"c:shape", ty = "child")]
    #[xmlserde(alias(b"shape"))]
    shape: Option<Unparsed>,
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtGroupedChart {
    #[xmlserde(name = b"c:grouping", ty = "child")]
    #[xmlserde(alias(b"grouping"))]
    grouping: Option<CtStrAttr>,
    #[xmlserde(name = b"c:ser", ty = "child")]
    #[xmlserde(alias(b"ser"))]
    ser: Vec<CtSer>,
    #[xmlserde(name = b"c:dLbls", ty = "child")]
    #[xmlserde(alias(b"dLbls"))]
    d_lbls: Option<CtDLbls>,
    #[xmlserde(name = b"c:varyColors", ty = "child")]
    #[xmlserde(alias(b"varyColors"))]
    vary_colors: Option<Unparsed>,
    #[xmlserde(name = b"c:marker", ty = "child")]
    #[xmlserde(alias(b"marker"))]
    marker: Option<Unparsed>,
    #[xmlserde(name = b"c:dropLines", ty = "child")]
    #[xmlserde(alias(b"dropLines"))]
    drop_lines: Option<Unparsed>,
    #[xmlserde(name = b"c:gapDepth", ty = "child")]
    #[xmlserde(alias(b"gapDepth"))]
    gap_depth: Option<Unparsed>,
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtSimpleChart {
    #[xmlserde(name = b"c:ser", ty = "child")]
    #[xmlserde(alias(b"ser"))]
    ser: Vec<CtSer>,
    #[xmlserde(name = b"c:dLbls", ty = "child")]
    #[xmlserde(alias(b"dLbls"))]
    d_lbls: Option<CtDLbls>,
    #[xmlserde(name = b"c:varyColors", ty = "child")]
    #[xmlserde(alias(b"varyColors"))]
    vary_colors: Option<Unparsed>,
    #[xmlserde(name = b"c:holeSize", ty = "child")]
    #[xmlserde(alias(b"holeSize"))]
    hole_size: Option<Unparsed>,
    #[xmlserde(name = b"c:firstSliceAng", ty = "child")]
    #[xmlserde(alias(b"firstSliceAng"))]
    first_slice_ang: Option<Unparsed>,
    #[xmlserde(name = b"c:scatterStyle", ty = "child")]
    #[xmlserde(alias(b"scatterStyle"))]
    scatter_style: Option<Unparsed>,
    #[xmlserde(name = b"c:radarStyle", ty = "child")]
    #[xmlserde(alias(b"radarStyle"))]
    radar_style: Option<Unparsed>,
    #[xmlserde(name = b"c:bubbleScale", ty = "child")]
    #[xmlserde(alias(b"bubbleScale"))]
    bubble_scale: Option<Unparsed>,
    #[xmlserde(name = b"c:bubble3D", ty = "child")]
    #[xmlserde(alias(b"bubble3D"))]
    bubble_3d: Option<Unparsed>,
    #[xmlserde(name = b"c:showNegBubbles", ty = "child")]
    #[xmlserde(alias(b"showNegBubbles"))]
    show_neg_bubbles: Option<Unparsed>,
    #[xmlserde(name = b"c:sizeRepresents", ty = "child")]
    #[xmlserde(alias(b"sizeRepresents"))]
    size_represents: Option<Unparsed>,
    #[xmlserde(name = b"c:hiLowLines", ty = "child")]
    #[xmlserde(alias(b"hiLowLines"))]
    hi_low_lines: Option<Unparsed>,
    #[xmlserde(name = b"c:upDownBars", ty = "child")]
    #[xmlserde(alias(b"upDownBars"))]
    up_down_bars: Option<Unparsed>,
    #[xmlserde(name = b"c:ofPieType", ty = "child")]
    #[xmlserde(alias(b"ofPieType"))]
    of_pie_type: Option<CtStrAttr>,
    #[xmlserde(name = b"c:splitType", ty = "child")]
    #[xmlserde(alias(b"splitType"))]
    split_type: Option<CtStrAttr>,
    #[xmlserde(name = b"c:splitPos", ty = "child")]
    #[xmlserde(alias(b"splitPos"))]
    split_pos: Option<CtF64Attr>,
    #[xmlserde(name = b"c:secondPieSize", ty = "child")]
    #[xmlserde(alias(b"secondPieSize"))]
    second_pie_size: Option<CtF64Attr>,
    #[xmlserde(name = b"c:custSplit", ty = "child")]
    #[xmlserde(alias(b"custSplit"))]
    cust_split: Option<Unparsed>,
    #[xmlserde(name = b"c:serLines", ty = "child")]
    #[xmlserde(alias(b"serLines"))]
    ser_lines: Vec<Unparsed>,
    #[xmlserde(name = b"c:wireframe", ty = "child")]
    #[xmlserde(alias(b"wireframe"))]
    wireframe: Option<Unparsed>,
    #[xmlserde(name = b"c:bandFmts", ty = "child")]
    #[xmlserde(alias(b"bandFmts"))]
    band_fmts: Option<Unparsed>,
    #[xmlserde(name = b"c:gapWidth", ty = "child")]
    #[xmlserde(alias(b"gapWidth"))]
    gap_width: Option<Unparsed>,
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtSer {
    #[xmlserde(name = b"c:order", ty = "child")]
    #[xmlserde(alias(b"order"))]
    order: Option<CtU32Attr>,
    #[xmlserde(name = b"c:tx", ty = "child")]
    #[xmlserde(alias(b"tx"))]
    tx: Option<CtSerTx>,
    #[xmlserde(name = b"c:spPr", ty = "child")]
    #[xmlserde(alias(b"spPr"))]
    sp_pr: Option<Unparsed>,
    #[xmlserde(name = b"c:cat", ty = "child")]
    #[xmlserde(alias(b"cat"))]
    cat: Option<CtAxDataSource>,
    #[xmlserde(name = b"c:val", ty = "child")]
    #[xmlserde(alias(b"val"))]
    val: Option<CtNumDataSource>,
    #[xmlserde(name = b"c:xVal", ty = "child")]
    #[xmlserde(alias(b"xVal"))]
    x_val: Option<CtAxDataSource>,
    #[xmlserde(name = b"c:yVal", ty = "child")]
    #[xmlserde(alias(b"yVal"))]
    y_val: Option<CtNumDataSource>,
    #[xmlserde(name = b"c:bubbleSize", ty = "child")]
    #[xmlserde(alias(b"bubbleSize"))]
    bubble_size: Option<CtNumDataSource>,
    #[xmlserde(name = b"c:bubble3D", ty = "child")]
    #[xmlserde(alias(b"bubble3D"))]
    bubble_3d: Option<Unparsed>,
    #[xmlserde(name = b"c:dLbls", ty = "child")]
    #[xmlserde(alias(b"dLbls"))]
    d_lbls: Option<CtDLbls>,
    #[xmlserde(name = b"c:invertIfNegative", ty = "child")]
    #[xmlserde(alias(b"invertIfNegative"))]
    invert_if_negative: Option<Unparsed>,
    #[xmlserde(name = b"c:marker", ty = "child")]
    #[xmlserde(alias(b"marker"))]
    marker: Option<Unparsed>,
    #[xmlserde(name = b"c:explosion", ty = "child")]
    #[xmlserde(alias(b"explosion"))]
    explosion: Option<Unparsed>,
    #[xmlserde(name = b"c:dPt", ty = "child")]
    #[xmlserde(alias(b"dPt"))]
    d_pt: Vec<Unparsed>,
    #[xmlserde(name = b"c:trendline", ty = "child")]
    #[xmlserde(alias(b"trendline"))]
    trendline: Vec<Unparsed>,
    #[xmlserde(name = b"c:errBars", ty = "child")]
    #[xmlserde(alias(b"errBars"))]
    err_bars: Option<Unparsed>,
    #[xmlserde(name = b"c:smooth", ty = "child")]
    #[xmlserde(alias(b"smooth"))]
    smooth: Option<Unparsed>,
}

#[derive(Debug, XmlDeserialize, Default)]
#[xmlserde(root = b"c:spPr")]
#[xmlserde(alias(b"spPr"))]
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

/// Read the fill color out of a preserved `c:spPr`. The subtree is kept whole
/// (a fill is only part of what `spPr` carries), so the color is recovered by
/// re-parsing it rather than by mapping the element twice.
fn color_of(sp_pr: &Unparsed) -> Option<SeriesColor> {
    let xml = render_unparsed("c:spPr", sp_pr);
    xml_deserialize_from_str::<CtChartShapeProps>(&xml)
        .ok()
        .and_then(|p| p.color())
}

/// Serialize a preserved subtree back to XML under `tag`.
fn render_unparsed(tag: &str, u: &Unparsed) -> String {
    let mut writer = quick_xml::Writer::new(Vec::new());
    u.serialize(tag.as_bytes(), &mut writer);
    String::from_utf8(writer.into_inner()).unwrap_or_default()
}

/// Append a preserved subtree, if there is one.
fn push_preserved(s: &mut String, tag: &str, u: &Option<Unparsed>) {
    if let Some(u) = u {
        s.push_str(&render_unparsed(tag, u));
    }
}

fn push_preserved_all(s: &mut String, tag: &str, list: &[Unparsed]) {
    for u in list {
        s.push_str(&render_unparsed(tag, u));
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
            size_ref: self.bubble_size.as_ref().and_then(|b| b.formula()),
            cached_sizes: self
                .bubble_size
                .as_ref()
                .map(|b| b.cached_values())
                .unwrap_or_default(),
            format_code: val.and_then(|v| v.format_code()),
            color: self.sp_pr.as_ref().and_then(color_of),
            // Filled in by the caller, which knows which group this came from.
            series_type: None,
            preserved: PreservedSeries {
                sp_pr: self.sp_pr.clone(),
                invert_if_negative: self.invert_if_negative.clone(),
                marker: self.marker.clone(),
                explosion: self.explosion.clone(),
                d_pt: self.d_pt.clone(),
                trendline: self.trendline.clone(),
                err_bars: self.err_bars.clone(),
                smooth: self.smooth.clone(),
                bubble_3d: self.bubble_3d.clone(),
            },
        }
    }
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtSerTx {
    #[xmlserde(name = b"c:strRef", ty = "child")]
    #[xmlserde(alias(b"strRef"))]
    str_ref: Option<CtStrRef>,
    #[xmlserde(name = b"c:v", ty = "child")]
    #[xmlserde(alias(b"v"))]
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
    #[xmlserde(alias(b"numRef"))]
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

    fn format_code(&self) -> Option<String> {
        self.num_ref
            .as_ref()
            .and_then(|r| r.num_cache.as_ref())
            .and_then(|c| c.format_code.as_ref())
            .and_then(|t| non_empty(t.v.clone()))
    }
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtNumRef {
    #[xmlserde(name = b"c:f", ty = "child")]
    #[xmlserde(alias(b"f"))]
    f: Option<CtText>,
    #[xmlserde(name = b"c:numCache", ty = "child")]
    #[xmlserde(alias(b"numCache"))]
    num_cache: Option<CtNumData>,
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtNumData {
    #[xmlserde(name = b"c:formatCode", ty = "child")]
    #[xmlserde(alias(b"formatCode"))]
    format_code: Option<CtText>,
    #[xmlserde(name = b"c:ptCount", ty = "child")]
    #[xmlserde(alias(b"ptCount"))]
    pt_count: Option<CtU32Attr>,
    #[xmlserde(name = b"c:pt", ty = "child")]
    #[xmlserde(alias(b"pt"))]
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
    #[xmlserde(alias(b"v"))]
    v: Option<CtText>,
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtAxDataSource {
    #[xmlserde(name = b"c:strRef", ty = "child")]
    #[xmlserde(alias(b"strRef"))]
    str_ref: Option<CtStrRef>,
    #[xmlserde(name = b"c:numRef", ty = "child")]
    #[xmlserde(alias(b"numRef"))]
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
    #[xmlserde(alias(b"f"))]
    f: Option<CtText>,
    #[xmlserde(name = b"c:strCache", ty = "child")]
    #[xmlserde(alias(b"strCache"))]
    str_cache: Option<CtStrData>,
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtStrData {
    #[xmlserde(name = b"c:ptCount", ty = "child")]
    #[xmlserde(alias(b"ptCount"))]
    pt_count: Option<CtU32Attr>,
    #[xmlserde(name = b"c:pt", ty = "child")]
    #[xmlserde(alias(b"pt"))]
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
    #[xmlserde(alias(b"tx"))]
    tx: Option<CtTx>,
    #[xmlserde(name = b"c:layout", ty = "child")]
    #[xmlserde(alias(b"layout"))]
    layout: Option<Unparsed>,
    #[xmlserde(name = b"c:overlay", ty = "child")]
    #[xmlserde(alias(b"overlay"))]
    overlay: Option<Unparsed>,
    #[xmlserde(name = b"c:spPr", ty = "child")]
    #[xmlserde(alias(b"spPr"))]
    sp_pr: Option<Unparsed>,
    #[xmlserde(name = b"c:txPr", ty = "child")]
    #[xmlserde(alias(b"txPr"))]
    tx_pr: Option<Unparsed>,
}

impl CtTitle {
    fn text(&self) -> Option<String> {
        self.tx.as_ref().and_then(|tx| tx.text())
    }
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtTx {
    #[xmlserde(name = b"c:rich", ty = "child")]
    #[xmlserde(alias(b"rich"))]
    rich: Option<CtTextBody>,
    #[xmlserde(name = b"c:strRef", ty = "child")]
    #[xmlserde(alias(b"strRef"))]
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
    #[xmlserde(alias(b"legendPos"))]
    legend_pos: Option<CtStrAttr>,
    #[xmlserde(name = b"c:layout", ty = "child")]
    #[xmlserde(alias(b"layout"))]
    layout: Option<Unparsed>,
    #[xmlserde(name = b"c:overlay", ty = "child")]
    #[xmlserde(alias(b"overlay"))]
    overlay: Option<Unparsed>,
    #[xmlserde(name = b"c:spPr", ty = "child")]
    #[xmlserde(alias(b"spPr"))]
    sp_pr: Option<Unparsed>,
    #[xmlserde(name = b"c:txPr", ty = "child")]
    #[xmlserde(alias(b"txPr"))]
    tx_pr: Option<Unparsed>,
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
    #[xmlserde(alias(b"title"))]
    title: Option<CtTitle>,
    #[xmlserde(name = b"c:numFmt", ty = "child")]
    #[xmlserde(alias(b"numFmt"))]
    num_fmt: Option<CtNumFmt>,
    #[xmlserde(name = b"c:scaling", ty = "child")]
    #[xmlserde(alias(b"scaling"))]
    scaling: Option<CtScaling>,
    #[xmlserde(name = b"c:majorUnit", ty = "child")]
    #[xmlserde(alias(b"majorUnit"))]
    major_unit: Option<CtF64Attr>,
    #[xmlserde(name = b"c:minorUnit", ty = "child")]
    #[xmlserde(alias(b"minorUnit"))]
    minor_unit: Option<CtF64Attr>,
    #[xmlserde(name = b"c:delete", ty = "child")]
    #[xmlserde(alias(b"delete"))]
    delete: Option<Unparsed>,
    #[xmlserde(name = b"c:axPos", ty = "child")]
    #[xmlserde(alias(b"axPos"))]
    ax_pos: Option<Unparsed>,
    #[xmlserde(name = b"c:majorGridlines", ty = "child")]
    #[xmlserde(alias(b"majorGridlines"))]
    major_gridlines: Option<Unparsed>,
    #[xmlserde(name = b"c:minorGridlines", ty = "child")]
    #[xmlserde(alias(b"minorGridlines"))]
    minor_gridlines: Option<Unparsed>,
    #[xmlserde(name = b"c:majorTickMark", ty = "child")]
    #[xmlserde(alias(b"majorTickMark"))]
    major_tick_mark: Option<Unparsed>,
    #[xmlserde(name = b"c:minorTickMark", ty = "child")]
    #[xmlserde(alias(b"minorTickMark"))]
    minor_tick_mark: Option<Unparsed>,
    #[xmlserde(name = b"c:tickLblPos", ty = "child")]
    #[xmlserde(alias(b"tickLblPos"))]
    tick_lbl_pos: Option<Unparsed>,
    #[xmlserde(name = b"c:spPr", ty = "child")]
    #[xmlserde(alias(b"spPr"))]
    sp_pr: Option<Unparsed>,
    #[xmlserde(name = b"c:txPr", ty = "child")]
    #[xmlserde(alias(b"txPr"))]
    tx_pr: Option<Unparsed>,
    #[xmlserde(name = b"c:crosses", ty = "child")]
    #[xmlserde(alias(b"crosses"))]
    crosses: Option<Unparsed>,
    #[xmlserde(name = b"c:crossesAt", ty = "child")]
    #[xmlserde(alias(b"crossesAt"))]
    crosses_at: Option<Unparsed>,
    #[xmlserde(name = b"c:crossBetween", ty = "child")]
    #[xmlserde(alias(b"crossBetween"))]
    cross_between: Option<Unparsed>,
    #[xmlserde(name = b"c:auto", ty = "child")]
    #[xmlserde(alias(b"auto"))]
    auto: Option<Unparsed>,
    #[xmlserde(name = b"c:lblAlgn", ty = "child")]
    #[xmlserde(alias(b"lblAlgn"))]
    lbl_algn: Option<Unparsed>,
    #[xmlserde(name = b"c:lblOffset", ty = "child")]
    #[xmlserde(alias(b"lblOffset"))]
    lbl_offset: Option<Unparsed>,
    #[xmlserde(name = b"c:noMultiLvlLbl", ty = "child")]
    #[xmlserde(alias(b"noMultiLvlLbl"))]
    no_multi_lvl_lbl: Option<Unparsed>,
    #[xmlserde(name = b"c:tickLblSkip", ty = "child")]
    #[xmlserde(alias(b"tickLblSkip"))]
    tick_lbl_skip: Option<Unparsed>,
    #[xmlserde(name = b"c:tickMarkSkip", ty = "child")]
    #[xmlserde(alias(b"tickMarkSkip"))]
    tick_mark_skip: Option<Unparsed>,
}

impl CtAxis {
    fn scale(&self) -> AxisScale {
        let sc = self.scaling.as_ref();
        AxisScale {
            min: sc.and_then(|s| s.min.as_ref()).and_then(|v| v.val),
            max: sc.and_then(|s| s.max.as_ref()).and_then(|v| v.val),
            log_base: sc.and_then(|s| s.log_base.as_ref()).and_then(|v| v.val),
            reversed: sc
                .and_then(|s| s.orientation.as_ref())
                .and_then(|o| o.val.as_deref())
                == Some("maxMin"),
            major_unit: self.major_unit.as_ref().and_then(|v| v.val),
            minor_unit: self.minor_unit.as_ref().and_then(|v| v.val),
        }
    }

    fn preserved(&self) -> PreservedAxis {
        PreservedAxis {
            delete: self.delete.clone(),
            ax_pos: self.ax_pos.clone(),
            major_gridlines: self.major_gridlines.clone(),
            minor_gridlines: self.minor_gridlines.clone(),
            major_tick_mark: self.major_tick_mark.clone(),
            minor_tick_mark: self.minor_tick_mark.clone(),
            tick_lbl_pos: self.tick_lbl_pos.clone(),
            sp_pr: self.sp_pr.clone(),
            tx_pr: self.tx_pr.clone(),
            crosses: self.crosses.clone(),
            crosses_at: self.crosses_at.clone(),
            cross_between: self.cross_between.clone(),
            auto: self.auto.clone(),
            lbl_algn: self.lbl_algn.clone(),
            lbl_offset: self.lbl_offset.clone(),
            no_multi_lvl_lbl: self.no_multi_lvl_lbl.clone(),
            tick_lbl_skip: self.tick_lbl_skip.clone(),
            tick_mark_skip: self.tick_mark_skip.clone(),
        }
    }
}

/// `c:scaling` — the axis' value range and direction.
#[derive(Debug, XmlDeserialize, Default)]
struct CtScaling {
    #[xmlserde(name = b"c:logBase", ty = "child")]
    #[xmlserde(alias(b"logBase"))]
    log_base: Option<CtF64Attr>,
    #[xmlserde(name = b"c:orientation", ty = "child")]
    #[xmlserde(alias(b"orientation"))]
    orientation: Option<CtStrAttr>,
    #[xmlserde(name = b"c:max", ty = "child")]
    #[xmlserde(alias(b"max"))]
    max: Option<CtF64Attr>,
    #[xmlserde(name = b"c:min", ty = "child")]
    #[xmlserde(alias(b"min"))]
    min: Option<CtF64Attr>,
}

/// `c:numFmt` — a format code plus the "linked to source" flag (which we do
/// not model: a linked format is simply absent here and the renderer falls back
/// to the source cells' format).
#[derive(Debug, XmlDeserialize, Default)]
struct CtNumFmt {
    #[xmlserde(name = b"formatCode", ty = "attr")]
    format_code: Option<String>,
}

/// `c:dLbls` — which parts of a data point are written next to it.
#[derive(Debug, XmlDeserialize, Default)]
struct CtDLbls {
    #[xmlserde(name = b"c:numFmt", ty = "child")]
    #[xmlserde(alias(b"numFmt"))]
    num_fmt: Option<CtNumFmt>,
    #[xmlserde(name = b"c:dLblPos", ty = "child")]
    #[xmlserde(alias(b"dLblPos"))]
    pos: Option<CtStrAttr>,
    #[xmlserde(name = b"c:showLegendKey", ty = "child")]
    #[xmlserde(alias(b"showLegendKey"))]
    show_legend_key: Option<CtStrAttr>,
    #[xmlserde(name = b"c:showVal", ty = "child")]
    #[xmlserde(alias(b"showVal"))]
    show_val: Option<CtStrAttr>,
    #[xmlserde(name = b"c:showCatName", ty = "child")]
    #[xmlserde(alias(b"showCatName"))]
    show_cat_name: Option<CtStrAttr>,
    #[xmlserde(name = b"c:showSerName", ty = "child")]
    #[xmlserde(alias(b"showSerName"))]
    show_ser_name: Option<CtStrAttr>,
    #[xmlserde(name = b"c:showPercent", ty = "child")]
    #[xmlserde(alias(b"showPercent"))]
    show_percent: Option<CtStrAttr>,
}

impl CtDLbls {
    fn to_model(&self) -> DataLabels {
        DataLabels {
            show_value: flag(self.show_val.as_ref()),
            show_category: flag(self.show_cat_name.as_ref()),
            show_series: flag(self.show_ser_name.as_ref()),
            show_percent: flag(self.show_percent.as_ref()),
            show_legend_key: flag(self.show_legend_key.as_ref()),
            position: self.pos.as_ref().and_then(|p| p.val.clone()),
            num_fmt: self
                .num_fmt
                .as_ref()
                .and_then(|n| n.format_code.clone())
                .and_then(explicit_format),
        }
    }
}

/// An OOXML boolean attribute: `1`/`true` are on, everything else (including a
/// missing element) is off.
fn flag(attr: Option<&CtStrAttr>) -> bool {
    matches!(
        attr.and_then(|a| a.val.as_deref()),
        Some("1") | Some("true")
    )
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
struct CtF64Attr {
    #[xmlserde(name = b"val", ty = "attr")]
    val: Option<f64>,
}

#[derive(Debug, XmlDeserialize, Default)]
struct CtText {
    #[xmlserde(ty = "text")]
    v: String,
}

/// A `formatCode` that actually says something. `General` is the absence of a
/// format, so it is reported as `None` — otherwise an editor would show it as
/// an explicit setting and writing it back would pin the axis to it.
fn explicit_format(s: String) -> Option<String> {
    if s.trim().is_empty() || s.trim().eq_ignore_ascii_case("general") {
        None
    } else {
        Some(s)
    }
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

/// Convenience constructors for authoring a chart from scratch (no cached
/// values: everything is read live from the references).
impl ChartSeries {
    pub fn new(name: Option<String>, val_ref: String) -> Self {
        ChartSeries {
            name,
            val_ref: Some(val_ref),
            cached_values: Vec::new(),
            size_ref: None,
            cached_sizes: Vec::new(),
            format_code: None,
            color: None,
            series_type: None,
            preserved: PreservedSeries::default(),
        }
    }
}

impl ChartData {
    /// A brand-new chart: the given type/title/series, a bottom legend (what
    /// Excel inserts by default) and nothing else set.
    pub fn new(
        chart_type: ChartType,
        title: Option<String>,
        categories_ref: Option<String>,
        series: Vec<ChartSeries>,
    ) -> Self {
        ChartData {
            chart_type,
            stacked: false,
            title,
            legend_pos: Some(LegendPos::Bottom),
            cat_ref: categories_ref,
            categories: Vec::new(),
            series,
            cat_axis_title: None,
            val_axis_title: None,
            data_labels: DataLabels::default(),
            val_axis_num_fmt: None,
            cat_axis_scale: AxisScale::default(),
            val_axis_scale: AxisScale::default(),
            of_pie_split: OfPieSplit::default(),
            preserved: Box::default(),
        }
    }
}

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// Generate a `c:chartSpace` for `data`. `numCache` is intentionally omitted —
/// values are resolved live from the series references (see
/// `Worksheet::get_charts`), and Excel recomputes the cache on open. The result
/// parses cleanly back through [`parse_chart`], so this is also how an existing
/// chart is re-authored after an edit: parse → patch → build.
pub fn build_chart_xml(data: &ChartData) -> String {
    const AX_CAT: u64 = 111_111_111;
    const AX_VAL: u64 = 222_222_222;
    // Only a surface uses the third axis.
    const AX_SER: u64 = 333_333_333;
    let chart_type = &data.chart_type;
    let kept = &data.preserved;

    let mut s = String::with_capacity(2048);
    s.push_str(r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>"#);
    s.push_str(
        r#"<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">"#,
    );
    push_preserved(&mut s, "c:date1904", &kept.date1904);
    push_preserved(&mut s, "c:lang", &kept.lang);
    push_preserved(&mut s, "c:roundedCorners", &kept.rounded_corners);
    push_preserved(&mut s, "mc:AlternateContent", &kept.style);
    s.push_str("<c:chart>");
    match data.title.as_deref() {
        Some(t) if !t.is_empty() => {
            s.push_str("<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>");
            s.push_str(&xml_escape(t));
            s.push_str("</a:t></a:r></a:p></c:rich></c:tx>");
            push_preserved(&mut s, "c:layout", &kept.title_layout);
            match &kept.title_overlay {
                Some(o) => s.push_str(&render_unparsed("c:overlay", o)),
                None => s.push_str("<c:overlay val=\"0\"/>"),
            }
            push_preserved(&mut s, "c:spPr", &kept.title_sp_pr);
            push_preserved(&mut s, "c:txPr", &kept.title_tx_pr);
            s.push_str("</c:title>");
            s.push_str("<c:autoTitleDeleted val=\"0\"/>");
        }
        _ => s.push_str("<c:autoTitleDeleted val=\"1\"/>"),
    }
    push_preserved(&mut s, "c:view3D", &kept.view_3d);
    push_preserved(&mut s, "c:floor", &kept.floor);
    push_preserved(&mut s, "c:sideWall", &kept.side_wall);
    push_preserved(&mut s, "c:backWall", &kept.back_wall);
    s.push_str("<c:plotArea>");
    match &kept.plot_layout {
        Some(l) => s.push_str(&render_unparsed("c:layout", l)),
        None => s.push_str("<c:layout/>"),
    }

    // Scatter and bubble both plot X against Y, so both need two value axes;
    // radar, stock and surface are category-vs-value like the plain kinds.
    let xy = matches!(chart_type, ChartType::Scatter | ChartType::Bubble);
    let cartesian = chart_type.is_cartesian();
    let labels = &data.data_labels;
    let group = &kept.group;

    push_plot_groups(&mut s, data, labels, group, (AX_CAT, AX_VAL, AX_SER));

    if cartesian {
        push_axis(&mut s, Axis::Cat, AX_CAT, AX_VAL, data);
        push_axis(&mut s, Axis::Val, AX_VAL, AX_CAT, data);
        if chart_type.needs_series_axis() {
            push_axis(&mut s, Axis::Ser, AX_SER, AX_VAL, data);
        }
    } else if xy {
        // Scatter has two value axes: X along the bottom, Y at the left. The
        // X one carries what would otherwise be the category axis' settings.
        push_axis(&mut s, Axis::ScatterX, AX_CAT, AX_VAL, data);
        push_axis(&mut s, Axis::Val, AX_VAL, AX_CAT, data);
    }

    push_preserved(&mut s, "c:dTable", &kept.data_table);
    push_preserved(&mut s, "c:spPr", &kept.plot_sp_pr);
    s.push_str("</c:plotArea>");
    if let Some(pos) = &data.legend_pos {
        let v = match pos {
            LegendPos::Top => "t",
            LegendPos::Bottom => "b",
            LegendPos::Left => "l",
            LegendPos::Right => "r",
        };
        s.push_str(&format!("<c:legend><c:legendPos val=\"{}\"/>", v));
        push_preserved(&mut s, "c:layout", &kept.legend_layout);
        match &kept.legend_overlay {
            Some(o) => s.push_str(&render_unparsed("c:overlay", o)),
            None => s.push_str("<c:overlay val=\"0\"/>"),
        }
        push_preserved(&mut s, "c:spPr", &kept.legend_sp_pr);
        push_preserved(&mut s, "c:txPr", &kept.legend_tx_pr);
        s.push_str("</c:legend>");
    }
    match &kept.plot_vis_only {
        Some(p) => s.push_str(&render_unparsed("c:plotVisOnly", p)),
        None => s.push_str("<c:plotVisOnly val=\"1\"/>"),
    }
    match &kept.disp_blanks_as {
        Some(d) => s.push_str(&render_unparsed("c:dispBlanksAs", d)),
        None => s.push_str("<c:dispBlanksAs val=\"gap\"/>"),
    }
    push_preserved(&mut s, "c:showDLblsOverMax", &kept.show_d_lbls_over_max);
    s.push_str("</c:chart>");
    push_preserved(&mut s, "c:spPr", &kept.chart_space_sp_pr);
    push_preserved(&mut s, "c:txPr", &kept.chart_space_tx_pr);
    push_preserved(&mut s, "c:externalData", &kept.external_data);
    push_preserved(&mut s, "c:printSettings", &kept.print_settings);
    s.push_str("</c:chartSpace>");
    s
}

/// Emit every plot group the chart needs.
///
/// A chart is a combo when its series do not all agree on a kind. The chart's
/// own `chart_type` leads and keeps the settings the file carried; each further
/// kind gets a group of its own, in the order the series first ask for it, with
/// default settings — per-group settings of a secondary group are not modeled.
///
/// Overrides only apply when both the chart and the override are combinable
/// kinds; anything else is folded back into the primary group so the result
/// stays a chart Excel will open.
fn push_plot_groups(
    s: &mut String,
    data: &ChartData,
    labels: &DataLabels,
    group: &PreservedGroup,
    ax: (u64, u64, u64),
) {
    let primary = &data.chart_type;
    let kind_of = |ser: &ChartSeries| -> ChartType {
        match &ser.series_type {
            Some(k) if primary.is_combinable() && k.is_combinable() => k.clone(),
            _ => primary.clone(),
        }
    };

    // The primary group first, then each override kind in first-use order.
    let mut order: Vec<ChartType> = vec![primary.clone()];
    for ser in &data.series {
        let k = kind_of(ser);
        if !order.contains(&k) {
            order.push(k);
        }
    }

    let empty = PreservedGroup::EMPTY;
    for (i, kind) in order.iter().enumerate() {
        // Each series keeps the position it has in the model, so `c:order`
        // describes the chart's own series order rather than the order the
        // groups happen to be written in — otherwise every edit would
        // reshuffle a combo chart.
        let members: Vec<(usize, &ChartSeries)> = data
            .series
            .iter()
            .enumerate()
            .filter(|(_, ser)| kind_of(ser) == *kind)
            .collect();
        // The primary group is written even when it has no series, so a chart
        // whose series were all overridden still declares its own kind.
        if members.is_empty() && i > 0 {
            continue;
        }
        push_plot_group(
            s,
            kind,
            data,
            &members,
            labels,
            if i == 0 { group } else { &empty },
            // Stacking belongs to the group the file described.
            i == 0 && data.stacked,
            ax,
        );
    }
}

/// One `c:*Chart` plot group: the element for `chart_type`, its settings and
/// its series. A combo chart calls this once per group, so everything here is
/// scoped to the group — the axes are the caller's job.
#[allow(non_snake_case)]
fn push_plot_group(
    s: &mut String,
    chart_type: &ChartType,
    data: &ChartData,
    series: &[(usize, &ChartSeries)],
    labels: &DataLabels,
    group: &PreservedGroup,
    stacked: bool,
    ax: (u64, u64, u64),
) {
    let (AX_CAT, AX_VAL, AX_SER) = ax;
    let categories_ref = data.cat_ref.as_deref();
    match chart_type {
        // The 3-D kinds share their flat sibling's arm: same series, same
        // settings, plus a depth axis and the depth-only children.
        ChartType::Col | ChartType::Bar | ChartType::Col3d | ChartType::Bar3d => {
            let three_d = chart_type.is_3d();
            let dir = if matches!(chart_type, ChartType::Bar | ChartType::Bar3d) {
                "bar"
            } else {
                "col"
            };
            let tag = if three_d { "bar3DChart" } else { "barChart" };
            let grouping = if stacked { "stacked" } else { "clustered" };
            s.push_str(&format!("<c:{}>", tag));
            s.push_str(&format!("<c:barDir val=\"{}\"/>", dir));
            s.push_str(&format!("<c:grouping val=\"{}\"/>", grouping));
            push_vary_colors(s, group);
            push_series_list(s, categories_ref, series, labels, chart_type);
            push_data_labels(s, labels);
            push_preserved(s, "c:gapWidth", &group.gap_width);
            if three_d {
                push_preserved(s, "c:gapDepth", &group.gap_depth);
                push_preserved(s, "c:shape", &group.shape);
            } else {
                // Stacked bars must not be offset from each other; an authored
                // overlap only survives while the chart stays unstacked. The
                // 3-D form has no overlap at all — depth separates the series.
                match (&group.overlap, stacked) {
                    (_, true) => s.push_str("<c:overlap val=\"100\"/>"),
                    (Some(o), false) => s.push_str(&render_unparsed("c:overlap", o)),
                    (None, false) => {}
                }
            }
            push_axis_ids(s, chart_type, AX_CAT, AX_VAL, AX_SER);
            s.push_str(&format!("</c:{}>", tag));
        }
        ChartType::Line | ChartType::Area | ChartType::Line3d | ChartType::Area3d => {
            let three_d = chart_type.is_3d();
            let area = matches!(chart_type, ChartType::Area | ChartType::Area3d);
            let tag = match (area, three_d) {
                (true, false) => "areaChart",
                (true, true) => "area3DChart",
                (false, false) => "lineChart",
                (false, true) => "line3DChart",
            };
            let grouping = if stacked { "stacked" } else { "standard" };
            s.push_str(&format!("<c:{}>", tag));
            s.push_str(&format!("<c:grouping val=\"{}\"/>", grouping));
            push_vary_colors(s, group);
            push_series_list(s, categories_ref, series, labels, chart_type);
            push_data_labels(s, labels);
            push_preserved(s, "c:dropLines", &group.drop_lines);
            if matches!(chart_type, ChartType::Line) {
                push_preserved(s, "c:marker", &group.marker);
            }
            if three_d {
                push_preserved(s, "c:gapDepth", &group.gap_depth);
            }
            push_axis_ids(s, chart_type, AX_CAT, AX_VAL, AX_SER);
            s.push_str(&format!("</c:{}>", tag));
        }
        ChartType::Pie | ChartType::Doughnut | ChartType::Pie3d => {
            let doughnut = matches!(chart_type, ChartType::Doughnut);
            let three_d = matches!(chart_type, ChartType::Pie3d);
            let tag = match (doughnut, three_d) {
                (true, _) => "doughnutChart",
                (false, true) => "pie3DChart",
                (false, false) => "pieChart",
            };
            s.push_str(&format!("<c:{}>", tag));
            match &group.vary_colors {
                Some(v) => s.push_str(&render_unparsed("c:varyColors", v)),
                None => s.push_str("<c:varyColors val=\"1\"/>"),
            }
            push_series_list(s, categories_ref, series, labels, chart_type);
            push_data_labels(s, labels);
            // `c:firstSliceAng` belongs to the flat pie and the doughnut; a
            // 3-D pie has no such child.
            if !three_d {
                push_preserved(s, "c:firstSliceAng", &group.first_slice_ang);
            }
            if doughnut {
                match &group.hole_size {
                    Some(h) => s.push_str(&render_unparsed("c:holeSize", h)),
                    None => s.push_str("<c:holeSize val=\"50\"/>"),
                }
            }
            s.push_str(&format!("</c:{}>", tag));
        }
        ChartType::Radar => {
            s.push_str("<c:radarChart>");
            match &group.radar_style {
                Some(st) => s.push_str(&render_unparsed("c:radarStyle", st)),
                None => s.push_str("<c:radarStyle val=\"marker\"/>"),
            }
            push_vary_colors(s, group);
            push_series_list(s, categories_ref, series, labels, chart_type);
            push_data_labels(s, labels);
            s.push_str(&format!(
                "<c:axId val=\"{}\"/><c:axId val=\"{}\"/>",
                AX_CAT, AX_VAL
            ));
            s.push_str("</c:radarChart>");
        }
        ChartType::Bubble => {
            s.push_str("<c:bubbleChart>");
            push_vary_colors(s, group);
            push_series_list(s, categories_ref, series, labels, chart_type);
            push_data_labels(s, labels);
            push_preserved(s, "c:bubble3D", &group.bubble_3d);
            push_preserved(s, "c:bubbleScale", &group.bubble_scale);
            push_preserved(s, "c:showNegBubbles", &group.show_neg_bubbles);
            push_preserved(s, "c:sizeRepresents", &group.size_represents);
            s.push_str(&format!(
                "<c:axId val=\"{}\"/><c:axId val=\"{}\"/>",
                AX_CAT, AX_VAL
            ));
            s.push_str("</c:bubbleChart>");
        }
        ChartType::Stock => {
            // A stock chart is a line group whose series *are* the price
            // components, so it carries no `c:grouping` of its own.
            s.push_str("<c:stockChart>");
            push_series_list(s, categories_ref, series, labels, chart_type);
            push_data_labels(s, labels);
            push_preserved(s, "c:dropLines", &group.drop_lines);
            push_preserved(s, "c:hiLowLines", &group.hi_low_lines);
            push_preserved(s, "c:upDownBars", &group.up_down_bars);
            s.push_str(&format!(
                "<c:axId val=\"{}\"/><c:axId val=\"{}\"/>",
                AX_CAT, AX_VAL
            ));
            s.push_str("</c:stockChart>");
        }
        ChartType::OfPie | ChartType::BarOfPie => {
            let bar = matches!(chart_type, ChartType::BarOfPie);
            s.push_str("<c:ofPieChart>");
            s.push_str(&format!(
                "<c:ofPieType val=\"{}\"/>",
                if bar { "bar" } else { "pie" }
            ));
            match &group.vary_colors {
                Some(v) => s.push_str(&render_unparsed("c:varyColors", v)),
                None => s.push_str("<c:varyColors val=\"1\"/>"),
            }
            push_series_list(s, categories_ref, series, labels, chart_type);
            push_data_labels(s, labels);
            push_preserved(s, "c:gapWidth", &group.gap_width);
            let split = &data.of_pie_split;
            if let Some(by) = &split.by {
                s.push_str(&format!("<c:splitType val=\"{}\"/>", xml_escape(by)));
            }
            if let Some(pos) = split.pos {
                s.push_str(&format!("<c:splitPos val=\"{}\"/>", pos));
            }
            push_preserved(s, "c:custSplit", &group.cust_split);
            if let Some(size) = split.second_size {
                s.push_str(&format!("<c:secondPieSize val=\"{}\"/>", size));
            }
            push_preserved_all(s, "c:serLines", &group.ser_lines);
            s.push_str("</c:ofPieChart>");
        }
        ChartType::Surface | ChartType::Surface3d => {
            let flat = matches!(chart_type, ChartType::Surface);
            let tag = if flat {
                "surfaceChart"
            } else {
                "surface3DChart"
            };
            s.push_str(&format!("<c:{}>", tag));
            push_preserved(s, "c:wireframe", &group.wireframe);
            push_series_list(s, categories_ref, series, labels, chart_type);
            push_preserved(s, "c:bandFmts", &group.band_fmts);
            push_axis_ids(s, chart_type, AX_CAT, AX_VAL, AX_SER);
            s.push_str(&format!("</c:{}>", tag));
        }
        ChartType::Scatter => {
            s.push_str("<c:scatterChart>");
            match &group.scatter_style {
                Some(st) => s.push_str(&render_unparsed("c:scatterStyle", st)),
                None => s.push_str("<c:scatterStyle val=\"lineMarker\"/>"),
            }
            push_vary_colors(s, group);
            push_series_list(s, categories_ref, series, labels, chart_type);
            push_data_labels(s, labels);
            s.push_str(&format!(
                "<c:axId val=\"{}\"/><c:axId val=\"{}\"/>",
                AX_CAT, AX_VAL
            ));
            s.push_str("</c:scatterChart>");
        }
    }
}

/// The axis ids a plot group declares: the usual pair, plus the depth axis for
/// the kinds that have one.
fn push_axis_ids(s: &mut String, kind: &ChartType, cat: u64, val: u64, ser: u64) {
    s.push_str(&format!(
        "<c:axId val=\"{}\"/><c:axId val=\"{}\"/>",
        cat, val
    ));
    if kind.needs_series_axis() {
        s.push_str(&format!("<c:axId val=\"{}\"/>", ser));
    }
}

fn push_vary_colors(s: &mut String, group: &PreservedGroup) {
    match &group.vary_colors {
        Some(v) => s.push_str(&render_unparsed("c:varyColors", v)),
        None => s.push_str("<c:varyColors val=\"0\"/>"),
    }
}

/// Which axis is being written. `ScatterX` is a value axis that sits where the
/// category axis normally would, and so takes the category axis' settings.
enum Axis {
    Cat,
    Val,
    ScatterX,
    /// A surface chart's third axis (`c:serAx`).
    Ser,
}

/// One axis element, in schema order: our generated identity and scale, then
/// everything the file had that this model does not interpret.
fn push_axis(s: &mut String, which: Axis, ax_id: u64, cross_ax: u64, data: &ChartData) {
    let (tag, kept, scale, title, num_fmt, default_pos) = match which {
        Axis::Cat => (
            "c:catAx",
            &data.preserved.cat_axis,
            &data.cat_axis_scale,
            data.cat_axis_title.as_deref(),
            None,
            "b",
        ),
        Axis::ScatterX => (
            "c:valAx",
            &data.preserved.cat_axis,
            &data.cat_axis_scale,
            data.cat_axis_title.as_deref(),
            None,
            "b",
        ),
        Axis::Val => (
            "c:valAx",
            &data.preserved.val_axis,
            &data.val_axis_scale,
            data.val_axis_title.as_deref(),
            data.val_axis_num_fmt.as_deref(),
            "l",
        ),
        Axis::Ser => (
            "c:serAx",
            &data.preserved.ser_axis,
            &data.cat_axis_scale,
            None,
            None,
            "b",
        ),
    };
    s.push_str(&format!("<{}><c:axId val=\"{}\"/>", tag, ax_id));
    // The series axis indexes series, not values, so it is always automatic.
    if matches!(which, Axis::Ser) {
        push_scaling(s, &AxisScale::default());
    } else {
        push_scaling(s, scale);
    }
    match &kept.delete {
        Some(d) => s.push_str(&render_unparsed("c:delete", d)),
        None => s.push_str("<c:delete val=\"0\"/>"),
    }
    match &kept.ax_pos {
        Some(p) => s.push_str(&render_unparsed("c:axPos", p)),
        None => s.push_str(&format!("<c:axPos val=\"{}\"/>", default_pos)),
    }
    match (&kept.major_gridlines, matches!(which, Axis::Val)) {
        (Some(g), _) => s.push_str(&render_unparsed("c:majorGridlines", g)),
        // A fresh value axis gets gridlines, which is Excel's default.
        (None, true) => s.push_str("<c:majorGridlines/>"),
        (None, false) => {}
    }
    push_preserved(s, "c:minorGridlines", &kept.minor_gridlines);
    push_axis_title(s, title);
    if let Some(fmt) = num_fmt {
        s.push_str(&format!(
            "<c:numFmt formatCode=\"{}\" sourceLinked=\"0\"/>",
            xml_escape(fmt)
        ));
    }
    push_preserved(s, "c:majorTickMark", &kept.major_tick_mark);
    push_preserved(s, "c:minorTickMark", &kept.minor_tick_mark);
    push_preserved(s, "c:tickLblPos", &kept.tick_lbl_pos);
    push_preserved(s, "c:spPr", &kept.sp_pr);
    push_preserved(s, "c:txPr", &kept.tx_pr);
    s.push_str(&format!("<c:crossAx val=\"{}\"/>", cross_ax));
    // `crosses` and `crossesAt` are mutually exclusive.
    match (&kept.crosses, &kept.crosses_at) {
        (Some(c), _) => s.push_str(&render_unparsed("c:crosses", c)),
        (None, Some(c)) => s.push_str(&render_unparsed("c:crossesAt", c)),
        (None, None) => {}
    }
    if matches!(which, Axis::Ser) {
        push_preserved(s, "c:tickLblSkip", &kept.tick_lbl_skip);
        push_preserved(s, "c:tickMarkSkip", &kept.tick_mark_skip);
    } else if matches!(which, Axis::Cat) {
        push_preserved(s, "c:auto", &kept.auto);
        push_preserved(s, "c:lblAlgn", &kept.lbl_algn);
        push_preserved(s, "c:lblOffset", &kept.lbl_offset);
        push_preserved(s, "c:tickLblSkip", &kept.tick_lbl_skip);
        push_preserved(s, "c:tickMarkSkip", &kept.tick_mark_skip);
        push_preserved(s, "c:noMultiLvlLbl", &kept.no_multi_lvl_lbl);
    } else {
        push_preserved(s, "c:crossBetween", &kept.cross_between);
        if let Some(u) = scale.major_unit {
            s.push_str(&format!("<c:majorUnit val=\"{}\"/>", u));
        }
        if let Some(u) = scale.minor_unit {
            s.push_str(&format!("<c:minorUnit val=\"{}\"/>", u));
        }
    }
    s.push_str(&format!("</{}>", tag.trim_start_matches('<')));
}

/// `c:scaling` — required on every axis, so it is always written even when the
/// scale is entirely automatic.
fn push_scaling(s: &mut String, scale: &AxisScale) {
    s.push_str("<c:scaling>");
    if let Some(b) = scale.log_base {
        s.push_str(&format!("<c:logBase val=\"{}\"/>", b));
    }
    s.push_str(&format!(
        "<c:orientation val=\"{}\"/>",
        if scale.reversed { "maxMin" } else { "minMax" }
    ));
    if let Some(m) = scale.max {
        s.push_str(&format!("<c:max val=\"{}\"/>", m));
    }
    if let Some(m) = scale.min {
        s.push_str(&format!("<c:min val=\"{}\"/>", m));
    }
    s.push_str("</c:scaling>");
}

fn push_axis_title(s: &mut String, title: Option<&str>) {
    let Some(t) = title.filter(|t| !t.is_empty()) else {
        return;
    };
    s.push_str("<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>");
    s.push_str(&xml_escape(t));
    s.push_str("</a:t></a:r></a:p></c:rich></c:tx><c:overlay val=\"0\"/></c:title>");
}

/// `c:dLbls` for the plot group. Written only when something is shown — an
/// all-off element is legal but noise, and its absence means the same thing.
fn push_data_labels(s: &mut String, labels: &DataLabels) {
    if !labels.any() {
        return;
    }
    s.push_str("<c:dLbls>");
    if let Some(fmt) = &labels.num_fmt {
        s.push_str(&format!(
            "<c:numFmt formatCode=\"{}\" sourceLinked=\"0\"/>",
            xml_escape(fmt)
        ));
    }
    if let Some(pos) = &labels.position {
        s.push_str(&format!("<c:dLblPos val=\"{}\"/>", xml_escape(pos)));
    }
    let b = |v: bool| if v { "1" } else { "0" };
    s.push_str(&format!(
        "<c:showLegendKey val=\"{}\"/><c:showVal val=\"{}\"/><c:showCatName val=\"{}\"/><c:showSerName val=\"{}\"/><c:showPercent val=\"{}\"/><c:showBubbleSize val=\"0\"/>",
        b(labels.show_legend_key),
        b(labels.show_value),
        b(labels.show_category),
        b(labels.show_series),
        b(labels.show_percent),
    ));
    s.push_str("</c:dLbls>");
}

/// The series' shape properties: the authored `c:spPr` verbatim when it is
/// still valid, or a minimal fill when the editor set a color (which clears
/// the preserved subtree, since it no longer describes the series).
fn push_series_shape(s: &mut String, ser: &ChartSeries) {
    if let Some(raw) = &ser.preserved.sp_pr {
        s.push_str(&render_unparsed("c:spPr", raw));
        return;
    }
    let Some(color) = &ser.color else { return };
    s.push_str("<c:spPr><a:solidFill>");
    match color {
        SeriesColor::Srgb(hex) => s.push_str(&format!("<a:srgbClr val=\"{}\"/>", xml_escape(hex))),
        SeriesColor::Scheme(name) => {
            s.push_str(&format!("<a:schemeClr val=\"{}\"/>", xml_escape(name)))
        }
    }
    s.push_str("</a:solidFill></c:spPr>");
}

/// The `idx`/`order`/`tx`/`spPr` head shared by every series flavor, plus the
/// per-kind bits the file carried (markers, exploded slices, per-point
/// formatting) in schema order.
fn push_series_head(
    s: &mut String,
    i: usize,
    ser: &ChartSeries,
    labels: &DataLabels,
    kind: &ChartType,
) {
    s.push_str("<c:ser>");
    s.push_str(&format!("<c:idx val=\"{}\"/><c:order val=\"{}\"/>", i, i));
    if let Some(name) = &ser.name {
        s.push_str("<c:tx><c:v>");
        s.push_str(&xml_escape(name));
        s.push_str("</c:v></c:tx>");
    }
    push_series_shape(s, ser);
    let kept = &ser.preserved;
    // A surface series is just a row of the grid: the schema gives it nothing
    // between the shape properties and the data, not even labels.
    if kind.is_surface() {
        return;
    }
    match &kind.flattened() {
        ChartType::Col | ChartType::Bar | ChartType::Bubble => {
            push_preserved(s, "c:invertIfNegative", &kept.invert_if_negative)
        }
        ChartType::Line | ChartType::Scatter | ChartType::Radar | ChartType::Stock => {
            push_preserved(s, "c:marker", &kept.marker)
        }
        ChartType::Pie | ChartType::Doughnut | ChartType::OfPie | ChartType::BarOfPie => {
            push_preserved(s, "c:explosion", &kept.explosion)
        }
        ChartType::Area => {}
        // `flattened()` maps every 3-D kind onto one of the above, and the
        // surfaces returned early.
        _ => {}
    }
    push_preserved_all(s, "c:dPt", &kept.d_pt);
    // Per-series labels mirror the group setting: readers that only look at
    // the series (and our own fallback path) then agree with the group.
    push_data_labels(s, labels);
    // An of-pie series carries neither, and a pie series never has them.
    if !kind.is_of_pie() && !matches!(kind, ChartType::Pie | ChartType::Doughnut) {
        push_preserved_all(s, "c:trendline", &kept.trendline);
        push_preserved(s, "c:errBars", &kept.err_bars);
    }
}

/// The trailing child a series may carry: `c:smooth` on a line/scatter,
/// `c:bubble3D` on a bubble.
fn push_series_tail(s: &mut String, ser: &ChartSeries, kind: &ChartType) {
    // A 3-D line has no `c:smooth`; everything else follows its flat form.
    match &kind.flattened() {
        ChartType::Line | ChartType::Scatter | ChartType::Stock if !kind.is_3d() => {
            push_preserved(s, "c:smooth", &ser.preserved.smooth)
        }
        ChartType::Bubble => push_preserved(s, "c:bubble3D", &ser.preserved.bubble_3d),
        _ => {}
    }
    s.push_str("</c:ser>");
}

/// The `c:ser` list. `kind` decides which optional children are legal, so a
/// setting that only exists for one chart kind is not carried into another.
fn push_series_list(
    s: &mut String,
    cat_ref: Option<&str>,
    series: &[(usize, &ChartSeries)],
    labels: &DataLabels,
    kind: &ChartType,
) {
    // Scatter and bubble address their points as (x, y) pairs; everything else
    // pairs a category label with a value.
    let xy = matches!(kind, ChartType::Scatter | ChartType::Bubble);
    for (idx, ser) in series.iter() {
        let Some(val_ref) = &ser.val_ref else {
            continue;
        };
        // `idx`/`order` are the series' position in the chart as a whole, not
        // within this group — that is what keeps a combo chart's order stable.
        push_series_head(s, *idx, ser, labels, kind);
        let (cat_tag, val_tag, cat_wrapper) = if xy {
            ("c:xVal", "c:yVal", "c:numRef")
        } else {
            ("c:cat", "c:val", "c:strRef")
        };
        if let Some(cat) = cat_ref {
            s.push_str(&format!("<{}><{}><c:f>", cat_tag, cat_wrapper));
            s.push_str(&xml_escape(cat));
            s.push_str(&format!("</c:f></{}></{}>", cat_wrapper, cat_tag));
        }
        s.push_str(&format!("<{}><c:numRef><c:f>", val_tag));
        s.push_str(&xml_escape(val_ref));
        s.push_str(&format!("</c:f></c:numRef></{}>", val_tag));
        if matches!(kind, ChartType::Bubble) {
            if let Some(size) = &ser.size_ref {
                s.push_str("<c:bubbleSize><c:numRef><c:f>");
                s.push_str(&xml_escape(size));
                s.push_str("</c:f></c:numRef></c:bubbleSize>");
            }
        }
        push_series_tail(s, ser, kind);
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
            ChartSeries::new(Some("Revenue".to_string()), "Sheet1!$B$2:$E$2".to_string()),
            // Exercises escaping.
            ChartSeries::new(
                Some("Cost & <fees>".to_string()),
                "Sheet1!$B$3:$E$3".to_string(),
            ),
        ];
        let data = ChartData::new(
            ChartType::Col,
            Some("Quarterly".to_string()),
            Some("Sheet1!$B$1:$E$1".to_string()),
            series,
        );
        let xml = build_chart_xml(&data);
        let out = parse_chart(xml.as_bytes()).expect("generated chart parses");
        assert_eq!(out.chart_type, ChartType::Col);
        assert_eq!(out.title.as_deref(), Some("Quarterly"));
        assert_eq!(out.legend_pos, Some(LegendPos::Bottom));
        assert_eq!(out.series.len(), 2);
        assert_eq!(out.series[0].name.as_deref(), Some("Revenue"));
        assert_eq!(out.series[0].val_ref.as_deref(), Some("Sheet1!$B$2:$E$2"));
        assert_eq!(out.series[1].name.as_deref(), Some("Cost & <fees>"));
        assert_eq!(out.cat_ref.as_deref(), Some("Sheet1!$B$1:$E$1"));
        assert!(!out.data_labels.any());
    }

    /// Everything the editor can change must survive build → parse, otherwise
    /// an edit would silently drop the setting it did not touch.
    #[test]
    fn build_chart_xml_round_trips_full_settings() {
        let mut data = ChartData::new(
            ChartType::Bar,
            Some("Sales".to_string()),
            Some("Sheet1!$A$2:$A$5".to_string()),
            vec![
                ChartSeries::new(Some("2025".to_string()), "Sheet1!$B$2:$B$5".to_string()),
                ChartSeries::new(Some("2026".to_string()), "Sheet1!$C$2:$C$5".to_string()),
            ],
        );
        data.stacked = true;
        data.legend_pos = Some(LegendPos::Right);
        data.cat_axis_title = Some("Region".to_string());
        data.val_axis_title = Some("Amount".to_string());
        data.val_axis_num_fmt = Some("#,##0".to_string());
        data.data_labels = DataLabels {
            show_value: true,
            show_category: false,
            show_series: false,
            show_percent: true,
            show_legend_key: false,
            position: Some("ctr".to_string()),
            num_fmt: Some("0.0%".to_string()),
        };
        data.series[0].color = Some(SeriesColor::Srgb("FF0000".to_string()));
        data.series[1].color = Some(SeriesColor::Scheme("accent2".to_string()));

        let out = parse_chart(build_chart_xml(&data).as_bytes()).expect("parses");
        assert_eq!(out.chart_type, ChartType::Bar);
        assert!(out.stacked);
        assert_eq!(out.legend_pos, Some(LegendPos::Right));
        assert_eq!(out.cat_axis_title.as_deref(), Some("Region"));
        assert_eq!(out.val_axis_title.as_deref(), Some("Amount"));
        assert_eq!(out.val_axis_num_fmt.as_deref(), Some("#,##0"));
        assert_eq!(out.data_labels, data.data_labels);
        assert_eq!(
            out.series[0].color,
            Some(SeriesColor::Srgb("FF0000".to_string()))
        );
        assert_eq!(
            out.series[1].color,
            Some(SeriesColor::Scheme("accent2".to_string()))
        );
    }

    /// The whole point of [`PreservedXml`]: re-authoring a chart that came
    /// from Excel must not strip the styling this model does not understand.
    /// Everything asserted here is XML we never interpret.
    #[test]
    fn rebuilding_keeps_unmodeled_styling() {
        let buf = std::fs::read("../../tests/graph.xlsx").unwrap();
        let wb = crate::workbook::Wb::from_file(&buf).unwrap();
        let bytes = wb
            .xl
            .worksheets
            .values()
            .filter_map(|w| w.drawing.as_ref())
            .flat_map(|d| d.chart_parts.iter())
            .find(|p| p.path.ends_with("chart1.xml"))
            .map(|p| p.data.clone())
            .expect("chart part present");

        let mut data = parse_chart(&bytes).expect("parses");
        // A realistic edit: change the kind and add a title.
        data.chart_type = ChartType::Line;
        data.title = Some("Edited".to_string());
        let out = build_chart_xml(&data);

        // Chart-area fill and border, and the workbook-wide default font.
        assert!(
            out.contains(r#"<c:spPr><a:solidFill><a:schemeClr val="bg1"/></a:solidFill>"#),
            "chart area fill kept"
        );
        assert!(out.contains("<c:printSettings>"), "print settings kept");
        assert!(
            out.contains("mc:AlternateContent"),
            "the built-in style id kept"
        );
        assert!(out.contains(r#"<c:date1904 val="0"/>"#), "date1904 kept");
        assert!(out.contains(r#"<c:lang val="zh-CN"/>"#), "lang kept");
        // Fonts: the title's and the axes' text properties.
        assert!(
            out.contains(r#"<a:defRPr lang="zh-CN" sz="1400""#),
            "title font kept"
        );
        assert!(
            out.contains(r#"<a:defRPr lang="zh-CN" sz="900""#),
            "axis font kept"
        );
        // Axis presentation: gridlines with their own line style, tick marks,
        // label position, and the axis line.
        assert!(
            out.contains("<c:majorGridlines><c:spPr>"),
            "styled gridlines kept"
        );
        assert!(
            out.contains(r#"<c:majorTickMark val="none"/>"#),
            "tick marks kept"
        );
        assert!(
            out.contains(r#"<c:tickLblPos val="nextTo"/>"#),
            "tick label position kept"
        );
        assert!(
            out.contains(r#"<c:lblOffset val="100"/>"#),
            "category label offset kept"
        );
        assert!(
            out.contains(r#"<c:crosses val="autoZero"/>"#),
            "axis crossing kept"
        );
        // Series shape properties survive whole — not reduced to a fill.
        assert!(
            out.contains(
                r#"<c:spPr><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:ln><a:noFill/></a:ln><a:effectLst/></c:spPr>"#
            ),
            "series line + effects kept, not just the fill"
        );
        // Legend text properties.
        assert!(out.contains("</c:txPr></c:legend>"), "legend font kept");

        // And it is still a valid chart afterwards.
        let re = parse_chart(out.as_bytes()).expect("rebuilt chart parses");
        assert_eq!(re.chart_type, ChartType::Line);
        assert_eq!(re.title.as_deref(), Some("Edited"));
        assert_eq!(re.series.len(), 3);
        assert_eq!(
            re.series[0].color,
            Some(SeriesColor::Scheme("accent1".to_string()))
        );
    }

    /// Settings that only make sense for one chart kind are written back only
    /// while that kind is in use — a bar chart's gap width must not leak into
    /// a pie.
    #[test]
    fn kind_specific_settings_are_scoped() {
        let buf = std::fs::read("../../tests/graph.xlsx").unwrap();
        let wb = crate::workbook::Wb::from_file(&buf).unwrap();
        let bytes = wb
            .xl
            .worksheets
            .values()
            .filter_map(|w| w.drawing.as_ref())
            .flat_map(|d| d.chart_parts.iter())
            .find(|p| p.path.ends_with("chart1.xml"))
            .map(|p| p.data.clone())
            .unwrap();
        let mut data = parse_chart(&bytes).unwrap();

        let as_bar = build_chart_xml(&data);
        assert!(
            as_bar.contains(r#"<c:gapWidth val="219"/>"#),
            "gap width kept"
        );
        assert!(as_bar.contains(r#"<c:overlap val="-27"/>"#), "overlap kept");
        assert!(
            as_bar.contains(r#"<c:invertIfNegative val="0"/>"#),
            "bar-only series flag kept"
        );

        data.chart_type = ChartType::Pie;
        let as_pie = build_chart_xml(&data);
        assert!(!as_pie.contains("gapWidth"), "gap width dropped for a pie");
        assert!(!as_pie.contains("overlap"), "overlap dropped for a pie");
        assert!(
            !as_pie.contains("invertIfNegative"),
            "bar-only series flag dropped for a pie"
        );
        assert!(parse_chart(as_pie.as_bytes()).is_some(), "still parses");

        // Stacking forces full overlap regardless of what the file said.
        data.chart_type = ChartType::Col;
        data.stacked = true;
        let stacked = build_chart_xml(&data);
        assert!(stacked.contains(r#"<c:overlap val="100"/>"#));
        assert!(!stacked.contains(r#"<c:overlap val="-27"/>"#));
    }

    #[test]
    fn axis_scale_round_trips() {
        let mut data = ChartData::new(
            ChartType::Col,
            None,
            None,
            vec![ChartSeries::new(None, "Sheet1!$B$2:$B$5".to_string())],
        );
        data.val_axis_scale = AxisScale {
            min: Some(-5.0),
            max: Some(120.5),
            log_base: Some(10.0),
            reversed: true,
            major_unit: Some(20.0),
            minor_unit: Some(5.0),
        };
        let out = parse_chart(build_chart_xml(&data).as_bytes()).expect("parses");
        assert_eq!(out.val_axis_scale, data.val_axis_scale);
        // An untouched axis stays fully automatic.
        assert_eq!(out.cat_axis_scale, AxisScale::default());
    }

    /// Setting a color replaces the series' shape properties; leaving colors
    /// alone keeps them byte-for-byte.
    #[test]
    fn setting_a_color_replaces_the_series_fill() {
        let buf = std::fs::read("../../tests/graph.xlsx").unwrap();
        let wb = crate::workbook::Wb::from_file(&buf).unwrap();
        let bytes = wb
            .xl
            .worksheets
            .values()
            .filter_map(|w| w.drawing.as_ref())
            .flat_map(|d| d.chart_parts.iter())
            .find(|p| p.path.ends_with("chart1.xml"))
            .map(|p| p.data.clone())
            .unwrap();
        let mut data = parse_chart(&bytes).unwrap();
        data.series[0].color = Some(SeriesColor::Srgb("FF0000".to_string()));
        data.series[0].preserved.sp_pr = None;

        let out = build_chart_xml(&data);
        let re = parse_chart(out.as_bytes()).unwrap();
        assert_eq!(
            re.series[0].color,
            Some(SeriesColor::Srgb("FF0000".to_string()))
        );
        // The other series kept theirs, effects and all.
        assert!(out.contains(
            r#"<c:spPr><a:solidFill><a:schemeClr val="accent2"/></a:solidFill><a:ln><a:noFill/></a:ln><a:effectLst/></c:spPr>"#
        ));
    }

    /// Radar plots categories as spokes, so it keeps the cat/val axis pair and
    /// the `c:cat`/`c:val` series shape.
    #[test]
    fn radar_chart_round_trips() {
        let mut data = ChartData::new(
            ChartType::Radar,
            Some("Skills".to_string()),
            Some("Sheet1!$A$2:$A$6".to_string()),
            vec![
                ChartSeries::new(Some("Me".to_string()), "Sheet1!$B$2:$B$6".to_string()),
                ChartSeries::new(Some("Team".to_string()), "Sheet1!$C$2:$C$6".to_string()),
            ],
        );
        data.data_labels.show_value = true;

        let xml = build_chart_xml(&data);
        assert!(xml.contains("<c:radarChart>"));
        assert!(xml.contains(r#"<c:radarStyle val="marker"/>"#));
        assert!(xml.contains("<c:catAx>"), "radar keeps a category axis");
        assert!(xml.contains("<c:cat><c:strRef>"));

        let out = parse_chart(xml.as_bytes()).expect("parses");
        assert_eq!(out.chart_type, ChartType::Radar);
        assert_eq!(out.title.as_deref(), Some("Skills"));
        assert_eq!(out.series.len(), 2);
        assert_eq!(out.series[1].val_ref.as_deref(), Some("Sheet1!$C$2:$C$6"));
        assert_eq!(out.cat_ref.as_deref(), Some("Sheet1!$A$2:$A$6"));
        assert!(out.data_labels.show_value);
    }

    /// Bubble carries a third reference per series and, like scatter, two value
    /// axes rather than a category axis.
    #[test]
    fn bubble_chart_round_trips() {
        let mut series = ChartSeries::new(Some("Products".to_string()), "Sheet1!$C$2:$C$6".into());
        series.size_ref = Some("Sheet1!$D$2:$D$6".to_string());
        let data = ChartData::new(
            ChartType::Bubble,
            None,
            Some("Sheet1!$B$2:$B$6".to_string()),
            vec![series],
        );

        let xml = build_chart_xml(&data);
        assert!(xml.contains("<c:bubbleChart>"));
        assert!(!xml.contains("<c:catAx>"), "bubble has two value axes");
        assert_eq!(xml.matches("<c:valAx>").count(), 2);
        assert!(xml.contains("<c:xVal><c:numRef>"), "X is numeric");
        assert!(xml.contains("<c:bubbleSize><c:numRef>"));

        let out = parse_chart(xml.as_bytes()).expect("parses");
        assert_eq!(out.chart_type, ChartType::Bubble);
        assert_eq!(out.series[0].val_ref.as_deref(), Some("Sheet1!$C$2:$C$6"));
        assert_eq!(out.series[0].size_ref.as_deref(), Some("Sheet1!$D$2:$D$6"));
        assert_eq!(out.cat_ref.as_deref(), Some("Sheet1!$B$2:$B$6"));
    }

    /// Switching an existing chart to bubble and back must not strip the size
    /// reference, and bubble-only settings must not leak into other kinds.
    #[test]
    fn bubble_settings_are_scoped() {
        let mut series = ChartSeries::new(None, "Sheet1!$C$2:$C$6".to_string());
        series.size_ref = Some("Sheet1!$D$2:$D$6".to_string());
        let mut data = ChartData::new(ChartType::Bubble, None, None, vec![series]);

        // The size ref survives a trip through another kind, because the model
        // keeps it even while the written XML has nowhere to put it.
        data.chart_type = ChartType::Col;
        let as_col = build_chart_xml(&data);
        assert!(!as_col.contains("bubbleSize"), "no bubbleSize on a column");
        assert!(!as_col.contains("bubbleScale"));
        assert_eq!(data.series[0].size_ref.as_deref(), Some("Sheet1!$D$2:$D$6"));

        data.chart_type = ChartType::Bubble;
        let back = parse_chart(build_chart_xml(&data).as_bytes()).unwrap();
        assert_eq!(back.series[0].size_ref.as_deref(), Some("Sheet1!$D$2:$D$6"));
    }

    /// Stock is a line group whose series are the price components. It must
    /// not gain a `c:grouping` (the schema has none) and keeps the drawn
    /// connectors between series.
    #[test]
    fn stock_chart_round_trips() {
        let data = ChartData::new(
            ChartType::Stock,
            Some("ACME".to_string()),
            Some("Sheet1!$A$2:$A$6".to_string()),
            vec![
                ChartSeries::new(Some("Open".into()), "Sheet1!$B$2:$B$6".into()),
                ChartSeries::new(Some("High".into()), "Sheet1!$C$2:$C$6".into()),
                ChartSeries::new(Some("Low".into()), "Sheet1!$D$2:$D$6".into()),
                ChartSeries::new(Some("Close".into()), "Sheet1!$E$2:$E$6".into()),
            ],
        );
        let xml = build_chart_xml(&data);
        assert!(xml.contains("<c:stockChart>"));
        assert!(!xml.contains("<c:grouping"), "stock has no grouping");
        assert!(xml.contains("<c:catAx>") && xml.contains("<c:valAx>"));

        let out = parse_chart(xml.as_bytes()).expect("parses");
        assert_eq!(out.chart_type, ChartType::Stock);
        assert_eq!(out.series.len(), 4);
        assert_eq!(out.series[3].name.as_deref(), Some("Close"));
        assert_eq!(out.series[3].val_ref.as_deref(), Some("Sheet1!$E$2:$E$6"));
    }

    /// Of-pie writes the split that decides which points land in the second
    /// plot; without it the chart is a plain pie on reload.
    #[test]
    fn of_pie_round_trips_with_its_split() {
        let mut data = ChartData::new(
            ChartType::OfPie,
            None,
            Some("Sheet1!$A$2:$A$8".to_string()),
            vec![ChartSeries::new(None, "Sheet1!$B$2:$B$8".to_string())],
        );
        data.of_pie_split = OfPieSplit {
            by: Some("pos".to_string()),
            pos: Some(3.0),
            second_size: Some(75.0),
        };

        let xml = build_chart_xml(&data);
        assert!(xml.contains(r#"<c:ofPieType val="pie"/>"#));
        assert!(xml.contains(r#"<c:splitType val="pos"/>"#));
        assert!(xml.contains(r#"<c:splitPos val="3"/>"#));
        assert!(xml.contains(r#"<c:secondPieSize val="75"/>"#));
        assert!(!xml.contains("<c:catAx>"), "of-pie has no axes");

        let out = parse_chart(xml.as_bytes()).expect("parses");
        assert_eq!(out.chart_type, ChartType::OfPie);
        assert_eq!(out.of_pie_split, data.of_pie_split);

        // The bar form differs only in `ofPieType`, and must survive as such.
        data.chart_type = ChartType::BarOfPie;
        let bar = parse_chart(build_chart_xml(&data).as_bytes()).expect("parses");
        assert_eq!(bar.chart_type, ChartType::BarOfPie);
        assert_eq!(bar.of_pie_split.by.as_deref(), Some("pos"));
    }

    /// A surface needs three axes; emitting only the usual pair produces a
    /// file Excel refuses. Its series also take no labels or markers.
    #[test]
    fn surface_chart_round_trips_with_three_axes() {
        let mut data = ChartData::new(
            ChartType::Surface,
            None,
            Some("Sheet1!$B$1:$E$1".to_string()),
            vec![
                ChartSeries::new(Some("r1".into()), "Sheet1!$B$2:$E$2".into()),
                ChartSeries::new(Some("r2".into()), "Sheet1!$B$3:$E$3".into()),
            ],
        );
        // Labels are on, but a surface series has nowhere to put them.
        data.data_labels.show_value = true;

        let xml = build_chart_xml(&data);
        assert!(xml.contains("<c:surfaceChart>"));
        // Three ids listed by the group, plus one on each of the three axis
        // elements it points at.
        assert_eq!(xml.matches("<c:axId").count(), 6);
        assert!(xml.contains("<c:serAx>"), "the third axis is written");
        assert!(
            !xml[xml.find("<c:ser>").unwrap()..xml.find("</c:ser>").unwrap()].contains("<c:dLbls>"),
            "a surface series carries no labels"
        );

        let out = parse_chart(xml.as_bytes()).expect("parses");
        assert_eq!(out.chart_type, ChartType::Surface);
        assert_eq!(out.series.len(), 2);

        // The 3-D form is a different element and must come back as one.
        data.chart_type = ChartType::Surface3d;
        let xml3 = build_chart_xml(&data);
        assert!(xml3.contains("<c:surface3DChart>"));
        assert_eq!(
            parse_chart(xml3.as_bytes()).unwrap().chart_type,
            ChartType::Surface3d
        );
    }

    /// Switching between the new kinds must not carry one kind's required
    /// children into another, which would make the XML invalid.
    #[test]
    fn new_kinds_do_not_leak_settings() {
        let mut data = ChartData::new(
            ChartType::OfPie,
            None,
            None,
            vec![ChartSeries::new(None, "Sheet1!$B$2:$B$8".to_string())],
        );
        data.of_pie_split = OfPieSplit {
            by: Some("val".to_string()),
            pos: Some(10.0),
            second_size: Some(60.0),
        };

        for ty in [
            ChartType::Col,
            ChartType::Pie,
            ChartType::Stock,
            ChartType::Surface,
        ] {
            data.chart_type = ty.clone();
            let xml = build_chart_xml(&data);
            assert!(!xml.contains("ofPieType"), "{:?} kept ofPieType", ty);
            assert!(!xml.contains("splitType"), "{:?} kept splitType", ty);
            assert!(!xml.contains("secondPieSize"), "{:?} kept the size", ty);
            assert!(
                parse_chart(xml.as_bytes()).is_some(),
                "{:?} still parses",
                ty
            );
        }
        // Only a surface writes the third axis.
        data.chart_type = ChartType::Stock;
        assert!(!build_chart_xml(&data).contains("<c:serAx>"));
        // And the split survives in the model, so switching back restores it.
        data.chart_type = ChartType::OfPie;
        let back = parse_chart(build_chart_xml(&data).as_bytes()).unwrap();
        assert_eq!(back.of_pie_split.pos, Some(10.0));
    }

    /// The 3-D kinds are the flat ones in a different element, with a depth
    /// axis. What matters is that each writes its own tag, that the ones with
    /// depth get three axes, and that a flat-only child never leaks in.
    #[test]
    fn three_d_kinds_round_trip() {
        let series = || {
            vec![
                ChartSeries::new(Some("a".into()), "Sheet1!$B$2:$E$2".into()),
                ChartSeries::new(Some("b".into()), "Sheet1!$B$3:$E$3".into()),
            ]
        };
        let cases = [
            (ChartType::Col3d, "bar3DChart", true),
            (ChartType::Bar3d, "bar3DChart", true),
            (ChartType::Line3d, "line3DChart", true),
            (ChartType::Area3d, "area3DChart", true),
            (ChartType::Pie3d, "pie3DChart", false),
        ];
        for (ty, tag, has_depth_axis) in cases {
            let data = ChartData::new(
                ty.clone(),
                Some("T".to_string()),
                Some("Sheet1!$B$1:$E$1".to_string()),
                series(),
            );
            let xml = build_chart_xml(&data);
            assert!(xml.contains(&format!("<c:{}>", tag)), "{:?} tag", ty);
            assert_eq!(
                xml.contains("<c:serAx>"),
                has_depth_axis,
                "{:?} depth axis",
                ty
            );
            // A 3-D bar chart has no overlap, and a 3-D pie no start angle.
            assert!(!xml.contains("<c:overlap"), "{:?} overlap", ty);
            if matches!(ty, ChartType::Pie3d) {
                assert!(!xml.contains("firstSliceAng"), "{:?} slice angle", ty);
                assert!(!xml.contains("<c:catAx>"), "{:?} axes", ty);
            }

            let out = parse_chart(xml.as_bytes()).expect("parses");
            assert_eq!(out.chart_type, ty, "{:?} survives the round trip", ty);
            assert_eq!(out.series.len(), 2);
            assert_eq!(out.series[1].val_ref.as_deref(), Some("Sheet1!$B$3:$E$3"));
        }
    }

    /// Column and bar share `c:bar3DChart`, told apart by `barDir` exactly as
    /// their flat forms are.
    #[test]
    fn three_d_bar_direction_round_trips() {
        for (ty, dir) in [(ChartType::Col3d, "col"), (ChartType::Bar3d, "bar")] {
            let data = ChartData::new(
                ty.clone(),
                None,
                None,
                vec![ChartSeries::new(None, "Sheet1!$B$2:$E$2".into())],
            );
            let xml = build_chart_xml(&data);
            assert!(xml.contains(&format!("<c:barDir val=\"{}\"/>", dir)));
            assert_eq!(parse_chart(xml.as_bytes()).unwrap().chart_type, ty);
        }
    }

    /// Depth settings belong to the 3-D forms; switching to the flat one must
    /// drop them, and switching back must bring them out of the preserved bag.
    #[test]
    fn depth_settings_are_scoped_to_3d() {
        let source = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:chart><c:plotArea><c:layout/><c:bar3DChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/><c:ser><c:idx val="0"/><c:order val="0"/><c:val><c:numRef><c:f>Sheet1!$B$2:$E$2</c:f></c:numRef></c:val></c:ser><c:gapWidth val="150"/><c:gapDepth val="200"/><c:shape val="cylinder"/><c:axId val="1"/><c:axId val="2"/><c:axId val="3"/></c:bar3DChart><c:catAx><c:axId val="1"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:crossAx val="2"/></c:catAx><c:valAx><c:axId val="2"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:crossAx val="1"/></c:valAx><c:serAx><c:axId val="3"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:crossAx val="2"/></c:serAx></c:plotArea></c:chart></c:chartSpace>"#;
        let mut data = parse_chart(source.as_bytes()).expect("parses");
        assert_eq!(data.chart_type, ChartType::Col3d);

        let rebuilt = build_chart_xml(&data);
        assert!(rebuilt.contains(r#"<c:gapDepth val="200"/>"#), "depth kept");
        assert!(
            rebuilt.contains(r#"<c:shape val="cylinder"/>"#),
            "shape kept"
        );

        data.chart_type = ChartType::Col;
        let flat = build_chart_xml(&data);
        assert!(!flat.contains("gapDepth"), "flat bar has no depth");
        assert!(!flat.contains("<c:shape"), "flat bar has no shape");
        assert!(!flat.contains("<c:serAx>"), "flat bar has two axes");
        assert!(
            flat.contains(r#"<c:gapWidth val="150"/>"#),
            "width still kept"
        );

        // Back to 3-D and the depth settings return: they were only hidden.
        data.chart_type = ChartType::Col3d;
        assert!(build_chart_xml(&data).contains(r#"<c:gapDepth val="200"/>"#));
    }

    /// A combo chart is one plot area holding several groups. Reading it must
    /// keep every group's series — before this, everything after the first
    /// group was silently dropped on the next edit.
    #[test]
    fn combo_chart_keeps_every_group() {
        let source = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:chart><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>Revenue</c:v></c:tx><c:cat><c:strRef><c:f>Sheet1!$A$2:$A$5</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>Sheet1!$B$2:$B$5</c:f></c:numRef></c:val></c:ser><c:gapWidth val="219"/><c:axId val="1"/><c:axId val="2"/></c:barChart><c:lineChart><c:grouping val="standard"/><c:ser><c:idx val="1"/><c:order val="1"/><c:tx><c:v>Margin</c:v></c:tx><c:val><c:numRef><c:f>Sheet1!$C$2:$C$5</c:f></c:numRef></c:val></c:ser><c:marker val="1"/><c:axId val="1"/><c:axId val="2"/></c:lineChart><c:catAx><c:axId val="1"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:crossAx val="2"/></c:catAx><c:valAx><c:axId val="2"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:crossAx val="1"/></c:valAx></c:plotArea></c:chart></c:chartSpace>"#;

        let data = parse_chart(source.as_bytes()).expect("parses");
        // The first group is the chart's own kind; the second overrides it.
        assert_eq!(data.chart_type, ChartType::Col);
        assert_eq!(data.series.len(), 2, "both groups' series are read");
        assert_eq!(data.series[0].name.as_deref(), Some("Revenue"));
        assert_eq!(data.series[0].series_type, None, "follows the chart");
        assert_eq!(data.series[1].name.as_deref(), Some("Margin"));
        assert_eq!(data.series[1].series_type, Some(ChartType::Line));
        // Read in `c:order`, not grouped by plot group.
        assert_eq!(
            data.series
                .iter()
                .map(|s| s.name.as_deref())
                .collect::<Vec<_>>(),
            vec![Some("Revenue"), Some("Margin")]
        );
        // Categories are found even though only the bar group carries them.
        assert_eq!(data.cat_ref.as_deref(), Some("Sheet1!$A$2:$A$5"));

        // And writing it back produces both groups again.
        let xml = build_chart_xml(&data);
        assert!(xml.contains("<c:barChart>"), "bar group written");
        assert!(xml.contains("<c:lineChart>"), "line group written");
        assert!(
            xml.contains(r#"<c:gapWidth val="219"/>"#),
            "primary settings kept"
        );
        let out = parse_chart(xml.as_bytes()).expect("re-parses");
        assert_eq!(out.series.len(), 2);
        assert_eq!(out.series[1].series_type, Some(ChartType::Line));
        assert_eq!(out.series[1].val_ref.as_deref(), Some("Sheet1!$C$2:$C$5"));
    }

    /// `idx`/`order` are workbook-wide, so the second group must continue the
    /// numbering rather than restart — two series sharing `idx` confuses Excel.
    #[test]
    fn combo_series_are_numbered_across_groups() {
        let mut data = ChartData::new(
            ChartType::Col,
            None,
            None,
            vec![
                ChartSeries::new(Some("a".into()), "Sheet1!$B$2:$B$5".into()),
                ChartSeries::new(Some("b".into()), "Sheet1!$C$2:$C$5".into()),
                ChartSeries::new(Some("c".into()), "Sheet1!$D$2:$D$5".into()),
            ],
        );
        data.series[2].series_type = Some(ChartType::Line);

        let xml = build_chart_xml(&data);
        for i in 0..3 {
            assert_eq!(
                xml.matches(&format!("<c:idx val=\"{}\"/>", i)).count(),
                1,
                "idx {} appears exactly once",
                i
            );
        }
        // The overridden series is the one in the line group.
        let line = &xml[xml.find("<c:lineChart>").unwrap()..];
        assert!(line.contains("Sheet1!$D$2:$D$5"));
        assert!(!line.contains("Sheet1!$B$2:$B$5"));
        // It keeps its position in the chart (third), not its position within
        // the group it was moved into.
        assert!(line.contains(r#"<c:order val="2"/>"#));

        // Which means the order survives a rebuild: writing and re-reading
        // must not bunch the overridden series at the end.
        let out = parse_chart(xml.as_bytes()).expect("parses");
        assert_eq!(
            out.series
                .iter()
                .map(|s| s.val_ref.as_deref())
                .collect::<Vec<_>>(),
            vec![
                Some("Sheet1!$B$2:$B$5"),
                Some("Sheet1!$C$2:$C$5"),
                Some("Sheet1!$D$2:$D$5"),
            ],
            "series order is stable across an edit"
        );
        assert_eq!(out.series[2].series_type, Some(ChartType::Line));
    }

    /// Only the flat category/value kinds combine. An override that names
    /// anything else — or an override on a chart that cannot combine — folds
    /// back into the primary group rather than producing invalid XML.
    #[test]
    fn uncombinable_overrides_fold_into_the_primary() {
        let mut data = ChartData::new(
            ChartType::Col,
            None,
            None,
            vec![
                ChartSeries::new(None, "Sheet1!$B$2:$B$5".into()),
                ChartSeries::new(None, "Sheet1!$C$2:$C$5".into()),
            ],
        );

        // A pie cannot share a plot area.
        data.series[1].series_type = Some(ChartType::Pie);
        let xml = build_chart_xml(&data);
        assert!(!xml.contains("<c:pieChart>"), "no second group");
        assert_eq!(xml.matches("<c:ser>").count(), 2, "both stay in the bar");
        assert!(parse_chart(xml.as_bytes()).is_some());

        // Nor can a chart that owns its plot area take overrides.
        data.chart_type = ChartType::Pie;
        data.series[1].series_type = Some(ChartType::Line);
        let xml = build_chart_xml(&data);
        assert!(!xml.contains("<c:lineChart>"));
        assert_eq!(xml.matches("<c:ser>").count(), 2);
        assert!(parse_chart(xml.as_bytes()).is_some());
    }

    /// Stacking describes the group the file carried, so it must not spread to
    /// a group that was only created by an override.
    #[test]
    fn combo_stacking_stays_on_the_primary_group() {
        let mut data = ChartData::new(
            ChartType::Col,
            None,
            None,
            vec![
                ChartSeries::new(None, "Sheet1!$B$2:$B$5".into()),
                ChartSeries::new(None, "Sheet1!$C$2:$C$5".into()),
            ],
        );
        data.stacked = true;
        data.series[1].series_type = Some(ChartType::Line);

        let xml = build_chart_xml(&data);
        let bar = &xml[xml.find("<c:barChart>").unwrap()..xml.find("</c:barChart>").unwrap()];
        let line = &xml[xml.find("<c:lineChart>").unwrap()..];
        assert!(bar.contains(r#"<c:grouping val="stacked"/>"#));
        assert!(
            line.contains(r#"<c:grouping val="standard"/>"#),
            "line is not stacked"
        );

        let out = parse_chart(xml.as_bytes()).expect("parses");
        assert!(out.stacked, "the chart is still a stacked column chart");
        assert_eq!(out.series[1].series_type, Some(ChartType::Line));
    }

    /// A combo chart's series keep the order the file gave them, even though
    /// they are read one plot group at a time. Excel plots and lists series by
    /// `c:order`, so regrouping them would visibly reshuffle the chart.
    #[test]
    fn combo_series_keep_their_authored_order() {
        // Written as bar(order 0), bar(order 2) then line(order 1) — so the
        // line belongs between the two bars.
        let source = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:chart><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>first</c:v></c:tx><c:val><c:numRef><c:f>Sheet1!$B$2:$B$5</c:f></c:numRef></c:val></c:ser><c:ser><c:idx val="2"/><c:order val="2"/><c:tx><c:v>third</c:v></c:tx><c:val><c:numRef><c:f>Sheet1!$D$2:$D$5</c:f></c:numRef></c:val></c:ser><c:axId val="1"/><c:axId val="2"/></c:barChart><c:lineChart><c:grouping val="standard"/><c:ser><c:idx val="1"/><c:order val="1"/><c:tx><c:v>second</c:v></c:tx><c:val><c:numRef><c:f>Sheet1!$C$2:$C$5</c:f></c:numRef></c:val></c:ser><c:axId val="1"/><c:axId val="2"/></c:lineChart><c:catAx><c:axId val="1"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:crossAx val="2"/></c:catAx><c:valAx><c:axId val="2"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:crossAx val="1"/></c:valAx></c:plotArea></c:chart></c:chartSpace>"#;

        let data = parse_chart(source.as_bytes()).expect("parses");
        assert_eq!(
            data.series
                .iter()
                .map(|s| s.name.as_deref())
                .collect::<Vec<_>>(),
            vec![Some("first"), Some("second"), Some("third")],
            "the line series sits between the two bars, as authored"
        );
        assert_eq!(data.series[1].series_type, Some(ChartType::Line));
    }

    /// A chart with no legend must stay legend-less through a rebuild.
    #[test]
    fn build_chart_xml_omits_legend_when_unset() {
        let mut data = ChartData::new(
            ChartType::Pie,
            None,
            None,
            vec![ChartSeries::new(None, "Sheet1!$B$2:$B$5".to_string())],
        );
        data.legend_pos = None;
        let out = parse_chart(build_chart_xml(&data).as_bytes()).expect("parses");
        assert_eq!(out.legend_pos, None);
        assert_eq!(out.title, None);
    }
}
