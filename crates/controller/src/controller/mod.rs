use logisheets_base::async_func::{AsyncCalcResult, Task};
use logisheets_base::SheetId;

use logisheets_workbook::prelude::{read, write};
pub mod display;
pub mod edit_action;
pub mod status;
pub mod style;
mod transaction;
mod viewer;
use crate::errors::{Error, Result};
use crate::file_loader2::load;
use crate::file_saver::save_file;
use crate::payloads::sheet_shift::{SheetShiftPayload, SheetShiftType};
use crate::payloads::Process;
use crate::settings::Settings;
use crate::version_manager::VersionManager;
use edit_action::{ActionEffect, Converter};
use status::Status;
use transaction::{Transaction, TransactionContext};
use viewer::SheetViewer;

use self::display::{DisplayRequest, DisplayResponse};
use crate::async_func_manager::AsyncFuncManager;
use edit_action::EditAction;

pub struct Controller {
    pub status: Status,
    pub async_func_manager: AsyncFuncManager,
    pub curr_book_name: String,
    pub settings: Settings,
    pub version_manager: VersionManager,
}

impl Default for Controller {
    fn default() -> Self {
        let mut empty = Controller {
            status: Status::default(),
            curr_book_name: String::from("Book1"),
            settings: Settings::default(),
            version_manager: VersionManager::default(),
            async_func_manager: AsyncFuncManager::default(),
        };
        let add_sheet = Process::SheetShift(SheetShiftPayload {
            idx: 0,
            ty: SheetShiftType::Insert,
            id: 0,
        });
        empty.handle_process(vec![add_sheet], false).unwrap();
        empty
    }
}

impl Controller {
    pub fn save(&self) -> Result<Vec<u8>> {
        let workbook = save_file(self)?;
        write(workbook).map_err(|e| Error::Serde(e.into()))
    }

    pub fn from(status: Status, book_name: String, settings: Settings) -> Self {
        Controller {
            curr_book_name: book_name,
            settings,
            status,
            version_manager: VersionManager::default(),
            async_func_manager: AsyncFuncManager::default(),
        }
    }

    pub fn version(&self) -> u32 {
        self.version_manager.version()
    }

    pub fn from_file(name: String, f: &[u8]) -> Result<Self> {
        let res = read(f)?;
        Ok(load(res, name))
    }

    pub fn get_sheet_id_by_idx(&self, idx: usize) -> Option<SheetId> {
        self.status.sheet_pos_manager.get_sheet_id(idx)
    }

    pub fn get_sheet_id_by_name(&self, name: &str) -> Option<SheetId> {
        self.status.sheet_id_manager.has(name)
    }

    // Handle an action and get the affected sheet indices.
    pub fn handle_action(&mut self, action: EditAction) -> Option<ActionEffect> {
        match action {
            EditAction::Undo => match self.undo() {
                true => Some(ActionEffect::default()),
                false => None,
            },
            EditAction::Redo => match self.redo() {
                true => Some(ActionEffect::default()),
                false => None,
            },
            EditAction::Payloads(action) => {
                let mut c = Converter {
                    sheet_pos_manager: &self.status.sheet_pos_manager,
                    navigator: &mut self.status.navigator,
                    container: &mut self.status.container,
                    text_id_manager: &mut self.status.text_id_manager,
                    sheet_id_manager: &mut self.status.sheet_id_manager,
                };
                let proc = c.convert_edit_payloads(action.payloads);
                self.handle_process(proc, action.undoable).ok()?;
                let tasks = self.async_func_manager.get_calc_tasks();
                Some(ActionEffect {
                    async_tasks: tasks,
                    version: self.version(),
                })
            }
        }
    }

    pub fn handle_async_calc_results(
        &mut self,
        tasks: Vec<Task>,
        res: Vec<AsyncCalcResult>,
    ) -> Option<ActionEffect> {
        let mut pending_cells = vec![];
        tasks.into_iter().zip(res.into_iter()).for_each(|(t, r)| {
            let cells = self.async_func_manager.commit_value(t, r);
            pending_cells.extend(cells);
        });
        self.handle_process(vec![Process::Recalc(pending_cells)], false)
            .ok()?;
        Some(ActionEffect::default())
    }

    fn handle_process(&mut self, proc: Vec<Process>, undoable: bool) -> Result<()> {
        let context = TransactionContext {
            book_name: &self.curr_book_name,
            calc_config: self.settings.calc_config.clone(),
            async_funcs: &self.settings.async_funcs,
        };
        let transcation = Transaction {
            async_func_manager: &mut self.async_func_manager,
            status: self.status.clone(),
            context,
            proc: &proc,
        };
        let (mut new_status, calc_cells) = transcation.start()?;

        std::mem::swap(&mut new_status, &mut self.status);
        if undoable {
            self.version_manager
                .record(new_status.clone(), proc, calc_cells);
        }
        Ok(())
    }

    pub fn get_display_response(&self, req: DisplayRequest) -> DisplayResponse {
        let viewer = SheetViewer::default();
        if req.version == 0 {
            return viewer.display_with_idx(self, req.sheet_idx);
        }

        let sheet_id = self.get_sheet_id_by_idx(req.sheet_idx);
        if sheet_id.is_none() {
            return DisplayResponse {
                incremental: false,
                patches: vec![],
            };
        }

        let sheet_id = sheet_id.unwrap();
        if let Some(diff) = self
            .version_manager
            .get_sheet_diffs_from_version(sheet_id, req.version)
        {
            viewer.display_with_diff(self, sheet_id, diff)
        } else {
            viewer.display_with_idx(self, req.sheet_idx)
        }
    }

    pub fn undo(&mut self) -> bool {
        match self.version_manager.undo() {
            Some(mut last_status) => {
                std::mem::swap(&mut self.status, &mut last_status);
                true
            }
            None => false,
        }
    }

    pub fn redo(&mut self) -> bool {
        match self.version_manager.redo() {
            Some(mut next_status) => {
                std::mem::swap(&mut self.status, &mut next_status);
                true
            }
            None => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::controller::edit_action::PayloadsAction;

    use super::{
        edit_action::{CellInput, EditAction, EditPayload},
        Controller,
    };

    #[test]
    fn controller_default_test() {
        let wb = Controller::default();
        println!("{:?}", wb.status);
    }

    #[test]
    fn controller_input_formula() {
        let mut wb = Controller::default();
        let payloads_action = PayloadsAction {
            payloads: vec![EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 0,
                content: String::from("=ABS(1)"),
            })],
            undoable: true,
        };
        wb.handle_action(EditAction::Payloads(payloads_action));
        let len = wb.status.formula_manager.formulas.len();
        assert_eq!(len, 1);
    }

    #[test]
    fn from_file_test() {
        use std::fs;
        let buf = fs::read("../../tests/6.xlsx").unwrap();
        let controller = Controller::from_file(String::from("6"), &buf);
        match controller {
            Ok(_) => {}
            Err(_) => {
                panic!()
            }
        }
    }
}
