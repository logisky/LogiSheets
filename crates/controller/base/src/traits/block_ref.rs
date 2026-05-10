use crate::{BlockCellId, BlockFieldId, BlockId, SheetId};

pub trait BlockRefTrait {
    fn get_all_keys(&self, ref_name: &str) -> Vec<(String, SheetId, BlockCellId)>;
    fn get_all_fields(&self, ref_name: &str) -> Vec<String>;
    fn resolve(
        &self,
        ref_name: &str,
        key: &String,
        field: &String,
    ) -> Option<(SheetId, BlockCellId)>;

    fn get_all_keys_by_block(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
    ) -> Vec<(String, SheetId, BlockCellId)>;
    fn get_all_fields_by_block(&self, sheet_id: SheetId, block_id: BlockId) -> Vec<String>;
    fn resolve_by_block(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
        key: &String,
        field: &String,
    ) -> Option<(SheetId, BlockCellId)>;

    /// Resolve a single block-cell using the stable field id (preferred path
    /// after the parse-time id resolution).
    fn resolve_by_block_field_id(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
        key: &String,
        field_id: BlockFieldId,
    ) -> Option<(SheetId, BlockCellId)>;

    /// Returns `(field_name, field_id)` pairs for a block.
    fn get_all_field_ids_by_block(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
    ) -> Vec<(String, BlockFieldId)>;

    /// Lookup a field id from a field name within a block (used at parse time).
    fn resolve_field_id(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
        field: &str,
    ) -> Option<BlockFieldId>;

    /// Inverse of `resolve_field_id` — used for unparse.
    fn fetch_field_name(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
        field_id: BlockFieldId,
    ) -> Option<String>;
}

/// Resolves a `BlockRef` ref-name into a stable `(sheet_id, block_id)` pair, and
/// resolves field names to stable ids. Used by the parser to do the
/// id-substitution at parse time.
pub trait BlockRefResolverTrait {
    fn resolve_block_ref_name(&self, ref_name: &str) -> Option<(SheetId, BlockId)>;

    fn resolve_block_field(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
        field: &str,
    ) -> Option<BlockFieldId>;

    fn fetch_block_ref_name(&self, sheet_id: SheetId, block_id: BlockId) -> Option<String>;

    fn fetch_block_field_name(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
        field_id: BlockFieldId,
    ) -> Option<String>;
}
