use xmlserde::{XmlDeserialize, XmlSerialize};

#[derive(Debug, XmlSerialize, XmlDeserialize)]
#[xmlserde(
    root = b"Types",
    with_ns = b"http://schemas.openxmlformats.org/package/2006/content-types"
)]
pub struct ContentTypes {
    #[xmlserde(name = b"Default", ty = "child")]
    pub defaults: Vec<CtDefault>,
    #[xmlserde(name = b"Override", ty = "child")]
    pub overides: Vec<CtOverride>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtDefault {
    #[xmlserde(name = b"Extension", ty = "attr")]
    pub extension: StExtension,
    #[xmlserde(name = b"ContentType", ty = "attr")]
    pub content_type: StContentType,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtOverride {
    #[xmlserde(name = b"PartName", ty = "attr")]
    pub part_name: String,
    #[xmlserde(name = b"ContentType", ty = "attr")]
    pub content_type: StContentType,
}

pub type StExtension = String;
pub type StContentType = String;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::xml_deserialize_from_str;
    #[test]
    fn test1() {
        let xml = include_str!("../../examples/[Content_Types].xml");
        let r = xml_deserialize_from_str::<ContentTypes>(xml);
        match r {
            Ok(ct) => {
                // Used the site and the code below to check the diff manually.
                // Basically pass.
                // https://www.diffchecker.com/diff
                use crate::ooxml::test_utils::*;
                use crate::xml_serialize_with_decl;
                let expected = to_tree(&in_one_line(xml));
                let actual = xml_serialize_with_decl(ct);
                let r = to_tree(&in_one_line(&actual));
                assert_eq!(expected, r);
            }
            Err(e) => panic!("{:?}", e),
        }
    }
}
