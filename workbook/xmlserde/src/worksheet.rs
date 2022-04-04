use super::complex_types::*;

#[derive(Debug, XmlSerialize, XmlDeserialize)]
#[xmlserde(with_ns = b"http://schemas.openxmlformats.org/spreadsheetml/2006/main")]
// Some worksheet contains an legacyDrawing element. We just ignored it.
pub struct WorksheetPart {
    #[xmlserde(name = b"sheetPr", ty = "child")]
    pub sheet_pr: Option<CtSheetPr>,
    #[xmlserde(name = b"dimension", ty = "child")]
    pub dimension: Option<CtSheetDimension>,
    #[xmlserde(name = b"sheetViews", ty = "child")]
    pub sheet_views: Option<CtSheetViews>,
    #[xmlserde(name = b"sheetFormatPr", ty = "child")]
    pub sheet_format_pr: Option<CtSheetFormatPr>,
    #[xmlserde(name = b"cols", ty = "child")]
    pub cols: Option<CtCols>,
    #[xmlserde(name = b"sheetData", ty = "child")]
    pub sheet_data: CtSheetData,
    #[xmlserde(name = b"sheetCalcPr", ty = "child")]
    pub sheet_calc_pr: Option<CtSheetCalcPr>,
    #[xmlserde(name = b"sheetProtection", ty = "child")]
    pub sheet_protection: Option<CtSheetProtection>,
    #[xmlserde(name = b"protectedRanges", ty = "child")]
    pub protected_ranges: Option<CtProtectedRanges>,
    #[xmlserde(name = b"scenarios", ty = "child")]
    pub scenarios: Option<CtScenarios>,
    #[xmlserde(name = b"autoFilter", ty = "child")]
    pub auto_filter: Option<CtAutoFilter>,
    #[xmlserde(name = b"sortState", ty = "child")]
    pub sort_state: Option<CtSortState>,
    #[xmlserde(name = b"dataConsolidate", ty = "child")]
    pub data_consolidate: Option<CtDataConsolidate>,
    #[xmlserde(name = b"customSheetViews", ty = "child")]
    pub custom_sheet_views: Option<CtCustomSheetViews>,
    #[xmlserde(name = b"mergeCells", ty = "child")]
    pub merge_cells: Option<CtMergeCells>,
    #[xmlserde(name = b"phoneticPr", ty = "child")]
    pub phonetic_pr: Option<CtPhoneticPr>,
    #[xmlserde(name = b"conditionalFormatting", ty = "child")]
    pub conditional_formatting: Vec<CtConditionalFormatting>,
    #[xmlserde(name = b"dataValidations", ty = "child")]
    pub data_validations: Option<CtDataValidations>,
    #[xmlserde(name = b"hyperlinks", ty = "child")]
    pub hyperlinks: Option<CtHyperlinks>,
    #[xmlserde(name = b"printOptions", ty = "child")]
    pub print_options: Option<CtPrintOptions>,
    #[xmlserde(name = b"pageMargins", ty = "child")]
    pub page_margins: Option<CtPageMargins>,
    #[xmlserde(name = b"pageSetup", ty = "child")]
    pub page_setup: Option<CtPageSetup>,
    #[xmlserde(name = b"headerFooter", ty = "child")]
    pub header_footer: Option<CtHeaderFooter>,
    #[xmlserde(name = b"rowBreaks", ty = "child")]
    pub row_breaks: Option<CtPageBreak>,
    #[xmlserde(name = b"colBreaks", ty = "child")]
    pub col_breaks: Option<CtPageBreak>,
    #[xmlserde(name = b"customProperties", ty = "child")]
    pub custom_properties: Option<CtCustomProperties>,
    #[xmlserde(name = b"cellWatches", ty = "child")]
    pub cell_watches: Option<CtCellWatches>,
    #[xmlserde(name = b"ignoredErrors", ty = "child")]
    pub ignored_errors: Option<CtIgnoredErrors>,
    #[xmlserde(name = b"smartTags", ty = "child")]
    pub smart_tags: Option<CtSmartTags>,
    #[xmlserde(name = b"drawing", ty = "child")]
    pub drawing: Option<CtDrawing>,
    #[xmlserde(name = b"drawingHF", ty = "child")]
    pub drawing_hf: Option<CtDrawingHF>,
    #[xmlserde(name = b"picture", ty = "child")]
    pub picture: Option<CtSheetBackgroundPicture>,
    // #[xmlserde(name = b"oleObjects", ty = "child")]
    // pub ole_objects: Option<CtOleObjects>,
    #[xmlserde(name = b"controls", ty = "child")]
    pub controls: Option<CtControls>,
    #[xmlserde(name = b"webPublishItems", ty = "child")]
    pub web_publish_items: Option<CtWebPublishItems>,
    #[xmlserde(name = b"tableParts", ty = "child")]
    pub table_parts: Option<CtTableParts>,
}

#[cfg(test)]
mod tests {
    use super::WorksheetPart;
    use crate::xml_deserialize_from_str;
    #[test]
    fn test1() {
        let xml = include_str!("../../examples/sheet1.xml");
        let r = xml_deserialize_from_str::<WorksheetPart>(b"worksheet", xml);
        match r {
            Ok(_) => {
                // Used the site and the code below to check the diff manually.
                // Basically pass.
                // https://www.diffchecker.com/diff
                // use crate::xml_serialize_with_decl;
                // use crate::test_utils::*;
                // let expected = to_tree(&in_one_line(xml));
                // let actual = xml_serialize_with_decl(b"worksheet", external_link);
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
