use super::complex_types::PlainTextString;
use super::defaults::string_0_percent;
use super::defaults::string_100_percent;
use xmlserde_derives::{XmlDeserialize, XmlSerialize};

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
pub enum EgTextAutofit {
    #[xmlserde(name = b"noAutofit")]
    NoAutofit(CtNoAutofit),
    #[xmlserde(name = b"normAutofit")]
    NormAutofit(CtTextNormAutofit),
    #[xmlserde(name = b"spAutofit")]
    SpAutofit(CtSpAutofit),
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtTextNormAutofit {
    #[xmlserde(name = b"fontScale", ty = "attr", default = "string_100_percent")]
    pub font_scale: StTextFontScalePercentOrPercentString,
    #[xmlserde(name = b"lnSpcReduction", ty = "attr", default = "string_0_percent")]
    pub ln_spc_reduction: StTextSpaceingPercentOrPercentString,
}

pub type StTextFontScalePercentOrPercentString = String;
pub type StTextSpaceingPercentOrPercentString = String;

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtNoAutofit {}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtSpAutofit {}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub enum EgTextRun {
    #[xmlserde(name = b"r")]
    R(CtRegularTextRun),
    #[xmlserde(name = b"br")]
    Br(CtTextLineBreak),
    #[xmlserde(name = b"fld")]
    Fld(CtTextField),
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtTextCharacterProperties {
    // todo!()
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtRegularTextRun {
    #[xmlserde(name = b"rPr", ty = "child")]
    pub r_pr: Option<CtTextCharacterProperties>,
    #[xmlserde(name = b"t", ty = "child")]
    pub t: PlainTextString,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtTextLineBreak {
    #[xmlserde(name = b"rPr", ty = "child")]
    pub r_pr: Option<CtTextCharacterProperties>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtTextField {
    #[xmlserde(name = b"rPr", ty = "child")]
    pub r_pr: Option<CtTextCharacterProperties>,
    #[xmlserde(name = b"pPr", ty = "child")]
    pub p_pr: Option<CtTextParagraphProperties>,
    #[xmlserde(name = b"t", ty = "child")]
    pub t: Option<PlainTextString>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtTextParagraphProperties {
    // todo!()
}
