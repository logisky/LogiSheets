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

    /// Look up the value-formula template attached to a cell's field, if
    /// any. Returns the raw template string (still includes the leading
    /// `=` if the schema author wrote one). Callers do substitution on
    /// the body.
    pub fn formula_for_block_cell(&self, sheet_id: SheetId, cell: &BlockCellId) -> Option<String> {
        let schema = self.schemas.get(&(sheet_id, cell.block_id))?;
        match schema {
            Schema::RowSchema(s) => s.formula_for_field_axis(cell.col).map(String::from),
            Schema::ColSchema(s) => s.formula_for_field_axis(cell.row).map(String::from),
            // RandomSchema doesn't carry templates in v1.
            Schema::RandomSchema(_) => None,
        }
    }

    /// Look up the validation-formula template attached to a cell's field,
    /// if any.
    pub fn validation_for_block_cell(
        &self,
        sheet_id: SheetId,
        cell: &BlockCellId,
    ) -> Option<String> {
        let schema = self.schemas.get(&(sheet_id, cell.block_id))?;
        match schema {
            Schema::RowSchema(s) => s.validation_for_field_axis(cell.col).map(String::from),
            Schema::ColSchema(s) => s.validation_for_field_axis(cell.row).map(String::from),
            Schema::RandomSchema(_) => None,
        }
    }

    /// Look up the editability-formula template attached to a cell's field,
    /// if any.
    pub fn editability_for_block_cell(
        &self,
        sheet_id: SheetId,
        cell: &BlockCellId,
    ) -> Option<String> {
        let schema = self.schemas.get(&(sheet_id, cell.block_id))?;
        match schema {
            Schema::RowSchema(s) => s.editability_for_field_axis(cell.col).map(String::from),
            Schema::ColSchema(s) => s.editability_for_field_axis(cell.row).map(String::from),
            Schema::RandomSchema(_) => None,
        }
    }

    /// For a templated block cell, return the per-field sibling
    /// `BlockCellId`s in the same row, keyed by field name. Used to
    /// build the `#FIELD("name") → Reference` substitution map at
    /// parse time. Returns `None` if the schema isn't a Row/Col schema.
    pub fn siblings_for_block_cell(
        &self,
        sheet_id: SheetId,
        cell: &BlockCellId,
    ) -> Option<Vec<(String, BlockCellId)>> {
        let schema = self.schemas.get(&(sheet_id, cell.block_id))?;
        Some(match schema {
            Schema::RowSchema(s) => s
                .fields
                .iter()
                .map(|(name, entry)| {
                    (
                        name.clone(),
                        BlockCellId {
                            block_id: cell.block_id,
                            row: cell.row,
                            col: entry.field_axis_id,
                        },
                    )
                })
                .collect(),
            Schema::ColSchema(s) => s
                .fields
                .iter()
                .map(|(name, entry)| {
                    (
                        name.clone(),
                        BlockCellId {
                            block_id: cell.block_id,
                            row: entry.field_axis_id,
                            col: cell.col,
                        },
                    )
                })
                .collect(),
            Schema::RandomSchema(_) => return None,
        })
    }

    /// `BlockCellId` of the key cell that shares this cell's row (Row
    /// schema) or column (Col schema). Used to resolve `#KEY`.
    pub fn key_cell_for_block_cell(
        &self,
        sheet_id: SheetId,
        cell: &BlockCellId,
    ) -> Option<BlockCellId> {
        let schema = self.schemas.get(&(sheet_id, cell.block_id))?;
        Some(match schema {
            Schema::RowSchema(s) => BlockCellId {
                block_id: cell.block_id,
                row: cell.row,
                col: s.key,
            },
            Schema::ColSchema(s) => BlockCellId {
                block_id: cell.block_id,
                row: s.key,
                col: cell.col,
            },
            Schema::RandomSchema(_) => return None,
        })
    }
}
