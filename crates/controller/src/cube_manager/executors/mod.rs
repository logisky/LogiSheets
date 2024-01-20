mod delete_line;
mod input;
mod insert_line;
mod utils;
use std::collections::HashSet;

use delete_line::delete_line;
use input::input;
use insert_line::insert_line;
use logisheets_base::{errors::BasicError, Cube, CubeId};

use crate::{edit_action::EditPayload, Error};

use super::{ctx::CubeExecCtx, manager::CubeManager};

#[derive(Debug, Clone)]
pub struct CubeExecutor {
    pub manager: CubeManager,
    pub dirty_cubes: HashSet<CubeId>,
    pub removed_cubes: HashSet<CubeId>,
}

impl CubeExecutor {
    pub fn new(manager: CubeManager) -> Self {
        CubeExecutor {
            manager,
            dirty_cubes: HashSet::new(),
            removed_cubes: HashSet::new(),
        }
    }

    pub fn execute<C: CubeExecCtx>(
        self,
        ctx: &C,
        payload: EditPayload,
    ) -> Result<CubeExecutor, Error> {
        match payload {
            EditPayload::CellInput(cell_input) => {
                let sheet_idx = cell_input.sheet_idx;
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                Ok(input(self, sheet_id, cell_input.row, cell_input.col, ctx))
            }
            EditPayload::CellClear(cell_clear) => {
                let sheet_idx = cell_clear.sheet_idx;
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                Ok(input(self, sheet_id, cell_clear.row, cell_clear.col, ctx))
            }
            EditPayload::InsertCols(insert_cols) => {
                let sheet_idx = insert_cols.sheet_idx;
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                Ok(insert_line(
                    self,
                    sheet_id,
                    false,
                    insert_cols.start,
                    insert_cols.count as u32,
                    ctx,
                ))
            }
            EditPayload::DeleteCols(delete_cols) => {
                let sheet_idx = delete_cols.sheet_idx;
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                Ok(delete_line(
                    self,
                    sheet_id,
                    false,
                    delete_cols.start,
                    delete_cols.count as u32,
                    ctx,
                ))
            }
            EditPayload::InsertRows(insert_rows) => {
                let sheet_idx = insert_rows.sheet_idx;
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                Ok(insert_line(
                    self,
                    sheet_id,
                    true,
                    insert_rows.start,
                    insert_rows.count as u32,
                    ctx,
                ))
            }
            EditPayload::DeleteRows(delete_rows) => {
                let sheet_idx = delete_rows.sheet_idx;
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                Ok(delete_line(
                    self,
                    sheet_id,
                    true,
                    delete_rows.start,
                    delete_rows.count as u32,
                    ctx,
                ))
            }
            _ => Ok(self),
        }
    }

    pub fn cube_update<F>(self, func: &mut F) -> Self
    where
        F: FnMut(&Cube, &CubeId) -> CubeUpdateType,
    {
        let mut dirty_cubes = self.dirty_cubes;
        let removed_cubes = self.removed_cubes;
        let new_manager = self.manager.clone();
        self.manager
            .cube_to_id
            .iter()
            .for_each(|(c, id)| match func(c, id) {
                CubeUpdateType::Dirty => {
                    dirty_cubes.insert(*id);
                }
                CubeUpdateType::None => {}
            });
        CubeExecutor {
            manager: new_manager,
            dirty_cubes,
            removed_cubes,
        }
    }
}

pub enum CubeUpdateType {
    None,
    Dirty,
}
