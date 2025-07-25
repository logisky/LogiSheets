use im::HashMap;
use logisheets_base::{BlockCellId, BlockId, SheetId};

/// Appendix is one of the craft extensions.
///
/// To utilize the flexibility of cell coordinates, LogiSheets
/// allows crafts to add custom metadata to cells
#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "appendix.ts")
)]
pub struct Appendix {
    pub craft_id: String,
    pub tag: u8,
    pub content: String,
}

#[derive(Debug, Clone)]
#[cfg_attr(
    feature = "gents",
    gents_derives::gents_header(file_name = "appendix_with_cell.ts")
)]
pub struct AppendixWithCell {
    pub appendix: Appendix,
    pub sheet_id: SheetId,
    pub block_id: BlockId,
    pub row_idx: usize,
    pub col_idx: usize,
}

#[derive(Debug, Clone, Default)]
pub struct AppendixManager {
    data: HashMap<(SheetId, BlockCellId), Vec<Appendix>>,
}

impl AppendixManager {
    pub fn new() -> Self {
        Self {
            data: HashMap::new(),
        }
    }

    pub fn get(&self, sheet_id: SheetId, block_cell_id: &BlockCellId) -> Option<Vec<Appendix>> {
        self.data.get(&(sheet_id, *block_cell_id)).cloned()
    }

    pub fn push(&mut self, sheet_id: SheetId, block_cell_id: BlockCellId, appendix: Appendix) {
        self.data
            .entry((sheet_id, block_cell_id))
            .or_insert(vec![])
            .push(appendix);
    }
}
