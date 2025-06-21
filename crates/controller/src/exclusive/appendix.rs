use im::HashMap;
use logisheets_base::{BlockCellId, SheetId};

/// Appendix is one of the craft extensions.
///
/// To utilize the flexibility of cell coordinates, LogiSheets
/// allows crafts to add custom metadata to cells
#[derive(Debug, Clone)]
pub struct Appendix {
    pub craft_id: String,
    pub tag: u8,
    pub content: String,
}

#[derive(Debug, Clone, Default)]
pub struct AppendixManager {
    data: HashMap<(SheetId, BlockCellId), Appendix>,
}

impl AppendixManager {
    pub fn new() -> Self {
        Self {
            data: HashMap::new(),
        }
    }

    pub fn get(&self, sheet_id: SheetId, block_cell_id: &BlockCellId) -> Option<Appendix> {
        self.data.get(&(sheet_id, *block_cell_id)).cloned()
    }

    pub fn set(&mut self, sheet_id: SheetId, block_cell_id: BlockCellId, appendix: Appendix) {
        self.data.insert((sheet_id, block_cell_id), appendix);
    }
}
