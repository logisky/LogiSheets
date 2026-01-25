use imbl::HashMap;
use logisheets_base::{BlockCellId, BlockId, SheetId};

use super::schema::{Field, RenderId, Schema, SchemaTrait};

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

    pub fn get_all_key_cell_ids(&self, ref_name: &str) -> Option<(SheetId, Vec<BlockCellId>)> {
        let (sheet_id, block_id) = self.refs.get(ref_name)?;
        let schema = self.schemas.get(&(*sheet_id, *block_id))?;
        Some((*sheet_id, schema.get_all_key_cell_ids(*block_id)))
    }

    #[inline]
    pub fn get_all_fields(&self, ref_name: &str) -> Option<Vec<Field>> {
        let (sheet_id, block_id) = self.refs.get(ref_name)?;
        let schema = self.schemas.get(&(*sheet_id, *block_id))?;
        Some(schema.get_all_fields())
    }

    #[inline]
    pub fn get_render_id(&self, sheet_id: &SheetId, cell_id: &BlockCellId) -> Option<RenderId> {
        let schema = self.schemas.get(&(*sheet_id, cell_id.block_id))?;
        schema.get_render_id(cell_id.row, cell_id.col)
    }
}
