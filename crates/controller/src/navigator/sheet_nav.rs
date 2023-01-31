use super::block::BlockPlace;
use super::id_manager::IdManager;
use super::{executor, fetcher::Fetcher};
use im::{HashMap, Vector};
use logisheets_base::{BlockId, CellId, ColId, Id, RowId};

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
            id_manager: IdManager::new(row_max, col_max, 0),
            cache: Cache::default(),
            version: 1,
        }
    }

    pub fn execute_shift(self, shift_payload: &ShiftPayload) -> Self {
        executor::execute_shift_payload(self, &shift_payload)
    }

    pub fn get_fetcher(&mut self) -> Fetcher {
        Fetcher::from(&self.data, &mut self.cache)
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
    pub blocks: HashMap<BlockId, BlockPlace>,
}

impl Data {
    pub fn init(row_max: u32, col_max: u32) -> Self {
        Data {
            rows: (0..row_max).collect::<Vector<_>>(),
            cols: (0..col_max).collect::<Vector<_>>(),
            blocks: HashMap::new(),
        }
    }

    pub fn update_rows(self, rows: Vector<RowId>) -> Self {
        Data {
            rows,
            cols: self.cols,
            blocks: self.blocks,
        }
    }

    pub fn update_cols(self, cols: Vector<ColId>) -> Self {
        Data {
            rows: self.rows,
            cols,
            blocks: self.blocks,
        }
    }

    pub fn update_blocks(self, blocks: HashMap<BlockId, BlockPlace>) -> Self {
        Data {
            rows: self.rows,
            cols: self.cols,
            blocks,
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
