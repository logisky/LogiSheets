pub mod reader;
pub mod rtypes;
pub mod workbook;
pub mod writer;
use logisheets_xmlserde::*;
use thiserror::Error;

pub mod prelude {
    pub use super::comments::*;
    pub use super::complex_types::*;
    pub use super::reader::*;
    pub use super::simple_types::*;
    pub use super::sst::SstPart;
    pub use super::style_sheet::StylesheetPart;
    pub use super::workbook::Workbook;
    pub use super::worksheet::*;
    pub use super::SerdeErr;
    pub use logisheets_xmlserde::workbook::WorkbookPart;
    pub use logisheets_xmlserde::*;
}

#[derive(Debug, Error)]
pub enum SerdeErr {
    #[error("zip error")]
    ZipError(#[from] zip::result::ZipError),
    #[error("io error")]
    IoError(#[from] std::io::Error),
    #[error("xml error")]
    XmlError(#[from] quick_xml::Error),
    #[error("custom error")]
    Custom(String),
}
