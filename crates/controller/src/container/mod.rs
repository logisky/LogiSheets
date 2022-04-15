use crate::cell::Cell;
use controller_base::{CellId, ColId, RowId, SheetId};
use im::hashmap::HashMap;

use self::col_info_manager::{ColInfo, ColInfoManager};
use self::row_info_manager::{RowInfo, RowInfoManager};
pub mod col_info_manager;
pub mod row_info_manager;

#[derive(Debug, Clone, Default)]
pub struct DataContainer {
    pub data: HashMap<SheetId, SheetDataContainer>,
}

impl DataContainer {
    pub fn delete_cells(self, sheet_id: SheetId, cids: &Vec<CellId>) -> Self {
        let mut res = self.clone();
        if let Some(container) = res.data.get_mut(&sheet_id) {
            cids.iter().for_each(|cid| {
                container.cells.remove(cid);
            });
            res
        } else {
            res
        }
    }

    pub fn get_cell(&mut self, sheet_id: SheetId, cell_id: &CellId) -> Option<&mut Cell> {
        let container = self.get_sheet_container(sheet_id);
        container.cells.get_mut(cell_id)
    }

    pub fn get_row_info(&mut self, sheet_id: SheetId, row_id: RowId) -> Option<&RowInfo> {
        let container = self.get_sheet_container(sheet_id);
        let row_info = &container.row_info;
        row_info.get_row_info(row_id)
    }

    pub fn update_row_info(self, sheet_id: SheetId, row_id: RowId, info: RowInfo) -> Self {
        let mut c = self.clone();
        c.set_row_info(sheet_id, row_id, info);
        c
    }

    pub fn set_row_info(&mut self, sheet_id: SheetId, row_id: RowId, info: RowInfo) {
        let container = self.get_sheet_container(sheet_id);
        container.row_info.set_row_info(row_id, info);
    }

    pub fn update_col_info(self, sheet_id: SheetId, col_id: ColId, info: ColInfo) -> Self {
        let mut c = self.clone();
        let container = c.get_sheet_container(sheet_id);
        container.col_info.set_col_info(col_id, info);
        c
    }

    pub fn get_col_info(&mut self, sheet_id: SheetId, col_id: ColId) -> Option<&ColInfo> {
        let container = self.get_sheet_container(sheet_id);
        let col_info = &container.col_info;
        col_info.get_col_info(col_id)
    }

    pub fn set_col_info(&mut self, sheet_id: SheetId, col_id: ColId, info: ColInfo) {
        let container = self.get_sheet_container(sheet_id);
        container.col_info.set_col_info(col_id, info);
    }

    pub fn get_sheet_container(&mut self, sheet_id: SheetId) -> &mut SheetDataContainer {
        if let Some(_) = self.data.get(&sheet_id) {
            self.data.get_mut(&sheet_id).unwrap()
        } else {
            self.data.insert(sheet_id, SheetDataContainer::default());
            self.data.get_mut(&sheet_id).unwrap()
        }
    }

    pub fn add_cell(&mut self, sheet_id: SheetId, cell_id: CellId, cell: Cell) {
        let sheet_container = self.get_sheet_container(sheet_id);
        sheet_container.cells.insert(cell_id, cell);
    }
}

#[derive(Debug, Clone, Default)]
pub struct SheetDataContainer {
    pub cells: HashMap<CellId, Cell>,
    pub row_info: RowInfoManager,
    pub col_info: ColInfoManager,
}
