use logisheets_base::{
    errors::BasicError, matrix_value::cross_product_usize, CellId, CellValue, NormalCellId,
    SheetId, TextId,
};

use crate::{
    cell::Cell,
    edit_action::{EditPayload, StyleUpdateType},
    Error,
};

use super::{ctx::ContainerExecCtx, DataContainer};

pub struct ContainerExecutor {
    pub container: DataContainer,
}

impl ContainerExecutor {
    pub fn new(container: DataContainer) -> Self {
        Self { container }
    }

    pub fn execute<C: ContainerExecCtx>(
        mut self,
        ctx: &mut C,
        payload: EditPayload,
    ) -> Result<(Self, bool), Error> {
        match payload {
            EditPayload::BlockInput(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let cell_value =
                    CellValue::from_string(p.input, &mut |t| -> TextId { ctx.fetch_text_id(t) });
                let cell_id = ctx.get_block_cell_id(sheet_id, p.block_id, p.row, p.col)?;
                self.container
                    .update_value(sheet_id, CellId::BlockCell(cell_id), cell_value);
                Ok((self, true))
            }
            EditPayload::MoveBlock(_) => Ok((self, false)),
            EditPayload::RemoveBlock(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let cells = ctx
                    .get_all_block_cells(sheet_id, p.id)?
                    .into_iter()
                    .map(|bid| CellId::BlockCell(bid))
                    .collect();
                let container = self.container.delete_cells(sheet_id, &cells);
                Ok((Self { container }, true))
            }
            EditPayload::CreateBlock(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let start_row = p.master_row;
                let start_col = p.master_col;
                let end_row = start_row + p.row_cnt - 1;
                let end_col = start_col + p.col_cnt - 1;
                let cells = cross_product_usize(start_row, end_row, start_col, end_col)
                    .into_iter()
                    .map(|(r, c)| ctx.fetch_cell_id(&sheet_id, r, c))
                    .filter(|c| c.is_ok())
                    .map(|c| c.unwrap())
                    .collect::<Vec<_>>();
                let container = self.container.delete_cells(sheet_id, &cells);
                Ok((Self { container }, true))
            }
            EditPayload::CellInput(p) => {
                if p.content.starts_with("=") {
                    // Formula
                    return Ok((self, false));
                }
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let cell_value =
                    CellValue::from_string(p.content, &mut |t| -> TextId { ctx.fetch_text_id(t) });
                let cell_id = ctx.fetch_cell_id(&sheet_id, p.row, p.col)?;
                self.container.update_value(sheet_id, cell_id, cell_value);
                Ok((self, true))
            }
            EditPayload::CellClear(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let cell_id = ctx.fetch_cell_id(&sheet_id, p.row, p.col)?;
                self.container.remove_cell(sheet_id, &cell_id);
                Ok((self, true))
            }
            EditPayload::SetColWidth(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let col_id = ctx.fetch_col_id(&sheet_id, p.col)?;
                let info = self.container.get_col_info_mut(sheet_id, col_id);
                info.custom_width = true;
                info.width = Some(p.width);
                Ok((self, true))
            }
            EditPayload::SetRowHeight(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let row_id = ctx.fetch_row_id(&sheet_id, p.row)?;
                let info = self.container.get_row_info_mut(sheet_id, row_id);
                info.custom_height = true;
                info.ht = Some(p.height);
                Ok((self, true))
            }
            EditPayload::DeleteSheet(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                self.container.data.remove(&sheet_id);
                Ok((self, true))
            }
            EditPayload::DeleteCols(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let bids =
                    ctx.get_affected_blockplace(sheet_id, p.start, p.count as usize, false)?;

                let mut deleted_cells = Vec::<CellId>::new();
                for block_id in bids.into_iter() {
                    let (row_cnt, col_cnt) = ctx.get_block_size(sheet_id, block_id)?;
                    let master = ctx.get_master_cell(sheet_id, block_id)?;
                    let (master_row, master_col) =
                        ctx.fetch_normal_cell_index(&sheet_id, &master)?;
                    let start_row = master_row;
                    let end_row = master_row + row_cnt as usize - 1;
                    let start_col = master_col + col_cnt;
                    let end_col = start_col + p.count as usize - 1;
                    cross_product_usize(start_row, end_row, start_col, end_col)
                        .into_iter()
                        .for_each(|(r, c)| {
                            if let Ok(cid) = ctx.fetch_cell_id(&sheet_id, r, c) {
                                deleted_cells.push(cid)
                            }
                        });
                }

                self.get_norm_cell_ids_by_line(ctx, &sheet_id, p.start, p.count, false)
                    .into_iter()
                    .for_each(|c| deleted_cells.push(CellId::NormalCell(c)));

                let container = self.container.delete_cells(sheet_id, &deleted_cells);
                Ok((Self { container }, true))
            }
            EditPayload::DeleteRows(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let bids =
                    ctx.get_affected_blockplace(sheet_id, p.start, p.count as usize, true)?;

                let mut deleted_cells = Vec::<CellId>::new();
                for block_id in bids.into_iter() {
                    let (row_cnt, col_cnt) = ctx.get_block_size(sheet_id, block_id)?;
                    let master = ctx.get_master_cell(sheet_id, block_id)?;
                    let (master_row, master_col) =
                        ctx.fetch_normal_cell_index(&sheet_id, &master)?;
                    let start_row = master_row + row_cnt;
                    let end_row = start_row + p.count as usize - 1;
                    let start_col = master_col;
                    let end_col = master_col + col_cnt as usize - 1;
                    cross_product_usize(start_row, end_row, start_col, end_col)
                        .into_iter()
                        .for_each(|(r, c)| {
                            if let Ok(cid) = ctx.fetch_cell_id(&sheet_id, r, c) {
                                deleted_cells.push(cid)
                            }
                        });
                }

                self.get_norm_cell_ids_by_line(ctx, &sheet_id, p.start, p.count, true)
                    .into_iter()
                    .for_each(|c| deleted_cells.push(CellId::NormalCell(c)));

                let container = self.container.delete_cells(sheet_id, &deleted_cells);
                Ok((Self { container }, true))
            }
            EditPayload::InsertColsInBlock(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let (row_cnt, col_cnt) = ctx.get_block_size(sheet_id, p.block_id)?;
                let master = ctx.get_master_cell(sheet_id, p.block_id)?;
                let (master_row, master_col) = ctx.fetch_normal_cell_index(&sheet_id, &master)?;
                let start_row = master_row + row_cnt;
                let end_row = start_row + p.cnt - 1;
                let start_col = master_col;
                let end_col = master_col + col_cnt - 1;
                let cells = cross_product_usize(start_row, end_row, start_col, end_col)
                    .into_iter()
                    .map(|(r, c)| ctx.fetch_cell_id(&sheet_id, r, c))
                    .filter(|c| c.is_ok())
                    .map(|c| c.unwrap())
                    .collect::<Vec<_>>();
                let container = self.container.delete_cells(sheet_id, &cells);
                Ok((Self { container }, true))
            }
            EditPayload::DeleteColsInBlock(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let (row_cnt, _) = ctx.get_block_size(sheet_id, p.block_id)?;
                let master = ctx.get_master_cell(sheet_id, p.block_id)?;
                let (master_row, master_col) = ctx.fetch_normal_cell_index(&sheet_id, &master)?;
                let start_row = master_row;
                let end_row = start_row + row_cnt - 1;
                let start_col = master_col + p.start;
                let end_col = start_col + p.cnt - 1;
                let cells = cross_product_usize(start_row, end_row, start_col, end_col)
                    .into_iter()
                    .map(|(r, c)| ctx.fetch_cell_id(&sheet_id, r, c))
                    .filter(|c| c.is_ok())
                    .map(|c| c.unwrap())
                    .collect::<Vec<_>>();
                let container = self.container.delete_cells(sheet_id, &cells);
                Ok((Self { container }, true))
            }
            EditPayload::InsertRowsInBlock(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let (row_cnt, col_cnt) = ctx.get_block_size(sheet_id, p.block_id)?;
                let master = ctx.get_master_cell(sheet_id, p.block_id)?;
                let (master_row, master_col) = ctx.fetch_normal_cell_index(&sheet_id, &master)?;
                let start_row = master_row + row_cnt;
                let end_row = start_row + p.cnt - 1;
                let start_col = master_col;
                let end_col = master_col + col_cnt - 1;
                let cells = cross_product_usize(start_row, end_row, start_col, end_col)
                    .into_iter()
                    .map(|(r, c)| ctx.fetch_cell_id(&sheet_id, r, c))
                    .filter(|c| c.is_ok())
                    .map(|c| c.unwrap())
                    .collect::<Vec<_>>();
                let container = self.container.delete_cells(sheet_id, &cells);
                Ok((Self { container }, true))
            }
            EditPayload::DeleteRowsInBlock(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let (_, col_cnt) = ctx.get_block_size(sheet_id, p.block_id)?;
                let master = ctx.get_master_cell(sheet_id, p.block_id)?;
                let (master_row, master_col) = ctx.fetch_normal_cell_index(&sheet_id, &master)?;
                let start_row = master_row + p.start;
                let end_row = start_row + p.cnt - 1;
                let start_col = master_col;
                let end_col = start_col + col_cnt - 1;
                let cells = cross_product_usize(start_row, end_row, start_col, end_col)
                    .into_iter()
                    .map(|(r, c)| ctx.fetch_cell_id(&sheet_id, r, c))
                    .filter(|c| c.is_ok())
                    .map(|c| c.unwrap())
                    .collect::<Vec<_>>();
                let container = self.container.delete_cells(sheet_id, &cells);
                Ok((Self { container }, true))
            }
            EditPayload::BlockStyleUpdate(payload) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(payload.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let cell_id = CellId::BlockCell(ctx.get_block_cell_id(
                    sheet_id,
                    payload.block_id,
                    payload.row,
                    payload.col,
                )?);
                if let Some(c) = self.container.get_cell_mut(sheet_id, &cell_id) {
                    let new_id = ctx.get_new_style_id(c.style, payload.style_update)?;
                    c.style = new_id;
                } else {
                    let new_id = ctx.get_new_style_id(0, payload.style_update)?;
                    self.container.add_cell(
                        sheet_id,
                        cell_id,
                        Cell {
                            value: CellValue::Blank,
                            style: new_id,
                        },
                    );
                }
                Ok((self, true))
            }
            EditPayload::CellStyleUpdate(style_update) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(style_update.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let cell_id = ctx.fetch_cell_id(&sheet_id, style_update.row, style_update.col)?;
                if let Some(c) = self.container.get_cell_mut(sheet_id, &cell_id) {
                    let new_id = ctx.get_new_style_id(c.style, style_update.ty)?;
                    c.style = new_id;
                } else {
                    let new_id = ctx.get_new_style_id(0, style_update.ty)?;
                    self.container.add_cell(
                        sheet_id,
                        cell_id,
                        Cell {
                            value: CellValue::Blank,
                            style: new_id,
                        },
                    );
                }
                Ok((self, true))
            }
            EditPayload::LineStyleUpdate(s) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(s.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                for i in s.from..=s.to {
                    if s.row {
                        let row_id = ctx.fetch_row_id(&sheet_id, i)?;
                        let row = self.container.get_row_info_mut(sheet_id, row_id);
                        let new_id = ctx.get_new_style_id(row.style, s.ty.clone())?;
                        row.style = new_id;
                    } else {
                        let col_id = ctx.fetch_col_id(&sheet_id, i)?;
                        let col = self.container.get_col_info_mut(sheet_id, col_id);
                        let new_id = ctx.get_new_style_id(col.style, s.ty.clone())?;
                        col.style = new_id;
                    }
                }
                Ok((self, true))
            }
            _ => Ok((self, false)),
        }
    }

    fn get_norm_cell_ids_by_line<C: ContainerExecCtx>(
        &self,
        ctx: &C,
        sheet_id: &SheetId,
        idx: usize,
        cnt: usize,
        is_row: bool,
    ) -> Vec<NormalCellId> {
        let sheet_container = self.container.data.get(&sheet_id);
        if sheet_container.is_none() {
            return Vec::new();
        }
        let mut result = Vec::<NormalCellId>::new();
        let sheet_container = sheet_container.unwrap();
        sheet_container.cells.iter().for_each(|(cid, _)| match cid {
            CellId::NormalCell(nc) => {
                let cidx = ctx.fetch_cell_index(&sheet_id, cid);
                if let Ok((r, c)) = cidx {
                    if is_row && r >= idx && r <= idx + cnt - 1 {
                        result.push(nc.clone())
                    } else if !is_row && c >= idx && c <= idx + cnt - 1 {
                        result.push(nc.clone())
                    }
                }
            }
            CellId::BlockCell(_) => {}
        });
        result
    }
}
