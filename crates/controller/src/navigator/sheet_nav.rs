use super::block::BlockPlace;
use super::fetcher::Fetcher;
use super::id_manager::IdManager;
use imbl::{HashMap, Vector};
use logisheets_base::{BlockId, CellId, ColId, RowId, SheetId};

use crate::lock::Locked;

#[derive(Debug, Clone)]
pub struct SheetNav {
    pub sheet_id: SheetId,
    pub data: Data,
    pub cache: Locked<Cache>,
    pub id_manager: IdManager,
}

impl SheetNav {
    pub fn init(row_max: u32, col_max: u32, sheet_id: SheetId) -> Self {
        SheetNav {
            sheet_id,
            data: Data::init(row_max, col_max),
            id_manager: IdManager::new(row_max, col_max, 0),
            cache: Default::default(),
        }
    }

    pub fn get_fetcher(&self) -> Fetcher<'_> {
        Fetcher::from(&self.data, &self.cache, self.sheet_id)
    }
}

/// Rows in an xlsx sheet (`1048576`). Not a round million: files address the
/// real limit — a whole-column range is commonly written `A1:A1048576` — and
/// `Fetcher::get_row_id` panics on an index past the end, so under-allocating
/// here made such a file impossible to open.
pub const MAX_ROW_CNT: u32 = 1_048_576;
/// Columns in an xlsx sheet (`XFD` = `16384`).
pub const MAX_COL_CNT: u32 = 16_384;

impl Default for SheetNav {
    fn default() -> Self {
        SheetNav::init(MAX_ROW_CNT, MAX_COL_CNT, 0)
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

    pub fn has_block_id(&self, block: &BlockId) -> bool {
        self.blocks.contains_key(block)
    }
}

#[derive(Debug, Clone, Default)]
pub struct Cache {
    pub row_index: HashMap<RowId, usize>,
    pub row_id: HashMap<usize, RowId>,
    pub col_index: HashMap<ColId, usize>,
    pub col_id: HashMap<usize, ColId>,

    pub cell_id: HashMap<(usize, usize), CellId>,
    pub cell_idx: HashMap<CellId, (usize, usize)>,
}

impl Cache {
    pub fn clean(&mut self) {
        self.row_id.clear();
        self.row_index.clear();
        self.col_index.clear();
        self.col_id.clear();

        self.clean_cell();
    }

    // Used in block action handler.
    pub fn clean_cell(&mut self) {
        self.cell_id.clear();
        self.cell_idx.clear();
    }
}
