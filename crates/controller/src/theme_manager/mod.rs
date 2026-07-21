use logisheets_workbook::prelude::{CtColorScheme, ThemePart};

#[derive(Default, Clone)]
pub struct ThemeManager {
    pub theme: Option<ThemePart>,
}

impl ThemeManager {
    pub fn from(part: ThemePart) -> Self {
        ThemeManager { theme: Some(part) }
    }

    /// Resolve a color's `theme` attribute index (as written in cell styles /
    /// `<color theme="N"/>`) to an RGB hex.
    ///
    /// The `theme` attribute enumerates the *system* slots
    /// (background1, text1, background2, text2, accent1..6, ...), whose order
    /// swaps the first two pairs relative to the `clrScheme` element order
    /// `[dk1, lt1, dk2, lt2, ...]`. So `theme="0"` is background1 (lt1),
    /// `theme="1"` is text1 (dk1 — the default black text), etc. Without this
    /// remap the default text color resolves to white.
    pub fn get_theme_color(&self, theme_idx: u32) -> String {
        let scheme_idx = match theme_idx {
            0 => 1, // background1 -> lt1
            1 => 0, // text1 -> dk1
            2 => 3, // background2 -> lt2
            3 => 2, // text2 -> dk2
            other => other,
        };
        self.get_color(scheme_idx)
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

#[cfg(test)]
mod tests {
    use super::ThemeManager;
    use logisheets_workbook::prelude::ThemePart;

    // The `theme` attribute (as written in cell colors) maps text1 -> dk1 and
    // background1 -> lt1, i.e. indices 0/1 are swapped vs the clrScheme order.
    // A regression guard for the "default text renders white" bug: default text
    // is `theme="1"` (text1), which must resolve to the dark dk1, not lt1.
    #[test]
    fn theme_attribute_index_maps_text1_to_dk1() {
        let xml = include_str!("../../../workbook/examples/theme1.xml");
        let part = xmlserde::xml_deserialize_from_str::<ThemePart>(xml).unwrap();
        let tm = ThemeManager::from(part);

        // theme="1" (text1) == clrScheme dk1 == get_color(0).
        assert_eq!(tm.get_theme_color(1), tm.get_color(0));
        // theme="0" (background1) == clrScheme lt1 == get_color(1).
        assert_eq!(tm.get_theme_color(0), tm.get_color(1));
        assert_eq!(tm.get_theme_color(2), tm.get_color(3));
        assert_eq!(tm.get_theme_color(3), tm.get_color(2));
        // Accents are not swapped.
        assert_eq!(tm.get_theme_color(4), tm.get_color(4));
        // text1 is dark (default black-ish), not the light background.
        assert_ne!(tm.get_theme_color(1), tm.get_theme_color(0));
    }
}
