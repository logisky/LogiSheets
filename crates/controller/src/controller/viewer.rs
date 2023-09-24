use logisheets_base::{CellValue, SheetId};
use logisheets_parser::unparse::Stringify;

use crate::connectors::NameFetcher;
use crate::controller::display::{
    SheetColInfo, SheetComments, SheetMergeCells, SheetRowInfo, SheetStyles, SheetValues, Value,
};
use crate::id_manager::TextIdManager;
use crate::version_manager::diff::{Diff, SheetDiff};
use crate::Worksheet;

use super::display::{
    BlockInfo, CellFormulaValue, CellStyle, ColInfo, Comment, DisplayPatch, DisplayResponse,
    MergeCell, RowInfo, SheetBlocks,
};
use super::style::StyleConverter;
use super::Controller;

#[derive(Debug, Default)]
pub struct SheetViewer {
    pub values: Vec<CellFormulaValue>,
    pub styles: Vec<CellStyle>,
    pub row_infos: Vec<RowInfo>,
    pub col_infos: Vec<ColInfo>,
    pub comments: Vec<Comment>,
    pub merge_cells: Vec<MergeCell>,
    pub blocks: Vec<BlockInfo>,
}

impl SheetViewer {
    #[allow(unused)]
    pub fn display_with_diff(
        mut self,
        controller: &Controller,
        sheet_id: SheetId,
        diff: SheetDiff,
    ) -> DisplayResponse {
        if diff.diff_unavailable() {
            self.load_sheet(controller, sheet_id);
        } else {
            let ws = Worksheet::from(sheet_id, controller);
            diff.data.into_iter().for_each(|diff| match diff {
                Diff::CellValue(cell_id) => {
                    let formula = ws.get_formula_by_id(cell_id).unwrap_or_default();
                    let value = ws.get_value_by_id(cell_id).unwrap_or_default();
                    if let Ok((row, col)) = ws.get_cell_idx(cell_id) {
                        self.values.push(CellFormulaValue {
                            row,
                            col,
                            formula,
                            value,
                        });
                    }
                }
                Diff::CellStyle(cell_id) => {
                    let style = ws.get_style_by_id(cell_id).unwrap();
                    if let Ok((row, col)) = ws.get_cell_idx(cell_id) {
                        self.styles.push(CellStyle { row, col, style })
                    }
                }
                Diff::RowInfo(row_id) => {
                    if let Some(info) = ws.get_row_info_by_id(row_id) {
                        self.row_infos.push(info);
                    }
                }
                Diff::ColInfo(col_id) => {
                    if let Some(info) = ws.get_col_info_by_id(col_id) {
                        self.col_infos.push(info);
                    }
                }
                Diff::BlockUpdate { id, cnt, row } => {
                    let (mut row_cnt, mut col_cnt) = ws.get_block_size(id).unwrap();
                    if row {
                        row_cnt += cnt;
                    } else {
                        col_cnt += cnt;
                    }
                    let (master_row, master_col) = ws.get_block_master_cell(id).unwrap();
                    for r in master_row..=row_cnt {
                        for c in master_col..=col_cnt {
                            let style = ws.get_style(r, c);
                            let formula = ws.get_formula(r, c);
                            let value = ws.get_value(r, c);
                            match (style, formula, value) {
                                (Ok(s), Ok(f), Ok(v)) => {
                                    self.values.push(CellFormulaValue {
                                        row: r,
                                        col: c,
                                        formula: f,
                                        value: v,
                                    });
                                    self.styles.push(CellStyle {
                                        row: r,
                                        col: c,
                                        style: s,
                                    });
                                }
                                _ => continue,
                            }
                        }
                    }
                }
                Diff::SheetProperty => todo!(),
                Diff::Unavailable => unreachable!(),
            });
        }

        let idx = controller
            .status
            .sheet_pos_manager
            .get_sheet_idx(&sheet_id)
            .unwrap();
        let patches = self.to_patches(idx);
        DisplayResponse {
            patches,
            incremental: true,
        }
    }

    pub fn display_with_idx(self, controller: &Controller, sheet_idx: usize) -> DisplayResponse {
        let sheet_id = controller
            .status
            .sheet_pos_manager
            .get_sheet_id(sheet_idx)
            .unwrap();
        let mut viewer = self;
        viewer.load_sheet(controller, sheet_id);
        let patches = viewer.to_patches(sheet_idx);
        DisplayResponse {
            patches,
            incremental: false,
        }
    }

    fn load_sheet(&mut self, controller: &Controller, sheet_id: SheetId) {
        let s = &controller.status.container;
        let navigator = &controller.status.navigator;
        let style_manager = &controller.status.style_manager;
        let formula_manager = &controller.status.formula_manager;
        let func_manager = &controller.status.func_id_manager;
        let sheet_id_manager = &controller.status.sheet_id_manager;
        let external_links_manager = &controller.status.external_links_manager;
        let text_id_manager = &controller.status.text_id_manager;
        let name_id_manager = &controller.status.name_id_manager;
        let sheet_data = s.data.get(&sheet_id);
        if let Some(sheet_data) = sheet_data {
            sheet_data
                .col_info
                .get_all_col_info()
                .into_iter()
                .for_each(|(col_id, info)| {
                    // TODO: Optimize here.
                    if let Ok(idx) = navigator.fetch_col_idx(&sheet_id, &col_id) {
                        let info = ColInfo {
                            idx,
                            width: info.width.unwrap_or(get_default_col_width()),
                            hidden: info.hidden,
                        };
                        self.col_infos.push(info);
                    }
                });
            sheet_data
                .row_info
                .get_all_row_info()
                .into_iter()
                .for_each(|(row_id, info)| {
                    // TODO: Optimize here.
                    if let Ok(idx) = navigator.fetch_row_idx(&sheet_id, &row_id) {
                        let info = RowInfo {
                            idx,
                            height: info.ht.unwrap_or(get_default_row_height()),
                            hidden: info.hidden,
                        };
                        self.row_infos.push(info)
                    }
                });
            let style_converter = StyleConverter {
                theme_manager: &controller.settings.theme,
            };
            sheet_data.cells.iter().for_each(|(cell_id, cell)| {
                let coord = navigator.fetch_cell_idx(&sheet_id, cell_id);
                if coord.is_err() {
                    panic!()
                }
                let (row, col) = coord.unwrap();
                let raw_style = style_manager.get_cell_style(cell.style);
                self.styles.push(CellStyle {
                    row,
                    col,
                    style: style_converter.convert_style(raw_style),
                });
                let mut name_fetcher = NameFetcher {
                    func_manager,
                    sheet_id_manager,
                    external_links_manager,
                    text_id_manager,
                    name_id_manager,
                    navigator,
                    formula_manager,
                };

                let (formula, has_formula) =
                    match formula_manager.formulas.get(&(sheet_id, cell_id.clone())) {
                        Some(n) => (n.unparse(&mut name_fetcher, sheet_id).unwrap(), true),
                        None => (String::from(""), false),
                    };
                let v = convert_value(row, col, &cell.value, formula, has_formula, text_id_manager);
                self.values.push(v);
            });
        }
        let cell_attachments = &controller.status.cell_attachment_manager;
        let comments = &cell_attachments.comments;
        if let Some(sheet_comments) = comments.data.get(&sheet_id) {
            sheet_comments.comments.iter().for_each(|(cell_id, c)| {
                // TODO: Optimize here.
                if let Ok((row, col)) = navigator.fetch_cell_idx(&sheet_id, cell_id) {
                    let author = comments
                        .get_author_name(&c.author)
                        .unwrap_or(String::from("unknown author"));
                    self.comments.push(Comment {
                        row,
                        col,
                        author,
                        content: c.text.clone(),
                    })
                }
            });
        }
        let merge_cells_manager = &cell_attachments.merge_cells;
        if let Some(merge_cells) = merge_cells_manager.data.get(&sheet_id) {
            merge_cells.iter().for_each(|(start, end)| {
                if let Ok((row_start, col_start)) =
                    navigator.fetch_normal_cell_idx(&sheet_id, &start)
                {
                    let (row_end, col_end) =
                        navigator.fetch_normal_cell_idx(&sheet_id, &end).unwrap();
                    let mc = MergeCell {
                        row_start,
                        col_start,
                        row_end,
                        col_end,
                    };
                    self.merge_cells.push(mc);
                }
            });
        }
        if let Some(sn) = navigator.sheet_navs.clone().get(&sheet_id) {
            sn.data.blocks.iter().for_each(|(block_id, block_place)| {
                let (row_cnt, col_cnt) = block_place.get_block_size();
                let master = &block_place.master;
                let (master_row, master_col) =
                    navigator.fetch_normal_cell_idx(&sheet_id, &master).unwrap();
                let block_info = BlockInfo {
                    block_id: *block_id,
                    row_start: master_row,
                    row_cnt,
                    col_start: master_col,
                    col_cnt,
                };
                self.blocks.push(block_info)
            });
        }
    }

    fn to_patches(self, sheet_idx: usize) -> Vec<DisplayPatch> {
        let mut res = vec![];
        if self.values.len() > 0 {
            let values = SheetValues {
                sheet_idx,
                values: self.values,
            };
            res.push(DisplayPatch::Values(values))
        }
        if self.styles.len() > 0 {
            let styles = SheetStyles {
                sheet_idx,
                styles: self.styles,
            };
            res.push(DisplayPatch::Styles(styles))
        }
        if self.row_infos.len() > 0 {
            let row_info = SheetRowInfo {
                sheet_idx,
                info: self.row_infos,
                default_height: get_default_row_height(), // TODO: use settings
            };
            res.push(DisplayPatch::RowInfo(row_info))
        }
        if self.col_infos.len() > 0 {
            let col_info = SheetColInfo {
                sheet_idx,
                info: self.col_infos,
                default_width: get_default_col_width(), // TODO: use settings
            };
            res.push(DisplayPatch::ColInfo(col_info))
        }
        if self.comments.len() > 0 {
            let comments = SheetComments {
                sheet_idx,
                comments: self.comments,
            };
            res.push(DisplayPatch::Comments(comments))
        }
        if self.merge_cells.len() > 0 {
            let merge_cells = SheetMergeCells {
                sheet_idx,
                merge_cells: self.merge_cells,
            };
            res.push(DisplayPatch::MergeCells(merge_cells))
        }
        if self.blocks.len() > 0 {
            let blocks = SheetBlocks {
                sheet_idx,
                blocks: self.blocks,
            };
            res.push(DisplayPatch::Blocks(blocks))
        }
        res
    }
}

fn get_default_col_width() -> f64 {
    8.38
}

fn get_default_row_height() -> f64 {
    14.25
}

fn convert_value(
    row: usize,
    col: usize,
    cv: &CellValue,
    formula: String,
    has_formula: bool,
    text_id_manager: &TextIdManager,
) -> CellFormulaValue {
    let value = match cv {
        CellValue::Blank => {
            if has_formula {
                Value::Number(0_f64)
            } else {
                Value::Str(String::from(""))
            }
        }
        CellValue::Boolean(b) => Value::Bool(*b),
        CellValue::Error(e) => Value::Error(e.to_string()),
        CellValue::String(s) => Value::Str(
            text_id_manager
                .get_string(s)
                .unwrap_or(String::from("Error")),
        ),
        CellValue::Number(n) => Value::Number(*n),
        CellValue::InlineStr(_) => todo!(),
        CellValue::FormulaStr(s) => Value::Str(s.clone()),
    };
    CellFormulaValue {
        row,
        col,
        formula,
        value,
    }
}
