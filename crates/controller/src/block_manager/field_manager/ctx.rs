use logisheets_base::StyleId;

use crate::{edit_action::StyleUpdateType, Error};

pub trait FieldRenderExecCtx {
    fn get_new_style_id(
        &mut self,
        old_id: StyleId,
        update_type: StyleUpdateType,
    ) -> Result<StyleId, Error>;
}
