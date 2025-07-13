use std::collections::HashSet;

use crate::controller::display::{
    BlockDisplayInfo, BlockInfo, CellPosition, DisplayWindow, DisplayWindowWithStartPoint,
};
use crate::errors::Result;
use crate::exclusive::AppendixWithCell;
use crate::lock::{locked_write, Locked};
use crate::{
    connectors::NameFetcher,
    controller::{
        display::{get_default_col_width, get_default_row_height},
        style::StyleConverter,
    },
    Controller, Error,
};
use crate::{CellInfo, ColInfo, Comment, MergeCell, RowInfo, Style, Value};
use logisheets_base::errors::BasicError;
use logisheets_base::{BlockCellId, BlockId, CellId, ColId, DiyCellId, RowId, SheetId};
use logisheets_parser::unparse;

use super::workbook::CellPositionerDefault;
use super::{ReproducibleCell, SheetCoordinate, SheetDimension};

// Use a cache to record the coordinate
pub struct Worksheet<'a> {
    pub(crate) sheet_id: SheetId,
    pub(crate) controller: &'a Controller,
    pub(crate) positioner: Locked<CellPositionerDefault>,
}

impl<'a> Worksheet<'a> {
    pub(crate) fn get_value_by_id(&self, cell_id: &CellId) -> Result<Value> {
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
        self.get_value_by_id(&cell_id)
    }

    pub(crate) fn get_formula_by_id(&self, cell_id: &CellId) -> Result<String> {
        if let Some(node) = self
            .controller
            .status
            .formula_manager
            .formulas
            .get(&(self.sheet_id, *cell_id))
        {
            let mut name_fetcher = NameFetcher {
                func_manager: &self.controller.status.func_id_manager,
                sheet_id_manager: &self.controller.status.sheet_id_manager,
                external_links_manager: &self.controller.status.external_links_manager,
                text_id_manager: &self.controller.status.text_id_manager,
                name_id_manager: &self.controller.status.name_id_manager,
                navigator: &self.controller.status.navigator,
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
        self.get_formula_by_id(&cell_id)
    }

    pub fn get_cell_info_by_cell_id(&self, cell_id: &CellId) -> Result<CellInfo> {
        let block_id = if let CellId::BlockCell(b) = cell_id {
            Some(b.block_id)
        } else {
            None
        };
        let diy_cell_id = match cell_id {
            CellId::NormalCell(_) => None,
            CellId::BlockCell(block_cell_id) => self
                .controller
                .status
                .exclusive_manager
                .diy_cell_manager
                .get_diy_cell_id(self.sheet_id, block_cell_id),
            CellId::EphemeralCell(_) => None,
        };
        if diy_cell_id.is_some() {
            return Ok(CellInfo {
                value: Value::default(),
                formula: String::from(""),
                style: self.get_style_by_id(cell_id)?,
                block_id: None,
                diy_cell_id,
            });
        }
        let formula = self.get_formula_by_id(cell_id)?;
        let value = self.get_value_by_id(cell_id)?;
        let style = self.get_style_by_id(cell_id)?;
        Ok(CellInfo {
            value,
            formula,
            style,
            block_id,
            diy_cell_id,
        })
    }

    pub fn get_cell_info(&self, row: usize, col: usize) -> Result<CellInfo> {
        let cell_id = self
            .controller
            .status
            .navigator
            .fetch_cell_id(&self.sheet_id, row, col)?;
        self.get_cell_info_by_cell_id(&cell_id)
    }

    pub fn get_cell_infos(
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

    pub fn get_cell_infos_except_window(
        &self,
        start_row: usize,
        start_col: usize,
        end_row: usize,
        end_col: usize,
        window_start_row: usize,
        window_start_col: usize,
        window_end_row: usize,
        window_end_col: usize,
    ) -> Result<Vec<CellInfo>> {
        let mut res = vec![];
        for i in start_row..=end_row {
            for j in start_col..=end_col {
                if i >= window_start_row
                    && i <= window_end_row
                    && j >= window_start_col
                    && j <= window_end_col
                {
                    continue;
                }
                let cell_info = self.get_cell_info(i, j)?;
                res.push(cell_info);
            }
        }
        Ok(res)
    }

    pub fn get_reproducible_cell(&self, row: usize, col: usize) -> Result<ReproducibleCell> {
        let cell_id = self
            .controller
            .status
            .navigator
            .fetch_cell_id(&self.sheet_id, row, col)?;
        let cell_info = self.get_cell_info(row, col)?;
        let appendix = match cell_id {
            CellId::BlockCell(block_cell_id) => self
                .controller
                .status
                .exclusive_manager
                .appendix_manager
                .get(self.sheet_id, &block_cell_id)
                .unwrap_or(vec![]),
            _ => vec![],
        };
        Ok(ReproducibleCell {
            coordinate: SheetCoordinate { row, col },
            formula: cell_info.formula,
            value: cell_info.value,
            style: cell_info.style,
            appendix,
        })
    }

    pub fn get_reproducible_cells(
        &self,
        coordinates: Vec<SheetCoordinate>,
    ) -> Result<Vec<ReproducibleCell>> {
        let mut res = vec![];
        for coordinate in coordinates {
            res.push(self.get_reproducible_cell(coordinate.row, coordinate.col)?);
        }
        Ok(res)
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

    pub fn get_diy_cell_id_with_block_id(
        &self,
        block_id: &BlockId,
        row: usize,
        col: usize,
    ) -> Option<DiyCellId> {
        let cell_id = self
            .controller
            .status
            .navigator
            .fetch_block_cell_id(&self.sheet_id, block_id, row, col)
            .ok()?;
        self.controller
            .status
            .exclusive_manager
            .diy_cell_manager
            .get_diy_cell_id(self.sheet_id, &cell_id)
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
                if row == start_row {
                    let col_info = self.get_col_info(col).unwrap_or(ColInfo::default(col));
                    if col_info.hidden {
                        continue 'col;
                    }
                    col_infos.push(col_info);
                }

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
        self.get_all_merged_cells().into_iter().for_each(|m| {
            if m.start_row >= start_row
                && m.end_row <= end_row
                && m.start_col >= start_col
                && m.end_col <= end_col
            {
                merge_cells.push(m);
            }
        });
        let blocks = block_ids
            .into_iter()
            .flat_map(|b| self.get_display_block_info(b))
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
        let y = self.get_row_start_y(row, &mut *positioner)?;
        let x = self.get_col_start_x(col, &mut *positioner)?;
        drop(positioner);
        Ok(CellPosition { x, y })
    }

    pub fn get_row_start_y(
        &self,
        row: usize,
        positioner: &mut CellPositionerDefault,
    ) -> Result<f64> {
        let (mut curr, mut result) = positioner.find_closest_cache_height(row);
        if curr == row {
            return Ok(result);
        }
        let reverse = curr > row;

        while curr != row {
            if self.is_row_hidden(row) {
                curr = advance(reverse, curr);
                continue;
            }
            let h = self.get_row_height(curr)?;
            result = if reverse { result - h } else { result + h };
            curr = advance(reverse, curr);
            positioner.add_cache(true, curr, result);
        }
        Ok(result)
    }

    pub fn get_col_start_x(
        &self,
        col: usize,
        positioner: &mut CellPositionerDefault,
    ) -> Result<f64> {
        let (mut curr, mut result) = positioner.find_closest_cache_width(col);
        if curr == col {
            return Ok(result);
        }
        let reverse = curr > col;

        while curr != col {
            if self.is_col_hidden(col) {
                curr = advance(reverse, curr);
                continue;
            }
            let w = self.get_col_width(curr)?;
            result = if reverse { result - w } else { result + w };
            curr = advance(reverse, curr);
            positioner.add_cache(false, curr, result);
        }
        Ok(result)
    }

    pub fn get_diy_cell_id(&self, row: usize, col: usize) -> Result<DiyCellId> {
        let cell_id = self
            .controller
            .status
            .navigator
            .fetch_cell_id(&self.sheet_id, row, col)?;
        match cell_id {
            CellId::BlockCell(block_cell_id) => self
                .controller
                .status
                .exclusive_manager
                .diy_cell_manager
                .get_diy_cell_id(self.sheet_id, &block_cell_id)
                .ok_or(Error::Basic(BasicError::CellIdNotFound(row, col))),
            _ => Err(Error::Basic(BasicError::CellIdNotFound(row, col))),
        }
    }

    pub fn get_display_window_for_block(&self, block_id: BlockId) -> Result<DisplayWindow> {
        let info = self.get_block_info(block_id)?;
        let row_ids = (0..info.row_cnt - 1)
            .into_iter()
            .map(|r| self.get_block_row_id(block_id, r).unwrap())
            .collect::<Vec<RowId>>();
        let col_ids = (0..info.col_cnt - 1)
            .into_iter()
            .map(|c| self.get_block_col_id(block_id, c).unwrap())
            .collect::<Vec<ColId>>();
        let mut cell_infos = vec![];

        for r in row_ids.iter() {
            for c in col_ids.iter() {
                let cell_id = CellId::BlockCell(BlockCellId {
                    block_id,
                    row: *r,
                    col: *c,
                });
                let info = self.get_cell_info_by_cell_id(&cell_id)?;
                cell_infos.push(info);
            }
        }

        let comments = self.get_comments_within_block(&info);
        let merge_cells = self.get_merge_cells_within_block(&info);

        Ok(DisplayWindow {
            cells: cell_infos,
            rows: vec![],
            cols: vec![],
            comments,
            merge_cells,
            blocks: vec![],
        })
    }

    #[inline]
    fn get_comments_within_block(&self, block_info: &BlockInfo) -> Vec<Comment> {
        self.get_comments()
            .into_iter()
            .filter(|c| {
                c.row >= block_info.row_start
                    && c.row <= block_info.row_start + block_info.row_cnt - 1
                    && c.col >= block_info.col_start
                    && c.col <= block_info.col_start + block_info.col_cnt - 1
            })
            .collect()
    }

    #[inline]
    fn get_merge_cells_within_block(&self, block_info: &BlockInfo) -> Vec<MergeCell> {
        self.get_all_merged_cells()
            .into_iter()
            .filter(|m| {
                m.start_row >= block_info.row_start
                    && m.end_row <= block_info.row_start + block_info.row_cnt - 1
                    && m.start_col >= block_info.col_start
                    && m.end_col <= block_info.col_start + block_info.col_cnt - 1
            })
            .collect()
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
            self.get_nearest_row_with_given_y(start_y, true, &mut *positioner)?;
        let (start_col, start_point_x) =
            self.get_nearest_col_with_given_x(start_x, true, &mut *positioner)?;
        let (end_row, _) =
            self.get_nearest_row_with_given_y(start_y + height, false, &mut *positioner)?;
        let (end_col, _) =
            self.get_nearest_col_with_given_x(start_x + width, false, &mut *positioner)?;

        drop(positioner);

        let window = self.get_display_window(start_row, start_col, end_row, end_col)?;
        Ok(DisplayWindowWithStartPoint {
            window,
            start_x: start_point_x,
            start_y: start_point_y,
        })
    }

    pub fn get_nearest_row_with_given_y(
        &self,
        y: f64,
        before: bool,
        positioner: &mut CellPositionerDefault,
    ) -> Result<(usize, f64)> {
        let (mut curr_idx, mut curr_h) = positioner.find_closest_cache_before_y(y);
        let mut h = 0.;
        while curr_h < y {
            if self.is_row_hidden(curr_idx) {
                curr_idx += 1;
                continue;
            }
            h = self.get_row_height(curr_idx)?;
            curr_idx += 1;
            curr_h += h;
            positioner.add_cache(true, curr_idx, curr_h);
        }

        if before {
            if curr_idx > 1 && curr_h > h {
                curr_idx -= 1;
                curr_h -= h;
            }
        }
        return Ok((curr_idx, curr_h));
    }

    pub fn get_nearest_col_with_given_x(
        &self,
        x: f64,
        before: bool,
        positioner: &mut CellPositionerDefault,
    ) -> Result<(usize, f64)> {
        let (mut curr_idx, mut curr_w) = positioner.find_closest_cache_before_x(x);
        let mut w = 0.;
        while curr_w < x {
            if self.is_col_hidden(curr_idx) {
                curr_idx += 1;
                continue;
            }
            w = self.get_col_width(curr_idx)?;
            curr_idx += 1;
            curr_w += w;
            positioner.add_cache(false, curr_idx, curr_w);
        }

        if before {
            if curr_idx > 1 && curr_w > w {
                curr_idx -= 1;
                curr_w -= w;
            }
        }
        return Ok((curr_idx, curr_w));
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

    pub(crate) fn get_style_by_id(&self, cell_id: &CellId) -> Result<Style> {
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
        self.get_style_by_id(&cell_id)
    }

    pub fn get_all_merged_cells(&self) -> Vec<MergeCell> {
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
                        (Ok((start_row, start_col)), Ok((end_row, end_col))) => {
                            let m = MergeCell {
                                start_row,
                                start_col,
                                end_row,
                                end_col,
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

    pub fn get_merged_cells(
        &self,
        t_start_row: usize,
        t_start_col: usize,
        t_end_row: usize,
        t_end_col: usize,
    ) -> Vec<MergeCell> {
        let merged_cells = self
            .controller
            .status
            .cell_attachment_manager
            .merge_cells
            .get_all_merged_cells(&self.sheet_id);
        let result = merged_cells
            .into_iter()
            .flat_map(|(s, e)| {
                let s = self
                    .controller
                    .status
                    .navigator
                    .fetch_normal_cell_idx(&self.sheet_id, &s);
                if s.is_err() {
                    return None;
                }
                let (start_row, start_col) = s.unwrap();
                let e = self
                    .controller
                    .status
                    .navigator
                    .fetch_normal_cell_idx(&self.sheet_id, &e);
                if e.is_err() {
                    return None;
                }
                let (end_row, end_col) = e.unwrap();
                if start_col > t_end_col || start_row > t_end_row {
                    return None;
                }
                if end_col < t_start_col || end_row < t_start_row {
                    return None;
                }
                return Some(MergeCell {
                    start_row,
                    start_col,
                    end_row,
                    end_col,
                });
            })
            .collect::<Vec<_>>();
        return result;
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

    pub fn get_all_fully_covered_blocks(
        &self,
        start_row: usize,
        start_col: usize,
        end_row: usize,
        end_col: usize,
    ) -> Vec<BlockInfo> {
        let all_blocks = self.get_all_blocks();
        let result = all_blocks
            .into_iter()
            .filter(|b| {
                let bp_end_row = b.row_start + b.row_cnt - 1;
                let bp_end_col = b.col_start + b.col_cnt - 1;

                bp_end_row <= end_row
                    && b.row_start >= start_row
                    && bp_end_col <= end_col
                    && b.col_start >= start_col
            })
            .collect::<Vec<_>>();
        result
    }

    pub fn get_all_blocks(&self) -> Vec<BlockInfo> {
        let sheet_nav = self
            .controller
            .status
            .navigator
            .sheet_navs
            .get(&self.sheet_id);
        if sheet_nav.is_none() {
            return vec![];
        }
        let sheet_idx = self
            .controller
            .status
            .sheet_pos_manager
            .get_sheet_idx(&self.sheet_id)
            .unwrap();
        let sheet_nav = sheet_nav.unwrap();
        let blocks = sheet_nav
            .data
            .blocks
            .clone()
            .into_iter()
            .map(|(id, block_place)| {
                let mc = block_place.master;
                let (row, col) = self
                    .controller
                    .status
                    .navigator
                    .fetch_normal_cell_idx(&self.sheet_id, &mc)
                    .unwrap();
                BlockInfo {
                    sheet_idx,
                    sheet_id: self.sheet_id,
                    block_id: id,
                    row_start: row,
                    row_cnt: block_place.rows.len(),
                    col_start: col,
                    col_cnt: block_place.cols.len(),
                }
            })
            .collect::<Vec<_>>();
        return blocks;
    }

    /// Get the dimension of the sheet.
    pub fn get_sheet_dimension(&self) -> Result<SheetDimension> {
        let sheet_container = self
            .controller
            .status
            .container
            .get_sheet_container(self.sheet_id);
        if sheet_container.is_none() {
            return Ok(SheetDimension {
                max_row: 0,
                max_col: 0,
                height: 0.,
                width: 0.,
            });
        }
        let sheet_container = sheet_container.unwrap();
        let (max_row, max_col) =
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
                });
        let CellPosition {
            y: start_row,
            x: start_col,
        } = self.get_cell_position(max_row, max_col)?;
        Ok(SheetDimension {
            max_row,
            max_col,
            height: start_row,
            width: start_col,
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

    #[inline]
    pub fn get_display_block_info(&self, block_id: BlockId) -> Result<BlockDisplayInfo> {
        let info = self.get_block_info(block_id)?;
        let start_position = self.get_cell_position(info.row_start, info.col_start)?;
        // Get the end position of the cell at the bottom-right corner of the block
        let end_position =
            self.get_cell_position(info.row_start + info.row_cnt, info.col_start + info.col_cnt)?;
        Ok(BlockDisplayInfo {
            info,
            start_position,
            end_position,
        })
    }

    #[inline]
    pub fn get_block_info(&self, block_id: BlockId) -> Result<BlockInfo> {
        let (row_cnt, col_cnt) = self.get_block_size(block_id)?;
        let (row_start, col_start) = self.get_block_master_cell(block_id)?;
        Ok(BlockInfo {
            sheet_id: self.sheet_id,
            block_id,
            row_start,
            row_cnt,
            col_start,
            col_cnt,
            sheet_idx: self
                .controller
                .status
                .sheet_pos_manager
                .get_sheet_idx(&self.sheet_id)
                .unwrap(),
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

    pub fn get_block_row_id(&self, block_id: BlockId, row_idx: usize) -> Result<RowId> {
        self.controller
            .status
            .navigator
            .fetch_block_row_id(&self.sheet_id, &block_id, row_idx)
            .map_err(|e| e.into())
    }

    pub fn get_block_col_id(&self, block_id: BlockId, col_idx: usize) -> Result<ColId> {
        self.controller
            .status
            .navigator
            .fetch_block_col_id(&self.sheet_id, &block_id, col_idx)
            .map_err(|e| e.into())
    }

    pub fn lookup_appendix_upward(
        &self,
        block_id: BlockId,
        row_idx: usize,
        col_idx: usize,
        craft_id: &str,
        tag: u8,
    ) -> Option<AppendixWithCell> {
        let lookup = |r: usize, c: usize| {
            let block_cell_id = self
                .controller
                .status
                .navigator
                .fetch_block_cell_id(&self.sheet_id, &block_id, r, c)
                .ok()?;
            self.controller
                .status
                .exclusive_manager
                .appendix_manager
                .get(self.sheet_id, &block_cell_id)
                .and_then(|appendices| {
                    appendices
                        .iter()
                        .find(|appendix| appendix.craft_id == craft_id && appendix.tag == tag)
                        .map(|appendix| AppendixWithCell {
                            appendix: appendix.clone(),
                            sheet_id: self.sheet_id,
                            block_id,
                            row_idx,
                            col_idx,
                        })
                })
        };
        for r in (0..=row_idx).rev() {
            if let Some(appendix) = lookup(r, col_idx) {
                return Some(appendix);
            }
        }
        None
    }
}

#[inline]
fn advance(reverse: bool, curr: usize) -> usize {
    if reverse {
        curr - 1
    } else {
        curr + 1
    }
}
