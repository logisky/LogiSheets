use super::{errors::StyleError, StyleManager};
use crate::{edit_action::StyleUpdateType, Error};
use logisheets_base::StyleId;

pub fn execute_style_payload(
    sm: &mut StyleManager,
    update_type: StyleUpdateType,
    id: StyleId,
) -> Result<StyleId, Error> {
    let font_manager = &mut sm.font_manager;
    let border_manager = &mut sm.border_manager;
    let fill_manager = &mut sm.fill_manager;
    let cell_xfs_manager = &mut sm.cell_xfs_manager;
    let mut xf = cell_xfs_manager
        .get_item(id)
        .ok_or(StyleError::StyleIdNotFound(id))?
        .clone();
    if let Some(new_font_id) = font_manager.execute(xf.font_id.unwrap_or(0), &update_type) {
        xf.font_id = Some(new_font_id);
        xf.apply_font = Some(true);
    }
    if let Some(new_border_id) = border_manager.execute(xf.border_id.unwrap_or(0), &update_type) {
        xf.border_id = Some(new_border_id);
        xf.apply_border = Some(true);
    }
    if let Some(new_fill_id) = fill_manager.execute(xf.fill_id.unwrap_or(0), &update_type) {
        xf.fill_id = Some(new_fill_id);
        xf.apply_fill = Some(true)
    }
    let new_id = cell_xfs_manager.get_id(&xf);
    Ok(new_id)
}
