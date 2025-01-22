use crate::controller::style::color_to_ct_color;
use crate::edit_action::StyleUpdateType;

use super::defaults::get_init_fill;
use super::manager::Manager;
use logisheets_workbook::prelude::*;

pub type FillId = u32;
pub type FillManager = Manager<CtFill, FillId>;

impl Default for FillManager {
    fn default() -> Self {
        let fill = get_init_fill();
        let mut manager = FillManager::new(0);
        manager.get_id(&fill);
        manager
    }
}

impl FillManager {
    pub fn execute(&mut self, id: FillId, update_type: &StyleUpdateType) -> Option<FillId> {
        let update = update_type.set_pattern_fill.as_ref()?;
        let mut fill = if let Some(fill) = self.get_item(id) {
            fill.clone()
        } else {
            get_init_fill()
        };
        let new_fill = &mut fill;
        match new_fill {
            CtFill::PatternFill(ct_pattern_fill) => {
                if let Some(p) = &update.pattern_type {
                    ct_pattern_fill.pattern_type = Some(p.clone())
                }
                if let Some(p) = &update.fg_color {
                    let color = color_to_ct_color(p.clone());
                    ct_pattern_fill.fg_color = Some(color);
                }
                if let Some(p) = &update.bg_color {
                    let color = color_to_ct_color(p.clone());
                    ct_pattern_fill.bg_color = Some(color);
                }
            }
            CtFill::GradientFill(_) => return None,
        };
        // todo
        let new_id = self.get_id(&new_fill);
        if id != new_id {
            Some(new_id)
        } else {
            None
        }
    }
}
