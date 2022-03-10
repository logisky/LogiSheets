use super::simple_types::*;
use super::defaults::*;

#[derive(XmlSerialize, XmlDeserialize, Default, Debug)]
pub struct CtRst {
    #[xmlserde(name=b"t", ty="child")]
    pub t: Option<PlainText>,
    #[xmlserde(name=b"r", ty="child")]
    pub r: Vec<CtRElt>,
    #[xmlserde(name=b"rPh", ty="child")]
    pub r_ph: Vec<CtPhoneticRun>,
    #[xmlserde(name=b"phoneticPr", ty="child")]
    pub phonetic_pr: Option<CtPhoneticPr>,
}

#[derive(XmlSerialize, XmlDeserialize, Default, Debug)]
pub struct CtRElt{
    #[xmlserde(name=b"rPr", ty="child")]
    pub r_pr: Option<CtRPrElt>,
    #[xmlserde(name=b"t", ty="child")]
    pub t: PlainText,
}

#[derive(XmlSerialize, XmlDeserialize, Default, Debug)]
pub struct PlainText {
    #[xmlserde(ty="text")]
    pub value: String,
    #[xmlserde(ty="attr", name=b"xml:space")]
    pub space: Option<String>,
}

#[derive(XmlSerialize, XmlDeserialize, Default, Debug)]
pub struct CtRPrElt {
    #[xmlserde(name=b"rFont", ty="child")]
    pub r_font: Option<CtFontName>,
}

#[derive(XmlSerialize, XmlDeserialize, Default, Debug)]
pub struct CtFontName {
    #[xmlserde(name=b"val", ty="attr")]
    pub val: String
}

#[derive(XmlSerialize, XmlDeserialize, Debug)]
pub struct CtPhoneticPr {
    #[xmlserde(name=b"fontId", ty="attr")]
    pub font_id: StFontId,
    #[xmlserde(name=b"type", ty="attr", default="fullwidth_katakana")]
    pub ty: StPhoneticType,
    #[xmlserde(name=b"alignment", ty="attr", default="st_phonetic_alignment_left")]
    pub alignment: StPhoneticAlignment,
}

#[derive(XmlSerialize, XmlDeserialize, Default, Debug)]
pub struct CtPhoneticRun {
    #[xmlserde(name=b"t", ty="child")]
    pub t: PlainText,
    #[xmlserde(name=b"sb", ty="attr")]
    pub sb: u32,
    #[xmlserde(name=b"eb", ty="attr")]
    pub eb: u32,
}
