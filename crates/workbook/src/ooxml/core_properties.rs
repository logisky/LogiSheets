use super::complex_types::PlainTextString;

#[derive(Debug, XmlSerialize, XmlDeserialize)]
#[xmlserde(with_custom_ns(
    b"cp",
    b"http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
))]
#[xmlserde(with_custom_ns(b"dc", b"http://purl.org/dc/elements/1.1/"))]
#[xmlserde(with_custom_ns(b"dcterms", b"http://purl.org/dc/terms/"))]
#[xmlserde(with_custom_ns(b"dcmitype", b"http://purl.org/dc/dcmitype/"))]
#[xmlserde(with_custom_ns(b"xsi", b"http://www.w3.org/2001/XMLSchema-instance"))]
pub struct CoreProperties {
    #[xmlserde(name = b"cp:category", ty = "child")]
    pub category: Option<PlainTextString>,
    #[xmlserde(name = b"cp:contentStatus", ty = "child")]
    pub content_status: Option<PlainTextString>,
    #[xmlserde(name = b"dc:creator", ty = "child")]
    pub creator: Option<PlainTextString>,
    #[xmlserde(name = b"cp:lastModifiedBy", ty = "child")]
    pub last_modified_by: Option<PlainTextString>,
    #[xmlserde(name = b"dcterms:created", ty = "child")]
    pub created: Option<CreatedModified>,
    #[xmlserde(name = b"dc:description", ty = "child")]
    pub description: Option<PlainTextString>,
    #[xmlserde(name = b"dc:identifier", ty = "child")]
    pub identifier: Option<PlainTextString>,
    #[xmlserde(name = b"keywords", ty = "child")]
    pub keywords: Option<CtKeywords>,
    #[xmlserde(name = b"dc:language", ty = "child")]
    pub language: Option<PlainTextString>,
    #[xmlserde(name = b"cp:lastPrinted", ty = "child")]
    pub last_printed: Option<PlainTextString>,
    #[xmlserde(name = b"dcterms:modified", ty = "child")]
    pub modified: Option<CreatedModified>,
    #[xmlserde(name = b"cp:revision", ty = "child")]
    pub revision: Option<PlainTextString>,
    #[xmlserde(name = b"dc:subject", ty = "child")]
    pub subject: Option<PlainTextString>,
    #[xmlserde(name = b"dc:title", ty = "child")]
    pub title: Option<PlainTextString>,
    #[xmlserde(name = b"cp:version", ty = "child")]
    pub version: Option<PlainTextString>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtKeywords {
    #[xmlserde(name = b"value", ty = "child")]
    pub values: Vec<CtKeyword>,
    #[xmlserde(name = b"xml:lang", ty = "attr")]
    pub lang: Option<String>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtKeyword {
    // TODO
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CreatedModified {
    #[xmlserde(ty = "text")]
    pub text: String,
    #[xmlserde(ty = "attr", name = b"xsi:type")]
    pub xs_ty: String,
}

#[cfg(test)]
mod tests {
    use super::CoreProperties;
    use crate::ooxml::test_utils::*;
    use crate::xml_deserialize_from_str;
    use crate::xml_serialize;
    #[test]
    fn test1() {
        let xml = r#"<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:creator>youzai</dc:creator>
<cp:lastModifiedBy>youzai</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">2022-03-17T11:56:30Z</dcterms:created>
<dcterms:modified xsi:type="dcterms:W3CDTF">2022-03-17T11:56:46Z</dcterms:modified>
</cp:coreProperties>"#;
        let r = xml_deserialize_from_str::<CoreProperties>(b"cp:coreProperties", xml).unwrap();
        let ser = xml_serialize(b"cp:coreProperties", r);
        assert_eq!(in_one_line(xml), ser)
    }
}
