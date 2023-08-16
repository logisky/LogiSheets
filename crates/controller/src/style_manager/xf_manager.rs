use logisheets_workbook::prelude::{CtCellAlignment, CtCellProtection, CtXf};

use super::{
    border_manager::BorderId, fill_manager::FillId, font_manager::FontId, manager::Manager,
    num_fmt_manager::NumFmtId,
};

// The inner struct for describing a kind of style
#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct CtrlXf {
    pub alignment: Option<CtCellAlignment>,
    pub protection: Option<CtCellProtection>,
    pub font_id: Option<FontId>,
    pub border_id: Option<BorderId>,
    pub fill_id: Option<FillId>,
    pub num_fmt_id: Option<NumFmtId>,
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
            num_fmt_id: Some(0),
            apply_number_format: None,
            apply_font: None,
            apply_fill: None,
            apply_border: None,
            apply_alignment: None,
            apply_protection: None,
        }
    }

    // Convert to the CtXf, using the Id as the u32 directly.
    // This method should be only used in saving
    pub fn to_ct_xf(self) -> CtXf {
        CtXf {
            alignment: self.alignment,
            protction: self.protection,
            num_fmt_id: self.num_fmt_id,
            font_id: self.font_id,
            fill_id: self.fill_id,
            border_id: self.border_id,
            xf_id: None,
            quote_prefix: false,
            pivot_button: false,
            apply_number_format: self.apply_number_format,
            apply_font: self.apply_font,
            apply_fill: self.apply_fill,
            apply_border: self.apply_border,
            apply_alignment: self.apply_alignment,
            apply_protection: self.apply_protection,
        }
    }
}

pub type XfId = u32;
pub type XfManager = Manager<CtrlXf, XfId>;

impl Default for XfManager {
    fn default() -> Self {
        let init = CtrlXf::init();
        let mut manager = XfManager::new(0);
        manager.get_id(&init);
        manager
    }
}
