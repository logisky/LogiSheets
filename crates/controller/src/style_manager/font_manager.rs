use logisheets_workbook::prelude::*;

use crate::edit_action::StyleUpdateType;

use super::defaults::get_init_font;
use super::manager::Manager;

pub type FontId = u32;
pub type FontManager = Manager<CtFont, FontId>;

impl Default for FontManager {
    fn default() -> Self {
        let font = get_init_font();
        let mut manager = FontManager::new(0);
        manager.get_id(&font);
        manager
    }
}

impl FontManager {
    pub fn execute(&mut self, id: FontId, update_type: &StyleUpdateType) -> Option<FontId> {
        let mut font = if let Some(font) = self.get_item(id) {
            font.clone()
        } else {
            get_init_font()
        };

        if let Some(b) = update_type.set_font_bold {
            font.bold = b;
        }
        if let Some(i) = update_type.set_font_italic {
            font.italic = i;
        }
        if let Some(u) = &update_type.set_font_underline {
            font.underline = Some(CtUnderlineProperty { val: u.clone() });
        }
        if let Some(s) = update_type.set_font_size {
            font.sz = Some(CtFontSize { val: s });
        }
        if let Some(n) = &update_type.set_font_name {
            font.name = Some(CtFontName { val: n.clone() });
        }
        if let Some(o) = update_type.set_font_outline {
            font.outline = o;
        }
        if let Some(s) = update_type.set_font_shadow {
            font.shadow = s;
        }
        if let Some(s) = update_type.set_font_strike {
            font.strike = s;
        }
        if let Some(b) = update_type.set_font_condense {
            font.condense = b;
        }
        if let Some(c) = &update_type.set_font_color {
            font.color = Some(CtColor {
                auto: None,
                indexed: None,
                rgb: Some(c.clone()),
                theme: None,
                tint: 0.,
            })
        }

        let new_id = self.get_id(&font);
        if new_id != id {
            Some(new_id)
        } else {
            None
        }
    }
}
