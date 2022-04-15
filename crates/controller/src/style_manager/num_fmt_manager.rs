use super::manager::Manager;

pub type NumFmtId = u32;
pub type NumFmtManager = Manager<String, NumFmtId>;

impl Default for NumFmtManager {
    fn default() -> Self {
        NumFmtManager::new(0)
    }
}
