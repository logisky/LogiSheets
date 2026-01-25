use logisheets_base::{BlockCellId, BlockId, ColId, RowId};

pub type RowSchema = FormSchema<ColId, RowId, true>;
pub type ColSchema = FormSchema<RowId, ColId, false>;
pub type RenderId = String;

#[derive(Debug, Clone)]
pub struct FormSchema<F, K, const IS_ROW: bool> {
    pub fields: Vec<(Field, (F, RenderId))>,
    pub name: String,
    pub key: K,
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

    fn get_all_key_cell_ids(&self, block_id: BlockId) -> Vec<BlockCellId> {
        match self {
            Schema::RowSchema(form_schema) => form_schema.get_all_key_cell_ids(block_id),
            Schema::ColSchema(form_schema) => form_schema.get_all_key_cell_ids(block_id),
            Schema::RandomSchema(random_schema) => random_schema.get_all_key_cell_ids(block_id),
        }
    }

    fn partially_resolve(&self, key: BlockCellId, field: &String) -> Option<BlockCellId> {
        match self {
            Schema::RowSchema(form_schema) => form_schema.partially_resolve(key, field),
            Schema::ColSchema(form_schema) => form_schema.partially_resolve(key, field),
            Schema::RandomSchema(random_schema) => random_schema.partially_resolve(key, field),
        }
    }
}

pub trait SchemaTrait {
    fn get_render_id(&self, row: RowId, col: ColId) -> Option<RenderId>;
    fn get_ref_name(&self) -> String;
    fn get_all_fields(&self) -> Vec<Field>;
    fn get_all_key_cell_ids(&self, block_id: BlockId) -> Vec<BlockCellId>;
    fn partially_resolve(&self, key: BlockCellId, field: &String) -> Option<BlockCellId>;
}

impl SchemaTrait for RowSchema {
    fn get_render_id(&self, _row: RowId, col: ColId) -> Option<RenderId> {
        self.fields
            .iter()
            .find(|(_, (f, _))| f == &col)
            .map(|(_, (_, id))| id.clone())
    }

    fn get_ref_name(&self) -> String {
        self.name.clone()
    }

    fn get_all_fields(&self) -> Vec<Field> {
        self.fields.iter().map(|(f, _)| f.clone()).collect()
    }

    fn get_all_key_cell_ids(&self, block_id: BlockId) -> Vec<BlockCellId> {
        let key = self.key;
        self.fields
            .iter()
            .map(|(_, (f, _))| BlockCellId {
                block_id,
                row: key,
                col: *f,
            })
            .collect()
    }

    fn partially_resolve(&self, key: BlockCellId, field: &String) -> Option<BlockCellId> {
        let row = key.row;
        let col = self
            .fields
            .iter()
            .find(|(f, (_, _))| f == field)
            .map(|(_, (f, _))| *f);
        col.map(|col| BlockCellId {
            row,
            col,
            block_id: key.block_id,
        })
    }
}

impl SchemaTrait for ColSchema {
    fn get_render_id(&self, row: RowId, _col: ColId) -> Option<RenderId> {
        self.fields
            .iter()
            .find(|(_, (f, _))| f == &row)
            .map(|(_, (_, id))| id.clone())
    }

    fn get_ref_name(&self) -> String {
        self.name.clone()
    }

    fn get_all_fields(&self) -> Vec<Field> {
        self.fields.iter().map(|(f, _)| f.clone()).collect()
    }

    fn get_all_key_cell_ids(&self, block_id: BlockId) -> Vec<BlockCellId> {
        let key = self.key;
        self.fields
            .iter()
            .map(|(_, (f, _))| BlockCellId {
                block_id,
                row: *f,
                col: key,
            })
            .collect()
    }

    fn partially_resolve(&self, key: BlockCellId, field: &String) -> Option<BlockCellId> {
        self.fields
            .iter()
            .find(|(f, (_, _))| f == field)
            .map(|(_, (f, _))| BlockCellId {
                block_id: key.block_id,
                row: *f,
                col: key.col,
            })
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

    fn get_all_key_cell_ids(&self, block_id: BlockId) -> Vec<BlockCellId> {
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
}
