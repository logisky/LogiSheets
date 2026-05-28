use logisheets_base::{BlockCellId, BlockFieldId, BlockId, ColId, RowId};

use crate::navigator::BlockPlace;

/// Position of a single block-cell within a schema. Used by the dependency
/// graph to know which virtual node to dirty when a cell value changes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BlockCellRole {
    /// The cell holds a key value. Editing it must dirty the block's key
    /// virtual node (any BlockRef that filters by key value can be affected).
    Key,
    /// The cell holds a value for a specific field, identified by `field_id`.
    Field(BlockFieldId),
    /// The cell does not participate in the schema (e.g., outside the
    /// described columns/rows). No virtual-node update needed.
    None,
}

pub type RowSchema = FormSchema<ColId, RowId, true>;
pub type ColSchema = FormSchema<RowId, ColId, false>;
pub type RenderId = String;

#[derive(Debug, Clone)]
pub struct FormSchema<F, K, const IS_ROW: bool> {
    /// Each entry: (field name, (field-axis id, render id, optional
    /// value-formula template string)). The template string is the raw
    /// source — parsing and substitution happens lazily at cell input
    /// time so a template can reference forward fields without ordering
    /// constraints.
    pub fields: Vec<(Field, (F, RenderId, Option<String>))>,
    pub name: String,
    pub key: K,
}

impl<F: Copy + PartialEq, K, const IS_ROW: bool> FormSchema<F, K, IS_ROW> {
    /// Lookup the formula template for the field whose field-axis id is
    /// `id`. Returns `None` if the field doesn't exist or has no
    /// template (free-form column).
    pub fn formula_for_field_axis(&self, id: F) -> Option<&str> {
        self.fields
            .iter()
            .find(|(_, (f, _, _))| *f == id)
            .and_then(|(_, (_, _, formula))| formula.as_deref())
    }

    /// Resolve a `#FIELD("name")` reference back to the field-axis id
    /// of the referenced sibling field. Returns `None` if the name
    /// isn't a field in this schema.
    pub fn field_axis_by_name(&self, name: &str) -> Option<F> {
        self.fields
            .iter()
            .find(|(n, _)| n == name)
            .map(|(_, (id, _, _))| *id)
    }
}

pub type Field = String;
pub type Key = String;

#[derive(Debug, Clone)]
pub struct RandomSchema {
    pub key_field: Vec<(Key, RowId, ColId, RenderId)>,
    pub name: String,
}

#[derive(Debug, Clone)]
pub enum Schema {
    RowSchema(RowSchema),
    ColSchema(ColSchema),
    RandomSchema(RandomSchema),
}

impl SchemaTrait for Schema {
    fn get_render_id(&self, row: RowId, col: ColId) -> Option<RenderId> {
        match self {
            Schema::RowSchema(schema) => schema.get_render_id(row, col),
            Schema::ColSchema(schema) => schema.get_render_id(row, col),
            Schema::RandomSchema(schema) => schema.get_render_id(row, col),
        }
    }

    fn get_ref_name(&self) -> String {
        match self {
            Schema::RowSchema(schema) => schema.get_ref_name(),
            Schema::ColSchema(schema) => schema.get_ref_name(),
            Schema::RandomSchema(schema) => schema.get_ref_name(),
        }
    }

    fn get_all_fields(&self) -> Vec<Field> {
        match self {
            Schema::RowSchema(schema) => schema.get_all_fields(),
            Schema::ColSchema(schema) => schema.get_all_fields(),
            Schema::RandomSchema(schema) => schema.get_all_fields(),
        }
    }

    fn get_all_field_ids(&self) -> Vec<(Field, BlockFieldId)> {
        match self {
            Schema::RowSchema(schema) => schema.get_all_field_ids(),
            Schema::ColSchema(schema) => schema.get_all_field_ids(),
            Schema::RandomSchema(schema) => schema.get_all_field_ids(),
        }
    }

    fn resolve_field_id(&self, field: &str) -> Option<BlockFieldId> {
        match self {
            Schema::RowSchema(schema) => schema.resolve_field_id(field),
            Schema::ColSchema(schema) => schema.resolve_field_id(field),
            Schema::RandomSchema(schema) => schema.resolve_field_id(field),
        }
    }

    fn fetch_field_name(&self, field_id: BlockFieldId) -> Option<String> {
        match self {
            Schema::RowSchema(schema) => schema.fetch_field_name(field_id),
            Schema::ColSchema(schema) => schema.fetch_field_name(field_id),
            Schema::RandomSchema(schema) => schema.fetch_field_name(field_id),
        }
    }

    fn get_all_key_cell_ids(&self, block_id: BlockId, bp: &BlockPlace) -> Vec<BlockCellId> {
        match self {
            Schema::RowSchema(form_schema) => form_schema.get_all_key_cell_ids(block_id, bp),
            Schema::ColSchema(form_schema) => form_schema.get_all_key_cell_ids(block_id, bp),
            Schema::RandomSchema(random_schema) => random_schema.get_all_key_cell_ids(block_id, bp),
        }
    }

    fn partially_resolve(&self, key: BlockCellId, field: &String) -> Option<BlockCellId> {
        match self {
            Schema::RowSchema(form_schema) => form_schema.partially_resolve(key, field),
            Schema::ColSchema(form_schema) => form_schema.partially_resolve(key, field),
            Schema::RandomSchema(random_schema) => random_schema.partially_resolve(key, field),
        }
    }

    fn partially_resolve_by_field_id(
        &self,
        key: BlockCellId,
        field_id: BlockFieldId,
    ) -> Option<BlockCellId> {
        match self {
            Schema::RowSchema(form_schema) => {
                form_schema.partially_resolve_by_field_id(key, field_id)
            }
            Schema::ColSchema(form_schema) => {
                form_schema.partially_resolve_by_field_id(key, field_id)
            }
            Schema::RandomSchema(random_schema) => {
                random_schema.partially_resolve_by_field_id(key, field_id)
            }
        }
    }

    fn cell_role(&self, cell: &BlockCellId) -> BlockCellRole {
        match self {
            Schema::RowSchema(s) => s.cell_role(cell),
            Schema::ColSchema(s) => s.cell_role(cell),
            Schema::RandomSchema(s) => s.cell_role(cell),
        }
    }
}

pub trait SchemaTrait {
    fn get_render_id(&self, row: RowId, col: ColId) -> Option<RenderId>;
    fn get_ref_name(&self) -> String;
    fn get_all_fields(&self) -> Vec<Field>;
    fn get_all_field_ids(&self) -> Vec<(Field, BlockFieldId)>;
    fn resolve_field_id(&self, field: &str) -> Option<BlockFieldId>;
    fn fetch_field_name(&self, field_id: BlockFieldId) -> Option<String>;
    fn get_all_key_cell_ids(&self, block_id: BlockId, bp: &BlockPlace) -> Vec<BlockCellId>;
    fn partially_resolve(&self, key: BlockCellId, field: &String) -> Option<BlockCellId>;
    fn partially_resolve_by_field_id(
        &self,
        key: BlockCellId,
        field_id: BlockFieldId,
    ) -> Option<BlockCellId>;
    fn cell_role(&self, cell: &BlockCellId) -> BlockCellRole;
}

impl SchemaTrait for RowSchema {
    fn get_render_id(&self, _row: RowId, col: ColId) -> Option<RenderId> {
        self.fields
            .iter()
            .find(|(_, (f, _, _))| f == &col)
            .map(|(_, (_, id, _))| id.clone())
    }

    fn get_ref_name(&self) -> String {
        self.name.clone()
    }

    fn get_all_fields(&self) -> Vec<Field> {
        self.fields.iter().map(|(f, _)| f.clone()).collect()
    }

    fn get_all_field_ids(&self) -> Vec<(Field, BlockFieldId)> {
        self.fields
            .iter()
            .map(|(name, (col, _, _))| (name.clone(), *col as BlockFieldId))
            .collect()
    }

    fn resolve_field_id(&self, field: &str) -> Option<BlockFieldId> {
        self.fields
            .iter()
            .find(|(name, _)| name == field)
            .map(|(_, (col, _, _))| *col as BlockFieldId)
    }

    fn fetch_field_name(&self, field_id: BlockFieldId) -> Option<String> {
        self.fields
            .iter()
            .find(|(_, (col, _, _))| *col as BlockFieldId == field_id)
            .map(|(name, _)| name.clone())
    }

    fn get_all_key_cell_ids(&self, block_id: BlockId, bp: &BlockPlace) -> Vec<BlockCellId> {
        let key = self.key;
        bp.rows
            .iter()
            .map(|r| BlockCellId {
                block_id,
                row: *r,
                col: key,
            })
            .collect()
    }

    fn partially_resolve(&self, key: BlockCellId, field: &String) -> Option<BlockCellId> {
        let row = key.row;
        let col = self
            .fields
            .iter()
            .find(|(f, (_, _, _))| f == field)
            .map(|(_, (f, _, _))| *f);
        col.map(|col| BlockCellId {
            row,
            col,
            block_id: key.block_id,
        })
    }

    fn partially_resolve_by_field_id(
        &self,
        key: BlockCellId,
        field_id: BlockFieldId,
    ) -> Option<BlockCellId> {
        // For RowSchema, fields run along columns and the field id is the
        // ColId. Verify the id is actually one of this schema's fields before
        // returning, so callers don't synthesize cells from arbitrary ids.
        if self
            .fields
            .iter()
            .any(|(_, (col, _, _))| *col as BlockFieldId == field_id)
        {
            Some(BlockCellId {
                block_id: key.block_id,
                row: key.row,
                col: field_id as ColId,
            })
        } else {
            None
        }
    }

    fn cell_role(&self, cell: &BlockCellId) -> BlockCellRole {
        if cell.col == self.key {
            BlockCellRole::Key
        } else if self.fields.iter().any(|(_, (col, _, _))| *col == cell.col) {
            BlockCellRole::Field(cell.col as BlockFieldId)
        } else {
            BlockCellRole::None
        }
    }
}

impl SchemaTrait for ColSchema {
    fn get_render_id(&self, row: RowId, _col: ColId) -> Option<RenderId> {
        self.fields
            .iter()
            .find(|(_, (f, _, _))| f == &row)
            .map(|(_, (_, id, _))| id.clone())
    }

    fn get_ref_name(&self) -> String {
        self.name.clone()
    }

    fn get_all_fields(&self) -> Vec<Field> {
        self.fields.iter().map(|(f, _)| f.clone()).collect()
    }

    fn get_all_field_ids(&self) -> Vec<(Field, BlockFieldId)> {
        self.fields
            .iter()
            .map(|(name, (row, _, _))| (name.clone(), *row as BlockFieldId))
            .collect()
    }

    fn resolve_field_id(&self, field: &str) -> Option<BlockFieldId> {
        self.fields
            .iter()
            .find(|(name, _)| name == field)
            .map(|(_, (row, _, _))| *row as BlockFieldId)
    }

    fn fetch_field_name(&self, field_id: BlockFieldId) -> Option<String> {
        self.fields
            .iter()
            .find(|(_, (row, _, _))| *row as BlockFieldId == field_id)
            .map(|(name, _)| name.clone())
    }

    fn get_all_key_cell_ids(&self, block_id: BlockId, bp: &BlockPlace) -> Vec<BlockCellId> {
        let key = self.key;
        bp.cols
            .iter()
            .map(|c| BlockCellId {
                block_id,
                row: key,
                col: *c,
            })
            .collect()
    }

    fn partially_resolve(&self, key: BlockCellId, field: &String) -> Option<BlockCellId> {
        self.fields
            .iter()
            .find(|(f, (_, _, _))| f == field)
            .map(|(_, (f, _, _))| BlockCellId {
                block_id: key.block_id,
                row: *f,
                col: key.col,
            })
    }

    fn partially_resolve_by_field_id(
        &self,
        key: BlockCellId,
        field_id: BlockFieldId,
    ) -> Option<BlockCellId> {
        if self
            .fields
            .iter()
            .any(|(_, (row, _, _))| *row as BlockFieldId == field_id)
        {
            Some(BlockCellId {
                block_id: key.block_id,
                row: field_id as RowId,
                col: key.col,
            })
        } else {
            None
        }
    }

    fn cell_role(&self, cell: &BlockCellId) -> BlockCellRole {
        if cell.row == self.key {
            BlockCellRole::Key
        } else if self.fields.iter().any(|(_, (row, _, _))| *row == cell.row) {
            BlockCellRole::Field(cell.row as BlockFieldId)
        } else {
            BlockCellRole::None
        }
    }
}

impl SchemaTrait for RandomSchema {
    fn get_render_id(&self, row: RowId, col: ColId) -> Option<RenderId> {
        self.key_field
            .iter()
            .find(|(_, r, c, _)| r == &row && c == &col)
            .map(|(_, _, _, id)| id.clone())
    }

    fn get_ref_name(&self) -> String {
        self.name.clone()
    }

    fn get_all_fields(&self) -> Vec<Field> {
        self.key_field
            .iter()
            .map(|(f, _, _, _)| f.clone())
            .collect()
    }

    // RandomSchema has no separate field axis — every entry is a (key, value)
    // pair. The id-keyed dependency vertex is intentionally coarse: any cell
    // change inside a RandomSchema block goes through `BlockAll`, so these id
    // helpers stay no-ops.
    fn get_all_field_ids(&self) -> Vec<(Field, BlockFieldId)> {
        Vec::new()
    }

    fn resolve_field_id(&self, _field: &str) -> Option<BlockFieldId> {
        None
    }

    fn fetch_field_name(&self, _field_id: BlockFieldId) -> Option<String> {
        None
    }

    fn get_all_key_cell_ids(&self, block_id: BlockId, _bp: &BlockPlace) -> Vec<BlockCellId> {
        self.key_field
            .iter()
            .map(|(_, r, c, _)| BlockCellId {
                block_id,
                row: *r,
                col: *c,
            })
            .collect()
    }

    fn partially_resolve(&self, key: BlockCellId, _field: &String) -> Option<BlockCellId> {
        Some(key)
    }

    fn partially_resolve_by_field_id(
        &self,
        key: BlockCellId,
        _field_id: BlockFieldId,
    ) -> Option<BlockCellId> {
        Some(key)
    }

    fn cell_role(&self, _cell: &BlockCellId) -> BlockCellRole {
        // Conservative: never claim a cell is a Key/Field for random schemas
        // because dirty propagation falls back to BlockAll for them.
        BlockCellRole::None
    }
}
