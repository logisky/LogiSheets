use controller_base::{RowId, StyleId};
use im::HashMap;

#[derive(Debug, Clone, Default)]
pub struct RowInfoManager {
    data: HashMap<RowId, RowInfo>,
}

impl RowInfoManager {
    pub fn get_row_info(&self, row_id: RowId) -> Option<&RowInfo> {
        self.data.get(&row_id)
    }

    pub fn set_row_info(&mut self, row_id: RowId, info: RowInfo) {
        self.data.insert(row_id, info);
    }

    pub fn get_all_row_info(&self) -> Vec<(RowId, &RowInfo)> {
        self.data.iter().map(|(k, v)| (*k, v)).collect()
    }
}

#[derive(Debug, Clone)]
pub struct RowInfo {
    pub collapsed: bool,
    pub custom_format: bool,
    pub hidden: bool,
    pub ht: Option<f64>,
    pub outline_level: u8,
    pub style: StyleId,
}

impl Default for RowInfo {
    fn default() -> Self {
        RowInfo {
            collapsed: false,
            custom_format: false,
            hidden: false,
            ht: None,
            outline_level: 0,
            style: 0,
        }
    }
}
