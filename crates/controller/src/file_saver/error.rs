use logisheets_base::SheetId;
use thiserror::Error;

/// The in-memory workbook is inconsistent with what .xlsx requires, so each
/// of these names the sheet it stumbled on.
#[derive(Debug, Error)]
pub enum SaveError {
    #[error("cannot save: sheet id {0} has no position in the workbook's sheet order")]
    SheetIdPosError(SheetId),
    #[error("cannot save: sheet id {0} has no name")]
    SheetNameError(SheetId),
}
