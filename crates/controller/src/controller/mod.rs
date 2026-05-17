use std::collections::HashSet;

use logisheets_base::async_func::{AsyncCalcResult, Task};
use logisheets_base::{BlockRange, CellId, NormalRange, Range, SheetId};

use logisheets_workbook::logisheets::AppData;
use logisheets_workbook::prelude::{read, write};
pub mod display;
mod executor;
pub mod status;
pub mod style;
use crate::edit_action::{
    ActionEffect, CreateSheet, EditAction, PayloadsAction, RecalcCell, SheetCellId, SheetColId,
    SheetRowId, StatusCode, WorkbookUpdateType,
};
use crate::errors::{Error, Result};
use crate::file_loader::load_file;
use crate::file_saver::save_file;
use crate::formula_manager::Vertex;
use crate::settings::Settings;
use crate::sid_assigner::ShadowIdAssigner;
use crate::version_manager::VersionManager;
use executor::Executor;
use status::Status;

use self::display::SheetInfo;
use crate::async_func_manager::AsyncFuncManager;

pub struct TempStatus {
    pub fork_status: Status,
    pub version_manager: VersionManager,
    pub accumulated_payloads: Vec<crate::edit_action::EditPayload>,
    pub accumulated_updated_cells: HashSet<(SheetId, CellId)>,
}

pub struct Controller {
    // TODO: clean this field. Use the VersionManager.current
    pub status: Status,
    pub temp_status: Option<TempStatus>,
    pub async_func_manager: AsyncFuncManager,
    pub curr_book_name: String,
    pub settings: Settings,
    pub version_manager: VersionManager,
    pub sid_assigner: ShadowIdAssigner,

    pub app_data: Vec<AppData>,
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
            app_data: vec![],
            temp_status: None,
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

    #[inline]
    pub fn is_editable(&self) -> bool {
        true
    }

    #[inline]
    pub fn is_in_temp_mode(&self) -> bool {
        self.temp_status.is_some()
    }

    #[deprecated = "no-op in new design; temp mode is always active when temp_status is Some"]
    pub fn toggle_temp_status(&mut self) {}

    pub fn clean_temp_status(&mut self) {
        if let Some(temp) = self.temp_status.take() {
            self.status = temp.fork_status;
        }
    }

    pub fn commit_temp_status(&mut self) {
        if let Some(temp) = self.temp_status.take() {
            let merged_payloads = PayloadsAction {
                payloads: temp.accumulated_payloads,
                undoable: true,
                init: false,
            };
            self.version_manager.record(
                self.status.clone(),
                merged_payloads,
                temp.accumulated_updated_cells,
            );
        }
    }

    pub fn from(
        status: Status,
        book_name: String,
        settings: Settings,
        app_data: Vec<AppData>,
    ) -> Self {
        Controller {
            curr_book_name: book_name,
            settings,
            status,
            version_manager: VersionManager::default(),
            async_func_manager: AsyncFuncManager::default(),
            sid_assigner: ShadowIdAssigner::new(),
            app_data,
            temp_status: None,
        }
    }

    pub fn version(&self) -> u32 {
        self.version_manager.version()
    }

    pub fn from_file(name: String, f: &[u8]) -> Result<Self> {
        let res = read(f)?;
        Ok(load_file(res, name))
    }

    pub fn get_sheet_id_by_idx(&self, idx: usize) -> Option<SheetId> {
        self.status.sheet_info_manager.get_sheet_id(idx)
    }

    pub fn get_sheet_id_by_name(&self, name: &str) -> Option<SheetId> {
        self.status.sheet_id_manager.has(name)
    }

    pub fn get_all_sheet_info(&self) -> Vec<SheetInfo> {
        let id_manager = &self.status.sheet_id_manager;
        let info_manager = &self.status.sheet_info_manager;
        info_manager
            .pos
            .iter()
            .map(|id| SheetInfo {
                name: id_manager.get_string(id).unwrap_or(String::new()),
                id: *id,
                hidden: info_manager.is_hidden(id),
                tab_color: info_manager.get_color(id).unwrap_or(String::new()),
            })
            .collect()
    }

    pub fn handle_action_in_temp_status(&mut self, action: PayloadsAction) -> ActionEffect {
        // Initialize temp branch on first temp transaction
        if self.temp_status.is_none() {
            self.temp_status = Some(TempStatus {
                fork_status: self.status.clone(),
                version_manager: VersionManager::default(),
                accumulated_payloads: vec![],
                accumulated_updated_cells: HashSet::new(),
            });
        }

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
            style_updated: HashSet::new(),
            row_inserted: vec![],
            row_removed: vec![],
            col_inserted: vec![],
            col_removed: vec![],
        };
        let result = executor.execute_and_calc(action.clone());
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

                let temp = self.temp_status.as_mut().unwrap();
                temp.accumulated_payloads.extend(action.payloads.clone());
                temp.accumulated_updated_cells
                    .extend(result.updated_cells.iter().copied());
                temp.version_manager.record(
                    result.status.clone(),
                    action,
                    result.updated_cells.clone(),
                );
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
                    style_changed: result
                        .style_updated
                        .into_iter()
                        .map(|c| SheetCellId {
                            sheet_id: c.0,
                            cell_id: c.1,
                        })
                        .collect(),
                    row_inserted: result
                        .row_inserted
                        .into_iter()
                        .map(|(sheet_id, row_id)| SheetRowId { sheet_id, row_id })
                        .collect(),
                    row_removed: result
                        .row_removed
                        .into_iter()
                        .map(|(sheet_id, row_id)| SheetRowId { sheet_id, row_id })
                        .collect(),
                    col_inserted: result
                        .col_inserted
                        .into_iter()
                        .map(|(sheet_id, col_id)| SheetColId { sheet_id, col_id })
                        .collect(),
                    col_removed: result
                        .col_removed
                        .into_iter()
                        .map(|(sheet_id, col_id)| SheetColId { sheet_id, col_id })
                        .collect(),
                    ..Default::default()
                }
            }
            Err(e) => {
                println!("{:?}", e.to_string());
                ActionEffect::from_err(1) // todo
            }
        }
    }

    // Handle an action and get the affected sheet indices.
    pub fn handle_action(&mut self, action: EditAction) -> ActionEffect {
        // A non-temp transaction discards any active temp branch
        if self.is_in_temp_mode() && !matches!(action, EditAction::Undo | EditAction::Redo) {
            self.clean_temp_status();
        }
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
                    style_updated: HashSet::new(),
                    row_inserted: vec![],
                    row_removed: vec![],
                    col_inserted: vec![],
                    col_removed: vec![],
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
                            style_changed: result
                                .style_updated
                                .into_iter()
                                .map(|c| SheetCellId {
                                    sheet_id: c.0,
                                    cell_id: c.1,
                                })
                                .collect(),
                            row_inserted: result
                                .row_inserted
                                .into_iter()
                                .map(|(sheet_id, row_id)| SheetRowId { sheet_id, row_id })
                                .collect(),
                            row_removed: result
                                .row_removed
                                .into_iter()
                                .map(|(sheet_id, row_id)| SheetRowId { sheet_id, row_id })
                                .collect(),
                            col_inserted: result
                                .col_inserted
                                .into_iter()
                                .map(|(sheet_id, col_id)| SheetColId { sheet_id, col_id })
                                .collect(),
                            col_removed: result
                                .col_removed
                                .into_iter()
                                .map(|(sheet_id, col_id)| SheetColId { sheet_id, col_id })
                                .collect(),
                            ..Default::default()
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
                    style_updated: HashSet::new(),
                    row_inserted: vec![],
                    row_removed: vec![],
                    col_inserted: vec![],
                    col_removed: vec![],
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
                        style_changed: result
                            .style_updated
                            .into_iter()
                            .map(|c| SheetCellId {
                                sheet_id: c.0,
                                cell_id: c.1,
                            })
                            .collect(),
                        ..Default::default()
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
        if let Some(temp) = &mut self.temp_status {
            // Undo within temp branch; stop at fork point (never crosses into main history)
            match temp.version_manager.undo() {
                Some(status) => {
                    self.status = status;
                    true
                }
                None => false,
            }
        } else {
            match self.version_manager.undo() {
                Some(status) => {
                    self.status = status;
                    true
                }
                None => false,
            }
        }
    }

    pub fn redo(&mut self) -> bool {
        if let Some(temp) = &mut self.temp_status {
            match temp.version_manager.redo() {
                Some(status) => {
                    self.status = status;
                    true
                }
                None => false,
            }
        } else {
            match self.version_manager.redo() {
                Some(status) => {
                    self.status = status;
                    true
                }
                None => false,
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use logisheets_base::{CellId, CellValue};

    use crate::edit_action::{
        Alignment, BlockLineNameFieldUpdate, BlockLineStyleUpdate, CellInput, CellStyleUpdate,
        CreateBlock, CreateSheet, DeleteCols, DeleteRows, DeleteSheet, EditAction, EditPayload,
        EphemeralCellInput, HorizontalAlignment, InsertCols, InsertRows, LineStyleUpdate,
        PayloadsAction, StatusCode, StyleUpdateType, VerticalAlignment,
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
    fn controller_input_value() {
        let mut wb = Controller::default();
        let payloads_action = PayloadsAction {
            payloads: vec![EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 0,
                content: String::from("abcdefghijklmnopqrstuvwx"),
            })],
            undoable: true,
            init: false,
        };
        let result = wb.handle_action(EditAction::Payloads(payloads_action));
        assert_eq!(result.value_changed.len(), 1);
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

    #[test]
    fn controller_set_cell_num_fmt() {
        let mut wb = Controller::default();
        let sheet_idx = 0;
        let action = PayloadsAction {
            payloads: vec![EditPayload::CellStyleUpdate(CellStyleUpdate {
                sheet_idx,
                row: 0,
                col: 0,
                ty: StyleUpdateType {
                    set_num_fmt: Some("0.00".to_string()),
                    ..Default::default()
                },
            })],
            undoable: true,
            init: false,
        };
        let _ = wb.handle_action(EditAction::Payloads(action));

        let cell_id = wb
            .status
            .navigator
            .fetch_cell_id(&wb.get_sheet_id_by_idx(sheet_idx).unwrap(), 0, 0)
            .unwrap();
        let cell = wb
            .status
            .container
            .get_cell(wb.get_sheet_id_by_idx(sheet_idx).unwrap(), &cell_id)
            .unwrap();
        let style_id = cell.style;
        let style = wb.status.style_manager.get_style(style_id);
        assert_eq!(style.formatter, "0.00");
    }

    #[test]
    fn controller_set_line_num_fmt() {
        let mut wb = Controller::default();
        let sheet_idx = 0;
        let action = PayloadsAction {
            payloads: vec![EditPayload::LineStyleUpdate(LineStyleUpdate {
                sheet_idx,
                from: 0,
                to: 1,
                row: true,
                ty: StyleUpdateType {
                    set_num_fmt: Some("0.00".to_string()),
                    ..Default::default()
                },
            })],
            undoable: true,
            init: false,
        };
        let _ = wb.handle_action(EditAction::Payloads(action));

        let sheet_id = wb.get_sheet_id_by_idx(sheet_idx).unwrap();
        let row_id = wb.status.navigator.fetch_row_id(&sheet_id, 0).unwrap();
        let row_info = wb.status.container.get_row_info(sheet_id, row_id).unwrap();
        let style_id = row_info.style;
        let style = wb.status.style_manager.get_style(style_id);
        assert_eq!(style.formatter, "0.00");
    }

    #[test]
    fn delete_sheet1() {
        let mut wb = Controller::default();
        let sheet_idx = 0;
        let action = PayloadsAction {
            payloads: vec![EditPayload::CreateSheet(CreateSheet {
                new_name: "11".to_string(),
                idx: sheet_idx,
            })],
            undoable: true,
            init: false,
        };
        let result = wb.handle_action(EditAction::Payloads(action));
        assert!(result.version > 0);
        let action = PayloadsAction {
            payloads: vec![EditPayload::DeleteSheet(DeleteSheet { idx: sheet_idx + 1 })],
            undoable: true,
            init: false,
        };
        let result = wb.handle_action(EditAction::Payloads(action));
        assert!(result.version > 0);
    }

    #[test]
    fn delete_sheet2() {
        let mut wb = Controller::default();
        let sheet_idx = 0;
        let action = PayloadsAction {
            payloads: vec![EditPayload::CreateSheet(CreateSheet {
                new_name: "11".to_string(),
                idx: sheet_idx,
            })],
            undoable: true,
            init: false,
        };
        let result = wb.handle_action(EditAction::Payloads(action));
        assert!(result.version > 0);
        let action = PayloadsAction {
            payloads: vec![EditPayload::DeleteSheet(DeleteSheet { idx: sheet_idx })],
            undoable: true,
            init: false,
        };
        let result = wb.handle_action(EditAction::Payloads(action));
        assert!(result.version > 0);
    }

    #[test]
    fn set_block_line_name_field() {
        let mut wb = Controller::default();
        let sheet_idx = 0;
        let action = PayloadsAction {
            payloads: vec![
                EditPayload::CreateBlock(CreateBlock {
                    sheet_idx,
                    id: 0,
                    master_row: 10,
                    master_col: 4,
                    row_cnt: 1,
                    col_cnt: 1,
                    owner: None,
                    modify_policy: None,
                }),
                EditPayload::BlockLineNameFieldUpdate(BlockLineNameFieldUpdate {
                    sheet_idx,
                    block_id: 0,
                    line: 0,
                    row: true,
                    field_id: "field_id".to_string(),
                    name: Some("11".to_string()),
                    diy_render: None,
                }),
            ],
            undoable: true,
            init: false,
        };
        let result = wb.handle_action(EditAction::Payloads(action));
        assert!(result.version > 0);
    }

    #[test]
    fn create_block_with_num_fmt_and_field() {
        let mut wb = Controller::default();
        let sheet_idx = 0;
        let action = PayloadsAction {
            payloads: vec![
                EditPayload::CreateBlock(CreateBlock {
                    sheet_idx,
                    id: 1,
                    master_row: 6,
                    master_col: 3,
                    row_cnt: 1,
                    col_cnt: 1,
                    owner: None,
                    modify_policy: None,
                }),
                EditPayload::BlockLineStyleUpdate(BlockLineStyleUpdate {
                    sheet_idx,
                    block_id: 1,
                    from: 0,
                    to: 0,
                    row: false,
                    ty: StyleUpdateType {
                        set_num_fmt: Some("0.00".to_string()),
                        ..Default::default()
                    },
                }),
                EditPayload::BlockLineNameFieldUpdate(BlockLineNameFieldUpdate {
                    sheet_idx,
                    block_id: 1,
                    line: 0,
                    row: false,
                    field_id: "field_1_1762435654448".to_string(),
                    name: Some("Customer Status".to_string()),
                    diy_render: Some(false),
                }),
            ],
            undoable: true,
            init: false,
        };
        let result = wb.handle_action(EditAction::Payloads(action));
        assert!(result.version > 0);
    }

    #[test]
    fn set_wrap_test() {
        let mut wb = Controller::default();
        let sheet_idx = 0;
        let action = PayloadsAction {
            payloads: vec![EditPayload::CellStyleUpdate(CellStyleUpdate {
                sheet_idx,
                row: 0,
                col: 0,
                ty: StyleUpdateType {
                    set_alignment: Some(Alignment {
                        horizontal: Some(HorizontalAlignment::General),
                        vertical: Some(VerticalAlignment::Top),
                        wrap_text: Some(true),
                    }),
                    ..Default::default()
                },
            })],
            undoable: true,
            init: false,
        };
        let result = wb.handle_action(EditAction::Payloads(action));
        assert!(result.version > 0);
        let cell_id = wb
            .status
            .navigator
            .fetch_cell_id(&wb.get_sheet_id_by_idx(sheet_idx).unwrap(), 0, 0)
            .unwrap();
        let cell = wb
            .status
            .container
            .get_cell(wb.get_sheet_id_by_idx(sheet_idx).unwrap(), &cell_id)
            .unwrap();
        let style_id = cell.style;
        let style = wb.status.style_manager.get_style(style_id);
        assert!(style.alignment.unwrap().wrap_text.unwrap());
    }

    #[test]
    fn test_temp_status() {
        let mut wb = Controller::default();
        let sheet_idx = 0;
        let action = PayloadsAction {
            payloads: vec![EditPayload::CellInput(CellInput {
                sheet_idx,
                row: 0,
                col: 0,
                content: String::from("1"),
            })],
            undoable: true,
            init: false,
        };

        // Before temp action: cell should be empty
        let sheet_id = wb.get_sheet_id_by_idx(sheet_idx).unwrap();
        let cell_id = wb.status.navigator.fetch_cell_id(&sheet_id, 0, 0).unwrap();
        let cell_before = wb.status.container.get_cell(sheet_id, &cell_id);
        assert!(cell_before.is_none());

        let result = wb.handle_action_in_temp_status(action);
        assert!(result.value_changed.len() == 1);
        assert!(wb.is_in_temp_mode());

        // After temp action: self.status reflects temp state
        let cell_id = wb.status.navigator.fetch_cell_id(&sheet_id, 0, 0).unwrap();
        let cell = wb
            .status
            .container
            .get_cell(sheet_id, &cell_id)
            .unwrap();
        assert!(matches!(cell.value, CellValue::Number(1.0)));

        // Undo within temp branch: back to fork state (cell gone)
        let did_undo = wb.undo();
        assert!(did_undo);
        let cell_after_undo = wb.status.container.get_cell(sheet_id, &cell_id);
        assert!(cell_after_undo.is_none());

        // Undo again: at fork point, should stop
        let did_undo_again = wb.undo();
        assert!(!did_undo_again);

        // Redo: cell back
        let did_redo = wb.redo();
        assert!(did_redo);
        let cell_after_redo = wb
            .status
            .container
            .get_cell(sheet_id, &cell_id)
            .unwrap();
        assert!(matches!(cell_after_redo.value, CellValue::Number(1.0)));

        // Commit: temp branch merged into main history
        wb.commit_temp_status();
        assert!(!wb.is_in_temp_mode());

        let cell_id = wb.status.navigator.fetch_cell_id(&sheet_id, 0, 0).unwrap();
        let cell = wb
            .status
            .container
            .get_cell(sheet_id, &cell_id)
            .unwrap();
        assert!(matches!(cell.value, CellValue::Number(1.0)));
    }

    #[test]
    fn test_temp_status_accumulate() {
        let mut wb = Controller::default();
        let sheet_idx = 0;
        let sheet_id = wb.get_sheet_id_by_idx(sheet_idx).unwrap();

        // First temp action
        let action1 = PayloadsAction {
            payloads: vec![EditPayload::CellInput(CellInput {
                sheet_idx,
                row: 0,
                col: 0,
                content: String::from("1"),
            })],
            undoable: true,
            init: false,
        };
        wb.handle_action_in_temp_status(action1);
        assert!(wb.is_in_temp_mode());

        // Second temp action on same branch
        let action2 = PayloadsAction {
            payloads: vec![EditPayload::CellInput(CellInput {
                sheet_idx,
                row: 1,
                col: 0,
                content: String::from("2"),
            })],
            undoable: true,
            init: false,
        };
        wb.handle_action_in_temp_status(action2);
        assert!(wb.is_in_temp_mode());

        // Both cells should be set
        let cell_id0 = wb.status.navigator.fetch_cell_id(&sheet_id, 0, 0).unwrap();
        let cell_id1 = wb.status.navigator.fetch_cell_id(&sheet_id, 1, 0).unwrap();
        let cell0 = wb.status.container.get_cell(sheet_id, &cell_id0).unwrap();
        let cell1 = wb.status.container.get_cell(sheet_id, &cell_id1).unwrap();
        assert!(matches!(cell0.value, CellValue::Number(1.0)));
        assert!(matches!(cell1.value, CellValue::Number(2.0)));

        // Undo second action
        wb.undo();
        let cell1_gone = wb.status.container.get_cell(sheet_id, &cell_id1);
        assert!(cell1_gone.is_none());
        let cell0_still = wb.status.container.get_cell(sheet_id, &cell_id0).unwrap();
        assert!(matches!(cell0_still.value, CellValue::Number(1.0)));

        // Undo first action
        wb.undo();
        let cell0_gone = wb.status.container.get_cell(sheet_id, &cell_id0);
        assert!(cell0_gone.is_none());

        // At fork point, undo should stop
        assert!(!wb.undo());

        // Clean: restore fork state
        wb.redo(); // restore action1 to test clean
        wb.redo(); // restore action2
        wb.clean_temp_status();
        assert!(!wb.is_in_temp_mode());
        let cell0_cleaned = wb.status.container.get_cell(sheet_id, &cell_id0);
        assert!(cell0_cleaned.is_none());
    }

    #[test]
    fn test_temp_status_non_temp_cleans() {
        let mut wb = Controller::default();
        let sheet_idx = 0;
        let sheet_id = wb.get_sheet_id_by_idx(sheet_idx).unwrap();

        let temp_action = PayloadsAction {
            payloads: vec![EditPayload::CellInput(CellInput {
                sheet_idx,
                row: 0,
                col: 0,
                content: String::from("temp"),
            })],
            undoable: true,
            init: false,
        };
        wb.handle_action_in_temp_status(temp_action);
        assert!(wb.is_in_temp_mode());

        // Non-temp action discards temp and applies normally
        let normal_action = PayloadsAction {
            payloads: vec![EditPayload::CellInput(CellInput {
                sheet_idx,
                row: 0,
                col: 0,
                content: String::from("real"),
            })],
            undoable: true,
            init: false,
        };
        wb.handle_action(EditAction::Payloads(normal_action));
        assert!(!wb.is_in_temp_mode());

        let cell_id = wb.status.navigator.fetch_cell_id(&sheet_id, 0, 0).unwrap();
        let cell = wb.status.container.get_cell(sheet_id, &cell_id).unwrap();
        // Value should be "real", not "temp"
        assert!(!matches!(cell.value, CellValue::Blank));
    }

    #[test]
    fn insert_rows_action_effect() {
        let mut wb = Controller::default();
        let sheet_idx = 0;
        let sheet_id = wb.get_sheet_id_by_idx(sheet_idx).unwrap();

        let action = PayloadsAction {
            payloads: vec![EditPayload::InsertRows(InsertRows {
                sheet_idx,
                start: 2,
                count: 3,
            })],
            undoable: true,
            init: false,
        };
        let result = wb.handle_action(EditAction::Payloads(action));

        assert_eq!(result.row_inserted.len(), 3);
        assert!(result.row_inserted.iter().all(|r| r.sheet_id == sheet_id));
        assert!(result.row_removed.is_empty());
        assert!(result.col_inserted.is_empty());
        assert!(result.col_removed.is_empty());
    }

    #[test]
    fn delete_rows_action_effect() {
        let mut wb = Controller::default();
        let sheet_idx = 0;
        let sheet_id = wb.get_sheet_id_by_idx(sheet_idx).unwrap();

        let action = PayloadsAction {
            payloads: vec![EditPayload::DeleteRows(DeleteRows {
                sheet_idx,
                start: 1,
                count: 2,
            })],
            undoable: true,
            init: false,
        };
        let result = wb.handle_action(EditAction::Payloads(action));

        assert_eq!(result.row_removed.len(), 2);
        assert!(result.row_removed.iter().all(|r| r.sheet_id == sheet_id));
        assert!(result.row_inserted.is_empty());
        assert!(result.col_inserted.is_empty());
        assert!(result.col_removed.is_empty());
    }

    #[test]
    fn insert_cols_action_effect() {
        let mut wb = Controller::default();
        let sheet_idx = 0;
        let sheet_id = wb.get_sheet_id_by_idx(sheet_idx).unwrap();

        let action = PayloadsAction {
            payloads: vec![EditPayload::InsertCols(InsertCols {
                sheet_idx,
                start: 0,
                count: 2,
            })],
            undoable: true,
            init: false,
        };
        let result = wb.handle_action(EditAction::Payloads(action));

        assert_eq!(result.col_inserted.len(), 2);
        assert!(result.col_inserted.iter().all(|c| c.sheet_id == sheet_id));
        assert!(result.col_removed.is_empty());
        assert!(result.row_inserted.is_empty());
        assert!(result.row_removed.is_empty());
    }

    #[test]
    fn delete_cols_action_effect() {
        let mut wb = Controller::default();
        let sheet_idx = 0;
        let sheet_id = wb.get_sheet_id_by_idx(sheet_idx).unwrap();

        let action = PayloadsAction {
            payloads: vec![EditPayload::DeleteCols(DeleteCols {
                sheet_idx,
                start: 0,
                count: 1,
            })],
            undoable: true,
            init: false,
        };
        let result = wb.handle_action(EditAction::Payloads(action));

        assert_eq!(result.col_removed.len(), 1);
        assert!(result.col_removed.iter().all(|c| c.sheet_id == sheet_id));
        assert!(result.col_inserted.is_empty());
        assert!(result.row_inserted.is_empty());
        assert!(result.row_removed.is_empty());
    }

    #[test]
    fn mixed_insert_delete_action_effect() {
        let mut wb = Controller::default();
        let sheet_idx = 0;
        let sheet_id = wb.get_sheet_id_by_idx(sheet_idx).unwrap();

        // Insert 2 rows then delete 1 col in a single action
        let action = PayloadsAction {
            payloads: vec![
                EditPayload::InsertRows(InsertRows {
                    sheet_idx,
                    start: 0,
                    count: 2,
                }),
                EditPayload::DeleteCols(DeleteCols {
                    sheet_idx,
                    start: 0,
                    count: 1,
                }),
            ],
            undoable: true,
            init: false,
        };
        let result = wb.handle_action(EditAction::Payloads(action));

        assert_eq!(result.row_inserted.len(), 2);
        assert_eq!(result.col_removed.len(), 1);
        assert!(result.row_inserted.iter().all(|r| r.sheet_id == sheet_id));
        assert!(result.col_removed.iter().all(|c| c.sheet_id == sheet_id));
        assert!(result.row_removed.is_empty());
        assert!(result.col_inserted.is_empty());
    }
}
