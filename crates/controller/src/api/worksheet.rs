use std::collections::{BTreeSet, HashSet};

use crate::block_manager::schema_manager::schema::Schema;
use crate::block_manager::schema_manager::schema::SchemaTrait;
use crate::cell_attachments::comment::{CommentNote as InternalNote, Comments as InternalComments};
use crate::controller::display::BlockSchema;
use crate::controller::display::BlockSchemaRandomEntry;
use crate::controller::display::BlockSchemaType;
use crate::controller::display::{
    BlockCellInfo, BlockDisplayInfo, BlockInfo, CellCoordinate, CellImageInfo, CellPosition,
    DisplayWindow, DisplayWindowWithStartPoint,
};
use crate::errors::Result;
use crate::exclusive::AppendixWithCell;
use crate::formula_manager::Vertex;
use crate::lock::{Locked, locked_write};
use crate::navigator::BlockPlace;
use crate::style_manager::RawStyle;
use crate::{
    CellInfo, ColInfo, Comment, CommentMentionInfo, CommentNote, CommentPerson, MergeCell, RowInfo,
    Style, Value,
};
use crate::{
    Controller, Error,
    connectors::NameFetcher,
    controller::{
        display::{get_default_col_width, get_default_row_height},
        style::StyleConverter,
    },
};
use logisheets_base::PersonId;
use logisheets_base::errors::BasicError;
use logisheets_base::{
    BlockCellId, BlockId, BlockRange, CellId, ColId, DiyCellId, NormalRange, Range, RangeId, RowId,
    SheetId, StyleId, TextId,
};
use logisheets_parser::unparse;

use super::workbook::CellPositionerDefault;
use super::{CellRefRange, DependentCell, ReproducibleCell, SheetCoordinate, SheetDimension};

/// A dependency-graph range vertex resolved to a concrete rectangle (internal to
/// the dependency-tracking API). `all_rows`/`all_cols` mark whole-column /
/// whole-row references, whose row/col bounds are unbounded.
struct ResolvedRect {
    sheet_id: SheetId,
    r0: usize,
    c0: usize,
    r1: usize,
    c1: usize,
    all_rows: bool,
    all_cols: bool,
}

impl ResolvedRect {
    fn intersects(&self, r0: usize, c0: usize, r1: usize, c1: usize) -> bool {
        let rows_ok = self.all_rows || (self.r0 <= r1 && r0 <= self.r1);
        let cols_ok = self.all_cols || (self.c0 <= c1 && c0 <= self.c1);
        rows_ok && cols_ok
    }
}

/// The pure boundary rule behind Ctrl+Arrow, on a single axis.
///
/// - `p0`: current position along the moving axis (row for vertical motion,
///   column for horizontal).
/// - `occupied`: sorted positions on this line that hold a non-empty cell
///   (block-cell values included; ephemeral cells excluded by the caller).
/// - `blocks`: `(lo, hi)` spans of blocks crossing this line.
/// - `forward`: `true` for Down/Right, `false` for Up/Left.
///
/// Returns the target position, or `None` when there is nowhere to go.
/// Asymmetry: going backward (Up/Left) with no data/block ahead falls back to
/// the start edge `0` (cheap and expected); going forward (Down/Right) returns
/// `None` so the caller can hint instead of jumping to the far end of the sheet.
///
/// Rules, going forward (backward is the mirror):
///   1. Inside a block but not at its far edge → jump to that edge.
///   2. The immediately adjacent cell enters a block → jump through to the
///      block's far edge.
///   3. Otherwise stop at the nearest of: the cell just before a block we'd
///      enter (a gap precedes it), or the next non-empty data cell.
fn boundary_1d(
    p0: usize,
    occupied: &BTreeSet<usize>,
    blocks: &[(usize, usize)],
    forward: bool,
) -> Option<usize> {
    let in_block = |p: usize| blocks.iter().find(|(lo, hi)| *lo <= p && p <= *hi).copied();

    if forward {
        if let Some((_, hi)) = in_block(p0) {
            if p0 < hi {
                return Some(hi);
            }
        }
        if let Some((_, hi)) = in_block(p0 + 1) {
            return Some(hi);
        }
        let mut best: Option<usize> = None;
        for (lo, _hi) in blocks {
            if *lo > p0 + 1 {
                let cand = lo - 1;
                best = Some(best.map_or(cand, |b| b.min(cand)));
            }
        }
        if let Some(&d) = occupied.range(p0 + 1..).next() {
            best = Some(best.map_or(d, |b| b.min(d)));
        }
        best
    } else {
        if let Some((lo, _)) = in_block(p0) {
            if p0 > lo {
                return Some(lo);
            }
        }
        if p0 > 0 {
            if let Some((lo, _)) = in_block(p0 - 1) {
                return Some(lo);
            }
        }
        let mut best: Option<usize> = None;
        for (_lo, hi) in blocks {
            if *hi + 1 < p0 {
                let cand = hi + 1;
                best = Some(best.map_or(cand, |b| b.max(cand)));
            }
        }
        if p0 > 0 {
            if let Some(&d) = occupied.range(..p0).next_back() {
                best = Some(best.map_or(d, |b| b.max(d)));
            }
        }
        // Backward (Up/Left) falls back to the start edge (0): reaching the
        // top/left is cheap and expected, unlike walking to the far end. The
        // forward branch deliberately returns None instead, so Down/Right
        // hints rather than jumping to the bottom/right of the whole sheet.
        best.or(if p0 > 0 { Some(0) } else { None })
    }
}

// Use a cache to record the coordinate
pub struct Worksheet<'a> {
    pub(crate) sheet_id: SheetId,
    pub(crate) controller: &'a Controller,
    pub(crate) positioner: Locked<CellPositionerDefault>,
}

impl<'a> Worksheet<'a> {
    pub fn get_value_by_id(&self, cell_id: &CellId) -> Result<Value> {
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
        self.get_formula_with_shift_by_id(cell_id, unparse::CellShift::ZERO)
    }

    /// Whether `cell_id` carries a formula on this sheet.
    pub(crate) fn has_formula(&self, cell_id: &CellId) -> bool {
        self.controller
            .status
            .formula_manager
            .formulas
            .contains_key(&(self.sheet_id, *cell_id))
    }

    /// Unparse the formula at `cell_id`, shifting every relative reference
    /// by `shift`. Returns an empty string when the cell has no formula.
    /// This is the primitive behind autofill's reference translation.
    pub(crate) fn get_formula_with_shift_by_id(
        &self,
        cell_id: &CellId,
        shift: unparse::CellShift,
    ) -> Result<String> {
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
                block_schema_manager: &self.controller.status.block_schema_manager,
            };
            let f = unparse::unparse_with_shift(node, &mut name_fetcher, self.sheet_id, shift)?;
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

    pub fn get_cell_coordinate_by_id(&self, cell_id: &CellId) -> Result<CellCoordinate> {
        let coordinate = self
            .controller
            .status
            .navigator
            .fetch_cell_idx(&self.sheet_id, cell_id)?;
        Ok(CellCoordinate {
            x: coordinate.1,
            y: coordinate.0,
        })
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
                validation_shadow: None,
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
            validation_shadow: self.get_validation_shadow(cell_id),
        })
    }

    /// The value of the `Validation` shadow for this cell, if one has been
    /// materialized (only non-empty cells covered by a data-validation rule get
    /// one). The value is the rule's boolean result — `false` means invalid.
    fn get_validation_shadow(&self, cell_id: &CellId) -> Option<Value> {
        let shadow_id = self.controller.sid_assigner.find_shadow_id(
            self.sheet_id,
            *cell_id,
            crate::sid_assigner::ShadowKind::Validation,
        )?;
        self.get_value_by_id(&CellId::EphemeralCell(shadow_id)).ok()
    }

    pub fn get_cell_info(&self, row: usize, col: usize) -> Result<CellInfo> {
        let cell_id = self
            .controller
            .status
            .navigator
            .fetch_cell_id(&self.sheet_id, row, col)?;
        self.get_cell_info_by_cell_id(&cell_id)
    }

    /// All images placed in this sheet's cells, each resolved to its current
    /// `(row, col)` position with the bytes base64-encoded for transport.
    /// Images whose anchor cell no longer exists are skipped.
    pub fn get_cell_images(&self) -> Vec<CellImageInfo> {
        let mut result = self
            .controller
            .status
            .image_manager
            .images_of_sheet(self.sheet_id)
            .into_iter()
            .filter_map(|(cell_id, img)| {
                let (row, col) = self
                    .controller
                    .status
                    .navigator
                    .fetch_cell_idx(&self.sheet_id, &cell_id)
                    .ok()?;
                Some(CellImageInfo {
                    row,
                    col,
                    id: img.id,
                    format: img.format,
                    data: crate::image_manager::base64::encode(&img.data),
                })
            })
            .collect::<Vec<_>>();
        result.sort_by_key(|c| (c.row, c.col));
        result
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
        let value = self.get_value_by_id(&cell_id)?;
        let style = self.get_raw_style_by_id(&cell_id)?;
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
            value,
            style,
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
        let comments = &self.controller.status.cell_attachment_manager.comments;
        let thread = comments.get_thread(&self.sheet_id, &cell_id)?;
        let notes = thread
            .iter()
            .map(|n| build_comment_note(comments, n))
            .collect::<Vec<_>>();
        Some(Comment { row, col, notes })
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
            if m.start_row > end_row
                || m.end_row < start_row
                || m.start_col > end_col
                || m.end_col < start_col
            {
                return;
            }
            merge_cells.push(m);
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

    pub(crate) fn get_row_start_y(
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

    pub(crate) fn get_col_start_x(
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

        let start_row = if start_row > 0 {
            start_row - 1
        } else {
            start_row
        };
        let start_col = if start_col > 0 {
            start_col - 1
        } else {
            start_col
        };

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

    pub fn get_next_upward_visible_cell(&self, row: usize, col: usize) -> Result<CellCoordinate> {
        if row == 0 {
            return Err(Error::Basic(BasicError::CellIdNotFound(row, col)));
        }
        let mut r = row - 1;
        while r > 0 {
            if !self.is_row_hidden(r) {
                break;
            }
            r -= 1;
        }

        Ok(CellCoordinate { x: col, y: r })
    }

    pub fn get_next_downward_visible_cell(&self, row: usize, col: usize) -> Result<CellCoordinate> {
        let mut r = row + 1;
        loop {
            if !self.is_row_hidden(r) {
                break;
            }
            r += 1;
        }

        Ok(CellCoordinate { x: col, y: r })
    }

    pub fn get_next_leftward_visible_cell(&self, row: usize, col: usize) -> Result<CellCoordinate> {
        if col == 0 {
            return Err(Error::Basic(BasicError::CellIdNotFound(row, col)));
        }
        let mut c = col - 1;
        while c > 0 {
            if !self.is_col_hidden(c) {
                break;
            }
            c -= 1;
        }

        Ok(CellCoordinate { x: c, y: row })
    }

    pub fn get_next_rightward_visible_cell(
        &self,
        row: usize,
        col: usize,
    ) -> Result<CellCoordinate> {
        let mut c = col + 1;
        loop {
            if !self.is_col_hidden(c) {
                break;
            }
            c += 1;
        }

        Ok(CellCoordinate { x: c, y: row })
    }

    // ---- Ctrl+Arrow: jump to the next data / block boundary --------------

    /// Ctrl+Up: jump upward to the next data or block boundary in this column.
    pub fn get_upward_data_boundary(&self, row: usize, col: usize) -> Result<CellCoordinate> {
        self.data_boundary(row, col, true, false)
    }

    /// Ctrl+Down: jump downward to the next data or block boundary in this column.
    pub fn get_downward_data_boundary(&self, row: usize, col: usize) -> Result<CellCoordinate> {
        self.data_boundary(row, col, true, true)
    }

    /// Ctrl+Left: jump left to the next data or block boundary in this row.
    pub fn get_leftward_data_boundary(&self, row: usize, col: usize) -> Result<CellCoordinate> {
        self.data_boundary(row, col, false, false)
    }

    /// Ctrl+Right: jump right to the next data or block boundary in this row.
    pub fn get_rightward_data_boundary(&self, row: usize, col: usize) -> Result<CellCoordinate> {
        self.data_boundary(row, col, false, true)
    }

    /// Shared implementation for Ctrl+Arrow. Scans the occupied cells and the
    /// block rectangles that cross the active line (`vertical` → the column
    /// `col`; otherwise the row `row`), then delegates the boundary rule to the
    /// pure [`boundary_1d`]. Returns `Err` when there is no boundary ahead, so
    /// the host can show a hint instead of jumping to the far edge of the sheet.
    fn data_boundary(
        &self,
        row: usize,
        col: usize,
        vertical: bool,
        forward: bool,
    ) -> Result<CellCoordinate> {
        let nav = &self.controller.status.navigator;

        // Non-empty positions along the active line. Block cells map to their
        // absolute coordinate just like normal cells; ephemeral cells fail
        // fetch_cell_idx and are skipped — exactly what we want.
        let mut occupied: BTreeSet<usize> = BTreeSet::new();
        if let Some(sc) = self
            .controller
            .status
            .container
            .get_sheet_container(self.sheet_id)
        {
            for (id, cell) in sc.cells.iter() {
                if matches!(cell.value, logisheets_base::CellValue::Blank) {
                    continue;
                }
                if let Ok((r, c)) = nav.fetch_cell_idx(&self.sheet_id, id) {
                    if vertical {
                        if c == col {
                            occupied.insert(r);
                        }
                    } else if r == row {
                        occupied.insert(c);
                    }
                }
            }
        }

        // Block spans crossing the active line, as (lo, hi) along the moving axis.
        let mut spans: Vec<(usize, usize)> = vec![];
        for (r_lo, c_lo, r_hi, c_hi) in nav.get_block_rects(&self.sheet_id) {
            if vertical {
                if c_lo <= col && col <= c_hi {
                    spans.push((r_lo, r_hi));
                }
            } else if r_lo <= row && row <= r_hi {
                spans.push((c_lo, c_hi));
            }
        }

        let p0 = if vertical { row } else { col };
        match boundary_1d(p0, &occupied, &spans, forward) {
            Some(p) if vertical => Ok(CellCoordinate { x: col, y: p }),
            Some(p) => Ok(CellCoordinate { x: p, y: row }),
            None => Err(Error::Basic(BasicError::CellIdNotFound(row, col))),
        }
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

    #[inline]
    pub(crate) fn get_applicable_raw_style_id(&self, cell_id: &CellId) -> StyleId {
        let style_id = if let Some(cell) = self
            .controller
            .status
            .container
            .get_cell(self.sheet_id, &cell_id)
        {
            cell.style
        } else {
            0
        };
        if style_id != 0 {
            return style_id;
        }
        if let CellId::NormalCell(normal_cell_id) = cell_id {
            let row_id = normal_cell_id.row;
            if let Some(row_info) = self
                .controller
                .status
                .container
                .get_row_info(self.sheet_id, row_id)
            {
                if row_info.style != 0 {
                    return row_info.style;
                }
            }
            let col_id = normal_cell_id.col;

            if let Some(col_info) = self
                .controller
                .status
                .container
                .get_col_info(self.sheet_id, col_id)
            {
                if col_info.style != 0 {
                    return col_info.style;
                }
            }
        } else if let CellId::BlockCell(block_cell_id) = cell_id {
            let block_id = block_cell_id.block_id;
            let row_id = block_cell_id.row;
            let col_id = block_cell_id.col;
            if let Some(col_info) =
                self.controller
                    .status
                    .container
                    .get_block_col_info(self.sheet_id, block_id, col_id)
            {
                if col_info.style.is_some() && col_info.style.unwrap() != 0 {
                    return col_info.style.unwrap();
                }
            }
            if let Some(row_info) =
                self.controller
                    .status
                    .container
                    .get_block_row_info(self.sheet_id, block_id, row_id)
            {
                if row_info.style.is_some() && row_info.style.unwrap() != 0 {
                    return row_info.style.unwrap();
                }
            }
        }
        0
    }

    fn get_raw_style_by_id(&self, cell_id: &CellId) -> Result<RawStyle> {
        let style_id = self.get_applicable_raw_style_id(cell_id);
        let raw_style = self.controller.status.style_manager.get_style(style_id);
        Ok(raw_style)
    }

    pub(crate) fn get_style_by_id(&self, cell_id: &CellId) -> Result<Style> {
        let raw_style = self.get_raw_style_by_id(cell_id)?;
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
        let comments = &self.controller.status.cell_attachment_manager.comments;
        let Some(sheet_comments) = comments.data.get(&self.sheet_id) else {
            return vec![];
        };
        sheet_comments
            .threads
            .iter()
            .fold(vec![], |mut prev, (cell_id, thread)| {
                if let Ok((row, col)) = self
                    .controller
                    .status
                    .navigator
                    .fetch_cell_idx(&self.sheet_id, cell_id)
                {
                    let notes = thread
                        .iter()
                        .map(|n| build_comment_note(comments, n))
                        .collect::<Vec<_>>();
                    prev.push(Comment { row, col, notes });
                }
                prev
            })
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
            .sheet_info_manager
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
                let schema = self
                    .controller
                    .status
                    .block_schema_manager
                    .schemas
                    .get(&(self.sheet_id, id))
                    .map(|s| {
                        let text_fetcher = |id: TextId| {
                            self.controller
                                .status
                                .text_id_manager
                                .get_string(&id)
                                .unwrap_or_default()
                                .clone()
                        };
                        let key_value = |cell_id: BlockCellId| {
                            self.controller
                                .status
                                .container
                                .get_cell(self.sheet_id, &CellId::BlockCell(cell_id))
                                .map(|cell| cell.value.to_string(&text_fetcher))
                                .unwrap_or_default()
                        };

                        let (keys, fields, random_entries) = match s {
                            Schema::RowSchema(schema) => {
                                let keys = schema
                                    .get_all_key_cell_ids(id, &block_place)
                                    .into_iter()
                                    .map(|cell_id| {
                                        let idx = block_place
                                            .cols
                                            .iter()
                                            .position(|col_id| col_id == &cell_id.col)
                                            .unwrap();
                                        crate::controller::display::BlockSchemaKeyEntry {
                                            key: key_value(cell_id),
                                            idx,
                                        }
                                    })
                                    .collect::<Vec<_>>();
                                let fields = schema
                                    .fields
                                    .iter()
                                    .map(|(f, e)| {
                                        let idx = block_place
                                            .cols
                                            .iter()
                                            .position(|id| id == &e.field_axis_id)
                                            .unwrap();
                                        crate::controller::display::BlockSchemaFieldEntry {
                                            field: f.clone(),
                                            idx,
                                            render_id: e.render_id.clone(),
                                            value_formula: e.value_formula.clone(),
                                            validation_formula: e.validation_formula.clone(),
                                            editability_formula: e.editability_formula.clone(),
                                        }
                                    })
                                    .collect::<Vec<_>>();
                                (keys, fields, vec![])
                            }
                            Schema::ColSchema(schema) => {
                                let keys = schema
                                    .get_all_key_cell_ids(id, &block_place)
                                    .into_iter()
                                    .map(|cell_id| {
                                        let idx = block_place
                                            .rows
                                            .iter()
                                            .position(|row_id| row_id == &cell_id.row)
                                            .unwrap();
                                        crate::controller::display::BlockSchemaKeyEntry {
                                            key: key_value(cell_id),
                                            idx,
                                        }
                                    })
                                    .collect::<Vec<_>>();
                                let fields = schema
                                    .fields
                                    .iter()
                                    .map(|(f, e)| {
                                        let idx = block_place
                                            .rows
                                            .iter()
                                            .position(|id| id == &e.field_axis_id)
                                            .unwrap();
                                        crate::controller::display::BlockSchemaFieldEntry {
                                            field: f.clone(),
                                            idx,
                                            render_id: e.render_id.clone(),
                                            value_formula: e.value_formula.clone(),
                                            validation_formula: e.validation_formula.clone(),
                                            editability_formula: e.editability_formula.clone(),
                                        }
                                    })
                                    .collect::<Vec<_>>();
                                (keys, fields, vec![])
                            }
                            Schema::RandomSchema(schema) => {
                                let random_entries = schema
                                    .key_field
                                    .iter()
                                    .map(|(k, row_id, col_id, render_id)| {
                                        let row = block_place
                                            .rows
                                            .iter()
                                            .position(|id| id == row_id)
                                            .unwrap();
                                        let col = block_place
                                            .cols
                                            .iter()
                                            .position(|id| id == col_id)
                                            .unwrap();
                                        BlockSchemaRandomEntry {
                                            key: k.clone(),
                                            row,
                                            col,
                                            render_id: render_id.clone(),
                                        }
                                    })
                                    .collect::<Vec<_>>();
                                (vec![], vec![], random_entries)
                            }
                        };

                        BlockSchema {
                            name: s.get_ref_name(),
                            schema_type: match s {
                                Schema::RowSchema(_) => BlockSchemaType::Row,
                                Schema::ColSchema(_) => BlockSchemaType::Col,
                                Schema::RandomSchema(_) => BlockSchemaType::Random,
                            },
                            keys,
                            fields,
                            random_entries,
                        }
                    });

                let mut field_renders = vec![];
                let mut seen_render_ids = HashSet::new();
                for i in block_place.rows.iter() {
                    for j in block_place.cols.iter() {
                        let cell_id = BlockCellId {
                            block_id: id,
                            row: *i,
                            col: *j,
                        };
                        if let Some(render_id) = self
                            .controller
                            .status
                            .block_schema_manager
                            .get_render_id(&self.sheet_id, &cell_id)
                        {
                            if !seen_render_ids.insert(render_id.clone()) {
                                continue;
                            }
                            if let Some(info) =
                                self.controller.status.field_render_manager.get(&render_id)
                            {
                                let style = info.style.map(|sid| {
                                    let raw_style =
                                        self.controller.status.style_manager.get_style(sid);
                                    let style_converter = StyleConverter {
                                        theme_manager: &self.controller.settings.theme,
                                    };
                                    style_converter.convert_style(raw_style)
                                });
                                field_renders.push(crate::controller::display::FieldRenderEntry {
                                    render_id,
                                    style,
                                    diy_render: info.diy_render.unwrap_or(false),
                                });
                            }
                        }
                    }
                }
                let mut cell_values = vec![];
                for i in block_place.rows.iter() {
                    for j in block_place.cols.iter() {
                        let cell_id = CellId::BlockCell(BlockCellId {
                            block_id: id,
                            row: *i,
                            col: *j,
                        });
                        let cell_value = self.get_value_by_id(&cell_id).unwrap();
                        // BlockCellInfo.shadow_value is the legacy
                        // single-shadow field; it now specifically
                        // surfaces the Validation kind's shadow (the
                        // only one the host's ValidationCell widget
                        // currently subscribes to). Other kinds — e.g.
                        // UserEditable — are queried directly via
                        // get_shadow_cell_id and read separately.
                        if let Some(shadow_id) = self.controller.sid_assigner.find_shadow_id(
                            self.sheet_id,
                            cell_id,
                            crate::sid_assigner::ShadowKind::Validation,
                        ) {
                            let shadow_cell_id = CellId::EphemeralCell(shadow_id);
                            let shadow_cell_value = self.get_value_by_id(&shadow_cell_id).unwrap();
                            cell_values.push(BlockCellInfo {
                                value: cell_value,
                                shadow_value: Some(shadow_cell_value),
                            });
                        } else {
                            cell_values.push(BlockCellInfo {
                                value: cell_value,
                                shadow_value: None,
                            });
                        }
                    }
                }
                BlockInfo {
                    sheet_idx,
                    sheet_id: self.sheet_id,
                    block_id: id,
                    row_start: row,
                    row_cnt: block_place.rows.len(),
                    col_start: col,
                    col_cnt: block_place.cols.len(),
                    schema,
                    field_renders,
                    cells: cell_values,
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

    /// Cells whose formula references the given range (Excel "trace dependents").
    /// One entry per (dependent cell, the reference it used) intersecting the
    /// query rectangle. Dependents may live on other sheets (each carries its
    /// own `sheet_idx`). v1 resolves normal (non-block) range references;
    /// block-relative / cube / name references are skipped.
    pub fn get_dependents(
        &self,
        start_row: usize,
        start_col: usize,
        end_row: usize,
        end_col: usize,
    ) -> Result<Vec<DependentCell>> {
        let r0 = start_row.min(end_row);
        let r1 = start_row.max(end_row);
        let c0 = start_col.min(end_col);
        let c1 = start_col.max(end_col);
        let graph = &self.controller.status.formula_manager.graph;
        let mut out: Vec<DependentCell> = Vec::new();
        let mut seen: HashSet<(usize, usize, usize, usize, usize, usize, usize)> = HashSet::new();
        for (dep_vertex, owners) in graph.rdeps.iter() {
            let (sid, rid) = match dep_vertex {
                Vertex::Range(s, r) if *s == self.sheet_id => (*s, *r),
                _ => continue,
            };
            let rect = match self.resolve_range_rect(sid, rid) {
                Some(x) => x,
                None => continue,
            };
            if !rect.intersects(r0, c0, r1, c1) {
                continue;
            }
            let via = self.rect_to_ref(&rect);
            for owner in owners.iter() {
                if let Some((oidx, orow, ocol)) = self.resolve_owner_cell(owner) {
                    let key = (
                        oidx,
                        orow,
                        ocol,
                        via.start_row,
                        via.start_col,
                        via.end_row,
                        via.end_col,
                    );
                    if seen.insert(key) {
                        out.push(DependentCell {
                            sheet_idx: oidx,
                            row: orow,
                            col: ocol,
                            via: via.clone(),
                        });
                    }
                }
            }
        }
        Ok(out)
    }

    /// The ranges/cells a cell's formula references (Excel "trace precedents").
    pub fn get_precedents(&self, row: usize, col: usize) -> Result<Vec<CellRefRange>> {
        let status = &self.controller.status;
        let cell_id = status.navigator.fetch_cell_id(&self.sheet_id, row, col)?;
        let range: Range = cell_id.into();
        let range_id = match status
            .range_manager
            .get_range_id_assert(&self.sheet_id, &range)
        {
            Some(id) => id,
            None => return Ok(vec![]),
        };
        let vertex = Vertex::Range(self.sheet_id, range_id);
        let mut out: Vec<CellRefRange> = Vec::new();
        let mut seen: HashSet<(usize, usize, usize, usize, usize, bool, bool)> = HashSet::new();
        if let Some(deps) = status.formula_manager.graph.get_deps(&vertex) {
            for dep in deps.iter() {
                if let Vertex::Range(s, r) = dep {
                    if let Some(rect) = self.resolve_range_rect(*s, *r) {
                        let refr = self.rect_to_ref(&rect);
                        let key = (
                            refr.sheet_idx,
                            refr.start_row,
                            refr.start_col,
                            refr.end_row,
                            refr.end_col,
                            refr.all_rows,
                            refr.all_cols,
                        );
                        if seen.insert(key) {
                            out.push(refr);
                        }
                    }
                }
            }
        }
        Ok(out)
    }

    /// Resolve a normal-range vertex to a rectangle. Block/ephemeral → None.
    fn resolve_range_rect(&self, sheet_id: SheetId, range_id: RangeId) -> Option<ResolvedRect> {
        let range = self
            .controller
            .status
            .range_manager
            .get_range(&sheet_id, &range_id)?;
        let nav = &self.controller.status.navigator;
        match range {
            Range::Normal(NormalRange::Single(nc)) => {
                let (r, c) = nav.fetch_normal_cell_idx(&sheet_id, &nc).ok()?;
                Some(ResolvedRect {
                    sheet_id,
                    r0: r,
                    c0: c,
                    r1: r,
                    c1: c,
                    all_rows: false,
                    all_cols: false,
                })
            }
            Range::Normal(NormalRange::AddrRange(s, e)) => {
                let (sr, sc) = nav.fetch_normal_cell_idx(&sheet_id, &s).ok()?;
                let (er, ec) = nav.fetch_normal_cell_idx(&sheet_id, &e).ok()?;
                Some(ResolvedRect {
                    sheet_id,
                    r0: sr.min(er),
                    c0: sc.min(ec),
                    r1: sr.max(er),
                    c1: sc.max(ec),
                    all_rows: false,
                    all_cols: false,
                })
            }
            Range::Normal(NormalRange::RowRange(a, b)) => {
                let ra = nav.fetch_row_idx(&sheet_id, &a).ok()?;
                let rb = nav.fetch_row_idx(&sheet_id, &b).ok()?;
                // Whole rows → spans every column.
                Some(ResolvedRect {
                    sheet_id,
                    r0: ra.min(rb),
                    c0: 0,
                    r1: ra.max(rb),
                    c1: 0,
                    all_rows: false,
                    all_cols: true,
                })
            }
            Range::Normal(NormalRange::ColRange(a, b)) => {
                let ca = nav.fetch_col_idx(&sheet_id, &a).ok()?;
                let cb = nav.fetch_col_idx(&sheet_id, &b).ok()?;
                // Whole columns → spans every row.
                Some(ResolvedRect {
                    sheet_id,
                    r0: 0,
                    c0: ca.min(cb),
                    r1: 0,
                    c1: ca.max(cb),
                    all_rows: true,
                    all_cols: false,
                })
            }
            Range::Block(_) | Range::Ephemeral(_) => None,
        }
    }

    /// Resolve an owner (formula-cell) vertex to (sheet_idx, row, col).
    fn resolve_owner_cell(&self, vertex: &Vertex) -> Option<(usize, usize, usize)> {
        let (sid, rid) = match vertex {
            Vertex::Range(s, r) => (*s, *r),
            _ => return None,
        };
        let range = self.controller.status.range_manager.get_range(&sid, &rid)?;
        let nav = &self.controller.status.navigator;
        let (row, col) = match range {
            Range::Normal(NormalRange::Single(nc)) => nav.fetch_normal_cell_idx(&sid, &nc).ok()?,
            Range::Block(BlockRange::Single(bc)) => nav.fetch_block_cell_idx(&sid, &bc).ok()?,
            _ => return None,
        };
        let idx = self
            .controller
            .status
            .sheet_info_manager
            .get_sheet_idx(&sid)?;
        Some((idx, row, col))
    }

    fn rect_to_ref(&self, rect: &ResolvedRect) -> CellRefRange {
        let sheet_idx = self
            .controller
            .status
            .sheet_info_manager
            .get_sheet_idx(&rect.sheet_id)
            .unwrap_or(0);
        CellRefRange {
            sheet_idx,
            start_row: rect.r0,
            start_col: rect.c0,
            end_row: rect.r1,
            end_col: rect.c1,
            all_rows: rect.all_rows,
            all_cols: rect.all_cols,
        }
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
            row_info.ht.unwrap_or(self.get_default_row_height())
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
        let block_place = self.get_block_place(block_id)?;
        let (row_cnt, col_cnt) = block_place.get_block_size();
        let (row_start, col_start) = self.get_block_master_cell(block_id)?;
        let bp = self
            .controller
            .status
            .navigator
            .get_block_place(&self.sheet_id, &block_id)?;
        let schema = self
            .controller
            .status
            .block_schema_manager
            .schemas
            .get(&(self.sheet_id, block_id))
            .map(|s| {
                let text_fetcher = |id: TextId| {
                    self.controller
                        .status
                        .text_id_manager
                        .get_string(&id)
                        .unwrap_or_default()
                        .clone()
                };
                let key_value = |cell_id: BlockCellId| {
                    self.controller
                        .status
                        .container
                        .get_cell(self.sheet_id, &CellId::BlockCell(cell_id))
                        .map(|cell| cell.value.to_string(&text_fetcher))
                        .unwrap_or_default()
                };

                let (keys, fields, random_entries) = match s {
                    Schema::RowSchema(schema) => {
                        let keys = schema
                            .get_all_key_cell_ids(block_id, bp)
                            .into_iter()
                            .map(|cell_id| {
                                let idx = block_place
                                    .cols
                                    .iter()
                                    .position(|id| id == &cell_id.col)
                                    .unwrap();
                                crate::controller::display::BlockSchemaKeyEntry {
                                    key: key_value(cell_id),
                                    idx,
                                }
                            })
                            .collect::<Vec<_>>();
                        let fields = schema
                            .fields
                            .iter()
                            .map(|(f, e)| {
                                let idx = block_place
                                    .cols
                                    .iter()
                                    .position(|id| id == &e.field_axis_id)
                                    .unwrap();
                                crate::controller::display::BlockSchemaFieldEntry {
                                    field: f.clone(),
                                    idx,
                                    render_id: e.render_id.clone(),
                                    value_formula: e.value_formula.clone(),
                                    validation_formula: e.validation_formula.clone(),
                                    editability_formula: e.editability_formula.clone(),
                                }
                            })
                            .collect::<Vec<_>>();
                        (keys, fields, vec![])
                    }
                    Schema::ColSchema(schema) => {
                        let keys = schema
                            .get_all_key_cell_ids(block_id, bp)
                            .into_iter()
                            .map(|cell_id| {
                                let idx = block_place
                                    .rows
                                    .iter()
                                    .position(|id| id == &cell_id.row)
                                    .unwrap();
                                crate::controller::display::BlockSchemaKeyEntry {
                                    key: key_value(cell_id),
                                    idx,
                                }
                            })
                            .collect::<Vec<_>>();
                        let fields = schema
                            .fields
                            .iter()
                            .map(|(f, e)| {
                                let idx = block_place
                                    .rows
                                    .iter()
                                    .position(|id| id == &e.field_axis_id)
                                    .unwrap();
                                crate::controller::display::BlockSchemaFieldEntry {
                                    field: f.clone(),
                                    idx,
                                    render_id: e.render_id.clone(),
                                    value_formula: e.value_formula.clone(),
                                    validation_formula: e.validation_formula.clone(),
                                    editability_formula: e.editability_formula.clone(),
                                }
                            })
                            .collect::<Vec<_>>();
                        (keys, fields, vec![])
                    }
                    Schema::RandomSchema(schema) => {
                        let random_entries = schema
                            .key_field
                            .iter()
                            .map(|(k, row_id, col_id, render_id)| {
                                let row =
                                    block_place.rows.iter().position(|id| id == row_id).unwrap();
                                let col =
                                    block_place.cols.iter().position(|id| id == col_id).unwrap();
                                BlockSchemaRandomEntry {
                                    key: k.clone(),
                                    row,
                                    col,
                                    render_id: render_id.clone(),
                                }
                            })
                            .collect::<Vec<_>>();
                        (vec![], vec![], random_entries)
                    }
                };

                BlockSchema {
                    name: s.get_ref_name(),
                    schema_type: match s {
                        Schema::RowSchema(_) => BlockSchemaType::Row,
                        Schema::ColSchema(_) => BlockSchemaType::Col,
                        Schema::RandomSchema(_) => BlockSchemaType::Random,
                    },
                    keys,
                    fields,
                    random_entries,
                }
            });

        let mut field_renders = vec![];
        let mut seen_render_ids = HashSet::new();
        for i in block_place.rows.iter() {
            for j in block_place.cols.iter() {
                let cell_id = BlockCellId {
                    block_id,
                    row: *i,
                    col: *j,
                };
                if let Some(render_id) = self
                    .controller
                    .status
                    .block_schema_manager
                    .get_render_id(&self.sheet_id, &cell_id)
                {
                    if !seen_render_ids.insert(render_id.clone()) {
                        continue;
                    }
                    if let Some(info) = self.controller.status.field_render_manager.get(&render_id)
                    {
                        let style = info.style.map(|sid| {
                            let raw_style = self.controller.status.style_manager.get_style(sid);
                            let style_converter = StyleConverter {
                                theme_manager: &self.controller.settings.theme,
                            };
                            style_converter.convert_style(raw_style)
                        });
                        field_renders.push(crate::controller::display::FieldRenderEntry {
                            render_id,
                            style,
                            diy_render: info.diy_render.unwrap_or(false),
                        });
                    }
                }
            }
        }
        let mut cell_values = Vec::new();
        for i in block_place.rows.iter() {
            for j in block_place.cols.iter() {
                let cell_id = CellId::BlockCell(BlockCellId {
                    block_id,
                    row: *i,
                    col: *j,
                });
                let mut shadow_value = None;
                if let Some(shadow_id) = self.controller.sid_assigner.find_shadow_id(
                    self.sheet_id,
                    cell_id,
                    crate::sid_assigner::ShadowKind::Validation,
                ) {
                    let shadow_cell_id = CellId::EphemeralCell(shadow_id);
                    let shadow_cell_value = self.get_value_by_id(&shadow_cell_id)?;
                    shadow_value = Some(shadow_cell_value);
                }
                let cell_value = self.get_value_by_id(&cell_id)?;
                cell_values.push(BlockCellInfo {
                    value: cell_value,
                    shadow_value,
                });
            }
        }
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
                .sheet_info_manager
                .get_sheet_idx(&self.sheet_id)
                .unwrap(),
            schema,
            field_renders,
            cells: cell_values,
        })
    }

    #[inline]
    pub fn get_block_place(&self, block_id: BlockId) -> Result<&BlockPlace> {
        self.controller
            .status
            .navigator
            .get_block_place(&self.sheet_id, &block_id)
            .map_err(|e| e.into())
    }

    #[inline]
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

    pub fn get_cell_id(&self, row: usize, col: usize) -> Result<CellId> {
        self.controller
            .status
            .navigator
            .fetch_cell_id(&self.sheet_id, row, col)
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
                            row_idx: r,
                            col_idx: c,
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
    if reverse { curr - 1 } else { curr + 1 }
}

fn build_comment_person(comments: &InternalComments, person_id: &PersonId) -> CommentPerson {
    match comments.get_person(person_id) {
        Some(p) => CommentPerson {
            display_name: p.display_name.clone(),
            user_id: p.user_id.clone(),
            provider_id: p.provider_id.clone(),
        },
        None => CommentPerson {
            display_name: String::new(),
            user_id: None,
            provider_id: None,
        },
    }
}

fn build_comment_note(comments: &InternalComments, note: &InternalNote) -> CommentNote {
    CommentNote {
        id: note.id.clone(),
        author: build_comment_person(comments, &note.person),
        dt: note.dt.clone(),
        content: note.text.clone(),
        parent_id: note.parent.clone(),
        mentions: note
            .mentions
            .iter()
            .map(|m| CommentMentionInfo {
                start: m.start,
                len: m.len,
                person: build_comment_person(comments, &m.person),
            })
            .collect(),
        resolved: note.resolved,
    }
}

#[cfg(test)]
mod boundary_tests {
    use super::boundary_1d;
    use std::collections::BTreeSet;

    fn occ(rows: &[usize]) -> BTreeSet<usize> {
        rows.iter().copied().collect()
    }

    #[test]
    fn next_data_cell_forward() {
        // Data at 3 and 7; from 0 we stop at the nearest one ahead.
        let o = occ(&[3, 7]);
        assert_eq!(boundary_1d(0, &o, &[], true), Some(3));
        assert_eq!(boundary_1d(3, &o, &[], true), Some(7));
        // Nothing past 7 -> no boundary.
        assert_eq!(boundary_1d(7, &o, &[], true), None);
    }

    #[test]
    fn next_data_cell_backward() {
        let o = occ(&[3, 7]);
        assert_eq!(boundary_1d(10, &o, &[], false), Some(7));
        assert_eq!(boundary_1d(7, &o, &[], false), Some(3));
        // No data above row 3 -> fall back to the start edge 0 (Up/Left).
        assert_eq!(boundary_1d(3, &o, &[], false), Some(0));
        // Already at the start edge -> nowhere to go.
        assert_eq!(boundary_1d(0, &o, &[], false), None);
    }

    #[test]
    fn backward_falls_back_to_start_forward_does_not() {
        // Empty line: Up/Left jump to 0; Down/Right find nothing -> None.
        assert_eq!(boundary_1d(5, &occ(&[]), &[], false), Some(0));
        assert_eq!(boundary_1d(5, &occ(&[]), &[], true), None);
    }

    #[test]
    fn inside_block_jumps_to_far_edge() {
        let blocks = [(5usize, 9usize)];
        // From inside (6) going down -> bottom edge 9.
        assert_eq!(boundary_1d(6, &occ(&[]), &blocks, true), Some(9));
        // From inside (6) going up -> top edge 5.
        assert_eq!(boundary_1d(6, &occ(&[]), &blocks, false), Some(5));
    }

    #[test]
    fn approach_block_stops_before_entering() {
        let blocks = [(5usize, 9usize)];
        // A gap precedes the block: stop at 4, the cell just before it.
        assert_eq!(boundary_1d(0, &occ(&[]), &blocks, true), Some(4));
        // Already adjacent (at 4): next press enters and jumps to far edge 9.
        assert_eq!(boundary_1d(4, &occ(&[]), &blocks, true), Some(9));
        // At the bottom edge (9): leaving -> nothing further -> None.
        assert_eq!(boundary_1d(9, &occ(&[]), &blocks, true), None);
    }

    #[test]
    fn data_before_block_wins_when_closer() {
        let blocks = [(10usize, 15usize)];
        // Data at 8 is closer than the block's pre-edge (9).
        assert_eq!(boundary_1d(0, &occ(&[8]), &blocks, true), Some(8));
        // Without that data cell, stop just before the block at 9.
        assert_eq!(boundary_1d(0, &occ(&[]), &blocks, true), Some(9));
    }
}
