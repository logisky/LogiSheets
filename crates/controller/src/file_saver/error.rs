use logisheets_base::SheetId;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SaveError {
    #[error("Sheet id position error")]
    SheetIdPosError(SheetId),
    #[error("Sheet name error")]
    SheetNameError(SheetId),
    #[error("Zip error")]
    ZipError,
}
