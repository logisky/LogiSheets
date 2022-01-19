use std::collections::HashMap;

use controller_base::StyleId;
use xlrs_workbook::styles::{StyleSheetPart, Xf};

use crate::style_manager::defaults::{get_init_border, get_init_fill, get_init_font};
use crate::style_manager::xf_manager::CtrlXf;
use crate::style_manager::StyleManager;

pub struct StyleLoader {
    style_part: StyleSheetPart,
    cache: HashMap<usize, StyleId>,
    manager: StyleManager,
}

impl StyleLoader {
    pub fn new(style_part: StyleSheetPart) -> Self {
        StyleLoader {
            style_part,
            cache: HashMap::new(),
            manager: StyleManager::default(),
        }
    }

    pub fn convert(&mut self, idx: usize) -> Option<StyleId> {
        let r = self.cache.get(&idx);
        if let Some(result) = r {
            return Some(result.clone());
        }
        let xfs = self.style_part.cell_xfs.as_ref().unwrap();
        let xfs = &xfs.xf;
        let xf = xfs.get(idx).map_or(get_init_xf(), |xf| xf.clone());
        let font_idx = xf.font_id.unwrap_or(0);
        let font = self.style_part.fonts.as_ref()?.font.get(font_idx);
        let font_id = self
            .manager
            .font_manager
            .get_id(font.map_or(get_init_font(), |f| f.clone()));
        let fill_idx = xf.fill_id.unwrap_or(0);
        let fill = self.style_part.fills.as_ref()?.fill.get(fill_idx);
        let fill_id = self
            .manager
            .fill_manager
            .get_id(fill.map_or(get_init_fill(), |f| f.clone()));
        let border_idx = xf.border_id.unwrap_or(0);
        let border = self.style_part.borders.as_ref()?.border.get(border_idx);
        let border_id = self
            .manager
            .border_manager
            .get_id(border.map_or(get_init_border(), |b| b.clone()));
        let ctrl_xf = CtrlXf {
            alignment: xf.alignment,
            protection: xf.protection,
            font_id: Some(font_id),
            border_id: Some(border_id),
            fill_id: Some(fill_id),
            apply_number_format: xf.apply_number_format,
            apply_font: xf.apply_font,
            apply_fill: xf.apply_fill,
            apply_border: xf.apply_border,
            apply_alignment: xf.apply_alignment,
            apply_protection: xf.apply_protection,
        };
        let id = self.manager.cell_xfs_manager.get_id(ctrl_xf);
        self.cache.insert(idx, id);
        Some(id)
    }

    pub fn finish(self) -> StyleManager {
        self.manager
    }
}

pub fn get_init_xf() -> Xf {
    Xf {
        alignment: None,
        protection: None,
        num_fmt_id: Some(0),
        font_id: Some(0),
        fill_id: Some(0),
        border_id: Some(0),
        xf_id: None,
        quote_prefix: false,
        pivot_button: false,
        apply_number_format: None,
        apply_font: None,
        apply_fill: None,
        apply_border: None,
        apply_alignment: None,
        apply_protection: None,
    }
}
