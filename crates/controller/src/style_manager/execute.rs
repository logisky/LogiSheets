use super::{errors::StyleError, xf_manager::CtrlXf, RawStyle, StyleManager};
use crate::{
    edit_action::{HorizontalAlignment, StyleUpdateType, VerticalAlignment},
    Error,
};
use logisheets_base::StyleId;
use logisheets_workbook::prelude::{CtCellAlignment, StHorizontalAlignment, StVerticalAlignment};

pub fn execute_style_update(
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
    if let Some(alignment) = update_type.set_alignment {
        let mut result = CtCellAlignment::default();
        if let Some(v) = alignment.vertical {
            match v {
                VerticalAlignment::Center => result.vertical = Some(StVerticalAlignment::Center),
                VerticalAlignment::Top => result.vertical = Some(StVerticalAlignment::Top),
                VerticalAlignment::Bottom => result.vertical = Some(StVerticalAlignment::Bottom),
                VerticalAlignment::Justify => result.vertical = Some(StVerticalAlignment::Justify),
                VerticalAlignment::Distributed => {
                    result.vertical = Some(StVerticalAlignment::Distributed)
                }
            }
        }
        if let Some(v) = alignment.horizontal {
            match v {
                HorizontalAlignment::General => {
                    result.horizontal = Some(StHorizontalAlignment::General)
                }
                HorizontalAlignment::Left => result.horizontal = Some(StHorizontalAlignment::Left),
                HorizontalAlignment::Center => {
                    result.horizontal = Some(StHorizontalAlignment::Center)
                }
                HorizontalAlignment::Right => {
                    result.horizontal = Some(StHorizontalAlignment::Right)
                }
                HorizontalAlignment::Fill => result.horizontal = Some(StHorizontalAlignment::Fill),
                HorizontalAlignment::Justify => {
                    result.horizontal = Some(StHorizontalAlignment::Justify)
                }
                HorizontalAlignment::CenterContinuous => {
                    result.horizontal = Some(StHorizontalAlignment::CenterContinuous)
                }
                HorizontalAlignment::Distributed => {
                    result.horizontal = Some(StHorizontalAlignment::Distributed)
                }
            }
        }
        xf.alignment = Some(result);
    }
    let new_id = cell_xfs_manager.get_id(&xf);
    Ok(new_id)
}

pub fn insert_style(sm: &mut StyleManager, style: RawStyle) -> Result<StyleId, Error> {
    let font_manager = &mut sm.font_manager;
    let border_manager = &mut sm.border_manager;
    let fill_manager = &mut sm.fill_manager;
    let num_fmt_manager = &mut sm.num_fmt_manager;

    let font_id = font_manager.get_id(&style.font);
    let border_id = border_manager.get_id(&style.border);
    let fill_id = fill_manager.get_id(&style.fill);
    let num_fmt_id = num_fmt_manager.get_id(&style.formatter);
    let xf = CtrlXf {
        font_id: Some(font_id),
        border_id: Some(border_id),
        fill_id: Some(fill_id),
        alignment: style.alignment,
        protection: style.protection,
        num_fmt_id: Some(num_fmt_id),
        apply_number_format: Some(true),
        apply_font: Some(true),
        apply_fill: Some(true),
        apply_border: Some(true),
        apply_alignment: Some(true),
        apply_protection: None,
    };
    let new_id = sm.cell_xfs_manager.get_id(&xf);
    Ok(new_id)
}
