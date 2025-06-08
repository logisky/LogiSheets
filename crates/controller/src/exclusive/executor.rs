use logisheets_base::errors::BasicError;

use crate::edit_action::EditPayload;
use crate::Error;

use super::ctx::ExclusiveManagerExecCtx;
use super::ExclusiveManager;

pub struct ExclusiveManagerExecutor {
    pub manager: ExclusiveManager,
}

impl ExclusiveManagerExecutor {
    pub fn new(manager: ExclusiveManager) -> Self {
        Self { manager }
    }

    pub fn execute<C: ExclusiveManagerExecCtx>(
        mut self,
        ctx: &mut C,
        payload: EditPayload,
    ) -> Result<(Self, bool), Error> {
        match payload {
            EditPayload::CreateDiyCell(create_diy_cell) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(create_diy_cell.sheet_idx)
                    .map_err(|l| Error::Basic(BasicError::SheetIdxExceed(l)))?;
                let cell_id = ctx
                    .fetch_cell_id(&sheet_id, create_diy_cell.row, create_diy_cell.col)
                    .map_err(|l| Error::Basic(l))?;

                match cell_id {
                    logisheets_base::CellId::BlockCell(block_cell_id) => {
                        self.manager
                            .diy_cell_manager
                            .create_new_diy_cell(sheet_id, block_cell_id);
                    }
                    _ => {
                        return Err(Error::PayloadError(String::from(
                            "Cannot set diy cell on normal cell",
                        )))
                    }
                };
                Ok((self, true))
            }
            EditPayload::CreateDiyCellById(p) => {
                let cell_id =
                    ctx.fetch_block_cell_id(&p.sheet_id, &p.block_id, p.row_idx, p.col_idx)?;
                self.manager
                    .diy_cell_manager
                    .create_new_diy_cell(p.sheet_id, cell_id);
                Ok((self, true))
            }
            _ => Ok((self, false)),
        }
    }
}
