use gents_derives::TS;
use imbl::HashMap;
use logisheets_base::{BlockId, ColId, RowId, StyleId};
use std::hash::Hash;

#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "block_line_info.ts", rename_all = "camelCase")]
pub struct BlockLineInfo {
    pub style: Option<StyleId>,
    pub name: Option<String>,
    pub field_id: String,
    pub diy_render: Option<bool>,
}

impl From<logisheets_workbook::logisheets::BlockLineInfo> for BlockLineInfo {
    fn from(value: logisheets_workbook::logisheets::BlockLineInfo) -> Self {
        BlockLineInfo {
            style: value.style,
            name: value.name,
            field_id: value.field_id,
            diy_render: value.diy_render,
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct LineInfoManager<T> {
    data: HashMap<(BlockId, T), BlockLineInfo>,
}

impl<T: Eq + Hash + Copy + Clone> LineInfoManager<T> {
    pub fn get(&self, key: (BlockId, T)) -> Option<&BlockLineInfo> {
        self.data.get(&key)
    }

    pub fn get_mut(&mut self, key: (BlockId, T)) -> &mut BlockLineInfo {
        self.data.entry(key).or_insert_with(BlockLineInfo::default)
    }

    pub fn set_info(&mut self, block_id: BlockId, id: T, info: BlockLineInfo) {
        self.data.insert((block_id, id), info);
    }

    pub fn get_all_block_fields(&self) -> Vec<(BlockId, String)> {
        self.data
            .iter()
            .map(|(key, info)| (key.0, info.field_id.clone()))
            .collect()
    }
}

#[derive(Debug, Clone, Default)]
pub struct BlockLineInfoManager {
    pub row_manager: LineInfoManager<RowId>,
    pub col_manager: LineInfoManager<ColId>,
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

    pub fn update_row_info_style(
        &mut self,
        block_id: BlockId,
        row_id: RowId,
        style: Option<StyleId>,
    ) {
        let info = self.row_manager.get_mut((block_id, row_id));
        info.style = style;
    }

    pub fn update_col_info_style(
        &mut self,
        block_id: BlockId,
        col_id: ColId,
        style: Option<StyleId>,
    ) {
        let info = self.col_manager.get_mut((block_id, col_id));
        info.style = style;
    }

    pub fn update_row_info_name(&mut self, block_id: BlockId, row_id: RowId, name: Option<String>) {
        let info = self.row_manager.get_mut((block_id, row_id));
        info.name = name;
    }

    pub fn update_col_info_name(&mut self, block_id: BlockId, col_id: ColId, name: Option<String>) {
        let info = self.col_manager.get_mut((block_id, col_id));
        info.name = name;
    }

    pub fn update_row_info_field_id(&mut self, block_id: BlockId, row_id: RowId, field_id: String) {
        let info = self.row_manager.get_mut((block_id, row_id));
        info.field_id = field_id;
    }

    pub fn update_col_info_field_id(&mut self, block_id: BlockId, col_id: ColId, field_id: String) {
        let info = self.col_manager.get_mut((block_id, col_id));
        info.field_id = field_id;
    }

    pub fn update_row_info_diy_render(
        &mut self,
        block_id: BlockId,
        row_id: RowId,
        diy_render: Option<bool>,
    ) {
        let info = self.row_manager.get_mut((block_id, row_id));
        info.diy_render = diy_render;
    }

    pub fn update_col_info_diy_render(
        &mut self,
        block_id: BlockId,
        col_id: ColId,
        diy_render: Option<bool>,
    ) {
        let info = self.col_manager.get_mut((block_id, col_id));
        info.diy_render = diy_render;
    }
}
