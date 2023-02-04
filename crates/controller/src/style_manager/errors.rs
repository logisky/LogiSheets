use logisheets_base::StyleId;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum StyleError {
    #[error("cannot find the style id: {0}")]
    StyleIdNotFound(StyleId),
}
