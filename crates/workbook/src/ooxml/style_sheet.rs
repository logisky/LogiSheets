use super::complex_types::*;
use crate::Unparsed;

#[derive(XmlSerialize, XmlDeserialize, Debug)]
#[xmlserde(root = b"styleSheet")]
#[xmlserde(with_ns = b"http://schemas.openxmlformats.org/spreadsheetml/2006/main")]
pub struct StylesheetPart {
    #[xmlserde(name = b"numFmts", ty = "child")]
    pub num_fmts: Option<CtNumFmts>,
    #[xmlserde(name = b"fonts", ty = "child")]
    pub fonts: Option<CtFonts>,
    #[xmlserde(name = b"fills", ty = "child")]
    pub fills: Option<CtFills>,
    #[xmlserde(name = b"borders", ty = "child")]
    pub borders: Option<CtBorders>,
    #[xmlserde(name = b"cellStyleXfs", ty = "child")]
    pub cell_style_xfs: Option<CtCellStyleXfs>,
    #[xmlserde(name = b"cellXfs", ty = "child")]
    pub cell_xfs: Option<CtCellXfs>,
    #[xmlserde(name = b"cellStyles", ty = "child")]
    pub cell_styles: Option<CtCellStyles>,
    #[xmlserde(name = b"dxfs", ty = "child")]
    pub dxfs: Option<CtDxfs>,
    #[xmlserde(name = b"tableStyles", ty = "child")]
    pub table_styles: Option<CtTableStyles>,
    #[xmlserde(name = b"colors", ty = "child")]
    pub colors: Option<CtColors>,
    #[xmlserde(name = b"extLst", ty = "child")]
    pub ext_lst: Unparsed,
}

#[cfg(test)]
mod tests {
    use super::StylesheetPart;
    use crate::xml_deserialize_from_str;
    #[test]
    fn test1() {
        let xml = include_str!("../../examples/styles2.xml");
        let r = xml_deserialize_from_str::<StylesheetPart>(xml);
        match r {
            Ok(sst) => {
                assert_eq!(sst.cell_style_xfs.unwrap().xfs.len(), 47);
                assert_eq!(sst.cell_xfs.unwrap().xfs.len(), 90);
                assert_eq!(sst.num_fmts.unwrap().num_fmts.len(), 6);
                assert_eq!(sst.fonts.unwrap().fonts.len(), 29);
                // Used the site and the code below to check the diff manually.
                // Basically pass.
                // https://www.diffchecker.com/diff
                // use crate::xml_serialize_with_decl;
                // let actual = in_one_line(xml);
                // let r = xml_serialize_with_decl(b"styleSheet", sst);
                // use std::io::Write;
                // let mut file1 = std::fs::File::create("data1.txt").expect("create failed");
                // file1.write_all(actual.as_bytes()).expect("write failed");
                // let mut file2 = std::fs::File::create("data2.txt").expect("create failed");
                // file2.write_all(r.as_bytes()).expect("write failed");
                // assert_eq!(actual, r);
            }
            Err(e) => panic!("{:?}", e),
        }
    }
}
