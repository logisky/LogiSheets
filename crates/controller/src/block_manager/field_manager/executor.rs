use std::collections::HashSet;

use crate::block_manager::schema_manager::schema::RenderId;
use crate::{
    block_manager::field_manager::{ctx::FieldRenderExecCtx, manager::FieldRenderManager},
    edit_action::EditPayload,
    Error,
};

use super::info::FieldRenderInfo;

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

    pub fn execute<C: FieldRenderExecCtx>(
        self,
        ctx: &mut C,
        payload: EditPayload,
    ) -> Result<(Self, bool), Error> {
        match payload {
            EditPayload::UpsertFieldRenderInfo(p) => {
                let mut executor = self;
                let old_style = executor
                    .manager
                    .get(&p.render_id)
                    .and_then(|i| i.style)
                    .unwrap_or(0);
                let new_style = ctx.get_new_style_id(old_style, p.style_update)?;
                let new_style = if new_style == 0 {
                    None
                } else {
                    Some(new_style)
                };
                executor.manager.set_info(
                    p.render_id.clone(),
                    FieldRenderInfo {
                        style: new_style,
                        diy_render: Some(p.diy_render),
                    },
                );
                executor.dirty_render_ids.insert(p.render_id);
                Ok((executor, true))
            }
            _ => Ok((self, false)),
        }
    }
}
