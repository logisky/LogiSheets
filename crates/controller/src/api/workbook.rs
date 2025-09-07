use std::collections::HashMap;

use super::{cell_positioner::CellPositioner, worksheet::Worksheet};
use crate::{
    controller::display::{CellPosition, ShadowCellInfo, SheetInfo},
    edit_action::{ActionEffect, PayloadsAction, SheetCellId, StatusCode},
    lock::{locked_write, new_locked, Locked},
    Controller,
};
use crate::{
    edit_action::{EditAction, EphemeralCellInput},
    errors::{Error, Result},
};
use logisheets_base::{
    async_func::{AsyncCalcResult, Task},
    errors::BasicError,
    BlockCellId, BlockId, CellId, ColId, RowId, SheetId, TextId,
};

const CALC_CONDITION_EPHEMERAL_ID: u64 = 225715;

pub(crate) type CellPositionerDefault = CellPositioner<1000>;

pub struct Workbook {
    controller: Controller,
    cell_positioners: Locked<HashMap<SheetId, Locked<CellPositionerDefault>>>,
}

impl Default for Workbook {
    fn default() -> Self {
        Self {
            controller: Default::default(),
            cell_positioners: new_locked(HashMap::new()),
        }
    }
}

impl Workbook {
    /// Create an empty workbook.
    pub fn new() -> Self {
        Workbook {
            controller: Default::default(),
            cell_positioners: new_locked(HashMap::new()),
        }
    }

    /// Execute the `EditAction`
    pub fn handle_action(&mut self, action: EditAction) -> ActionEffect {
        self.controller.handle_action(action)
    }

    /// Create a workbook from a .xlsx file.
    pub fn from_file(buf: &[u8], book_name: String) -> Result<Self> {
        let mut controller = Controller::from_file(book_name, buf)?;
        controller
            .version_manager
            .set_init_status(controller.status.clone());
        Ok(Workbook {
            controller,
            cell_positioners: new_locked(HashMap::new()),
        })
    }

    #[inline]
    pub fn save(&self) -> Result<Vec<u8>> {
        self.controller.save()
    }

    #[inline]
    pub fn undo(&mut self) -> bool {
        self.controller.undo()
    }

    #[inline]
    pub fn redo(&mut self) -> bool {
        self.controller.redo()
    }

    #[inline]
    pub fn handle_async_calc_results(
        &mut self,
        tasks: Vec<Task>,
        results: Vec<AsyncCalcResult>,
    ) -> ActionEffect {
        if tasks.len() != results.len() {
            return ActionEffect {
                version: 0,
                async_tasks: vec![],
                status: StatusCode::Err(1),
                value_changed: vec![],
                cell_removed: vec![],
            };
        }
        self.controller.handle_async_calc_results(tasks, results)
    }

    #[inline]
    pub fn get_all_sheet_info(&self) -> Vec<SheetInfo> {
        self.controller.get_all_sheet_info()
    }

    #[inline]
    pub fn get_cell_positioner(&self, sheet: SheetId) -> Locked<CellPositionerDefault> {
        let mut cell_positioners = locked_write(&self.cell_positioners);
        let entry = cell_positioners
            .entry(sheet)
            .or_insert_with(|| new_locked(CellPositionerDefault::new()));

        entry.clone()
    }

    pub fn get_block_values(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
        row_ids: &[RowId],
        col_ids: &[ColId],
    ) -> Result<Vec<String>> {
        let text_id_fetcher = |id: TextId| {
            self.controller
                .status
                .text_id_manager
                .get_string(&id)
                .unwrap()
        };
        let values = row_ids
            .iter()
            .zip(col_ids.iter())
            .map(|(row_id, col_id)| {
                let cell_id = CellId::BlockCell(BlockCellId {
                    block_id,
                    row: *row_id,
                    col: *col_id,
                });
                let v = self
                    .controller
                    .status
                    .container
                    .get_cell(sheet_id, &cell_id)
                    .map(|c| c.value.to_string(&text_id_fetcher))
                    .unwrap_or_default();
                v
            })
            .collect::<Vec<String>>();
        Ok(values)
    }

    pub fn get_sheet_by_name(&self, name: &str) -> Result<Worksheet> {
        let id = self.controller.get_sheet_id_by_name(name);
        if id.is_none() {
            return Err(BasicError::SheetNameNotFound(name.to_string()).into());
        }
        let sheet_id = id.unwrap();
        self.get_sheet_by_id(sheet_id)
    }

    pub fn get_sheet_idx_by_id(&self, sheet_id: SheetId) -> Result<usize> {
        self.controller
            .status
            .sheet_pos_manager
            .get_sheet_idx(&sheet_id)
            .ok_or(BasicError::UnavailableSheetId(sheet_id).into())
    }

    pub fn get_sheet_by_id(&self, sheet_id: SheetId) -> Result<Worksheet> {
        let positioner = self.get_cell_positioner(sheet_id);
        let c = &self.controller;
        Ok(Worksheet {
            sheet_id,
            controller: c,
            positioner,
        })
    }

    pub fn get_sheet_idx_by_name(&self, name: &str) -> Result<usize> {
        let sheet_id = self.controller.get_sheet_id_by_name(name);
        if let Some(id) = sheet_id {
            if let Some(idx) = self.controller.status.sheet_pos_manager.get_sheet_idx(&id) {
                Ok(idx)
            } else {
                Err(BasicError::SheetNameNotFound(name.to_string()).into())
            }
        } else {
            Err(BasicError::SheetNameNotFound(name.to_string()).into())
        }
    }

    pub fn get_sheet_by_idx(&self, idx: usize) -> Result<Worksheet> {
        match self.controller.get_sheet_id_by_idx(idx) {
            Some(sheet_id) => Ok(Worksheet {
                sheet_id,
                controller: &self.controller,
                positioner: self.get_cell_positioner(sheet_id),
            }),
            None => Err(Error::UnavailableSheetIdx(idx)),
        }
    }

    pub fn get_sheet_count(&self) -> usize {
        self.controller.status.sheet_pos_manager.pos.len()
    }

    /// To see if the formula is valid.
    pub fn check_formula(&mut self, f: String) -> Result<()> {
        let effect = self.handle_action(EditAction::Payloads(PayloadsAction::new().add_payload(
            EphemeralCellInput {
                sheet_idx: 0,
                id: CALC_CONDITION_EPHEMERAL_ID,
                content: f.clone(),
            },
        )));
        if let StatusCode::Ok(_) = effect.status {
            Ok(())
        } else {
            Err(BasicError::InvalidFormula(f).into())
        }
    }

    pub fn get_available_block_id(&self, sheet_idx: usize) -> Result<usize> {
        let sheet_id = self
            .controller
            .status
            .sheet_pos_manager
            .get_sheet_id(sheet_idx)
            .ok_or(BasicError::SheetIdxExceed(sheet_idx))?;
        let block_id = self
            .controller
            .status
            .navigator
            .get_available_block_id(&sheet_id)?;
        Ok(block_id)
    }

    pub fn get_shadow_cell_id(
        &mut self,
        sheet_idx: usize,
        row_idx: usize,
        col_idx: usize,
    ) -> Result<SheetCellId> {
        let sheet_id = self
            .controller
            .status
            .sheet_pos_manager
            .get_sheet_id(sheet_idx)
            .ok_or(BasicError::SheetIdxExceed(sheet_idx))?;
        let cell_id = self
            .controller
            .status
            .navigator
            .fetch_cell_id(&sheet_id, row_idx, col_idx)?;
        let eid = self
            .controller
            .sid_assigner
            .get_shawdow_id(sheet_id, cell_id);
        Ok(SheetCellId {
            sheet_id,
            cell_id: CellId::EphemeralCell(eid),
        })
    }

    pub fn get_shawdow_cell_ids(
        &mut self,
        sheet_idx: usize,
        row_idx: Vec<usize>,
        col_idx: Vec<usize>,
    ) -> Result<Vec<SheetCellId>> {
        if row_idx.len() != col_idx.len() {
            return Err(BasicError::IncompleteRowColLength(row_idx.len(), col_idx.len()).into());
        }
        let sheet_id = self
            .controller
            .status
            .sheet_pos_manager
            .get_sheet_id(sheet_idx)
            .ok_or(BasicError::SheetIdxExceed(sheet_idx))?;
        row_idx
            .into_iter()
            .zip(col_idx.into_iter())
            .map(|(row, col)| {
                let cell_id = self
                    .controller
                    .status
                    .navigator
                    .fetch_cell_id(&sheet_id, row, col)?;
                let eid = self
                    .controller
                    .sid_assigner
                    .get_shawdow_id(sheet_id, cell_id);
                Ok(SheetCellId {
                    sheet_id,
                    cell_id: CellId::EphemeralCell(eid),
                })
            })
            .collect()
    }

    pub fn get_shadow_info_by_id(&self, shadow_id: u64) -> Result<ShadowCellInfo> {
        let (sheet_id, cell_id) = self
            .controller
            .sid_assigner
            .get_cell_id(shadow_id)
            .ok_or(BasicError::InvalidShadowId(shadow_id))?;
        let (start_position, end_position) = self.get_cell_position_by_id(sheet_id, cell_id)?;
        let value = self
            .get_sheet_by_id(sheet_id)?
            .get_value_by_id(&CellId::EphemeralCell(shadow_id))?;
        Ok(ShadowCellInfo {
            start_position,
            end_position,
            value,
        })
    }

    fn get_cell_position_by_id(
        &self,
        sheet_id: SheetId,
        cell_id: CellId,
    ) -> Result<(CellPosition, CellPosition)> {
        if let CellId::EphemeralCell(_) = cell_id {
            return Err(BasicError::ReferencingEphemeralCell.into());
        }

        let (row, col) = self
            .controller
            .status
            .navigator
            .fetch_cell_idx(&sheet_id, &cell_id)?;
        let ws = self.get_sheet_by_id(sheet_id)?;
        let mut positioner = locked_write(&ws.positioner);
        let x = ws.get_col_start_x(col, &mut *positioner)?;
        let y = ws.get_row_start_y(row, &mut *positioner)?;
        let end_x = ws.get_col_start_x(col + 1, &mut *positioner)?;
        let end_y = ws.get_row_start_y(row + 1, &mut *positioner)?;
        drop(positioner);
        Ok((CellPosition { x, y }, CellPosition { x: end_x, y: end_y }))
    }

    pub fn check_bind_block(
        &mut self,
        sheet_idx: usize,
        block_id: usize,
        row_count: usize,
        col_count: usize,
    ) -> Result<SheetId> {
        let sheet_id = self
            .controller
            .status
            .sheet_pos_manager
            .get_sheet_id(sheet_idx)
            .unwrap();

        let block_size = self
            .controller
            .status
            .navigator
            .get_block_size(&sheet_id, &block_id)?;
        if row_count > block_size.0 || col_count > block_size.1 {
            return Err(BasicError::BindBlockSizeMismatch(block_id, row_count, col_count).into());
        }
        Ok(sheet_id)
    }

    pub fn calc_condition(&mut self, sheet_idx: usize, f: String) -> Result<bool> {
        let effect = self.handle_action(EditAction::Payloads(PayloadsAction::new().add_payload(
            EphemeralCellInput {
                sheet_idx,
                id: CALC_CONDITION_EPHEMERAL_ID,
                content: f.clone(),
            },
        )));
        let sheet_id = self
            .controller
            .status
            .sheet_pos_manager
            .get_sheet_id(sheet_idx)
            .unwrap();
        if let StatusCode::Ok(_) = effect.status {
            let cell = self
                .controller
                .status
                .container
                .get_cell(
                    sheet_id,
                    &CellId::EphemeralCell(CALC_CONDITION_EPHEMERAL_ID),
                )
                .unwrap();
            if cell.value.is_error() {
                Err(BasicError::InvalidFormula(f).into())
            } else {
                Ok(cell.value.bool_value())
            }
        } else {
            Err(BasicError::InvalidFormula(f).into())
        }
    }

    /// Get the worksheet id by its index.
    ///
    /// It is not recommended to use this function because worksheet id is an internal
    /// conception. Use this only when you know what you are doing.
    pub fn get_worksheet_id(&self, sheet_idx: usize) -> Result<SheetId> {
        self.controller
            .status
            .sheet_pos_manager
            .get_sheet_id(sheet_idx)
            .ok_or(BasicError::SheetIdxExceed(sheet_idx).into())
    }
}
