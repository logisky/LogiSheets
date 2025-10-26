use gents_derives::TS;
use imbl::HashMap;
use logisheets_base::{BlockId, ColId, RowId, StyleId};
use std::hash::Hash;

#[derive(Debug, Clone, Default)]
pub struct BlockLineInfo {
    pub style: Option<StyleId>,
    pub name: Option<String>,
    pub field_type: Option<FieldType>,
}

#[derive(Debug, Clone, TS)]
#[ts(
    file_name = "block_line_info_manager.ts",
    tag = "type",
    rename_all = "camelCase"
)]
pub enum FieldType {
    Date,
    Time,
    DateTime,
    Boolean,
    // Number or text. String is a validation formula of a placeholder.
    VerifiableValue(String),
    // EnumId. EnumId represents the identifier of an enum list.
    // Note that the content of enum lists are kept track of by users(frontend).
    Enum(u8),
    // HTML Element. This means that the content of this cell is a String that
    // represents an HTML element like <img src="..." />.
    HTMLElement(String),
    None,
}

impl Default for FieldType {
    fn default() -> Self {
        Self::None
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

    pub fn update_row_info_field_type(
        &mut self,
        block_id: BlockId,
        row_id: RowId,
        field_type: Option<FieldType>,
    ) {
        let info = self.row_manager.get_mut((block_id, row_id));
        info.field_type = field_type;
    }

    pub fn update_col_info_field_type(
        &mut self,
        block_id: BlockId,
        col_id: ColId,
        field_type: Option<FieldType>,
    ) {
        let info = self.col_manager.get_mut((block_id, col_id));
        info.field_type = field_type;
    }
}
