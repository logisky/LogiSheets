use xmlserde_derives::{XmlDeserialize, XmlSerialize};

/// `xl/persons/personN.xml` — the workbook-scoped person list backing threaded
/// comments and `@mentions`. `userId` + `providerId` are the enterprise
/// directory hooks (e.g. `providerId="AD"` / `"AAD"` / `"PeoplePicker"`); files
/// authored outside a directory omit them.
#[derive(Debug, XmlSerialize, XmlDeserialize)]
#[xmlserde(with_ns = b"http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments")]
#[xmlserde(root = b"personList")]
pub struct Persons {
    #[xmlserde(name = b"person", ty = "child")]
    pub persons: Vec<CtPerson>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtPerson {
    #[xmlserde(name = b"displayName", ty = "attr")]
    pub display_name: String,
    #[xmlserde(name = b"id", ty = "attr")]
    pub id: String,
    #[xmlserde(name = b"userId", ty = "attr")]
    pub user_id: Option<String>,
    #[xmlserde(name = b"providerId", ty = "attr")]
    pub provider_id: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::Persons;
    use crate::ooxml::test_utils::*;
    use crate::{xml_deserialize_from_str, xml_serialize_with_decl};

    #[test]
    fn round_trip() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<personList xmlns="http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments"><person displayName="Alice" id="{11111111-1111-1111-1111-111111111111}" userId="alice@corp.com" providerId="AD"/><person displayName="Guest" id="{22222222-2222-2222-2222-222222222222}"/></personList>"#;
        let r = xml_deserialize_from_str::<Persons>(xml).unwrap();
        assert_eq!(r.persons.len(), 2);
        let actual = xml_serialize_with_decl(r);
        assert_eq!(to_tree(&in_one_line(xml)), to_tree(&in_one_line(&actual)));
    }
}
