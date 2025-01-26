use logisheets_base::errors::BasicError;

use crate::{edit_action::EditPayload, Error};

use super::{ctx::CellAttachmentsExecCtx, CellAttachmentsManager};

pub struct CellAttachmentsExecutor {
    pub manager: CellAttachmentsManager,
}

impl CellAttachmentsExecutor {
    pub fn new(manager: CellAttachmentsManager) -> Self {
        Self { manager }
    }

    pub fn execute<C: CellAttachmentsExecCtx>(
        mut self,
        ctx: &mut C,
        payload: EditPayload,
    ) -> Result<(Self, bool), Error> {
        match payload {
            EditPayload::MergeCells(merge_cells) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(merge_cells.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let start_cell_id = ctx.fetch_norm_cell_id(
                    &sheet_id,
                    merge_cells.start_row,
                    merge_cells.start_col,
                )?;
                let end_cell_id =
                    ctx.fetch_norm_cell_id(&sheet_id, merge_cells.end_row, merge_cells.end_col)?;
                self.manager
                    .merge_cells
                    .add_merge_cell(sheet_id, start_cell_id, end_cell_id);
                Ok((self, true))
            }
            EditPayload::SplitMergedCells(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let cell_id = ctx.fetch_norm_cell_id(&sheet_id, p.row, p.col)?;

                if self
                    .manager
                    .merge_cells
                    .get_merge_cell(&sheet_id, &cell_id)
                    .is_some()
                {
                    self.manager.merge_cells = self
                        .manager
                        .merge_cells
                        .remove_merge_cell(sheet_id, cell_id);
                    Ok((self, true))
                } else {
                    Ok((self, false))
                }
            }
            _ => Ok((self, false)),
        }
    }
}
