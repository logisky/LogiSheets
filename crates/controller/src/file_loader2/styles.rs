use crate::style_manager::{xf_manager::CtrlXf, StyleManager};
use logisheets_base::StyleId;
use logisheets_workbook::prelude::*;
use std::collections::HashMap;

#[allow(dead_code)]
pub struct StyleLoader<'a> {
    manager: &'a mut StyleManager,
    part: &'a StylesheetPart,
    xf_cache: HashMap<u32, StyleId>,
    cell_xf_cache: HashMap<u32, StyleId>,
}

impl<'a> StyleLoader<'a> {
    pub fn new(manager: &'a mut StyleManager, part: &'a StylesheetPart) -> Self {
        StyleLoader {
            manager,
            part,
            xf_cache: HashMap::new(),
            cell_xf_cache: HashMap::new(),
        }
    }

    pub fn load_xf(&mut self, idx: u32) -> StyleId {
        if let Some(cache) = self.cell_xf_cache.get(&idx) {
            return cache.clone();
        }
        let style_id = {
            if self.part.cell_xfs.is_none() {
                return 0;
            }
            let xf = self.part.cell_xfs.as_ref().unwrap().xfs.get(idx as usize);
            if xf.is_none() {
                return 0;
            }
            let xf = xf.unwrap();
            let font_id = if let Some(i) = xf.font_id {
                if let Some(fonts) = &self.part.fonts {
                    if let Some(f) = fonts.fonts.get(i as usize) {
                        self.manager.font_manager.get_id(f)
                    } else {
                        0
                    }
                } else {
                    0
                }
            } else {
                0
            };
            let fill_id = if let Some(i) = xf.fill_id {
                if let Some(fills) = &self.part.fills {
                    if let Some(f) = fills.fills.get(i as usize) {
                        self.manager.fill_manager.get_id(f)
                    } else {
                        0
                    }
                } else {
                    0
                }
            } else {
                0
            };
            let num_fmt_id = if let Some(i) = xf.num_fmt_id {
                if let Some(num_fmts) = &self.part.num_fmts {
                    let pos = num_fmts.num_fmts.iter().position(|fmt| fmt.num_fmt_id == i);
                    if let Some(p) = pos {
                        let f = num_fmts.num_fmts.get(p).unwrap();
                        self.manager.num_fmt_manager.get_id(&f.format_code)
                    } else {
                        i
                    }
                } else {
                    i
                }
            } else {
                0
            };
            let border_id = if let Some(i) = xf.border_id {
                if let Some(borders) = &self.part.borders {
                    if let Some(f) = borders.borders.get(i as usize) {
                        self.manager.border_manager.get_id(f)
                    } else {
                        0
                    }
                } else {
                    0
                }
            } else {
                0
            };
            let ctrl_xf = CtrlXf {
                alignment: xf.alignment.clone(),
                protection: xf.protction.clone(),
                font_id: Some(font_id),
                border_id: Some(border_id),
                fill_id: Some(fill_id),
                num_fmt_id: Some(num_fmt_id),
                apply_number_format: xf.apply_number_format,
                apply_font: xf.apply_font,
                apply_fill: xf.apply_fill,
                apply_border: xf.apply_border,
                apply_alignment: xf.apply_alignment,
                apply_protection: xf.apply_protection,
            };
            self.manager.cell_xfs_manager.get_id(&ctrl_xf)
        };
        self.cell_xf_cache.insert(idx, style_id);
        style_id
    }
}
