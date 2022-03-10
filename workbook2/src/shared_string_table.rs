use super::complex_types::*;

#[derive(XmlSerialize, XmlDeserialize, Debug)]
#[xmlserde(with_ns=b"http://schemas.openxmlformats.org/spreadsheetml/2006/main")]
pub struct SstPart {
    #[xmlserde(name = b"count", ty="attr")]
    pub count: Option<u32>,
    #[xmlserde(name = b"uniqueCount", ty="attr")]
    pub unique_count: Option<u32>,
    #[xmlserde(name = b"si", ty = "child")]
    pub si: Vec<CtRst>,
}

#[cfg(test)]
mod tests {
    use crate::{xml_serialize, xml_deserialize};
}
