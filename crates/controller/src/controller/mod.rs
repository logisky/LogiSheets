use controller_base::async_func::{AsyncCalcResult, Task};
use controller_base::{CellId, SheetId};

use logisheets_workbook::prelude::{read, SerdeErr};
pub mod display;
pub mod edit_action;
pub mod status;
mod transaction;
mod viewer;
use crate::file_loader2::load;
use crate::payloads::sheet_shift::{SheetShiftPayload, SheetShiftType};
use crate::payloads::Process;
use crate::settings::Settings;
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
    pub undo_stack: Vec<Status>,
    pub redo_stack: Vec<Status>,
}

impl Default for Controller {
    fn default() -> Self {
        let mut empty = Controller {
            status: Status::default(),
            curr_book_name: String::from("Book1"),
            settings: Settings::default(),
            undo_stack: vec![],
            redo_stack: vec![],
            async_func_manager: AsyncFuncManager::default(),
        };
        let add_sheet = Process::SheetShift(SheetShiftPayload {
            idx: 0,
            ty: SheetShiftType::Insert,
        });
        empty.handle_process(vec![add_sheet], false);
        empty
    }
}

impl Controller {
    pub fn save(&self) -> Vec<u8> {
        vec![]
    }

    pub fn from(status: Status, book_name: String, settings: Settings) -> Self {
        Controller {
            curr_book_name: book_name,
            redo_stack: Vec::new(),
            settings,
            status,
            undo_stack: Vec::new(),
            async_func_manager: AsyncFuncManager::default(),
        }
    }

    pub fn from_file(name: String, f: &[u8]) -> Result<Self, SerdeErr> {
        let res = read(f);
        match res {
            Ok(ss) => Ok(load(ss, name)),
            Err(e) => {
                log!("{:?}", e);
                Err(e)
            }
        }
    }

    pub fn get_sheet_id_by_idx(&self, idx: usize) -> Option<SheetId> {
        self.status.sheet_pos_manager.get_sheet_id(idx)
    }

    pub fn get_sheet_id_by_name(&self, name: &str) -> Option<SheetId> {
        self.status.sheet_id_manager.has(name)
    }

    // Handle an action and get the affected sheet indices.
    pub fn handle_action(&mut self, action: EditAction, undoable: bool) -> Option<ActionEffect> {
        match action {
            EditAction::Undo => match self.undo() {
                true => Some(ActionEffect::default()),
                false => None,
            },
            EditAction::Redo => match self.redo() {
                true => Some(ActionEffect::default()),
                false => None,
            },
            EditAction::Payloads(payloads) => {
                let mut c = Converter {
                    sheet_pos_manager: &self.status.sheet_pos_manager,
                    navigator: &mut self.status.navigator,
                    container: &mut self.status.container,
                    text_id_manager: &mut self.status.text_id_manager,
                };
                let proc = c.convert_edit_payloads(payloads);
                self.handle_process(proc, undoable);
                let (tasks, dirties) = self.async_func_manager.get_calc_tasks();
                Some(ActionEffect {
                    sheets: vec![],
                    async_tasks: tasks,
                    dirtys: dirties,
                })
            }
        }
    }

    pub fn handle_async_calc_results(
        &mut self,
        tasks: Vec<Task>,
        res: Vec<AsyncCalcResult>,
        dirtys: Vec<(SheetId, CellId)>,
    ) -> Option<ActionEffect> {
        tasks.into_iter().zip(res.into_iter()).for_each(|(t, r)| {
            self.async_func_manager.add_value(t, r);
        });
        self.handle_process(vec![Process::Recalc(dirtys)], false);
        Some(ActionEffect::default())
    }

    fn handle_process(&mut self, proc: Vec<Process>, undoable: bool) {
        let context = TransactionContext {
            book_name: &self.curr_book_name,
            calc_config: self.settings.calc_config.clone(),
            async_funcs: &self.settings.async_funcs,
        };
        let transcation = Transaction {
            async_func_manager: &mut self.async_func_manager,
            status: self.status.clone(),
            context,
            proc,
        };
        let mut new_status = transcation.start();
        std::mem::swap(&mut new_status, &mut self.status);
        if undoable {
            self.undo_stack.push(new_status);
        }
    }

    pub fn get_display_response(&mut self, req: DisplayRequest) -> DisplayResponse {
        let viewer = SheetViewer::default();
        let response = viewer.display(self, req.sheet_idx);
        response
    }

    pub fn undo(&mut self) -> bool {
        match self.undo_stack.pop() {
            Some(mut last_status) => {
                std::mem::swap(&mut self.status, &mut last_status);
                self.redo_stack.push(last_status);
                true
            }
            None => false,
        }
    }

    pub fn redo(&mut self) -> bool {
        match self.redo_stack.pop() {
            Some(mut next_status) => {
                std::mem::swap(&mut self.status, &mut next_status);
                self.undo_stack.push(next_status);
                true
            }
            None => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::Controller;

    #[test]
    fn controller_default_test() {
        let wb = Controller::default();
        log!("{:?}", wb.status);
    }

    #[test]
    fn from_file_test() {
        use std::fs;
        let buf = fs::read("../workbook/examples/6.xlsx").unwrap();
        let controller = Controller::from_file(String::from("6"), &buf);
        match controller {
            Ok(_) => {}
            Err(_) => {
                panic!()
            }
        }
    }
}
