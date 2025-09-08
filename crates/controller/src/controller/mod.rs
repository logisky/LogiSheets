use std::collections::HashSet;

use logisheets_base::async_func::{AsyncCalcResult, Task};
use logisheets_base::{BlockRange, CellId, NormalRange, Range, SheetId};

use logisheets_workbook::prelude::{read, write};
pub mod display;
mod executor;
pub mod status;
pub mod style;
use crate::edit_action::{
    ActionEffect, CreateSheet, EditAction, PayloadsAction, RecalcCell, SheetCellId, StatusCode,
    WorkbookUpdateType,
};
use crate::errors::{Error, Result};
use crate::file_loader2::load;
use crate::file_saver::save_file;
use crate::formula_manager::Vertex;
use crate::settings::Settings;
use crate::sid_assigner::ShadowIdAssigner;
use crate::version_manager::VersionManager;
use executor::Executor;
use status::Status;

use self::display::SheetInfo;
use crate::async_func_manager::AsyncFuncManager;

pub struct Controller {
    pub status: Status,
    pub async_func_manager: AsyncFuncManager,
    pub curr_book_name: String,
    pub settings: Settings,
    pub version_manager: VersionManager,
    pub sid_assigner: ShadowIdAssigner,
}

impl Default for Controller {
    fn default() -> Self {
        let mut empty = Controller {
            status: Status::default(),
            curr_book_name: String::from("Book1"),
            settings: Settings::default(),
            version_manager: VersionManager::default(),
            async_func_manager: AsyncFuncManager::default(),
            sid_assigner: ShadowIdAssigner::new(),
        };
        let add_sheet = PayloadsAction::new()
            .add_payload(CreateSheet {
                idx: 0,
                new_name: String::from("Sheet1"),
            })
            .set_init(true);
        empty.handle_action(EditAction::Payloads(add_sheet));
        empty
    }
}

impl Controller {
    // TODO: Due to the UUID generating, we can't just `assert_eq!(file1, file2)` where
    // `file1` and `file2` are binary got from saving of the same file. Fix it.
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
            sid_assigner: ShadowIdAssigner::new(),
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

    pub fn get_all_sheet_info(&self) -> Vec<SheetInfo> {
        let id_manager = &self.status.sheet_id_manager;
        let pos_manager = &self.status.sheet_pos_manager;
        pos_manager
            .pos
            .iter()
            .map(|id| SheetInfo {
                name: id_manager.get_string(id).unwrap_or(String::new()),
                id: *id,
                hidden: pos_manager.is_hidden(id),
                tab_color: String::from(""),
            })
            .collect()
    }

    // Handle an action and get the affected sheet indices.
    pub fn handle_action(&mut self, action: EditAction) -> ActionEffect {
        match action {
            EditAction::Undo => {
                let c = if self.undo() {
                    WorkbookUpdateType::Undo
                } else {
                    WorkbookUpdateType::UndoNothing
                };
                ActionEffect::from(0, vec![], c)
            }
            EditAction::Redo => {
                let c = if self.redo() {
                    WorkbookUpdateType::Redo
                } else {
                    WorkbookUpdateType::RedoNothing
                };
                ActionEffect::from(0, vec![], c)
            }
            EditAction::Payloads(payloads_action) => {
                let executor = Executor {
                    status: self.status.clone(),
                    version_manager: &mut self.version_manager,
                    async_func_manager: &mut self.async_func_manager,
                    book_name: &self.curr_book_name,
                    calc_config: self.settings.calc_config,
                    async_funcs: &self.settings.async_funcs,
                    updated_cells: HashSet::new(),
                    dirty_vertices: HashSet::new(),
                    sheet_updated: false,
                    cell_updated: false,
                    cells_removed: HashSet::new(),
                    sid_assigner: &self.sid_assigner,
                };

                let result = executor.execute_and_calc(payloads_action);
                match result {
                    Ok(result) => {
                        let cell_updated = result.cell_updated
                            || result.cells_removed.len() > 0
                            || result.updated_cells.len() > 0;
                        let c = if cell_updated && result.sheet_updated {
                            WorkbookUpdateType::SheetAndCell
                        } else if cell_updated {
                            WorkbookUpdateType::Cell
                        } else if result.sheet_updated {
                            WorkbookUpdateType::Sheet
                        } else {
                            WorkbookUpdateType::DoNothing
                        };
                        self.status = result.status;
                        ActionEffect {
                            version: result.version_manager.version(),
                            async_tasks: result.async_func_manager.get_calc_tasks(),
                            status: StatusCode::Ok(c),
                            value_changed: result
                                .updated_cells
                                .into_iter()
                                .map(|(sheet_id, cell_id)| SheetCellId { sheet_id, cell_id })
                                .collect(),

                            cell_removed: result
                                .cells_removed
                                .into_iter()
                                .map(|c| SheetCellId {
                                    sheet_id: c.0,
                                    cell_id: c.1,
                                })
                                .collect(),
                        }
                    }
                    Err(e) => {
                        println!("{:?}", e.to_string());
                        ActionEffect::from_err(1) // todo
                    }
                }
            }
            EditAction::Recalc(cells) => {
                let dirty_vertices = cells
                    .into_iter()
                    .map(|recalc_sheet| {
                        let sheet_id = recalc_sheet.sheet_id;
                        let cell_id = recalc_sheet.cell_id;
                        let range = match cell_id {
                            CellId::NormalCell(c) => Range::Normal(NormalRange::Single(c)),
                            CellId::BlockCell(b) => Range::Block(BlockRange::Single(b)),
                            CellId::EphemeralCell(e) => Range::Ephemeral(e),
                        };
                        let range_id = self.status.range_manager.get_range_id(&sheet_id, &range);
                        Vertex::Range(sheet_id, range_id)
                    })
                    .collect::<HashSet<_>>();
                let executor = Executor {
                    status: self.status.clone(),
                    version_manager: &mut self.version_manager,
                    async_func_manager: &mut self.async_func_manager,
                    book_name: &self.curr_book_name,
                    calc_config: self.settings.calc_config,
                    async_funcs: &self.settings.async_funcs,
                    updated_cells: HashSet::new(),
                    dirty_vertices,
                    sheet_updated: false,
                    cell_updated: false,
                    sid_assigner: &self.sid_assigner,
                    cells_removed: HashSet::new(),
                };
                if let Ok(result) = executor.calc() {
                    ActionEffect {
                        version: result.version_manager.version(),
                        async_tasks: vec![],
                        status: StatusCode::Ok(WorkbookUpdateType::Cell),
                        value_changed: result
                            .updated_cells
                            .into_iter()
                            .map(|(sheet_id, cell_id)| SheetCellId { sheet_id, cell_id })
                            .collect(),
                        cell_removed: result
                            .cells_removed
                            .into_iter()
                            .map(|c| SheetCellId {
                                sheet_id: c.0,
                                cell_id: c.1,
                            })
                            .collect(),
                    }
                } else {
                    ActionEffect::from_err(1)
                }
            }
        }
    }

    pub fn handle_async_calc_results(
        &mut self,
        tasks: Vec<Task>,
        res: Vec<AsyncCalcResult>,
    ) -> ActionEffect {
        let mut pending_cells = vec![];
        tasks.into_iter().zip(res.into_iter()).for_each(|(t, r)| {
            let cells = self
                .async_func_manager
                .commit_value(t, r)
                .into_iter()
                .map(|(s, c)| RecalcCell {
                    sheet_id: s,
                    cell_id: c,
                });
            pending_cells.extend(cells);
        });
        self.handle_action(EditAction::Recalc(pending_cells))
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
    use logisheets_base::{CellId, CellValue};

    use crate::edit_action::{
        CellInput, EditAction, EditPayload, EphemeralCellInput, PayloadsAction, StatusCode,
    };

    use super::Controller;

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
            init: false,
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

    #[test]
    fn controller_ephemeral_input_and_intput() {
        let mut wb = Controller::default();
        let sheet_idx = 0;
        let sheet_id = wb.get_sheet_id_by_idx(sheet_idx).unwrap();

        let cell_id = wb.status.navigator.fetch_cell_id(&sheet_id, 0, 0).unwrap();
        let shadow_id = wb.sid_assigner.get_shawdow_id(sheet_id, cell_id);

        let ephemeral_input = PayloadsAction {
            payloads: vec![EditPayload::EphemeralCellInput(EphemeralCellInput {
                sheet_idx,
                id: shadow_id,
                content: String::from("=#PLACEHOLDER < ABS(100)"),
            })],
            undoable: true,
            init: false,
        };
        wb.handle_action(EditAction::Payloads(ephemeral_input));

        let input = PayloadsAction {
            payloads: vec![EditPayload::CellInput(CellInput {
                sheet_idx,
                row: 0,
                col: 0,
                content: String::from("=ABS(100)"),
            })],
            undoable: true,
            init: false,
        };
        let result = wb.handle_action(EditAction::Payloads(input));
        assert!(result.value_changed.len() == 2);

        let cell = wb.status.container.get_cell(sheet_id, &cell_id).unwrap();
        assert!(matches!(cell.value, CellValue::Number(100.0)));
        let ephemeral_cell = wb
            .status
            .container
            .get_cell(sheet_id, &CellId::EphemeralCell(shadow_id))
            .unwrap();
        assert!(matches!(ephemeral_cell.value, CellValue::Boolean(false)));
    }

    #[test]
    fn formula_input() {
        let mut wb = Controller::default();
        let sheet_idx = 0;
        let action = PayloadsAction {
            payloads: vec![EditPayload::CellInput(CellInput {
                sheet_idx,
                row: 0,
                col: 0,
                content: String::from("=B2"),
            })],
            undoable: true,
            init: false,
        };
        let result = wb.handle_action(EditAction::Payloads(action));
        assert!(result.value_changed.len() == 1);
        let action = PayloadsAction {
            payloads: vec![EditPayload::CellInput(CellInput {
                sheet_idx,
                row: 0,
                col: 0,
                content: String::from("=B2+1"),
            })],
            undoable: true,
            init: false,
        };
        let result = wb.handle_action(EditAction::Payloads(action));
        assert!(result.value_changed.len() == 1);

        let sheet_id = wb.get_sheet_id_by_idx(sheet_idx).unwrap();
        let cell_id = wb.status.navigator.fetch_cell_id(&sheet_id, 0, 0).unwrap();
        let cell = wb.status.container.get_cell(sheet_id, &cell_id).unwrap();
        assert!(matches!(cell.value, CellValue::Number(1.0)));
    }

    #[test]
    fn controller_ephemeral_cell_input() {
        let mut wb = Controller::default();
        let sheet_idx = 0;
        let ephemeral_id = 1;
        let sheet_id = wb.get_sheet_id_by_idx(sheet_idx).unwrap();
        let payloads_action = PayloadsAction {
            payloads: vec![EditPayload::EphemeralCellInput(EphemeralCellInput {
                sheet_idx,
                id: ephemeral_id,
                content: String::from("1"),
            })],
            undoable: true,
            init: false,
        };
        let affect = wb.handle_action(EditAction::Payloads(payloads_action));
        assert!(matches!(affect.status, StatusCode::Ok(_)));
        let cell = wb
            .status
            .container
            .get_cell(sheet_id, &CellId::EphemeralCell(ephemeral_id))
            .unwrap();
        assert!(matches!(cell.value, CellValue::Number(_)));

        let payloads_action = PayloadsAction {
            payloads: vec![EditPayload::EphemeralCellInput(EphemeralCellInput {
                sheet_idx,
                id: ephemeral_id,
                content: String::from("=1+1"),
            })],
            undoable: true,
            init: false,
        };
        wb.handle_action(EditAction::Payloads(payloads_action));
        let cell = wb
            .status
            .container
            .get_cell(sheet_id, &CellId::EphemeralCell(ephemeral_id))
            .unwrap();
        assert!(matches!(cell.value, CellValue::Number(_)));
    }
}
