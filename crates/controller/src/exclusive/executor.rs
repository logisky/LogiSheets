use logisheets_base::errors::BasicError;
use logisheets_base::CellId;

use crate::edit_action::EditPayload;
use crate::Error;

use super::appendix::Appendix;
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
            EditPayload::CreateAppendix(p) => {
                let sheet_id = if p.sheet_idx.is_some() {
                    ctx.fetch_sheet_id_by_index(p.sheet_idx.unwrap())
                        .map_err(|l| Error::Basic(BasicError::SheetIdxExceed(l)))?
                } else {
                    p.sheet_id.unwrap()
                };
                let cell_id =
                    ctx.fetch_block_cell_id(&sheet_id, &p.block_id, p.row_idx, p.col_idx)?;
                self.manager.appendix_manager.push(
                    sheet_id,
                    cell_id,
                    Appendix {
                        craft_id: p.craft_id,
                        tag: p.tag,
                        content: p.content,
                    },
                );
                Ok((self, true))
            }
            EditPayload::ReproduceCells(p) => {
                if p.cells.is_empty() {
                    return Ok((self, true));
                }
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| Error::Basic(BasicError::SheetIdxExceed(l)))?;

                let anchor_x = p.cells[0].coordinate.row;
                let anchor_y = p.cells[0].coordinate.col;

                for cell in p.cells {
                    let cell_id = ctx.fetch_cell_id(
                        &sheet_id,
                        cell.coordinate.row - anchor_x + p.start_row,
                        cell.coordinate.col - anchor_y + p.start_col,
                    )?;
                    match cell_id {
                        CellId::BlockCell(block_cell_id) => {
                            cell.appendix.iter().for_each(|appendix| {
                                self.manager.appendix_manager.push(
                                    sheet_id,
                                    block_cell_id,
                                    Appendix {
                                        craft_id: appendix.craft_id.clone(),
                                        tag: appendix.tag.clone(),
                                        content: appendix.content.clone(),
                                    },
                                );
                            })
                        }
                        _ => {
                            return Err(Error::PayloadError(String::from(
                                "Cannot set diy cell on normal cell",
                            )))
                        }
                    }
                }
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
            EditPayload::RemoveBlock(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| Error::Basic(BasicError::SheetIdxExceed(l)))?;
                let block_id = p.id;
                ctx.get_all_block_cells(sheet_id, block_id)?
                    .iter()
                    .for_each(|cell_id| {
                        self.manager
                            .diy_cell_manager
                            .remove_diy_cell(sheet_id, *cell_id);
                        self.manager.appendix_manager.remove(sheet_id, *cell_id);
                    });
                Ok((self, true))
            }
            _ => Ok((self, false)),
        }
    }
}
