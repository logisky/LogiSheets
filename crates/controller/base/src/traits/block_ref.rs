use crate::{BlockCellId, BlockId, SheetId};

pub trait BlockRefTrait {
    fn get_all_keys(&self, ref_name: &str) -> Vec<(String, SheetId, BlockCellId)>;
    fn get_all_fields(&self, ref_name: &str) -> Vec<String>;
    fn resolve(
        &self,
        ref_name: &str,
        key: &String,
        field: &String,
    ) -> Option<(SheetId, BlockCellId)>;

    fn get_all_keys_by_block(&self, sheet_id: SheetId, block_id: BlockId) -> Vec<(String, SheetId, BlockCellId)>;
    fn get_all_fields_by_block(&self, sheet_id: SheetId, block_id: BlockId) -> Vec<String>;
    fn resolve_by_block(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
        key: &String,
        field: &String,
    ) -> Option<(SheetId, BlockCellId)>;
}
