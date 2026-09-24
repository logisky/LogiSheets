use gents_derives::TS;
use logisheets_base::errors::BasicError;
use logisheets_parser::errors::ParseError;
use logisheets_workbook::SerdeErr;
use thiserror::Error;

use crate::{edit_action::EditPayload, file_saver::SaveError, style_manager::errors::StyleError};

/// Every failure the engine reports. A write never surfaces this directly: a
/// rejected transaction is turned into `ActionEffect::error_message`, with
/// the failing payload wrapped in `PayloadFailed`.
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
    #[error("sheet index {0} is out of range; the workbook has fewer sheets than that")]
    UnavailableSheetIdx(usize),
    #[error("invalid payload: {0}")]
    PayloadError(String),
    /// A write would have given two records of one block the same row key.
    /// `(block, key, field)` is the addressing scheme, so a repeat makes one
    /// record unreachable and every aggregate over the block wrong — and does
    /// it silently, which is why this is a refusal rather than a warning.
    #[error(
        "block \"{block}\" already has a record keyed \"{key}\"; row keys address cells, so they must be unique within a block"
    )]
    DuplicateBlockKey { block: String, key: String },
    /// `index` indexes the payload list the caller sent, and `payload` is that
    /// entry in the JSON shape it arrived in.
    #[error("transaction rejected at payloads[{index}] of {total}: {source} (payload: {payload})")]
    PayloadFailed {
        index: usize,
        total: usize,
        payload: String,
        source: Box<Error>,
    },
    /// [`BasicError::While`] for the layers above the coordinate/id
    /// conversions, which know the request in names and A1 rather than ids.
    #[error("{doing}: {source}")]
    While { doing: String, source: Box<Error> },
}

/// [`logisheets_base::errors::Context`] for this crate's `Error`.
pub trait Context<T> {
    fn context(self, doing: impl FnOnce() -> String) -> Result<T, Error>;
}

impl<T> Context<T> for Result<T, Error> {
    fn context(self, doing: impl FnOnce() -> String) -> Result<T, Error> {
        self.map_err(|source| Error::While {
            doing: doing(),
            source: Box::new(source),
        })
    }
}

impl Error {
    /// Record which payload of a transaction raised this error.
    pub fn at_payload(self, index: usize, total: usize, payload: &EditPayload) -> Error {
        Error::PayloadFailed {
            index,
            total,
            payload: render_payload(payload),
            source: Box::new(self),
        }
    }

    /// The coarse category reported to hosts as `ErrorMessage::ty`. A wrapper
    /// reports the category of what it wraps: it says *where*, not *what*.
    pub fn code(&self) -> usize {
        match self {
            Error::Basic(_) => 0,
            Error::Style(_) => 1,
            Error::Serde(_) => 2,
            Error::Save(_) => 3,
            Error::Parse(_) => 4,
            Error::UnavailableSheetIdx(_) => 5,
            Error::PayloadError(_) => 6,
            Error::DuplicateBlockKey { .. } => 7,
            Error::PayloadFailed { source, .. } => source.code(),
            Error::While { source, .. } => source.code(),
        }
    }
}

/// Enough to show any payload's addressing fields, little enough that an
/// embedded image does not bury the reason.
const PAYLOAD_EXCERPT_LIMIT: usize = 400;

fn render_payload(payload: &EditPayload) -> String {
    match serde_json::to_string(payload) {
        Ok(json) if json.len() > PAYLOAD_EXCERPT_LIMIT => {
            let cut = (0..=PAYLOAD_EXCERPT_LIMIT)
                .rev()
                .find(|&i| json.is_char_boundary(i))
                .unwrap_or(0);
            format!("{}... truncated", &json[..cut])
        }
        Ok(json) => json,
        Err(e) => format!("<could not be rendered: {e}>"),
    }
}

/// A flattened error for hosts that cannot carry a Rust enum.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "error_message.ts", rename_all = "camelCase")]
pub struct ErrorMessage {
    pub msg: String,
    pub ty: usize,
}

impl From<Error> for ErrorMessage {
    fn from(value: Error) -> Self {
        ErrorMessage {
            ty: value.code(),
            msg: value.to_string(),
        }
    }
}
