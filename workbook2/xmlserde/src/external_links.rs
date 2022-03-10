use crate::defaults::*;
use crate::{
    complex_types::PlainTextString,
    simple_types::{StCellRef, StCellType},
};

#[derive(Debug, XmlSerialize, XmlDeserialize)]
#[xmlserde(with_ns = b"http://schemas.openxmlformats.org/spreadsheetml/2006/main")]
pub struct ExternalLinkPart {
    #[xmlserde(name = b"externalBook", ty = "child")]
    pub external_book: Option<CtExternalBook>,
    // pub dde_link: Option<CtDdeLink>,
    // pub ole_link: Option<CtOleLink>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtExternalBook {
    #[xmlserde(name = b"sheetNames", ty = "child")]
    pub sheet_names: Option<CtExternalSheetNames>,
    #[xmlserde(name = b"definedNames", ty = "child")]
    pub defined_names: Option<CtExternalDefinedNames>,
    #[xmlserde(name = b"sheetDataSet", ty = "child")]
    pub sheet_data_set: Option<CtExternalSheetDataSet>,
    #[xmlserde(name = b"r:id", ty = "attr")]
    pub id: String,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtExternalSheetNames {
    #[xmlserde(name = b"sheetName", ty = "child")]
    pub names: Vec<CtExternalSheetName>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtExternalSheetName {
    #[xmlserde(name = b"val", ty = "attr")]
    pub val: String,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtExternalDefinedNames {
    #[xmlserde(name = b"definedName", ty = "child")]
    pub names: Vec<CtExternalDefinedName>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtExternalDefinedName {
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: String,
    #[xmlserde(name = b"refersTo", ty = "attr")]
    pub refers_to: Option<String>,
    #[xmlserde(name = b"sheetId", ty = "attr")]
    pub sheet_id: Option<u32>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtExternalSheetDataSet {
    #[xmlserde(name = b"sheetData", ty = "child")]
    pub data: Vec<CtExternalSheetData>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtExternalSheetData {
    #[xmlserde(name = b"row", ty = "child")]
    pub rows: Vec<CtExternalRow>,
    #[xmlserde(name = b"sheetId", ty = "attr")]
    pub sheet_id: u32,
    #[xmlserde(name = b"refreshError", ty = "attr", default = "default_false")]
    pub refresh_error: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtExternalRow {
    #[xmlserde(name = b"cell", ty = "child")]
    pub cells: Vec<CtExternalCell>,
    #[xmlserde(name = b"r", ty = "attr")]
    pub r: u32,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtExternalCell {
    #[xmlserde(name = b"v", ty = "child")]
    pub v: Option<PlainTextString>,
    #[xmlserde(name = b"r", ty = "attr")]
    pub r: Option<StCellRef>,
    #[xmlserde(name = b"t", ty = "attr", default = "st_cell_type_n")]
    pub t: StCellType,
    #[xmlserde(name = b"vm", ty = "attr", default = "default_zero_u32")]
    pub vm: u32,
}

#[cfg(test)]
mod tests {
    use super::ExternalLinkPart;
    use crate::xml_deserialize_from_str;
    #[test]
    fn test1() {
        let xml = include_str!("../../../workbook/examples/external_link.xml");
        let r = xml_deserialize_from_str::<ExternalLinkPart>(b"externalLink", xml);
        match r {
            Ok(external_link) => {
                let book = external_link.external_book.unwrap();
                assert_eq!(book.sheet_names.unwrap().names.len(), 12);
                // Used the site and the code below to check the diff manually.
                // Basically pass.
                // https://www.diffchecker.com/diff
                // use crate::xml_serialize_with_decl;
                // use crate::test_utils::*;
                // let expected = to_tree(&in_one_line(xml));
                // let actual = xml_serialize_with_decl(b"externalLink", external_link);
                // let r =  to_tree(&in_one_line(&actual));
                // println!("{:?}", actual);
                // use std::io::Write;
                // let mut file1 = std::fs::File::create("data1.txt").expect("create failed");
                // file1.write_all(expected.as_bytes()).expect("write failed");
                // let mut file2 = std::fs::File::create("data2.txt").expect("create failed");
                // file2.write_all(r.as_bytes()).expect("write failed");
                // assert_eq!(actual, r);
            }
            Err(e) => panic!("{:?}", e),
        }
    }
}
