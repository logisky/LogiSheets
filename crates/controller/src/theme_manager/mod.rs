use logisheets_workbook::prelude::theme::{CtColorScheme, ThemePart};

#[derive(Default)]
pub struct ThemeManager {
    theme: Option<ThemePart>,
}

impl ThemeManager {
    pub fn from(part: ThemePart) -> Self {
        ThemeManager { theme: Some(part) }
    }

    pub fn get_color(&self, idx: u32) -> String {
        if self.theme.is_none() {
            return String::from("");
        }
        match idx {
            0 => self.get_color_scheme().dk1.get_color(),
            1 => self.get_color_scheme().lt1.get_color(),
            2 => self.get_color_scheme().dk2.get_color(),
            3 => self.get_color_scheme().lt2.get_color(),
            4 => self.get_color_scheme().accent1.get_color(),
            5 => self.get_color_scheme().accent2.get_color(),
            6 => self.get_color_scheme().accent3.get_color(),
            7 => self.get_color_scheme().accent4.get_color(),
            8 => self.get_color_scheme().accent5.get_color(),
            9 => self.get_color_scheme().accent6.get_color(),
            10 => self.get_color_scheme().hlink.get_color(),
            11 => self.get_color_scheme().fol_hlink.get_color(),
            _ => String::from(""),
        }
    }

    fn get_color_scheme(&self) -> &CtColorScheme {
        let clr_scheme = &self.theme.as_ref().unwrap().theme_elements.clr_scheme;
        clr_scheme
    }
}
