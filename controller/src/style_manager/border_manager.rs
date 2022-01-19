use super::defaults::get_init_border;
use super::manager::Manager;
use crate::payloads::sheet_process::style::BorderPayloadType;
use xlrs_workbook::styles::*;

pub type BorderId = u32;
pub type BorderManager = Manager<Border, BorderId>;

impl Default for BorderManager {
    fn default() -> Self {
        let border = get_init_border();
        let mut manager = BorderManager::new(0);
        manager.get_id(border);
        manager
    }
}

impl BorderManager {
    pub fn execute(self, payload: &BorderPayload) -> (Self, BorderId) {
        let mut res = self.clone();
        let base = payload.id;
        if let Some(border) = res.get_data(base) {
            let mut new_border = border.clone();
            handle(&mut new_border, payload.change.clone());
            let new_id = res.get_id(new_border);
            (res, new_id)
        } else {
            (res, 0)
        }
    }
}

pub struct BorderPayload {
    pub id: BorderId,
    pub change: BorderPayloadType,
}

fn handle(border: &mut Border, ty: BorderPayloadType) {
    match ty {
        BorderPayloadType::Left(b) => border.set_left(Some(b)),
        BorderPayloadType::Right(b) => border.set_right(Some(b)),
        BorderPayloadType::Top(b) => border.set_top(Some(b)),
        BorderPayloadType::Bottom(b) => border.set_bottom(Some(b)),
        BorderPayloadType::Diagonal(b) => border.set_diagonal(Some(b)),
        BorderPayloadType::Vertical(b) => border.set_vertical(Some(b)),
        BorderPayloadType::Horizontal(b) => border.set_horizontal(Some(b)),
        BorderPayloadType::Outline(b) => border.set_outline(b),
        // _ => unimplemented!(),
    };
}
