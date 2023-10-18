use logisheets_workbook::prelude::*;

use super::defaults::get_init_font;
use super::manager::Manager;
use crate::payloads::sheet_process::style::FontPayloadType;

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
    pub fn execute(self, payload: &FontPayload) -> (Self, FontId) {
        let mut res = self.clone();
        let base = payload.id;
        if let Some(font) = res.get_item(base) {
            let mut new_font = font.clone();
            handle(&mut new_font, payload.change.clone());
            let new_id = res.get_id(&new_font);
            (res, new_id)
        } else {
            (res, 0)
        }
    }
}

pub struct FontPayload {
    pub id: FontId,
    pub change: FontPayloadType,
}

fn handle(f: &mut CtFont, ty: FontPayloadType) {
    match ty {
        FontPayloadType::Bold(b) => f.bold = b,
        FontPayloadType::Italic(i) => f.italic = i,
        FontPayloadType::Size(s) => f.sz = Some(CtFontSize { val: s }),
        FontPayloadType::Shadow(s) => f.shadow = s,
        FontPayloadType::Underline(u) => f.underline = Some(CtUnderlineProperty { val: u }),
        FontPayloadType::Name(n) => f.name = Some(CtFontName { val: n }),
        FontPayloadType::Outline(b) => f.outline = b,
        FontPayloadType::Strike(b) => f.strike = b,
        FontPayloadType::Condense(b) => f.condense = b,
        // _ => unimplemented!(),
    };
}
