use super::complex_types::*;

#[derive(XmlSerialize, XmlDeserialize, Default, Debug)]
pub struct SstPart {
    #[xmlserde(name = b"count", ty="attr")]
    pub count: Option<u32>,
    #[xmlserde(name = b"uniqueCount", ty="attr")]
    pub unique_count: Option<u32>,
    #[xmlserde(name = b"si", ty = "child")]
    pub si: Vec<CtRst>,
}
