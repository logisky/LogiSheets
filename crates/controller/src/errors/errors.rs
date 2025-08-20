use gents_derives::TS;
use logisheets_base::errors::BasicError;
use logisheets_parser::errors::ParseError;
use logisheets_workbook::SerdeErr;
use thiserror::Error;

use crate::{file_saver::SaveError, style_manager::errors::StyleError};

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
    #[error("invalid payload: {0}")]
    PayloadError(String),
}

// A cleaner way for users to know about the error and a more convenient
// way to use in WASM.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "error_message.ts", rename_all = "camelCase")]
pub struct ErrorMessage {
    pub msg: String,
    pub ty: usize,
}

impl From<Error> for ErrorMessage {
    fn from(value: Error) -> Self {
        match value {
            Error::Basic(e) => {
                let msg = e.to_string();
                ErrorMessage { msg, ty: 0 }
            }
            Error::Style(e) => {
                let msg = e.to_string();
                ErrorMessage { msg, ty: 1 }
            }
            Error::Serde(e) => {
                let msg = e.to_string();
                ErrorMessage { msg, ty: 2 }
            }
            Error::Save(e) => {
                let msg = e.to_string();
                ErrorMessage { msg, ty: 3 }
            }
            Error::Parse(e) => {
                let msg = e.to_string();
                ErrorMessage { msg, ty: 4 }
            }
            Error::UnavailableSheetIdx(e) => {
                let msg = e.to_string();
                ErrorMessage { msg, ty: 5 }
            }
            Error::PayloadError(e) => {
                let msg = e;
                ErrorMessage { msg, ty: 6 }
            }
        }
    }
}
