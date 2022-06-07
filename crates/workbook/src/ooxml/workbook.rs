use super::complex_types::*;
use super::simple_types::*;

#[derive(Debug, XmlSerialize, XmlDeserialize)]
#[xmlserde(root = b"workbook")]
#[xmlserde(with_ns = b"http://schemas.openxmlformats.org/spreadsheetml/2006/main")]
pub struct WorkbookPart {
    #[xmlserde(name = b"fileVersion", ty = "child")]
    pub file_version: Option<CtFileVersion>,
    #[xmlserde(name = b"fileSharing", ty = "child")]
    pub file_sharing: Option<CtFileSharing>,
    #[xmlserde(name = b"workbookPr", ty = "child")]
    pub workbook_pr: Option<CtWorkbookPr>,
    #[xmlserde(name = b"workbookProtection", ty = "child")]
    pub workbook_protection: Option<CtWorkbookProtection>,
    #[xmlserde(name = b"bookViews", ty = "child")]
    pub book_views: Option<CtBookViews>,
    #[xmlserde(name = b"sheets", ty = "child")]
    pub sheets: CtSheets,
    #[xmlserde(name = b"functionGroups", ty = "child")]
    pub function_groups: Option<CtFunctionGroups>,
    #[xmlserde(name = b"externalReferences", ty = "child")]
    pub external_references: Option<CtExternalReferences>,
    #[xmlserde(name = b"definedNames", ty = "child")]
    pub defined_names: Option<CtDefinedNames>,
    #[xmlserde(name = b"calcPr", ty = "child")]
    pub calc_pr: Option<CtCalcPr>,
    #[xmlserde(name = b"oleSize", ty = "child")]
    pub ole_size: Option<CtOleSize>,
    #[xmlserde(name = b"customWorkbookViews", ty = "child")]
    pub custom_workbook_views: Option<CtCustomWorkbookViews>,
    #[xmlserde(name = b"pivotCaches", ty = "child")]
    pub pivot_caches: Option<CtPivotCaches>,
    #[xmlserde(name = b"smartTagPr", ty = "child")]
    pub smart_tag_pr: Option<CtSmartTagPr>,
    #[xmlserde(name = b"smartTagTypes", ty = "child")]
    pub smart_tag_types: Option<CtSmartTagTypes>,
    #[xmlserde(name = b"webPublishing", ty = "child")]
    pub web_publishing: Option<CtWebPublishing>,
    #[xmlserde(name = b"fileRecoveryPr", ty = "child")]
    pub file_recovery_pr: Option<CtFileRecoveryPr>,
    #[xmlserde(name = b"webPublishObjects", ty = "child")]
    pub web_publish_objects: Option<CtWebPublishObjects>,
    #[xmlserde(name = b"conformance", ty = "attr")]
    pub conformance: Option<StConformanceClass>,
}

#[cfg(test)]
mod tests {
    use super::WorkbookPart;
    use crate::xml_deserialize_from_str;
    #[test]
    fn test1() {
        let xml = include_str!("../../examples/workbook.xml");
        let r = xml_deserialize_from_str::<WorkbookPart>(xml);
        match r {
            Ok(wb) => {
                assert_eq!(wb.sheets.sheets.len(), 15);
                // Used the site and the code below to check the diff manually.
                // Basically pass.
                // https://www.diffchecker.com/diff
                // use crate::xml_serialize_with_decl;
                // use crate::test_utils::*;
                // let expected = to_tree(&in_one_line(xml));
                // let actual = xml_serialize_with_decl(b"workbook", wb);
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
