use crate::cell::Cell;
use block_line_info_manager::{BlockLineInfo, BlockLineInfoManager};
use imbl::hashmap::HashMap;
use logisheets_base::{BlockId, CellId, CellValue, ColId, NormalCellId, RowId, SheetId};

use self::col_info_manager::{ColInfo, ColInfoManager};
use self::row_info_manager::{RowInfo, RowInfoManager};
pub mod block_line_info_manager;
pub mod col_info_manager;
pub mod ctx;
mod executor;
pub mod row_info_manager;
pub use executor::ContainerExecutor;

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

    pub fn get_cell(&self, sheet_id: SheetId, cell_id: &CellId) -> Option<&Cell> {
        let container = self.get_sheet_container(sheet_id)?;
        container.cells.get(cell_id)
    }

    pub fn get_cell_mut(&mut self, sheet_id: SheetId, cell_id: &CellId) -> Option<&mut Cell> {
        let container = self.get_sheet_container_mut(sheet_id);
        container.cells.get_mut(cell_id)
    }

    pub fn get_row_info(&self, sheet_id: SheetId, row_id: RowId) -> Option<&RowInfo> {
        self.get_sheet_container(sheet_id)?
            .row_info
            .get_row_info(row_id)
    }

    pub fn get_block_row_info(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
        row_id: RowId,
    ) -> Option<&BlockLineInfo> {
        self.get_sheet_container(sheet_id)?
            .block_line_info_manager
            .get_row_info(block_id, row_id)
    }

    pub fn get_block_col_info(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
        col_id: ColId,
    ) -> Option<&BlockLineInfo> {
        self.get_sheet_container(sheet_id)?
            .block_line_info_manager
            .get_col_info(block_id, col_id)
    }

    pub fn get_row_info_mut(&mut self, sheet_id: SheetId, row_id: RowId) -> &mut RowInfo {
        let container = self.get_sheet_container_mut(sheet_id);
        let row_info = &mut container.row_info;
        if let Some(_) = row_info.get_row_info(row_id) {
            return row_info.get_row_info_mut(row_id).unwrap();
        }
        row_info.set_row_info(row_id, RowInfo::default());
        row_info.get_row_info_mut(row_id).unwrap()
    }

    pub fn set_row_info(&mut self, sheet_id: SheetId, row_id: RowId, info: RowInfo) {
        let container = self.get_sheet_container_mut(sheet_id);
        container.row_info.set_row_info(row_id, info);
    }

    pub fn get_col_info(&self, sheet_id: SheetId, col_id: ColId) -> Option<&ColInfo> {
        self.get_sheet_container(sheet_id)?
            .col_info
            .get_col_info(col_id)
    }

    pub fn get_col_info_mut(&mut self, sheet_id: SheetId, col_id: ColId) -> &mut ColInfo {
        let container = self.get_sheet_container_mut(sheet_id);
        let col_info = &mut container.col_info;
        if let Some(_) = col_info.get_col_info(col_id) {
            return col_info.get_col_info_mut(col_id).unwrap();
        }
        col_info.set_col_info(col_id, ColInfo::default());
        col_info.get_col_info_mut(col_id).unwrap()
    }

    pub fn set_col_info(&mut self, sheet_id: SheetId, col_id: ColId, info: ColInfo) {
        let container = self.get_sheet_container_mut(sheet_id);
        container.col_info.set_col_info(col_id, info);
    }

    pub fn get_sheet_container(&self, sheet_id: SheetId) -> Option<&SheetDataContainer> {
        self.data.get(&sheet_id)
    }

    pub fn get_sheet_container_mut(&mut self, sheet_id: SheetId) -> &mut SheetDataContainer {
        if let Some(_) = self.data.get(&sheet_id) {
            self.data.get_mut(&sheet_id).unwrap()
        } else {
            self.data.insert(sheet_id, SheetDataContainer::default());
            self.data.get_mut(&sheet_id).unwrap()
        }
    }

    pub fn add_cell(&mut self, sheet_id: SheetId, cell_id: CellId, cell: Cell) {
        let sheet_container = self.get_sheet_container_mut(sheet_id);
        sheet_container.cells.insert(cell_id, cell);
    }

    pub fn remove_cell(&mut self, sheet_id: SheetId, cell_id: &CellId) {
        let sheet_container = self.get_sheet_container_mut(sheet_id);
        sheet_container.cells.remove(cell_id);
    }

    pub fn update_value(&mut self, sheet_id: SheetId, cell_id: CellId, value: CellValue) {
        let sheet_container = self.get_sheet_container_mut(sheet_id);
        if let Some(v) = sheet_container.cells.get_mut(&cell_id) {
            v.value = value;
        } else {
            let mut cell = Cell::default();
            cell.value = value;
            sheet_container.cells.insert(cell_id, cell);
        }
    }

    /// These functions are used to get the cells whose styles need to be modified
    /// when the row or column is altered.
    pub fn get_to_be_modified_cells_by_row(
        &self,
        sheet_id: SheetId,
        row: RowId,
    ) -> Vec<NormalCellId> {
        let sheet_container = self.get_sheet_container(sheet_id);
        if sheet_container.is_none() {
            return vec![];
        }
        let mut res = vec![];
        let sheet_container = sheet_container.unwrap();

        sheet_container
            .col_info
            .get_all_col_info()
            .iter()
            .for_each(|(col_id, col_info)| {
                if col_info.style == 0 {
                    return;
                }
                let cell_id = NormalCellId { row, col: *col_id };
                res.push(cell_id);
            });
        res
    }

    pub fn get_to_be_modified_cells_by_col(
        &self,
        sheet_id: SheetId,
        col: ColId,
    ) -> Vec<NormalCellId> {
        let sheet_container = self.get_sheet_container(sheet_id);
        if sheet_container.is_none() {
            return vec![];
        }
        let mut res = vec![];
        let sheet_container = sheet_container.unwrap();

        sheet_container
            .row_info
            .get_all_row_info()
            .iter()
            .for_each(|(row_id, row_info)| {
                if row_info.style == 0 {
                    return;
                }
                let cell_id = NormalCellId { row: *row_id, col };
                res.push(cell_id);
            });
        res
    }
}

#[derive(Debug, Clone, Default)]
pub struct SheetDataContainer {
    pub cells: HashMap<CellId, Cell>,
    pub row_info: RowInfoManager,
    pub col_info: ColInfoManager,

    pub block_line_info_manager: BlockLineInfoManager,
}
