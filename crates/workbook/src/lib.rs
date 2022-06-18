#[macro_use]
extern crate ts_rs;
#[macro_use]
extern crate xmlserde;
mod ooxml;
pub mod reader;
pub mod rtypes;
pub mod workbook;
pub mod writer;
#[cfg(test)]
mod zipdiff;
use thiserror::Error;
use xmlserde::*;

pub mod prelude {
    pub use super::ooxml::comments::*;
    pub use super::ooxml::complex_types::*;
    pub use super::ooxml::simple_types::*;
    pub use super::ooxml::sst::SstPart;
    pub use super::ooxml::style_sheet::StylesheetPart;
    pub use super::ooxml::theme::*;
    pub use super::ooxml::workbook::*;
    pub use super::ooxml::worksheet::*;
    pub use super::reader::*;
    pub use super::workbook::Workbook;
    pub use super::SerdeErr;
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
