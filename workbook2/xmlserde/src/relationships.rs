use super::defaults::*;
use super::simple_types::*;

#[derive(Debug, XmlSerialize, XmlDeserialize)]
#[xmlserde(with_ns = b"http://schemas.openxmlformats.org/package/2006/relationships")]
pub struct Relationships {
    #[xmlserde(name = b"Relationship", ty = "child")]
    pub relationships: Vec<CtRelationship>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtRelationship {
    #[xmlserde(name = b"Id", ty = "attr")]
    pub id: String,
    #[xmlserde(name = b"Type", ty = "attr")]
    pub ty: String,
    #[xmlserde(name = b"Target", ty = "attr")]
    pub target: String,
    #[xmlserde(name = b"TargetMode", ty = "attr", default = "st_target_mode_internal")]
    pub target_mode: StTargetMode,
}

#[cfg(test)]
mod tests {
    use super::Relationships;
    use crate::test_utils::*;
    use crate::xml_deserialize_from_str;
    use crate::xml_serialize_with_decl;
    #[test]
    fn test1() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" Target="docProps/custom.xml"/></Relationships>"#;
        let r = xml_deserialize_from_str::<Relationships>(b"Relationships", xml).unwrap();
        let ser = xml_serialize_with_decl(b"Relationships", r);
        assert_eq!(in_one_line(xml), ser)
    }
}
