use crate::Unparsed;

#[derive(Debug, XmlSerialize, XmlDeserialize)]
#[xmlserde(with_custom_ns(
    b"cp",
    b"http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
))]
#[xmlserde(with_custom_ns(b"dc", b"http://purl.org/dc/elements/1.1/"))]
#[xmlserde(with_custom_ns(b"dcterms", b"http://purl.org/dc/terms/"))]
#[xmlserde(with_custom_ns(b"dcmitype", b"http://purl.org/dc/dcmitype/"))]
#[xmlserde(with_custom_ns(b"xsi", b"http://www.w3.org/2001/XMLSchema-instance"))]
pub struct DocPropCore {
    #[xmlserde(name = b"cp:lastModifiedBy", ty = "child")]
    pub last_modified_by: ModifiedBy,
    #[xmlserde(name = b"dcterms:created", ty = "child")]
    pub created: Time,
    #[xmlserde(name = b"dcterms:modified", ty = "child")]
    pub modified: Time,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
#[xmlserde(with_ns = b"http://schemas.openxmlformats.org/officeDocument/2006/extended-properties")]
#[xmlserde(with_custom_ns(
    b"vt",
    b"http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"
))]
pub struct DocPropApp {
    #[xmlserde(name = b"Application", ty = "child")]
    pub application: Application,
    #[xmlserde(name = b"HeadingPairs", ty = "child")]
    pub heading_pairs: Unparsed,
    #[xmlserde(name = b"TitlesOfParts", ty = "child")]
    pub title_of_parts: Unparsed,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
#[xmlserde(with_ns = b"http://schemas.openxmlformats.org/officeDocument/2006/custom-properties")]
#[xmlserde(with_custom_ns(
    b"vt",
    b"http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"
))]
pub struct DocPropCustom {
    #[xmlserde(name = b"property", ty = "child")]
    pub properties: Vec<Unparsed>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct Application {
    #[xmlserde(ty = "text")]
    pub val: String,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct ModifiedBy {
    #[xmlserde(ty = "text")]
    pub val: String,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct Time {
    #[xmlserde(name = b"xsi:type", ty = "attr")]
    pub ty: String,
    #[xmlserde(ty = "text")]
    pub time: String,
}

#[cfg(test)]
mod tests {
    use super::{DocPropApp, DocPropCore, DocPropCustom};
    use crate::xml_deserialize_from_str;
    #[test]
    fn doc_prop_core_prop_test() {
        let xml = include_str!("../../examples/doc_prop_core.xml");
        let r = xml_deserialize_from_str::<DocPropCore>(b"cp:coreProperties", xml);
        match r {
            Ok(core) => {
                use crate::test_utils::*;
                use crate::xml_serialize_with_decl;
                let actual = xml_serialize_with_decl(b"cp:coreProperties", core);
                let r = in_one_line(&xml);
                assert_eq!(actual, r);
            }
            Err(e) => panic!("{:?}", e),
        }
    }

    #[test]
    fn doc_prop_app_test() {
        let xml = include_str!("../../examples/doc_prop_app.xml");
        let r = xml_deserialize_from_str::<DocPropApp>(b"Properties", xml);
        match r {
            Ok(core) => {
                use crate::test_utils::*;
                use crate::xml_serialize_with_decl;
                let actual = xml_serialize_with_decl(b"Properties", core);
                let r = in_one_line(&xml);
                assert_eq!(actual, r);
            }
            Err(e) => panic!("{:?}", e),
        }
    }

    #[test]
    fn doc_prop_custom_test() {
        let xml = include_str!("../../examples/doc_prop_custom.xml");
        let r = xml_deserialize_from_str::<DocPropCustom>(b"Properties", xml);
        match r {
            Ok(core) => {
                use crate::test_utils::*;
                use crate::xml_serialize_with_decl;
                let actual = xml_serialize_with_decl(b"Properties", core);
                let r = in_one_line(&xml);
                assert_eq!(actual, r);
            }
            Err(e) => panic!("{:?}", e),
        }
    }
}
