use std::collections::HashSet;

use crate::controller::display::{
    BlockInfo, CellPosition, DisplayWindow, DisplayWindowWithStartPoint,
};
use crate::errors::Result;
use crate::lock::{locked_write, new_locked, Locked};
use crate::{
    connectors::NameFetcher,
    controller::{
        display::{get_default_col_width, get_default_row_height},
        style::StyleConverter,
    },
    Controller,
};
use crate::{CellInfo, ColInfo, Comment, MergeCell, RowInfo, Style, Value};
use logisheets_base::{BlockId, CellId, ColId, RowId, SheetId};
use logisheets_parser::unparse;

use super::workbook::CellPositionerDefault;

// Use a cache to record the coordinate
pub struct Worksheet<'a> {
    pub(crate) sheet_id: SheetId,
    pub(crate) controller: &'a Controller,
    pub(crate) positioner: Locked<CellPositionerDefault>,
}

impl<'a> Worksheet<'a> {
    pub(crate) fn from(sheet_id: SheetId, controller: &'a Controller) -> Self {
        Worksheet {
            sheet_id,
            controller,
            positioner: new_locked(CellPositionerDefault::new()),
        }
    }

    pub(crate) fn get_value_by_id(&self, cell_id: CellId) -> Result<Value> {
        if let Some(cell) = self
            .controller
            .status
            .container
            .get_cell(self.sheet_id, &cell_id)
        {
            let value = &cell.value;
            let v = match value {
                logisheets_base::CellValue::Blank => Value::Empty,
                logisheets_base::CellValue::Boolean(b) => Value::Bool(*b),
                logisheets_base::CellValue::Error(e) => Value::Error(e.to_string()),
                logisheets_base::CellValue::String(s) => {
                    let text = self.controller.status.text_id_manager.get_string(s);
                    match text {
                        Some(r) => Value::Str(r),
                        None => Value::Str(String::from("")),
                    }
                }
                logisheets_base::CellValue::Number(n) => Value::Number(*n),
                logisheets_base::CellValue::InlineStr(_) => Value::Empty,
                logisheets_base::CellValue::FormulaStr(s) => Value::Str(s.to_string()),
            };
            Ok(v)
        } else {
            Ok(Value::Empty)
        }
    }

    pub fn get_value(&self, row: usize, col: usize) -> Result<Value> {
        let cell_id = self
            .controller
            .status
            .navigator
            .fetch_cell_id(&self.sheet_id, row, col)?;
        self.get_value_by_id(cell_id)
    }

    pub(crate) fn get_formula_by_id(&self, cell_id: CellId) -> Result<String> {
        if let Some(node) = self
            .controller
            .status
            .formula_manager
            .formulas
            .get(&(self.sheet_id, cell_id))
        {
            let mut name_fetcher = NameFetcher {
                func_manager: &self.controller.status.func_id_manager,
                sheet_id_manager: &self.controller.status.sheet_id_manager,
                external_links_manager: &self.controller.status.external_links_manager,
                text_id_manager: &self.controller.status.text_id_manager,
                name_id_manager: &self.controller.status.name_id_manager,
                navigator: &self.controller.status.navigator,
                formula_manager: &self.controller.status.formula_manager,
                range_manager: &self.controller.status.range_manager,
                cube_manager: &self.controller.status.cube_manager,
                ext_ref_manager: &self.controller.status.ext_ref_manager,
            };
            let f = unparse::unparse(node, &mut name_fetcher, self.sheet_id)?;
            Ok(f)
        } else {
            Ok(String::from(""))
        }
    }

    pub fn get_formula(&self, row: usize, col: usize) -> Result<String> {
        let cell_id = self
            .controller
            .status
            .navigator
            .fetch_cell_id(&self.sheet_id, row, col)?;
        self.get_formula_by_id(cell_id)
    }

    pub fn get_cell_info(&self, row: usize, col: usize) -> Result<CellInfo> {
        let cell_id = self
            .controller
            .status
            .navigator
            .fetch_cell_id(&self.sheet_id, row, col)?;
        let block_id = if let CellId::BlockCell(b) = cell_id {
            Some(b.block_id)
        } else {
            None
        };
        let formula = self.get_formula_by_id(cell_id)?;
        let value = self.get_value_by_id(cell_id)?;
        let style = self.get_style_by_id(cell_id)?;
        Ok(CellInfo {
            value,
            formula,
            style,
            block_id,
        })
    }

    pub fn get_comment(&self, row: usize, col: usize) -> Option<Comment> {
        let cell_id = self
            .controller
            .status
            .navigator
            .fetch_cell_id(&self.sheet_id, row, col)
            .ok()?;
        let comment = self
            .controller
            .status
            .cell_attachment_manager
            .comments
            .get_comment(&self.sheet_id, &cell_id)?;
        let author = self
            .controller
            .status
            .cell_attachment_manager
            .comments
            .get_author_name(&comment.author)
            .unwrap_or(String::from(""));
        Some(Comment {
            row,
            col,
            author,
            content: comment.text.clone(),
        })
    }

    pub fn get_display_window(
        &self,
        start_row: usize,
        start_col: usize,
        end_row: usize,
        end_col: usize,
    ) -> Result<DisplayWindow> {
        let mut cells: Vec<CellInfo> = vec![];
        let mut row_infos: Vec<RowInfo> = vec![];
        let mut col_infos: Vec<ColInfo> = vec![];
        let mut comments: Vec<Comment> = vec![];
        let mut merge_cells: Vec<MergeCell> = vec![];
        let mut block_ids = HashSet::<BlockId>::new();

        for row in start_row..=end_row {
            let row_info = self.get_row_info(row).unwrap_or(RowInfo::default(row));
            if row_info.hidden {
                continue;
            }
            row_infos.push(row_info);

            'col: for col in start_col..=end_col {
                let col_info = self.get_col_info(col).unwrap_or(ColInfo::default(col));
                if col_info.hidden {
                    continue 'col;
                }
                col_infos.push(col_info);

                if let Some(comment) = self.get_comment(row, col) {
                    comments.push(comment);
                }

                let info = self.get_cell_info(row, col)?;
                if let Some(block_id) = info.block_id {
                    block_ids.insert(block_id);
                }
                cells.push(info);
            }
        }
        self.get_merge_cells().into_iter().for_each(|m| {
            if m.row_start >= start_row
                && m.row_end <= end_row
                && m.col_start >= start_col
                && m.col_end <= end_col
            {
                merge_cells.push(m);
            }
        });
        let blocks = block_ids
            .into_iter()
            .flat_map(|b| self.get_block_info(b))
            .collect();

        Ok(DisplayWindow {
            cells,
            rows: row_infos,
            cols: col_infos,
            comments,
            merge_cells,
            blocks,
        })
    }

    pub fn get_cell_position(&self, row: usize, col: usize) -> Result<CellPosition> {
        let mut positioner = locked_write(&self.positioner);
        let y = positioner.get_row_start_y(row, &self)?;
        let x = positioner.get_col_start_x(col, &self)?;
        Ok(CellPosition { x, y })
    }

    pub fn get_display_window_response(
        &self,
        start_x: f64,
        start_y: f64,
        width: f64,
        height: f64,
    ) -> Result<DisplayWindowWithStartPoint> {
        let mut positioner = locked_write(&self.positioner);
        let (start_row, start_point_y) =
            positioner.get_nearest_row_before_given_y(start_y, &self)?;
        let (start_col, start_point_x) =
            positioner.get_nearest_col_before_given_x(start_x, &self)?;
        let (end_row, _) =
            positioner.get_nearest_row_before_given_y(start_y + height + 100., &self)?;
        let (end_col, _) =
            positioner.get_nearest_col_before_given_x(start_x + width + 50., &self)?;

        let window = self.get_display_window(start_row, start_col, end_row, end_col)?;
        Ok(DisplayWindowWithStartPoint {
            window,
            start_x: start_point_x,
            start_y: start_point_y,
        })
    }

    pub fn get_cell_info_in_window(
        &self,
        start_row: usize,
        start_col: usize,
        end_row: usize,
        end_col: usize,
    ) -> Result<Vec<CellInfo>> {
        let mut res = vec![];
        for i in start_row..=end_row {
            for j in start_col..=end_col {
                let cell_info = self.get_cell_info(i, j)?;
                res.push(cell_info);
            }
        }
        Ok(res)
    }

    pub(crate) fn get_style_by_id(&self, cell_id: CellId) -> Result<Style> {
        let style_id = if let Some(cell) = self
            .controller
            .status
            .container
            .get_cell(self.sheet_id, &cell_id)
        {
            cell.style
        } else if let CellId::NormalCell(normal_cell_id) = cell_id {
            let row_id = normal_cell_id.row;
            if let Some(row_info) = self
                .controller
                .status
                .container
                .get_row_info(self.sheet_id, row_id)
            {
                row_info.style
            } else {
                let col_id = normal_cell_id.col;
                match self
                    .controller
                    .status
                    .container
                    .get_col_info(self.sheet_id, col_id)
                {
                    Some(col_info) => col_info.style,
                    None => 0,
                }
            }
        } else {
            0
        };
        let raw_style = self
            .controller
            .status
            .style_manager
            .get_cell_style(style_id);
        let style_converter = StyleConverter {
            theme_manager: &self.controller.settings.theme,
        };
        Ok(style_converter.convert_style(raw_style))
    }

    pub fn get_style(&self, row: usize, col: usize) -> Result<Style> {
        let cell_id = self
            .controller
            .status
            .navigator
            .fetch_cell_id(&self.sheet_id, row, col)?;
        self.get_style_by_id(cell_id)
    }

    pub fn get_merge_cells(&self) -> Vec<MergeCell> {
        let merges = self
            .controller
            .status
            .cell_attachment_manager
            .merge_cells
            .data
            .get(&self.sheet_id);
        if let Some(merges) = merges {
            merges
                .clone()
                .iter()
                .fold(vec![], |mut prev, (start, end)| {
                    let s = self
                        .controller
                        .status
                        .navigator
                        .fetch_normal_cell_idx(&self.sheet_id, start);
                    let e = self
                        .controller
                        .status
                        .navigator
                        .fetch_normal_cell_idx(&self.sheet_id, end);
                    match (s, e) {
                        (Ok((row_start, col_start)), Ok((row_end, col_end))) => {
                            let m = MergeCell {
                                row_start,
                                col_start,
                                row_end,
                                col_end,
                            };
                            prev.push(m);
                            prev
                        }
                        _ => prev,
                    }
                })
        } else {
            vec![]
        }
    }

    pub fn get_comments(&self) -> Vec<Comment> {
        let comments = self
            .controller
            .status
            .cell_attachment_manager
            .comments
            .data
            .get(&self.sheet_id);
        if let Some(comments) = comments {
            comments
                .comments
                .clone()
                .iter()
                .fold(vec![], |mut prev, (id, c)| {
                    if let Ok((row, col)) = self
                        .controller
                        .status
                        .navigator
                        .fetch_cell_idx(&self.sheet_id, id)
                    {
                        let author_id = c.author;
                        let author = self
                            .controller
                            .status
                            .cell_attachment_manager
                            .comments
                            .get_author_name(&author_id)
                            .unwrap();
                        let content = c.text.to_string();
                        let comment = Comment {
                            row,
                            col,
                            author,
                            content,
                        };
                        prev.push(comment);
                        prev
                    } else {
                        prev
                    }
                })
        } else {
            vec![]
        }
    }

    /// Get the dimension of the sheet.
    pub fn get_sheet_dimension(&self) -> (usize, usize) {
        let sheet_container = self
            .controller
            .status
            .container
            .get_sheet_container(self.sheet_id);
        if sheet_container.is_none() {
            return (0, 0);
        }
        let sheet_container = sheet_container.unwrap();
        sheet_container
            .cells
            .clone()
            .iter()
            .fold((0, 0), |(r, c), (id, _)| {
                let cell_idx = self
                    .controller
                    .status
                    .navigator
                    .fetch_cell_idx(&self.sheet_id, id);
                match cell_idx {
                    Ok((row, col)) => {
                        let r = if r > row { r } else { row };
                        let c = if c > col { c } else { col };
                        (r, c)
                    }
                    Err(_) => (r, c),
                }
            })
    }

    pub fn get_row_info(&self, row: usize) -> Option<RowInfo> {
        let row_id = self
            .controller
            .status
            .navigator
            .fetch_row_id(&self.sheet_id, row)
            .ok()?;
        self.get_row_info_by_id(row_id)
    }

    pub(crate) fn get_row_info_by_id(&self, row_id: RowId) -> Option<RowInfo> {
        let row_info = self
            .controller
            .status
            .container
            .data
            .get(&self.sheet_id)?
            .row_info
            .get_row_info(row_id)?;

        let row_height = if row_info.custom_height {
            row_info.ht.unwrap()
        } else {
            self.get_default_row_height()
        };

        let row_idx = self
            .controller
            .status
            .navigator
            .fetch_row_idx(&self.sheet_id, &row_id)
            .unwrap();

        let info = RowInfo {
            idx: row_idx,
            height: row_height,
            hidden: row_info.hidden,
        };
        Some(info)
    }

    pub fn get_col_info(&self, col: usize) -> Option<ColInfo> {
        let col_id = self
            .controller
            .status
            .navigator
            .fetch_col_id(&self.sheet_id, col)
            .ok()?;
        let col_info = self.get_col_info_by_id(col_id)?;
        Some(ColInfo {
            idx: col,
            width: col_info.width,
            hidden: col_info.hidden,
        })
    }

    pub fn is_row_hidden(&self, row: usize) -> bool {
        let info = self.get_row_info(row);
        if let Some(info) = info {
            info.hidden
        } else {
            false
        }
    }

    pub fn is_col_hidden(&self, col: usize) -> bool {
        let info = self.get_col_info(col);
        if let Some(info) = info {
            info.hidden
        } else {
            false
        }
    }

    pub fn get_row_height(&self, row: usize) -> Result<f64> {
        let row_id = self
            .controller
            .status
            .navigator
            .fetch_row_id(&self.sheet_id, row)?;
        let container = self.controller.status.container.data.get(&self.sheet_id);

        if container.is_none() {
            return Ok(self.get_default_row_height());
        }

        let row_info = container.unwrap().row_info.get_row_info(row_id);
        if row_info.is_none() {
            return Ok(self.get_default_row_height());
        }

        let row_info = row_info.unwrap();
        if row_info.custom_height {
            Ok(row_info.ht.unwrap_or(self.get_default_row_height()))
        } else {
            Ok(self.get_default_row_height())
        }
    }

    pub fn get_col_width(&self, col: usize) -> Result<f64> {
        let col_id = self
            .controller
            .status
            .navigator
            .fetch_col_id(&self.sheet_id, col)?;
        let container = self.controller.status.container.data.get(&self.sheet_id);

        if container.is_none() {
            return Ok(self.get_default_col_width());
        }

        let col_info = container.unwrap().col_info.get_col_info(col_id);
        if col_info.is_none() {
            return Ok(self.get_default_col_width());
        }

        let col_info = col_info.unwrap();
        if col_info.custom_width {
            Ok(col_info.width.unwrap_or(self.get_default_col_width()))
        } else {
            Ok(self.get_default_col_width())
        }
    }

    pub(crate) fn get_col_info_by_id(&self, col_id: ColId) -> Option<ColInfo> {
        let col_info = self
            .controller
            .status
            .container
            .data
            .get(&self.sheet_id)?
            .col_info
            .get_col_info(col_id)?;

        let col_width = if col_info.custom_width {
            col_info.width.unwrap()
        } else {
            self.get_default_col_width()
        };

        let row_idx = self
            .controller
            .status
            .navigator
            .fetch_col_idx(&self.sheet_id, &col_id)
            .unwrap();

        let info = ColInfo {
            idx: row_idx,
            width: col_width,
            hidden: col_info.hidden,
        };
        Some(info)
    }

    pub(crate) fn get_cell_idx(&self, cell_id: CellId) -> Result<(usize, usize)> {
        self.controller
            .status
            .navigator
            .fetch_cell_idx(&self.sheet_id, &cell_id)
            .map_err(|e| e.into())
    }

    pub fn get_default_row_height(&self) -> f64 {
        self.controller
            .settings
            .sheet_format_pr
            .get(&self.sheet_id)
            .map(|pr| {
                if pr.custom_height {
                    pr.default_row_height
                } else {
                    get_default_row_height()
                }
            })
            .unwrap_or(get_default_row_height())
    }

    pub fn get_default_col_width(&self) -> f64 {
        self.controller
            .settings
            .sheet_format_pr
            .get(&self.sheet_id)
            .map(|e| e.default_col_width.unwrap_or(get_default_col_width()))
            .unwrap_or(get_default_col_width())
    }

    pub fn get_block_info(&self, block_id: BlockId) -> Result<BlockInfo> {
        let (row_cnt, col_cnt) = self.get_block_size(block_id)?;
        let (row_start, col_start) = self.get_block_master_cell(block_id)?;
        Ok(BlockInfo {
            block_id,
            row_start,
            row_cnt,
            col_start,
            col_cnt,
        })
    }

    pub fn get_block_size(&self, block_id: BlockId) -> Result<(usize, usize)> {
        self.controller
            .status
            .navigator
            .get_block_size(&self.sheet_id, &block_id)
            .map_err(|e| e.into())
    }

    pub fn get_block_master_cell(&self, block_id: BlockId) -> Result<(usize, usize)> {
        let master_cell_id = self
            .controller
            .status
            .navigator
            .get_master_cell(&self.sheet_id, &block_id)?;
        let result = self
            .controller
            .status
            .navigator
            .fetch_normal_cell_idx(&self.sheet_id, &master_cell_id)?;
        Ok(result)
    }
}
