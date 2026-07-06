use logisheets_base::StyleId;

use crate::{Error, edit_action::StyleUpdateType};

pub trait FieldRenderExecCtx {
    fn get_new_style_id(
        &mut self,
        old_id: StyleId,
        update_type: StyleUpdateType,
    ) -> Result<StyleId, Error>;
}
