use super::complex_types::*;
use crate::Unparsed;
use xmlserde_derives::{XmlDeserialize, XmlSerialize};

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
    pub ext_lst: Option<Unparsed>,
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
            }
            Err(e) => panic!("{:?}", e),
        }
    }
}
