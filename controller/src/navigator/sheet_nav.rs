use super::block::BlockPlace;
use super::id_manager::IdManager;
use super::{executor, fetcher::Fetcher};
use controller_base::{BlockId, CellId, ColId, Id, RowId};
use im::{HashMap, Vector};

use crate::payloads::sheet_process::ShiftPayload;

#[derive(Debug, Clone)]
pub struct SheetNav {
    pub data: Data,
    pub cache: Cache,
    pub version: u32,
    pub id_manager: IdManager,
}

impl SheetNav {
    pub fn init(row_max: u32, col_max: u32) -> Self {
        SheetNav {
            data: Data::init(row_max, col_max),
            id_manager: IdManager::new(row_max, col_max),
            cache: Cache::default(),
            version: 1,
        }
    }

    pub fn execute_shift(self, shift_payload: &ShiftPayload) -> Self {
        executor::execute_shift_payload(self, &shift_payload)
    }

    pub fn get_fetcher(&mut self) -> Fetcher {
        Fetcher::from(&self.data, &mut self.cache, self.version)
    }
}

impl Default for SheetNav {
    fn default() -> Self {
        SheetNav::init(1000, 200)
    }
}

#[derive(Debug, Clone)]
pub struct Data {
    pub rows: Vector<RowId>,
    pub cols: Vector<ColId>,
    pub row_index_changes: HashMap<RowId, Vector<IndexChange>>,
    pub col_index_changes: HashMap<ColId, Vector<IndexChange>>,
    pub row_version: HashMap<RowId, u32>,
    pub col_version: HashMap<ColId, u32>,
    pub blocks: HashMap<BlockId, BlockPlace>,
}

impl Data {
    pub fn init(row_max: u32, col_max: u32) -> Self {
        Data {
            rows: (0..row_max).collect::<Vector<_>>(),
            cols: (0..col_max).collect::<Vector<_>>(),
            row_index_changes: HashMap::new(),
            col_index_changes: HashMap::new(),
            row_version: HashMap::new(),
            col_version: HashMap::new(),
            blocks: HashMap::new(),
        }
    }

    pub fn update_rows(self, rows: Vector<RowId>) -> Self {
        Data {
            rows,
            cols: self.cols,
            row_index_changes: self.row_index_changes,
            col_index_changes: self.col_index_changes,
            row_version: self.row_version,
            col_version: self.col_version,
            blocks: self.blocks,
        }
    }

    pub fn update_cols(self, cols: Vector<ColId>) -> Self {
        Data {
            rows: self.rows,
            cols,
            row_index_changes: self.row_index_changes,
            col_index_changes: self.col_index_changes,
            row_version: self.row_version,
            col_version: self.col_version,
            blocks: self.blocks,
        }
    }

    pub fn add_row_index_change(self, row_id: RowId, change: IndexChange) -> Self {
        let curr_changes = self.row_index_changes.get(&row_id);
        let new_changes = match curr_changes {
            Some(c) => {
                let mut changes = c.clone();
                changes.push_back(change);
                changes
            }
            None => Vector::from(vec![change]),
        };
        let row_index_change = self.row_index_changes.update(row_id, new_changes);
        self.update_row_index_changes(row_index_change)
    }

    pub fn add_col_index_change(self, col_id: ColId, change: IndexChange) -> Self {
        let curr_changes = self.col_index_changes.get(&col_id);
        let new_changes = match curr_changes {
            Some(c) => {
                let mut changes = c.clone();
                changes.push_back(change);
                changes
            }
            None => Vector::from(vec![change]),
        };
        let col_index_change = self.col_index_changes.update(col_id, new_changes);
        self.update_col_index_changes(col_index_change)
    }

    pub fn update_row_index_changes(self, changes: HashMap<RowId, Vector<IndexChange>>) -> Self {
        Data {
            rows: self.rows,
            cols: self.cols,
            row_index_changes: changes,
            col_index_changes: self.col_index_changes,
            row_version: HashMap::new(),
            col_version: HashMap::new(),
            blocks: self.blocks,
        }
    }

    pub fn update_col_index_changes(self, changes: HashMap<ColId, Vector<IndexChange>>) -> Self {
        Data {
            rows: self.rows,
            cols: self.cols,
            row_index_changes: self.row_index_changes,
            col_index_changes: changes,
            row_version: self.row_version,
            col_version: self.col_version,
            blocks: self.blocks,
        }
    }

    pub fn update_row_version(self, version: HashMap<RowId, u32>) -> Self {
        Data {
            rows: self.rows,
            cols: self.cols,
            row_index_changes: self.row_index_changes,
            col_index_changes: self.col_index_changes,
            row_version: version,
            col_version: self.col_version,
            blocks: self.blocks,
        }
    }

    pub fn update_col_version(self, version: HashMap<RowId, u32>) -> Self {
        Data {
            rows: self.rows,
            cols: self.cols,
            row_index_changes: self.row_index_changes,
            col_index_changes: self.col_index_changes,
            row_version: self.row_version,
            col_version: version,
            blocks: self.blocks,
        }
    }
}

/// When inserting or deleting an area in a worksheet, we build an IndexChange
/// to record this change. When visiting the cell by the position, IndexCHange
/// helps to find out the offset to calculate the correct Id.
///
#[derive(Debug, Clone)]
pub struct IndexChange {
    pub start: usize,
    pub offset: u32,
    pub free_id: Id,
    pub version: u32,
    pub ty: ChangeType,
}

#[derive(Debug, Clone)]
pub enum ChangeType {
    Insert,
    Delete,
}

#[derive(Debug, Clone, Default)]
pub struct Cache {
    pub row_index: HashMap<RowId, usize>,
    pub row_id: HashMap<usize, RowId>,
    pub col_index: HashMap<ColId, usize>,
    pub col_id: HashMap<usize, ColId>,

    pub cell_id: HashMap<(usize, usize), Option<CellId>>,
    pub cell_idx: HashMap<CellId, Option<(usize, usize)>>,
}
