use super::defaults::default_zero_u8;
use xmlserde::{Unparsed, XmlDeserialize, XmlSerialize};

// Ct_OfficeStyleSheet 20.1.6.2
#[derive(Debug, XmlSerialize, XmlDeserialize)]
#[xmlserde(with_custom_ns(b"a", b"http://schemas.openxmlformats.org/drawingml/2006/main"))]
pub struct ThemePart {
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: String,
    #[xmlserde(name = b"a:themeElements", ty = "child")]
    pub theme_elements: CtBaseStyles,
    #[xmlserde(name = b"a:objectDefaults", ty = "child")]
    pub object_defaults: Option<Unparsed>,
    // pub extra_clr_scheme_lst: Option<CtColorSchemeList>,
    // pub ext_lst: Option<CtOfficeArtExtensionList>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtBaseStyles {
    #[xmlserde(name = b"a:clrScheme", ty = "child")]
    pub clr_scheme: CtColorScheme,
    #[xmlserde(name = b"a:fontScheme", ty = "child")]
    pub font_scheme: ThemeCtFontScheme,
    #[xmlserde(name = b"a:fmtScheme", ty = "child")]
    pub fmt_scheme: Unparsed,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtColorScheme {
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: String,
    #[xmlserde(name = b"a:dk1", ty = "child")]
    pub dk1: EgColorChoice,
    #[xmlserde(name = b"a:lt1", ty = "child")]
    pub lt1: EgColorChoice,
    #[xmlserde(name = b"a:dk2", ty = "child")]
    pub dk2: EgColorChoice,
    #[xmlserde(name = b"a:lt2", ty = "child")]
    pub lt2: EgColorChoice,
    #[xmlserde(name = b"a:accent1", ty = "child")]
    pub accent1: EgColorChoice,
    #[xmlserde(name = b"a:accent2", ty = "child")]
    pub accent2: EgColorChoice,
    #[xmlserde(name = b"a:accent3", ty = "child")]
    pub accent3: EgColorChoice,
    #[xmlserde(name = b"a:accent4", ty = "child")]
    pub accent4: EgColorChoice,
    #[xmlserde(name = b"a:accent5", ty = "child")]
    pub accent5: EgColorChoice,
    #[xmlserde(name = b"a:accent6", ty = "child")]
    pub accent6: EgColorChoice,
    #[xmlserde(name = b"a:hlink", ty = "child")]
    pub hlink: EgColorChoice,
    #[xmlserde(name = b"a:folHlink", ty = "child")]
    pub fol_hlink: EgColorChoice,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub enum EgColorChoice {
    #[xmlserde(name = b"a:sysClr")]
    SysClr(CtSystemColor),
    #[xmlserde(name = b"a:srgbClr")]
    SrgbClr(CtSrgbColor),
}

impl EgColorChoice {
    pub fn get_color(&self) -> String {
        match self {
            EgColorChoice::SysClr(sys) => {
                if let Some(rgb) = &sys.last_clr {
                    let mut a = String::from("FF");
                    a.push_str(&rgb);
                    a
                } else {
                    String::from("")
                }
            }
            EgColorChoice::SrgbClr(srgb_color) => {
                let rgb = &srgb_color.val;
                let mut a = String::from("FF");
                a.push_str(&rgb);
                a
            }
        }
    }
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtSystemColor {
    #[xmlserde(name = b"val", ty = "attr")]
    pub val: String,
    #[xmlserde(name = b"lastClr", ty = "attr")]
    pub last_clr: Option<String>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtSrgbColor {
    #[xmlserde(name = b"val", ty = "attr")]
    pub val: String,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct ThemeCtFontScheme {
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: String,
    #[xmlserde(name = b"a:majorFont", ty = "child")]
    pub major_font: CtFontCollection,
    #[xmlserde(name = b"a:minorFont", ty = "child")]
    pub minor_font: CtFontCollection,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtFontCollection {
    #[xmlserde(name = b"a:latin", ty = "child")]
    pub latin: CtTextFont,
    #[xmlserde(name = b"a:ea", ty = "child")]
    pub ea: CtTextFont,
    #[xmlserde(name = b"a:cs", ty = "child")]
    pub cs: CtTextFont,
    #[xmlserde(name = b"a:font", ty = "child", vec_size = 30)]
    pub fonts: Vec<CtSupplementalFont>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtTextFont {
    #[xmlserde(name = b"typeface", ty = "attr")]
    pub typeface: String,
    #[xmlserde(name = b"panose", ty = "attr")]
    pub panose: Option<String>,
    #[xmlserde(name = b"pitchFamily", ty = "attr", default = "default_zero_u8")]
    pub pitch_family: u8,
    #[xmlserde(name = b"charset", ty = "attr", default = "default_charset")]
    pub charset: u8,
}

fn default_charset() -> u8 {
    1
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtSupplementalFont {
    #[xmlserde(name = b"script", ty = "attr")]
    pub script: String,
    #[xmlserde(name = b"typeface", ty = "attr")]
    pub typeface: String,
}

#[cfg(test)]
mod tests {
    use super::ThemePart;
    use crate::xml_deserialize_from_str;

    #[test]
    fn test1() {
        let xml = include_str!("../../examples/theme1.xml");
        let r = xml_deserialize_from_str::<ThemePart>(b"a:theme", xml);
        match r {
            Ok(theme) => {
                assert_eq!(theme.name, "Office 主题​​");
                use crate::ooxml::test_utils::*;
                use crate::xml_serialize_with_decl;
                let expected = to_tree(&in_one_line(xml));
                let actual = xml_serialize_with_decl(b"a:theme", theme);
                let r = to_tree(&in_one_line(&actual));
                assert_eq!(expected, r);
            }
            Err(_) => todo!(),
        }
    }
}
