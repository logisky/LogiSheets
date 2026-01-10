use logisheets_base::{ColId, RowId};

pub type RowSchema = FormSchema<ColId, RowId, true>;
pub type ColSchema = FormSchema<RowId, ColId, false>;
pub type RenderId = String;

#[derive(Debug, Clone)]
pub struct FormSchema<F, K, const IS_ROW: bool> {
    pub fields: Vec<(Field, (F, RenderId))>,
    pub keys: Vec<(Key, K)>,
    pub name: String,
}

pub type Field = String;
pub type Key = String;

#[derive(Debug, Clone)]
pub struct RandomSchema {
    pub key_field: Vec<(Key, Field, RowId, ColId, RenderId)>,
    pub name: String,
}

#[derive(Debug, Clone)]
pub enum Schema {
    RowSchema(RowSchema),
    ColSchema(ColSchema),
    RandomSchema(RandomSchema),
}

impl SchemaTrait for Schema {
    fn resolve(&self, key: &Key, field: &Field) -> Option<(RowId, ColId)> {
        match self {
            Schema::RowSchema(schema) => schema.resolve(key, field),
            Schema::ColSchema(schema) => schema.resolve(key, field),
            Schema::RandomSchema(schema) => schema.resolve(key, field),
        }
    }

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
}

pub trait SchemaTrait {
    fn resolve(&self, key: &Key, field: &Field) -> Option<(RowId, ColId)>;
    fn get_render_id(&self, row: RowId, col: ColId) -> Option<RenderId>;
    fn get_ref_name(&self) -> String;
}

impl SchemaTrait for RowSchema {
    fn resolve(&self, key: &Key, field: &Field) -> Option<(RowId, ColId)> {
        let k = self
            .keys
            .iter()
            .find(|(k, _)| k == key)
            .map(|(_, id)| *id)?;
        let f = self
            .fields
            .iter()
            .find(|(f, _)| f == field)
            .map(|(_, id)| id.0)?;
        Some((k, f))
    }

    fn get_render_id(&self, _row: RowId, col: ColId) -> Option<RenderId> {
        self.fields
            .iter()
            .find(|(_, (f, _))| f == &col)
            .map(|(_, (_, id))| id.clone())
    }

    fn get_ref_name(&self) -> String {
        self.name.clone()
    }
}

impl SchemaTrait for ColSchema {
    fn resolve(&self, key: &Key, field: &Field) -> Option<(RowId, ColId)> {
        let k = self
            .keys
            .iter()
            .find(|(k, _)| k == key)
            .map(|(_, id)| *id)?;
        let f = self
            .fields
            .iter()
            .find(|(f, _)| f == field)
            .map(|(_, id)| id.0)?;
        Some((f, k))
    }

    fn get_render_id(&self, row: RowId, _col: ColId) -> Option<RenderId> {
        self.fields
            .iter()
            .find(|(_, (f, _))| f == &row)
            .map(|(_, (_, id))| id.clone())
    }

    fn get_ref_name(&self) -> String {
        self.name.clone()
    }
}

impl SchemaTrait for RandomSchema {
    fn resolve(&self, key: &Key, field: &Field) -> Option<(RowId, ColId)> {
        self.key_field
            .iter()
            .find(|(k, f, _, _, _)| k == key && f == field)
            .map(|(_, _, r, c, _)| (*r, *c))
    }

    fn get_render_id(&self, row: RowId, col: ColId) -> Option<RenderId> {
        self.key_field
            .iter()
            .find(|(_, _, r, c, _)| r == &row && c == &col)
            .map(|(_, _, _, _, id)| id.clone())
    }

    fn get_ref_name(&self) -> String {
        self.name.clone()
    }
}
