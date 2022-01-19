use thiserror::Error;

#[derive(Error, Debug)]
pub enum OoxmlError {
    #[error("zip error")]
    ZipError(#[from] zip::result::ZipError),
    #[error("io error")]
    IoError(#[from] std::io::Error),
    #[error("xml error")]
    XmlError(#[from] quick_xml::Error),
    #[error("xml deserialization error")]
    XmlDeError(#[from] quick_xml::de::DeError),
    #[error("unknown data store error")]
    Unknown,
}

pub type Result<T> = std::result::Result<T, OoxmlError>;
