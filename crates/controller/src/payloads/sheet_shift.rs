#[derive(Debug, Clone)]
pub struct SheetShiftPayload {
    pub idx: usize,
    pub ty: SheetShiftType,
}

#[derive(Debug, Clone)]
pub enum SheetShiftType {
    Insert,
    Delete,
}

#[derive(Debug, Clone)]
pub struct SheetRenamePayload {
    pub old_name: String,
    pub new_name: String,
}
