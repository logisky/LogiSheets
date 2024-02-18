use super::worksheet::Worksheet;
use crate::{
    controller::display::{DisplayRequest, DisplayResponse, SheetInfo},
    edit_action::{ActionEffect, StatusCode},
    Controller,
};
use crate::{
    edit_action::EditAction,
    errors::{Error, Result},
};
use logisheets_base::{
    async_func::{AsyncCalcResult, Task},
    errors::BasicError,
};

pub struct Workbook {
    controller: Controller,
}

impl Default for Workbook {
    fn default() -> Self {
        Self {
            controller: Default::default(),
        }
    }
}

impl Workbook {
    /// Create an empty workbook.
    pub fn new() -> Self {
        Workbook {
            controller: Default::default(),
        }
    }

    /// Execute the `EditAction`
    pub fn handle_action(&mut self, action: EditAction) -> ActionEffect {
        self.controller.handle_action(action)
    }

    /// Create a workbook from a .xlsx file.
    pub fn from_file(buf: &[u8], book_name: String) -> Result<Self> {
        let controller = Controller::from_file(book_name, buf)?;
        Ok(Workbook { controller })
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
    pub fn get_display_response(&self, req: DisplayRequest) -> DisplayResponse {
        self.controller.get_display_response(req)
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

    pub fn get_sheet_by_name(&self, name: &str) -> Result<Worksheet> {
        match self.controller.get_sheet_id_by_name(name) {
            Some(sheet_id) => Ok(Worksheet {
                sheet_id,
                controller: &self.controller,
            }),
            None => Err(BasicError::SheetNameNotFound(name.to_string()).into()),
        }
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
            }),
            None => Err(Error::UnavailableSheetIdx(idx)),
        }
    }

    pub fn get_sheet_count(&self) -> usize {
        self.controller.status.sheet_pos_manager.pos.len()
    }
}
