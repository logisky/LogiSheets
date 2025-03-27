use std::collections::HashMap;

use super::{cell_positioner::CellPositioner, worksheet::Worksheet};
use crate::{
    controller::display::SheetInfo,
    edit_action::{ActionEffect, PayloadsAction, StatusCode},
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
    CellId, SheetId,
};

const CALC_CONDITION_EPHEMERAL_ID: u32 = 402;
const CUSTOM_EPHEMERAL_ID_START: u32 = 1025;

pub(crate) type CellPositionerDefault = CellPositioner<1000>;

pub struct Workbook {
    controller: Controller,
    cell_positioners: Locked<HashMap<SheetId, Locked<CellPositionerDefault>>>,

    ephemeral_id: u32,
}

impl Default for Workbook {
    fn default() -> Self {
        Self {
            controller: Default::default(),
            cell_positioners: new_locked(HashMap::new()),
            ephemeral_id: CUSTOM_EPHEMERAL_ID_START,
        }
    }
}

impl Workbook {
    /// Create an empty workbook.
    pub fn new() -> Self {
        Workbook {
            controller: Default::default(),
            cell_positioners: new_locked(HashMap::new()),
            ephemeral_id: CUSTOM_EPHEMERAL_ID_START,
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
            ephemeral_id: CUSTOM_EPHEMERAL_ID_START,
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

    pub fn get_sheet_by_name(&self, name: &str) -> Result<Worksheet> {
        let id = self.controller.get_sheet_id_by_name(name);
        if id.is_none() {
            return Err(BasicError::SheetNameNotFound(name.to_string()).into());
        }
        let sheet_id = id.unwrap();
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
                id: CALC_CONDITION_EPHEMERAL_ID as u32,
                content: f.clone(),
            },
        )));
        if let StatusCode::Ok(_) = effect.status {
            Ok(())
        } else {
            Err(BasicError::InvalidFormula(f).into())
        }
    }

    pub fn calc_condition(&mut self, f: String) -> Result<bool> {
        let effect = self.handle_action(EditAction::Payloads(PayloadsAction::new().add_payload(
            EphemeralCellInput {
                sheet_idx: 0,
                id: CALC_CONDITION_EPHEMERAL_ID as u32,
                content: f.clone(),
            },
        )));
        if let StatusCode::Ok(_) = effect.status {
            let cell = self
                .controller
                .status
                .container
                .get_cell(
                    SheetId::default(),
                    &CellId::EphemeralCell(CALC_CONDITION_EPHEMERAL_ID as u32),
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

    pub fn get_ephemeral_id(&mut self) -> u32 {
        let id = self.ephemeral_id;
        self.ephemeral_id += 1;
        id
    }
}
