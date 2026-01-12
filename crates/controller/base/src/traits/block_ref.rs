use crate::{BlockCellId, SheetId};

pub trait BlockRefTrait {
    fn get_all_keys(&self, ref_name: &str) -> Vec<String>;
    fn get_all_fields(&self, ref_name: &str) -> Vec<String>;
    fn resolve(
        &self,
        ref_name: &str,
        key: &String,
        field: &String,
    ) -> Option<(SheetId, BlockCellId)>;
}
