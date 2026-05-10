use imbl::HashMap;
use logisheets_base::{BlockCellId, BlockFieldId, BlockId, SheetId};

use crate::navigator::BlockPlace;

use super::schema::{BlockCellRole, Field, RenderId, Schema, SchemaTrait};

#[derive(Debug, Clone, Default)]
pub struct SchemaManager {
    pub schemas: HashMap<(SheetId, BlockId), Schema>,
    pub refs: HashMap<String, (SheetId, BlockId)>,
}

impl SchemaManager {
    pub fn new() -> Self {
        SchemaManager {
            schemas: HashMap::new(),
            refs: HashMap::new(),
        }
    }

    // Make sure you know what you are doing.
    // Given the key cell id, return the key-field cell id.
    pub fn partially_resolve(
        &self,
        ref_name: &str,
        key: BlockCellId,
        field: &String,
    ) -> Option<BlockCellId> {
        let (sheet_id, block_id) = self.refs.get(ref_name)?;
        let schema = self.schemas.get(&(*sheet_id, *block_id))?;
        schema.partially_resolve(key, field)
    }

    pub fn get_all_key_cell_ids<'a, F>(
        &'a self,
        ref_name: &str,
        f: &'a F,
    ) -> Option<(SheetId, Vec<BlockCellId>)>
    where
        F: Fn(&'a SheetId, &'a BlockId) -> Option<&'a BlockPlace>,
    {
        let (sheet_id, block_id) = self.refs.get(ref_name)?;
        let schema = self.schemas.get(&(*sheet_id, *block_id))?;
        let bp = f(sheet_id, block_id)?;
        Some((*sheet_id, schema.get_all_key_cell_ids(*block_id, bp)))
    }

    #[inline]
    pub fn get_all_fields(&self, ref_name: &str) -> Option<Vec<Field>> {
        let (sheet_id, block_id) = self.refs.get(ref_name)?;
        self.get_all_fields_by_block(*sheet_id, *block_id)
    }

    #[inline]
    pub fn get_all_fields_by_block(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
    ) -> Option<Vec<Field>> {
        let schema = self.schemas.get(&(sheet_id, block_id))?;
        Some(schema.get_all_fields())
    }

    pub fn get_all_key_cell_ids_by_block<'a>(
        &'a self,
        sheet_id: SheetId,
        block_id: BlockId,
        bp: &'a BlockPlace,
    ) -> Option<Vec<BlockCellId>> {
        let schema = self.schemas.get(&(sheet_id, block_id))?;
        Some(schema.get_all_key_cell_ids(block_id, bp))
    }

    pub fn partially_resolve_by_block(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
        key: BlockCellId,
        field: &String,
    ) -> Option<BlockCellId> {
        let schema = self.schemas.get(&(sheet_id, block_id))?;
        schema.partially_resolve(key, field)
    }

    pub fn partially_resolve_by_field_id(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
        key: BlockCellId,
        field_id: BlockFieldId,
    ) -> Option<BlockCellId> {
        let schema = self.schemas.get(&(sheet_id, block_id))?;
        schema.partially_resolve_by_field_id(key, field_id)
    }

    #[inline]
    pub fn get_render_id(&self, sheet_id: &SheetId, cell_id: &BlockCellId) -> Option<RenderId> {
        let schema = self.schemas.get(&(*sheet_id, cell_id.block_id))?;
        schema.get_render_id(cell_id.row, cell_id.col)
    }

    /// Resolve `ref_name` to its current `(sheet_id, block_id)`. Used by the
    /// parser to substitute the textual ref-name with stable ids.
    pub fn resolve_block_ref_name(&self, ref_name: &str) -> Option<(SheetId, BlockId)> {
        self.refs.get(ref_name).copied()
    }

    pub fn resolve_field_id(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
        field: &str,
    ) -> Option<BlockFieldId> {
        let schema = self.schemas.get(&(sheet_id, block_id))?;
        schema.resolve_field_id(field)
    }

    pub fn fetch_field_name(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
        field_id: BlockFieldId,
    ) -> Option<String> {
        let schema = self.schemas.get(&(sheet_id, block_id))?;
        schema.fetch_field_name(field_id)
    }

    pub fn fetch_block_ref_name(&self, sheet_id: SheetId, block_id: BlockId) -> Option<String> {
        let schema = self.schemas.get(&(sheet_id, block_id))?;
        Some(schema.get_ref_name())
    }

    pub fn get_all_field_ids_by_block(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
    ) -> Vec<(Field, BlockFieldId)> {
        match self.schemas.get(&(sheet_id, block_id)) {
            Some(s) => s.get_all_field_ids(),
            None => Vec::new(),
        }
    }

    /// Classify a block-cell so callers can dirty the right virtual node.
    pub fn cell_role(&self, sheet_id: SheetId, cell: &BlockCellId) -> BlockCellRole {
        match self.schemas.get(&(sheet_id, cell.block_id)) {
            Some(schema) => schema.cell_role(cell),
            None => BlockCellRole::None,
        }
    }
}
