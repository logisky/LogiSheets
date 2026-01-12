use std::collections::HashSet;

use logisheets_base::errors::BasicError;

use crate::{
    block_schema_manager::{
        ctx::BlockSchemaCtx,
        manager::SchemaManager,
        schema::{ColSchema, RandomSchema, RowSchema, Schema, SchemaTrait},
    },
    edit_action::EditPayload,
    Error,
};

pub struct BlockSchemaExecutor {
    pub manager: SchemaManager,
    pub dirty_schemas: HashSet<String>,
}

impl BlockSchemaExecutor {
    pub fn new(manager: SchemaManager) -> Self {
        Self {
            manager,
            dirty_schemas: HashSet::new(),
        }
    }

    pub fn execute<C: BlockSchemaCtx>(
        self,
        ctx: &mut C,
        payload: EditPayload,
    ) -> Result<(Self, bool), Error> {
        match payload {
            EditPayload::BindFormSchema(p) => {
                let mut dirty_schemas = self.dirty_schemas;
                let mut manager = self.manager;
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let block_id = p.block_id;
                let mut fields = Vec::new();
                for (i, (field, render_id)) in p
                    .fields
                    .into_iter()
                    .zip(p.render_ids.into_iter())
                    .enumerate()
                {
                    let idx = i + p.field_from;
                    let id = if p.row {
                        ctx.fetch_block_cell_id(&sheet_id, &block_id, idx, 0)?.row
                    } else {
                        ctx.fetch_block_cell_id(&sheet_id, &block_id, 0, idx)?.col
                    };
                    fields.push((field, (id, render_id)));
                }
                let mut keys = Vec::new();

                for (j, k) in p.keys.into_iter().enumerate() {
                    let idx = j + p.key_from;
                    let id = if p.row {
                        ctx.fetch_block_cell_id(&sheet_id, &block_id, idx, 0)?.row
                    } else {
                        ctx.fetch_block_cell_id(&sheet_id, &block_id, 0, idx)?.col
                    };
                    keys.push((k, id));
                }
                let schema = if p.row {
                    Schema::RowSchema(RowSchema {
                        fields,
                        keys,
                        name: p.ref_name.clone(),
                    })
                } else {
                    Schema::ColSchema(ColSchema {
                        fields,
                        keys,
                        name: p.ref_name.clone(),
                    })
                };
                let old_schema = manager.schemas.get(&(sheet_id, block_id));
                if old_schema.is_some() {
                    let old_ref = old_schema.unwrap().get_ref_name();
                    manager.refs.remove(&old_ref);
                    dirty_schemas.insert(old_ref);
                }
                manager.schemas.insert((sheet_id, block_id), schema);
                manager
                    .refs
                    .insert(p.ref_name.clone(), (sheet_id, block_id));
                dirty_schemas.insert(p.ref_name);
                Ok((
                    Self {
                        manager,
                        dirty_schemas,
                    },
                    true,
                ))
            }
            EditPayload::BindRandomSchema(p) => {
                let mut dirty_schemas = self.dirty_schemas;
                let mut manager = self.manager;
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let block_id = p.block_id;
                let mut key_field = Vec::new();
                for unit in p.units {
                    let r = unit.row;
                    let c = unit.col;
                    let cell_id = ctx.fetch_block_cell_id(&sheet_id, &block_id, r, c)?;
                    key_field.push((
                        unit.key,
                        unit.field,
                        cell_id.row,
                        cell_id.col,
                        unit.render_id,
                    ));
                }
                let schema = Schema::RandomSchema(RandomSchema {
                    key_field,
                    name: p.ref_name.clone(),
                });
                let old_schema = manager.schemas.get(&(sheet_id, block_id));
                if old_schema.is_some() {
                    let old_ref = old_schema.unwrap().get_ref_name();
                    manager.refs.remove(&old_ref);
                    dirty_schemas.insert(old_ref);
                }
                manager.schemas.insert((sheet_id, block_id), schema);
                manager
                    .refs
                    .insert(p.ref_name.clone(), (sheet_id, block_id));
                dirty_schemas.insert(p.ref_name);
                Ok((
                    Self {
                        manager,
                        dirty_schemas,
                    },
                    true,
                ))
            }
            _ => Ok((self, false)),
        }
    }
}
