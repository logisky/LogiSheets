use logisheets_base::{FuncId, SheetId, TextId};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum IdError {
    #[error("cannot find the text id: {0}")]
    TextIdNotFound(TextId),
    #[error("cannot find the sheet id: {0}")]
    SheetIdNotFound(SheetId),
    #[error("cannot find the func id: {0}")]
    FuncIdNotFound(FuncId),
    #[error("cannot find the sheet name: {0}")]
    SheetNameNotFound(String),
}
