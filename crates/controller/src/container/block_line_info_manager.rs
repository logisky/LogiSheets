use imbl::HashMap;
use logisheets_base::{BlockId, ColId, RowId, StyleId};
use std::hash::Hash;

#[derive(Debug, Clone, Default)]
pub struct BlockLineInfo {
    pub style: Option<StyleId>,
}

#[derive(Debug, Clone, Default)]
pub struct LineInfoManager<T> {
    data: HashMap<(BlockId, T), BlockLineInfo>,
}

impl<T: Eq + Hash + Copy + Clone> LineInfoManager<T> {
    pub fn get(&self, key: (BlockId, T)) -> Option<&BlockLineInfo> {
        self.data.get(&key)
    }

    pub fn set_info(&mut self, block_id: BlockId, id: T, info: BlockLineInfo) {
        self.data.insert((block_id, id), info);
    }
}

#[derive(Debug, Clone, Default)]
pub struct BlockLineInfoManager {
    row_manager: LineInfoManager<RowId>,
    col_manager: LineInfoManager<ColId>,
}

impl BlockLineInfoManager {
    pub fn get_row_info(&self, block_id: BlockId, row_id: RowId) -> Option<&BlockLineInfo> {
        self.row_manager.get((block_id, row_id))
    }

    pub fn get_col_info(&self, block_id: BlockId, col_id: ColId) -> Option<&BlockLineInfo> {
        self.col_manager.get((block_id, col_id))
    }

    pub fn set_row_info(&mut self, block_id: BlockId, row_id: RowId, info: BlockLineInfo) {
        self.row_manager.set_info(block_id, row_id, info);
    }

    pub fn set_col_info(&mut self, block_id: BlockId, col_id: ColId, info: BlockLineInfo) {
        self.col_manager.set_info(block_id, col_id, info);
    }
}
