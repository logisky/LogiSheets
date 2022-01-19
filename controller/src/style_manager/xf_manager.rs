use xlrs_workbook::styles::{CellAlignment, CellProtection};

use super::{
    border_manager::BorderId, fill_manager::FillId, font_manager::FontId, manager::Manager,
};

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct CtrlXf {
    pub alignment: Option<CellAlignment>,
    pub protection: Option<CellProtection>,
    pub font_id: Option<FontId>,
    pub border_id: Option<BorderId>,
    pub fill_id: Option<FillId>,
    pub apply_number_format: Option<bool>,
    pub apply_font: Option<bool>,
    pub apply_fill: Option<bool>,
    pub apply_border: Option<bool>,
    pub apply_alignment: Option<bool>,
    pub apply_protection: Option<bool>,
}

impl CtrlXf {
    pub fn init() -> Self {
        CtrlXf {
            alignment: None,
            protection: None,
            font_id: Some(0),
            border_id: Some(0),
            fill_id: Some(0),
            apply_number_format: None,
            apply_font: None,
            apply_fill: None,
            apply_border: None,
            apply_alignment: None,
            apply_protection: None,
        }
    }
}

pub type XfId = u32;
pub type XfManager = Manager<CtrlXf, XfId>;

impl Default for XfManager {
    fn default() -> Self {
        let init = CtrlXf::init();
        let mut manager = XfManager::new(0);
        manager.get_id(init);
        manager
    }
}
