mod delete_block_line;
mod delete_line;
mod input;
mod insert_block_line;
mod insert_line;
mod occupy_addr_range;
mod remove_block;
mod utils;
use std::collections::HashSet;

use delete_block_line::delete_block_line;
use delete_line::delete_line;
use input::input;
use insert_block_line::insert_block_line;
use insert_line::insert_line;
use logisheets_base::{errors::BasicError, BlockRange, NormalRange, Range, RangeId, SheetId};
use remove_block::remove_block;

use crate::{
    edit_action::EditPayload, range_manager::executors::occupy_addr_range::occupy_addr_range, Error,
};

use super::{ctx::RangeExecCtx, manager::RangeManager};

pub struct RangeExecutor {
    pub manager: RangeManager,
    pub dirty_ranges: HashSet<(SheetId, RangeId)>,
    pub removed_ranges: HashSet<(SheetId, RangeId)>,
}

impl RangeExecutor {
    pub fn new(manager: RangeManager) -> Self {
        Self {
            manager,
            dirty_ranges: HashSet::new(),
            removed_ranges: HashSet::new(),
        }
    }

    pub fn execute<C: RangeExecCtx>(self, ctx: &C, payload: EditPayload) -> Result<Self, Error> {
        match payload {
            EditPayload::MoveBlock(move_block) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(move_block.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let (row_cnt, col_cnt) = ctx.get_block_size(sheet_id, move_block.id).unwrap();
                if ctx.any_other_blocks_in(
                    sheet_id,
                    move_block.id,
                    move_block.new_master_row,
                    move_block.new_master_col,
                    row_cnt + move_block.new_master_row - 1,
                    col_cnt + move_block.new_master_col - 1,
                ) {
                    Ok(self)
                } else {
                    let start = ctx
                        .fetch_norm_cell_id(
                            &sheet_id,
                            move_block.new_master_row,
                            move_block.new_master_col,
                        )
                        .unwrap();
                    let end = ctx
                        .fetch_norm_cell_id(
                            &sheet_id,
                            move_block.new_master_row + row_cnt - 1,
                            move_block.new_master_col + col_cnt - 1,
                        )
                        .unwrap();
                    let res = occupy_addr_range(self, sheet_id, start, end, ctx);
                    Ok(res)
                }
            }
            EditPayload::RemoveBlock(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let res = remove_block(self, sheet_id, p.id);
                Ok(res)
            }
            EditPayload::CreateBlock(create_block) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(create_block.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let start = ctx.fetch_norm_cell_id(
                    &sheet_id,
                    create_block.master_row,
                    create_block.master_col,
                )?;
                let end = ctx.fetch_norm_cell_id(
                    &sheet_id,
                    create_block.master_row + create_block.row_cnt - 1,
                    create_block.master_col + create_block.col_cnt - 1,
                )?;
                let result = occupy_addr_range(self, sheet_id, start, end, ctx);
                Ok(result)
            }
            EditPayload::CellInput(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let res = input(self, sheet_id, p.row, p.col, ctx)?;
                Ok(res)
            }
            EditPayload::CellClear(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let res = input(self, sheet_id, p.row, p.col, ctx)?;
                Ok(res)
            }
            EditPayload::DeleteSheet(_) => todo!(),
            EditPayload::InsertCols(insert_cols) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(insert_cols.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let result = insert_line(
                    self,
                    sheet_id,
                    false,
                    insert_cols.start,
                    insert_cols.count as u32,
                    ctx,
                );
                Ok(result)
            }
            EditPayload::DeleteCols(delete_cols) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(delete_cols.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let result = delete_line(
                    self,
                    sheet_id,
                    false,
                    delete_cols.start,
                    delete_cols.count as u32,
                    ctx,
                );
                Ok(result)
            }
            EditPayload::InsertRows(insert_rows) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(insert_rows.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let result = insert_line(
                    self,
                    sheet_id,
                    true,
                    insert_rows.start,
                    insert_rows.count as u32,
                    ctx,
                );
                Ok(result)
            }
            EditPayload::DeleteRows(delete_rows) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(delete_rows.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let result = delete_line(
                    self,
                    sheet_id,
                    true,
                    delete_rows.start,
                    delete_rows.count as u32,
                    ctx,
                );
                Ok(result)
            }
            EditPayload::InsertColsInBlock(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let res = insert_block_line(
                    self,
                    sheet_id,
                    p.block_id,
                    false,
                    p.start as u32,
                    p.cnt as u32,
                    ctx,
                );
                Ok(res)
            }
            EditPayload::DeleteColsInBlock(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let res = delete_block_line(
                    self,
                    sheet_id,
                    p.block_id,
                    false,
                    p.start as u32,
                    p.cnt as u32,
                    ctx,
                );
                Ok(res)
            }
            EditPayload::InsertRowsInBlock(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let res = insert_block_line(
                    self,
                    sheet_id,
                    p.block_id,
                    true,
                    p.start as u32,
                    p.cnt as u32,
                    ctx,
                );
                Ok(res)
            }
            EditPayload::DeleteRowsInBlock(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let res = delete_block_line(
                    self,
                    sheet_id,
                    p.block_id,
                    true,
                    p.start as u32,
                    p.cnt as u32,
                    ctx,
                );
                Ok(res)
            }
            _ => Ok(self),
        }
    }

    pub fn normal_range_update<F>(mut self, sheet_id: &SheetId, func: &mut F) -> Self
    where
        F: FnMut(&NormalRange, &RangeId) -> RangeUpdateType,
    {
        let mut to_update = HashSet::new();
        let mut to_remove = HashSet::new();
        let manager = self.manager.get_sheet_range_manager(sheet_id);
        let mut dirty_ranges = self.dirty_ranges;
        let mut removed_ranges = self.removed_ranges;
        manager
            .normal_range_to_id
            .iter()
            .for_each(|(range, range_id)| match func(range, range_id) {
                RangeUpdateType::Dirty => {
                    dirty_ranges.insert((*sheet_id, *range_id));
                }
                RangeUpdateType::UpdateTo(new_range) => {
                    dirty_ranges.insert((*sheet_id, new_range.id));
                    to_update.insert(new_range);
                }
                RangeUpdateType::None => {}
                RangeUpdateType::Removed => {
                    to_remove.insert(range_id.clone());
                    dirty_ranges.insert((*sheet_id, *range_id));
                }
            });
        to_update.into_iter().for_each(|new_range| {
            if let Range::Normal(range) = new_range.range {
                manager
                    .id_to_normal_range
                    .insert(new_range.id, range.clone());
                manager.normal_range_to_id.insert(range, new_range.id);
            }
        });
        to_remove.into_iter().for_each(|range_id| {
            if let Some(data) = manager.id_to_normal_range.get(&range_id) {
                manager.normal_range_to_id.remove(data);
                manager.id_to_normal_range.remove(&range_id);
                removed_ranges.insert((*sheet_id, range_id));
            }
        });
        RangeExecutor {
            manager: self.manager,
            removed_ranges,
            dirty_ranges,
        }
    }

    pub fn block_range_update<F>(mut self, sheet_id: &SheetId, func: &mut F) -> Self
    where
        F: FnMut(&BlockRange, &RangeId) -> RangeUpdateType,
    {
        let mut dirty_ranges = self.dirty_ranges;
        let mut removed_ranges = self.removed_ranges;
        let mut to_update = HashSet::new();
        let mut to_remove = HashSet::new();
        let manager = self.manager.get_sheet_range_manager(sheet_id);
        manager
            .block_range_to_id
            .iter()
            .for_each(|(range, range_id)| match func(range, range_id) {
                RangeUpdateType::Dirty => {
                    dirty_ranges.insert((*sheet_id, *range_id));
                }
                RangeUpdateType::UpdateTo(new_range) => {
                    dirty_ranges.insert((*sheet_id, new_range.id));
                    to_update.insert(new_range);
                }
                RangeUpdateType::None => {}
                RangeUpdateType::Removed => {
                    to_remove.insert(range_id.clone());
                    dirty_ranges.insert((*sheet_id, *range_id));
                }
            });
        to_update.into_iter().for_each(|new_range| {
            if let Range::Block(range) = new_range.range {
                manager
                    .id_to_block_range
                    .insert(new_range.id, range.clone());
                manager.block_range_to_id.insert(range, new_range.id);
            }
        });
        to_remove.into_iter().for_each(|range_id| {
            if let Some(data) = manager.id_to_normal_range.get(&range_id) {
                manager.normal_range_to_id.remove(data);
                manager.id_to_normal_range.remove(&range_id);
                removed_ranges.insert((*sheet_id, range_id));
            }
        });
        RangeExecutor {
            manager: self.manager,
            dirty_ranges,
            removed_ranges,
        }
    }
}

#[derive(Debug, Clone, Hash, Eq, PartialEq)]
pub struct NewRange {
    pub id: RangeId,
    pub range: Range,
}

pub enum RangeUpdateType {
    Dirty,
    UpdateTo(NewRange),
    None,
    Removed,
}
