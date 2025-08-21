use imbl::HashMap;
use logisheets_base::{ColId, StyleId};

#[derive(Debug, Clone, Default)]
pub struct ColInfoManager {
    data: HashMap<ColId, ColInfo>,
}

impl ColInfoManager {
    pub fn get_col_info(&self, col_id: ColId) -> Option<&ColInfo> {
        self.data.get(&col_id)
    }

    pub fn get_col_info_mut(&mut self, col_id: ColId) -> Option<&mut ColInfo> {
        self.data.get_mut(&col_id)
    }

    pub fn set_col_info(&mut self, col_id: ColId, info: ColInfo) {
        self.data.insert(col_id, info);
    }

    pub fn get_all_col_info(&self) -> Vec<(ColId, &ColInfo)> {
        self.data.iter().map(|(k, v)| (*k, v)).collect()
    }
}

#[derive(Debug, Clone)]
pub struct ColInfo {
    pub best_fit: bool,
    pub collapsed: bool,
    pub custom_width: bool,
    pub hidden: bool,
    pub outline_level: u8,
    pub style: StyleId,
    pub width: Option<f64>,
}

impl Default for ColInfo {
    fn default() -> Self {
        ColInfo {
            best_fit: false,
            collapsed: false,
            custom_width: false,
            hidden: false,
            outline_level: 0,
            style: 0,
            width: None,
        }
    }
}
