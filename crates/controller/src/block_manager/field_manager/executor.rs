use std::collections::HashSet;

use crate::block_manager::schema_manager::schema::RenderId;
use crate::{
    block_manager::field_manager::manager::FieldRenderManager, edit_action::EditPayload, Error,
};

pub struct FieldRenderExecutor {
    pub manager: FieldRenderManager,
    pub dirty_render_ids: HashSet<RenderId>,
}

impl FieldRenderExecutor {
    pub fn new(manager: FieldRenderManager) -> Self {
        Self {
            manager,
            dirty_render_ids: HashSet::new(),
        }
    }

    pub fn execute(self, payload: EditPayload) -> Result<(Self, bool), Error> {
        match payload {
            EditPayload::BatchUpsertFieldRenderInfo(p) => {
                let mut executor = self;
                p.units.into_iter().for_each(|u| {
                    executor
                        .manager
                        .set_info(u.render_id.clone(), u.info.clone());
                    executor.dirty_render_ids.insert(u.render_id);
                });
                Ok((executor, true))
            }
            _ => Ok((self, false)),
        }
    }
}
