use logisheets_base::StyleId;

use crate::{
    block_manager::field_manager::ctx::FieldRenderExecCtx, edit_action::StyleUpdateType, Error,
};

pub struct FieldRenderConnector<'a> {
    pub style_manager: &'a mut crate::style_manager::StyleManager,
}

impl<'a> FieldRenderExecCtx for FieldRenderConnector<'a> {
    fn get_new_style_id(
        &mut self,
        old_id: StyleId,
        update_type: StyleUpdateType,
    ) -> Result<StyleId, Error> {
        self.style_manager.execute_style_update(update_type, old_id)
    }
}
