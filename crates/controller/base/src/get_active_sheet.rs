use crate::SheetId;

pub trait GetActiveSheetTrait {
    fn get_active_sheet(&self) -> SheetId;
}
