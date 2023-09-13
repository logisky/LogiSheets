use logisheets_base::errors::BasicError;
use logisheets_parser::errors::ParseError;
use logisheets_workbook::SerdeErr;
use thiserror::Error;

use crate::{file_saver::SaveError, style_manager::errors::StyleError};

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, Error)]
pub enum Error {
    #[error(transparent)]
    Basic(#[from] BasicError),
    #[error(transparent)]
    Style(#[from] StyleError),
    #[error(transparent)]
    Serde(#[from] SerdeErr),
    #[error(transparent)]
    Save(#[from] SaveError),
    #[error(transparent)]
    Parse(#[from] ParseError),
    #[error("unavailable sheet idx: {0}")]
    UnavailableSheetIdx(usize),
}
