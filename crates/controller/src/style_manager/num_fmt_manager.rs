use super::manager::Manager;

pub type NumFmtId = u32;
pub type NumFmtManager = Manager<String, NumFmtId>;

impl Default for NumFmtManager {
    fn default() -> Self {
        let num_fmt = String::from("");
        let mut manager = NumFmtManager::new(0);
        manager.get_id(&num_fmt);
        manager
    }
}
