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
    pub fn execute(&mut self, id: FillId, _update_type: &StyleUpdateType) -> Option<FillId> {
        let fill = if let Some(fill) = self.get_item(id) {
            fill.clone()
        } else {
            get_init_fill()
        };
        // todo
        let new_id = self.get_id(&fill);
        if id != new_id {
            Some(new_id)
        } else {
            None
        }
    }
}
