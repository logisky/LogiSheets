use imbl::HashMap;
use logisheets_base::{BlockCellId, BlockId, ColId, RowId, SheetId};

use crate::block_schema_manager::schema::{Field, Key, RenderId, Schema, SchemaTrait};

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

    pub fn resolve_by_ref_name(
        &self,
        name: &str,
        key: &Key,
        field: &Field,
    ) -> Option<(RowId, ColId)> {
        let (sheet_id, block_id) = self.refs.get(name)?;
        self.resolve_by_block_id(sheet_id, block_id, key, field)
    }

    pub fn resolve_by_block_id(
        &self,
        sheet_id: &SheetId,
        block_id: &BlockId,
        key: &Key,
        field: &Field,
    ) -> Option<(RowId, ColId)> {
        let schema = self.schemas.get(&(*sheet_id, *block_id))?;
        schema.resolve(key, field)
    }

    pub fn get_render_id(&self, sheet_id: &SheetId, cell_id: &BlockCellId) -> Option<RenderId> {
        let schema = self.schemas.get(&(*sheet_id, cell_id.block_id))?;
        schema.get_render_id(cell_id.row, cell_id.col)
    }
}
