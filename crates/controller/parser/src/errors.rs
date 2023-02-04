use thiserror::Error;

#[derive(Debug, Error)]
pub enum ParseError {
    #[error("parse col error: {0}")]
    ParseColFailed(String),
    #[error("parse row error: {0}")]
    ParseRowFailed(String),
}
