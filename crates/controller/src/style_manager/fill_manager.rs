use super::defaults::get_init_fill;
use super::manager::Manager;
use crate::payloads::sheet_process::style::FillPayloadType;
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
    pub fn execute(self, payload: &FillPayload) -> (Self, FillId) {
        let mut res = self.clone();
        let base = payload.id;
        if let Some(fill) = res.get_item(base) {
            let mut new_fill = fill.clone();
            handle(&mut new_fill, payload.change.clone());
            let new_id = res.get_id(&new_fill);
            (res, new_id)
        } else {
            (res, 0)
        }
    }
}

pub struct FillPayload {
    pub id: FillId,
    pub change: FillPayloadType,
}

fn handle(fill: &mut CtFill, ty: FillPayloadType) {
    match (fill, ty) {
        (CtFill::PatternFill(_), FillPayloadType::Pattern(_)) => todo!(),
        (CtFill::PatternFill(_), FillPayloadType::Graident(_)) => todo!(),
        (CtFill::GradientFill(_), FillPayloadType::Pattern(_)) => todo!(),
        (CtFill::GradientFill(_), FillPayloadType::Graident(_)) => todo!(),
    }
}
