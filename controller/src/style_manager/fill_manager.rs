use super::defaults::get_init_fill;
use super::manager::Manager;
use crate::payloads::sheet_process::style::{FillPayloadType, GradientPayload, PatternPayload};
use xlrs_workbook::{simple_types::StPatternType, styles::*};

pub type FillId = u32;
pub type FillManager = Manager<Fill, FillId>;

impl Default for FillManager {
    fn default() -> Self {
        let fill = get_init_fill();
        let mut manager = FillManager::new(0);
        manager.get_id(fill);
        manager
    }
}

impl FillManager {
    pub fn execute(self, payload: &FillPayload) -> (Self, FillId) {
        let mut res = self.clone();
        let base = payload.id;
        if let Some(fill) = res.get_data(base) {
            let mut new_fill = fill.clone();
            handle(&mut new_fill, payload.change.clone());
            let new_id = res.get_id(new_fill);
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

fn handle(fill: &mut Fill, ty: FillPayloadType) {
    match ty {
        FillPayloadType::Pattern(p) => {
            if let Some(pf) = &mut fill.pattern_fill {
                match p {
                    PatternPayload::FgColor(c) => {
                        pf.set_fg_color(c);
                        pf.set_pattern_type(Some(StPatternType::Type::Solid));
                    }
                    PatternPayload::BgColor(c) => {
                        pf.set_bg_color(c);
                        pf.set_pattern_type(Some(StPatternType::Type::Solid));
                    }
                    PatternPayload::Type(t) => pf.set_pattern_type(t),
                }
            }
        }
        FillPayloadType::Graident(g) => {
            if let Some(gf) = &mut fill.gradient_fill {
                match g {
                    GradientPayload::Degree(d) => gf.set_degree(d),
                    GradientPayload::Left(l) => gf.set_left(l),
                    GradientPayload::Right(r) => gf.set_right(r),
                    GradientPayload::Top(t) => gf.set_top(t),
                    GradientPayload::Bottom(b) => gf.set_bottom(b),
                }
            }
        }
    }
}
