use logisheets_base::SheetId;

#[derive(Debug)]
pub enum SaveError {
    SheetIdPosError(SheetId),
    SheetNameError(SheetId),
    ZipError,
}
