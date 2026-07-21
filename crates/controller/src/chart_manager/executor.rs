use std::sync::Arc;

use logisheets_base::{
    errors::BasicError,
    id_fetcher::{IdFetcherTrait, SheetIdFetcherByIdxTrait},
};
use logisheets_workbook::prelude::{
    ChartType, NewChartSeries, PassthroughPart, build_chart_xml, parse_chart,
};

use crate::{Error, edit_action::EditPayload};

use super::{Chart, ChartManager, ChartMarker};

pub struct ChartExecutor {
    pub manager: ChartManager,
}

impl ChartExecutor {
    pub fn new(manager: ChartManager) -> Self {
        Self { manager }
    }

    /// Handle chart payloads. Returns `(self, changed)`; `changed` is `false`
    /// for payloads this executor does not care about.
    pub fn execute<C: IdFetcherTrait + SheetIdFetcherByIdxTrait>(
        mut self,
        ctx: &mut C,
        payload: EditPayload,
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
                    ChartMarker {
                        cell: to_cell,
                        col_off: p.to_col_off,
                        row_off: p.to_row_off,
                    },
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
                let series: Vec<NewChartSeries> = p
                    .series
                    .iter()
                    .map(|s| NewChartSeries {
                        name: s.name.clone(),
                        value_ref: s.value_ref.clone(),
                    })
                    .collect();
                let xml = build_chart_xml(
                    &chart_type,
                    p.title.as_deref(),
                    p.categories_ref.as_deref(),
                    &series,
                );
                let bytes = xml.into_bytes();
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
                        to: ChartMarker {
                            cell: to_cell,
                            col_off: p.to_col_off,
                            row_off: p.to_row_off,
                        },
                        part_path,
                        data,
                        raw,
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
                let existing = match self
                    .manager
                    .charts_of_sheet(sheet_id)
                    .into_iter()
                    .find(|c| c.id == p.chart_id)
                {
                    Some(c) => c,
                    None => return Ok((self, false)),
                };
                let new_type = match &p.chart_type {
                    Some(s) => chart_type_from_str(s),
                    None => existing.data.chart_type.clone(),
                };
                let title = match &p.title {
                    Some(t) => Some(t.clone()),
                    None => existing.data.title.clone(),
                };
                let series: Vec<NewChartSeries> = existing
                    .data
                    .series
                    .iter()
                    .filter_map(|s| {
                        s.val_ref.clone().map(|vr| NewChartSeries {
                            name: s.name.clone(),
                            value_ref: vr,
                        })
                    })
                    .collect();
                let xml = build_chart_xml(
                    &new_type,
                    title.as_deref(),
                    existing.data.cat_ref.as_deref(),
                    &series,
                );
                let bytes = xml.into_bytes();
                let data = match parse_chart(&bytes) {
                    Some(d) => d,
                    None => return Ok((self, false)),
                };
                let raw = Arc::new(vec![PassthroughPart {
                    path: existing.part_path.clone(),
                    data: bytes,
                    rtype: logisheets_workbook::rtypes::CHART,
                    rels: vec![],
                }]);
                let changed = self
                    .manager
                    .update_content(sheet_id, &p.chart_id, data, raw);
                Ok((self, changed))
            }
            _ => Ok((self, false)),
        }
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
        _ => ChartType::Col,
    }
}
