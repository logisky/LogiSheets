use logisheets_base::errors::BasicError;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ParseError {
    #[error("parse col error: {0}")]
    ParseColFailed(String),
    #[error("parse row error: {0}")]
    ParseRowFailed(String),
    #[error(transparent)]
    Basic(#[from] BasicError),
    #[error("using ephemeral cell in reference is not allowed")]
    EphemeralCellInReference,
    /// A `Range` is either wholly normal or wholly inside one block, so a range
    /// whose endpoints straddle a block boundary (`=SUM(B1:B10)` where B1 is a
    /// block cell and B10 is not) has no representation. Rejecting the
    /// reference lets the formula fail; this used to panic, which took the
    /// whole engine instance down with it.
    #[error("a range that covers only part of a block is not supported")]
    PartialBlockRange,
    #[error("a range spanning two different blocks is not supported")]
    CrossBlockRange,
}
