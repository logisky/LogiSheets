use std::sync::Arc;

use logisheets_base::{
    errors::BasicError,
    id_fetcher::{IdFetcherTrait, SheetIdFetcherByIdxTrait},
};
use logisheets_workbook::prelude::{
    AxisScale, ChartData, ChartSeries, ChartType, LegendPos, OfPieSplit, PassthroughPart,
    SeriesColor, build_chart_xml, parse_chart,
};

use crate::{Error, edit_action::EditPayload};

use super::{Chart, ChartBlockSource, ChartManager, ChartMarker, ResolvedBlockRefs};

pub struct ChartExecutor {
    pub manager: ChartManager,
}

impl ChartExecutor {
    pub fn new(manager: ChartManager) -> Self {
        Self { manager }
    }

    /// Handle chart payloads. Returns `(self, changed)`; `changed` is `false`
    /// for payloads this executor does not care about.
    ///
    /// `block_refs` carries the ranges a `block_source` on the payload resolves
    /// to right now. It is resolved by the caller because it needs the block
    /// places and schemas, which this executor's context does not carry — and
    /// `None` here means the source named a block that cannot be charted, so
    /// the payload is refused rather than turned into a chart of nothing.
    pub fn execute<C: IdFetcherTrait + SheetIdFetcherByIdxTrait>(
        mut self,
        ctx: &mut C,
        payload: EditPayload,
        block_refs: Option<ResolvedBlockRefs>,
    ) -> Result<(Self, bool), Error> {
        match payload {
            EditPayload::MoveChart(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(BasicError::SheetIdxExceed)?;
                let from_cell = ctx.fetch_cell_id(&sheet_id, p.from_row, p.from_col)?;
                let to_cell = ctx.fetch_cell_id(&sheet_id, p.to_row, p.to_col)?;
                let changed = self.manager.move_chart(
                    sheet_id,
                    &p.chart_id,
                    ChartMarker {
                        cell: from_cell,
                        col_off: p.from_col_off,
                        row_off: p.from_row_off,
                    },
                    // A move from the host always states two corners, so the
                    // chart becomes cell-anchored even if it arrived sized.
                    crate::chart_manager::ChartExtent::ToCell(ChartMarker {
                        cell: to_cell,
                        col_off: p.to_col_off,
                        row_off: p.to_row_off,
                    }),
                );
                Ok((self, changed))
            }
            EditPayload::DeleteChart(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(BasicError::SheetIdxExceed)?;
                let changed = self.manager.remove_chart(sheet_id, &p.chart_id);
                Ok((self, changed))
            }
            EditPayload::CreateChart(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(BasicError::SheetIdxExceed)?;
                let from_cell = ctx.fetch_cell_id(&sheet_id, p.from_row, p.from_col)?;
                let to_cell = ctx.fetch_cell_id(&sheet_id, p.to_row, p.to_col)?;
                let chart_type = chart_type_from_str(&p.chart_type);
                // A block-bound chart states fields, not ranges; the ranges
                // come from where the block's fields sit at this moment.
                let (series, cat_ref) = match (&p.block_source, &block_refs) {
                    (Some(_), Some(refs)) => (
                        refs.series
                            .iter()
                            .map(|(name, r)| ChartSeries::new(Some(name.clone()), r.clone()))
                            .collect(),
                        refs.cat_ref.clone(),
                    ),
                    // Asked for a block we could not resolve: refuse rather
                    // than silently create an empty chart.
                    (Some(_), None) => return Ok((self, false)),
                    (None, _) => (
                        p.series.iter().map(new_series).collect(),
                        p.categories_ref.clone(),
                    ),
                };
                let spec = ChartData::new(chart_type, p.title.clone(), cat_ref, series);
                let bytes = build_chart_xml(&spec).into_bytes();
                let data = match parse_chart(&bytes) {
                    Some(d) => d,
                    None => return Ok((self, false)),
                };
                let part_path = format!("xl/charts/{}.xml", p.chart_id);
                let raw = Arc::new(vec![PassthroughPart {
                    path: part_path.clone(),
                    data: bytes,
                    rtype: logisheets_workbook::rtypes::CHART,
                    rels: vec![],
                }]);
                self.manager.add(
                    sheet_id,
                    Chart {
                        id: p.chart_id.clone(),
                        from: ChartMarker {
                            cell: from_cell,
                            col_off: p.from_col_off,
                            row_off: p.from_row_off,
                        },
                        extent: crate::chart_manager::ChartExtent::ToCell(ChartMarker {
                            cell: to_cell,
                            col_off: p.to_col_off,
                            row_off: p.to_row_off,
                        }),
                        part_path,
                        data,
                        raw,
                        source: p.block_source.as_ref().map(block_source),
                        // Filled by the caller: turning A1 into cell ids needs
                        // the navigator and the sheet names, which this
                        // executor's context does not carry.
                        refs: Default::default(),
                    },
                );
                Ok((self, true))
            }
            EditPayload::UpdateChart(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(BasicError::SheetIdxExceed)?;
                // Read the existing chart's data to keep refs/anchor while
                // re-generating with the new type/title.
                // Cloned because the chart is replaced further down, which
                // needs `self.manager` mutably. One chart, not the sheet's.
                let existing = self
                    .manager
                    .charts_of_sheet(sheet_id)
                    .find(|c| c.id == p.chart_id)
                    .cloned();
                let Some(existing) = existing else {
                    return Ok((self, false));
                };
                let mut spec = existing.data.clone();
                if let Some(t) = &p.chart_type {
                    spec.chart_type = chart_type_from_str(t);
                }
                if let Some(t) = &p.title {
                    spec.title = non_empty(t);
                }
                if let Some(l) = &p.legend_pos {
                    spec.legend_pos = legend_pos_from_str(l);
                }
                if let Some(v) = p.stacked {
                    spec.stacked = v;
                }
                if let Some(t) = &p.cat_axis_title {
                    spec.cat_axis_title = non_empty(t);
                }
                if let Some(t) = &p.val_axis_title {
                    spec.val_axis_title = non_empty(t);
                }
                if let Some(v) = p.show_data_labels {
                    spec.data_labels.show_value = v;
                }
                if let Some(v) = p.show_category_labels {
                    spec.data_labels.show_category = v;
                }
                if let Some(v) = p.show_series_labels {
                    spec.data_labels.show_series = v;
                }
                if let Some(v) = p.show_percent_labels {
                    spec.data_labels.show_percent = v;
                }
                if let Some(pos) = &p.data_label_position {
                    spec.data_labels.position = non_empty(pos);
                }
                if let Some(fmt) = &p.num_fmt {
                    let fmt = non_empty(fmt);
                    spec.val_axis_num_fmt = fmt.clone();
                    spec.data_labels.num_fmt = fmt;
                }
                if let Some(r) = &p.categories_ref {
                    spec.cat_ref = non_empty(r);
                }
                // Rebinding to a block replaces the series wholesale; stating
                // `series` instead unbinds, because naming fixed ranges is
                // exactly the statement that the chart no longer tracks one.
                let new_source = match (&p.block_source, &block_refs) {
                    (Some(bs), Some(refs)) => {
                        let previous = std::mem::take(&mut spec.series);
                        spec.cat_ref = refs.cat_ref.clone();
                        spec.series = refs
                            .series
                            .iter()
                            .enumerate()
                            .map(|(i, (name, r))| {
                                let mut ns = ChartSeries::new(Some(name.clone()), r.clone());
                                // Keep the slot's look, so re-resolving a block
                                // does not reshuffle the chart's palette.
                                if let Some(old) = previous.get(i) {
                                    ns.color = old.color.clone();
                                    ns.series_type = old.series_type.clone();
                                    ns.preserved = old.preserved.clone();
                                }
                                ns
                            })
                            .collect();
                        Some(Some(block_source(bs)))
                    }
                    (Some(_), None) => return Ok((self, false)),
                    (None, _) => p.series.as_ref().map(|_| None),
                };
                if let Some(sc) = &p.val_axis_scale {
                    spec.val_axis_scale = axis_scale(sc);
                }
                if let Some(sc) = &p.cat_axis_scale {
                    spec.cat_axis_scale = axis_scale(sc);
                }
                if let Some(sp) = &p.of_pie_split {
                    spec.of_pie_split = OfPieSplit {
                        by: sp.by.as_ref().and_then(|b| non_empty(b)),
                        pos: sp.pos.filter(|v| *v > 0.0),
                        // Excel clamps the second plot to 5..=200% of the first.
                        second_size: sp.second_size.filter(|v| (5.0..=200.0).contains(v)),
                    };
                }
                if let (None, Some(series)) = (&p.block_source, &p.series) {
                    let previous = std::mem::take(&mut spec.series);
                    spec.series = series
                        .iter()
                        .enumerate()
                        .map(|(i, s)| {
                            let mut ns = new_series(s);
                            let old = previous.get(i);
                            // A caller editing a non-bubble chart has no size
                            // field to send, so keep the one this slot had —
                            // switching to bubble and back must not lose it.
                            if ns.size_ref.is_none() {
                                ns.size_ref = old.and_then(|o| o.size_ref.clone());
                            }
                            // Same for the combo override: a caller editing
                            // something else does not restate it.
                            if ns.series_type.is_none() {
                                ns.series_type = old.and_then(|o| o.series_type.clone());
                            }
                            match &ns.color {
                                // An explicit color replaces the series' whole
                                // shape properties: the authored ones describe
                                // a fill we are overriding, so keeping them
                                // would keep the old color.
                                Some(_) => {}
                                // Otherwise carry the previous slot's look over
                                // whole, so re-pointing a range or renaming a
                                // series does not reset the chart's palette.
                                None => {
                                    ns.color = old.and_then(|o| o.color.clone());
                                    if let Some(o) = old {
                                        ns.preserved = o.preserved.clone();
                                    }
                                }
                            }
                            ns
                        })
                        .collect();
                }
                let bytes = build_chart_xml(&spec).into_bytes();
                let data = match parse_chart(&bytes) {
                    Some(d) => d,
                    None => return Ok((self, false)),
                };
                // Only the chart part itself is regenerated. Its relationships
                // and the satellite parts Excel writes alongside it (style,
                // colors) are carried over untouched — dropping them would
                // restyle the chart in Excel and break any reference the chart
                // makes to another part.
                let raw = Arc::new(
                    existing
                        .raw
                        .iter()
                        .map(|part| {
                            if part.path == existing.part_path {
                                PassthroughPart {
                                    data: bytes.clone(),
                                    ..part.clone()
                                }
                            } else {
                                part.clone()
                            }
                        })
                        .collect::<Vec<_>>(),
                );
                let changed = self.manager.update_content(
                    sheet_id,
                    &p.chart_id,
                    data,
                    raw,
                    Default::default(),
                );
                if let Some(source) = new_source {
                    self.manager.set_source(sheet_id, &p.chart_id, source);
                }
                Ok((self, changed))
            }
            _ => Ok((self, false)),
        }
    }
}

/// A payload's block binding → the stored one. Only the field *names* are
/// kept: positions are looked up against the block on each resolution, which
/// is the whole point of binding to it.
fn block_source(p: &crate::edit_action::ChartBlockSource) -> ChartBlockSource {
    ChartBlockSource {
        block_id: p.block_id,
        category_field: p.category_field.as_ref().and_then(|f| non_empty(f)),
        value_fields: p.value_fields.clone(),
    }
}

/// A payload series → the workbook model. An explicit color is taken as a
/// literal RGB hex (what a color picker produces); theme-scheme colors only
/// come from the file.
fn new_series(s: &crate::edit_action::CreateChartSeries) -> ChartSeries {
    let mut out = ChartSeries::new(s.name.clone(), s.value_ref.clone());
    out.size_ref = s.size_ref.as_ref().and_then(|r| non_empty(r));
    out.series_type = s
        .series_type
        .as_ref()
        .and_then(|t| non_empty(t))
        .map(|t| chart_type_from_str(&t));
    out.color = s
        .color
        .as_ref()
        .and_then(|c| non_empty(c))
        .map(|c| SeriesColor::Srgb(c.trim_start_matches('#').to_string()));
    out
}

/// Payload text fields use the empty string to mean "clear it".
fn non_empty(s: &str) -> Option<String> {
    if s.trim().is_empty() {
        None
    } else {
        Some(s.to_string())
    }
}

fn axis_scale(u: &crate::edit_action::AxisScaleUpdate) -> AxisScale {
    AxisScale {
        min: u.min,
        max: u.max,
        // Excel rejects a log base outside 2..=1000; treat anything else as
        // linear rather than writing a file Excel will refuse to open.
        log_base: u.log_base.filter(|b| (2.0..=1000.0).contains(b)),
        reversed: u.reversed,
        major_unit: u.major_unit.filter(|v| *v > 0.0),
        minor_unit: u.minor_unit.filter(|v| *v > 0.0),
    }
}

fn legend_pos_from_str(s: &str) -> Option<LegendPos> {
    match s {
        "top" => Some(LegendPos::Top),
        "bottom" => Some(LegendPos::Bottom),
        "left" => Some(LegendPos::Left),
        "right" => Some(LegendPos::Right),
        // "none" (and anything unrecognized) hides the legend.
        _ => None,
    }
}

fn chart_type_from_str(s: &str) -> ChartType {
    match s {
        "bar" => ChartType::Bar,
        "line" => ChartType::Line,
        "area" => ChartType::Area,
        "pie" => ChartType::Pie,
        "doughnut" => ChartType::Doughnut,
        "scatter" => ChartType::Scatter,
        "radar" => ChartType::Radar,
        "bubble" => ChartType::Bubble,
        "stock" => ChartType::Stock,
        "ofPie" => ChartType::OfPie,
        "barOfPie" => ChartType::BarOfPie,
        "surface" => ChartType::Surface,
        "surface3d" => ChartType::Surface3d,
        "col3d" => ChartType::Col3d,
        "bar3d" => ChartType::Bar3d,
        "line3d" => ChartType::Line3d,
        "area3d" => ChartType::Area3d,
        "pie3d" => ChartType::Pie3d,
        _ => ChartType::Col,
    }
}
